/**
 * Regression guard for scheduleController tenant ownership checks.
 *
 * Bug: getScheduleById / updateSchedule / deleteSchedule / deploySchedule
 * compared schedule.tenantId !== req.tenantId directly, which incorrectly
 * 403s SUPER_ADMIN when req.tenantId is null (no X-Tenant-Id header).
 * Fix routes through verifyTenantOwnership(schedule, req).
 */

jest.mock('../../../src/utils/prisma', () => ({
  schedule: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  scheduleDevice: {
    deleteMany: jest.fn(),
    updateMany: jest.fn(),
    createMany: jest.fn(),
  },
  auditLog: { create: jest.fn() },
}));

const prisma = require('../../../src/utils/prisma');
const {
  getScheduleById,
  updateSchedule,
  deleteSchedule,
} = require('../../../src/controllers/scheduleController');

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

const SCHEDULE_A = {
  id: 'sch-A', name: 'Daily Loop', tenantId: 'tenant-A',
  isActive: true, status: 'DRAFT', devices: [],
};

beforeEach(() => jest.clearAllMocks());

// ---------------------------------------------------------------------------
describe('scheduleController tenant ownership (verifyTenantOwnership)', () => {
  // ── getScheduleById ──────────────────────────────────────────────────────
  describe('getScheduleById', () => {
    it('SUPER_ADMIN without X-Tenant-Id can access any tenant schedule', async () => {
      prisma.schedule.findUnique.mockResolvedValueOnce(SCHEDULE_A);

      const req = { params: { id: 'sch-A' }, user: SUPER_ADMIN, tenantId: null };
      const res = mockRes();

      await getScheduleById(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual(SCHEDULE_A);
    });

    it('same-tenant TENANT_ADMIN can access their own schedule', async () => {
      prisma.schedule.findUnique.mockResolvedValueOnce(SCHEDULE_A);

      const req = { params: { id: 'sch-A' }, user: TENANT_ADMIN_A, tenantId: 'tenant-A' };
      const res = mockRes();

      await getScheduleById(req, res);

      expect(res.statusCode).toBe(200);
    });

    it('cross-tenant TENANT_ADMIN is rejected with 403', async () => {
      prisma.schedule.findUnique.mockResolvedValueOnce(SCHEDULE_A);

      const req = { params: { id: 'sch-A' }, user: TENANT_ADMIN_B, tenantId: 'tenant-B' };
      const res = mockRes();

      await getScheduleById(req, res);

      expect(res.statusCode).toBe(403);
      expect(res.body).toEqual({ error: '접근 권한이 없습니다' });
    });

    it('returns 404 when schedule does not exist', async () => {
      prisma.schedule.findUnique.mockResolvedValueOnce(null);

      const req = { params: { id: 'missing' }, user: SUPER_ADMIN, tenantId: null };
      const res = mockRes();

      await getScheduleById(req, res);

      expect(res.statusCode).toBe(404);
    });
  });

  // ── updateSchedule ───────────────────────────────────────────────────────
  describe('updateSchedule', () => {
    it('SUPER_ADMIN without X-Tenant-Id can update any tenant schedule', async () => {
      prisma.schedule.findUnique
        .mockResolvedValueOnce(SCHEDULE_A)        // initial fetch
        .mockResolvedValueOnce({ ...SCHEDULE_A, name: 'Night Loop' }); // re-fetch after update

      prisma.schedule.update.mockResolvedValueOnce({});

      const req = {
        params: { id: 'sch-A' },
        body: { name: 'Night Loop' },
        user: SUPER_ADMIN,
        tenantId: null,
      };
      const res = mockRes();

      await updateSchedule(req, res);

      expect(res.statusCode).toBe(200);
      expect(prisma.schedule.update).toHaveBeenCalled();
    });

    it('same-tenant TENANT_ADMIN can update their own schedule', async () => {
      prisma.schedule.findUnique
        .mockResolvedValueOnce(SCHEDULE_A)
        .mockResolvedValueOnce({ ...SCHEDULE_A, name: 'Updated' });
      prisma.schedule.update.mockResolvedValueOnce({});

      const req = {
        params: { id: 'sch-A' },
        body: { name: 'Updated' },
        user: TENANT_ADMIN_A,
        tenantId: 'tenant-A',
      };
      const res = mockRes();

      await updateSchedule(req, res);

      expect(res.statusCode).toBe(200);
    });

    it('cross-tenant TENANT_ADMIN is rejected with 403', async () => {
      prisma.schedule.findUnique.mockResolvedValueOnce(SCHEDULE_A);

      const req = {
        params: { id: 'sch-A' },
        body: { name: 'Hijacked' },
        user: TENANT_ADMIN_B,
        tenantId: 'tenant-B',
      };
      const res = mockRes();

      await updateSchedule(req, res);

      expect(res.statusCode).toBe(403);
      expect(res.body).toEqual({ error: '접근 권한이 없습니다' });
      expect(prisma.schedule.update).not.toHaveBeenCalled();
    });

    it('returns 404 when schedule does not exist', async () => {
      prisma.schedule.findUnique.mockResolvedValueOnce(null);

      const req = {
        params: { id: 'missing' },
        body: { name: 'X' },
        user: SUPER_ADMIN,
        tenantId: null,
      };
      const res = mockRes();

      await updateSchedule(req, res);

      expect(res.statusCode).toBe(404);
    });
  });

  // ── deleteSchedule ───────────────────────────────────────────────────────
  describe('deleteSchedule', () => {
    it('SUPER_ADMIN without X-Tenant-Id can delete any tenant schedule', async () => {
      prisma.schedule.findUnique.mockResolvedValueOnce(SCHEDULE_A);
      prisma.schedule.update.mockResolvedValueOnce({});
      prisma.scheduleDevice.updateMany.mockResolvedValueOnce({});

      const req = { params: { id: 'sch-A' }, user: SUPER_ADMIN, tenantId: null };
      const res = mockRes();

      await deleteSchedule(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({ message: 'Schedule deleted successfully' });
    });

    it('cross-tenant TENANT_ADMIN is rejected with 403', async () => {
      prisma.schedule.findUnique.mockResolvedValueOnce(SCHEDULE_A);

      const req = { params: { id: 'sch-A' }, user: TENANT_ADMIN_B, tenantId: 'tenant-B' };
      const res = mockRes();

      await deleteSchedule(req, res);

      expect(res.statusCode).toBe(403);
      expect(res.body).toEqual({ error: '접근 권한이 없습니다' });
      expect(prisma.schedule.update).not.toHaveBeenCalled();
    });
  });
});
