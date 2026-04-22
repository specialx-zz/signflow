/**
 * Regression guard for deviceController tenant ownership checks.
 *
 * Bug: getDeviceById / updateDevice / deleteDevice / getDeviceStatus /
 * controlDevice compared device.tenantId !== req.tenantId directly, which
 * incorrectly 403s SUPER_ADMIN when req.tenantId is null (no X-Tenant-Id
 * header). Fix routes through verifyTenantOwnership(device, req).
 */

jest.mock('../../../src/utils/prisma', () => ({
  device: {
    findUnique: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  scheduleDevice: { deleteMany: jest.fn() },
  channelDevice: { deleteMany: jest.fn() },
  screenWallDevice: { deleteMany: jest.fn() },
  syncGroupDevice: { deleteMany: jest.fn() },
  auditLog: { create: jest.fn() },
}));

const prisma = require('../../../src/utils/prisma');
const {
  getDeviceById,
  updateDevice,
  deleteDevice,
} = require('../../../src/controllers/deviceController');

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

const DEVICE_A = { id: 'dev-A', name: 'Lobby Screen', deviceId: 'DVC-001', tenantId: 'tenant-A', isActive: true };

beforeEach(() => jest.clearAllMocks());

// ---------------------------------------------------------------------------
describe('deviceController tenant ownership (verifyTenantOwnership)', () => {
  // ── getDeviceById ────────────────────────────────────────────────────────
  describe('getDeviceById', () => {
    it('SUPER_ADMIN without X-Tenant-Id can access any tenant device', async () => {
      prisma.device.findUnique.mockResolvedValueOnce(DEVICE_A);

      const req = { params: { id: 'dev-A' }, user: SUPER_ADMIN, tenantId: null };
      const res = mockRes();

      await getDeviceById(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual(DEVICE_A);
    });

    it('same-tenant TENANT_ADMIN can access their own device', async () => {
      prisma.device.findUnique.mockResolvedValueOnce(DEVICE_A);

      const req = { params: { id: 'dev-A' }, user: TENANT_ADMIN_A, tenantId: 'tenant-A' };
      const res = mockRes();

      await getDeviceById(req, res);

      expect(res.statusCode).toBe(200);
    });

    it('cross-tenant TENANT_ADMIN is rejected with 403', async () => {
      prisma.device.findUnique.mockResolvedValueOnce(DEVICE_A);

      const req = { params: { id: 'dev-A' }, user: TENANT_ADMIN_B, tenantId: 'tenant-B' };
      const res = mockRes();

      await getDeviceById(req, res);

      expect(res.statusCode).toBe(403);
      expect(res.body).toEqual({ error: '접근 권한이 없습니다' });
    });

    it('returns 404 when device does not exist', async () => {
      prisma.device.findUnique.mockResolvedValueOnce(null);

      const req = { params: { id: 'missing' }, user: SUPER_ADMIN, tenantId: null };
      const res = mockRes();

      await getDeviceById(req, res);

      expect(res.statusCode).toBe(404);
    });
  });

  // ── updateDevice ─────────────────────────────────────────────────────────
  describe('updateDevice', () => {
    it('SUPER_ADMIN without X-Tenant-Id can update any tenant device', async () => {
      prisma.device.findUnique.mockResolvedValueOnce(DEVICE_A);
      prisma.device.update.mockResolvedValueOnce({ ...DEVICE_A, name: 'Renamed' });

      const req = {
        params: { id: 'dev-A' },
        body: { name: 'Renamed' },
        user: SUPER_ADMIN,
        tenantId: null,
      };
      const res = mockRes();

      await updateDevice(req, res);

      expect(res.statusCode).toBe(200);
      expect(prisma.device.update).toHaveBeenCalled();
    });

    it('same-tenant TENANT_ADMIN can update their own device', async () => {
      prisma.device.findUnique.mockResolvedValueOnce(DEVICE_A);
      prisma.device.update.mockResolvedValueOnce({ ...DEVICE_A, name: 'Updated' });

      const req = {
        params: { id: 'dev-A' },
        body: { name: 'Updated' },
        user: TENANT_ADMIN_A,
        tenantId: 'tenant-A',
      };
      const res = mockRes();

      await updateDevice(req, res);

      expect(res.statusCode).toBe(200);
    });

    it('cross-tenant TENANT_ADMIN is rejected with 403', async () => {
      prisma.device.findUnique.mockResolvedValueOnce(DEVICE_A);

      const req = {
        params: { id: 'dev-A' },
        body: { name: 'Hijacked' },
        user: TENANT_ADMIN_B,
        tenantId: 'tenant-B',
      };
      const res = mockRes();

      await updateDevice(req, res);

      expect(res.statusCode).toBe(403);
      expect(res.body).toEqual({ error: '접근 권한이 없습니다' });
      expect(prisma.device.update).not.toHaveBeenCalled();
    });

    it('returns 404 when device does not exist', async () => {
      prisma.device.findUnique.mockResolvedValueOnce(null);

      const req = {
        params: { id: 'missing' },
        body: { name: 'X' },
        user: SUPER_ADMIN,
        tenantId: null,
      };
      const res = mockRes();

      await updateDevice(req, res);

      expect(res.statusCode).toBe(404);
    });
  });

  // ── deleteDevice ─────────────────────────────────────────────────────────
  describe('deleteDevice', () => {
    it('SUPER_ADMIN without X-Tenant-Id can delete any tenant device', async () => {
      prisma.device.findUnique.mockResolvedValueOnce(DEVICE_A);
      prisma.scheduleDevice.deleteMany.mockResolvedValueOnce({});
      prisma.channelDevice.deleteMany.mockResolvedValueOnce({});
      prisma.screenWallDevice.deleteMany.mockResolvedValueOnce({});
      prisma.syncGroupDevice.deleteMany.mockResolvedValueOnce({});
      prisma.device.update.mockResolvedValueOnce({});

      const req = { params: { id: 'dev-A' }, user: SUPER_ADMIN, tenantId: null };
      const res = mockRes();

      await deleteDevice(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({ message: 'Device deleted successfully' });
    });

    it('cross-tenant TENANT_ADMIN is rejected with 403', async () => {
      prisma.device.findUnique.mockResolvedValueOnce(DEVICE_A);

      const req = { params: { id: 'dev-A' }, user: TENANT_ADMIN_B, tenantId: 'tenant-B' };
      const res = mockRes();

      await deleteDevice(req, res);

      expect(res.statusCode).toBe(403);
      expect(res.body).toEqual({ error: '접근 권한이 없습니다' });
      expect(prisma.device.update).not.toHaveBeenCalled();
    });
  });
});
