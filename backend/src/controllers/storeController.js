const prisma = require('../utils/prisma');
const { verifyTenantOwnership } = require('../middleware/tenant');
const { v4: uuidv4 } = require('uuid');

/**
 * 매장 목록 조회 (테넌트 범위)
 */
const getStores = async (req, res) => {
  try {
    const where = req.tenantWhere({ isActive: true });

    const stores = await prisma.store.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { devices: true },
        },
      },
    });

    res.json({ items: stores });
  } catch (error) {
    console.error('getStores error:', error);
    res.status(500).json({ error: '매장 목록 조회에 실패했습니다.' });
  }
};

/**
 * 매장 단건 조회
 */
const getStoreById = async (req, res) => {
  try {
    const store = await prisma.store.findUnique({
      where: { id: req.params.id },
      include: {
        devices: true,
      },
    });

    if (!store) {
      return res.status(404).json({ error: '매장을 찾을 수 없습니다.' });
    }

    // 테넌트 소유권 확인
    if (!verifyTenantOwnership(store, req)) {
      return res.status(403).json({ error: '접근 권한이 없습니다.' });
    }

    res.json(store);
  } catch (error) {
    console.error('getStoreById error:', error);
    res.status(500).json({ error: '매장 조회에 실패했습니다.' });
  }
};

/**
 * 매장 생성
 */
const createStore = async (req, res) => {
  try {
    const { name, address, phone } = req.body;

    if (!name) {
      return res.status(400).json({ error: '매장 이름은 필수입니다.' });
    }

    const tenantId = req.tenantId || req.user.tenantId;
    if (!tenantId) {
      return res.status(400).json({ error: '업체 컨텍스트가 필요합니다.' });
    }

    const store = await prisma.store.create({
      data: {
        id: uuidv4(),
        tenantId,
        name,
        address,
        phone,
      },
      include: {
        _count: {
          select: { devices: true },
        },
      },
    });

    res.status(201).json(store);
  } catch (error) {
    console.error('createStore error:', error);
    res.status(500).json({ error: '매장 생성에 실패했습니다.' });
  }
};

/**
 * 매장 수정
 */
const updateStore = async (req, res) => {
  try {
    const { name, address, phone, managerId, settings } = req.body;

    const store = await prisma.store.findUnique({ where: { id: req.params.id } });
    if (!store) {
      return res.status(404).json({ error: '매장을 찾을 수 없습니다.' });
    }

    // 테넌트 소유권 확인
    if (!verifyTenantOwnership(store, req)) {
      return res.status(403).json({ error: '접근 권한이 없습니다.' });
    }

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (address !== undefined) updateData.address = address;
    if (phone !== undefined) updateData.phone = phone;
    if (managerId !== undefined) updateData.managerId = managerId;
    if (settings !== undefined) updateData.settings = typeof settings === 'string' ? settings : JSON.stringify(settings);

    const updated = await prisma.store.update({
      where: { id: req.params.id },
      data: updateData,
      include: {
        _count: {
          select: { devices: true },
        },
      },
    });

    res.json(updated);
  } catch (error) {
    console.error('updateStore error:', error);
    res.status(500).json({ error: '매장 수정에 실패했습니다.' });
  }
};

/**
 * 매장 삭제 (소프트 삭제)
 */
const deleteStore = async (req, res) => {
  try {
    const store = await prisma.store.findUnique({ where: { id: req.params.id } });
    if (!store) {
      return res.status(404).json({ error: '매장을 찾을 수 없습니다.' });
    }

    // 테넌트 소유권 확인
    if (!verifyTenantOwnership(store, req)) {
      return res.status(403).json({ error: '접근 권한이 없습니다.' });
    }

    await prisma.store.update({
      where: { id: req.params.id },
      data: { isActive: false },
    });

    res.json({ message: '매장이 비활성화되었습니다.' });
  } catch (error) {
    console.error('deleteStore error:', error);
    res.status(500).json({ error: '매장 삭제에 실패했습니다.' });
  }
};

/**
 * 매장 소속 디바이스 목록 조회
 */
const getStoreDevices = async (req, res) => {
  try {
    const store = await prisma.store.findUnique({ where: { id: req.params.id } });
    if (!store) {
      return res.status(404).json({ error: '매장을 찾을 수 없습니다.' });
    }
    if (!verifyTenantOwnership(store, req)) {
      return res.status(403).json({ error: '접근 권한이 없습니다.' });
    }

    const devices = await prisma.device.findMany({
      where: { storeId: req.params.id, isActive: true },
      orderBy: { name: 'asc' },
      include: {
        group: { select: { id: true, name: true } },
      },
    });

    res.json({ items: devices });
  } catch (error) {
    console.error('getStoreDevices error:', error);
    res.status(500).json({ error: '매장 디바이스 조회에 실패했습니다.' });
  }
};

/**
 * 매장에 디바이스 배정
 */
const assignDeviceToStore = async (req, res) => {
  try {
    const { deviceId } = req.body;
    if (!deviceId) {
      return res.status(400).json({ error: 'deviceId는 필수입니다.' });
    }

    const store = await prisma.store.findUnique({ where: { id: req.params.id } });
    if (!store) {
      return res.status(404).json({ error: '매장을 찾을 수 없습니다.' });
    }
    if (!verifyTenantOwnership(store, req)) {
      return res.status(403).json({ error: '접근 권한이 없습니다.' });
    }

    const device = await prisma.device.findUnique({ where: { id: deviceId } });
    if (!device) {
      return res.status(404).json({ error: '디바이스를 찾을 수 없습니다.' });
    }

    const updated = await prisma.device.update({
      where: { id: deviceId },
      data: { storeId: req.params.id },
      include: {
        group: { select: { id: true, name: true } },
        store: { select: { id: true, name: true } },
      },
    });

    res.json(updated);
  } catch (error) {
    console.error('assignDeviceToStore error:', error);
    res.status(500).json({ error: '디바이스 배정에 실패했습니다.' });
  }
};

/**
 * 매장에서 디바이스 해제
 */
const removeDeviceFromStore = async (req, res) => {
  try {
    const store = await prisma.store.findUnique({ where: { id: req.params.id } });
    if (!store) {
      return res.status(404).json({ error: '매장을 찾을 수 없습니다.' });
    }
    if (!verifyTenantOwnership(store, req)) {
      return res.status(403).json({ error: '접근 권한이 없습니다.' });
    }

    const device = await prisma.device.findUnique({ where: { id: req.params.deviceId } });
    if (!device || device.storeId !== req.params.id) {
      return res.status(404).json({ error: '해당 매장에 배정된 디바이스가 아닙니다.' });
    }

    const updated = await prisma.device.update({
      where: { id: req.params.deviceId },
      data: { storeId: null },
      include: {
        group: { select: { id: true, name: true } },
        store: { select: { id: true, name: true } },
      },
    });

    res.json(updated);
  } catch (error) {
    console.error('removeDeviceFromStore error:', error);
    res.status(500).json({ error: '디바이스 해제에 실패했습니다.' });
  }
};

module.exports = {
  getStores,
  getStoreById,
  createStore,
  updateStore,
  deleteStore,
  getStoreDevices,
  assignDeviceToStore,
  removeDeviceFromStore,
};
