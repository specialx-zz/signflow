const express = require('express');
const router = express.Router();
const {
  getStores,
  getStoreById,
  createStore,
  updateStore,
  deleteStore,
  getStoreDevices,
  assignDeviceToStore,
  removeDeviceFromStore,
} = require('../controllers/storeController');
const { authenticate, authorize } = require('../middleware/auth');
const { tenantContext } = require('../middleware/tenant');
const { checkStoreQuota, requireActiveSubscription } = require('../middleware/quota');

// 모든 라우트: 인증 + 테넌트 컨텍스트
router.use(authenticate);
router.use(tenantContext);

/**
 * @swagger
 * /stores:
 *   get:
 *     tags: [Stores]
 *     summary: 매장 목록 조회
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
 *         name: search
 *         schema:
 *           type: string
 *         description: 검색어
 *     responses:
 *       200:
 *         description: 매장 목록
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 stores:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Store'
 *                 total:
 *                   type: integer
 *       401:
 *         description: 인증 필요
 */
router.get('/', getStores);

/**
 * @swagger
 * /stores:
 *   post:
 *     tags: [Stores]
 *     summary: 매장 생성
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
 *               address:
 *                 type: string
 *               phone:
 *                 type: string
 *     responses:
 *       201:
 *         description: 매장 생성 성공
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Store'
 *       401:
 *         description: 인증 필요
 *       403:
 *         description: 권한 부족 (TENANT_ADMIN 이상)
 */
router.post('/', authorize('TENANT_ADMIN'), requireActiveSubscription, checkStoreQuota, createStore);

/**
 * @swagger
 * /stores/{id}:
 *   get:
 *     tags: [Stores]
 *     summary: 매장 상세 조회
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: 매장 ID
 *     responses:
 *       200:
 *         description: 매장 상세 정보
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Store'
 *       404:
 *         description: 매장 없음
 */
router.get('/:id', getStoreById);

/**
 * @swagger
 * /stores/{id}:
 *   put:
 *     tags: [Stores]
 *     summary: 매장 수정
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: 매장 ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               address:
 *                 type: string
 *               phone:
 *                 type: string
 *     responses:
 *       200:
 *         description: 수정 성공
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Store'
 *       403:
 *         description: 권한 부족
 *       404:
 *         description: 매장 없음
 */
router.put('/:id', authorize('TENANT_ADMIN'), updateStore);

/**
 * @swagger
 * /stores/{id}:
 *   delete:
 *     tags: [Stores]
 *     summary: 매장 삭제
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: 매장 ID
 *     responses:
 *       200:
 *         description: 삭제 성공
 *       403:
 *         description: 권한 부족
 *       404:
 *         description: 매장 없음
 */
router.delete('/:id', authorize('TENANT_ADMIN'), deleteStore);

// 매장-디바이스 관리
router.get('/:id/devices', getStoreDevices);
router.post('/:id/devices', authorize('STORE_MANAGER'), assignDeviceToStore);
router.delete('/:id/devices/:deviceId', authorize('STORE_MANAGER'), removeDeviceFromStore);

module.exports = router;
