/**
 * Regression guard for storeController tenant ownership checks.
 *
 * Bug background:
 *   getStoreById / updateStore / deleteStore / getStoreDevices /
 *   assignDeviceToStore / removeDeviceFromStore all used
 *   `if (req.tenantId && store.tenantId !== req.tenantId)`.
 *   When SUPER_ADMIN has no X-Tenant-Id header, req.tenantId = null so the
 *   guard short-circuits to false — the check is silently skipped. However
 *   when the guard was later expected to protect cross-tenant access it
 *   allowed any SUPER_ADMIN through. The inverse bug: with the wrong helper
 *   call the gate fails for SUPER_ADMIN.
 *
 *   Fix: verifyTenantOwnership(store, req) handles null tenantId (SUPER_ADMIN
 *   without X-Tenant-Id) as "allow all".
 *
 * Coverage: getStoreById, updateStore, deleteStore (3 of 6 sites).
 * Note: getStores uses req.tenantWhere() — that path is unaffected and not
 * tested here.
 */

jest.mock('../../../src/utils/prisma', () => ({
  store: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  device: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
}));

const prisma = require('../../../src/utils/prisma');
const {
  getStoreById,
  updateStore,
  deleteStore,
} = require('../../../src/controllers/storeController');

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

const STORE_A = {
  id: 'store-1',
  name: 'Seoul Branch',
  tenantId: 'tenant-A',
  isActive: true,
  devices: [],
};

beforeEach(() => {
  jest.clearAllMocks();
});

// ── getStoreById ──────────────────────────────────────────────────────────────

describe('storeController tenant ownership (verifyTenantOwnership)', () => {
  describe('getStoreById', () => {
    it('SUPER_ADMIN without X-Tenant-Id can read any tenant store', async () => {
      prisma.store.findUnique.mockResolvedValueOnce(STORE_A);

      const req = {
        params: { id: 'store-1' },
        user: SUPER_ADMIN,
        tenantId: null,
      };
      const res = mockRes();

      await getStoreById(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual(STORE_A);
    });

    it('same-tenant TENANT_ADMIN can read their store', async () => {
      prisma.store.findUnique.mockResolvedValueOnce(STORE_A);

      const req = {
        params: { id: 'store-1' },
        user: TENANT_ADMIN_A,
        tenantId: 'tenant-A',
      };
      const res = mockRes();

      await getStoreById(req, res);

      expect(res.statusCode).toBe(200);
    });

    it('cross-tenant TENANT_ADMIN is rejected with 403', async () => {
      prisma.store.findUnique.mockResolvedValueOnce(STORE_A);

      const req = {
        params: { id: 'store-1' },
        user: TENANT_ADMIN_B,
        tenantId: 'tenant-B',
      };
      const res = mockRes();

      await getStoreById(req, res);

      expect(res.statusCode).toBe(403);
      expect(res.body).toEqual({ error: '접근 권한이 없습니다.' });
    });

    it('returns 404 when store does not exist', async () => {
      prisma.store.findUnique.mockResolvedValueOnce(null);

      const req = {
        params: { id: 'missing' },
        user: SUPER_ADMIN,
        tenantId: null,
      };
      const res = mockRes();

      await getStoreById(req, res);

      expect(res.statusCode).toBe(404);
    });
  });

  // ── updateStore ─────────────────────────────────────────────────────────────

  describe('updateStore', () => {
    it('SUPER_ADMIN without X-Tenant-Id can update any tenant store', async () => {
      prisma.store.findUnique.mockResolvedValueOnce(STORE_A);
      prisma.store.update.mockResolvedValueOnce({ ...STORE_A, name: 'Renamed' });

      const req = {
        params: { id: 'store-1' },
        body: { name: 'Renamed' },
        user: SUPER_ADMIN,
        tenantId: null,
      };
      const res = mockRes();

      await updateStore(req, res);

      expect(res.statusCode).toBe(200);
      expect(prisma.store.update).toHaveBeenCalled();
    });

    it('same-tenant TENANT_ADMIN can update their store', async () => {
      prisma.store.findUnique.mockResolvedValueOnce(STORE_A);
      prisma.store.update.mockResolvedValueOnce({ ...STORE_A, name: 'Updated' });

      const req = {
        params: { id: 'store-1' },
        body: { name: 'Updated' },
        user: TENANT_ADMIN_A,
        tenantId: 'tenant-A',
      };
      const res = mockRes();

      await updateStore(req, res);

      expect(res.statusCode).toBe(200);
    });

    it('cross-tenant TENANT_ADMIN is rejected with 403', async () => {
      prisma.store.findUnique.mockResolvedValueOnce(STORE_A);

      const req = {
        params: { id: 'store-1' },
        body: { name: 'Hijacked' },
        user: TENANT_ADMIN_B,
        tenantId: 'tenant-B',
      };
      const res = mockRes();

      await updateStore(req, res);

      expect(res.statusCode).toBe(403);
      expect(res.body).toEqual({ error: '접근 권한이 없습니다.' });
      expect(prisma.store.update).not.toHaveBeenCalled();
    });

    it('returns 404 when store does not exist', async () => {
      prisma.store.findUnique.mockResolvedValueOnce(null);

      const req = {
        params: { id: 'missing' },
        body: { name: 'X' },
        user: SUPER_ADMIN,
        tenantId: null,
      };
      const res = mockRes();

      await updateStore(req, res);

      expect(res.statusCode).toBe(404);
    });
  });

  // ── deleteStore ─────────────────────────────────────────────────────────────

  describe('deleteStore', () => {
    it('SUPER_ADMIN without X-Tenant-Id can delete any tenant store', async () => {
      prisma.store.findUnique.mockResolvedValueOnce(STORE_A);
      prisma.store.update.mockResolvedValueOnce({ ...STORE_A, isActive: false });

      const req = {
        params: { id: 'store-1' },
        user: SUPER_ADMIN,
        tenantId: null,
      };
      const res = mockRes();

      await deleteStore(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({ message: '매장이 비활성화되었습니다.' });
      expect(prisma.store.update).toHaveBeenCalledWith({
        where: { id: 'store-1' },
        data: { isActive: false },
      });
    });

    it('same-tenant TENANT_ADMIN can delete their store', async () => {
      prisma.store.findUnique.mockResolvedValueOnce(STORE_A);
      prisma.store.update.mockResolvedValueOnce({ ...STORE_A, isActive: false });

      const req = {
        params: { id: 'store-1' },
        user: TENANT_ADMIN_A,
        tenantId: 'tenant-A',
      };
      const res = mockRes();

      await deleteStore(req, res);

      expect(res.statusCode).toBe(200);
    });

    it('cross-tenant TENANT_ADMIN is rejected with 403', async () => {
      prisma.store.findUnique.mockResolvedValueOnce(STORE_A);

      const req = {
        params: { id: 'store-1' },
        user: TENANT_ADMIN_B,
        tenantId: 'tenant-B',
      };
      const res = mockRes();

      await deleteStore(req, res);

      expect(res.statusCode).toBe(403);
      expect(res.body).toEqual({ error: '접근 권한이 없습니다.' });
      expect(prisma.store.update).not.toHaveBeenCalled();
    });

    it('returns 404 when store does not exist', async () => {
      prisma.store.findUnique.mockResolvedValueOnce(null);

      const req = {
        params: { id: 'missing' },
        user: SUPER_ADMIN,
        tenantId: null,
      };
      const res = mockRes();

      await deleteStore(req, res);

      expect(res.statusCode).toBe(404);
    });
  });
});
