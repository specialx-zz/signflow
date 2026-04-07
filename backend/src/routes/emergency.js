const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const { tenantContext } = require('../middleware/tenant');
const {
  createEmergency,
  getEmergencies,
  getEmergencyById,
  getActiveEmergencies,
  deactivateEmergency,
  deleteEmergency,
} = require('../controllers/emergencyController');

// 플레이어용: 인증 없이 활성 메시지 조회
router.get('/active', getActiveEmergencies);

// 관리자 이상: 긴급 메시지 관리
router.use(authenticate, tenantContext);
router.get('/', authorize('STORE_MANAGER'), getEmergencies);
router.get('/:id', authorize('STORE_MANAGER'), getEmergencyById);
router.post('/', authorize('STORE_MANAGER'), createEmergency);
router.put('/:id/deactivate', authorize('STORE_MANAGER'), deactivateEmergency);
router.delete('/:id', authorize('TENANT_ADMIN'), deleteEmergency);

module.exports = router;
