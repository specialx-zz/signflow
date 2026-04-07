/**
 * subscriptionController.js
 * 구독/과금 관련 API
 */

const prisma = require('../utils/prisma');
const { v4: uuidv4 } = require('uuid');
const { getPlan, getAllPlans, calculatePrice } = require('../utils/plans');
const { getUsage, getSubscriptionStatus } = require('../middleware/quota');

/**
 * GET /api/subscriptions/plans
 * 이용 가능한 플랜 목록
 */
const getPlans = async (req, res) => {
  try {
    const plans = getAllPlans().map(plan => ({
      ...plan,
      price: calculatePrice(plan.id, 'monthly'),
      yearlyPrice: calculatePrice(plan.id, 'yearly'),
    }));
    res.json(plans);
  } catch (error) {
    console.error('getPlans error:', error);
    res.status(500).json({ error: '플랜 목록 조회에 실패했습니다.' });
  }
};

/**
 * GET /api/subscriptions/current
 * 현재 테넌트의 구독 정보 + 사용량
 */
const getCurrentSubscription = async (req, res) => {
  try {
    const tenantId = req.tenantId || req.user.tenantId;
    if (!tenantId) {
      return res.status(400).json({ error: '업체 컨텍스트가 필요합니다.' });
    }

    const subscription = await prisma.subscription.findUnique({
      where: { tenantId },
    });

    if (!subscription) {
      return res.status(404).json({ error: '구독 정보가 없습니다.' });
    }

    const usage = await getUsage(tenantId);
    const plan = getPlan(subscription.plan);
    const { valid, reason, warning } = await getSubscriptionStatus(tenantId);

    res.json({
      subscription,
      plan,
      usage: {
        devices: { current: usage.devices, max: subscription.maxDevices, percent: Math.round((usage.devices / subscription.maxDevices) * 100) },
        users: { current: usage.users, max: subscription.maxUsers, percent: Math.round((usage.users / subscription.maxUsers) * 100) },
        stores: { current: usage.stores, max: subscription.maxStores, percent: Math.round((usage.stores / subscription.maxStores) * 100) },
        storage: {
          currentGB: parseFloat(usage.storageGB.toFixed(2)),
          currentBytes: usage.storageBytes,
          maxGB: subscription.maxStorageGB,
          percent: Math.round((usage.storageGB / subscription.maxStorageGB) * 100),
        },
      },
      status: {
        isValid: valid,
        reason: reason || null,
        warning: warning || null,
      },
    });
  } catch (error) {
    console.error('getCurrentSubscription error:', error);
    res.status(500).json({ error: '구독 정보 조회에 실패했습니다.' });
  }
};

/**
 * PUT /api/subscriptions/upgrade
 * 플랜 업그레이드 (TENANT_ADMIN 또는 SUPER_ADMIN)
 */
const upgradePlan = async (req, res) => {
  try {
    const tenantId = req.tenantId || req.user.tenantId;
    const { plan: newPlanId, billingCycle = 'monthly' } = req.body;

    if (!newPlanId) {
      return res.status(400).json({ error: '변경할 플랜을 지정하세요.' });
    }

    const newPlan = getPlan(newPlanId);
    if (!newPlan || newPlanId === 'custom') {
      return res.status(400).json({ error: '유효하지 않은 플랜입니다.' });
    }

    const subscription = await prisma.subscription.findUnique({ where: { tenantId } });
    if (!subscription) {
      return res.status(404).json({ error: '구독 정보가 없습니다.' });
    }

    // Check current usage vs new plan limits
    const usage = await getUsage(tenantId);
    const issues = [];
    if (usage.devices > newPlan.maxDevices) issues.push(`디바이스: ${usage.devices}대 > ${newPlan.maxDevices}대`);
    if (usage.users > newPlan.maxUsers) issues.push(`사용자: ${usage.users}명 > ${newPlan.maxUsers}명`);
    if (usage.stores > newPlan.maxStores) issues.push(`매장: ${usage.stores}개 > ${newPlan.maxStores}개`);
    if (usage.storageGB > newPlan.maxStorageGB) issues.push(`스토리지: ${usage.storageGB.toFixed(1)}GB > ${newPlan.maxStorageGB}GB`);

    if (issues.length > 0) {
      return res.status(400).json({
        error: '현재 사용량이 변경하려는 플랜의 한도를 초과합니다.',
        issues,
      });
    }

    const now = new Date();
    const endDate = billingCycle === 'yearly'
      ? new Date(now.getFullYear() + 1, now.getMonth(), now.getDate())
      : new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());

    const updated = await prisma.subscription.update({
      where: { tenantId },
      data: {
        plan: newPlanId,
        billingCycle,
        status: 'active',
        maxDevices: newPlan.maxDevices,
        maxStorageGB: newPlan.maxStorageGB,
        maxUsers: newPlan.maxUsers,
        maxStores: newPlan.maxStores,
        startDate: now,
        endDate,
        trialEndDate: null, // Trial ends on upgrade
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        tenantId,
        action: 'UPGRADE_PLAN',
        target: tenantId,
        details: `Plan upgraded to ${newPlanId} (${billingCycle})`,
      },
    });

    const price = calculatePrice(newPlanId, billingCycle);

    res.json({
      subscription: updated,
      plan: newPlan,
      price,
      message: `${newPlan.nameKo} 플랜으로 변경되었습니다.`,
    });
  } catch (error) {
    console.error('upgradePlan error:', error);
    res.status(500).json({ error: '플랜 변경에 실패했습니다.' });
  }
};

/**
 * PUT /api/subscriptions/:tenantId
 * SUPER_ADMIN이 특정 테넌트의 구독을 직접 수정
 */
const updateSubscription = async (req, res) => {
  try {
    const { tenantId } = req.params;
    const { plan, billingCycle, status, maxDevices, maxStorageGB, maxUsers, maxStores, endDate, trialEndDate } = req.body;

    const subscription = await prisma.subscription.findUnique({ where: { tenantId } });
    if (!subscription) {
      return res.status(404).json({ error: '구독 정보가 없습니다.' });
    }

    const updateData = {};
    if (plan !== undefined) {
      updateData.plan = plan;
      // Auto-fill limits from plan definition
      const planDef = getPlan(plan);
      if (!maxDevices) updateData.maxDevices = planDef.maxDevices;
      if (!maxStorageGB) updateData.maxStorageGB = planDef.maxStorageGB;
      if (!maxUsers) updateData.maxUsers = planDef.maxUsers;
      if (!maxStores) updateData.maxStores = planDef.maxStores;
    }
    if (billingCycle !== undefined) updateData.billingCycle = billingCycle;
    if (status !== undefined) updateData.status = status;
    if (maxDevices !== undefined) updateData.maxDevices = maxDevices;
    if (maxStorageGB !== undefined) updateData.maxStorageGB = maxStorageGB;
    if (maxUsers !== undefined) updateData.maxUsers = maxUsers;
    if (maxStores !== undefined) updateData.maxStores = maxStores;
    if (endDate !== undefined) updateData.endDate = endDate ? new Date(endDate) : null;
    if (trialEndDate !== undefined) updateData.trialEndDate = trialEndDate ? new Date(trialEndDate) : null;

    const updated = await prisma.subscription.update({
      where: { tenantId },
      data: updateData,
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        tenantId,
        action: 'UPDATE_SUBSCRIPTION',
        target: tenantId,
        details: JSON.stringify(updateData),
      },
    });

    res.json(updated);
  } catch (error) {
    console.error('updateSubscription error:', error);
    res.status(500).json({ error: '구독 수정에 실패했습니다.' });
  }
};

/**
 * GET /api/subscriptions/overview
 * SUPER_ADMIN: 전체 구독 현황 대시보드
 */
const getSubscriptionOverview = async (req, res) => {
  try {
    const subscriptions = await prisma.subscription.findMany({
      include: {
        tenant: {
          select: {
            id: true, name: true, slug: true, isActive: true,
            _count: { select: { devices: true, users: true, content: true, stores: true } },
          },
        },
      },
    });

    // Summary stats
    const summary = {
      totalTenants: subscriptions.length,
      byPlan: {},
      byStatus: {},
      totalDevices: 0,
      totalUsers: 0,
      totalStores: 0,
      estimatedMRR: 0, // Monthly Recurring Revenue
    };

    for (const sub of subscriptions) {
      // By plan
      summary.byPlan[sub.plan] = (summary.byPlan[sub.plan] || 0) + 1;
      // By status
      summary.byStatus[sub.status] = (summary.byStatus[sub.status] || 0) + 1;
      // Totals
      summary.totalDevices += sub.tenant._count.devices;
      summary.totalUsers += sub.tenant._count.users;
      summary.totalStores += sub.tenant._count.stores;
      // MRR
      if (sub.status === 'active' || sub.status === 'trial') {
        const price = calculatePrice(sub.plan, sub.billingCycle);
        summary.estimatedMRR += price.monthly;
      }
    }

    const items = subscriptions.map(sub => ({
      tenantId: sub.tenantId,
      tenantName: sub.tenant.name,
      tenantSlug: sub.tenant.slug,
      isActive: sub.tenant.isActive,
      plan: sub.plan,
      status: sub.status,
      billingCycle: sub.billingCycle,
      usage: {
        devices: sub.tenant._count.devices,
        users: sub.tenant._count.users,
        stores: sub.tenant._count.stores,
      },
      limits: {
        maxDevices: sub.maxDevices,
        maxUsers: sub.maxUsers,
        maxStores: sub.maxStores,
        maxStorageGB: sub.maxStorageGB,
      },
      startDate: sub.startDate,
      endDate: sub.endDate,
      trialEndDate: sub.trialEndDate,
    }));

    res.json({ summary, items });
  } catch (error) {
    console.error('getSubscriptionOverview error:', error);
    res.status(500).json({ error: '구독 현황 조회에 실패했습니다.' });
  }
};

module.exports = {
  getPlans,
  getCurrentSubscription,
  upgradePlan,
  updateSubscription,
  getSubscriptionOverview,
};
