/**
 * emergencyController.js — 긴급 메시지 관리
 *
 * 즉시 전 디바이스(또는 특정 매장/디바이스)에 긴급 메시지 표시
 * Socket.IO로 실시간 전송
 */

const prisma = require('../utils/prisma');
const { logger } = require('../utils/logger');

/**
 * POST /api/emergency
 * 긴급 메시지 생성 + 즉시 전송
 */
const createEmergency = async (req, res) => {
  try {
    const {
      title, message, type = 'INFO', bgColor, textColor, fontSize,
      displayMode = 'OVERLAY', priority = 100,
      targetType = 'ALL', targetIds, expiresAt,
    } = req.body;

    if (!title || !message) {
      return res.status(400).json({ error: '제목과 메시지를 입력해주세요.' });
    }

    const tenantId = req.tenantId || req.user.tenantId;

    const emergency = await prisma.emergencyMessage.create({
      data: {
        tenantId,
        title,
        message,
        type,
        bgColor: bgColor || '#EF4444',
        textColor: textColor || '#FFFFFF',
        fontSize: fontSize || 48,
        displayMode,
        priority,
        targetType,
        targetIds: targetIds ? JSON.stringify(targetIds) : null,
        isActive: true,
        startAt: new Date(),
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        createdBy: req.user.id,
      },
    });

    // Socket.IO로 즉시 전송
    const payload = {
      id: emergency.id,
      title: emergency.title,
      message: emergency.message,
      type: emergency.type,
      bgColor: emergency.bgColor,
      textColor: emergency.textColor,
      fontSize: emergency.fontSize,
      displayMode: emergency.displayMode,
      priority: emergency.priority,
      expiresAt: emergency.expiresAt,
    };

    if (targetType === 'ALL') {
      // 테넌트 전체 디바이스 — tenant room으로만 전송
      req.io.to(`tenant:${tenantId}`).emit('emergency:message', { tenantId, ...payload });
    } else if (targetType === 'STORE' && targetIds) {
      // 특정 매장의 디바이스들
      const storeIds = typeof targetIds === 'string' ? JSON.parse(targetIds) : targetIds;
      const devices = await prisma.device.findMany({
        where: { tenantId, storeId: { in: storeIds } },
        select: { deviceId: true },
      });
      devices.forEach(d => {
        req.io.to(`device:${d.deviceId}`).emit('emergency:message', payload);
      });
    } else if (targetType === 'DEVICE' && targetIds) {
      const deviceIds = typeof targetIds === 'string' ? JSON.parse(targetIds) : targetIds;
      deviceIds.forEach(id => {
        req.io.to(`device:${id}`).emit('emergency:message', payload);
      });
    }

    logger.info('Emergency message created', {
      id: emergency.id, tenantId, targetType, title,
    });

    res.status(201).json(emergency);
  } catch (error) {
    logger.error('Create emergency error', { error });
    res.status(500).json({ error: '긴급 메시지 생성에 실패했습니다.' });
  }
};

/**
 * GET /api/emergency
 * 테넌트의 긴급 메시지 목록
 */
const getEmergencies = async (req, res) => {
  try {
    const tenantId = req.tenantId || req.user.tenantId;
    const { active } = req.query;

    const where = { tenantId };
    if (active === 'true') {
      where.isActive = true;
      where.OR = [
        { expiresAt: null },
        { expiresAt: { gt: new Date() } },
      ];
    }

    const messages = await prisma.emergencyMessage.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    res.json(messages);
  } catch (error) {
    logger.error('Get emergencies error', { error });
    res.status(500).json({ error: '긴급 메시지 조회에 실패했습니다.' });
  }
};

/**
 * GET /api/emergency/active
 * 현재 활성 긴급 메시지 (플레이어용)
 */
const getActiveEmergencies = async (req, res) => {
  try {
    const { tenantId, deviceId, storeId } = req.query;
    const now = new Date();

    if (!tenantId) {
      return res.status(400).json({ error: 'tenantId is required' });
    }

    const messages = await prisma.emergencyMessage.findMany({
      where: {
        isActive: true,
        tenantId,
        startAt: { lte: now },
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: now } },
        ],
      },
      orderBy: { priority: 'desc' },
    });

    // 타겟 필터링
    const filtered = messages.filter(msg => {
      if (msg.targetType === 'ALL') return true;
      if (!msg.targetIds) return true;

      const ids = JSON.parse(msg.targetIds);
      if (msg.targetType === 'STORE' && storeId) return ids.includes(storeId);
      if (msg.targetType === 'DEVICE' && deviceId) return ids.includes(deviceId);
      return false;
    });

    res.json(filtered);
  } catch (error) {
    logger.error('Get active emergencies error', { error });
    res.status(500).json({ error: '긴급 메시지 조회에 실패했습니다.' });
  }
};

/**
 * PUT /api/emergency/:id/deactivate
 * 긴급 메시지 비활성화 (해제)
 */
const deactivateEmergency = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId || req.user.tenantId;

    const msg = await prisma.emergencyMessage.findUnique({ where: { id } });
    if (!msg) return res.status(404).json({ error: '긴급 메시지를 찾을 수 없습니다.' });
    if (msg.tenantId !== tenantId) return res.status(403).json({ error: '권한이 없습니다' });

    const emergency = await prisma.emergencyMessage.update({
      where: { id },
      data: { isActive: false },
    });

    // 해제 알림 전송 — 해당 테넌트 룸에만
    req.io.to(`tenant:${tenantId}`).emit('emergency:dismiss', { id, tenantId });

    logger.info('Emergency message deactivated', { id, tenantId });
    res.json(emergency);
  } catch (error) {
    logger.error('Deactivate emergency error', { error });
    res.status(500).json({ error: '긴급 메시지 해제에 실패했습니다.' });
  }
};

/**
 * DELETE /api/emergency/:id
 */
const deleteEmergency = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId || req.user.tenantId;

    const msg = await prisma.emergencyMessage.findUnique({ where: { id } });
    if (!msg) return res.status(404).json({ error: '긴급 메시지를 찾을 수 없습니다.' });
    if (msg.tenantId !== tenantId) return res.status(403).json({ error: '권한이 없습니다' });

    await prisma.emergencyMessage.delete({ where: { id } });
    res.json({ message: '삭제되었습니다.' });
  } catch (error) {
    logger.error('Delete emergency error', { error });
    res.status(500).json({ error: '긴급 메시지 삭제에 실패했습니다.' });
  }
};

/**
 * GET /api/emergency/:id
 * 긴급 메시지 단건 조회
 */
const getEmergencyById = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId || req.user.tenantId;
    const msg = await prisma.emergencyMessage.findUnique({ where: { id } });
    if (!msg) return res.status(404).json({ error: '긴급 메시지를 찾을 수 없습니다.' });
    if (msg.tenantId !== tenantId) return res.status(403).json({ error: '권한이 없습니다' });
    res.json(msg);
  } catch (error) {
    logger.error('Get emergency by id error', { error });
    res.status(500).json({ error: '긴급 메시지 조회에 실패했습니다.' });
  }
};

module.exports = {
  createEmergency,
  getEmergencies,
  getEmergencyById,
  getActiveEmergencies,
  deactivateEmergency,
  deleteEmergency,
};
