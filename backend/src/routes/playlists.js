const express = require('express');
const router = express.Router();
const {
  getPlaylists, getPlaylistById, createPlaylist, updatePlaylist, deletePlaylist,
  addPlaylistItem, updatePlaylistItem, removePlaylistItem, reorderPlaylistItems
} = require('../controllers/playlistController');
const { authenticate, authorize } = require('../middleware/auth');
const { tenantContext } = require('../middleware/tenant');

// ─── Player route (no auth required – called from kiosk player) ──────────────
router.get('/:id', getPlaylistById);

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
