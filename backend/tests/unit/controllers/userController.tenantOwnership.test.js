/**
 * Regression guard for userController tenant ownership checks
 *
 * Bug background:
 *   getUserById / updateUser / deleteUser used a three-part guard:
 *     req.user.role !== 'SUPER_ADMIN' && req.tenantId && user.tenantId !== req.tenantId
 *   This allowed a SUPER_ADMIN who sent X-Tenant-Id="A" to read/write tenant-B resources,
 *   but also incorrectly 403'd a SUPER_ADMIN without X-Tenant-Id (req.tenantId = null).
 *
 *   Fix: route through verifyTenantOwnership(resource, req) which handles:
 *     - SUPER_ADMIN with no tenantId → always passes
 *     - SUPER_ADMIN with tenantId="A" → scoped to tenant A (behavior change, intentional)
 *     - TENANT_ADMIN → strict same-tenant match
 *
 * These tests pin the corrected behaviour for all three sites.
 */

jest.mock('../../../src/utils/prisma', () => ({
  user: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
}));

const prisma = require('../../../src/utils/prisma');
const {
  getUserById,
  updateUser,
  deleteUser,
} = require('../../../src/controllers/userController');

function mockRes() {
  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      res.statusCode = code;
      return res;
    },
    json(data) {
      res.body = data;
      return res;
    },
  };
  return res;
}

const SUPER_ADMIN = { id: 'sa-1', role: 'SUPER_ADMIN', tenantId: 'default-tenant' };
const TENANT_ADMIN_A = { id: 'ta-1', role: 'TENANT_ADMIN', tenantId: 'tenant-A' };
const TENANT_ADMIN_B = { id: 'ta-2', role: 'TENANT_ADMIN', tenantId: 'tenant-B' };

const USER_A = { id: 'user-A', username: 'alice', email: 'alice@a.com', role: 'USER', tenantId: 'tenant-A' };

beforeEach(() => {
  jest.clearAllMocks();
});

describe('userController tenant ownership (verifyTenantOwnership)', () => {
  describe('getUserById', () => {
    it('SUPER_ADMIN without X-Tenant-Id can read any tenant user (regression guard)', async () => {
      prisma.user.findUnique.mockResolvedValueOnce(USER_A);

      const req = { params: { id: 'user-A' }, user: SUPER_ADMIN, tenantId: null };
      const res = mockRes();

      await getUserById(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body).toMatchObject({ id: 'user-A' });
    });

    it('same-tenant TENANT_ADMIN can read their own user', async () => {
      prisma.user.findUnique.mockResolvedValueOnce(USER_A);

      const req = { params: { id: 'user-A' }, user: TENANT_ADMIN_A, tenantId: 'tenant-A' };
      const res = mockRes();

      await getUserById(req, res);

      expect(res.statusCode).toBe(200);
    });

    it('cross-tenant TENANT_ADMIN is denied with 403', async () => {
      prisma.user.findUnique.mockResolvedValueOnce(USER_A);

      const req = { params: { id: 'user-A' }, user: TENANT_ADMIN_B, tenantId: 'tenant-B' };
      const res = mockRes();

      await getUserById(req, res);

      expect(res.statusCode).toBe(403);
      expect(res.body).toEqual({ error: '접근 권한이 없습니다' });
    });

    it('returns 404 when user does not exist', async () => {
      prisma.user.findUnique.mockResolvedValueOnce(null);

      const req = { params: { id: 'missing' }, user: SUPER_ADMIN, tenantId: null };
      const res = mockRes();

      await getUserById(req, res);

      expect(res.statusCode).toBe(404);
    });
  });

  describe('updateUser', () => {
    it('SUPER_ADMIN without X-Tenant-Id can update any tenant user (regression guard)', async () => {
      prisma.user.findUnique.mockResolvedValueOnce(USER_A);
      prisma.user.update.mockResolvedValueOnce({ ...USER_A, username: 'alice2' });

      const req = {
        params: { id: 'user-A' },
        body: { username: 'alice2' },
        user: SUPER_ADMIN,
        tenantId: null,
      };
      const res = mockRes();

      await updateUser(req, res);

      expect(res.statusCode).toBe(200);
      expect(prisma.user.update).toHaveBeenCalled();
    });

    it('same-tenant TENANT_ADMIN can update their own user', async () => {
      prisma.user.findUnique.mockResolvedValueOnce(USER_A);
      prisma.user.update.mockResolvedValueOnce(USER_A);

      const req = {
        params: { id: 'user-A' },
        body: { username: 'alice' },
        user: TENANT_ADMIN_A,
        tenantId: 'tenant-A',
      };
      const res = mockRes();

      await updateUser(req, res);

      expect(res.statusCode).toBe(200);
    });

    it('cross-tenant TENANT_ADMIN cannot update and gets 403', async () => {
      prisma.user.findUnique.mockResolvedValueOnce(USER_A);

      const req = {
        params: { id: 'user-A' },
        body: { username: 'hacked' },
        user: TENANT_ADMIN_B,
        tenantId: 'tenant-B',
      };
      const res = mockRes();

      await updateUser(req, res);

      expect(res.statusCode).toBe(403);
      expect(res.body).toEqual({ error: '접근 권한이 없습니다' });
      expect(prisma.user.update).not.toHaveBeenCalled();
    });
  });

  describe('deleteUser', () => {
    it('SUPER_ADMIN without X-Tenant-Id can soft-delete any tenant user (regression guard)', async () => {
      prisma.user.findUnique.mockResolvedValueOnce(USER_A);
      prisma.user.update.mockResolvedValueOnce({ ...USER_A, isActive: false });

      const req = {
        params: { id: 'user-A' },
        user: SUPER_ADMIN,
        tenantId: null,
      };
      const res = mockRes();

      await deleteUser(req, res);

      expect(res.statusCode).toBe(200);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-A' },
        data: { isActive: false },
      });
    });

    it('same-tenant TENANT_ADMIN can delete their user', async () => {
      prisma.user.findUnique.mockResolvedValueOnce(USER_A);
      prisma.user.update.mockResolvedValueOnce({ ...USER_A, isActive: false });

      const req = {
        params: { id: 'user-A' },
        user: TENANT_ADMIN_A,
        tenantId: 'tenant-A',
      };
      const res = mockRes();

      await deleteUser(req, res);

      expect(res.statusCode).toBe(200);
    });

    it('cross-tenant TENANT_ADMIN cannot delete and gets 403', async () => {
      prisma.user.findUnique.mockResolvedValueOnce(USER_A);

      const req = {
        params: { id: 'user-A' },
        user: TENANT_ADMIN_B,
        tenantId: 'tenant-B',
      };
      const res = mockRes();

      await deleteUser(req, res);

      expect(res.statusCode).toBe(403);
      expect(res.body).toEqual({ error: '접근 권한이 없습니다' });
      expect(prisma.user.update).not.toHaveBeenCalled();
    });
  });
});
