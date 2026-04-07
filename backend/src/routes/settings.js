const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const { tenantContext } = require('../middleware/tenant');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

router.use(authenticate);
router.use(tenantContext);

router.get('/', async (req, res) => {
  try {
    // 테넌트별 설정 로드
    let tenantSettings = {};
    if (req.tenantId) {
      const tenant = await prisma.tenant.findUnique({
        where: { id: req.tenantId },
        select: { settings: true }
      });
      if (tenant?.settings) {
        try { tenantSettings = JSON.parse(tenant.settings); } catch {}
      }
    }

    res.json({
      server: {
        version: '1.0.0',
        name: tenantSettings.serverName || 'SignFlow Clone',
        timezone: tenantSettings.timezone || 'Asia/Seoul',
        language: tenantSettings.language || 'ko'
      },
      storage: {
        maxFileSize: parseInt(process.env.MAX_FILE_SIZE) || 104857600,
        allowedTypes: ['IMAGE', 'VIDEO', 'AUDIO', 'HTML', 'DOCUMENT']
      },
      security: {
        sessionTimeout: tenantSettings.sessionTimeout || 480,
        maxLoginAttempts: tenantSettings.maxLoginAttempts || 5
      },
      ...tenantSettings
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/', authorize('TENANT_ADMIN'), async (req, res) => {
  try {
    if (!req.tenantId) {
      return res.status(400).json({ error: '테넌트 정보가 필요합니다' });
    }

    // 기존 설정 로드 후 병합
    const tenant = await prisma.tenant.findUnique({
      where: { id: req.tenantId },
      select: { settings: true }
    });

    let existingSettings = {};
    if (tenant?.settings) {
      try { existingSettings = JSON.parse(tenant.settings); } catch {}
    }

    const updatedSettings = { ...existingSettings, ...req.body };

    await prisma.tenant.update({
      where: { id: req.tenantId },
      data: { settings: JSON.stringify(updatedSettings) }
    });

    res.json({ message: '설정이 저장되었습니다', settings: updatedSettings });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
