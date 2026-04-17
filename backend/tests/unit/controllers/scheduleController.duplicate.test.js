/**
 * Unit tests for duplicateSchedule controller (SPEC-003 Phase A).
 * Coverage: 404 / 403 ownership / SUPER_ADMIN bypass / name suffix /
 *           DRAFT status / createdBy / device copy / tenantId source / errors
 */

jest.mock('../../../src/utils/prisma', () => ({
  schedule: { findUnique: jest.fn(), create: jest.fn() },
  scheduleDevice: { createMany: jest.fn() },
}));

const prisma = require('../../../src/utils/prisma');
const { duplicateSchedule } = require('../../../src/controllers/scheduleController.duplicate');

// ── Helpers ──────────────────────────────────────────────────────────────────

function mockRes() {
  const res = { statusCode: 200, body: null };
  res.status = (code) => { res.statusCode = code; return res; };
  res.json   = (data) => { res.body = data; return res; };
  return res;
}

function makeReq(user, extra = {}) {
  return { params: { id: 'sch-src-1' }, user, tenantId: user.tenantId, ...extra };
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

const SUPER_ADMIN    = { id: 'sa-1', role: 'SUPER_ADMIN',   tenantId: null };
const TENANT_ADMIN_A = { id: 'ta-1', role: 'TENANT_ADMIN',  tenantId: 'tenant-A' };
const TENANT_ADMIN_B = { id: 'tb-1', role: 'TENANT_ADMIN',  tenantId: 'tenant-B' };

/** Source schedule in tenant-A, status ACTIVE with 2 deployed devices */
const SOURCE = {
  id: 'sch-src-1', name: 'Morning Promo', type: 'CONTENT',
  playlistId: 'pl-1', layoutId: 'lay-1',
  startDate: new Date('2025-01-01'), endDate: new Date('2025-12-31'),
  startTime: '08:00', endTime: '12:00',
  repeatType: 'DAILY', repeatDays: '["MON","TUE"]',
  settings: '{"brightness":80}', createdBy: 'original-user-id',
  status: 'ACTIVE', tenantId: 'tenant-A',
  devices: [
    { id: 'sd-1', scheduleId: 'sch-src-1', deviceId: 'dev-1', status: 'DEPLOYED' },
    { id: 'sd-2', scheduleId: 'sch-src-1', deviceId: 'dev-2', status: 'DEPLOYED' },
  ],
};

/** Record returned by prisma.schedule.create */
const CREATED = { id: 'sch-new-1', name: 'Morning Promo (복사본)', status: 'DRAFT', tenantId: 'tenant-A', createdBy: 'ta-1' };

/** Full record returned by the second findUnique (with relations) */
const FULL = {
  ...CREATED,
  creator: { id: 'ta-1', username: 'admin_a' },
  playlist: { id: 'pl-1', name: 'Morning Playlist' },
  layout:   { id: 'lay-1', name: 'Standard Layout' },
  devices:  [
    { id: 'sd-new-1', device: { id: 'dev-1', name: 'Lobby Screen' } },
    { id: 'sd-new-2', device: { id: 'dev-2', name: 'Counter Screen' } },
  ],
};

beforeEach(() => {
  jest.resetAllMocks();
  prisma.scheduleDevice.createMany.mockResolvedValue({ count: 2 });
});

// ── 404 ───────────────────────────────────────────────────────────────────────

describe('duplicateSchedule — 404', () => {
  it('returns 404 when source schedule does not exist', async () => {
    prisma.schedule.findUnique.mockResolvedValueOnce(null);
    const res = mockRes();
    await duplicateSchedule(makeReq(TENANT_ADMIN_A, { params: { id: 'none' } }), res);
    expect(res.statusCode).toBe(404);
    expect(res.body).toEqual({ error: 'Schedule not found' });
    expect(prisma.schedule.create).not.toHaveBeenCalled();
  });
});

// ── 403 ownership ─────────────────────────────────────────────────────────────

describe('duplicateSchedule — 403 tenant ownership', () => {
  it('returns 403 when non-SUPER_ADMIN targets another tenant schedule', async () => {
    prisma.schedule.findUnique.mockResolvedValueOnce(SOURCE);
    const res = mockRes();
    await duplicateSchedule(makeReq(TENANT_ADMIN_B), res);
    expect(res.statusCode).toBe(403);
    expect(res.body).toEqual({ error: '접근 권한이 없습니다' });
    expect(prisma.schedule.create).not.toHaveBeenCalled();
    expect(prisma.scheduleDevice.createMany).not.toHaveBeenCalled();
  });

  it('returns 403 when STORE_MANAGER from another tenant attempts duplication', async () => {
    const SM_B = { id: 'sm-b', role: 'STORE_MANAGER', tenantId: 'tenant-B' };
    prisma.schedule.findUnique.mockResolvedValueOnce(SOURCE);
    const res = mockRes();
    await duplicateSchedule(makeReq(SM_B), res);
    expect(res.statusCode).toBe(403);
    expect(prisma.schedule.create).not.toHaveBeenCalled();
  });
});

// ── SUPER_ADMIN bypass ───────────────────────────────────────────────────────

describe('duplicateSchedule — SUPER_ADMIN bypass', () => {
  it('SUPER_ADMIN (tenantId=null) can duplicate any schedule', async () => {
    prisma.schedule.findUnique.mockResolvedValueOnce(SOURCE).mockResolvedValueOnce(FULL);
    prisma.schedule.create.mockResolvedValueOnce(CREATED);
    const res = mockRes();
    await duplicateSchedule(makeReq(SUPER_ADMIN), res);
    expect(res.statusCode).toBe(201);
    expect(prisma.schedule.create).toHaveBeenCalled();
  });
});

// ── Successful duplication ────────────────────────────────────────────────────

describe('duplicateSchedule — successful duplication', () => {
  beforeEach(() => {
    prisma.schedule.findUnique.mockResolvedValueOnce(SOURCE).mockResolvedValueOnce(FULL);
    prisma.schedule.create.mockResolvedValueOnce(CREATED);
  });

  it('returns 201 with full result including relations', async () => {
    const res = mockRes();
    await duplicateSchedule(makeReq(TENANT_ADMIN_A), res);
    expect(res.statusCode).toBe(201);
    expect(res.body).toEqual(FULL);
  });

  it('appends (복사본) to the name', async () => {
    const res = mockRes();
    await duplicateSchedule(makeReq(TENANT_ADMIN_A), res);
    const { data } = prisma.schedule.create.mock.calls[0][0];
    expect(data.name).toBe('Morning Promo (복사본)');
  });

  it('forces status to DRAFT even when source is ACTIVE', async () => {
    expect(SOURCE.status).toBe('ACTIVE'); // pre-condition
    const res = mockRes();
    await duplicateSchedule(makeReq(TENANT_ADMIN_A), res);
    const { data } = prisma.schedule.create.mock.calls[0][0];
    expect(data.status).toBe('DRAFT');
  });

  it('sets createdBy to req.user.id, not source.createdBy', async () => {
    expect(SOURCE.createdBy).toBe('original-user-id'); // pre-condition
    const res = mockRes();
    await duplicateSchedule(makeReq(TENANT_ADMIN_A), res);
    const { data } = prisma.schedule.create.mock.calls[0][0];
    expect(data.createdBy).toBe(TENANT_ADMIN_A.id);
    expect(data.createdBy).not.toBe('original-user-id');
  });

  it('uses SOURCE tenantId, not req.tenantId (SUPER_ADMIN safety)', async () => {
    // SUPER_ADMIN with tenantId=null duplicates a tenant-A schedule;
    // the copy must still land in tenant-A, not any caller-derived tenant.
    const res = mockRes();
    await duplicateSchedule(makeReq(SUPER_ADMIN), res);
    const { data } = prisma.schedule.create.mock.calls[0][0];
    expect(data.tenantId).toBe('tenant-A');
  });
});

// ── Device assignment copying ─────────────────────────────────────────────────

describe('duplicateSchedule — device assignment copying', () => {
  it('copies scheduleDevice rows with new IDs and PENDING status', async () => {
    prisma.schedule.findUnique.mockResolvedValueOnce(SOURCE).mockResolvedValueOnce(FULL);
    prisma.schedule.create.mockResolvedValueOnce(CREATED);

    const res = mockRes();
    await duplicateSchedule(makeReq(TENANT_ADMIN_A), res);

    expect(prisma.scheduleDevice.createMany).toHaveBeenCalledTimes(1);
    const { data } = prisma.scheduleDevice.createMany.mock.calls[0][0];

    expect(data).toHaveLength(2);
    data.forEach(row => {
      expect(row.id).toBeDefined();
      expect(['sd-1', 'sd-2']).not.toContain(row.id); // new UUIDs
      expect(row.status).toBe('PENDING');              // not DEPLOYED
      expect(row.scheduleId).toBe(CREATED.id);
    });
    expect(data.map(r => r.deviceId).sort()).toEqual(['dev-1', 'dev-2']);
  });

  it('skips createMany when source has no device assignments', async () => {
    prisma.schedule.findUnique
      .mockResolvedValueOnce({ ...SOURCE, devices: [] })
      .mockResolvedValueOnce(FULL);
    prisma.schedule.create.mockResolvedValueOnce(CREATED);

    const res = mockRes();
    await duplicateSchedule(makeReq(TENANT_ADMIN_A), res);

    expect(prisma.scheduleDevice.createMany).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(201);
  });
});

// ── Error handling ────────────────────────────────────────────────────────────

describe('duplicateSchedule — error handling', () => {
  it('returns 500 when prisma.schedule.create throws', async () => {
    prisma.schedule.findUnique.mockResolvedValueOnce(SOURCE);
    prisma.schedule.create.mockRejectedValueOnce(new Error('DB connection lost'));
    const res = mockRes();
    await duplicateSchedule(makeReq(TENANT_ADMIN_A), res);
    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({ error: 'Failed to duplicate schedule' });
  });

  it('returns 500 when scheduleDevice.createMany throws', async () => {
    prisma.schedule.findUnique.mockResolvedValueOnce(SOURCE);
    prisma.schedule.create.mockResolvedValueOnce(CREATED);
    prisma.scheduleDevice.createMany.mockRejectedValueOnce(new Error('Constraint violation'));
    const res = mockRes();
    await duplicateSchedule(makeReq(TENANT_ADMIN_A), res);
    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({ error: 'Failed to duplicate schedule' });
  });
});
