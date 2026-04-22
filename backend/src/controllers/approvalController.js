/**
 * approvalController.js — 콘텐츠 승인 워크플로
 *
 * 워크플로: 작성(PENDING) → 검토 → 승인(APPROVED) / 거부(REJECTED)
 * Tenant 설정에서 contentApproval: true일 때만 활성화
 */

const prisma = require('../utils/prisma');
const { verifyTenantOwnership } = require('../middleware/tenant');
const { logger } = require('../utils/logger');

/**
 * POST /api/approvals
 * 승인 요청 생성 (콘텐츠 업로드 후 자동 또는 수동)
 */
const requestApproval = async (req, res) => {
  try {
    const { contentId, comment } = req.body;
    const tenantId = req.tenantId || req.user.tenantId;

    if (!contentId) {
      return res.status(400).json({ error: 'contentId를 입력해주세요.' });
    }

    // 콘텐츠 존재 확인
    const content = await prisma.content.findFirst({
      where: { id: contentId, tenantId },
    });
    if (!content) {
      return res.status(404).json({ error: '콘텐츠를 찾을 수 없습니다.' });
    }

    // 기존 미결 승인 요청 확인
    const existing = await prisma.contentApproval.findFirst({
      where: { contentId, status: 'PENDING' },
    });
    if (existing) {
      return res.status(409).json({ error: '이미 승인 대기 중인 요청이 있습니다.' });
    }

    const approval = await prisma.contentApproval.create({
      data: {
        tenantId,
        contentId,
        requestedBy: req.user.id,
        comment: comment || null,
      },
    });

    logger.info('Approval requested', { contentId, tenantId, approvalId: approval.id });
    res.status(201).json(approval);
  } catch (error) {
    logger.error('Request approval error', { error });
    res.status(500).json({ error: '승인 요청에 실패했습니다.' });
  }
};

/**
 * GET /api/approvals
 * 승인 요청 목록
 */
const getApprovals = async (req, res) => {
  try {
    const tenantId = req.tenantId || req.user.tenantId;
    const { status, page = 1, limit = 20 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const where = { tenantId };
    if (status) where.status = status;

    const [items, total] = await Promise.all([
      prisma.contentApproval.findMany({
        where,
        orderBy: { requestedAt: 'desc' },
        skip,
        take: Number(limit),
      }),
      prisma.contentApproval.count({ where }),
    ]);

    // 콘텐츠 + 유저 정보 조인
    const contentIds = [...new Set(items.map(a => a.contentId))];
    const userIds = [...new Set([
      ...items.map(a => a.requestedBy),
      ...items.filter(a => a.reviewedBy).map(a => a.reviewedBy),
    ])];

    const [contents, users] = await Promise.all([
      prisma.content.findMany({
        where: { id: { in: contentIds } },
        select: { id: true, name: true, type: true, thumbnail: true, filePath: true },
      }),
      prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, username: true },
      }),
    ]);

    const contentMap = Object.fromEntries(contents.map(c => [c.id, c]));
    const userMap = Object.fromEntries(users.map(u => [u.id, u]));

    const enriched = items.map(item => ({
      ...item,
      content: contentMap[item.contentId] || null,
      requester: userMap[item.requestedBy] || null,
      reviewer: item.reviewedBy ? (userMap[item.reviewedBy] || null) : null,
    }));

    res.json({
      items: enriched,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    logger.error('Get approvals error', { error });
    res.status(500).json({ error: '승인 목록 조회에 실패했습니다.' });
  }
};

/**
 * PUT /api/approvals/:id/approve
 * 승인 처리
 */
const approveContent = async (req, res) => {
  try {
    const { id } = req.params;
    const { comment } = req.body;

    // Verify approval exists, belongs to tenant, and is pending
    const existing = await prisma.contentApproval.findUnique({
      where: { id },
      include: { content: { select: { tenantId: true } } }
    });
    if (!existing) return res.status(404).json({ error: '승인 요청을 찾을 수 없습니다' });
    if (!verifyTenantOwnership(existing.content, req)) {
      return res.status(403).json({ error: '접근 권한이 없습니다' });
    }
    if (existing.status !== 'PENDING') {
      return res.status(400).json({ error: '이미 처리된 승인 요청입니다' });
    }

    const approval = await prisma.contentApproval.update({
      where: { id },
      data: {
        status: 'APPROVED',
        reviewedBy: req.user.id,
        reviewedAt: new Date(),
        comment: comment || undefined,
      },
    });

    // 콘텐츠 활성화
    await prisma.content.update({
      where: { id: approval.contentId },
      data: { isActive: true },
    });

    logger.info('Content approved', { approvalId: id, contentId: approval.contentId });
    res.json(approval);
  } catch (error) {
    logger.error('Approve content error', { error });
    res.status(500).json({ error: '승인 처리에 실패했습니다.' });
  }
};

/**
 * PUT /api/approvals/:id/reject
 * 거부 처리
 */
const rejectContent = async (req, res) => {
  try {
    const { id } = req.params;
    const { comment } = req.body;

    if (!comment) {
      return res.status(400).json({ error: '거부 사유를 입력해주세요.' });
    }

    // Verify approval exists, belongs to tenant, and is pending
    const existing = await prisma.contentApproval.findUnique({
      where: { id },
      include: { content: { select: { tenantId: true } } }
    });
    if (!existing) return res.status(404).json({ error: '승인 요청을 찾을 수 없습니다' });
    if (!verifyTenantOwnership(existing.content, req)) {
      return res.status(403).json({ error: '접근 권한이 없습니다' });
    }
    if (existing.status !== 'PENDING') {
      return res.status(400).json({ error: '이미 처리된 승인 요청입니다' });
    }

    const approval = await prisma.contentApproval.update({
      where: { id },
      data: {
        status: 'REJECTED',
        reviewedBy: req.user.id,
        reviewedAt: new Date(),
        comment,
      },
    });

    logger.info('Content rejected', { approvalId: id, contentId: approval.contentId });
    res.json(approval);
  } catch (error) {
    logger.error('Reject content error', { error });
    res.status(500).json({ error: '거부 처리에 실패했습니다.' });
  }
};

module.exports = {
  requestApproval,
  getApprovals,
  approveContent,
  rejectContent,
};
