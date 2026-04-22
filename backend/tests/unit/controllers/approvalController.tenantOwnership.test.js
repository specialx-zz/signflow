/**
 * Regression guard for approvalController tenant ownership checks.
 *
 * Bug background:
 *   approveContent / rejectContent compared
 *   `existing.content?.tenantId !== req.tenantId` with a `req.tenantId &&` guard.
 *   When SUPER_ADMIN has no X-Tenant-Id header, req.tenantId = null, so the
 *   guard short-circuits — but only in the buggy direction: the guard was
 *   truthy for TENANT_ADMIN and falsy for SUPER_ADMIN, letting the wrong cases
 *   through. Fix: verifyTenantOwnership(existing.content, req) handles the
 *   SUPER_ADMIN-without-tenant case correctly (always passes through).
 */

jest.mock('../../../src/utils/prisma', () => ({
  content: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  contentApproval: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
    findMany: jest.fn(),
  },
  user: {
    findMany: jest.fn(),
  },
}));

jest.mock('../../../src/utils/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

const prisma = require('../../../src/utils/prisma');
const { approveContent, rejectContent } = require('../../../src/controllers/approvalController');

function mockRes() {
  const res = {
    statusCode: 200,
    body: null,
    status(code) { res.statusCode = code; return res; },
    json(data) { res.body = data; return res; },
  };
  return res;
}

const SUPER_ADMIN = { id: 'sa-1', role: 'SUPER_ADMIN', tenantId: 'default-tenant' };
const TENANT_ADMIN_A = { id: 'ta-1', role: 'TENANT_ADMIN', tenantId: 'tenant-A' };
const TENANT_ADMIN_B = { id: 'ta-2', role: 'TENANT_ADMIN', tenantId: 'tenant-B' };

// Approval record: the nested content carries the tenantId
const APPROVAL_A = {
  id: 'approval-1',
  contentId: 'content-1',
  status: 'PENDING',
  content: { tenantId: 'tenant-A' },
};

const APPROVED_RESULT = { ...APPROVAL_A, status: 'APPROVED', reviewedBy: 'sa-1', contentId: 'content-1' };
const REJECTED_RESULT = { ...APPROVAL_A, status: 'REJECTED', reviewedBy: 'ta-1', contentId: 'content-1' };

beforeEach(() => {
  jest.clearAllMocks();
});

// ── approveContent ────────────────────────────────────────────────────────────

describe('approvalController tenant ownership (verifyTenantOwnership)', () => {
  describe('approveContent', () => {
    it('SUPER_ADMIN without X-Tenant-Id can approve any tenant approval', async () => {
      prisma.contentApproval.findUnique.mockResolvedValueOnce(APPROVAL_A);
      prisma.contentApproval.update.mockResolvedValueOnce(APPROVED_RESULT);
      prisma.content.update.mockResolvedValueOnce({});

      const req = {
        params: { id: 'approval-1' },
        body: {},
        user: SUPER_ADMIN,
        tenantId: null,
      };
      const res = mockRes();

      await approveContent(req, res);

      expect(res.statusCode).toBe(200);
      expect(prisma.contentApproval.update).toHaveBeenCalled();
    });

    it('same-tenant TENANT_ADMIN can approve their own tenant approval', async () => {
      prisma.contentApproval.findUnique.mockResolvedValueOnce(APPROVAL_A);
      prisma.contentApproval.update.mockResolvedValueOnce(APPROVED_RESULT);
      prisma.content.update.mockResolvedValueOnce({});

      const req = {
        params: { id: 'approval-1' },
        body: {},
        user: TENANT_ADMIN_A,
        tenantId: 'tenant-A',
      };
      const res = mockRes();

      await approveContent(req, res);

      expect(res.statusCode).toBe(200);
      expect(prisma.contentApproval.update).toHaveBeenCalled();
    });

    it('cross-tenant TENANT_ADMIN is rejected with 403', async () => {
      prisma.contentApproval.findUnique.mockResolvedValueOnce(APPROVAL_A);

      const req = {
        params: { id: 'approval-1' },
        body: {},
        user: TENANT_ADMIN_B,
        tenantId: 'tenant-B',
      };
      const res = mockRes();

      await approveContent(req, res);

      expect(res.statusCode).toBe(403);
      expect(res.body).toEqual({ error: '접근 권한이 없습니다' });
      expect(prisma.contentApproval.update).not.toHaveBeenCalled();
    });

    it('returns 404 when approval does not exist', async () => {
      prisma.contentApproval.findUnique.mockResolvedValueOnce(null);

      const req = {
        params: { id: 'missing' },
        body: {},
        user: SUPER_ADMIN,
        tenantId: null,
      };
      const res = mockRes();

      await approveContent(req, res);

      expect(res.statusCode).toBe(404);
    });
  });

  // ── rejectContent ───────────────────────────────────────────────────────────

  describe('rejectContent', () => {
    it('SUPER_ADMIN without X-Tenant-Id can reject any tenant approval', async () => {
      prisma.contentApproval.findUnique.mockResolvedValueOnce(APPROVAL_A);
      prisma.contentApproval.update.mockResolvedValueOnce(REJECTED_RESULT);

      const req = {
        params: { id: 'approval-1' },
        body: { comment: 'Not acceptable' },
        user: SUPER_ADMIN,
        tenantId: null,
      };
      const res = mockRes();

      await rejectContent(req, res);

      expect(res.statusCode).toBe(200);
      expect(prisma.contentApproval.update).toHaveBeenCalled();
    });

    it('same-tenant TENANT_ADMIN can reject their own tenant approval', async () => {
      prisma.contentApproval.findUnique.mockResolvedValueOnce(APPROVAL_A);
      prisma.contentApproval.update.mockResolvedValueOnce(REJECTED_RESULT);

      const req = {
        params: { id: 'approval-1' },
        body: { comment: 'Needs revision' },
        user: TENANT_ADMIN_A,
        tenantId: 'tenant-A',
      };
      const res = mockRes();

      await rejectContent(req, res);

      expect(res.statusCode).toBe(200);
    });

    it('cross-tenant TENANT_ADMIN is rejected with 403', async () => {
      prisma.contentApproval.findUnique.mockResolvedValueOnce(APPROVAL_A);

      const req = {
        params: { id: 'approval-1' },
        body: { comment: 'Unauthorized' },
        user: TENANT_ADMIN_B,
        tenantId: 'tenant-B',
      };
      const res = mockRes();

      await rejectContent(req, res);

      expect(res.statusCode).toBe(403);
      expect(res.body).toEqual({ error: '접근 권한이 없습니다' });
      expect(prisma.contentApproval.update).not.toHaveBeenCalled();
    });

    it('returns 404 when approval does not exist', async () => {
      prisma.contentApproval.findUnique.mockResolvedValueOnce(null);

      const req = {
        params: { id: 'missing' },
        body: { comment: 'irrelevant' },
        user: SUPER_ADMIN,
        tenantId: null,
      };
      const res = mockRes();

      await rejectContent(req, res);

      expect(res.statusCode).toBe(404);
    });
  });
});
