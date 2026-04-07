const prisma = require('../utils/prisma');
const { v4: uuidv4 } = require('uuid');

const getDevices = async (req, res) => {
  try {
    const { page = 1, limit = 50, status, groupId, search } = req.query;
    const storeId = req.query.storeId || req.storeId;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = { isActive: true };
    if (req.user?.role === 'SUPER_ADMIN') {
      // SUPER_ADMIN can view all tenants
    } else if (req.tenantId) {
      where.tenantId = req.tenantId;
    } else {
      return res.status(403).json({ error: '테넌트 컨텍스트가 필요합니다.' });
    }
    if (status) where.status = status;
    if (groupId) where.groupId = groupId;
    if (storeId) where.storeId = storeId;
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { deviceId: { contains: search } },
        { ipAddress: { contains: search } }
      ];
    }

    const [items, total] = await Promise.all([
      prisma.device.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy: { name: 'asc' },
        include: {
          group: { select: { id: true, name: true } },
          store: { select: { id: true, name: true } }
        }
      }),
      prisma.device.count({ where })
    ]);

    res.json({
      items,
      pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get devices' });
  }
};

const getDeviceById = async (req, res) => {
  try {
    const device = await prisma.device.findUnique({
      where: { id: req.params.id },
      include: {
        group: true,
        store: { select: { id: true, name: true } },
        schedules: {
          where: { schedule: { isActive: true } },
          include: { schedule: { include: { playlist: { select: { id: true, name: true } } } } },
          take: 5
        }
      }
    });

    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }

    if (req.tenantId && device.tenantId !== req.tenantId) {
      return res.status(403).json({ error: '접근 권한이 없습니다' });
    }

    res.json(device);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get device' });
  }
};

const createDevice = async (req, res) => {
  try {
    const { name, deviceId, groupId, storeId, ipAddress, macAddress, model, firmware, resolution, orientation, timezone, location } = req.body;

    if (!name || !deviceId) {
      return res.status(400).json({ error: 'name and deviceId are required' });
    }

    const existing = await prisma.device.findUnique({ where: { deviceId } });
    if (existing) {
      return res.status(400).json({ error: 'Device ID already exists' });
    }

    const device = await prisma.device.create({
      data: {
        id: uuidv4(),
        name,
        deviceId,
        groupId: groupId || null,
        storeId: storeId || null,
        ipAddress,
        macAddress,
        model,
        firmware,
        resolution: resolution || '1920x1080',
        orientation: orientation || 'LANDSCAPE',
        timezone: timezone || 'Asia/Seoul',
        location,
        tenantId: req.tenantId || req.user.tenantId
      },
      include: { group: true, store: { select: { id: true, name: true } } }
    });

    res.status(201).json(device);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create device' });
  }
};

const updateDevice = async (req, res) => {
  try {
    const { name, groupId, storeId, ipAddress, model, firmware, resolution, orientation, timezone, location, volume, brightness, settings } = req.body;

    const device = await prisma.device.findUnique({ where: { id: req.params.id } });
    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }
    if (req.tenantId && device.tenantId !== req.tenantId) {
      return res.status(403).json({ error: '접근 권한이 없습니다' });
    }

    const updated = await prisma.device.update({
      where: { id: req.params.id },
      data: {
        ...(name && { name }),
        ...(groupId !== undefined && { groupId }),
        ...(storeId !== undefined && { storeId: storeId || null }),
        ...(ipAddress && { ipAddress }),
        ...(model && { model }),
        ...(firmware && { firmware }),
        ...(resolution && { resolution }),
        ...(orientation && { orientation }),
        ...(timezone && { timezone }),
        ...(location !== undefined && { location }),
        ...(volume !== undefined && { volume }),
        ...(brightness !== undefined && { brightness }),
        ...(settings && { settings: JSON.stringify(settings) })
      },
      include: { group: true, store: { select: { id: true, name: true } } }
    });

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update device' });
  }
};

const deleteDevice = async (req, res) => {
  try {
    const device = await prisma.device.findUnique({ where: { id: req.params.id } });
    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }
    if (req.tenantId && device.tenantId !== req.tenantId) {
      return res.status(403).json({ error: '접근 권한이 없습니다' });
    }

    // Cleanup references before soft-deleting
    await prisma.scheduleDevice.deleteMany({ where: { deviceId: req.params.id } });
    await prisma.channelDevice.deleteMany({ where: { deviceId: req.params.id } });
    await prisma.screenWallDevice.deleteMany({ where: { deviceId: req.params.id } });
    await prisma.syncGroupDevice.deleteMany({ where: { deviceId: req.params.id } });

    await prisma.device.update({
      where: { id: req.params.id },
      data: { isActive: false }
    });

    res.json({ message: 'Device deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete device' });
  }
};

const getDeviceStatus = async (req, res) => {
  try {
    const device = await prisma.device.findUnique({
      where: { id: req.params.id },
      select: {
        id: true, name: true, status: true, lastSeen: true,
        ipAddress: true, volume: true, brightness: true, tenantId: true
      }
    });

    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }
    if (req.tenantId && device.tenantId !== req.tenantId) {
      return res.status(403).json({ error: '접근 권한이 없습니다' });
    }

    res.json(device);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get device status' });
  }
};

const controlDevice = async (req, res) => {
  try {
    const { command, params } = req.body;
    const device = await prisma.device.findUnique({ where: { id: req.params.id } });

    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }
    if (req.tenantId && device.tenantId !== req.tenantId) {
      return res.status(403).json({ error: '접근 권한이 없습니다' });
    }

    // Emit control command via socket
    if (req.io) {
      req.io.to(`device:${device.deviceId}`).emit('remote:command', {
        command,
        value: params?.value ?? params?.level ?? undefined,
        params,
      });
    }

    // Handle specific commands that update DB state
    const paramValue = params?.value ?? params?.level;
    if (command === 'VOLUME_SET' && paramValue !== undefined) {
      await prisma.device.update({
        where: { id: req.params.id },
        data: { volume: Math.max(0, Math.min(100, parseInt(paramValue))) }
      });
    } else if (command === 'BRIGHTNESS' && paramValue !== undefined) {
      await prisma.device.update({
        where: { id: req.params.id },
        data: { brightness: Math.max(0, Math.min(100, parseInt(paramValue))) }
      });
    }

    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        tenantId: device.tenantId,
        action: 'DEVICE_CONTROL',
        target: device.id,
        details: `Command: ${command}`
      }
    });

    res.json({ message: 'Command sent successfully', command, params });
  } catch (error) {
    res.status(500).json({ error: 'Failed to control device' });
  }
};

const getDeviceGroups = async (req, res) => {
  try {
    const groupWhere = {};
    if (req.tenantId) groupWhere.tenantId = req.tenantId;
    const groups = await prisma.deviceGroup.findMany({
      where: groupWhere,
      include: { _count: { select: { devices: true } } },
      orderBy: { name: 'asc' }
    });
    res.json(groups);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get device groups' });
  }
};

const createDeviceGroup = async (req, res) => {
  try {
    const { name, description } = req.body;
    const group = await prisma.deviceGroup.create({
      data: { id: uuidv4(), name, description, tenantId: req.tenantId || req.user.tenantId }
    });
    res.status(201).json(group);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create device group' });
  }
};

module.exports = {
  getDevices, getDeviceById, createDevice, updateDevice, deleteDevice,
  getDeviceStatus, controlDevice, getDeviceGroups, createDeviceGroup
};
