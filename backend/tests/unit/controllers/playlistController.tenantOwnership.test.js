/**
 * Regression guard for playlistController tenant ownership checks.
 *
 * Bug: getPlaylistById / updatePlaylist / deletePlaylist / addPlaylistItem /
 * reorderPlaylistItems compared resource.tenantId !== req.tenantId directly,
 * which incorrectly 403s SUPER_ADMIN when req.tenantId is null (no X-Tenant-Id
 * header). Fix routes through verifyTenantOwnership(resource, req).
 */

jest.mock('../../../src/utils/prisma', () => ({
  playlist: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  schedule: { updateMany: jest.fn() },
  layoutZone: { updateMany: jest.fn() },
  playlistItem: {
    findMany: jest.fn(),
  },
}));

const prisma = require('../../../src/utils/prisma');
const {
  getPlaylistById,
  updatePlaylist,
  deletePlaylist,
} = require('../../../src/controllers/playlistController');

function mockRes() {
  const res = {
    statusCode: 200,
    body: null,
    status(code) { res.statusCode = code; return res; },
    json(data) { res.body = data; return res; },
  };
  return res;
}

const SUPER_ADMIN  = { id: 'sa-1', role: 'SUPER_ADMIN',  tenantId: 'default-tenant' };
const TENANT_ADMIN_A = { id: 'ta-1', role: 'TENANT_ADMIN', tenantId: 'tenant-A' };
const TENANT_ADMIN_B = { id: 'tb-1', role: 'TENANT_ADMIN', tenantId: 'tenant-B' };

const PLAYLIST_A = { id: 'pl-A', name: 'Morning', tenantId: 'tenant-A', isActive: true };

beforeEach(() => jest.clearAllMocks());

// ---------------------------------------------------------------------------
describe('playlistController tenant ownership (verifyTenantOwnership)', () => {
  // ── getPlaylistById ──────────────────────────────────────────────────────
  describe('getPlaylistById', () => {
    it('SUPER_ADMIN without X-Tenant-Id can access any tenant playlist', async () => {
      prisma.playlist.findFirst.mockResolvedValueOnce(PLAYLIST_A);

      const req = { params: { id: 'pl-A' }, query: {}, user: SUPER_ADMIN, tenantId: null };
      const res = mockRes();

      await getPlaylistById(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual(PLAYLIST_A);
    });

    it('same-tenant TENANT_ADMIN can access their own playlist', async () => {
      prisma.playlist.findFirst.mockResolvedValueOnce(PLAYLIST_A);

      const req = { params: { id: 'pl-A' }, query: {}, user: TENANT_ADMIN_A, tenantId: 'tenant-A' };
      const res = mockRes();

      await getPlaylistById(req, res);

      expect(res.statusCode).toBe(200);
    });

    it('cross-tenant TENANT_ADMIN is rejected with 403', async () => {
      prisma.playlist.findFirst.mockResolvedValueOnce(PLAYLIST_A);

      const req = { params: { id: 'pl-A' }, query: {}, user: TENANT_ADMIN_B, tenantId: 'tenant-B' };
      const res = mockRes();

      await getPlaylistById(req, res);

      expect(res.statusCode).toBe(403);
      expect(res.body).toEqual({ error: '접근 권한이 없습니다' });
    });

    it('returns 404 when playlist does not exist', async () => {
      prisma.playlist.findFirst.mockResolvedValueOnce(null);

      const req = { params: { id: 'missing' }, query: {}, user: SUPER_ADMIN, tenantId: null };
      const res = mockRes();

      await getPlaylistById(req, res);

      expect(res.statusCode).toBe(404);
    });
  });

  // ── updatePlaylist ───────────────────────────────────────────────────────
  describe('updatePlaylist', () => {
    it('SUPER_ADMIN without X-Tenant-Id can update any tenant playlist', async () => {
      prisma.playlist.findUnique.mockResolvedValueOnce(PLAYLIST_A);
      prisma.playlist.update.mockResolvedValueOnce({ ...PLAYLIST_A, name: 'Evening' });

      const req = {
        params: { id: 'pl-A' },
        body: { name: 'Evening' },
        user: SUPER_ADMIN,
        tenantId: null,
      };
      const res = mockRes();

      await updatePlaylist(req, res);

      expect(res.statusCode).toBe(200);
      expect(prisma.playlist.update).toHaveBeenCalled();
    });

    it('same-tenant TENANT_ADMIN can update their own playlist', async () => {
      prisma.playlist.findUnique.mockResolvedValueOnce(PLAYLIST_A);
      prisma.playlist.update.mockResolvedValueOnce({ ...PLAYLIST_A, name: 'Updated' });

      const req = {
        params: { id: 'pl-A' },
        body: { name: 'Updated' },
        user: TENANT_ADMIN_A,
        tenantId: 'tenant-A',
      };
      const res = mockRes();

      await updatePlaylist(req, res);

      expect(res.statusCode).toBe(200);
    });

    it('cross-tenant TENANT_ADMIN is rejected with 403', async () => {
      prisma.playlist.findUnique.mockResolvedValueOnce(PLAYLIST_A);

      const req = {
        params: { id: 'pl-A' },
        body: { name: 'Hijacked' },
        user: TENANT_ADMIN_B,
        tenantId: 'tenant-B',
      };
      const res = mockRes();

      await updatePlaylist(req, res);

      expect(res.statusCode).toBe(403);
      expect(res.body).toEqual({ error: '접근 권한이 없습니다' });
      expect(prisma.playlist.update).not.toHaveBeenCalled();
    });

    it('returns 404 when playlist does not exist', async () => {
      prisma.playlist.findUnique.mockResolvedValueOnce(null);

      const req = {
        params: { id: 'missing' },
        body: { name: 'X' },
        user: SUPER_ADMIN,
        tenantId: null,
      };
      const res = mockRes();

      await updatePlaylist(req, res);

      expect(res.statusCode).toBe(404);
    });
  });

  // ── deletePlaylist ───────────────────────────────────────────────────────
  describe('deletePlaylist', () => {
    it('SUPER_ADMIN without X-Tenant-Id can delete any tenant playlist', async () => {
      prisma.playlist.findUnique.mockResolvedValueOnce(PLAYLIST_A);
      prisma.schedule.updateMany.mockResolvedValueOnce({});
      prisma.layoutZone.updateMany.mockResolvedValueOnce({});
      prisma.playlist.update.mockResolvedValueOnce({});

      const req = { params: { id: 'pl-A' }, user: SUPER_ADMIN, tenantId: null };
      const res = mockRes();

      await deletePlaylist(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({ message: 'Playlist deleted successfully' });
    });

    it('cross-tenant TENANT_ADMIN is rejected with 403', async () => {
      prisma.playlist.findUnique.mockResolvedValueOnce(PLAYLIST_A);

      const req = { params: { id: 'pl-A' }, user: TENANT_ADMIN_B, tenantId: 'tenant-B' };
      const res = mockRes();

      await deletePlaylist(req, res);

      expect(res.statusCode).toBe(403);
      expect(res.body).toEqual({ error: '접근 권한이 없습니다' });
      expect(prisma.playlist.update).not.toHaveBeenCalled();
    });
  });
});
