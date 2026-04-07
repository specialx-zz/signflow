const prisma = require('../utils/prisma');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

/**
 * 업체 목록 조회 (SUPER_ADMIN 전용)
 */
const getTenants = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [items, total] = await Promise.all([
      prisma.tenant.findMany({
        skip,
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
        include: {
          subscription: true,
          _count: {
            select: {
              users: true,
              devices: true,
              content: true,
            },
          },
        },
      }),
      prisma.tenant.count(),
    ]);

    res.json({
      items,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error('getTenants error:', error);
    res.status(500).json({ error: '업체 목록 조회에 실패했습니다.' });
  }
};

/**
 * 업체 단건 조회
 */
const getTenantById = async (req, res) => {
  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id: req.params.id },
      include: {
        subscription: true,
        stores: true,
        _count: {
          select: {
            users: true,
            devices: true,
            content: true,
            stores: true,
          },
        },
      },
    });

    if (!tenant) {
      return res.status(404).json({ error: '업체를 찾을 수 없습니다.' });
    }

    res.json(tenant);
  } catch (error) {
    console.error('getTenantById error:', error);
    res.status(500).json({ error: '업체 조회에 실패했습니다.' });
  }
};

/**
 * 업체 생성
 * - Subscription(starter) 자동 생성
 * - TENANT_ADMIN 사용자 자동 생성
 */
const createTenant = async (req, res) => {
  try {
    const { name, slug, contactName, contactEmail, contactPhone, address } = req.body;

    if (!name || !slug || !contactEmail) {
      return res.status(400).json({ error: 'name, slug, contactEmail은 필수입니다.' });
    }

    // slug 중복 검사
    const existing = await prisma.tenant.findUnique({ where: { slug } });
    if (existing) {
      return res.status(400).json({ error: '이미 사용 중인 slug입니다.' });
    }

    // 이메일 중복 검사
    const existingUser = await prisma.user.findUnique({ where: { email: contactEmail } });
    if (existingUser) {
      return res.status(400).json({ error: '이미 등록된 이메일입니다.' });
    }

    const tenantId = uuidv4();
    const tempPassword = 'changeme123!';
    const hashedPassword = await bcrypt.hash(tempPassword, 10);

    const tenant = await prisma.$transaction(async (tx) => {
      // 1. 업체 생성
      const newTenant = await tx.tenant.create({
        data: {
          id: tenantId,
          name,
          slug,
          contactName,
          contactEmail,
          contactPhone,
          address,
        },
      });

      // 2. 스타터 구독 생성
      await tx.subscription.create({
        data: {
          id: uuidv4(),
          tenantId,
          plan: 'starter',
          billingCycle: 'monthly',
          status: 'trial',
          maxDevices: 5,
          maxStorageGB: 5,
          maxUsers: 3,
          maxStores: 2,
          startDate: new Date(),
          trialEndDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14일 트라이얼
        },
      });

      // 3. TENANT_ADMIN 사용자 생성
      const username = slug + '-admin';
      await tx.user.create({
        data: {
          id: uuidv4(),
          tenantId,
          username,
          email: contactEmail,
          password: hashedPassword,
          role: 'TENANT_ADMIN',
        },
      });

      return newTenant;
    });

    const result = await prisma.tenant.findUnique({
      where: { id: tenant.id },
      include: {
        subscription: true,
        _count: { select: { users: true } },
      },
    });

    res.status(201).json({
      ...result,
      _tempPassword: tempPassword,
      _message: '업체와 관리자 계정이 생성되었습니다. 임시 비밀번호를 변경해주세요.',
    });
  } catch (error) {
    console.error('createTenant error:', error);
    res.status(500).json({ error: '업체 생성에 실패했습니다.' });
  }
};

/**
 * 업체 수정
 */
const updateTenant = async (req, res) => {
  try {
    const { name, slug, contactName, contactEmail, contactPhone, address, logo, brandColor, timezone, settings } = req.body;

    const tenant = await prisma.tenant.findUnique({ where: { id: req.params.id } });
    if (!tenant) {
      return res.status(404).json({ error: '업체를 찾을 수 없습니다.' });
    }

    // slug 변경 시 중복 검사
    if (slug && slug !== tenant.slug) {
      const existing = await prisma.tenant.findUnique({ where: { slug } });
      if (existing) {
        return res.status(400).json({ error: '이미 사용 중인 slug입니다.' });
      }
    }

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (slug !== undefined) updateData.slug = slug;
    if (contactName !== undefined) updateData.contactName = contactName;
    if (contactEmail !== undefined) updateData.contactEmail = contactEmail;
    if (contactPhone !== undefined) updateData.contactPhone = contactPhone;
    if (address !== undefined) updateData.address = address;
    if (logo !== undefined) updateData.logo = logo;
    if (brandColor !== undefined) updateData.brandColor = brandColor;
    if (timezone !== undefined) updateData.timezone = timezone;
    if (settings !== undefined) updateData.settings = typeof settings === 'string' ? settings : JSON.stringify(settings);

    const updated = await prisma.tenant.update({
      where: { id: req.params.id },
      data: updateData,
      include: { subscription: true },
    });

    res.json(updated);
  } catch (error) {
    console.error('updateTenant error:', error);
    res.status(500).json({ error: '업체 수정에 실패했습니다.' });
  }
};

/**
 * 업체 삭제 (소프트 삭제)
 */
const deleteTenant = async (req, res) => {
  try {
    const tenant = await prisma.tenant.findUnique({ where: { id: req.params.id } });
    if (!tenant) {
      return res.status(404).json({ error: '업체를 찾을 수 없습니다.' });
    }

    await prisma.tenant.update({
      where: { id: req.params.id },
      data: { isActive: false },
    });

    res.json({ message: '업체가 비활성화되었습니다.' });
  } catch (error) {
    console.error('deleteTenant error:', error);
    res.status(500).json({ error: '업체 삭제에 실패했습니다.' });
  }
};

/**
 * 업체 사용량 통계
 */
const getTenantStats = async (req, res) => {
  try {
    const tenantId = req.params.id;

    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) {
      return res.status(404).json({ error: '업체를 찾을 수 없습니다.' });
    }

    const [deviceCount, userCount, contentCount, storageResult, storeCount] = await Promise.all([
      prisma.device.count({ where: { tenantId } }),
      prisma.user.count({ where: { tenantId } }),
      prisma.content.count({ where: { tenantId } }),
      prisma.content.aggregate({
        where: { tenantId },
        _sum: { size: true },
      }),
      prisma.store.count({ where: { tenantId } }),
    ]);

    res.json({
      tenantId,
      tenantName: tenant.name,
      deviceCount,
      userCount,
      contentCount,
      storageUsed: storageResult._sum.size || 0,
      storeCount,
    });
  } catch (error) {
    console.error('getTenantStats error:', error);
    res.status(500).json({ error: '업체 통계 조회에 실패했습니다.' });
  }
};

module.exports = {
  getTenants,
  getTenantById,
  createTenant,
  updateTenant,
  deleteTenant,
  getTenantStats,
};
