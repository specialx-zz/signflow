/**
 * sharedContentController.js — 공유 콘텐츠 라이브러리
 *
 * 본사(SUPER_ADMIN)가 등록한 콘텐츠를 모든 테넌트가 사용 가능
 * 테넌트는 공유 콘텐츠를 자기 라이브러리에 복사(import)할 수 있음
 */

const prisma = require('../utils/prisma');
const { logger } = require('../utils/logger');
const storage = require('../utils/storage');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs-extra');

/**
 * GET /api/shared-content
 * 공유 콘텐츠 목록 (모든 테넌트 접근 가능)
 */
const getSharedContent = async (req, res) => {
  try {
    const { type, category, search, page = 1, limit = 20 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const where = { isActive: true };
    if (type) where.type = type;
    if (category) where.category = category;
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { tags: { contains: search } },
        { description: { contains: search } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.sharedContent.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: Number(limit),
      }),
      prisma.sharedContent.count({ where }),
    ]);

    // URL 생성
    const itemsWithUrls = await Promise.all(
      items.map(async (item) => ({
        ...item,
        url: await storage.getFileUrl(item.filePath, item.storageType),
        thumbnailUrl: item.thumbnail
          ? await storage.getFileUrl(item.thumbnail, item.storageType)
          : null,
      }))
    );

    res.json({
      items: itemsWithUrls,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    logger.error('Get shared content error', { error });
    res.status(500).json({ error: '공유 콘텐츠 조회에 실패했습니다.' });
  }
};

/**
 * POST /api/shared-content
 * 공유 콘텐츠 등록 (SUPER_ADMIN 전용)
 */
const createSharedContent = async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: '파일을 업로드해주세요.' });
    }

    const { name, tags, category, description } = req.body;

    // 파일 타입 판별
    const mimeType = file.mimetype;
    let type = 'DOCUMENT';
    if (mimeType.startsWith('image/')) type = 'IMAGE';
    else if (mimeType.startsWith('video/')) type = 'VIDEO';
    else if (mimeType.startsWith('audio/')) type = 'AUDIO';

    // 저장
    const filePath = `shared/${type.toLowerCase()}s/${Date.now()}-${file.originalname}`;
    const storageType = await storage.uploadFile(file, filePath);

    const shared = await prisma.sharedContent.create({
      data: {
        name: name || file.originalname,
        type,
        mimeType,
        size: file.size,
        filePath,
        storageType,
        tags: tags || null,
        category: category || null,
        description: description || null,
        createdBy: req.user.id,
      },
    });

    logger.info('Shared content created', { id: shared.id, name: shared.name });

    res.status(201).json({
      ...shared,
      url: await storage.getFileUrl(shared.filePath, shared.storageType),
    });
  } catch (error) {
    logger.error('Create shared content error', { error });
    res.status(500).json({ error: '공유 콘텐츠 등록에 실패했습니다.' });
  }
};

/**
 * POST /api/shared-content/:id/import
 * 공유 콘텐츠를 테넌트 라이브러리로 복사
 */
const importSharedContent = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId || req.user.tenantId;

    const shared = await prisma.sharedContent.findUnique({ where: { id } });
    if (!shared || !shared.isActive) {
      return res.status(404).json({ error: '공유 콘텐츠를 찾을 수 없습니다.' });
    }

    // 테넌트 콘텐츠로 복사 (같은 저장소 파일 참조 — 복사가 아닌 링크)
    const content = await prisma.content.create({
      data: {
        tenantId,
        name: shared.name,
        type: shared.type,
        mimeType: shared.mimeType,
        size: shared.size,
        filePath: shared.filePath,         // 같은 파일 참조
        storageType: shared.storageType,
        thumbnail: shared.thumbnail,
        tags: shared.tags,
        createdBy: req.user.id,
        metadata: JSON.stringify({ sharedContentId: shared.id }),
      },
    });

    logger.info('Shared content imported', {
      sharedId: shared.id, contentId: content.id, tenantId,
    });

    res.status(201).json({
      ...content,
      url: await storage.getFileUrl(content.filePath, content.storageType),
    });
  } catch (error) {
    logger.error('Import shared content error', { error });
    res.status(500).json({ error: '콘텐츠 가져오기에 실패했습니다.' });
  }
};

/**
 * DELETE /api/shared-content/:id
 */
const deleteSharedContent = async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.sharedContent.update({
      where: { id },
      data: { isActive: false },
    });
    res.json({ message: '삭제되었습니다.' });
  } catch (error) {
    logger.error('Delete shared content error', { error });
    res.status(500).json({ error: '공유 콘텐츠 삭제에 실패했습니다.' });
  }
};

module.exports = {
  getSharedContent,
  createSharedContent,
  importSharedContent,
  deleteSharedContent,
};
