/**
 * Regression guard for fontController tenant ownership check in deleteFont.
 *
 * Bug background:
 *   deleteFont used a bare `font.tenantId !== req.tenantId` comparison —
 *   no guard at all. For SUPER_ADMIN with req.tenantId = null this always
 *   evaluates to true (null !== 'tenant-A'), producing an incorrect 403.
 *
 *   Fix: verifyTenantOwnership(font, req) returns true for SUPER_ADMIN
 *   without a tenant context, allowing the operation to proceed.
 */

jest.mock('../../../src/utils/prisma', () => ({
  customFont: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
}));

const prisma = require('../../../src/utils/prisma');
const { deleteFont } = require('../../../src/controllers/fontController');

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

const FONT_A = {
  id: 'font-1',
  name: 'Custom Sans',
  family: 'CustomSans',
  tenantId: 'tenant-A',
  isActive: true,
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('fontController tenant ownership (verifyTenantOwnership)', () => {
  describe('deleteFont', () => {
    it('SUPER_ADMIN without X-Tenant-Id can delete any tenant font', async () => {
      // Regression: the old bare comparison `font.tenantId !== req.tenantId`
      // with req.tenantId = null would always be true → incorrect 403.
      prisma.customFont.findUnique.mockResolvedValueOnce(FONT_A);
      prisma.customFont.update.mockResolvedValueOnce({ ...FONT_A, isActive: false });

      const req = {
        params: { id: 'font-1' },
        user: SUPER_ADMIN,
        tenantId: null,
      };
      const res = mockRes();

      await deleteFont(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({ message: '폰트가 삭제되었습니다' });
      expect(prisma.customFont.update).toHaveBeenCalledWith({
        where: { id: 'font-1' },
        data: { isActive: false },
      });
    });

    it('same-tenant TENANT_ADMIN can delete their own font', async () => {
      prisma.customFont.findUnique.mockResolvedValueOnce(FONT_A);
      prisma.customFont.update.mockResolvedValueOnce({ ...FONT_A, isActive: false });

      const req = {
        params: { id: 'font-1' },
        user: TENANT_ADMIN_A,
        tenantId: 'tenant-A',
      };
      const res = mockRes();

      await deleteFont(req, res);

      expect(res.statusCode).toBe(200);
      expect(prisma.customFont.update).toHaveBeenCalled();
    });

    it('cross-tenant TENANT_ADMIN is rejected with 403', async () => {
      prisma.customFont.findUnique.mockResolvedValueOnce(FONT_A);

      const req = {
        params: { id: 'font-1' },
        user: TENANT_ADMIN_B,
        tenantId: 'tenant-B',
      };
      const res = mockRes();

      await deleteFont(req, res);

      expect(res.statusCode).toBe(403);
      expect(res.body).toEqual({ error: '권한이 없습니다' });
      expect(prisma.customFont.update).not.toHaveBeenCalled();
    });

    it('returns 404 when font does not exist', async () => {
      prisma.customFont.findUnique.mockResolvedValueOnce(null);

      const req = {
        params: { id: 'missing' },
        user: SUPER_ADMIN,
        tenantId: null,
      };
      const res = mockRes();

      await deleteFont(req, res);

      expect(res.statusCode).toBe(404);
      expect(res.body).toEqual({ error: '폰트를 찾을 수 없습니다' });
    });
  });
});
