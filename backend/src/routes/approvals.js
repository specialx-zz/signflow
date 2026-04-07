const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const { tenantContext } = require('../middleware/tenant');
const {
  requestApproval,
  getApprovals,
  approveContent,
  rejectContent,
} = require('../controllers/approvalController');

router.use(authenticate, tenantContext);

// 승인 요청 생성 (USER 이상)
router.post('/', authorize('USER'), requestApproval);

// 승인 목록 조회 (STORE_MANAGER 이상)
router.get('/', authorize('STORE_MANAGER'), getApprovals);

// 승인/거부 처리 (TENANT_ADMIN 이상)
router.put('/:id/approve', authorize('TENANT_ADMIN'), approveContent);
router.put('/:id/reject', authorize('TENANT_ADMIN'), rejectContent);

module.exports = router;
