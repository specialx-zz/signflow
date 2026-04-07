/**
 * registrationTokenController.js
 * 디바이스 등록 토큰 (6자리 코드) 관리
 *
 * 관리자가 토큰을 생성 → 현장 설치자가 플레이어에 코드 입력 → 자동 등록 + 테넌트 할당
 */

const prisma = require('../utils/prisma');
const { v4: uuidv4 } = require('uuid');

/**
 * Generate a 6-character alphanumeric code
 */
function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // O,0,I,1 제외 (혼동 방지)
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * POST /api/devices/tokens
 * 등록 토큰 생성 (관리자)
 */
const createToken = async (req, res) => {
  try {
    const { name, storeId, expiresInHours = 48 } = req.body;
    const tenantId = req.tenantId || req.user.tenantId;

    // Generate unique code
    let code;
    let attempts = 0;
    do {
      code = generateCode();
      const existing = await prisma.deviceRegistrationToken.findUnique({ where: { code } });
      if (!existing) break;
      attempts++;
    } while (attempts < 10);

    if (attempts >= 10) {
      return res.status(500).json({ error: '코드 생성에 실패했습니다. 다시 시도해주세요.' });
    }

    const token = await prisma.deviceRegistrationToken.create({
      data: {
        id: uuidv4(),
        tenantId,
        storeId: storeId || null,
        code,
        name: name || null,
        expiresAt: new Date(Date.now() + expiresInHours * 60 * 60 * 1000),
        createdBy: req.user.id,
      },
    });

    res.status(201).json({
      code: token.code,
      expiresAt: token.expiresAt,
      name: token.name,
      message: `등록 코드가 생성되었습니다: ${token.code}`,
    });
  } catch (error) {
    console.error('createToken error:', error);
    res.status(500).json({ error: '토큰 생성에 실패했습니다.' });
  }
};

/**
 * GET /api/devices/tokens
 * 등록 토큰 목록 (관리자)
 */
const getTokens = async (req, res) => {
  try {
    const tenantId = req.tenantId || req.user.tenantId;
    const where = {};
    if (tenantId) where.tenantId = tenantId;

    const tokens = await prisma.deviceRegistrationToken.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    res.json(tokens);
  } catch (error) {
    console.error('getTokens error:', error);
    res.status(500).json({ error: '토큰 목록 조회에 실패했습니다.' });
  }
};

/**
 * POST /api/devices/register-with-token
 * 플레이어가 6자리 코드로 등록 (인증 불요)
 */
const registerWithToken = async (req, res) => {
  try {
    const { code, deviceId, deviceName, playerVersion } = req.body;

    if (!code || !deviceId) {
      return res.status(400).json({ error: 'code와 deviceId는 필수입니다.' });
    }

    // Find token
    const token = await prisma.deviceRegistrationToken.findUnique({ where: { code: code.toUpperCase() } });

    if (!token) {
      return res.status(404).json({ error: '유효하지 않은 등록 코드입니다.' });
    }

    if (token.isUsed) {
      return res.status(400).json({ error: '이미 사용된 등록 코드입니다.' });
    }

    if (new Date(token.expiresAt) < new Date()) {
      return res.status(400).json({ error: '만료된 등록 코드입니다.' });
    }

    // Create or update device with the token's tenant/store
    let device = await prisma.device.findUnique({ where: { deviceId } });

    if (!device) {
      device = await prisma.device.create({
        data: {
          id: uuidv4(),
          name: deviceName || token.name || `Device-${code}`,
          deviceId,
          tenantId: token.tenantId,
          storeId: token.storeId || null,
          status: 'ONLINE',
          ipAddress: req.ip || req.headers['x-forwarded-for'] || null,
          firmware: playerVersion || null,
          lastSeen: new Date(),
          isActive: true,
        },
      });
      console.log(`[Token] New device registered with code ${code}: ${device.name} → tenant=${token.tenantId}`);
    } else {
      // Update existing device's tenant assignment
      device = await prisma.device.update({
        where: { deviceId },
        data: {
          tenantId: token.tenantId,
          storeId: token.storeId || device.storeId,
          name: deviceName || token.name || device.name,
          status: 'ONLINE',
          lastSeen: new Date(),
          isActive: true,
          ...(playerVersion && { firmware: playerVersion }),
        },
      });
      console.log(`[Token] Device re-registered with code ${code}: ${device.name}`);
    }

    // Mark token as used
    await prisma.deviceRegistrationToken.update({
      where: { code: code.toUpperCase() },
      data: { isUsed: true, usedBy: device.id },
    });

    // Broadcast
    if (req.io) {
      req.io.emit('device:status', {
        deviceId: device.deviceId,
        status: 'ONLINE',
        info: { name: device.name, lastSeen: device.lastSeen },
      });
    }

    return res.status(200).json({
      deviceId: device.deviceId,
      deviceName: device.name,
      tenantId: device.tenantId,
      registeredAt: device.createdAt.toISOString(),
      message: '디바이스가 성공적으로 등록되었습니다.',
    });
  } catch (error) {
    console.error('[Token] registerWithToken error:', error);
    return res.status(500).json({ error: '디바이스 등록에 실패했습니다.' });
  }
};

/**
 * DELETE /api/devices/tokens/:code
 * 토큰 삭제 (관리자)
 */
const deleteToken = async (req, res) => {
  try {
    const { code } = req.params;
    await prisma.deviceRegistrationToken.delete({ where: { code } });
    res.json({ message: '토큰이 삭제되었습니다.' });
  } catch (error) {
    console.error('deleteToken error:', error);
    res.status(500).json({ error: '토큰 삭제에 실패했습니다.' });
  }
};

module.exports = { createToken, getTokens, registerWithToken, deleteToken };
