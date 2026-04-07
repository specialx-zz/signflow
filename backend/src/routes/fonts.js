/**
 * V4 Phase 12b: 커스텀 폰트 + 콘텐츠 버저닝 라우트
 */
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs-extra');
const {
  listFonts, uploadFont, deleteFont,
  listVersions, createVersion, getVersion, restoreVersion
} = require('../controllers/fontController');
const { authenticate, authorize } = require('../middleware/auth');
const { tenantContext } = require('../middleware/tenant');

// Multer config for font uploads
const uploadDir = path.join(__dirname, '..', '..', 'uploads', 'fonts');
fs.ensureDirSync(uploadDir);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1E9)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const fileFilter = (req, file, cb) => {
  const allowed = ['.ttf', '.otf', '.woff', '.woff2'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowed.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('지원하지 않는 폰트 형식입니다. (ttf, otf, woff, woff2)'), false);
  }
};

const upload = multer({ storage, fileFilter, limits: { fileSize: 10 * 1024 * 1024 } });

router.use(authenticate);
router.use(tenantContext);

// ─── 커스텀 폰트 ─────────────────────────────
router.get('/', listFonts);
router.post('/', authorize('USER'), upload.single('file'), uploadFont);
router.delete('/:id', authorize('USER'), deleteFont);

// ─── 콘텐츠 버저닝 ──────────────────────────────
router.get('/versions/:contentId', listVersions);
router.post('/versions/:contentId', authorize('USER'), createVersion);
router.get('/versions/detail/:versionId', getVersion);
router.post('/versions/restore/:versionId', authorize('USER'), restoreVersion);

module.exports = router;
