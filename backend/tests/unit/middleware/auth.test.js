const jwt = require('jsonwebtoken');
const { TEST_SECRET } = require('../../helpers/auth');

// Ensure JWT_SECRET is set before importing auth middleware
process.env.JWT_SECRET = TEST_SECRET;

const { authenticate, authorize, superAdminOnly, hasRole, ROLE_HIERARCHY } = require('../../../src/middleware/auth');

// ─── Helper ────────────────────────────────────────
function mockReqRes(role) {
  const req = { user: { role } };
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
  const next = jest.fn();
  return { req, res, next };
}

function mockReqForAuth(authHeader) {
  const req = { headers: { authorization: authHeader } };
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
  const next = jest.fn();
  return { req, res, next };
}

// ─── authenticate ──────────────────────────────────
describe('authenticate middleware', () => {
  test('returns 401 when no Authorization header', async () => {
    const { req, res, next } = mockReqForAuth(undefined);
    await authenticate(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'No token provided' });
    expect(next).not.toHaveBeenCalled();
  });

  test('returns 401 when Authorization header is empty string', async () => {
    const { req, res, next } = mockReqForAuth('');
    await authenticate(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'No token provided' });
    expect(next).not.toHaveBeenCalled();
  });

  test('returns 401 when Authorization header does not start with Bearer', async () => {
    const { req, res, next } = mockReqForAuth('Basic abc123');
    await authenticate(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'No token provided' });
    expect(next).not.toHaveBeenCalled();
  });

  test('returns 401 when token is the string "null"', async () => {
    const { req, res, next } = mockReqForAuth('Bearer null');
    await authenticate(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid token' });
    expect(next).not.toHaveBeenCalled();
  });

  test('returns 401 when token is the string "undefined"', async () => {
    const { req, res, next } = mockReqForAuth('Bearer undefined');
    await authenticate(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid token' });
    expect(next).not.toHaveBeenCalled();
  });

  test('returns 401 when token is invalid/malformed', async () => {
    const { req, res, next } = mockReqForAuth('Bearer not.a.valid.jwt.token');
    await authenticate(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid token' });
    expect(next).not.toHaveBeenCalled();
  });

  test('returns 401 when token is expired', async () => {
    const expiredToken = jwt.sign(
      { userId: 'test-id', email: 'test@test.com', role: 'USER', exp: Math.floor(Date.now() / 1000) - 60 },
      TEST_SECRET
    );
    const { req, res, next } = mockReqForAuth(`Bearer ${expiredToken}`);
    await authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Token expired' });
    expect(next).not.toHaveBeenCalled();
  });

  test('returns 401 when token is signed with wrong secret', async () => {
    const badToken = jwt.sign(
      { userId: 'test-id', email: 'test@test.com', role: 'USER' },
      'wrong-secret-key',
      { expiresIn: '1h' }
    );
    const { req, res, next } = mockReqForAuth(`Bearer ${badToken}`);
    await authenticate(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid token' });
    expect(next).not.toHaveBeenCalled();
  });
});

// ─── authorize ─────────────────────────────────────
describe('authorize middleware', () => {
  const ALL_ROLES = ['SUPER_ADMIN', 'TENANT_ADMIN', 'STORE_MANAGER', 'USER', 'VIEWER'];

  describe('authorize("VIEWER") allows all roles', () => {
    ALL_ROLES.forEach(role => {
      test(`allows ${role}`, () => {
        const { req, res, next } = mockReqRes(role);
        authorize('VIEWER')(req, res, next);
        expect(next).toHaveBeenCalled();
        expect(res.status).not.toHaveBeenCalled();
      });
    });
  });

  describe('authorize("USER") blocks VIEWER only', () => {
    ['SUPER_ADMIN', 'TENANT_ADMIN', 'STORE_MANAGER', 'USER'].forEach(role => {
      test(`allows ${role}`, () => {
        const { req, res, next } = mockReqRes(role);
        authorize('USER')(req, res, next);
        expect(next).toHaveBeenCalled();
        expect(res.status).not.toHaveBeenCalled();
      });
    });

    test('blocks VIEWER', () => {
      const { req, res, next } = mockReqRes('VIEWER');
      authorize('USER')(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ error: 'Insufficient permissions' });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('authorize("STORE_MANAGER") blocks USER and VIEWER', () => {
    ['SUPER_ADMIN', 'TENANT_ADMIN', 'STORE_MANAGER'].forEach(role => {
      test(`allows ${role}`, () => {
        const { req, res, next } = mockReqRes(role);
        authorize('STORE_MANAGER')(req, res, next);
        expect(next).toHaveBeenCalled();
        expect(res.status).not.toHaveBeenCalled();
      });
    });

    ['USER', 'VIEWER'].forEach(role => {
      test(`blocks ${role}`, () => {
        const { req, res, next } = mockReqRes(role);
        authorize('STORE_MANAGER')(req, res, next);
        expect(res.status).toHaveBeenCalledWith(403);
        expect(next).not.toHaveBeenCalled();
      });
    });
  });

  describe('authorize("TENANT_ADMIN") blocks STORE_MANAGER, USER, VIEWER', () => {
    ['SUPER_ADMIN', 'TENANT_ADMIN'].forEach(role => {
      test(`allows ${role}`, () => {
        const { req, res, next } = mockReqRes(role);
        authorize('TENANT_ADMIN')(req, res, next);
        expect(next).toHaveBeenCalled();
        expect(res.status).not.toHaveBeenCalled();
      });
    });

    ['STORE_MANAGER', 'USER', 'VIEWER'].forEach(role => {
      test(`blocks ${role}`, () => {
        const { req, res, next } = mockReqRes(role);
        authorize('TENANT_ADMIN')(req, res, next);
        expect(res.status).toHaveBeenCalledWith(403);
        expect(next).not.toHaveBeenCalled();
      });
    });
  });

  describe('authorize("SUPER_ADMIN") blocks all except SUPER_ADMIN', () => {
    test('allows SUPER_ADMIN', () => {
      const { req, res, next } = mockReqRes('SUPER_ADMIN');
      authorize('SUPER_ADMIN')(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    ['TENANT_ADMIN', 'STORE_MANAGER', 'USER', 'VIEWER'].forEach(role => {
      test(`blocks ${role}`, () => {
        const { req, res, next } = mockReqRes(role);
        authorize('SUPER_ADMIN')(req, res, next);
        expect(res.status).toHaveBeenCalledWith(403);
        expect(next).not.toHaveBeenCalled();
      });
    });
  });

  describe('backward compatibility: authorize("ADMIN") works same as authorize("TENANT_ADMIN")', () => {
    ['SUPER_ADMIN', 'TENANT_ADMIN'].forEach(role => {
      test(`allows ${role}`, () => {
        const { req, res, next } = mockReqRes(role);
        authorize('ADMIN')(req, res, next);
        expect(next).toHaveBeenCalled();
        expect(res.status).not.toHaveBeenCalled();
      });
    });

    // ADMIN maps to level 40 (same as TENANT_ADMIN), so the ADMIN role itself also passes
    test('allows ADMIN role user', () => {
      const { req, res, next } = mockReqRes('ADMIN');
      authorize('ADMIN')(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    ['STORE_MANAGER', 'USER', 'VIEWER'].forEach(role => {
      test(`blocks ${role}`, () => {
        const { req, res, next } = mockReqRes(role);
        authorize('ADMIN')(req, res, next);
        expect(res.status).toHaveBeenCalledWith(403);
        expect(next).not.toHaveBeenCalled();
      });
    });
  });
});

// ─── superAdminOnly ────────────────────────────────
describe('superAdminOnly middleware', () => {
  test('allows SUPER_ADMIN', () => {
    const { req, res, next } = mockReqRes('SUPER_ADMIN');
    superAdminOnly(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  test('blocks TENANT_ADMIN', () => {
    const { req, res, next } = mockReqRes('TENANT_ADMIN');
    superAdminOnly(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'Super admin access required' });
    expect(next).not.toHaveBeenCalled();
  });

  ['STORE_MANAGER', 'USER', 'VIEWER'].forEach(role => {
    test(`blocks ${role}`, () => {
      const { req, res, next } = mockReqRes(role);
      superAdminOnly(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ error: 'Super admin access required' });
      expect(next).not.toHaveBeenCalled();
    });
  });
});

// ─── hasRole helper ────────────────────────────────
describe('hasRole helper', () => {
  const orderedRoles = ['SUPER_ADMIN', 'TENANT_ADMIN', 'STORE_MANAGER', 'USER', 'VIEWER'];

  orderedRoles.forEach((userRole, ui) => {
    orderedRoles.forEach((requiredRole, ri) => {
      const shouldPass = ui <= ri; // lower index = higher privilege
      test(`hasRole("${userRole}", "${requiredRole}") is ${shouldPass}`, () => {
        expect(hasRole(userRole, requiredRole)).toBe(shouldPass);
      });
    });
  });

  test('ADMIN is treated same as TENANT_ADMIN (backward compat)', () => {
    expect(hasRole('ADMIN', 'TENANT_ADMIN')).toBe(true);
    expect(hasRole('TENANT_ADMIN', 'ADMIN')).toBe(true);
    expect(hasRole('ADMIN', 'SUPER_ADMIN')).toBe(false);
    expect(hasRole('STORE_MANAGER', 'ADMIN')).toBe(false);
  });

  test('unknown role defaults to 0', () => {
    expect(hasRole('UNKNOWN', 'VIEWER')).toBe(false);
    expect(hasRole('SUPER_ADMIN', 'UNKNOWN')).toBe(true);
  });
});
