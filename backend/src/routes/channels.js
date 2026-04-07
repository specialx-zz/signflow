const express = require('express');
const router = express.Router();
const {
  listChannels, getChannel, createChannel, updateChannel, deleteChannel,
  addContent, removeContent, reorderContents,
  assignDevices,
  getContentJourney
} = require('../controllers/channelController');
const { authenticate, authorize } = require('../middleware/auth');
const { tenantContext } = require('../middleware/tenant');

router.use(authenticate);
router.use(tenantContext);

// 채널 CRUD
router.get('/', listChannels);
router.post('/', authorize('USER'), createChannel);

// 콘텐츠 저니맵 (구체적 경로를 와일드카드 /:id 보다 먼저 등록)
router.get('/journey/:contentId', getContentJourney);

// 와일드카드 라우트
router.get('/:id', getChannel);
router.put('/:id', authorize('USER'), updateChannel);
router.delete('/:id', authorize('STORE_MANAGER'), deleteChannel);

// 채널 콘텐츠 관리
router.post('/:id/contents', authorize('USER'), addContent);
router.delete('/:id/contents/:contentItemId', authorize('USER'), removeContent);
router.put('/:id/contents/reorder', authorize('USER'), reorderContents);

// 채널 장치 배정
router.put('/:id/devices', authorize('STORE_MANAGER'), assignDevices);

module.exports = router;
