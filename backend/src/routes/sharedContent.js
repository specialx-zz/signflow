const express = require('express');
const router = express.Router();
const { authenticate, authorize, superAdminOnly } = require('../middleware/auth');
const { tenantContext } = require('../middleware/tenant');
const { upload } = require('../middleware/upload');
const {
  getSharedContent,
  createSharedContent,
  importSharedContent,
  deleteSharedContent,
} = require('../controllers/sharedContentController');

router.use(authenticate, tenantContext);

// 모든 인증 사용자: 공유 콘텐츠 조회
router.get('/', getSharedContent);

// 테넌트 사용자: 자기 라이브러리로 가져오기
router.post('/:id/import', authorize('USER'), importSharedContent);

// SUPER_ADMIN 전용: 등록/삭제
router.post('/', superAdminOnly, upload.single('file'), createSharedContent);
router.delete('/:id', superAdminOnly, deleteSharedContent);

module.exports = router;
