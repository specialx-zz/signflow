const express = require('express');
const router = express.Router();
const {
  getSchedules, getScheduleById, createSchedule, updateSchedule, deleteSchedule, deploySchedule
} = require('../controllers/scheduleController');
const { duplicateSchedule } = require('../controllers/scheduleController.duplicate');
const { authenticate, authorize } = require('../middleware/auth');
const { tenantContext } = require('../middleware/tenant');

router.use(authenticate);
router.use(tenantContext);

router.get('/', getSchedules);
router.post('/', authorize('STORE_MANAGER'), createSchedule);
router.get('/:id', getScheduleById);
router.put('/:id', authorize('STORE_MANAGER'), updateSchedule);
router.delete('/:id', authorize('STORE_MANAGER'), deleteSchedule);
router.post('/:id/deploy', authorize('STORE_MANAGER'), deploySchedule);
router.post('/:id/duplicate', authorize('STORE_MANAGER'), duplicateSchedule);

module.exports = router;
