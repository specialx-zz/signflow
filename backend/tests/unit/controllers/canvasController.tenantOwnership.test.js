/**
 * Regression guard for canvasController tenant ownership checks
 *
 * Bug background:
 *   updateCanvas / getCanvas compared `req.tenantId && content.tenantId !== req.tenantId`
 *   directly. This breaks for SUPER_ADMIN: tenantContext middleware sets req.tenantId = null
 *   when no X-Tenant-Id header is sent, so the guard incorrectly passes through (was correct
 *   by accident for SUPER_ADMIN without tenantId, but wrong semantics — relies on falsy null).
 *
 *   Fix: route through verifyTenantOwnership(resource, req) which explicitly handles
 *   the SUPER_ADMIN-without-tenant case and returns true.
 *
 * These tests pin the corrected behaviour for updateCanvas and getCanvas.
 */

jest.mock('../../../src/utils/prisma', () => ({
  content: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  },
  auditLog: {
    create: jest.fn(),
  },
}));

const prisma = require('../../../src/utils/prisma');
const {
  updateCanvas,
  getCanvas,
} = require('../../../src/controllers/canvasController');

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

const CANVAS_A = {
  id: 'canvas-A',
  name: 'Lobby Canvas',
  isCanvas: true,
  canvasJson: '{"canvas":{"width":1920,"height":1080}}',
  tenantId: 'tenant-A',
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('canvasController tenant ownership (verifyTenantOwnership)', () => {
  describe('updateCanvas', () => {
    it('SUPER_ADMIN without X-Tenant-Id can update any tenant canvas (regression guard)', async () => {
      prisma.content.findUnique.mockResolvedValueOnce(CANVAS_A);
      prisma.content.update.mockResolvedValueOnce({ ...CANVAS_A, name: 'Updated' });

      const req = {
        params: { id: 'canvas-A' },
        body: { name: 'Updated' },
        user: SUPER_ADMIN,
        tenantId: null,
      };
      const res = mockRes();

      await updateCanvas(req, res);

      expect(res.statusCode).toBe(200);
      expect(prisma.content.update).toHaveBeenCalled();
    });

    it('same-tenant TENANT_ADMIN can update their canvas', async () => {
      prisma.content.findUnique.mockResolvedValueOnce(CANVAS_A);
      prisma.content.update.mockResolvedValueOnce(CANVAS_A);

      const req = {
        params: { id: 'canvas-A' },
        body: { name: 'Renamed' },
        user: TENANT_ADMIN_A,
        tenantId: 'tenant-A',
      };
      const res = mockRes();

      await updateCanvas(req, res);

      expect(res.statusCode).toBe(200);
    });

    it('cross-tenant TENANT_ADMIN cannot update and gets 403', async () => {
      prisma.content.findUnique.mockResolvedValueOnce(CANVAS_A);

      const req = {
        params: { id: 'canvas-A' },
        body: { name: 'Hijacked' },
        user: TENANT_ADMIN_B,
        tenantId: 'tenant-B',
      };
      const res = mockRes();

      await updateCanvas(req, res);

      expect(res.statusCode).toBe(403);
      expect(res.body).toEqual({ error: '접근 권한이 없습니다' });
      expect(prisma.content.update).not.toHaveBeenCalled();
    });

    it('returns 404 when canvas does not exist', async () => {
      prisma.content.findUnique.mockResolvedValueOnce(null);

      const req = {
        params: { id: 'missing' },
        body: {},
        user: SUPER_ADMIN,
        tenantId: null,
      };
      const res = mockRes();

      await updateCanvas(req, res);

      expect(res.statusCode).toBe(404);
    });
  });

  describe('getCanvas', () => {
    it('SUPER_ADMIN without X-Tenant-Id can read any tenant canvas (regression guard)', async () => {
      prisma.content.findUnique.mockResolvedValueOnce(CANVAS_A);

      const req = {
        params: { id: 'canvas-A' },
        user: SUPER_ADMIN,
        tenantId: null,
      };
      const res = mockRes();

      await getCanvas(req, res);

      expect(res.statusCode).toBe(200);
    });

    it('same-tenant TENANT_ADMIN can read their canvas', async () => {
      prisma.content.findUnique.mockResolvedValueOnce(CANVAS_A);

      const req = {
        params: { id: 'canvas-A' },
        user: TENANT_ADMIN_A,
        tenantId: 'tenant-A',
      };
      const res = mockRes();

      await getCanvas(req, res);

      expect(res.statusCode).toBe(200);
    });

    it('cross-tenant TENANT_ADMIN cannot read and gets 403', async () => {
      prisma.content.findUnique.mockResolvedValueOnce(CANVAS_A);

      const req = {
        params: { id: 'canvas-A' },
        user: TENANT_ADMIN_B,
        tenantId: 'tenant-B',
      };
      const res = mockRes();

      await getCanvas(req, res);

      expect(res.statusCode).toBe(403);
      expect(res.body).toEqual({ error: '접근 권한이 없습니다' });
    });
  });
});
