const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const { tenantContext } = require('../middleware/tenant');
const {
  getAllLayouts, getLayoutById, createLayout, updateLayout, deleteLayout, saveZones
} = require('../controllers/layoutController');

router.use(authenticate);
router.use(tenantContext);

router.get('/', getAllLayouts);
router.get('/:id', getLayoutById);
router.post('/', authorize('USER'), createLayout);
router.put('/:id', authorize('USER'), updateLayout);
router.delete('/:id', authorize('USER'), deleteLayout);
router.put('/:id/zones', authorize('USER'), saveZones);

module.exports = router;
