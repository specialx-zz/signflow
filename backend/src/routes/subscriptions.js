const express = require('express');
const router = express.Router();
const {
  getPlans,
  getCurrentSubscription,
  upgradePlan,
  updateSubscription,
  getSubscriptionOverview,
} = require('../controllers/subscriptionController');
const { authenticate, authorize, superAdminOnly } = require('../middleware/auth');
const { tenantContext } = require('../middleware/tenant');

// 모든 라우트: 인증 필요
router.use(authenticate);

// 플랜 목록 (인증만 필요)
router.get('/plans', getPlans);

// 테넌트 컨텍스트 필요 라우트
router.use(tenantContext);

// 현재 테넌트 구독 정보
router.get('/current', getCurrentSubscription);

// 플랜 업그레이드 (TENANT_ADMIN+)
router.put('/upgrade', authorize('TENANT_ADMIN'), upgradePlan);

// ─── SUPER_ADMIN 전용 ─────────────────────────────
// 전체 구독 현황 대시보드
router.get('/overview', superAdminOnly, getSubscriptionOverview);

// 특정 테넌트 구독 수정
router.put('/:tenantId', superAdminOnly, updateSubscription);

module.exports = router;
