const express = require('express');
const router = express.Router();
const {
  getDevices, getDeviceById, createDevice, updateDevice, deleteDevice,
  getDeviceStatus, controlDevice, getDeviceGroups, createDeviceGroup
} = require('../controllers/deviceController');
const {
  registerPlayerDevice, getDeviceSchedules, updateDeviceStatus, uploadScreenshot, getLatestScreenshot,
  getContentManifest, updateDeploymentStatus, getDeploymentStatus
} = require('../controllers/playerController');
const { createToken, getTokens, registerWithToken, deleteToken } = require('../controllers/registrationTokenController');
const { authenticate, authorize } = require('../middleware/auth');
const { tenantContext, storeFilter } = require('../middleware/tenant');
const { checkDeviceQuota, requireActiveSubscription } = require('../middleware/quota');

// UUID v4 pattern — validates :id parameter on player routes
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const validateDeviceId = (req, res, next) => {
  if (!UUID_REGEX.test(req.params.id)) {
    return res.status(400).json({ error: 'Invalid device ID format' });
  }
  next();
};

// ─── Player routes (no auth required – called from kiosk browser) ─────────────
router.post('/register', registerPlayerDevice);
router.post('/register-with-token', registerWithToken);
router.get('/:id/schedules', validateDeviceId, getDeviceSchedules);
router.get('/:id/manifest', validateDeviceId, getContentManifest);
router.post('/:id/status', validateDeviceId, updateDeviceStatus);
router.post('/:id/screenshot', validateDeviceId, uploadScreenshot);
router.post('/:id/deployment-status', validateDeviceId, updateDeploymentStatus);

// ─── Admin routes (require authentication) ────────────────────────────────────
router.use(authenticate);
router.use(tenantContext);
router.use(storeFilter);

/**
 * @swagger
 * /devices/groups:
 *   get:
 *     tags: [Devices]
 *     summary: 디바이스 그룹 목록 조회
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 디바이스 그룹 목록
 *       401:
 *         description: 인증 필요
 */
// Static routes MUST come before dynamic /:id routes to avoid Express matching
// "groups" or "latest-screenshot" as an :id parameter
router.get('/groups', getDeviceGroups);

/**
 * @swagger
 * /devices/groups:
 *   post:
 *     tags: [Devices]
 *     summary: 디바이스 그룹 생성
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
 *         description: 그룹 생성 성공
 *       403:
 *         description: 권한 부족 (STORE_MANAGER 이상)
 */
router.post('/groups', authorize('STORE_MANAGER'), createDeviceGroup);

/**
 * @swagger
 * /devices/tokens:
 *   get:
 *     tags: [Devices]
 *     summary: 디바이스 등록 토큰 목록 조회
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 토큰 목록
 *       401:
 *         description: 인증 필요
 */
router.get('/tokens', getTokens);

/**
 * @swagger
 * /devices/tokens:
 *   post:
 *     tags: [Devices]
 *     summary: 디바이스 등록 토큰 생성
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               storeId:
 *                 type: string
 *                 format: uuid
 *               expiresIn:
 *                 type: integer
 *                 description: 만료 시간 (초)
 *     responses:
 *       201:
 *         description: 토큰 생성 성공
 *       403:
 *         description: 권한 부족
 */
router.post('/tokens', authorize('STORE_MANAGER'), createToken);

/**
 * @swagger
 * /devices/tokens/{code}:
 *   delete:
 *     tags: [Devices]
 *     summary: 디바이스 등록 토큰 삭제
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: code
 *         required: true
 *         schema:
 *           type: string
 *         description: 토큰 코드
 *     responses:
 *       200:
 *         description: 삭제 성공
 *       403:
 *         description: 권한 부족
 */
router.delete('/tokens/:code', authorize('STORE_MANAGER'), deleteToken);

/**
 * @swagger
 * /devices:
 *   get:
 *     tags: [Devices]
 *     summary: 디바이스 목록 조회
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
 *         name: storeId
 *         schema:
 *           type: string
 *         description: 매장 ID 필터
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [ONLINE, OFFLINE, IDLE]
 *         description: 상태 필터
 *     responses:
 *       200:
 *         description: 디바이스 목록
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 devices:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Device'
 *                 total:
 *                   type: integer
 *       401:
 *         description: 인증 필요
 */
router.get('/', getDevices);

/**
 * @swagger
 * /devices:
 *   post:
 *     tags: [Devices]
 *     summary: 디바이스 생성
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
 *               - storeId
 *             properties:
 *               name:
 *                 type: string
 *               storeId:
 *                 type: string
 *                 format: uuid
 *               deviceId:
 *                 type: string
 *     responses:
 *       201:
 *         description: 디바이스 생성 성공
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Device'
 *       403:
 *         description: 권한 부족 (STORE_MANAGER 이상)
 */
router.post('/', authorize('STORE_MANAGER'), requireActiveSubscription, checkDeviceQuota, createDevice);

/**
 * @swagger
 * /devices/{id}/latest-screenshot:
 *   get:
 *     tags: [Devices]
 *     summary: 디바이스 최신 스크린샷 조회
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: 디바이스 ID
 *     responses:
 *       200:
 *         description: 스크린샷 정보
 *       404:
 *         description: 스크린샷 없음
 */
router.get('/:id/latest-screenshot', getLatestScreenshot);

/**
 * @swagger
 * /devices/{id}/deployment-status:
 *   get:
 *     tags: [Devices]
 *     summary: 디바이스 배포 상태 조회
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: 디바이스 ID
 *     responses:
 *       200:
 *         description: 배포 상태
 */
router.get('/:id/deployment-status', getDeploymentStatus);

/**
 * @swagger
 * /devices/{id}/status:
 *   get:
 *     tags: [Devices]
 *     summary: 디바이스 상태 조회
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: 디바이스 ID
 *     responses:
 *       200:
 *         description: 디바이스 상태 정보
 *       404:
 *         description: 디바이스 없음
 */
router.get('/:id/status', getDeviceStatus);

/**
 * @swagger
 * /devices/{id}/control:
 *   post:
 *     tags: [Devices]
 *     summary: 디바이스 원격 제어
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: 디바이스 ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - command
 *             properties:
 *               command:
 *                 type: string
 *                 enum: [RESTART, REFRESH, VOLUME_UP, VOLUME_DOWN, MUTE, DISPLAY_ON, DISPLAY_OFF]
 *     responses:
 *       200:
 *         description: 명령 전송 성공
 *       403:
 *         description: 권한 부족
 *       404:
 *         description: 디바이스 없음
 */
router.post('/:id/control', authorize('STORE_MANAGER'), controlDevice);

/**
 * @swagger
 * /devices/{id}:
 *   get:
 *     tags: [Devices]
 *     summary: 디바이스 상세 조회
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: 디바이스 ID
 *     responses:
 *       200:
 *         description: 디바이스 상세 정보
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Device'
 *       404:
 *         description: 디바이스 없음
 */
router.get('/:id', getDeviceById);

/**
 * @swagger
 * /devices/{id}:
 *   put:
 *     tags: [Devices]
 *     summary: 디바이스 수정
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: 디바이스 ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               storeId:
 *                 type: string
 *                 format: uuid
 *     responses:
 *       200:
 *         description: 수정 성공
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Device'
 *       403:
 *         description: 권한 부족
 *       404:
 *         description: 디바이스 없음
 */
router.put('/:id', authorize('STORE_MANAGER'), updateDevice);

/**
 * @swagger
 * /devices/{id}:
 *   delete:
 *     tags: [Devices]
 *     summary: 디바이스 삭제
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: 디바이스 ID
 *     responses:
 *       200:
 *         description: 삭제 성공
 *       403:
 *         description: 권한 부족
 *       404:
 *         description: 디바이스 없음
 */
router.delete('/:id', authorize('STORE_MANAGER'), deleteDevice);

module.exports = router;
