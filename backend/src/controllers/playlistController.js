const prisma = require('../utils/prisma');
const { verifyTenantOwnership } = require('../middleware/tenant');
const { v4: uuidv4 } = require('uuid');

const getPlaylists = async (req, res) => {
  try {
    const { page = 1, limit = 20, type, search } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = { isActive: true };
    if (req.tenantId) where.tenantId = req.tenantId;
    if (type) where.type = type;
    if (search) where.name = { contains: search };

    const [items, total] = await Promise.all([
      prisma.playlist.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy: { updatedAt: 'desc' },
        include: {
          creator: { select: { id: true, username: true } },
          _count: { select: { items: true } }
        }
      }),
      prisma.playlist.count({ where })
    ]);

    res.json({
      items,
      pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get playlists' });
  }
};

const getPlaylistById = async (req, res) => {
  try {
    const playlist = await prisma.playlist.findFirst({
      where: { id: req.params.id, isActive: true },
      include: {
        creator: { select: { id: true, username: true } },
        items: {
          orderBy: { order: 'asc' },
          include: {
            content: {
              include: { category: { select: { id: true, name: true } } }
            }
          }
        }
      }
    });

    if (!playlist) {
      return res.status(404).json({ error: 'Playlist not found' });
    }

    // Unauthenticated player requests: indirect tenant verification via device.
    //
    // Why not use ?tenantId=...? The previous implementation accepted a
    // tenantId query param and required `playlist.tenantId === query.tenantId`.
    // That is self-validating — an attacker only needed to know the playlist's
    // own tenantId (often guessable or leaked) to satisfy the check. IDOR.
    //
    // Fix: the player MUST pass ?deviceId=<its-own-id>. We resolve the device,
    // confirm it belongs to the same tenant as the playlist, and only then
    // serve the response. An attacker cannot forge a deviceId belonging to
    // another tenant — the device row anchors the trust, not the URL.
    if (!req.user) {
      const { deviceId } = req.query;
      if (!deviceId) {
        return res.status(403).json({ error: '디바이스 식별자가 필요합니다' });
      }
      // Accept either Device.id (PK) or Device.deviceId (player-generated UUID)
      const device = await prisma.device.findFirst({
        where: { OR: [{ id: deviceId }, { deviceId }] },
        select: { tenantId: true }
      });
      if (!device || device.tenantId !== playlist.tenantId) {
        return res.status(403).json({ error: '접근 권한이 없습니다' });
      }
    }

    // Authenticated requests: standard tenant ownership check
    if (req.user && !verifyTenantOwnership(playlist, req)) {
      return res.status(403).json({ error: '접근 권한이 없습니다' });
    }

    res.json(playlist);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get playlist' });
  }
};

const createPlaylist = async (req, res) => {
  try {
    const { name, type, description, settings } = req.body;

    const playlist = await prisma.playlist.create({
      data: {
        id: uuidv4(),
        name,
        type: type || 'GENERAL',
        description,
        settings: settings ? JSON.stringify(settings) : null,
        createdBy: req.user.id,
        tenantId: req.tenantId || req.user.tenantId
      },
      include: {
        creator: { select: { id: true, username: true } }
      }
    });

    res.status(201).json(playlist);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create playlist' });
  }
};

const updatePlaylist = async (req, res) => {
  try {
    const { name, type, description, settings } = req.body;

    const playlist = await prisma.playlist.findUnique({ where: { id: req.params.id } });
    if (!playlist) {
      return res.status(404).json({ error: 'Playlist not found' });
    }
    if (!verifyTenantOwnership(playlist, req)) {
      return res.status(403).json({ error: '접근 권한이 없습니다' });
    }

    const updated = await prisma.playlist.update({
      where: { id: req.params.id },
      data: {
        ...(name && { name }),
        ...(type && { type }),
        ...(description !== undefined && { description }),
        ...(settings && { settings: JSON.stringify(settings) })
      },
      include: {
        creator: { select: { id: true, username: true } },
        items: { orderBy: { order: 'asc' }, include: { content: true } }
      }
    });

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update playlist' });
  }
};

const deletePlaylist = async (req, res) => {
  try {
    const playlist = await prisma.playlist.findUnique({ where: { id: req.params.id } });
    if (!playlist) {
      return res.status(404).json({ error: 'Playlist not found' });
    }
    if (!verifyTenantOwnership(playlist, req)) {
      return res.status(403).json({ error: '접근 권한이 없습니다' });
    }

    // Cleanup references before soft-deleting
    await prisma.schedule.updateMany({
      where: { playlistId: req.params.id },
      data: { playlistId: null }
    });
    await prisma.layoutZone.updateMany({
      where: { playlistId: req.params.id },
      data: { playlistId: null }
    });

    await prisma.playlist.update({
      where: { id: req.params.id },
      data: { isActive: false }
    });

    res.json({ message: 'Playlist deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete playlist' });
  }
};

const addPlaylistItem = async (req, res) => {
  try {
    const { contentId, duration, order } = req.body;
    const { id: playlistId } = req.params;

    if (!contentId) {
      return res.status(400).json({ error: 'contentId is required' });
    }

    const playlist = await prisma.playlist.findUnique({ where: { id: playlistId } });
    if (!playlist) {
      return res.status(404).json({ error: 'Playlist not found' });
    }
    if (!verifyTenantOwnership(playlist, req)) {
      return res.status(403).json({ error: '접근 권한이 없습니다' });
    }

    const content = await prisma.content.findUnique({ where: { id: contentId } });
    if (!content) {
      return res.status(404).json({ error: 'Content not found' });
    }

    const maxOrder = await prisma.playlistItem.findFirst({
      where: { playlistId },
      orderBy: { order: 'desc' },
      select: { order: true }
    });

    // Calculate duration: for CANVAS, sum page durations if no explicit duration
    let itemDuration = duration || 10;
    if (!duration && content.type === 'CANVAS' && content.canvasJson) {
      try {
        const canvasData = JSON.parse(content.canvasJson);
        const pages = canvasData.pages || [];
        const totalPageDuration = pages.reduce((sum, p) => sum + (p.duration || 10), 0);
        if (totalPageDuration > 0) itemDuration = totalPageDuration;
      } catch { /* use default */ }
    }

    const item = await prisma.playlistItem.create({
      data: {
        id: uuidv4(),
        playlistId,
        contentId,
        duration: itemDuration,
        order: order !== undefined ? order : (maxOrder ? maxOrder.order + 1 : 0)
      },
      include: { content: true }
    });

    // Update total duration
    const allItems = await prisma.playlistItem.findMany({ where: { playlistId } });
    const totalDuration = allItems.reduce((sum, i) => sum + i.duration, 0);
    await prisma.playlist.update({ where: { id: playlistId }, data: { duration: totalDuration } });

    res.status(201).json(item);
  } catch (error) {
    res.status(500).json({ error: 'Failed to add playlist item' });
  }
};

const updatePlaylistItem = async (req, res) => {
  try {
    const { duration, order, settings } = req.body;
    const existing = await prisma.playlistItem.findUnique({ where: { id: req.params.itemId } });
    if (!existing) {
      return res.status(404).json({ error: 'Playlist item not found' });
    }
    if (existing.playlistId !== req.params.id) {
      return res.status(403).json({ error: '해당 플레이리스트의 항목이 아닙니다' });
    }
    const item = await prisma.playlistItem.update({
      where: { id: req.params.itemId },
      data: {
        ...(duration !== undefined && { duration }),
        ...(order !== undefined && { order }),
        ...(settings && { settings: JSON.stringify(settings) })
      },
      include: { content: true }
    });

    // Recalculate total duration if duration was changed
    if (duration !== undefined) {
      const allItems = await prisma.playlistItem.findMany({ where: { playlistId: item.playlistId } });
      const totalDuration = allItems.reduce((sum, i) => sum + i.duration, 0);
      await prisma.playlist.update({ where: { id: item.playlistId }, data: { duration: totalDuration } });
    }

    res.json(item);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update playlist item' });
  }
};

const removePlaylistItem = async (req, res) => {
  try {
    const item = await prisma.playlistItem.findUnique({ where: { id: req.params.itemId } });
    if (!item) {
      return res.status(404).json({ error: 'Playlist item not found' });
    }

    await prisma.playlistItem.delete({ where: { id: req.params.itemId } });

    // Recalculate total duration after removal
    const allItems = await prisma.playlistItem.findMany({ where: { playlistId: item.playlistId } });
    const totalDuration = allItems.reduce((sum, i) => sum + i.duration, 0);
    await prisma.playlist.update({ where: { id: item.playlistId }, data: { duration: totalDuration } });

    res.json({ message: 'Item removed from playlist' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to remove playlist item' });
  }
};

const reorderPlaylistItems = async (req, res) => {
  try {
    const { items } = req.body; // [{id, order}]

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'items must be a non-empty array' });
    }

    const playlist = await prisma.playlist.findUnique({ where: { id: req.params.id } });
    if (!playlist) return res.status(404).json({ error: 'Playlist not found' });
    if (!verifyTenantOwnership(playlist, req)) {
      return res.status(403).json({ error: '접근 권한이 없습니다' });
    }

    // IDOR guard: verify every item belongs to this playlist
    const itemIds = items.map(i => i.id);
    const existingItems = await prisma.playlistItem.findMany({
      where: { id: { in: itemIds }, playlistId: req.params.id },
      select: { id: true }
    });
    if (existingItems.length !== itemIds.length) {
      return res.status(403).json({ error: '잘못된 아이템 ID가 포함되어 있습니다' });
    }

    await Promise.all(
      items.map(item =>
        prisma.playlistItem.update({
          where: { id: item.id },
          data: { order: item.order }
        })
      )
    );

    res.json({ message: 'Playlist reordered successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to reorder playlist' });
  }
};

module.exports = {
  getPlaylists, getPlaylistById, createPlaylist, updatePlaylist, deletePlaylist,
  addPlaylistItem, updatePlaylistItem, removePlaylistItem, reorderPlaylistItems
};
