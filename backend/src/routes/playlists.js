const express = require('express');
const router = express.Router();
const {
  getPlaylists, getPlaylistById, createPlaylist, updatePlaylist, deletePlaylist,
  addPlaylistItem, updatePlaylistItem, removePlaylistItem, reorderPlaylistItems
} = require('../controllers/playlistController');
const { authenticate, optionalAuthenticate, authorize } = require('../middleware/auth');
const { tenantContext } = require('../middleware/tenant');

// ─── Public-ish route: authenticated admins AND kiosk player 모두 접근 ─────
// - 관리자(Bearer 토큰 보유) → req.user/req.tenantId 세팅 후 tenant 체크
// - 플레이어(토큰 없음) → req.query.tenantId 로 tenant 체크
router.get('/:id', optionalAuthenticate, getPlaylistById);

// ─── Admin routes (require authentication) ────────────────────────────────────
router.use(authenticate);
router.use(tenantContext);

router.get('/', getPlaylists);
router.post('/', authorize('USER'), createPlaylist);
router.put('/:id', authorize('USER'), updatePlaylist);
router.delete('/:id', authorize('USER'), deletePlaylist);
router.post('/:id/items', authorize('USER'), addPlaylistItem);
router.put('/:id/items/reorder', authorize('USER'), reorderPlaylistItems);
router.put('/:id/items/:itemId', authorize('USER'), updatePlaylistItem);
router.delete('/:id/items/:itemId', authorize('USER'), removePlaylistItem);

module.exports = router;
