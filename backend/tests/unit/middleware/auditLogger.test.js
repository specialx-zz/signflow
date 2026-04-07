process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing';

jest.mock('../../../src/utils/prisma', () => ({
  auditLog: {
    create: jest.fn().mockResolvedValue({})
  }
}));

const { auditLogger } = require('../../../src/middleware/auditLogger');
const prisma = require('../../../src/utils/prisma');

function mockReqRes(method = 'POST', path = '/api/content') {
  const req = {
    method,
    path,
    originalUrl: path,
    user: { id: 'user-1', email: 'test@test.com', role: 'USER' },
    tenantId: 'tenant-1',
    ip: '127.0.0.1',
    get: jest.fn().mockReturnValue('test-agent'),
    headers: { 'user-agent': 'test-agent' }
  };
  const originalJson = jest.fn();
  const res = {
    json: originalJson,
    statusCode: 200,
    status: jest.fn(function (code) { this.statusCode = code; return this; })
  };
  const next = jest.fn();
  return { req, res, next, originalJson };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('auditLogger middleware', () => {

  // ── 1. Skips GET/HEAD/OPTIONS requests ──────────────────────────────

  describe('skips GET/HEAD/OPTIONS requests', () => {
    it.each(['GET', 'HEAD', 'OPTIONS'])('calls next() and does NOT wrap res.json for %s', (method) => {
      const { req, res, next, originalJson } = mockReqRes(method, '/api/content');

      auditLogger(req, res, next);

      expect(next).toHaveBeenCalled();
      // res.json should still be the original function (not wrapped)
      expect(res.json).toBe(originalJson);
    });
  });

  // ── 2. Wraps res.json for CUD methods ───────────────────────────────

  describe('wraps res.json for POST/PUT/PATCH/DELETE', () => {
    it.each(['POST', 'PUT', 'PATCH', 'DELETE'])('replaces res.json for %s and still calls next()', (method) => {
      const { req, res, next, originalJson } = mockReqRes(method, '/api/content');

      auditLogger(req, res, next);

      expect(next).toHaveBeenCalled();
      // res.json should have been replaced with a wrapper
      expect(res.json).not.toBe(originalJson);
      expect(typeof res.json).toBe('function');
    });

    it('wrapped res.json calls the original res.json with the body', () => {
      const { req, res, next, originalJson } = mockReqRes('POST', '/api/content');

      auditLogger(req, res, next);

      const body = { success: true, data: { id: '123' } };
      res.json(body);

      expect(originalJson).toHaveBeenCalledWith(body);
    });
  });

  // ── 3. Action mapping (method → action) ─────────────────────────────

  describe('action mapping', () => {
    it.each([
      ['POST', 'CREATE'],
      ['PUT', 'UPDATE'],
      ['PATCH', 'UPDATE'],
      ['DELETE', 'DELETE'],
    ])('%s → %s', async (method, expectedAction) => {
      const { req, res, next } = mockReqRes(method, '/api/content');

      auditLogger(req, res, next);
      res.json({ ok: true });

      // setImmediate is used internally; flush it
      await new Promise((r) => setImmediate(r));

      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ action: expectedAction }),
        })
      );
    });
  });

  // ── 4. Special path detection ───────────────────────────────────────

  describe('special path detection', () => {
    it.each([
      ['/api/auth/login', 'LOGIN'],
      ['/api/auth/logout', 'LOGOUT'],
      ['/api/auth/register', 'REGISTER'],
      ['/api/devices/control', 'CONTROL'],
      ['/api/schedules/deploy', 'DEPLOY'],
      ['/api/devices/screenshot', 'SCREENSHOT'],
    ])('path %s → action %s', async (path, expectedAction) => {
      const { req, res, next } = mockReqRes('POST', path);

      auditLogger(req, res, next);
      res.json({ ok: true });

      await new Promise((r) => setImmediate(r));

      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ action: expectedAction }),
        })
      );
    });
  });

  // ── 5. Only logs on 2xx responses ───────────────────────────────────

  describe('only logs on 2xx responses', () => {
    it.each([200, 201, 204])('logs for status %i', async (statusCode) => {
      const { req, res, next } = mockReqRes('POST', '/api/content');
      res.statusCode = statusCode;

      auditLogger(req, res, next);
      res.json({ ok: true });

      await new Promise((r) => setImmediate(r));

      expect(prisma.auditLog.create).toHaveBeenCalled();
    });

    it.each([400, 401, 403, 404, 500])('does NOT log for status %i', async (statusCode) => {
      const { req, res, next } = mockReqRes('POST', '/api/content');
      res.statusCode = statusCode;

      auditLogger(req, res, next);
      res.json({ error: 'fail' });

      await new Promise((r) => setImmediate(r));

      expect(prisma.auditLog.create).not.toHaveBeenCalled();
    });

    it('does NOT log when req.user is absent', async () => {
      const { req, res, next } = mockReqRes('POST', '/api/content');
      req.user = null;

      auditLogger(req, res, next);
      res.json({ ok: true });

      await new Promise((r) => setImmediate(r));

      expect(prisma.auditLog.create).not.toHaveBeenCalled();
    });
  });

  // ── 6. Extracts target from URL path ────────────────────────────────

  describe('extracts target from URL path', () => {
    it.each([
      ['/api/content', 'Content'],
      ['/api/devices', 'Device'],
      ['/api/playlists', 'Playlist'],
      ['/api/schedules', 'Schedule'],
      ['/api/users', 'User'],
      ['/api/tenants', 'Tenant'],
      ['/api/stores', 'Store'],
      ['/api/layouts', 'Layout'],
      ['/api/subscriptions', 'Subscription'],
      ['/api/settings', 'Settings'],
    ])('%s → target %s', async (path, expectedTarget) => {
      const { req, res, next } = mockReqRes('POST', path);

      auditLogger(req, res, next);
      res.json({ ok: true });

      await new Promise((r) => setImmediate(r));

      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ target: expectedTarget }),
        })
      );
    });

    it('includes resource ID when path has a long segment', async () => {
      const uuid = '550e8400-e29b-41d4-a716-446655440000';
      const { req, res, next } = mockReqRes('PUT', `/api/users/${uuid}`);

      auditLogger(req, res, next);
      res.json({ ok: true });

      await new Promise((r) => setImmediate(r));

      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ target: `User:${uuid}` }),
        })
      );
    });

    it('uses raw segment for unmapped resources', async () => {
      const { req, res, next } = mockReqRes('POST', '/api/widgets');

      auditLogger(req, res, next);
      res.json({ ok: true });

      await new Promise((r) => setImmediate(r));

      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ target: 'widgets' }),
        })
      );
    });
  });

  // ── 7. Audit log data shape ─────────────────────────────────────────

  describe('audit log record data', () => {
    it('passes correct full payload to prisma.auditLog.create', async () => {
      const { req, res, next } = mockReqRes('POST', '/api/content');

      auditLogger(req, res, next);
      res.json({ id: 'new-1' });

      await new Promise((r) => setImmediate(r));

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: {
          tenantId: 'tenant-1',
          userId: 'user-1',
          action: 'CREATE',
          target: 'Content',
          details: expect.any(String),
          ipAddress: '127.0.0.1',
        },
      });

      const details = JSON.parse(prisma.auditLog.create.mock.calls[0][0].data.details);
      expect(details).toEqual({
        method: 'POST',
        path: '/api/content',
        statusCode: 200,
        ip: '127.0.0.1',
        userAgent: 'test-agent',
      });
    });

    it('falls back to user.tenantId when req.tenantId is absent', async () => {
      const { req, res, next } = mockReqRes('POST', '/api/content');
      delete req.tenantId;
      req.user.tenantId = 'user-tenant-1';

      auditLogger(req, res, next);
      res.json({ ok: true });

      await new Promise((r) => setImmediate(r));

      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ tenantId: 'user-tenant-1' }),
        })
      );
    });
  });

  // ── 8. Error resilience ─────────────────────────────────────────────

  describe('error resilience', () => {
    it('does not throw when prisma.auditLog.create rejects', async () => {
      prisma.auditLog.create.mockRejectedValueOnce(new Error('DB down'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      const { req, res, next, originalJson } = mockReqRes('POST', '/api/content');

      auditLogger(req, res, next);
      res.json({ ok: true });

      await new Promise((r) => setImmediate(r));

      // The original json should still have been called
      expect(originalJson).toHaveBeenCalledWith({ ok: true });
      expect(consoleSpy).toHaveBeenCalledWith(
        '[AuditLog] Failed to write audit log:',
        'DB down'
      );

      consoleSpy.mockRestore();
    });
  });
});
