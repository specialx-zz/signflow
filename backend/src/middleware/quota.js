/**
 * quota.js
 * 사용량 제한 미들웨어
 *
 * 테넌트의 구독 플랜에 따라 디바이스, 스토리지, 사용자, 매장 수를 제한합니다.
 * 80% 이상 사용 시 경고, 100% 초과 시 차단합니다.
 */

const prisma = require('../utils/prisma');

/**
 * 사용량 조회 헬퍼
 */
async function getUsage(tenantId) {
  const [deviceCount, userCount, storeCount, storageResult] = await Promise.all([
    prisma.device.count({ where: { tenantId, isActive: true } }),
    prisma.user.count({ where: { tenantId, isActive: true } }),
    prisma.store.count({ where: { tenantId, isActive: true } }),
    prisma.content.aggregate({
      where: { tenantId, isActive: true },
      _sum: { size: true },
    }),
  ]);

  const storageUsedBytes = storageResult._sum.size || 0;
  const storageUsedGB = storageUsedBytes / (1024 * 1024 * 1024);

  return {
    devices: deviceCount,
    users: userCount,
    stores: storeCount,
    storageGB: storageUsedGB,
    storageBytes: storageUsedBytes,
  };
}

/**
 * 구독 상태 확인
 */
async function getSubscriptionStatus(tenantId) {
  const subscription = await prisma.subscription.findUnique({
    where: { tenantId },
  });

  if (!subscription) {
    return { valid: false, reason: '구독 정보가 없습니다.', subscription: null };
  }

  const now = new Date();

  // Trial 만료 확인
  if (subscription.status === 'trial' && subscription.trialEndDate && new Date(subscription.trialEndDate) < now) {
    return { valid: false, reason: '무료 체험 기간이 만료되었습니다. 구독을 업그레이드하세요.', subscription };
  }

  // 구독 만료 확인
  if (subscription.status === 'cancelled' || subscription.status === 'suspended') {
    return { valid: false, reason: '구독이 비활성 상태입니다.', subscription };
  }

  // 만료일 확인 (grace period: 7일)
  if (subscription.endDate) {
    const gracePeriodEnd = new Date(subscription.endDate);
    gracePeriodEnd.setDate(gracePeriodEnd.getDate() + 7);

    if (now > gracePeriodEnd) {
      return { valid: false, reason: '구독이 만료되었습니다.', subscription };
    }

    if (now > new Date(subscription.endDate)) {
      return { valid: true, warning: '구독 만료 후 유예 기간입니다. 갱신이 필요합니다.', subscription };
    }
  }

  return { valid: true, subscription };
}

/**
 * 디바이스 등록 제한 미들웨어
 */
const checkDeviceQuota = async (req, res, next) => {
  try {
    const tenantId = req.tenantId || req.user?.tenantId;
    if (!tenantId) return next(); // SUPER_ADMIN without tenant context

    const sub = await prisma.subscription.findUnique({ where: { tenantId } });
    if (!sub) return next(); // No subscription = no limit

    const currentCount = await prisma.device.count({ where: { tenantId, isActive: true } });

    if (currentCount >= sub.maxDevices) {
      return res.status(403).json({
        error: '디바이스 등록 한도에 도달했습니다.',
        code: 'QUOTA_EXCEEDED_DEVICES',
        current: currentCount,
        max: sub.maxDevices,
        plan: sub.plan,
      });
    }

    // 80% 경고
    if (currentCount >= sub.maxDevices * 0.8) {
      res.set('X-Quota-Warning', `devices:${currentCount}/${sub.maxDevices}`);
    }

    next();
  } catch (error) {
    console.error('checkDeviceQuota error:', error);
    return res.status(503).json({ error: '디바이스 할당량을 확인할 수 없습니다. 잠시 후 다시 시도해주세요.' });
  }
};

/**
 * 사용자 생성 제한 미들웨어
 */
const checkUserQuota = async (req, res, next) => {
  try {
    const tenantId = req.tenantId || req.user?.tenantId;
    if (!tenantId) return next();

    const sub = await prisma.subscription.findUnique({ where: { tenantId } });
    if (!sub) return next();

    const currentCount = await prisma.user.count({ where: { tenantId, isActive: true } });

    if (currentCount >= sub.maxUsers) {
      return res.status(403).json({
        error: '사용자 등록 한도에 도달했습니다.',
        code: 'QUOTA_EXCEEDED_USERS',
        current: currentCount,
        max: sub.maxUsers,
        plan: sub.plan,
      });
    }

    next();
  } catch (error) {
    console.error('checkUserQuota error:', error);
    return res.status(503).json({ error: '사용자 할당량을 확인할 수 없습니다. 잠시 후 다시 시도해주세요.' });
  }
};

/**
 * 매장 생성 제한 미들웨어
 */
const checkStoreQuota = async (req, res, next) => {
  try {
    const tenantId = req.tenantId || req.user?.tenantId;
    if (!tenantId) return next();

    const sub = await prisma.subscription.findUnique({ where: { tenantId } });
    if (!sub) return next();

    const currentCount = await prisma.store.count({ where: { tenantId, isActive: true } });

    if (currentCount >= sub.maxStores) {
      return res.status(403).json({
        error: '매장 등록 한도에 도달했습니다.',
        code: 'QUOTA_EXCEEDED_STORES',
        current: currentCount,
        max: sub.maxStores,
        plan: sub.plan,
      });
    }

    next();
  } catch (error) {
    console.error('checkStoreQuota error:', error);
    return res.status(503).json({ error: '매장 할당량을 확인할 수 없습니다. 잠시 후 다시 시도해주세요.' });
  }
};

/**
 * 스토리지 제한 미들웨어 (콘텐츠 업로드 시)
 */
const checkStorageQuota = async (req, res, next) => {
  try {
    const tenantId = req.tenantId || req.user?.tenantId;
    if (!tenantId) return next();

    const sub = await prisma.subscription.findUnique({ where: { tenantId } });
    if (!sub) return next();

    const storageResult = await prisma.content.aggregate({
      where: { tenantId, isActive: true },
      _sum: { size: true },
    });

    const usedBytes = storageResult._sum.size || 0;
    const maxBytes = sub.maxStorageGB * 1024 * 1024 * 1024;
    const uploadSize = req.file?.size || 0;

    if (usedBytes + uploadSize > maxBytes) {
      return res.status(403).json({
        error: '스토리지 용량이 부족합니다.',
        code: 'QUOTA_EXCEEDED_STORAGE',
        currentGB: (usedBytes / (1024 * 1024 * 1024)).toFixed(2),
        maxGB: sub.maxStorageGB,
        plan: sub.plan,
      });
    }

    // 80% 경고
    if (usedBytes > maxBytes * 0.8) {
      res.set('X-Quota-Warning', `storage:${(usedBytes / (1024 * 1024 * 1024)).toFixed(2)}GB/${sub.maxStorageGB}GB`);
    }

    next();
  } catch (error) {
    console.error('checkStorageQuota error:', error);
    return res.status(503).json({ error: '스토리지 사용량을 확인할 수 없습니다. 잠시 후 다시 시도해주세요.' });
  }
};

/**
 * 구독 활성 상태 확인 미들웨어
 * 만료/정지된 구독은 읽기만 허용 (CUD 차단)
 */
const requireActiveSubscription = async (req, res, next) => {
  try {
    const tenantId = req.tenantId || req.user?.tenantId;
    if (!tenantId) return next(); // SUPER_ADMIN

    // SUPER_ADMIN bypass
    if (req.user?.role === 'SUPER_ADMIN') return next();

    const { valid, reason, warning, subscription } = await getSubscriptionStatus(tenantId);

    if (!valid) {
      return res.status(403).json({
        error: reason,
        code: 'SUBSCRIPTION_INACTIVE',
        status: subscription?.status,
        plan: subscription?.plan,
      });
    }

    // Attach warning header if in grace period
    if (warning) {
      res.set('X-Subscription-Warning', warning);
    }

    next();
  } catch (error) {
    console.error('requireActiveSubscription error:', error);
    return res.status(503).json({ error: '구독 상태를 확인할 수 없습니다. 잠시 후 다시 시도해주세요.' });
  }
};

module.exports = {
  getUsage,
  getSubscriptionStatus,
  checkDeviceQuota,
  checkUserQuota,
  checkStoreQuota,
  checkStorageQuota,
  requireActiveSubscription,
};
