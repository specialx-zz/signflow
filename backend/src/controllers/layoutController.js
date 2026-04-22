const prisma = require('../utils/prisma');
const { verifyTenantOwnership } = require('../middleware/tenant');
const { v4: uuidv4 } = require('uuid');

// GET /api/layouts
const getAllLayouts = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const layoutWhere = { isActive: true };
    if (req.tenantId) layoutWhere.tenantId = req.tenantId;

    const [items, total] = await Promise.all([
      prisma.layout.findMany({
        where: layoutWhere,
        skip,
        take: parseInt(limit),
        orderBy: { updatedAt: 'desc' },
        include: {
          creator: { select: { username: true } },
          _count: { select: { zones: true, schedules: true } },
        },
      }),
      prisma.layout.count({ where: layoutWhere }),
    ]);

    return res.json({
      items,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error('[Layout] getAllLayouts error:', error);
    return res.status(500).json({ error: 'Failed to fetch layouts' });
  }
};

// GET /api/layouts/:id
const getLayoutById = async (req, res) => {
  try {
    const { id } = req.params;
    const layout = await prisma.layout.findUnique({
      where: { id },
      include: {
        creator: { select: { username: true } },
        zones: {
          orderBy: { zIndex: 'asc' },
          include: {
            playlist: {
              select: {
                id: true, name: true, type: true,
                items: {
                  orderBy: { order: 'asc' },
                  include: {
                    content: {
                      select: { id: true, name: true, type: true, url: true, duration: true, thumbnail: true }
                    }
                  }
                }
              }
            }
          }
        },
      },
    });

    if (!layout) return res.status(404).json({ error: 'Layout not found' });
    if (!verifyTenantOwnership(layout, req)) {
      return res.status(403).json({ error: '접근 권한이 없습니다' });
    }
    return res.json(layout);
  } catch (error) {
    console.error('[Layout] getLayoutById error:', error);
    return res.status(500).json({ error: 'Failed to fetch layout' });
  }
};

// POST /api/layouts
const createLayout = async (req, res) => {
  try {
    const { name, description, baseWidth = 1920, baseHeight = 1080 } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });

    const layout = await prisma.layout.create({
      data: {
        id: uuidv4(),
        name,
        description,
        baseWidth: parseInt(baseWidth),
        baseHeight: parseInt(baseHeight),
        createdBy: req.user.id,
        tenantId: req.tenantId || req.user.tenantId,
      },
      include: { zones: true, _count: { select: { zones: true } } },
    });

    return res.status(201).json(layout);
  } catch (error) {
    console.error('[Layout] createLayout error:', error);
    return res.status(500).json({ error: 'Failed to create layout' });
  }
};

// PUT /api/layouts/:id
const updateLayout = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, baseWidth, baseHeight } = req.body;

    const existing = await prisma.layout.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Layout not found' });
    if (!verifyTenantOwnership(existing, req)) {
      return res.status(403).json({ error: '접근 권한이 없습니다' });
    }

    const layout = await prisma.layout.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(baseWidth && { baseWidth: parseInt(baseWidth) }),
        ...(baseHeight && { baseHeight: parseInt(baseHeight) }),
      },
      include: { zones: true },
    });

    return res.json(layout);
  } catch (error) {
    console.error('[Layout] updateLayout error:', error);
    return res.status(500).json({ error: 'Failed to update layout' });
  }
};

// DELETE /api/layouts/:id
const deleteLayout = async (req, res) => {
  try {
    const { id } = req.params;
    const layout = await prisma.layout.findUnique({ where: { id } });
    if (!layout) return res.status(404).json({ error: 'Layout not found' });
    if (!verifyTenantOwnership(layout, req)) {
      return res.status(403).json({ error: '접근 권한이 없습니다' });
    }

    // Soft delete to preserve referential integrity with schedules
    await prisma.layout.update({ where: { id }, data: { isActive: false } });
    return res.json({ success: true });
  } catch (error) {
    console.error('[Layout] deleteLayout error:', error);
    return res.status(500).json({ error: 'Failed to delete layout' });
  }
};

// PUT /api/layouts/:id/zones  — replace all zones at once (save all)
const saveZones = async (req, res) => {
  try {
    const { id } = req.params;
    const { zones } = req.body; // array of zone objects

    const layout = await prisma.layout.findUnique({ where: { id } });
    if (!layout) return res.status(404).json({ error: 'Layout not found' });
    if (!verifyTenantOwnership(layout, req)) {
      return res.status(403).json({ error: '접근 권한이 없습니다' });
    }

    // Delete all existing zones then recreate
    await prisma.layoutZone.deleteMany({ where: { layoutId: id } });

    const created = await Promise.all(
      (zones || []).map((zone, idx) =>
        prisma.layoutZone.create({
          data: {
            id: uuidv4(),
            layoutId: id,
            name: zone.name || `Zone ${idx + 1}`,
            x: parseFloat(zone.x) || 0,
            y: parseFloat(zone.y) || 0,
            width: parseFloat(zone.width) || 50,
            height: parseFloat(zone.height) || 50,
            zIndex: parseInt(zone.zIndex) || 1,
            contentType: zone.contentType || 'PLAYLIST',
            playlistId: zone.contentType === 'PLAYLIST' ? (zone.playlistId || null) : null,
            sourceUrl: zone.contentType === 'URL' ? (zone.sourceUrl || null) : null,
            sourceHtml: zone.contentType === 'HTML' ? (zone.sourceHtml || null) : null,
            bgColor: zone.bgColor || '#000000',
            fit: zone.fit || 'cover',
          },
          include: {
            playlist: { select: { id: true, name: true } }
          }
        })
      )
    );

    return res.json(created);
  } catch (error) {
    console.error('[Layout] saveZones error:', error);
    return res.status(500).json({ error: 'Failed to save zones' });
  }
};

module.exports = { getAllLayouts, getLayoutById, createLayout, updateLayout, deleteLayout, saveZones };
