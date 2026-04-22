const prisma = require('../utils/prisma');
const { verifyTenantOwnership } = require('../middleware/tenant');
const { v4: uuidv4 } = require('uuid');

const getSchedules = async (req, res) => {
  try {
    const { page = 1, limit = 50, type, status, startDate, endDate } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = { isActive: true };
    if (req.tenantId) where.tenantId = req.tenantId;
    if (type) where.type = type;
    if (status) where.status = status;
    if (startDate || endDate) {
      where.startDate = {};
      if (startDate) where.startDate.gte = new Date(startDate);
      if (endDate) where.startDate.lte = new Date(endDate);
    }

    const [items, total] = await Promise.all([
      prisma.schedule.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy: { startDate: 'asc' },
        include: {
          creator: { select: { id: true, username: true } },
          playlist: { select: { id: true, name: true, type: true } },
          layout: {
            select: { id: true, name: true, _count: { select: { zones: true } } }
          },
          devices: {
            include: { device: { select: { id: true, name: true, status: true } } }
          }
        }
      }),
      prisma.schedule.count({ where })
    ]);

    res.json({
      items,
      pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get schedules' });
  }
};

const getScheduleById = async (req, res) => {
  try {
    const schedule = await prisma.schedule.findUnique({
      where: { id: req.params.id },
      include: {
        creator: { select: { id: true, username: true } },
        playlist: true,
        layout: {
          select: { id: true, name: true, baseWidth: true, baseHeight: true }
        },
        devices: {
          include: { device: true }
        }
      }
    });

    if (!schedule) {
      return res.status(404).json({ error: 'Schedule not found' });
    }

    if (!verifyTenantOwnership(schedule, req)) {
      return res.status(403).json({ error: '접근 권한이 없습니다' });
    }

    res.json(schedule);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get schedule' });
  }
};

const createSchedule = async (req, res) => {
  try {
    const {
      name, type, playlistId, layoutId, startDate, endDate,
      startTime, endTime, repeatType, repeatDays, deviceIds, settings
    } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Schedule name is required' });
    }
    if (!startDate) {
      return res.status(400).json({ error: 'Start date is required' });
    }
    if (endDate && new Date(endDate) < new Date(startDate)) {
      return res.status(400).json({ error: 'End date must be after start date' });
    }

    const schedule = await prisma.schedule.create({
      data: {
        id: uuidv4(),
        name,
        type: type || 'CONTENT',
        playlistId: playlistId || null,
        layoutId: layoutId || null,
        startDate: new Date(startDate),
        endDate: endDate ? new Date(endDate) : null,
        startTime,
        endTime,
        repeatType: repeatType || 'NONE',
        repeatDays,
        settings: settings ? JSON.stringify(settings) : null,
        createdBy: req.user.id,
        status: 'DRAFT',
        tenantId: req.tenantId || req.user.tenantId
      }
    });

    // Assign devices
    if (deviceIds && deviceIds.length > 0) {
      await prisma.scheduleDevice.createMany({
        data: deviceIds.map(deviceId => ({
          id: uuidv4(),
          scheduleId: schedule.id,
          deviceId,
          status: 'PENDING'
        }))
      });
    }

    const result = await prisma.schedule.findUnique({
      where: { id: schedule.id },
      include: {
        creator: { select: { id: true, username: true } },
        playlist: { select: { id: true, name: true } },
        devices: { include: { device: { select: { id: true, name: true } } } }
      }
    });

    res.status(201).json(result);
  } catch (error) {
    console.error('Create schedule error:', error);
    res.status(500).json({ error: 'Failed to create schedule' });
  }
};

const updateSchedule = async (req, res) => {
  try {
    const {
      name, type, playlistId, layoutId, startDate, endDate,
      startTime, endTime, repeatType, repeatDays, status, deviceIds, settings
    } = req.body;

    const schedule = await prisma.schedule.findUnique({ where: { id: req.params.id } });
    if (!schedule) {
      return res.status(404).json({ error: 'Schedule not found' });
    }
    if (!verifyTenantOwnership(schedule, req)) {
      return res.status(403).json({ error: '접근 권한이 없습니다' });
    }

    await prisma.schedule.update({
      where: { id: req.params.id },
      data: {
        ...(name && { name }),
        ...(type && { type }),
        ...(playlistId !== undefined && { playlistId }),
        ...(layoutId !== undefined && { layoutId }),
        ...(startDate && { startDate: new Date(startDate) }),
        ...(endDate !== undefined && { endDate: endDate ? new Date(endDate) : null }),
        ...(startTime !== undefined && { startTime }),
        ...(endTime !== undefined && { endTime }),
        ...(repeatType && { repeatType }),
        ...(repeatDays !== undefined && { repeatDays }),
        ...(status && { status }),
        ...(settings && { settings: JSON.stringify(settings) })
      }
    });

    // Update devices if provided
    if (deviceIds !== undefined) {
      await prisma.scheduleDevice.deleteMany({ where: { scheduleId: req.params.id } });
      if (deviceIds.length > 0) {
        await prisma.scheduleDevice.createMany({
          data: deviceIds.map(deviceId => ({
            id: uuidv4(),
            scheduleId: req.params.id,
            deviceId,
            status: 'PENDING'
          }))
        });
      }
    }

    const result = await prisma.schedule.findUnique({
      where: { id: req.params.id },
      include: {
        creator: { select: { id: true, username: true } },
        playlist: { select: { id: true, name: true } },
        devices: { include: { device: { select: { id: true, name: true, deviceId: true } } } }
      }
    });

    // If the schedule is ACTIVE, notify deployed devices of the change
    if (req.io && result && (result.status === 'ACTIVE' || schedule.status === 'ACTIVE')) {
      result.devices.forEach(sd => {
        if (!sd.device) return;
        req.io.to(`device:${sd.device.deviceId}`).emit('schedule:update', {
          scheduleId: result.id,
          timestamp: Date.now()
        });
      });
    }

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update schedule' });
  }
};

const deleteSchedule = async (req, res) => {
  try {
    const schedule = await prisma.schedule.findUnique({
      where: { id: req.params.id },
      include: {
        devices: { include: { device: true } }
      }
    });
    if (!schedule) {
      return res.status(404).json({ error: 'Schedule not found' });
    }
    if (!verifyTenantOwnership(schedule, req)) {
      return res.status(403).json({ error: '접근 권한이 없습니다' });
    }

    await prisma.schedule.update({
      where: { id: req.params.id },
      data: { isActive: false, status: 'CANCELLED' }
    });

    // Cancel all device assignments so deployed devices stop showing this schedule
    await prisma.scheduleDevice.updateMany({
      where: { scheduleId: req.params.id },
      data: { status: 'CANCELLED' }
    });

    // 배포된 장치에게 스케줄 취소 알림 → 즉시 스케줄 새로고침
    if (req.io && schedule.devices?.length > 0) {
      schedule.devices.forEach(sd => {
        if (!sd.device) return;
        req.io.to(`device:${sd.device.deviceId}`).emit('schedule:update', {
          scheduleId: schedule.id,
          action: 'cancelled',
          timestamp: Date.now()
        });
      });
    }

    res.json({ message: 'Schedule deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete schedule' });
  }
};

const deploySchedule = async (req, res) => {
  try {
    const schedule = await prisma.schedule.findUnique({
      where: { id: req.params.id },
      include: {
        devices: { include: { device: true } },
        playlist: true
      }
    });

    if (!schedule) {
      return res.status(404).json({ error: 'Schedule not found' });
    }

    if (!verifyTenantOwnership(schedule, req)) {
      return res.status(403).json({ error: '접근 권한이 없습니다' });
    }

    // ── 시간대 중복 충돌 감지 ────────────────────────────────────────
    // 같은 장치에 이미 ACTIVE 상태이고 날짜·시간이 겹치는 스케줄이 있으면 경고
    if (schedule.devices.length > 0) {
      const deviceIds = schedule.devices.map(sd => sd.deviceId);
      const conflicts = await prisma.scheduleDevice.findMany({
        where: {
          deviceId: { in: deviceIds },
          scheduleId: { not: req.params.id },
          schedule: { isActive: true, status: 'ACTIVE' }
        },
        include: {
          schedule: { select: { id: true, name: true, startDate: true, endDate: true, startTime: true, endTime: true } },
          device: { select: { name: true } }
        }
      });

      // 날짜+시간 범위 겹침 여부 확인
      const overlapping = conflicts.filter(c => {
        const cs = c.schedule;
        // 날짜 범위 겹침 체크
        const newStart = new Date(schedule.startDate);
        const newEnd = schedule.endDate ? new Date(schedule.endDate) : new Date('2099-12-31');
        const cStart = new Date(cs.startDate);
        const cEnd = cs.endDate ? new Date(cs.endDate) : new Date('2099-12-31');
        if (newStart > cEnd || cStart > newEnd) return false; // 날짜 안 겹침

        // 시간 범위 겹침 체크 (HH:mm 문자열 비교)
        const newTimeStart = schedule.startTime || '00:00';
        const newTimeEnd = schedule.endTime || '23:59';
        const cTimeStart = cs.startTime || '00:00';
        const cTimeEnd = cs.endTime || '23:59';
        if (newTimeStart >= cTimeEnd || cTimeStart >= newTimeEnd) return false; // 시간 안 겹침

        return true;
      });

      if (overlapping.length > 0) {
        const conflictInfo = overlapping.map(c =>
          `"${c.schedule.name}" (${c.device.name}, ${c.schedule.startTime}~${c.schedule.endTime})`
        ).join(', ');
        // 경고는 반환하되 force=true 파라미터로 강제 배포 허용
        if (!req.query.force) {
          return res.status(409).json({
            error: '시간대 중복 충돌',
            message: `같은 시간대에 이미 배포된 스케줄이 있습니다: ${conflictInfo}`,
            conflicts: overlapping.map(c => ({
              scheduleId: c.schedule.id,
              scheduleName: c.schedule.name,
              deviceName: c.device.name,
              timeRange: `${c.schedule.startTime}~${c.schedule.endTime}`
            }))
          });
        }
      }
    }
    // ────────────────────────────────────────────────────────────────

    // Update schedule status
    await prisma.schedule.update({
      where: { id: req.params.id },
      data: { status: 'ACTIVE' }
    });

    // Update device assignments
    await prisma.scheduleDevice.updateMany({
      where: { scheduleId: req.params.id },
      data: { status: 'DEPLOYED', deployedAt: new Date() }
    });

    // Emit socket event
    if (req.io) {
      schedule.devices.forEach(sd => {
        if (!sd.device) return; // Skip if device was deleted
        // Emit 'schedule:update' so the player's useSocket hook refreshes schedules
        req.io.to(`device:${sd.device.deviceId}`).emit('schedule:update', {
          scheduleId: schedule.id,
          timestamp: Date.now()
        });
        // Also emit legacy event for backwards compat
        req.io.to(`device:${sd.device.deviceId}`).emit('schedule:deployed', {
          scheduleId: schedule.id,
          playlistId: schedule.playlistId,
          layoutId: schedule.layoutId
        });
      });

      req.io.emit('schedule:deployed', { scheduleId: schedule.id, status: 'ACTIVE' });
    }

    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        tenantId: schedule.tenantId,
        action: 'DEPLOY_SCHEDULE',
        target: schedule.id,
        details: `Deployed schedule: ${schedule.name}`
      }
    });

    res.json({ message: 'Schedule deployed successfully', schedule: { ...schedule, status: 'ACTIVE' } });
  } catch (error) {
    console.error('Deploy schedule error:', error);
    res.status(500).json({ error: 'Failed to deploy schedule' });
  }
};

module.exports = { getSchedules, getScheduleById, createSchedule, updateSchedule, deleteSchedule, deploySchedule };
