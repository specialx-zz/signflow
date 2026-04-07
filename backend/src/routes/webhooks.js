const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const { tenantContext } = require('../middleware/tenant');
const ctrl = require('../controllers/webhookController');

router.use(authenticate, tenantContext, authorize('TENANT_ADMIN'));

router.get('/', ctrl.getWebhooks);
router.post('/', ctrl.createWebhook);
router.put('/:id', ctrl.updateWebhook);
router.delete('/:id', ctrl.deleteWebhook);
router.get('/:id/logs', ctrl.getWebhookLogs);
router.post('/:id/test', ctrl.testWebhook);

module.exports = router;
