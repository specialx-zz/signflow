/**
 * Integration tests for the Auth API.
 *
 * These hit the real Express stack (middleware, controllers, Prisma + SQLite)
 * so they validate the full request lifecycle including JWT generation,
 * password hashing, tenant context, and role-based access control.
 */
require('../setup');
const request = require('supertest');
const { getTestApp } = require('../helpers/testApp');
const { seedTestData, cleanTestData, TEST_PASSWORD } = require('../helpers/seedTestDb');
const prisma = require('../../src/utils/prisma');

let app;
let testData;
const tokens = {};

beforeAll(async () => {
  app = getTestApp();
  testData = await seedTestData();
});

afterAll(async () => {
  await cleanTestData();
  await prisma.$disconnect();
});

// ---------------------------------------------------------------------------
// POST /api/auth/login
// ---------------------------------------------------------------------------
describe('Auth API Integration', () => {

  describe('POST /api/auth/login', () => {

    test('should login with valid TENANT_ADMIN credentials', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test-admin@integ.com', password: TEST_PASSWORD });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('token');
      expect(res.body.user).toHaveProperty('email', 'test-admin@integ.com');
      expect(res.body.user).toHaveProperty('role', 'TENANT_ADMIN');
      tokens.tenantAdmin = res.body.token;
    });

    test('should login as each role and store tokens', async () => {
      const logins = [
        { email: 'test-super@integ.com', key: 'superAdmin', role: 'SUPER_ADMIN' },
        { email: 'test-manager@integ.com', key: 'storeManager', role: 'STORE_MANAGER' },
        { email: 'test-user@integ.com', key: 'user', role: 'USER' },
        { email: 'test-viewer@integ.com', key: 'viewer', role: 'VIEWER' },
      ];

      for (const login of logins) {
        const res = await request(app)
          .post('/api/auth/login')
          .send({ email: login.email, password: TEST_PASSWORD });

        expect(res.status).toBe(200);
        expect(res.body.user.role).toBe(login.role);
        tokens[login.key] = res.body.token;
      }
    });

    test('should reject invalid password', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test-admin@integ.com', password: 'wrong-password' });

      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty('error');
    });

    test('should reject nonexistent email', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'nobody@integ.com', password: TEST_PASSWORD });

      expect(res.status).toBe(401);
    });

    test('should reject missing fields', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({});

      expect(res.status).toBe(400);
    });

    test('should reject when only email is provided', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test-admin@integ.com' });

      expect(res.status).toBe(400);
    });
  });

  // -------------------------------------------------------------------------
  // GET /api/auth/me
  // -------------------------------------------------------------------------
  describe('GET /api/auth/me', () => {

    test('should return current user with valid token', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${tokens.tenantAdmin}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('email', 'test-admin@integ.com');
      expect(res.body).toHaveProperty('role', 'TENANT_ADMIN');
    });

    test('should reject request without token', async () => {
      const res = await request(app).get('/api/auth/me');
      expect(res.status).toBe(401);
    });

    test('should reject request with malformed token', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer not-a-real-token');

      expect(res.status).toBe(401);
    });
  });

  // -------------------------------------------------------------------------
  // Role-based access control with real tokens
  // -------------------------------------------------------------------------
  describe('Role-based access with real tokens', () => {

    // VIEWER can read content (GET is open to any authenticated user)
    test('VIEWER can GET /api/content', async () => {
      const res = await request(app)
        .get('/api/content')
        .set('Authorization', `Bearer ${tokens.viewer}`);

      expect(res.status).toBe(200);
    });

    // VIEWER cannot upload content (requires authorize('USER') = USER+)
    test('VIEWER cannot POST /api/content/upload', async () => {
      const res = await request(app)
        .post('/api/content/upload')
        .set('Authorization', `Bearer ${tokens.viewer}`);

      expect(res.status).toBe(403);
    });

    // USER cannot create schedules (requires authorize('STORE_MANAGER'))
    test('USER cannot POST /api/schedules', async () => {
      const res = await request(app)
        .post('/api/schedules')
        .set('Authorization', `Bearer ${tokens.user}`)
        .send({ name: 'test schedule' });

      expect(res.status).toBe(403);
    });

    // STORE_MANAGER cannot create stores (requires authorize('TENANT_ADMIN'))
    test('STORE_MANAGER cannot POST /api/stores', async () => {
      const res = await request(app)
        .post('/api/stores')
        .set('Authorization', `Bearer ${tokens.storeManager}`)
        .send({ name: 'test store' });

      expect(res.status).toBe(403);
    });

    // TENANT_ADMIN can access stores list
    test('TENANT_ADMIN can GET /api/stores', async () => {
      const res = await request(app)
        .get('/api/stores')
        .set('Authorization', `Bearer ${tokens.tenantAdmin}`);

      expect(res.status).toBe(200);
    });

    // SUPER_ADMIN can access stores list
    test('SUPER_ADMIN can GET /api/stores', async () => {
      const res = await request(app)
        .get('/api/stores')
        .set('Authorization', `Bearer ${tokens.superAdmin}`);

      expect(res.status).toBe(200);
    });

    // Unauthenticated requests must be rejected on all protected routes
    test('Unauthenticated requests are rejected on protected routes', async () => {
      const protectedRoutes = [
        '/api/content',
        '/api/playlists',
        '/api/schedules',
        '/api/devices',
        '/api/layouts',
        '/api/stores',
      ];

      for (const route of protectedRoutes) {
        const res = await request(app).get(route);
        expect(res.status).toBe(401);
      }
    });
  });

  // -------------------------------------------------------------------------
  // Health check (smoke test)
  // -------------------------------------------------------------------------
  describe('Health check', () => {
    test('GET /health returns ok', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('status', 'ok');
    });

    test('GET /api/health returns ok', async () => {
      const res = await request(app).get('/api/health');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('status', 'ok');
    });
  });
});
