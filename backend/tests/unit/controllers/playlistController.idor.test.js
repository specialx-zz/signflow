/**
 * Regression guard: playlistController.getPlaylistById cross-tenant IDOR
 *
 * Bug background:
 *   The previous unauthenticated-player path used a self-validating query
 *   parameter:
 *     if (!req.user) {
 *       const { tenantId } = req.query;
 *       if (!tenantId || playlist.tenantId !== tenantId) return 403;
 *     }
 *   An attacker only needed to know (or guess) the playlist's own tenantId
 *   to satisfy this check. Result: cross-tenant IDOR — any playlist whose
 *   id was leaked could be fetched by anyone who could put the right
 *   tenantId in the URL.
 *
 *   Fix: require ?deviceId=<id>. Resolve the device server-side and only
 *   serve the playlist when device.tenantId === playlist.tenantId. The
 *   trust anchors on the device row (which an attacker cannot forge into
 *   another tenant), not on the URL.
 *
 * These tests pin the corrected behaviour.
 */

jest.mock('../../../src/utils/prisma', () => ({
  playlist: { findFirst: jest.fn() },
  device: { findFirst: jest.fn() },
}));

const prisma = require('../../../src/utils/prisma');
const { getPlaylistById } = require('../../../src/controllers/playlistController');

function mockRes() {
  const res = {
    statusCode: 200,
    body: null,
    status(code) { res.statusCode = code; return res; },
    json(data) { res.body = data; return res; },
  };
  return res;
}

const PLAYLIST_TENANT_A = {
  id: 'playlist-A',
  name: 'A 업체 메뉴',
  tenantId: 'tenant-A',
  isActive: true,
};

const DEVICE_TENANT_A = { tenantId: 'tenant-A' };
const DEVICE_TENANT_B = { tenantId: 'tenant-B' };

beforeEach(() => {
  jest.clearAllMocks();
});

describe('playlistController.getPlaylistById — IDOR regression guard', () => {
  describe('unauthenticated player requests', () => {
    it('returns 403 when no deviceId query is provided', async () => {
      prisma.playlist.findFirst.mockResolvedValueOnce(PLAYLIST_TENANT_A);

      const req = { params: { id: 'playlist-A' }, query: {}, user: undefined };
      const res = mockRes();

      await getPlaylistById(req, res);

      expect(res.statusCode).toBe(403);
      // Critical: device.findFirst must not even be called when deviceId is missing
      expect(prisma.device.findFirst).not.toHaveBeenCalled();
    });

    it('returns 403 when the deviceId does not resolve to any device', async () => {
      prisma.playlist.findFirst.mockResolvedValueOnce(PLAYLIST_TENANT_A);
      prisma.device.findFirst.mockResolvedValueOnce(null);

      const req = {
        params: { id: 'playlist-A' },
        query: { deviceId: 'unknown-device' },
        user: undefined
      };
      const res = mockRes();

      await getPlaylistById(req, res);

      expect(res.statusCode).toBe(403);
    });

    it('returns 403 when device belongs to a DIFFERENT tenant than the playlist', async () => {
      // The exact attack scenario: attacker knows playlist-A id, has only a
      // tenant-B device. Must NOT return the playlist.
      prisma.playlist.findFirst.mockResolvedValueOnce(PLAYLIST_TENANT_A);
      prisma.device.findFirst.mockResolvedValueOnce(DEVICE_TENANT_B);

      const req = {
        params: { id: 'playlist-A' },
        query: { deviceId: 'device-B-1' },
        user: undefined
      };
      const res = mockRes();

      await getPlaylistById(req, res);

      expect(res.statusCode).toBe(403);
      expect(res.body).toEqual({ error: '접근 권한이 없습니다' });
    });

    it('returns the playlist when device and playlist share the same tenant', async () => {
      prisma.playlist.findFirst.mockResolvedValueOnce(PLAYLIST_TENANT_A);
      prisma.device.findFirst.mockResolvedValueOnce(DEVICE_TENANT_A);

      const req = {
        params: { id: 'playlist-A' },
        query: { deviceId: 'device-A-1' },
        user: undefined
      };
      const res = mockRes();

      await getPlaylistById(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual(PLAYLIST_TENANT_A);
    });

    it('does NOT honor a ?tenantId= query (regression: old self-validating path)', async () => {
      // Even if an attacker passes the correct tenantId, without a deviceId
      // the request must still be rejected. This pins that the legacy
      // self-validating param is gone for good.
      prisma.playlist.findFirst.mockResolvedValueOnce(PLAYLIST_TENANT_A);

      const req = {
        params: { id: 'playlist-A' },
        query: { tenantId: 'tenant-A' }, // attempted bypass via legacy param
        user: undefined
      };
      const res = mockRes();

      await getPlaylistById(req, res);

      expect(res.statusCode).toBe(403);
    });

    it('accepts deviceId by either Device.id (PK) or Device.deviceId (player UUID)', async () => {
      prisma.playlist.findFirst.mockResolvedValueOnce(PLAYLIST_TENANT_A);
      prisma.device.findFirst.mockResolvedValueOnce(DEVICE_TENANT_A);

      const req = {
        params: { id: 'playlist-A' },
        query: { deviceId: 'some-uuid-that-could-be-either' },
        user: undefined
      };
      await getPlaylistById(req, mockRes());

      // The resolver must check OR(id, deviceId) to support both forms
      expect(prisma.device.findFirst).toHaveBeenCalledWith({
        where: { OR: [{ id: 'some-uuid-that-could-be-either' }, { deviceId: 'some-uuid-that-could-be-either' }] },
        select: { tenantId: true },
      });
    });
  });

  describe('authenticated requests still go through verifyTenantOwnership', () => {
    it('TENANT_ADMIN cannot fetch a playlist from another tenant', async () => {
      prisma.playlist.findFirst.mockResolvedValueOnce(PLAYLIST_TENANT_A);

      const req = {
        params: { id: 'playlist-A' },
        query: {},
        user: { id: 'u1', role: 'TENANT_ADMIN', tenantId: 'tenant-B' },
        tenantId: 'tenant-B',
      };
      const res = mockRes();

      await getPlaylistById(req, res);

      expect(res.statusCode).toBe(403);
      // device.findFirst must not be called for authenticated requests
      expect(prisma.device.findFirst).not.toHaveBeenCalled();
    });

    it('SUPER_ADMIN without X-Tenant-Id can fetch any playlist', async () => {
      prisma.playlist.findFirst.mockResolvedValueOnce(PLAYLIST_TENANT_A);

      const req = {
        params: { id: 'playlist-A' },
        query: {},
        user: { id: 'sa', role: 'SUPER_ADMIN', tenantId: 'default-tenant' },
        tenantId: null,
      };
      const res = mockRes();

      await getPlaylistById(req, res);

      expect(res.statusCode).toBe(200);
    });
  });

  it('returns 404 when the playlist does not exist (no IDOR leak via 403 vs 404 timing)', async () => {
    prisma.playlist.findFirst.mockResolvedValueOnce(null);

    const req = { params: { id: 'missing' }, query: { deviceId: 'd1' }, user: undefined };
    const res = mockRes();

    await getPlaylistById(req, res);

    expect(res.statusCode).toBe(404);
  });
});
