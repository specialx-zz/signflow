/**
 * plans.js
 * 구독 플랜 정의 및 유틸리티
 */

const PLANS = {
  starter: {
    id: 'starter',
    name: 'Starter',
    nameKo: '스타터',
    maxDevices: 5,
    maxStorageGB: 5,
    maxUsers: 3,
    maxStores: 2,
    features: ['basic_layout', 'email_support'],
    monthlyPrice: 30000,   // 3만원/월 (디바이스당)
    yearlyPrice: 288000,   // 연간 20% 할인
    auditLogDays: 30,
  },
  business: {
    id: 'business',
    name: 'Business',
    nameKo: '비즈니스',
    maxDevices: 30,
    maxStorageGB: 50,
    maxUsers: 15,
    maxStores: 10,
    features: ['basic_layout', 'advanced_layout', 'approval_workflow', 'api_access', 'chat_support'],
    monthlyPrice: 150000,  // 15만원/월
    yearlyPrice: 1440000,  // 연간 20% 할인
    auditLogDays: 90,
  },
  enterprise: {
    id: 'enterprise',
    name: 'Enterprise',
    nameKo: '엔터프라이즈',
    maxDevices: 200,
    maxStorageGB: 500,
    maxUsers: 999,
    maxStores: 999,
    features: ['basic_layout', 'advanced_layout', 'approval_workflow', 'api_access', 'dedicated_support', 'custom_branding', 'audit_1year'],
    monthlyPrice: 500000,  // 50만원/월
    yearlyPrice: 4800000,  // 연간 20% 할인
    auditLogDays: 365,
  },
  custom: {
    id: 'custom',
    name: 'Custom',
    nameKo: '커스텀',
    maxDevices: 9999,
    maxStorageGB: 9999,
    maxUsers: 9999,
    maxStores: 9999,
    features: ['all'],
    monthlyPrice: 0,  // 협의
    yearlyPrice: 0,
    auditLogDays: 365,
  },
};

/**
 * Get plan definition by ID
 */
function getPlan(planId) {
  return PLANS[planId] || PLANS.starter;
}

/**
 * Get all plans
 */
function getAllPlans() {
  return Object.values(PLANS);
}

/**
 * Check if a specific feature is available in a plan
 */
function hasFeature(planId, feature) {
  const plan = getPlan(planId);
  return plan.features.includes('all') || plan.features.includes(feature);
}

/**
 * Calculate subscription price
 */
function calculatePrice(planId, billingCycle = 'monthly') {
  const plan = getPlan(planId);
  if (billingCycle === 'yearly') {
    return { total: plan.yearlyPrice, monthly: Math.round(plan.yearlyPrice / 12) };
  }
  return { total: plan.monthlyPrice, monthly: plan.monthlyPrice };
}

module.exports = { PLANS, getPlan, getAllPlans, hasFeature, calculatePrice };
