const express = require('express');
const router = express.Router();
const {
  getDeviceTags, setDeviceTags, updateDeviceTags, listTagKeys,
  addScheduleCondition, listScheduleConditions, deleteScheduleCondition, updateScheduleCondition,
  resolveTagPlayback, searchDevicesByTag
} = require('../controllers/tagPlaybackController');
const { authenticate, authorize } = require('../middleware/auth');
const { tenantContext } = require('../middleware/tenant');

router.use(authenticate);
router.use(tenantContext);

// 장치 태그 관리
router.get('/tags/keys', listTagKeys);
router.get('/tags/:deviceId', getDeviceTags);
router.put('/tags/:deviceId', authorize('STORE_MANAGER'), setDeviceTags);
router.patch('/tags/:deviceId', authorize('STORE_MANAGER'), updateDeviceTags);

// 스케줄 조건 관리
router.get('/conditions/:scheduleId', listScheduleConditions);
router.post('/conditions/:scheduleId', authorize('USER'), addScheduleCondition);
router.put('/conditions/:scheduleId/:conditionId', authorize('USER'), updateScheduleCondition);
router.delete('/conditions/:scheduleId/:conditionId', authorize('USER'), deleteScheduleCondition);

// 태그 매칭 해석 & 장치 검색
router.post('/resolve/:scheduleId', authorize('USER'), resolveTagPlayback);
router.get('/devices', searchDevicesByTag);

module.exports = router;
