/**
 * Regression guard: tagPlaybackController cross-tenant IDOR.
 *
 * Bug background:
 *   Every tag-playback endpoint routed through `authenticate + tenantContext`
 *   but NONE verified that the target device / schedule / condition actually
 *   belonged to the caller's tenant. Concrete attack vectors:
 *     - setDeviceTags / updateDeviceTags: overwrite another tenant's device tags
 *     - addScheduleCondition: attach a rule to another tenant's schedule,
 *       OR attach a condition that references another tenant's playlist
 *       (cross-tenant content injection)
 *     - resolveTagPlayback: enumerate another tenant's device layout
 *     - getDeviceTags / listScheduleConditions: read across tenants
 *
 * Fix: every resource handler MUST call verifyTenantOwnership against the
 * loaded resource. Cross-tenant playlist references in scheduleConditions
 * are additionally validated against the schedule's tenant.
 */

jest.mock('../../../src/utils/prisma', () => ({
  device: { findUnique: jest.fn(), update: jest.fn(), findMany: jest.fn() },
  schedule: { findUnique: jest.fn() },
  playlist: { findUnique: jest.fn() },
  scheduleCondition: {
    findUnique: jest.fn(), findMany: jest.fn(),
    create: jest.fn(), update: jest.fn(), delete: jest.fn(),
  },
}));

const prisma = require('../../../src/utils/prisma');
const {
  getDeviceTags, setDeviceTags, updateDeviceTags,
  addScheduleCondition, listScheduleConditions,
  updateScheduleCondition, deleteScheduleCondition,
  resolveTagPlayback,
} = require('../../../src/controllers/tagPlaybackController');

function mockRes() {
  const res = {
    statusCode: 200,
    body: null,
    status(code) { res.statusCode = code; return res; },
    json(data) { res.body = data; return res; },
  };
  return res;
}

const SUPER_ADMIN    = { id: 'sa-1', role: 'SUPER_ADMIN',  tenantId: 'default-tenant' };
const TENANT_ADMIN_A = { id: 'ta-1', role: 'TENANT_ADMIN', tenantId: 'tenant-A' };
const TENANT_ADMIN_B = { id: 'tb-1', role: 'TENANT_ADMIN', tenantId: 'tenant-B' };

const DEVICE_A   = { id: 'dev-A', name: 'Lobby', tenantId: 'tenant-A', tags: '{"매장타입":"카페"}' };
const SCHEDULE_A = { id: 'sch-A', tenantId: 'tenant-A' };
const PLAYLIST_A = { id: 'pl-A', tenantId: 'tenant-A' };
const PLAYLIST_B = { id: 'pl-B', tenantId: 'tenant-B' };

beforeEach(() => jest.clearAllMocks());

// ─────────────────────────────────────────────────────────────────────────────
describe('tagPlaybackController — device tag tenant ownership', () => {
  describe('getDeviceTags', () => {
    it('TENANT_ADMIN_B cannot read tenant-A device tags', async () => {
      prisma.device.findUnique.mockResolvedValueOnce(DEVICE_A);
      const req = { params: { deviceId: 'dev-A' }, user: TENANT_ADMIN_B, tenantId: 'tenant-B' };
      const res = mockRes();
      await getDeviceTags(req, res);
      expect(res.statusCode).toBe(403);
    });

    it('TENANT_ADMIN_A can read own-tenant device tags', async () => {
      prisma.device.findUnique.mockResolvedValueOnce(DEVICE_A);
      const req = { params: { deviceId: 'dev-A' }, user: TENANT_ADMIN_A, tenantId: 'tenant-A' };
      const res = mockRes();
      await getDeviceTags(req, res);
      expect(res.statusCode).toBe(200);
      expect(res.body.tags).toEqual({ 매장타입: '카페' });
    });

    it('SUPER_ADMIN with no tenant header can read any tenant device', async () => {
      prisma.device.findUnique.mockResolvedValueOnce(DEVICE_A);
      const req = { params: { deviceId: 'dev-A' }, user: SUPER_ADMIN, tenantId: null };
      const res = mockRes();
      await getDeviceTags(req, res);
      expect(res.statusCode).toBe(200);
    });
  });

  describe('setDeviceTags (cross-tenant WRITE attack)', () => {
    it('TENANT_ADMIN_B cannot overwrite tenant-A device tags', async () => {
      prisma.device.findUnique.mockResolvedValueOnce(DEVICE_A);
      const req = {
        params: { deviceId: 'dev-A' },
        body: { tags: { 매장타입: '편의점' } },
        user: TENANT_ADMIN_B, tenantId: 'tenant-B',
      };
      const res = mockRes();
      await setDeviceTags(req, res);
      expect(res.statusCode).toBe(403);
      // Critical: the write must never happen
      expect(prisma.device.update).not.toHaveBeenCalled();
    });

    it('rejects non-object tag payloads before running tenant check', async () => {
      const req = {
        params: { deviceId: 'dev-A' },
        body: { tags: 'not-an-object' },
        user: TENANT_ADMIN_A, tenantId: 'tenant-A',
      };
      const res = mockRes();
      await setDeviceTags(req, res);
      expect(res.statusCode).toBe(400);
    });
  });

  describe('updateDeviceTags (cross-tenant merge attack)', () => {
    it('TENANT_ADMIN_B cannot merge into tenant-A device tags', async () => {
      prisma.device.findUnique.mockResolvedValueOnce(DEVICE_A);
      const req = {
        params: { deviceId: 'dev-A' },
        body: { tags: { 이벤트: 'blackfriday' } },
        user: TENANT_ADMIN_B, tenantId: 'tenant-B',
      };
      const res = mockRes();
      await updateDeviceTags(req, res);
      expect(res.statusCode).toBe(403);
      expect(prisma.device.update).not.toHaveBeenCalled();
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('tagPlaybackController — schedule condition tenant ownership', () => {
  describe('addScheduleCondition', () => {
    it('TENANT_ADMIN_B cannot add a condition to tenant-A schedule', async () => {
      prisma.schedule.findUnique.mockResolvedValueOnce(SCHEDULE_A);
      const req = {
        params: { scheduleId: 'sch-A' },
        body: { tagKey: 'x', tagValue: 'y', playlistId: 'pl-A' },
        user: TENANT_ADMIN_B, tenantId: 'tenant-B',
      };
      const res = mockRes();
      await addScheduleCondition(req, res);
      expect(res.statusCode).toBe(403);
      expect(prisma.scheduleCondition.create).not.toHaveBeenCalled();
    });

    it('rejects cross-tenant playlist injection (tenant-A schedule, tenant-B playlist)', async () => {
      prisma.schedule.findUnique.mockResolvedValueOnce(SCHEDULE_A);
      prisma.playlist.findUnique.mockResolvedValueOnce(PLAYLIST_B);
      const req = {
        params: { scheduleId: 'sch-A' },
        body: { tagKey: 'x', tagValue: 'y', playlistId: 'pl-B' },
        user: TENANT_ADMIN_A, tenantId: 'tenant-A',
      };
      const res = mockRes();
      await addScheduleCondition(req, res);
      expect(res.statusCode).toBe(403);
      expect(res.body).toEqual({ error: '다른 업체의 플레이리스트는 사용할 수 없습니다' });
      expect(prisma.scheduleCondition.create).not.toHaveBeenCalled();
    });

    it('succeeds when both schedule and playlist belong to the caller tenant', async () => {
      prisma.schedule.findUnique.mockResolvedValueOnce(SCHEDULE_A);
      prisma.playlist.findUnique.mockResolvedValueOnce(PLAYLIST_A);
      prisma.scheduleCondition.create.mockResolvedValueOnce({ id: 'c1', playlist: { id: 'pl-A', name: 'A' } });
      const req = {
        params: { scheduleId: 'sch-A' },
        body: { tagKey: 'x', tagValue: 'y', playlistId: 'pl-A', priority: 10 },
        user: TENANT_ADMIN_A, tenantId: 'tenant-A',
      };
      const res = mockRes();
      await addScheduleCondition(req, res);
      expect(res.statusCode).toBe(201);
      expect(prisma.scheduleCondition.create).toHaveBeenCalled();
    });
  });

  describe('listScheduleConditions', () => {
    it('TENANT_ADMIN_B cannot list conditions on tenant-A schedule', async () => {
      prisma.schedule.findUnique.mockResolvedValueOnce(SCHEDULE_A);
      const req = { params: { scheduleId: 'sch-A' }, user: TENANT_ADMIN_B, tenantId: 'tenant-B' };
      const res = mockRes();
      await listScheduleConditions(req, res);
      expect(res.statusCode).toBe(403);
      expect(prisma.scheduleCondition.findMany).not.toHaveBeenCalled();
    });
  });

  describe('updateScheduleCondition', () => {
    it('TENANT_ADMIN_B cannot update a condition on tenant-A schedule', async () => {
      prisma.schedule.findUnique.mockResolvedValueOnce(SCHEDULE_A);
      const req = {
        params: { scheduleId: 'sch-A', conditionId: 'c1' },
        body: { priority: 999 },
        user: TENANT_ADMIN_B, tenantId: 'tenant-B',
      };
      const res = mockRes();
      await updateScheduleCondition(req, res);
      expect(res.statusCode).toBe(403);
      expect(prisma.scheduleCondition.update).not.toHaveBeenCalled();
    });

    it('rejects reassigning to a cross-tenant playlist', async () => {
      prisma.schedule.findUnique.mockResolvedValueOnce(SCHEDULE_A);
      prisma.scheduleCondition.findUnique.mockResolvedValueOnce({
        id: 'c1', scheduleId: 'sch-A', playlistId: 'pl-A'
      });
      prisma.playlist.findUnique.mockResolvedValueOnce(PLAYLIST_B);
      const req = {
        params: { scheduleId: 'sch-A', conditionId: 'c1' },
        body: { playlistId: 'pl-B' },
        user: TENANT_ADMIN_A, tenantId: 'tenant-A',
      };
      const res = mockRes();
      await updateScheduleCondition(req, res);
      expect(res.statusCode).toBe(403);
      expect(prisma.scheduleCondition.update).not.toHaveBeenCalled();
    });
  });

  describe('deleteScheduleCondition', () => {
    it('TENANT_ADMIN_B cannot delete a condition from tenant-A schedule', async () => {
      prisma.schedule.findUnique.mockResolvedValueOnce(SCHEDULE_A);
      const req = {
        params: { scheduleId: 'sch-A', conditionId: 'c1' },
        user: TENANT_ADMIN_B, tenantId: 'tenant-B',
      };
      const res = mockRes();
      await deleteScheduleCondition(req, res);
      expect(res.statusCode).toBe(403);
      expect(prisma.scheduleCondition.delete).not.toHaveBeenCalled();
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('tagPlaybackController — resolveTagPlayback tenant ownership', () => {
  it('TENANT_ADMIN_B cannot resolve tenant-A schedule', async () => {
    prisma.schedule.findUnique.mockResolvedValueOnce({
      ...SCHEDULE_A, conditions: [], devices: [], playlist: null,
    });
    const req = { params: { scheduleId: 'sch-A' }, user: TENANT_ADMIN_B, tenantId: 'tenant-B' };
    const res = mockRes();
    await resolveTagPlayback(req, res);
    expect(res.statusCode).toBe(403);
  });

  it('TENANT_ADMIN_A can resolve own-tenant schedule', async () => {
    prisma.schedule.findUnique.mockResolvedValueOnce({
      ...SCHEDULE_A, name: 'Daily', conditions: [], devices: [], playlist: null,
    });
    const req = { params: { scheduleId: 'sch-A' }, user: TENANT_ADMIN_A, tenantId: 'tenant-A' };
    const res = mockRes();
    await resolveTagPlayback(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.scheduleId).toBe('sch-A');
  });
});
