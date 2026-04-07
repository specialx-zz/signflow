const express = require('express');
const router = express.Router();
const {
  getTenants,
  getTenantById,
  createTenant,
  updateTenant,
  deleteTenant,
  getTenantStats,
} = require('../controllers/tenantController');
const { authenticate, superAdminOnly } = require('../middleware/auth');

// 모든 라우트: 인증 + SUPER_ADMIN 전용
router.use(authenticate);
router.use(superAdminOnly);

router.get('/', getTenants);
router.post('/', createTenant);
router.get('/:id', getTenantById);
router.put('/:id', updateTenant);
router.delete('/:id', deleteTenant);
router.get('/:id/stats', getTenantStats);

module.exports = router;
