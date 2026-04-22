/**
 * Regression guard for contentController tenant ownership checks.
 *
 * Bug: getContentById / updateContent / deleteContent / disableContent /
 * enableContent compared content.tenantId !== req.tenantId directly, which
 * incorrectly 403s SUPER_ADMIN when req.tenantId is null (no X-Tenant-Id
 * header). Fix routes through verifyTenantOwnership(content, req).
 */

jest.mock('../../../src/utils/prisma', () => ({
  content: {
    findUnique: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  playlistItem: { deleteMany: jest.fn() },
  auditLog: { create: jest.fn() },
}));

jest.mock('../../../src/utils/storage', () => ({
  getFileUrl: jest.fn(),
  uploadFile: jest.fn(),
  deleteFile: jest.fn(),
}));

const prisma = require('../../../src/utils/prisma');
const {
  getContentById,
  updateContent,
  deleteContent,
} = require('../../../src/controllers/contentController');

function mockRes() {
  const res = {
    statusCode: 200,
    body: null,
    status(code) { res.statusCode = code; return res; },
    json(data) { res.body = data; return res; },
  };
  return res;
}

const SUPER_ADMIN   = { id: 'sa-1', role: 'SUPER_ADMIN',  tenantId: 'default-tenant' };
const TENANT_ADMIN_A = { id: 'ta-1', role: 'TENANT_ADMIN', tenantId: 'tenant-A' };
const TENANT_ADMIN_B = { id: 'tb-1', role: 'TENANT_ADMIN', tenantId: 'tenant-B' };

const CONTENT_A = {
  id: 'cnt-A', name: 'banner.jpg', type: 'IMAGE',
  tenantId: 'tenant-A', isActive: true, storageType: 'local', filePath: '/files/banner.jpg',
};

beforeEach(() => jest.clearAllMocks());

// ---------------------------------------------------------------------------
describe('contentController tenant ownership (verifyTenantOwnership)', () => {
  // ── getContentById ───────────────────────────────────────────────────────
  describe('getContentById', () => {
    it('SUPER_ADMIN without X-Tenant-Id can access any tenant content', async () => {
      prisma.content.findUnique.mockResolvedValueOnce(CONTENT_A);

      const req = { params: { id: 'cnt-A' }, user: SUPER_ADMIN, tenantId: null };
      const res = mockRes();

      await getContentById(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body).toMatchObject({ id: 'cnt-A' });
    });

    it('same-tenant TENANT_ADMIN can access their own content', async () => {
      prisma.content.findUnique.mockResolvedValueOnce(CONTENT_A);

      const req = { params: { id: 'cnt-A' }, user: TENANT_ADMIN_A, tenantId: 'tenant-A' };
      const res = mockRes();

      await getContentById(req, res);

      expect(res.statusCode).toBe(200);
    });

    it('cross-tenant TENANT_ADMIN is rejected with 403', async () => {
      prisma.content.findUnique.mockResolvedValueOnce(CONTENT_A);

      const req = { params: { id: 'cnt-A' }, user: TENANT_ADMIN_B, tenantId: 'tenant-B' };
      const res = mockRes();

      await getContentById(req, res);

      expect(res.statusCode).toBe(403);
      expect(res.body).toEqual({ error: '접근 권한이 없습니다' });
    });

    it('returns 404 when content does not exist', async () => {
      prisma.content.findUnique.mockResolvedValueOnce(null);

      const req = { params: { id: 'missing' }, user: SUPER_ADMIN, tenantId: null };
      const res = mockRes();

      await getContentById(req, res);

      expect(res.statusCode).toBe(404);
    });
  });

  // ── updateContent ────────────────────────────────────────────────────────
  describe('updateContent', () => {
    it('SUPER_ADMIN without X-Tenant-Id can update any tenant content', async () => {
      prisma.content.findUnique.mockResolvedValueOnce(CONTENT_A);
      prisma.content.update.mockResolvedValueOnce({ ...CONTENT_A, name: 'renamed.jpg' });

      const req = {
        params: { id: 'cnt-A' },
        body: { name: 'renamed.jpg' },
        user: SUPER_ADMIN,
        tenantId: null,
      };
      const res = mockRes();

      await updateContent(req, res);

      expect(res.statusCode).toBe(200);
      expect(prisma.content.update).toHaveBeenCalled();
    });

    it('same-tenant TENANT_ADMIN can update their own content', async () => {
      prisma.content.findUnique.mockResolvedValueOnce(CONTENT_A);
      prisma.content.update.mockResolvedValueOnce({ ...CONTENT_A, name: 'updated.jpg' });

      const req = {
        params: { id: 'cnt-A' },
        body: { name: 'updated.jpg' },
        user: TENANT_ADMIN_A,
        tenantId: 'tenant-A',
      };
      const res = mockRes();

      await updateContent(req, res);

      expect(res.statusCode).toBe(200);
    });

    it('cross-tenant TENANT_ADMIN is rejected with 403', async () => {
      prisma.content.findUnique.mockResolvedValueOnce(CONTENT_A);

      const req = {
        params: { id: 'cnt-A' },
        body: { name: 'evil.jpg' },
        user: TENANT_ADMIN_B,
        tenantId: 'tenant-B',
      };
      const res = mockRes();

      await updateContent(req, res);

      expect(res.statusCode).toBe(403);
      expect(res.body).toEqual({ error: '접근 권한이 없습니다' });
      expect(prisma.content.update).not.toHaveBeenCalled();
    });

    it('returns 404 when content does not exist', async () => {
      prisma.content.findUnique.mockResolvedValueOnce(null);

      const req = {
        params: { id: 'missing' },
        body: { name: 'x' },
        user: SUPER_ADMIN,
        tenantId: null,
      };
      const res = mockRes();

      await updateContent(req, res);

      expect(res.statusCode).toBe(404);
    });
  });

  // ── deleteContent ────────────────────────────────────────────────────────
  describe('deleteContent', () => {
    it('SUPER_ADMIN without X-Tenant-Id can delete any tenant content', async () => {
      prisma.content.findUnique.mockResolvedValueOnce(CONTENT_A);
      prisma.playlistItem.deleteMany.mockResolvedValueOnce({});
      prisma.content.update.mockResolvedValueOnce({});
      prisma.auditLog.create.mockResolvedValueOnce({});

      const req = { params: { id: 'cnt-A' }, user: SUPER_ADMIN, tenantId: null };
      const res = mockRes();

      await deleteContent(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({ message: 'Content deleted successfully' });
    });

    it('cross-tenant TENANT_ADMIN is rejected with 403', async () => {
      prisma.content.findUnique.mockResolvedValueOnce(CONTENT_A);

      const req = { params: { id: 'cnt-A' }, user: TENANT_ADMIN_B, tenantId: 'tenant-B' };
      const res = mockRes();

      await deleteContent(req, res);

      expect(res.statusCode).toBe(403);
      expect(res.body).toEqual({ error: '접근 권한이 없습니다' });
      expect(prisma.content.update).not.toHaveBeenCalled();
    });
  });
});
