const express = require('express');
const router = express.Router();
const {
  listScreenWalls, getScreenWall, createScreenWall, updateScreenWall, deleteScreenWall,
  assignDevice, removeDevice, setLayout, getDeviceWallInfo,
  listSyncGroups, createSyncGroup, updateSyncGroup, deleteSyncGroup, setSyncGroupDevices
} = require('../controllers/screenWallController');
const { authenticate, authorize } = require('../middleware/auth');
const { tenantContext } = require('../middleware/tenant');

router.use(authenticate);
router.use(tenantContext);

// 스크린 월 CRUD
router.get('/walls', listScreenWalls);
router.get('/walls/:id', getScreenWall);
router.post('/walls', authorize('STORE_MANAGER'), createScreenWall);
router.put('/walls/:id', authorize('STORE_MANAGER'), updateScreenWall);
router.delete('/walls/:id', authorize('STORE_MANAGER'), deleteScreenWall);

// 스크린 월 장치 배치
router.post('/walls/:id/devices', authorize('STORE_MANAGER'), assignDevice);
router.delete('/walls/:id/devices/:deviceId', authorize('STORE_MANAGER'), removeDevice);
router.put('/walls/:id/layout', authorize('STORE_MANAGER'), setLayout);

// 플레이어용 — 장치의 월 정보
router.get('/device/:deviceId/wall-info', getDeviceWallInfo);

// 동기화 그룹
router.get('/sync', listSyncGroups);
router.post('/sync', authorize('STORE_MANAGER'), createSyncGroup);
router.put('/sync/:id', authorize('STORE_MANAGER'), updateSyncGroup);
router.delete('/sync/:id', authorize('STORE_MANAGER'), deleteSyncGroup);
router.put('/sync/:id/devices', authorize('STORE_MANAGER'), setSyncGroupDevices);

module.exports = router;
