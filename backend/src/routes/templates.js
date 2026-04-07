const express = require('express');
const router = express.Router();
const { authenticate, authorize, superAdminOnly } = require('../middleware/auth');
const { upload } = require('../middleware/upload');
const { tenantContext } = require('../middleware/tenant');
const ctrl = require('../controllers/templateController');
const { validateMimeType } = require('../middleware/validateMimeType');

// Public (authenticated)
router.get('/', authenticate, ctrl.getTemplates);
router.get('/categories', authenticate, ctrl.getCategories);
router.get('/:id', authenticate, ctrl.getTemplate);

// Use template (USER+)
router.post('/:id/use', authenticate, tenantContext, authorize('USER'), ctrl.useTemplate);

// Review (USER+)
router.post('/:id/review', authenticate, tenantContext, authorize('USER'), ctrl.reviewTemplate);

// Admin only
router.post('/', authenticate, superAdminOnly, upload.single('file'), validateMimeType, ctrl.createTemplate);
router.delete('/:id', authenticate, superAdminOnly, ctrl.deleteTemplate);

module.exports = router;
