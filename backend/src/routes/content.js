const express = require('express');
const router = express.Router();
const {
  getContent, getContentById, uploadContent, updateContent, deleteContent,
  getCategories, createCategory,
  disableContent, enableContent, getLifecycleStats
} = require('../controllers/contentController');
const { authenticate, authorize } = require('../middleware/auth');
const { tenantContext } = require('../middleware/tenant');
const { upload } = require('../middleware/upload');
const { checkStorageQuota, requireActiveSubscription } = require('../middleware/quota');
const { validateMimeType } = require('../middleware/validateMimeType');

router.use(authenticate);
router.use(tenantContext);

/**
 * @swagger
 * /content:
 *   get:
 *     tags: [Content]
 *     summary: 콘텐츠 목록 조회
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: 페이지 번호
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: 페이지당 항목 수
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *         description: 콘텐츠 유형 필터
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: 검색어
 *     responses:
 *       200:
 *         description: 콘텐츠 목록
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 content:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Content'
 *                 total:
 *                   type: integer
 *                 page:
 *                   type: integer
 *                 totalPages:
 *                   type: integer
 *       401:
 *         description: 인증 필요
 */
router.get('/', getContent);

/**
 * @swagger
 * /content/categories:
 *   get:
 *     tags: [Content]
 *     summary: 콘텐츠 카테고리 목록 조회
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 카테고리 목록
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                   name:
 *                     type: string
 */
router.get('/categories', getCategories);

/**
 * @swagger
 * /content/categories:
 *   post:
 *     tags: [Content]
 *     summary: 카테고리 생성
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *     responses:
 *       201:
 *         description: 카테고리 생성 성공
 *       401:
 *         description: 인증 필요
 *       403:
 *         description: 권한 부족
 */
router.post('/categories', authorize('USER'), requireActiveSubscription, createCategory);

// V4 Phase 11: 콘텐츠 생애주기 API
router.get('/lifecycle/stats', getLifecycleStats);
router.post('/:id/disable', authorize('USER'), disableContent);
router.post('/:id/enable', authorize('USER'), enableContent);

/**
 * @swagger
 * /content/upload:
 *   post:
 *     tags: [Content]
 *     summary: 콘텐츠 파일 업로드
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - file
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *               name:
 *                 type: string
 *               categoryId:
 *                 type: string
 *     responses:
 *       201:
 *         description: 업로드 성공
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Content'
 *       400:
 *         description: 잘못된 파일
 *       401:
 *         description: 인증 필요
 *       403:
 *         description: 권한 부족
 *       413:
 *         description: 파일 크기 초과
 */
router.post('/upload', authorize('USER'), requireActiveSubscription,
  (req, res, next) => {
    upload.single('file')(req, res, (err) => {
      if (err) return res.status(400).json({ error: err.message || 'Invalid file' });
      next();
    });
  },
  validateMimeType, checkStorageQuota, uploadContent);

/**
 * @swagger
 * /content/{id}:
 *   get:
 *     tags: [Content]
 *     summary: 콘텐츠 상세 조회
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: 콘텐츠 ID
 *     responses:
 *       200:
 *         description: 콘텐츠 상세 정보
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Content'
 *       404:
 *         description: 콘텐츠 없음
 */
router.get('/:id', getContentById);

/**
 * @swagger
 * /content/{id}:
 *   put:
 *     tags: [Content]
 *     summary: 콘텐츠 수정
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: 콘텐츠 ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               categoryId:
 *                 type: string
 *     responses:
 *       200:
 *         description: 수정 성공
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Content'
 *       404:
 *         description: 콘텐츠 없음
 */
router.put('/:id', authorize('USER'), updateContent);

/**
 * @swagger
 * /content/{id}:
 *   delete:
 *     tags: [Content]
 *     summary: 콘텐츠 삭제
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: 콘텐츠 ID
 *     responses:
 *       200:
 *         description: 삭제 성공
 *       404:
 *         description: 콘텐츠 없음
 */
router.delete('/:id', authorize('USER'), deleteContent);

module.exports = router;
