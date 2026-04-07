/**
 * V4 Phase 12a: 캔버스 에디터 백엔드 컨트롤러
 * - 캔버스 콘텐츠 CRUD (저장/불러오기/배포)
 * - 캔버스 템플릿 관리
 */

const prisma = require('../utils/prisma');
const { v4: uuidv4 } = require('uuid');

// ─── 캔버스 콘텐츠 저장 (신규) ─────────────────────────
const saveCanvas = async (req, res) => {
  try {
    const { name, canvasJson, thumbnail } = req.body;
    const tenantId = req.tenantId || req.user.tenantId;

    if (!name || !canvasJson) {
      return res.status(400).json({ error: '이름과 캔버스 데이터가 필요합니다' });
    }

    // canvasJson 유효성 검증
    let parsed;
    try {
      parsed = typeof canvasJson === 'string' ? JSON.parse(canvasJson) : canvasJson;
    } catch {
      return res.status(400).json({ error: '잘못된 캔버스 JSON 형식입니다' });
    }

    const content = await prisma.content.create({
      data: {
        id: uuidv4(),
        name,
        type: 'CANVAS',
        mimeType: 'application/json',
        size: JSON.stringify(parsed).length,
        filePath: '',  // 캔버스는 파일 없음
        isCanvas: true,
        canvasJson: JSON.stringify(parsed),
        thumbnail: thumbnail || null,
        createdBy: req.user.id,
        tenantId,
        width: parsed.canvas?.width || 1920,
        height: parsed.canvas?.height || 1080,
      }
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        tenantId,
        action: 'CREATE_CANVAS',
        target: content.id,
        details: `캔버스 생성: ${name}`
      }
    });

    res.status(201).json(content);
  } catch (error) {
    console.error('Save canvas error:', error);
    res.status(500).json({ error: '캔버스 저장에 실패했습니다' });
  }
};

// ─── 캔버스 콘텐츠 업데이트 ─────────────────────────
const updateCanvas = async (req, res) => {
  try {
    const { name, canvasJson, thumbnail } = req.body;
    const content = await prisma.content.findUnique({ where: { id: req.params.id } });

    if (!content) return res.status(404).json({ error: '콘텐츠를 찾을 수 없습니다' });
    if (!content.isCanvas) return res.status(400).json({ error: '캔버스 콘텐츠가 아닙니다' });
    if (req.tenantId && content.tenantId !== req.tenantId) {
      return res.status(403).json({ error: '접근 권한이 없습니다' });
    }

    const updateData = {};
    if (name) updateData.name = name;
    if (thumbnail) updateData.thumbnail = thumbnail;

    if (canvasJson) {
      let parsed;
      try {
        parsed = typeof canvasJson === 'string' ? JSON.parse(canvasJson) : canvasJson;
      } catch {
        return res.status(400).json({ error: '잘못된 캔버스 JSON 형식입니다' });
      }
      updateData.canvasJson = JSON.stringify(parsed);
      updateData.size = updateData.canvasJson.length;
      updateData.width = parsed.canvas?.width || content.width;
      updateData.height = parsed.canvas?.height || content.height;
    }

    const updated = await prisma.content.update({
      where: { id: req.params.id },
      data: updateData
    });

    res.json(updated);
  } catch (error) {
    console.error('Update canvas error:', error);
    res.status(500).json({ error: '캔버스 업데이트에 실패했습니다' });
  }
};

// ─── 캔버스 콘텐츠 상세 (canvasJson 포함) ──────────────
const getCanvas = async (req, res) => {
  try {
    const content = await prisma.content.findUnique({
      where: { id: req.params.id },
      include: {
        creator: { select: { id: true, username: true } }
      }
    });

    if (!content) return res.status(404).json({ error: '콘텐츠를 찾을 수 없습니다' });
    if (!content.isCanvas) return res.status(400).json({ error: '캔버스 콘텐츠가 아닙니다' });
    if (req.tenantId && content.tenantId !== req.tenantId) {
      return res.status(403).json({ error: '접근 권한이 없습니다' });
    }

    // canvasJson을 파싱하여 반환
    const result = {
      ...content,
      canvasData: content.canvasJson ? JSON.parse(content.canvasJson) : null
    };

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: '캔버스 조회에 실패했습니다' });
  }
};

// ─── 캔버스 목록 (isCanvas=true만) ────────────────────
const listCanvases = async (req, res) => {
  try {
    const { page = 1, limit = 20, search } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const where = { isCanvas: true, isActive: true };
    if (req.tenantId) where.tenantId = req.tenantId;
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
        take: parseInt(limit),
        orderBy: { updatedAt: 'desc' },
        select: {
          id: true, name: true, thumbnail: true, width: true, height: true,
          publishStatus: true, createdAt: true, updatedAt: true,
          creator: { select: { id: true, username: true } }
        }
      }),
      prisma.content.count({ where })
    ]);

    res.json({
      items,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    res.status(500).json({ error: '캔버스 목록 조회에 실패했습니다' });
  }
};

// ─── 템플릿 목록 ───────────────────────────────────
const listTemplates = async (req, res) => {
  try {
    const { category, search } = req.query;
    const where = { isActive: true };

    // 공개 템플릿 + 내 업체 템플릿
    if (req.tenantId) {
      where.OR = [
        { isPublic: true },
        { tenantId: req.tenantId }
      ];
    }
    if (category) where.category = category;
    if (search) where.name = { contains: search };

    const templates = await prisma.canvasTemplate.findMany({
      where,
      orderBy: { useCount: 'desc' },
      take: 50
    });

    res.json(templates);
  } catch (error) {
    res.status(500).json({ error: '템플릿 목록 조회에 실패했습니다' });
  }
};

// ─── 템플릿 저장 ───────────────────────────────────
const saveTemplate = async (req, res) => {
  try {
    const { name, description, category, canvasJson, thumbnail, tags, isPublic } = req.body;
    if (!name || !canvasJson) {
      return res.status(400).json({ error: '이름과 캔버스 데이터가 필요합니다' });
    }

    const template = await prisma.canvasTemplate.create({
      data: {
        id: uuidv4(),
        name,
        description,
        category: category || 'general',
        canvasJson: typeof canvasJson === 'string' ? canvasJson : JSON.stringify(canvasJson),
        thumbnail,
        tags,
        isPublic: isPublic || false,
        tenantId: req.tenantId || req.user.tenantId,
        createdBy: req.user.id
      }
    });

    res.status(201).json(template);
  } catch (error) {
    res.status(500).json({ error: '템플릿 저장에 실패했습니다' });
  }
};

// ─── 템플릿 사용 (useCount 증가 + canvasJson 반환) ─────
const useTemplate = async (req, res) => {
  try {
    const template = await prisma.canvasTemplate.findUnique({
      where: { id: req.params.id }
    });
    if (!template) return res.status(404).json({ error: '템플릿을 찾을 수 없습니다' });

    // useCount 증가
    await prisma.canvasTemplate.update({
      where: { id: req.params.id },
      data: { useCount: { increment: 1 } }
    });

    res.json({
      canvasData: JSON.parse(template.canvasJson),
      name: template.name
    });
  } catch (error) {
    res.status(500).json({ error: '템플릿 사용에 실패했습니다' });
  }
};

module.exports = {
  saveCanvas, updateCanvas, getCanvas, listCanvases,
  listTemplates, saveTemplate, useTemplate
};
