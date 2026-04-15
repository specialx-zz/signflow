/**
 * Regression guard for screenWallController tenant ownership checks
 *
 * Bug background:
 *   updateScreenWall / deleteScreenWall / deleteSyncGroup compared
 *   `resource.tenantId !== req.tenantId` directly. This breaks for
 *   SUPER_ADMIN: tenantContext middleware sets req.tenantId = null when
 *   no X-Tenant-Id header is sent (meaning "all tenants"), so the strict
 *   comparison rejects the SUPER_ADMIN with 403 "권한이 없습니다" on
 *   resources that legitimately belong to a tenant.
 *
 *   Fix: route through verifyTenantOwnership(resource, req) which already
 *   handles the SUPER_ADMIN-without-tenant case (passes through).
 *
 * These tests pin the corrected behaviour for all three sites.
 */

jest.mock('../../../src/utils/prisma', () => ({
  screenWall: {
    findUnique: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  syncGroup: {
    findUnique: jest.fn(),
    delete: jest.fn(),
  },
}));

const prisma = require('../../../src/utils/prisma');
const {
  updateScreenWall,
  deleteScreenWall,
  deleteSyncGroup,
} = require('../../../src/controllers/screenWallController');

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

const WALL_A = { id: 'wall-A', name: 'Lobby', tenantId: 'tenant-A' };
const GROUP_A = { id: 'group-A', name: 'Sync', tenantId: 'tenant-A' };

beforeEach(() => {
  jest.clearAllMocks();
});

describe('screenWallController tenant ownership (verifyTenantOwnership)', () => {
  describe('deleteScreenWall', () => {
    it('SUPER_ADMIN without X-Tenant-Id can delete any tenant\'s wall', async () => {
      // Reproduces the original bug: req.tenantId = null for SUPER_ADMIN
      // who did not send X-Tenant-Id header. Must NOT 403.
      prisma.screenWall.findUnique.mockResolvedValueOnce(WALL_A);
      prisma.screenWall.delete.mockResolvedValueOnce(WALL_A);

      const req = {
        params: { id: 'wall-A' },
        user: SUPER_ADMIN,
        tenantId: null,
      };
      const res = mockRes();

      await deleteScreenWall(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({ message: '스크린 월이 삭제되었습니다' });
      expect(prisma.screenWall.delete).toHaveBeenCalledWith({ where: { id: 'wall-A' } });
    });

    it('TENANT_ADMIN can delete a wall belonging to their own tenant', async () => {
      prisma.screenWall.findUnique.mockResolvedValueOnce(WALL_A);
      prisma.screenWall.delete.mockResolvedValueOnce(WALL_A);

      const req = {
        params: { id: 'wall-A' },
        user: TENANT_ADMIN_A,
        tenantId: 'tenant-A',
      };
      const res = mockRes();

      await deleteScreenWall(req, res);

      expect(res.statusCode).toBe(200);
      expect(prisma.screenWall.delete).toHaveBeenCalled();
    });

    it('TENANT_ADMIN cannot delete a wall belonging to a different tenant', async () => {
      prisma.screenWall.findUnique.mockResolvedValueOnce(WALL_A);

      const req = {
        params: { id: 'wall-A' },
        user: TENANT_ADMIN_B,
        tenantId: 'tenant-B',
      };
      const res = mockRes();

      await deleteScreenWall(req, res);

      expect(res.statusCode).toBe(403);
      expect(res.body).toEqual({ error: '권한이 없습니다' });
      expect(prisma.screenWall.delete).not.toHaveBeenCalled();
    });

    it('returns 404 when the wall does not exist', async () => {
      prisma.screenWall.findUnique.mockResolvedValueOnce(null);

      const req = {
        params: { id: 'missing' },
        user: SUPER_ADMIN,
        tenantId: null,
      };
      const res = mockRes();

      await deleteScreenWall(req, res);

      expect(res.statusCode).toBe(404);
    });
  });

  describe('updateScreenWall', () => {
    it('SUPER_ADMIN without X-Tenant-Id can update any tenant\'s wall', async () => {
      prisma.screenWall.findUnique.mockResolvedValueOnce(WALL_A);
      prisma.screenWall.update.mockResolvedValueOnce({ ...WALL_A, name: 'Renamed' });

      const req = {
        params: { id: 'wall-A' },
        body: { name: 'Renamed' },
        user: SUPER_ADMIN,
        tenantId: null,
      };
      const res = mockRes();

      await updateScreenWall(req, res);

      expect(res.statusCode).toBe(200);
      expect(prisma.screenWall.update).toHaveBeenCalled();
    });

    it('rejects cross-tenant update with 403', async () => {
      prisma.screenWall.findUnique.mockResolvedValueOnce(WALL_A);

      const req = {
        params: { id: 'wall-A' },
        body: { name: 'Hijacked' },
        user: TENANT_ADMIN_B,
        tenantId: 'tenant-B',
      };
      const res = mockRes();

      await updateScreenWall(req, res);

      expect(res.statusCode).toBe(403);
      expect(prisma.screenWall.update).not.toHaveBeenCalled();
    });
  });

  describe('deleteSyncGroup', () => {
    it('SUPER_ADMIN without X-Tenant-Id can delete any tenant\'s sync group', async () => {
      prisma.syncGroup.findUnique.mockResolvedValueOnce(GROUP_A);
      prisma.syncGroup.delete.mockResolvedValueOnce(GROUP_A);

      const req = {
        params: { id: 'group-A' },
        user: SUPER_ADMIN,
        tenantId: null,
      };
      const res = mockRes();

      await deleteSyncGroup(req, res);

      expect(res.statusCode).toBe(200);
      expect(prisma.syncGroup.delete).toHaveBeenCalled();
    });

    it('rejects cross-tenant sync group delete with 403', async () => {
      prisma.syncGroup.findUnique.mockResolvedValueOnce(GROUP_A);

      const req = {
        params: { id: 'group-A' },
        user: TENANT_ADMIN_B,
        tenantId: 'tenant-B',
      };
      const res = mockRes();

      await deleteSyncGroup(req, res);

      expect(res.statusCode).toBe(403);
      expect(prisma.syncGroup.delete).not.toHaveBeenCalled();
    });
  });
});
