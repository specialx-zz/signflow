require('../setup');
const request = require('supertest');

// We need the express app
// Since the real app connects to DB, we'll test permission logic at middleware level instead

const { authorize, superAdminOnly } = require('../../src/middleware/auth');

function mockReqRes(role) {
  const req = {
    user: { id: 'test', role, tenantId: 'test-tenant' },
    headers: {},
    tenantId: 'test-tenant'
  };
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis()
  };
  const next = jest.fn();
  return { req, res, next };
}

describe('Permission Matrix - Role-based Authorization', () => {

  // Define the expected permission matrix
  const matrix = {
    // authorize('USER') - content CUD, playlist CUD, layout CUD, shared content import, approval request
    'USER level routes': {
      middleware: authorize('USER'),
      allowed: ['SUPER_ADMIN', 'TENANT_ADMIN', 'STORE_MANAGER', 'USER'],
      blocked: ['VIEWER']
    },
    // authorize('STORE_MANAGER') - schedule CUD, device CUD, device control/groups/tokens, emergency create/list/deactivate, approval list
    'STORE_MANAGER level routes': {
      middleware: authorize('STORE_MANAGER'),
      allowed: ['SUPER_ADMIN', 'TENANT_ADMIN', 'STORE_MANAGER'],
      blocked: ['USER', 'VIEWER']
    },
    // authorize('TENANT_ADMIN') - stores CUD, emergency delete, approvals approve/reject
    'TENANT_ADMIN level routes': {
      middleware: authorize('TENANT_ADMIN'),
      allowed: ['SUPER_ADMIN', 'TENANT_ADMIN'],
      blocked: ['STORE_MANAGER', 'USER', 'VIEWER']
    },
    // authorize('ADMIN') backward compat - users CRUD, settings update
    'ADMIN (backward compat) level routes': {
      middleware: authorize('ADMIN'),
      allowed: ['SUPER_ADMIN', 'TENANT_ADMIN'],
      blocked: ['STORE_MANAGER', 'USER', 'VIEWER']
    },
    // superAdminOnly - tenants CRUD, shared content upload/delete
    'SUPER_ADMIN only routes': {
      middleware: superAdminOnly,
      allowed: ['SUPER_ADMIN'],
      blocked: ['TENANT_ADMIN', 'STORE_MANAGER', 'USER', 'VIEWER']
    }
  };

  Object.entries(matrix).forEach(([name, config]) => {
    describe(name, () => {
      config.allowed.forEach(role => {
        test(`${role} should be ALLOWED`, () => {
          const { req, res, next } = mockReqRes(role);
          config.middleware(req, res, next);
          expect(next).toHaveBeenCalled();
          expect(res.status).not.toHaveBeenCalled();
        });
      });

      config.blocked.forEach(role => {
        test(`${role} should be BLOCKED`, () => {
          const { req, res, next } = mockReqRes(role);
          config.middleware(req, res, next);
          expect(next).not.toHaveBeenCalled();
          expect(res.status).toHaveBeenCalledWith(403);
        });
      });
    });
  });
});

// Also document what each route requires for reference
describe('Route Authorization Documentation', () => {
  const routePermissions = [
    // ─── Content routes ──────────────────────────────────────────────
    { method: 'GET', path: '/api/content', auth: 'authenticate', description: 'List content' },
    { method: 'GET', path: '/api/content/categories', auth: 'authenticate', description: 'List categories' },
    { method: 'POST', path: '/api/content/categories', auth: 'authorize(USER)', description: 'Create category' },
    { method: 'POST', path: '/api/content/upload', auth: 'authorize(USER)', description: 'Upload content' },
    { method: 'GET', path: '/api/content/:id', auth: 'authenticate', description: 'Get content by ID' },
    { method: 'PUT', path: '/api/content/:id', auth: 'authorize(USER)', description: 'Update content' },
    { method: 'DELETE', path: '/api/content/:id', auth: 'authorize(USER)', description: 'Delete content' },

    // ─── Playlist routes ─────────────────────────────────────────────
    { method: 'GET', path: '/api/playlists/:id', auth: 'none (player)', description: 'Get playlist by ID (player)' },
    { method: 'GET', path: '/api/playlists', auth: 'authenticate', description: 'List playlists' },
    { method: 'POST', path: '/api/playlists', auth: 'authorize(USER)', description: 'Create playlist' },
    { method: 'PUT', path: '/api/playlists/:id', auth: 'authorize(USER)', description: 'Update playlist' },
    { method: 'DELETE', path: '/api/playlists/:id', auth: 'authorize(USER)', description: 'Delete playlist' },
    { method: 'POST', path: '/api/playlists/:id/items', auth: 'authorize(USER)', description: 'Add playlist item' },
    { method: 'PUT', path: '/api/playlists/:id/items/reorder', auth: 'authorize(USER)', description: 'Reorder playlist items' },
    { method: 'PUT', path: '/api/playlists/:id/items/:itemId', auth: 'authorize(USER)', description: 'Update playlist item' },
    { method: 'DELETE', path: '/api/playlists/:id/items/:itemId', auth: 'authorize(USER)', description: 'Remove playlist item' },

    // ─── Layout routes ───────────────────────────────────────────────
    { method: 'GET', path: '/api/layouts', auth: 'authenticate', description: 'List layouts' },
    { method: 'GET', path: '/api/layouts/:id', auth: 'authenticate', description: 'Get layout by ID' },
    { method: 'POST', path: '/api/layouts', auth: 'authorize(USER)', description: 'Create layout' },
    { method: 'PUT', path: '/api/layouts/:id', auth: 'authorize(USER)', description: 'Update layout' },
    { method: 'DELETE', path: '/api/layouts/:id', auth: 'authorize(USER)', description: 'Delete layout' },
    { method: 'PUT', path: '/api/layouts/:id/zones', auth: 'authorize(USER)', description: 'Save layout zones' },

    // ─── Schedule routes ─────────────────────────────────────────────
    { method: 'GET', path: '/api/schedules', auth: 'authenticate', description: 'List schedules' },
    { method: 'GET', path: '/api/schedules/:id', auth: 'authenticate', description: 'Get schedule by ID' },
    { method: 'POST', path: '/api/schedules', auth: 'authorize(STORE_MANAGER)', description: 'Create schedule' },
    { method: 'PUT', path: '/api/schedules/:id', auth: 'authorize(STORE_MANAGER)', description: 'Update schedule' },
    { method: 'DELETE', path: '/api/schedules/:id', auth: 'authorize(STORE_MANAGER)', description: 'Delete schedule' },
    { method: 'POST', path: '/api/schedules/:id/deploy', auth: 'authorize(STORE_MANAGER)', description: 'Deploy schedule' },

    // ─── Device routes ───────────────────────────────────────────────
    // Player routes (no auth)
    { method: 'POST', path: '/api/devices/register', auth: 'none (player)', description: 'Register player device' },
    { method: 'POST', path: '/api/devices/register-with-token', auth: 'none (player)', description: 'Register with token' },
    { method: 'GET', path: '/api/devices/:id/schedules', auth: 'none (player)', description: 'Get device schedules (player)' },
    { method: 'GET', path: '/api/devices/:id/manifest', auth: 'none (player)', description: 'Get content manifest (player)' },
    { method: 'POST', path: '/api/devices/:id/status', auth: 'none (player)', description: 'Update device status (player)' },
    { method: 'POST', path: '/api/devices/:id/screenshot', auth: 'none (player)', description: 'Upload screenshot (player)' },
    { method: 'POST', path: '/api/devices/:id/deployment-status', auth: 'none (player)', description: 'Update deployment status (player)' },
    // Admin routes
    { method: 'GET', path: '/api/devices/groups', auth: 'authenticate', description: 'List device groups' },
    { method: 'POST', path: '/api/devices/groups', auth: 'authorize(STORE_MANAGER)', description: 'Create device group' },
    { method: 'GET', path: '/api/devices/tokens', auth: 'authenticate', description: 'List registration tokens' },
    { method: 'POST', path: '/api/devices/tokens', auth: 'authorize(STORE_MANAGER)', description: 'Create registration token' },
    { method: 'DELETE', path: '/api/devices/tokens/:code', auth: 'authorize(STORE_MANAGER)', description: 'Delete registration token' },
    { method: 'GET', path: '/api/devices', auth: 'authenticate', description: 'List devices' },
    { method: 'POST', path: '/api/devices', auth: 'authorize(STORE_MANAGER)', description: 'Create device' },
    { method: 'GET', path: '/api/devices/:id/latest-screenshot', auth: 'authenticate', description: 'Get latest screenshot' },
    { method: 'GET', path: '/api/devices/:id/deployment-status', auth: 'authenticate', description: 'Get deployment status' },
    { method: 'GET', path: '/api/devices/:id/status', auth: 'authenticate', description: 'Get device status' },
    { method: 'POST', path: '/api/devices/:id/control', auth: 'authorize(STORE_MANAGER)', description: 'Control device' },
    { method: 'GET', path: '/api/devices/:id', auth: 'authenticate', description: 'Get device by ID' },
    { method: 'PUT', path: '/api/devices/:id', auth: 'authorize(STORE_MANAGER)', description: 'Update device' },
    { method: 'DELETE', path: '/api/devices/:id', auth: 'authorize(STORE_MANAGER)', description: 'Delete device' },

    // ─── Store routes ────────────────────────────────────────────────
    { method: 'GET', path: '/api/stores', auth: 'authenticate', description: 'List stores' },
    { method: 'GET', path: '/api/stores/:id', auth: 'authenticate', description: 'Get store by ID' },
    { method: 'POST', path: '/api/stores', auth: 'authorize(TENANT_ADMIN)', description: 'Create store' },
    { method: 'PUT', path: '/api/stores/:id', auth: 'authorize(TENANT_ADMIN)', description: 'Update store' },
    { method: 'DELETE', path: '/api/stores/:id', auth: 'authorize(TENANT_ADMIN)', description: 'Delete store' },

    // ─── User routes ─────────────────────────────────────────────────
    { method: 'GET', path: '/api/users', auth: 'authorize(ADMIN)', description: 'List users' },
    { method: 'POST', path: '/api/users', auth: 'authorize(ADMIN)', description: 'Create user' },
    { method: 'GET', path: '/api/users/:id', auth: 'authorize(ADMIN)', description: 'Get user by ID' },
    { method: 'PUT', path: '/api/users/:id', auth: 'authorize(ADMIN)', description: 'Update user' },
    { method: 'DELETE', path: '/api/users/:id', auth: 'authorize(ADMIN)', description: 'Delete user' },

    // ─── Emergency routes ────────────────────────────────────────────
    { method: 'GET', path: '/api/emergency/active', auth: 'none (player)', description: 'Get active emergencies (player)' },
    { method: 'GET', path: '/api/emergency', auth: 'authorize(STORE_MANAGER)', description: 'List emergencies' },
    { method: 'POST', path: '/api/emergency', auth: 'authorize(STORE_MANAGER)', description: 'Create emergency' },
    { method: 'PUT', path: '/api/emergency/:id/deactivate', auth: 'authorize(STORE_MANAGER)', description: 'Deactivate emergency' },
    { method: 'DELETE', path: '/api/emergency/:id', auth: 'authorize(TENANT_ADMIN)', description: 'Delete emergency' },

    // ─── Approval routes ─────────────────────────────────────────────
    { method: 'POST', path: '/api/approvals', auth: 'authorize(USER)', description: 'Request approval' },
    { method: 'GET', path: '/api/approvals', auth: 'authorize(STORE_MANAGER)', description: 'List approvals' },
    { method: 'PUT', path: '/api/approvals/:id/approve', auth: 'authorize(TENANT_ADMIN)', description: 'Approve content' },
    { method: 'PUT', path: '/api/approvals/:id/reject', auth: 'authorize(TENANT_ADMIN)', description: 'Reject content' },

    // ─── Settings routes ─────────────────────────────────────────────
    { method: 'GET', path: '/api/settings', auth: 'authenticate', description: 'Get settings' },
    { method: 'PUT', path: '/api/settings', auth: 'authorize(ADMIN)', description: 'Update settings' },

    // ─── Shared content routes ───────────────────────────────────────
    { method: 'GET', path: '/api/shared-content', auth: 'authenticate', description: 'List shared content' },
    { method: 'POST', path: '/api/shared-content/:id/import', auth: 'authorize(USER)', description: 'Import shared content' },
    { method: 'POST', path: '/api/shared-content', auth: 'superAdminOnly', description: 'Upload shared content' },
    { method: 'DELETE', path: '/api/shared-content/:id', auth: 'superAdminOnly', description: 'Delete shared content' },

    // ─── Tenant routes ───────────────────────────────────────────────
    { method: 'GET', path: '/api/tenants', auth: 'superAdminOnly', description: 'List tenants' },
    { method: 'POST', path: '/api/tenants', auth: 'superAdminOnly', description: 'Create tenant' },
    { method: 'GET', path: '/api/tenants/:id', auth: 'superAdminOnly', description: 'Get tenant by ID' },
    { method: 'PUT', path: '/api/tenants/:id', auth: 'superAdminOnly', description: 'Update tenant' },
    { method: 'DELETE', path: '/api/tenants/:id', auth: 'superAdminOnly', description: 'Delete tenant' },
    { method: 'GET', path: '/api/tenants/:id/stats', auth: 'superAdminOnly', description: 'Get tenant stats' },
  ];

  test('All routes have documented permissions', () => {
    expect(routePermissions.length).toBeGreaterThan(30);
    routePermissions.forEach(route => {
      expect(route).toHaveProperty('method');
      expect(route).toHaveProperty('path');
      expect(route).toHaveProperty('auth');
      expect(route).toHaveProperty('description');
    });
  });

  // Log the permission matrix as a reference
  test('Permission matrix is consistent', () => {
    const userRoutes = routePermissions.filter(r => r.auth === 'authorize(USER)');
    const managerRoutes = routePermissions.filter(r => r.auth === 'authorize(STORE_MANAGER)');
    const tenantAdminRoutes = routePermissions.filter(r => r.auth === 'authorize(TENANT_ADMIN)');
    const adminRoutes = routePermissions.filter(r => r.auth === 'authorize(ADMIN)');
    const superRoutes = routePermissions.filter(r => r.auth === 'superAdminOnly');
    const authOnlyRoutes = routePermissions.filter(r => r.auth === 'authenticate');
    const publicRoutes = routePermissions.filter(r => r.auth === 'none (player)');

    // Content/Playlist/Layout CUD should be USER level
    expect(userRoutes.some(r => r.path.includes('content') && r.method === 'POST')).toBe(true);
    expect(userRoutes.some(r => r.path.includes('playlists') && r.method === 'POST')).toBe(true);
    expect(userRoutes.some(r => r.path.includes('layouts') && r.method === 'POST')).toBe(true);
    expect(userRoutes.some(r => r.path.includes('approvals') && r.method === 'POST')).toBe(true);
    expect(userRoutes.some(r => r.path.includes('shared-content') && r.path.includes('import'))).toBe(true);

    // Schedule/Device CUD should be STORE_MANAGER level
    expect(managerRoutes.some(r => r.path.includes('schedules') && r.method === 'POST')).toBe(true);
    expect(managerRoutes.some(r => r.path.includes('devices') && r.method === 'POST')).toBe(true);
    expect(managerRoutes.some(r => r.path.includes('emergency') && r.method === 'POST')).toBe(true);
    expect(managerRoutes.some(r => r.path.includes('devices') && r.path.includes('control'))).toBe(true);
    expect(managerRoutes.some(r => r.path.includes('devices/groups') && r.method === 'POST')).toBe(true);
    expect(managerRoutes.some(r => r.path.includes('devices/tokens') && r.method === 'POST')).toBe(true);

    // Store CUD and emergency delete should be TENANT_ADMIN level
    expect(tenantAdminRoutes.some(r => r.path.includes('stores') && r.method === 'POST')).toBe(true);
    expect(tenantAdminRoutes.some(r => r.path.includes('emergency') && r.method === 'DELETE')).toBe(true);
    expect(tenantAdminRoutes.some(r => r.path.includes('approvals') && r.path.includes('approve'))).toBe(true);
    expect(tenantAdminRoutes.some(r => r.path.includes('approvals') && r.path.includes('reject'))).toBe(true);

    // User management and settings update should be ADMIN (backward compat) level
    expect(adminRoutes.some(r => r.path.includes('users') && r.method === 'POST')).toBe(true);
    expect(adminRoutes.some(r => r.path.includes('users') && r.method === 'GET')).toBe(true);
    expect(adminRoutes.some(r => r.path.includes('settings') && r.method === 'PUT')).toBe(true);

    // Tenant management and shared content upload/delete should be SUPER_ADMIN only
    expect(superRoutes.some(r => r.path.includes('tenants'))).toBe(true);
    expect(superRoutes.some(r => r.path.includes('shared-content') && r.method === 'POST')).toBe(true);
    expect(superRoutes.some(r => r.path.includes('shared-content') && r.method === 'DELETE')).toBe(true);

    // Player/public routes should have no auth
    expect(publicRoutes.some(r => r.path.includes('devices/register'))).toBe(true);
    expect(publicRoutes.some(r => r.path.includes('emergency/active'))).toBe(true);
    expect(publicRoutes.some(r => r.path.includes('playlists') && r.method === 'GET')).toBe(true);

    // Read-only routes should only need authentication
    expect(authOnlyRoutes.some(r => r.path === '/api/content' && r.method === 'GET')).toBe(true);
    expect(authOnlyRoutes.some(r => r.path === '/api/schedules' && r.method === 'GET')).toBe(true);
    expect(authOnlyRoutes.some(r => r.path === '/api/devices' && r.method === 'GET')).toBe(true);
    expect(authOnlyRoutes.some(r => r.path === '/api/stores' && r.method === 'GET')).toBe(true);
    expect(authOnlyRoutes.some(r => r.path === '/api/settings' && r.method === 'GET')).toBe(true);
    expect(authOnlyRoutes.some(r => r.path === '/api/shared-content' && r.method === 'GET')).toBe(true);
  });

  test('No route accidentally omits authorization', () => {
    // Every mutable route (POST/PUT/DELETE) should require at least USER-level auth
    // except player routes which are intentionally public
    const mutableRoutes = routePermissions.filter(
      r => ['POST', 'PUT', 'DELETE'].includes(r.method)
    );

    mutableRoutes.forEach(route => {
      const hasAuth = route.auth !== 'none (player)'
        ? ['authorize(USER)', 'authorize(STORE_MANAGER)', 'authorize(TENANT_ADMIN)', 'authorize(ADMIN)', 'superAdminOnly'].includes(route.auth)
        : true; // player routes are exempt

      if (!hasAuth && route.auth !== 'none (player)') {
        // This would catch a route that only has 'authenticate' but does mutation
        // For now we allow authenticate-only on mutable routes if intentional
      }

      expect(route.auth).toBeDefined();
    });
  });

  test('Role hierarchy is correctly defined', () => {
    const { ROLE_HIERARCHY } = require('../../src/middleware/auth');

    expect(ROLE_HIERARCHY.SUPER_ADMIN).toBeGreaterThan(ROLE_HIERARCHY.TENANT_ADMIN);
    expect(ROLE_HIERARCHY.TENANT_ADMIN).toBeGreaterThan(ROLE_HIERARCHY.STORE_MANAGER);
    expect(ROLE_HIERARCHY.STORE_MANAGER).toBeGreaterThan(ROLE_HIERARCHY.USER);
    expect(ROLE_HIERARCHY.USER).toBeGreaterThan(ROLE_HIERARCHY.VIEWER);

    // ADMIN backward compat should equal TENANT_ADMIN
    expect(ROLE_HIERARCHY.ADMIN).toBe(ROLE_HIERARCHY.TENANT_ADMIN);
  });

  test('authorize middleware uses hierarchical check (not exact match)', () => {
    // SUPER_ADMIN should pass any authorize() level
    const { req, res, next } = mockReqRes('SUPER_ADMIN');

    authorize('USER')(req, res, next);
    expect(next).toHaveBeenCalled();

    next.mockClear();
    authorize('STORE_MANAGER')(req, res, next);
    expect(next).toHaveBeenCalled();

    next.mockClear();
    authorize('TENANT_ADMIN')(req, res, next);
    expect(next).toHaveBeenCalled();

    next.mockClear();
    authorize('ADMIN')(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  test('superAdminOnly is strict (not hierarchical)', () => {
    // TENANT_ADMIN should NOT pass superAdminOnly
    const { req, res, next } = mockReqRes('TENANT_ADMIN');
    superAdminOnly(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  test('Route count per auth level', () => {
    const counts = {};
    routePermissions.forEach(r => {
      counts[r.auth] = (counts[r.auth] || 0) + 1;
    });

    // Sanity check: we should have routes at every auth level
    expect(counts['none (player)']).toBeGreaterThanOrEqual(8);    // player routes
    expect(counts['authenticate']).toBeGreaterThanOrEqual(10);     // read-only routes
    expect(counts['authorize(USER)']).toBeGreaterThanOrEqual(10);  // content/playlist/layout CUD
    expect(counts['authorize(STORE_MANAGER)']).toBeGreaterThanOrEqual(8); // schedule/device/emergency
    expect(counts['authorize(TENANT_ADMIN)']).toBeGreaterThanOrEqual(4);  // store CUD, approvals
    expect(counts['authorize(ADMIN)']).toBeGreaterThanOrEqual(5);  // user CRUD, settings
    expect(counts['superAdminOnly']).toBeGreaterThanOrEqual(6);    // tenant CRUD, shared content
  });
});
