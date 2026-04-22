/**
 * V4 Phase 12b: 커스텀 폰트 관리 + 콘텐츠 버저닝
 */

const prisma = require('../utils/prisma');
const { verifyTenantOwnership } = require('../middleware/tenant');
const { v4: uuidv4 } = require('uuid');

// ─── 커스텀 폰트 CRUD ────────────────────────────

const listFonts = async (req, res) => {
  try {
    const where = { isActive: true };
    if (req.tenantId) where.tenantId = req.tenantId;

    const fonts = await prisma.customFont.findMany({
      where,
      orderBy: { name: 'asc' }
    });

    // 시스템 기본 폰트 추가
    const systemFonts = [
      { id: 'sys-1', name: 'Noto Sans KR', family: 'Noto Sans KR', type: 'system', weight: '400' },
      { id: 'sys-2', name: 'Roboto', family: 'Roboto', type: 'system', weight: '400' },
      { id: 'sys-3', name: 'Arial', family: 'Arial', type: 'system', weight: '400' },
      { id: 'sys-4', name: 'Georgia', family: 'Georgia', type: 'system', weight: '400' },
      { id: 'sys-5', name: 'Courier New', family: 'Courier New', type: 'system', weight: '400' },
    ];

    res.json({
      system: systemFonts,
      custom: fonts.map(f => ({ ...f, type: 'custom' }))
    });
  } catch (error) {
    res.status(500).json({ error: '폰트 목록 조회 실패' });
  }
};

const uploadFont = async (req, res) => {
  try {
    const { name, family, weight, style } = req.body;
    const file = req.file;

    if (!name || !family) {
      return res.status(400).json({ error: '폰트 이름과 family가 필요합니다' });
    }

    const fileUrl = file ? `/uploads/fonts/${file.filename}` : req.body.fileUrl;
    if (!fileUrl) return res.status(400).json({ error: '폰트 파일이 필요합니다' });

    const format = fileUrl.endsWith('.woff2') ? 'woff2' : fileUrl.endsWith('.woff') ? 'woff' : 'ttf';

    const font = await prisma.customFont.create({
      data: {
        id: uuidv4(),
        name,
        family,
        fileUrl,
        format,
        weight: weight || '400',
        style: style || 'normal',
        tenantId: req.tenantId || req.user.tenantId,
        uploadedBy: req.user.id
      }
    });

    res.status(201).json(font);
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(400).json({ error: '동일한 폰트 family/weight/style이 이미 존재합니다' });
    }
    res.status(500).json({ error: '폰트 업로드 실패' });
  }
};

const deleteFont = async (req, res) => {
  try {
    const font = await prisma.customFont.findUnique({ where: { id: req.params.id } });
    if (!font) return res.status(404).json({ error: '폰트를 찾을 수 없습니다' });
    if (!verifyTenantOwnership(font, req)) return res.status(403).json({ error: '권한이 없습니다' });

    await prisma.customFont.update({
      where: { id: req.params.id },
      data: { isActive: false }
    });
    res.json({ message: '폰트가 삭제되었습니다' });
  } catch (error) {
    res.status(500).json({ error: '폰트 삭제 실패' });
  }
};

// ─── 콘텐츠 버저닝 ──────────────────────────────

const listVersions = async (req, res) => {
  try {
    const versions = await prisma.contentVersion.findMany({
      where: { contentId: req.params.contentId },
      orderBy: { version: 'desc' },
      take: 30,
      select: {
        id: true, version: true, comment: true,
        thumbnail: true, createdBy: true, createdAt: true
      }
    });

    res.json(versions);
  } catch (error) {
    res.status(500).json({ error: '버전 목록 조회 실패' });
  }
};

const createVersion = async (req, res) => {
  try {
    const { canvasJson, comment, thumbnail } = req.body;
    const contentId = req.params.contentId;

    // 최신 버전 번호
    const latest = await prisma.contentVersion.findFirst({
      where: { contentId },
      orderBy: { version: 'desc' }
    });
    const newVersion = (latest?.version || 0) + 1;

    const version = await prisma.contentVersion.create({
      data: {
        id: uuidv4(),
        contentId,
        version: newVersion,
        canvasJson: typeof canvasJson === 'string' ? canvasJson : JSON.stringify(canvasJson),
        comment: comment || null,
        thumbnail: thumbnail || null,
        createdBy: req.user.id
      }
    });

    // 30개 초과 시 오래된 버전 자동 삭제
    const count = await prisma.contentVersion.count({ where: { contentId } });
    if (count > 30) {
      const oldest = await prisma.contentVersion.findMany({
        where: { contentId },
        orderBy: { version: 'asc' },
        take: count - 30,
        select: { id: true }
      });
      await prisma.contentVersion.deleteMany({
        where: { id: { in: oldest.map(v => v.id) } }
      });
    }

    res.status(201).json(version);
  } catch (error) {
    res.status(500).json({ error: '버전 생성 실패' });
  }
};

const getVersion = async (req, res) => {
  try {
    const version = await prisma.contentVersion.findUnique({
      where: { id: req.params.versionId }
    });
    if (!version) return res.status(404).json({ error: '버전을 찾을 수 없습니다' });

    res.json({
      ...version,
      canvasData: JSON.parse(version.canvasJson)
    });
  } catch (error) {
    res.status(500).json({ error: '버전 조회 실패' });
  }
};

const restoreVersion = async (req, res) => {
  try {
    const version = await prisma.contentVersion.findUnique({
      where: { id: req.params.versionId }
    });
    if (!version) return res.status(404).json({ error: '버전을 찾을 수 없습니다' });

    // 현재 상태를 새 버전으로 먼저 저장
    const content = await prisma.content.findUnique({ where: { id: version.contentId } });
    if (content?.canvasJson) {
      const latest = await prisma.contentVersion.findFirst({
        where: { contentId: version.contentId },
        orderBy: { version: 'desc' }
      });
      await prisma.contentVersion.create({
        data: {
          id: uuidv4(),
          contentId: version.contentId,
          version: (latest?.version || 0) + 1,
          canvasJson: content.canvasJson,
          comment: '자동 저장 (복원 전)',
          createdBy: req.user.id
        }
      });
    }

    // 콘텐츠를 해당 버전으로 복원
    await prisma.content.update({
      where: { id: version.contentId },
      data: {
        canvasJson: version.canvasJson,
        thumbnail: version.thumbnail || content?.thumbnail
      }
    });

    res.json({ message: `v${version.version}으로 복원되었습니다`, version: version.version });
  } catch (error) {
    res.status(500).json({ error: '버전 복원 실패' });
  }
};

module.exports = {
  listFonts, uploadFont, deleteFont,
  listVersions, createVersion, getVersion, restoreVersion
};
