const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');

const prisma = new PrismaClient();

const connectedDevices = new Map();

const setupSocketIO = (io) => {
  io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id}`);

    // Authenticate socket connection (admin clients)
    socket.on('authenticate', async (data) => {
      try {
        const decoded = jwt.verify(data.token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
        socket.userId = decoded.userId;
        socket.join(`user:${decoded.userId}`);
        socket.emit('authenticated', { success: true });
      } catch (err) {
        socket.emit('authentication_error', { message: 'Invalid token' });
      }
    });

    // ─── Player: device:register ──────────────────────────────────────────────
    // Called by the player on Socket.IO connect to associate socket with device.
    socket.on('device:register', async (data) => {
      try {
        const { deviceId, deviceName, playerVersion } = data;
        if (!deviceId) return;

        // Track in memory
        connectedDevices.set(deviceId, {
          socketId: socket.id,
          deviceId,
          deviceName: deviceName || deviceId,
          playerVersion,
          connectedAt: new Date(),
        });

        socket.deviceId = deviceId;
        socket.join(`device:${deviceId}`);

        // Update DB — also fetch tenantId for room assignment
        const deviceRecord = await prisma.device.upsert({
          where: { deviceId },
          update: {
            status: 'ONLINE',
            lastSeen: new Date(),
            ipAddress: socket.handshake.address,
            ...(deviceName && { name: deviceName }),
            ...(playerVersion && { firmware: playerVersion }),
          },
          create: {
            id: require('uuid').v4(),
            deviceId,
            name: deviceName || deviceId,
            status: 'ONLINE',
            lastSeen: new Date(),
            ipAddress: socket.handshake.address,
            firmware: playerVersion || null,
            isActive: true,
          },
          select: { tenantId: true },
        }).catch(() => null);

        // Join tenant room so emergency broadcasts stay tenant-scoped
        if (deviceRecord?.tenantId) {
          socket.tenantId = deviceRecord.tenantId;
          socket.join(`tenant:${deviceRecord.tenantId}`);
        }

        // Broadcast to admin clients
        io.emit('device:status', {
          deviceId,
          status: 'ONLINE',
          info: { name: deviceName, playerVersion, socketId: socket.id },
        });

        // Send ping to verify connection
        socket.emit('device:ping', { timestamp: Date.now() });

        console.log(`[Socket] Player registered: ${deviceName} (${deviceId})`);
      } catch (err) {
        console.error('[Socket] device:register error:', err);
      }
    });

    // ─── Legacy: device:connect (backwards compat) ────────────────────────────
    socket.on('device:connect', async (data) => {
      try {
        const { deviceId, status } = data;
        connectedDevices.set(deviceId, {
          socketId: socket.id,
          deviceId,
          connectedAt: new Date(),
        });

        socket.deviceId = deviceId;
        socket.join(`device:${deviceId}`);

        await prisma.device.update({
          where: { deviceId },
          data: {
            status: 'ONLINE',
            lastSeen: new Date(),
            ipAddress: socket.handshake.address,
          },
        }).catch(() => {});

        io.emit('device:status', { deviceId, status: 'ONLINE' });
        console.log(`[Socket] Device connected (legacy): ${deviceId}`);
      } catch (err) {
        console.error('[Socket] device:connect error:', err);
      }
    });

    // ─── Device status update ─────────────────────────────────────────────────
    socket.on('device:status', async (data) => {
      try {
        const { deviceId, status, info } = data;

        // Update DB safely (only known fields)
        await prisma.device.update({
          where: { deviceId },
          data: { lastSeen: new Date() },
        }).catch(() => {});

        // Broadcast to admin clients
        io.emit('device:status', { deviceId, status, info: info ?? status });
      } catch (err) {
        console.error('[Socket] device:status error:', err);
      }
    });

    // ─── Remote control: admin → device ──────────────────────────────────────
    // Admin sends command; forward to the specific device socket room.
    socket.on('remote:command', (data) => {
      if (!socket.userId) {
        return socket.emit('error', { message: 'Authentication required' });
      }
      const { deviceId, command, params, value } = data;

      // Build the payload the player expects
      const payload = {
        command,
        value: value ?? params?.value,
        deviceId,
      };

      io.to(`device:${deviceId}`).emit('remote:command', payload);
      console.log(`[Socket] Remote command to ${deviceId}: ${command}`);
    });

    // ─── Screenshot request: admin → device ──────────────────────────────────
    socket.on('remote:screenshot', (data) => {
      if (!socket.userId) {
        return socket.emit('error', { message: 'Authentication required' });
      }
      const { deviceId } = data;
      // Forward screenshot request to device
      io.to(`device:${deviceId}`).emit('remote:screenshot');
      console.log(`[Socket] Screenshot requested from ${deviceId}`);
    });

    // ─── Screenshot response: device → admin ─────────────────────────────────
    socket.on('device:screenshot', (data) => {
      const { deviceId, timestamp } = data;
      // Broadcast to all admin clients
      io.emit('device:screenshot', {
        deviceId,
        socketId: socket.id,
        timestamp: timestamp || Date.now(),
      });
    });

    // ─── Schedule/content update notifications ────────────────────────────────
    // Admin triggers these to notify devices of changes.
    socket.on('schedule:deploy', (data) => {
      if (!socket.userId) {
        return socket.emit('error', { message: 'Authentication required' });
      }
      const { deviceId } = data;
      if (deviceId) {
        io.to(`device:${deviceId}`).emit('schedule:update', { timestamp: Date.now() });
      } else {
        // Broadcast to all devices
        io.emit('schedule:update', { timestamp: Date.now() });
      }
    });

    socket.on('content:update', (data) => {
      if (!socket.userId) {
        return socket.emit('error', { message: 'Authentication required' });
      }
      const { deviceId } = data;
      if (deviceId) {
        io.to(`device:${deviceId}`).emit('content:update', { timestamp: Date.now() });
      } else {
        io.emit('content:update', { timestamp: Date.now() });
      }
    });

    // ─── V4 Phase 15: 동기화 재생 ─────────────────────────────────────────────

    // 동기화 그룹 참가
    socket.on('sync:join', (data) => {
      const { groupId, deviceId } = data;
      socket.join(`sync:${groupId}`);
      console.log(`[Sync] Device ${deviceId} joined sync group ${groupId}`);
      io.to(`sync:${groupId}`).emit('sync:member-joined', { deviceId, timestamp: Date.now() });
    });

    // 동기화 그룹 탈퇴
    socket.on('sync:leave', (data) => {
      const { groupId, deviceId } = data;
      socket.leave(`sync:${groupId}`);
      io.to(`sync:${groupId}`).emit('sync:member-left', { deviceId });
    });

    // 동기화 재생 시작 (마스터 → 전체)
    socket.on('sync:start', (data) => {
      if (!socket.userId) {
        return socket.emit('error', { message: 'Authentication required' });
      }
      const { groupId, contentId, timestamp } = data;
      // 1초 후 동시 시작 (네트워크 전파 시간 확보)
      const startAt = Date.now() + 1000;
      io.to(`sync:${groupId}`).emit('sync:play', {
        groupId,
        contentId,
        timestamp: timestamp || Date.now(),
        startAt
      });
      console.log(`[Sync] Play started for group ${groupId}, startAt: ${startAt}`);
    });

    // 동기화 일시정지
    socket.on('sync:pause', (data) => {
      const { groupId } = data;
      io.to(`sync:${groupId}`).emit('sync:pause', { groupId, timestamp: Date.now() });
    });

    // 동기화 틱 (마스터가 주기적 전송)
    socket.on('sync:tick', (data) => {
      const { groupId, position, timestamp } = data;
      // 마스터를 제외한 나머지에게 전송
      socket.to(`sync:${groupId}`).emit('sync:tick', {
        groupId,
        position,
        timestamp: timestamp || Date.now()
      });
    });

    // Drift 보고 (슬레이브 → 서버)
    socket.on('sync:drift-report', (data) => {
      const { groupId, deviceId, driftMs } = data;
      console.log(`[Sync] Drift report from ${deviceId}: ${driftMs}ms`);
      // 관리자에게 drift 알림
      io.emit('sync:drift', { groupId, deviceId, driftMs, timestamp: Date.now() });
    });

    // 강제 재동기화 (관리자 → 그룹)
    socket.on('sync:force-resync', (data) => {
      if (!socket.userId) {
        return socket.emit('error', { message: 'Authentication required' });
      }
      const { groupId } = data;
      io.to(`sync:${groupId}`).emit('sync:resync', { groupId, timestamp: Date.now() });
      console.log(`[Sync] Force resync for group ${groupId}`);
    });

    // ─── Disconnect ───────────────────────────────────────────────────────────
    socket.on('disconnect', async () => {
      console.log(`[Socket] Disconnected: ${socket.id}`);

      if (socket.deviceId) {
        connectedDevices.delete(socket.deviceId);

        await prisma.device.update({
          where: { deviceId: socket.deviceId },
          data: { status: 'OFFLINE', lastSeen: new Date() },
        }).catch(() => {});

        io.emit('device:status', {
          deviceId: socket.deviceId,
          status: 'OFFLINE',
        });
      }
    });
  });

  return { connectedDevices };
};

const getConnectedDevices = () => connectedDevices;

module.exports = { setupSocketIO, getConnectedDevices };
