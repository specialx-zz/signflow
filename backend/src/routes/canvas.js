const express = require('express');
const router = express.Router();
const {
  saveCanvas, updateCanvas, getCanvas, listCanvases,
  listTemplates, saveTemplate, useTemplate
} = require('../controllers/canvasController');
const { authenticate, authorize } = require('../middleware/auth');
const { tenantContext } = require('../middleware/tenant');

router.use(authenticate);
router.use(tenantContext);

// 캔버스 콘텐츠 CRUD
router.get('/', listCanvases);
router.post('/', authorize('USER'), saveCanvas);

// 캔버스 템플릿 (구체적 경로를 와일드카드 /:id 보다 먼저 등록)
router.get('/templates/list', listTemplates);
router.post('/templates', authorize('USER'), saveTemplate);
router.post('/templates/:id/use', authorize('USER'), useTemplate);

// 와일드카드 라우트는 마지막에 등록
router.get('/:id', getCanvas);
router.put('/:id', authorize('USER'), updateCanvas);

module.exports = router;
