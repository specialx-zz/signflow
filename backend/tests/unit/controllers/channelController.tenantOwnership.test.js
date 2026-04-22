/**
 * Regression guard for channelController tenant ownership checks
 *
 * Bug background:
 *   getChannel / updateChannel / deleteChannel compared
 *   `req.tenantId && resource.tenantId !== req.tenantId` directly. This breaks
 *   for SUPER_ADMIN: tenantContext middleware sets req.tenantId = null when no
 *   X-Tenant-Id header is sent, causing incorrect 403s.
 *
 *   Fix: route through verifyTenantOwnership(resource, req) which correctly
 *   handles the SUPER_ADMIN-without-tenant case.
 *
 * These tests pin the corrected behaviour for all three sites.
 */

jest.mock('../../../src/utils/prisma', () => ({
  channel: {
    findUnique: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    delete: jest.fn(),
  },
}));

const prisma = require('../../../src/utils/prisma');
const {
  getChannel,
  updateChannel,
  deleteChannel,
} = require('../../../src/controllers/channelController');

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

const CHANNEL_A = {
  id: 'ch-A',
  name: 'Lobby Channel',
  tenantId: 'tenant-A',
  contents: [],
  devices: [],
  creator: { id: 'ta-1', username: 'alice' },
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('channelController tenant ownership (verifyTenantOwnership)', () => {
  describe('getChannel', () => {
    it('SUPER_ADMIN without X-Tenant-Id can read any tenant channel (regression guard)', async () => {
      prisma.channel.findUnique.mockResolvedValueOnce(CHANNEL_A);

      const req = { params: { id: 'ch-A' }, user: SUPER_ADMIN, tenantId: null };
      const res = mockRes();

      await getChannel(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body).toMatchObject({ id: 'ch-A' });
    });

    it('same-tenant TENANT_ADMIN can read their channel', async () => {
      prisma.channel.findUnique.mockResolvedValueOnce(CHANNEL_A);

      const req = { params: { id: 'ch-A' }, user: TENANT_ADMIN_A, tenantId: 'tenant-A' };
      const res = mockRes();

      await getChannel(req, res);

      expect(res.statusCode).toBe(200);
    });

    it('cross-tenant TENANT_ADMIN is denied with 403', async () => {
      prisma.channel.findUnique.mockResolvedValueOnce(CHANNEL_A);

      const req = { params: { id: 'ch-A' }, user: TENANT_ADMIN_B, tenantId: 'tenant-B' };
      const res = mockRes();

      await getChannel(req, res);

      expect(res.statusCode).toBe(403);
      expect(res.body).toEqual({ error: '접근 권한이 없습니다' });
    });

    it('returns 404 when channel does not exist', async () => {
      prisma.channel.findUnique.mockResolvedValueOnce(null);

      const req = { params: { id: 'missing' }, user: SUPER_ADMIN, tenantId: null };
      const res = mockRes();

      await getChannel(req, res);

      expect(res.statusCode).toBe(404);
    });
  });

  describe('updateChannel', () => {
    it('SUPER_ADMIN without X-Tenant-Id can update any tenant channel (regression guard)', async () => {
      prisma.channel.findUnique.mockResolvedValueOnce(CHANNEL_A);
      prisma.channel.update.mockResolvedValueOnce({ ...CHANNEL_A, name: 'Renamed' });

      const req = {
        params: { id: 'ch-A' },
        body: { name: 'Renamed' },
        user: SUPER_ADMIN,
        tenantId: null,
      };
      const res = mockRes();

      await updateChannel(req, res);

      expect(res.statusCode).toBe(200);
      expect(prisma.channel.update).toHaveBeenCalled();
    });

    it('same-tenant TENANT_ADMIN can update their channel', async () => {
      prisma.channel.findUnique.mockResolvedValueOnce(CHANNEL_A);
      prisma.channel.update.mockResolvedValueOnce(CHANNEL_A);

      const req = {
        params: { id: 'ch-A' },
        body: { name: 'Updated' },
        user: TENANT_ADMIN_A,
        tenantId: 'tenant-A',
      };
      const res = mockRes();

      await updateChannel(req, res);

      expect(res.statusCode).toBe(200);
    });

    it('cross-tenant TENANT_ADMIN cannot update and gets 403', async () => {
      prisma.channel.findUnique.mockResolvedValueOnce(CHANNEL_A);

      const req = {
        params: { id: 'ch-A' },
        body: { name: 'Hijacked' },
        user: TENANT_ADMIN_B,
        tenantId: 'tenant-B',
      };
      const res = mockRes();

      await updateChannel(req, res);

      expect(res.statusCode).toBe(403);
      expect(res.body).toEqual({ error: '접근 권한이 없습니다' });
      expect(prisma.channel.update).not.toHaveBeenCalled();
    });
  });

  describe('deleteChannel', () => {
    it('SUPER_ADMIN without X-Tenant-Id can delete any tenant channel (regression guard)', async () => {
      prisma.channel.findUnique.mockResolvedValueOnce(CHANNEL_A);
      prisma.channel.delete.mockResolvedValueOnce(CHANNEL_A);

      const req = { params: { id: 'ch-A' }, user: SUPER_ADMIN, tenantId: null };
      const res = mockRes();

      await deleteChannel(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({ message: '채널이 삭제되었습니다' });
      expect(prisma.channel.delete).toHaveBeenCalledWith({ where: { id: 'ch-A' } });
    });

    it('same-tenant TENANT_ADMIN can delete their channel', async () => {
      prisma.channel.findUnique.mockResolvedValueOnce(CHANNEL_A);
      prisma.channel.delete.mockResolvedValueOnce(CHANNEL_A);

      const req = { params: { id: 'ch-A' }, user: TENANT_ADMIN_A, tenantId: 'tenant-A' };
      const res = mockRes();

      await deleteChannel(req, res);

      expect(res.statusCode).toBe(200);
    });

    it('cross-tenant TENANT_ADMIN cannot delete and gets 403', async () => {
      prisma.channel.findUnique.mockResolvedValueOnce(CHANNEL_A);

      const req = { params: { id: 'ch-A' }, user: TENANT_ADMIN_B, tenantId: 'tenant-B' };
      const res = mockRes();

      await deleteChannel(req, res);

      expect(res.statusCode).toBe(403);
      expect(res.body).toEqual({ error: '접근 권한이 없습니다' });
      expect(prisma.channel.delete).not.toHaveBeenCalled();
    });
  });
});
