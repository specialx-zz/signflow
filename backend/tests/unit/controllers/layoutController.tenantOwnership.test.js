/**
 * Regression guard for layoutController tenant ownership checks
 *
 * Bug background:
 *   getLayoutById / updateLayout / deleteLayout / saveZones compared
 *   `req.tenantId && layout.tenantId !== req.tenantId` directly. This breaks
 *   for SUPER_ADMIN: tenantContext middleware sets req.tenantId = null when no
 *   X-Tenant-Id header is sent, causing incorrect 403s.
 *
 *   Fix: route through verifyTenantOwnership(resource, req) which correctly
 *   handles the SUPER_ADMIN-without-tenant case.
 *
 * These tests pin the corrected behaviour for all four sites.
 */

jest.mock('../../../src/utils/prisma', () => ({
  layout: {
    findUnique: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  layoutZone: {
    deleteMany: jest.fn(),
    create: jest.fn(),
  },
}));

const prisma = require('../../../src/utils/prisma');
const {
  getLayoutById,
  updateLayout,
  deleteLayout,
  saveZones,
} = require('../../../src/controllers/layoutController');

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

const LAYOUT_A = {
  id: 'layout-A',
  name: 'Lobby Layout',
  tenantId: 'tenant-A',
  zones: [],
  creator: { username: 'alice' },
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('layoutController tenant ownership (verifyTenantOwnership)', () => {
  describe('getLayoutById', () => {
    it('SUPER_ADMIN without X-Tenant-Id can read any tenant layout (regression guard)', async () => {
      prisma.layout.findUnique.mockResolvedValueOnce(LAYOUT_A);

      const req = { params: { id: 'layout-A' }, user: SUPER_ADMIN, tenantId: null };
      const res = mockRes();

      await getLayoutById(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body).toMatchObject({ id: 'layout-A' });
    });

    it('same-tenant TENANT_ADMIN can read their layout', async () => {
      prisma.layout.findUnique.mockResolvedValueOnce(LAYOUT_A);

      const req = { params: { id: 'layout-A' }, user: TENANT_ADMIN_A, tenantId: 'tenant-A' };
      const res = mockRes();

      await getLayoutById(req, res);

      expect(res.statusCode).toBe(200);
    });

    it('cross-tenant TENANT_ADMIN is denied with 403', async () => {
      prisma.layout.findUnique.mockResolvedValueOnce(LAYOUT_A);

      const req = { params: { id: 'layout-A' }, user: TENANT_ADMIN_B, tenantId: 'tenant-B' };
      const res = mockRes();

      await getLayoutById(req, res);

      expect(res.statusCode).toBe(403);
      expect(res.body).toEqual({ error: '접근 권한이 없습니다' });
    });

    it('returns 404 when layout does not exist', async () => {
      prisma.layout.findUnique.mockResolvedValueOnce(null);

      const req = { params: { id: 'missing' }, user: SUPER_ADMIN, tenantId: null };
      const res = mockRes();

      await getLayoutById(req, res);

      expect(res.statusCode).toBe(404);
    });
  });

  describe('updateLayout', () => {
    it('SUPER_ADMIN without X-Tenant-Id can update any tenant layout (regression guard)', async () => {
      prisma.layout.findUnique.mockResolvedValueOnce(LAYOUT_A);
      prisma.layout.update.mockResolvedValueOnce({ ...LAYOUT_A, name: 'Renamed' });

      const req = {
        params: { id: 'layout-A' },
        body: { name: 'Renamed' },
        user: SUPER_ADMIN,
        tenantId: null,
      };
      const res = mockRes();

      await updateLayout(req, res);

      expect(res.statusCode).toBe(200);
      expect(prisma.layout.update).toHaveBeenCalled();
    });

    it('same-tenant TENANT_ADMIN can update their layout', async () => {
      prisma.layout.findUnique.mockResolvedValueOnce(LAYOUT_A);
      prisma.layout.update.mockResolvedValueOnce(LAYOUT_A);

      const req = {
        params: { id: 'layout-A' },
        body: { name: 'Updated' },
        user: TENANT_ADMIN_A,
        tenantId: 'tenant-A',
      };
      const res = mockRes();

      await updateLayout(req, res);

      expect(res.statusCode).toBe(200);
    });

    it('cross-tenant TENANT_ADMIN cannot update and gets 403', async () => {
      prisma.layout.findUnique.mockResolvedValueOnce(LAYOUT_A);

      const req = {
        params: { id: 'layout-A' },
        body: { name: 'Hijacked' },
        user: TENANT_ADMIN_B,
        tenantId: 'tenant-B',
      };
      const res = mockRes();

      await updateLayout(req, res);

      expect(res.statusCode).toBe(403);
      expect(res.body).toEqual({ error: '접근 권한이 없습니다' });
      expect(prisma.layout.update).not.toHaveBeenCalled();
    });
  });

  describe('deleteLayout', () => {
    it('SUPER_ADMIN without X-Tenant-Id can delete any tenant layout (regression guard)', async () => {
      prisma.layout.findUnique.mockResolvedValueOnce(LAYOUT_A);
      prisma.layout.update.mockResolvedValueOnce({ ...LAYOUT_A, isActive: false });

      const req = { params: { id: 'layout-A' }, user: SUPER_ADMIN, tenantId: null };
      const res = mockRes();

      await deleteLayout(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({ success: true });
    });

    it('cross-tenant TENANT_ADMIN cannot delete and gets 403', async () => {
      prisma.layout.findUnique.mockResolvedValueOnce(LAYOUT_A);

      const req = { params: { id: 'layout-A' }, user: TENANT_ADMIN_B, tenantId: 'tenant-B' };
      const res = mockRes();

      await deleteLayout(req, res);

      expect(res.statusCode).toBe(403);
      expect(prisma.layout.update).not.toHaveBeenCalled();
    });
  });

  describe('saveZones', () => {
    it('SUPER_ADMIN without X-Tenant-Id can save zones for any tenant layout (regression guard)', async () => {
      prisma.layout.findUnique.mockResolvedValueOnce(LAYOUT_A);
      prisma.layoutZone.deleteMany.mockResolvedValueOnce({});
      prisma.layoutZone.create.mockResolvedValueOnce({ id: 'zone-1' });

      const req = {
        params: { id: 'layout-A' },
        body: { zones: [{ name: 'Zone 1', x: 0, y: 0, width: 50, height: 50 }] },
        user: SUPER_ADMIN,
        tenantId: null,
      };
      const res = mockRes();

      await saveZones(req, res);

      expect(res.statusCode).toBe(200);
      expect(prisma.layoutZone.deleteMany).toHaveBeenCalled();
    });

    it('cross-tenant TENANT_ADMIN cannot save zones and gets 403', async () => {
      prisma.layout.findUnique.mockResolvedValueOnce(LAYOUT_A);

      const req = {
        params: { id: 'layout-A' },
        body: { zones: [] },
        user: TENANT_ADMIN_B,
        tenantId: 'tenant-B',
      };
      const res = mockRes();

      await saveZones(req, res);

      expect(res.statusCode).toBe(403);
      expect(prisma.layoutZone.deleteMany).not.toHaveBeenCalled();
    });
  });
});
