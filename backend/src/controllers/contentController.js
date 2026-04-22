const prisma = require('../utils/prisma');
const { verifyTenantOwnership } = require('../middleware/tenant');
const path = require('path');
const fs = require('fs-extra');
const { v4: uuidv4 } = require('uuid');
const storage = require('../utils/storage');

const getContent = async (req, res) => {
  try {
    const ALLOWED_SORT_FIELDS = ['createdAt', 'updatedAt', 'name', 'size', 'type'];
    const { page: _pg = 1, limit: _lm = 20, type, categoryId, search, sortOrder = 'desc', publishStatus } = req.query;
    const page = Math.max(1, parseInt(_pg) || 1);
    const limit = Math.max(1, Math.min(parseInt(_lm) || 20, 500));
    const rawSortBy = req.query.sortBy || 'createdAt';
    const sortBy = ALLOWED_SORT_FIELDS.includes(rawSortBy) ? rawSortBy : 'createdAt';
    const skip = (page - 1) * limit;

    const where = {};
    if (req.tenantId) where.tenantId = req.tenantId;
    if (type) where.type = type;
    if (categoryId) where.categoryId = categoryId;

    // V4 Phase 11: publishStatus 필터
    if (publishStatus) {
      if (publishStatus === 'all') {
        // 모든 상태 (disabled 포함, 관리자용)
      } else {
        where.publishStatus = publishStatus;
      }
    } else {
      // 기본: published 콘텐츠만 (기존 isActive=true와 동일 효과)
      where.isActive = true;
    }

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { tags: { contains: search } }
      ];
    }

    const [items, total] = await Promise.all([
      prisma.content.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          category: { select: { id: true, name: true } },
          creator: { select: { id: true, username: true } }
        }
      }),
      prisma.content.count({ where })
    ]);

    // Resolve URLs for R2-stored content
    const resolvedItems = await Promise.all(items.map(async (item) => {
      if (item.storageType === 'r2' && item.filePath) {
        try {
          item.url = await storage.getFileUrl(item.filePath, 'r2');
        } catch { /* keep existing url */ }
      }
      return item;
    }));

    res.json({
      items: resolvedItems,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get content error:', error);
    res.status(500).json({ error: 'Failed to get content' });
  }
};

const getContentById = async (req, res) => {
  try {
    const content = await prisma.content.findUnique({
      where: { id: req.params.id },
      include: {
        category: true,
        creator: { select: { id: true, username: true } }
      }
    });

    if (!content) {
      return res.status(404).json({ error: 'Content not found' });
    }

    if (!verifyTenantOwnership(content, req)) {
      return res.status(403).json({ error: '접근 권한이 없습니다' });
    }

    // Resolve R2 URL
    if (content.storageType === 'r2' && content.filePath) {
      try {
        content.url = await storage.getFileUrl(content.filePath, 'r2');
      } catch { /* keep existing */ }
    }

    res.json(content);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get content' });
  }
};

const uploadContent = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { name, categoryId, tags, startAt, expiresAt } = req.body;
    const file = req.file;
    const tenantId = req.tenantId || req.user.tenantId;

    const getContentType = (mimetype) => {
      if (mimetype.startsWith('image/')) return 'IMAGE';
      if (mimetype.startsWith('video/')) return 'VIDEO';
      if (mimetype.startsWith('audio/')) return 'AUDIO';
      if (mimetype === 'text/html') return 'HTML';
      return 'DOCUMENT';
    };

    // Upload to R2 or local storage via abstraction layer
    const stored = await storage.uploadFile({
      tenantId,
      filename: path.basename(file.path),
      mimetype: file.mimetype,
      filePathOrBuffer: file.path,
      size: file.size,
    });

    // V4 Phase 11: 생애주기 상태 결정
    const parsedStartAt = startAt ? new Date(startAt) : null;
    const parsedExpiresAt = expiresAt ? new Date(expiresAt) : null;
    const now = new Date();

    let publishStatus = 'published';
    let isActive = true;
    if (parsedStartAt && parsedStartAt > now) {
      publishStatus = 'scheduled';
      isActive = false; // 엠바고: 아직 게시 시간 안됨
    }

    const content = await prisma.content.create({
      data: {
        id: uuidv4(),
        name: name || file.originalname,
        type: getContentType(file.mimetype),
        mimeType: file.mimetype,
        size: file.size,
        filePath: stored.filePath,
        url: stored.url || '',
        storageType: stored.storageType,
        categoryId: categoryId || null,
        createdBy: req.user.id,
        tags: tags || null,
        tenantId,
        startAt: parsedStartAt,
        expiresAt: parsedExpiresAt,
        publishStatus,
        isActive,
      }
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        tenantId,
        action: 'UPLOAD_CONTENT',
        target: content.id,
        details: `Uploaded: ${content.name} (${stored.storageType})`
      }
    });

    // If R2 and no public URL, resolve URL for response
    if (!content.url && stored.storageType === 'r2') {
      content.url = await storage.getFileUrl(stored.filePath, 'r2');
    }

    res.status(201).json(content);
  } catch (error) {
    console.error('Upload content error:', error);
    res.status(500).json({ error: 'Failed to upload content' });
  }
};

const updateContent = async (req, res) => {
  try {
    const { name, categoryId, tags, isActive, startAt, expiresAt, publishStatus } = req.body;

    const content = await prisma.content.findUnique({ where: { id: req.params.id } });
    if (!content) {
      return res.status(404).json({ error: 'Content not found' });
    }
    if (!verifyTenantOwnership(content, req)) {
      return res.status(403).json({ error: '접근 권한이 없습니다' });
    }

    const updateData = {};
    if (name) updateData.name = name;
    if (categoryId !== undefined) updateData.categoryId = categoryId;
    if (tags !== undefined) updateData.tags = tags;
    if (isActive !== undefined) updateData.isActive = isActive;

    // V4 Phase 11: 생애주기 필드 업데이트
    if (startAt !== undefined) updateData.startAt = startAt ? new Date(startAt) : null;
    if (expiresAt !== undefined) updateData.expiresAt = expiresAt ? new Date(expiresAt) : null;
    if (publishStatus !== undefined) {
      updateData.publishStatus = publishStatus;
      // publishStatus 변경 시 isActive도 자동 동기화
      if (publishStatus === 'published') updateData.isActive = true;
      if (publishStatus === 'disabled' || publishStatus === 'expired') updateData.isActive = false;
      if (publishStatus === 'scheduled') updateData.isActive = false;
    }

    const updated = await prisma.content.update({
      where: { id: req.params.id },
      data: updateData,
      include: {
        category: true,
        creator: { select: { id: true, username: true } }
      }
    });

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update content' });
  }
};

const deleteContent = async (req, res) => {
  try {
    const content = await prisma.content.findUnique({ where: { id: req.params.id } });
    if (!content) {
      return res.status(404).json({ error: 'Content not found' });
    }
    if (!verifyTenantOwnership(content, req)) {
      return res.status(403).json({ error: '접근 권한이 없습니다' });
    }

    // Cleanup references before soft-deleting
    await prisma.playlistItem.deleteMany({
      where: { contentId: req.params.id }
    });

    // Soft delete (keep file for now; can add hard-delete cleanup job later)
    await prisma.content.update({
      where: { id: req.params.id },
      data: { isActive: false }
    });

    // Optionally remove from storage (uncomment for hard delete)
    // await storage.deleteFile(content.filePath, content.storageType);

    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        tenantId: content.tenantId,
        action: 'DELETE_CONTENT',
        target: content.id,
        details: `Deleted: ${content.name}`
      }
    });

    res.json({ message: 'Content deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete content' });
  }
};

const getCategories = async (req, res) => {
  try {
    const catWhere = { parentId: null };
    if (req.tenantId) catWhere.tenantId = req.tenantId;
    const categories = await prisma.contentCategory.findMany({
      include: {
        children: true,
        _count: { select: { contents: true } }
      },
      where: catWhere
    });
    res.json(categories);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get categories' });
  }
};

const createCategory = async (req, res) => {
  try {
    const { name, parentId } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Category name is required' });
    }
    const category = await prisma.contentCategory.create({
      data: { id: uuidv4(), name, parentId: parentId || null, tenantId: req.tenantId || req.user.tenantId }
    });
    res.status(201).json(category);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create category' });
  }
};

// V4 Phase 11: 콘텐츠 수동 비활성화 (publishStatus → disabled)
const disableContent = async (req, res) => {
  try {
    const content = await prisma.content.findUnique({ where: { id: req.params.id } });
    if (!content) return res.status(404).json({ error: 'Content not found' });
    if (!verifyTenantOwnership(content, req)) {
      return res.status(403).json({ error: '접근 권한이 없습니다' });
    }

    const updated = await prisma.content.update({
      where: { id: req.params.id },
      data: { publishStatus: 'disabled', isActive: false }
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        tenantId: content.tenantId,
        action: 'DISABLE_CONTENT',
        target: content.id,
        details: `수동 비활성화: ${content.name}`
      }
    });

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Failed to disable content' });
  }
};

// V4 Phase 11: 콘텐츠 수동 활성화 (→ published)
const enableContent = async (req, res) => {
  try {
    const content = await prisma.content.findUnique({ where: { id: req.params.id } });
    if (!content) return res.status(404).json({ error: 'Content not found' });
    if (!verifyTenantOwnership(content, req)) {
      return res.status(403).json({ error: '접근 권한이 없습니다' });
    }

    const updated = await prisma.content.update({
      where: { id: req.params.id },
      data: { publishStatus: 'published', isActive: true }
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        tenantId: content.tenantId,
        action: 'ENABLE_CONTENT',
        target: content.id,
        details: `수동 활성화: ${content.name}`
      }
    });

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Failed to enable content' });
  }
};

// V4 Phase 11: 콘텐츠 생애주기 통계
const getLifecycleStats = async (req, res) => {
  try {
    const where = {};
    if (req.tenantId) where.tenantId = req.tenantId;

    const now = new Date();
    const oneDayLater = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const threeDaysLater = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const [published, scheduled, expired, disabled, expiringToday, expiringThreeDays, expiringSevenDays] = await Promise.all([
      prisma.content.count({ where: { ...where, publishStatus: 'published' } }),
      prisma.content.count({ where: { ...where, publishStatus: 'scheduled' } }),
      prisma.content.count({ where: { ...where, publishStatus: 'expired' } }),
      prisma.content.count({ where: { ...where, publishStatus: 'disabled' } }),
      prisma.content.count({
        where: { ...where, publishStatus: 'published', expiresAt: { gt: now, lte: oneDayLater } }
      }),
      prisma.content.count({
        where: { ...where, publishStatus: 'published', expiresAt: { gt: now, lte: threeDaysLater } }
      }),
      prisma.content.count({
        where: { ...where, publishStatus: 'published', expiresAt: { gt: now, lte: sevenDaysLater } }
      }),
    ]);

    res.json({
      published,
      scheduled,
      expired,
      disabled,
      total: published + scheduled + expired + disabled,
      expiring: {
        d1: expiringToday,
        d3: expiringThreeDays,
        d7: expiringSevenDays
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get lifecycle stats' });
  }
};

module.exports = {
  getContent, getContentById, uploadContent, updateContent, deleteContent,
  getCategories, createCategory,
  disableContent, enableContent, getLifecycleStats
};
