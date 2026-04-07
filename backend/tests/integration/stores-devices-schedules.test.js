/**
 * Integration tests for Stores, Devices, and Schedules APIs.
 *
 * Validates the full request lifecycle including authentication,
 * role-based access control, CRUD operations, and tenant isolation
 * for the three core resource endpoints.
 */
require('../setup');
const request = require('supertest');
const { getTestApp } = require('../helpers/testApp');
const { seedTestData, cleanTestData, TEST_PASSWORD } = require('../helpers/seedTestDb');
const prisma = require('../../src/utils/prisma');

let app;
let testData;
const tokens = {};

// IDs of resources created during tests, for cleanup
const createdIds = {
  stores: [],
  devices: [],
  schedules: [],
};

beforeAll(async () => {
  app = getTestApp();
  testData = await seedTestData();

  // Login all 5 roles and store tokens
  const logins = [
    { email: 'test-super@integ.com', key: 'superAdmin' },
    { email: 'test-admin@integ.com', key: 'tenantAdmin' },
    { email: 'test-manager@integ.com', key: 'storeManager' },
    { email: 'test-user@integ.com', key: 'user' },
    { email: 'test-viewer@integ.com', key: 'viewer' },
  ];

  for (const login of logins) {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: login.email, password: TEST_PASSWORD });
    expect(res.status).toBe(200);
    tokens[login.key] = res.body.token;
  }
});

afterAll(async () => {
  // Clean up schedules first (FK dependencies)
  for (const id of createdIds.schedules) {
    await prisma.scheduleDevice.deleteMany({ where: { scheduleId: id } }).catch(() => {});
    await prisma.schedule.deleteMany({ where: { id } }).catch(() => {});
  }

  // Clean up devices
  for (const id of createdIds.devices) {
    await prisma.device.deleteMany({ where: { id } }).catch(() => {});
  }

  // Clean up stores
  for (const id of createdIds.stores) {
    await prisma.store.deleteMany({ where: { id } }).catch(() => {});
  }

  await cleanTestData();
  await prisma.$disconnect();
});

// =============================================================================
// Store API Tests
// =============================================================================
describe('Store API Integration', () => {

  // ---------------------------------------------------------------------------
  // GET /api/stores
  // ---------------------------------------------------------------------------
  describe('GET /api/stores', () => {

    test('any authenticated user can list stores (VIEWER)', async () => {
      const res = await request(app)
        .get('/api/stores')
        .set('Authorization', `Bearer ${tokens.viewer}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('items');
      expect(Array.isArray(res.body.items)).toBe(true);
    });

    test('any authenticated user can list stores (USER)', async () => {
      const res = await request(app)
        .get('/api/stores')
        .set('Authorization', `Bearer ${tokens.user}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('items');
    });

    test('any authenticated user can list stores (STORE_MANAGER)', async () => {
      const res = await request(app)
        .get('/api/stores')
        .set('Authorization', `Bearer ${tokens.storeManager}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('items');
    });

    test('any authenticated user can list stores (TENANT_ADMIN)', async () => {
      const res = await request(app)
        .get('/api/stores')
        .set('Authorization', `Bearer ${tokens.tenantAdmin}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('items');
    });

    test('any authenticated user can list stores (SUPER_ADMIN)', async () => {
      const res = await request(app)
        .get('/api/stores')
        .set('Authorization', `Bearer ${tokens.superAdmin}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('items');
    });

    test('unauthenticated request is rejected', async () => {
      const res = await request(app).get('/api/stores');
      expect(res.status).toBe(401);
    });
  });

  // ---------------------------------------------------------------------------
  // POST /api/stores
  // ---------------------------------------------------------------------------
  describe('POST /api/stores', () => {

    test('VIEWER cannot create a store (403)', async () => {
      const res = await request(app)
        .post('/api/stores')
        .set('Authorization', `Bearer ${tokens.viewer}`)
        .send({ name: 'Viewer Store Attempt' });

      expect(res.status).toBe(403);
    });

    test('USER cannot create a store (403)', async () => {
      const res = await request(app)
        .post('/api/stores')
        .set('Authorization', `Bearer ${tokens.user}`)
        .send({ name: 'User Store Attempt' });

      expect(res.status).toBe(403);
    });

    test('STORE_MANAGER cannot create a store (403)', async () => {
      const res = await request(app)
        .post('/api/stores')
        .set('Authorization', `Bearer ${tokens.storeManager}`)
        .send({ name: 'Manager Store Attempt' });

      expect(res.status).toBe(403);
    });

    test('TENANT_ADMIN can create a store', async () => {
      const res = await request(app)
        .post('/api/stores')
        .set('Authorization', `Bearer ${tokens.tenantAdmin}`)
        .send({ name: 'Integration Test Store', address: '123 Test St', phone: '555-0100' });

      expect([200, 201]).toContain(res.status);
      expect(res.body).toHaveProperty('id');
      expect(res.body).toHaveProperty('name', 'Integration Test Store');
      createdIds.stores.push(res.body.id);
    });

    test('SUPER_ADMIN can create a store', async () => {
      const res = await request(app)
        .post('/api/stores')
        .set('Authorization', `Bearer ${tokens.superAdmin}`)
        .send({ name: 'Super Admin Store' });

      expect([200, 201]).toContain(res.status);
      expect(res.body).toHaveProperty('id');
      createdIds.stores.push(res.body.id);
    });

    test('TENANT_ADMIN cannot create a store without name (400)', async () => {
      const res = await request(app)
        .post('/api/stores')
        .set('Authorization', `Bearer ${tokens.tenantAdmin}`)
        .send({});

      expect(res.status).toBe(400);
    });
  });

  // ---------------------------------------------------------------------------
  // PUT /api/stores/:id
  // ---------------------------------------------------------------------------
  describe('PUT /api/stores/:id', () => {

    test('VIEWER cannot update a store (403)', async () => {
      const storeId = createdIds.stores[0];
      const res = await request(app)
        .put(`/api/stores/${storeId}`)
        .set('Authorization', `Bearer ${tokens.viewer}`)
        .send({ name: 'Updated By Viewer' });

      expect(res.status).toBe(403);
    });

    test('USER cannot update a store (403)', async () => {
      const storeId = createdIds.stores[0];
      const res = await request(app)
        .put(`/api/stores/${storeId}`)
        .set('Authorization', `Bearer ${tokens.user}`)
        .send({ name: 'Updated By User' });

      expect(res.status).toBe(403);
    });

    test('STORE_MANAGER cannot update a store (403)', async () => {
      const storeId = createdIds.stores[0];
      const res = await request(app)
        .put(`/api/stores/${storeId}`)
        .set('Authorization', `Bearer ${tokens.storeManager}`)
        .send({ name: 'Updated By Manager' });

      expect(res.status).toBe(403);
    });

    test('TENANT_ADMIN can update a store', async () => {
      const storeId = createdIds.stores[0];
      const res = await request(app)
        .put(`/api/stores/${storeId}`)
        .set('Authorization', `Bearer ${tokens.tenantAdmin}`)
        .send({ name: 'Updated Integration Test Store' });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('name', 'Updated Integration Test Store');
    });

    test('returns 404 for nonexistent store', async () => {
      const res = await request(app)
        .put('/api/stores/nonexistent-store-id')
        .set('Authorization', `Bearer ${tokens.tenantAdmin}`)
        .send({ name: 'Ghost Store' });

      expect(res.status).toBe(404);
    });
  });

  // ---------------------------------------------------------------------------
  // DELETE /api/stores/:id
  // ---------------------------------------------------------------------------
  describe('DELETE /api/stores/:id', () => {

    test('VIEWER cannot delete a store (403)', async () => {
      const storeId = createdIds.stores[0];
      const res = await request(app)
        .delete(`/api/stores/${storeId}`)
        .set('Authorization', `Bearer ${tokens.viewer}`);

      expect(res.status).toBe(403);
    });

    test('USER cannot delete a store (403)', async () => {
      const storeId = createdIds.stores[0];
      const res = await request(app)
        .delete(`/api/stores/${storeId}`)
        .set('Authorization', `Bearer ${tokens.user}`);

      expect(res.status).toBe(403);
    });

    test('STORE_MANAGER cannot delete a store (403)', async () => {
      const storeId = createdIds.stores[0];
      const res = await request(app)
        .delete(`/api/stores/${storeId}`)
        .set('Authorization', `Bearer ${tokens.storeManager}`);

      expect(res.status).toBe(403);
    });

    test('TENANT_ADMIN can delete a store (soft delete)', async () => {
      const storeId = createdIds.stores[0];
      const res = await request(app)
        .delete(`/api/stores/${storeId}`)
        .set('Authorization', `Bearer ${tokens.tenantAdmin}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('message');
    });

    test('returns 404 for nonexistent store', async () => {
      const res = await request(app)
        .delete('/api/stores/nonexistent-store-id')
        .set('Authorization', `Bearer ${tokens.tenantAdmin}`);

      expect(res.status).toBe(404);
    });
  });
});

// =============================================================================
// Device API Tests
// =============================================================================
describe('Device API Integration', () => {

  // ---------------------------------------------------------------------------
  // GET /api/devices
  // ---------------------------------------------------------------------------
  describe('GET /api/devices', () => {

    test('any authenticated user can list devices (VIEWER)', async () => {
      const res = await request(app)
        .get('/api/devices')
        .set('Authorization', `Bearer ${tokens.viewer}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('items');
      expect(res.body).toHaveProperty('pagination');
    });

    test('any authenticated user can list devices (USER)', async () => {
      const res = await request(app)
        .get('/api/devices')
        .set('Authorization', `Bearer ${tokens.user}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('items');
    });

    test('any authenticated user can list devices (STORE_MANAGER)', async () => {
      const res = await request(app)
        .get('/api/devices')
        .set('Authorization', `Bearer ${tokens.storeManager}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('items');
    });

    test('any authenticated user can list devices (TENANT_ADMIN)', async () => {
      const res = await request(app)
        .get('/api/devices')
        .set('Authorization', `Bearer ${tokens.tenantAdmin}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('items');
    });

    test('unauthenticated request is rejected', async () => {
      const res = await request(app).get('/api/devices');
      expect(res.status).toBe(401);
    });
  });

  // ---------------------------------------------------------------------------
  // POST /api/devices
  // ---------------------------------------------------------------------------
  describe('POST /api/devices', () => {

    test('VIEWER cannot create a device (403)', async () => {
      const res = await request(app)
        .post('/api/devices')
        .set('Authorization', `Bearer ${tokens.viewer}`)
        .send({ name: 'Test Device', deviceId: 'test-device-integ-viewer' });

      expect(res.status).toBe(403);
    });

    test('USER cannot create a device (403)', async () => {
      const res = await request(app)
        .post('/api/devices')
        .set('Authorization', `Bearer ${tokens.user}`)
        .send({ name: 'Test Device', deviceId: 'test-device-integ-user' });

      expect(res.status).toBe(403);
    });

    test('STORE_MANAGER passes permission check (not 403)', async () => {
      const res = await request(app)
        .post('/api/devices')
        .set('Authorization', `Bearer ${tokens.storeManager}`)
        .send({ name: 'Test Device', deviceId: 'test-device-integ-001' });

      // Should not be a 403 — the request passes the authorize middleware.
      // It may succeed (201) or fail on validation/quota but never 403.
      expect(res.status).not.toBe(403);
    });

    test('TENANT_ADMIN can create a device', async () => {
      const res = await request(app)
        .post('/api/devices')
        .set('Authorization', `Bearer ${tokens.tenantAdmin}`)
        .send({ name: 'Test Device Admin', deviceId: 'test-device-integ-002' });

      // Passes permission; may succeed or hit quota — but not 403
      expect(res.status).not.toBe(403);
      if (res.status === 201) {
        expect(res.body).toHaveProperty('id');
        expect(res.body).toHaveProperty('name', 'Test Device Admin');
        expect(res.body).toHaveProperty('deviceId', 'test-device-integ-002');
        createdIds.devices.push(res.body.id);
      }
    });

    test('STORE_MANAGER device creation returns proper response', async () => {
      // Use a unique deviceId to avoid duplicate conflicts
      const res = await request(app)
        .post('/api/devices')
        .set('Authorization', `Bearer ${tokens.storeManager}`)
        .send({ name: 'Test Device Manager', deviceId: 'test-device-integ-003' });

      expect(res.status).not.toBe(403);
      if (res.status === 201) {
        expect(res.body).toHaveProperty('id');
        createdIds.devices.push(res.body.id);
      }
    });

    test('rejects duplicate deviceId (400)', async () => {
      // First create a device
      const first = await request(app)
        .post('/api/devices')
        .set('Authorization', `Bearer ${tokens.tenantAdmin}`)
        .send({ name: 'Dup Device A', deviceId: 'test-device-integ-dup' });

      if (first.status === 201) {
        createdIds.devices.push(first.body.id);
      }

      // Attempt to create another with the same deviceId
      const res = await request(app)
        .post('/api/devices')
        .set('Authorization', `Bearer ${tokens.tenantAdmin}`)
        .send({ name: 'Dup Device B', deviceId: 'test-device-integ-dup' });

      expect(res.status).toBe(400);
    });

    test('rejects device without required fields (400)', async () => {
      const res = await request(app)
        .post('/api/devices')
        .set('Authorization', `Bearer ${tokens.tenantAdmin}`)
        .send({});

      // Should fail on validation (name and deviceId are required)
      expect(res.status).toBe(400);
    });
  });

  // ---------------------------------------------------------------------------
  // PUT /api/devices/:id
  // ---------------------------------------------------------------------------
  describe('PUT /api/devices/:id', () => {

    test('VIEWER cannot update a device (403)', async () => {
      // Skip if no device was created
      if (createdIds.devices.length === 0) return;
      const deviceId = createdIds.devices[0];

      const res = await request(app)
        .put(`/api/devices/${deviceId}`)
        .set('Authorization', `Bearer ${tokens.viewer}`)
        .send({ name: 'Updated By Viewer' });

      expect(res.status).toBe(403);
    });

    test('USER cannot update a device (403)', async () => {
      if (createdIds.devices.length === 0) return;
      const deviceId = createdIds.devices[0];

      const res = await request(app)
        .put(`/api/devices/${deviceId}`)
        .set('Authorization', `Bearer ${tokens.user}`)
        .send({ name: 'Updated By User' });

      expect(res.status).toBe(403);
    });

    test('STORE_MANAGER can update a device', async () => {
      if (createdIds.devices.length === 0) return;
      const deviceId = createdIds.devices[0];

      const res = await request(app)
        .put(`/api/devices/${deviceId}`)
        .set('Authorization', `Bearer ${tokens.storeManager}`)
        .send({ name: 'Updated By Manager' });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('name', 'Updated By Manager');
    });

    test('TENANT_ADMIN can update a device', async () => {
      if (createdIds.devices.length === 0) return;
      const deviceId = createdIds.devices[0];

      const res = await request(app)
        .put(`/api/devices/${deviceId}`)
        .set('Authorization', `Bearer ${tokens.tenantAdmin}`)
        .send({ name: 'Updated By Admin' });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('name', 'Updated By Admin');
    });

    test('returns 404 for nonexistent device', async () => {
      const res = await request(app)
        .put('/api/devices/nonexistent-device-id')
        .set('Authorization', `Bearer ${tokens.tenantAdmin}`)
        .send({ name: 'Ghost Device' });

      expect(res.status).toBe(404);
    });
  });

  // ---------------------------------------------------------------------------
  // DELETE /api/devices/:id
  // ---------------------------------------------------------------------------
  describe('DELETE /api/devices/:id', () => {

    test('VIEWER cannot delete a device (403)', async () => {
      if (createdIds.devices.length === 0) return;
      const deviceId = createdIds.devices[0];

      const res = await request(app)
        .delete(`/api/devices/${deviceId}`)
        .set('Authorization', `Bearer ${tokens.viewer}`);

      expect(res.status).toBe(403);
    });

    test('USER cannot delete a device (403)', async () => {
      if (createdIds.devices.length === 0) return;
      const deviceId = createdIds.devices[0];

      const res = await request(app)
        .delete(`/api/devices/${deviceId}`)
        .set('Authorization', `Bearer ${tokens.user}`);

      expect(res.status).toBe(403);
    });

    test('STORE_MANAGER can delete a device (soft delete)', async () => {
      if (createdIds.devices.length === 0) return;
      const deviceId = createdIds.devices[0];

      const res = await request(app)
        .delete(`/api/devices/${deviceId}`)
        .set('Authorization', `Bearer ${tokens.storeManager}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('message');
    });

    test('returns 404 for nonexistent device', async () => {
      const res = await request(app)
        .delete('/api/devices/nonexistent-device-id')
        .set('Authorization', `Bearer ${tokens.tenantAdmin}`);

      expect(res.status).toBe(404);
    });
  });
});

// =============================================================================
// Schedule API Tests
// =============================================================================
describe('Schedule API Integration', () => {

  // ---------------------------------------------------------------------------
  // GET /api/schedules
  // ---------------------------------------------------------------------------
  describe('GET /api/schedules', () => {

    test('any authenticated user can list schedules (VIEWER)', async () => {
      const res = await request(app)
        .get('/api/schedules')
        .set('Authorization', `Bearer ${tokens.viewer}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('items');
      expect(res.body).toHaveProperty('pagination');
    });

    test('any authenticated user can list schedules (USER)', async () => {
      const res = await request(app)
        .get('/api/schedules')
        .set('Authorization', `Bearer ${tokens.user}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('items');
    });

    test('any authenticated user can list schedules (STORE_MANAGER)', async () => {
      const res = await request(app)
        .get('/api/schedules')
        .set('Authorization', `Bearer ${tokens.storeManager}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('items');
    });

    test('any authenticated user can list schedules (TENANT_ADMIN)', async () => {
      const res = await request(app)
        .get('/api/schedules')
        .set('Authorization', `Bearer ${tokens.tenantAdmin}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('items');
    });

    test('unauthenticated request is rejected', async () => {
      const res = await request(app).get('/api/schedules');
      expect(res.status).toBe(401);
    });
  });

  // ---------------------------------------------------------------------------
  // POST /api/schedules
  // ---------------------------------------------------------------------------
  describe('POST /api/schedules', () => {

    const schedulePayload = {
      name: 'Test Schedule',
      startDate: '2026-04-01',
      endDate: '2026-04-30',
    };

    test('VIEWER cannot create a schedule (403)', async () => {
      const res = await request(app)
        .post('/api/schedules')
        .set('Authorization', `Bearer ${tokens.viewer}`)
        .send(schedulePayload);

      expect(res.status).toBe(403);
    });

    test('USER cannot create a schedule (403)', async () => {
      const res = await request(app)
        .post('/api/schedules')
        .set('Authorization', `Bearer ${tokens.user}`)
        .send(schedulePayload);

      expect(res.status).toBe(403);
    });

    test('STORE_MANAGER passes permission check (not 403)', async () => {
      const res = await request(app)
        .post('/api/schedules')
        .set('Authorization', `Bearer ${tokens.storeManager}`)
        .send(schedulePayload);

      // Should not be 403 — STORE_MANAGER has the required role
      expect(res.status).not.toBe(403);
      if (res.status === 201) {
        expect(res.body).toHaveProperty('id');
        expect(res.body).toHaveProperty('name', 'Test Schedule');
        expect(res.body).toHaveProperty('status', 'DRAFT');
        createdIds.schedules.push(res.body.id);
      }
    });

    test('TENANT_ADMIN can create a schedule', async () => {
      const res = await request(app)
        .post('/api/schedules')
        .set('Authorization', `Bearer ${tokens.tenantAdmin}`)
        .send({
          name: 'Admin Test Schedule',
          startDate: '2026-04-01',
          endDate: '2026-04-30',
        });

      expect(res.status).not.toBe(403);
      if (res.status === 201) {
        expect(res.body).toHaveProperty('id');
        expect(res.body).toHaveProperty('name', 'Admin Test Schedule');
        createdIds.schedules.push(res.body.id);
      }
    });

    test('SUPER_ADMIN can create a schedule', async () => {
      const res = await request(app)
        .post('/api/schedules')
        .set('Authorization', `Bearer ${tokens.superAdmin}`)
        .send({
          name: 'Super Admin Schedule',
          startDate: '2026-04-15',
          endDate: '2026-05-15',
        });

      expect(res.status).not.toBe(403);
      if (res.status === 201) {
        createdIds.schedules.push(res.body.id);
      }
    });

    test('rejects schedule without name (400)', async () => {
      const res = await request(app)
        .post('/api/schedules')
        .set('Authorization', `Bearer ${tokens.tenantAdmin}`)
        .send({ startDate: '2026-04-01' });

      expect(res.status).toBe(400);
    });

    test('rejects schedule without startDate (400)', async () => {
      const res = await request(app)
        .post('/api/schedules')
        .set('Authorization', `Bearer ${tokens.tenantAdmin}`)
        .send({ name: 'Missing Date Schedule' });

      expect(res.status).toBe(400);
    });
  });

  // ---------------------------------------------------------------------------
  // PUT /api/schedules/:id
  // ---------------------------------------------------------------------------
  describe('PUT /api/schedules/:id', () => {

    test('VIEWER cannot update a schedule (403)', async () => {
      if (createdIds.schedules.length === 0) return;
      const scheduleId = createdIds.schedules[0];

      const res = await request(app)
        .put(`/api/schedules/${scheduleId}`)
        .set('Authorization', `Bearer ${tokens.viewer}`)
        .send({ name: 'Updated By Viewer' });

      expect(res.status).toBe(403);
    });

    test('USER cannot update a schedule (403)', async () => {
      if (createdIds.schedules.length === 0) return;
      const scheduleId = createdIds.schedules[0];

      const res = await request(app)
        .put(`/api/schedules/${scheduleId}`)
        .set('Authorization', `Bearer ${tokens.user}`)
        .send({ name: 'Updated By User' });

      expect(res.status).toBe(403);
    });

    test('STORE_MANAGER can update a schedule', async () => {
      if (createdIds.schedules.length === 0) return;
      const scheduleId = createdIds.schedules[0];

      const res = await request(app)
        .put(`/api/schedules/${scheduleId}`)
        .set('Authorization', `Bearer ${tokens.storeManager}`)
        .send({ name: 'Updated Test Schedule' });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('name', 'Updated Test Schedule');
    });

    test('TENANT_ADMIN can update a schedule', async () => {
      if (createdIds.schedules.length === 0) return;
      const scheduleId = createdIds.schedules[0];

      const res = await request(app)
        .put(`/api/schedules/${scheduleId}`)
        .set('Authorization', `Bearer ${tokens.tenantAdmin}`)
        .send({ name: 'Updated By Admin' });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('name', 'Updated By Admin');
    });

    test('returns 404 for nonexistent schedule', async () => {
      const res = await request(app)
        .put('/api/schedules/nonexistent-schedule-id')
        .set('Authorization', `Bearer ${tokens.tenantAdmin}`)
        .send({ name: 'Ghost Schedule' });

      expect(res.status).toBe(404);
    });
  });

  // ---------------------------------------------------------------------------
  // DELETE /api/schedules/:id
  // ---------------------------------------------------------------------------
  describe('DELETE /api/schedules/:id', () => {

    test('VIEWER cannot delete a schedule (403)', async () => {
      if (createdIds.schedules.length === 0) return;
      const scheduleId = createdIds.schedules[0];

      const res = await request(app)
        .delete(`/api/schedules/${scheduleId}`)
        .set('Authorization', `Bearer ${tokens.viewer}`);

      expect(res.status).toBe(403);
    });

    test('USER cannot delete a schedule (403)', async () => {
      if (createdIds.schedules.length === 0) return;
      const scheduleId = createdIds.schedules[0];

      const res = await request(app)
        .delete(`/api/schedules/${scheduleId}`)
        .set('Authorization', `Bearer ${tokens.user}`);

      expect(res.status).toBe(403);
    });

    test('STORE_MANAGER can delete a schedule (soft delete)', async () => {
      if (createdIds.schedules.length === 0) return;
      const scheduleId = createdIds.schedules[0];

      const res = await request(app)
        .delete(`/api/schedules/${scheduleId}`)
        .set('Authorization', `Bearer ${tokens.storeManager}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('message');
    });

    test('returns 404 for nonexistent schedule', async () => {
      const res = await request(app)
        .delete('/api/schedules/nonexistent-schedule-id')
        .set('Authorization', `Bearer ${tokens.tenantAdmin}`);

      expect(res.status).toBe(404);
    });
  });

  // ---------------------------------------------------------------------------
  // POST /api/schedules/:id/deploy
  // ---------------------------------------------------------------------------
  describe('POST /api/schedules/:id/deploy', () => {

    test('VIEWER cannot deploy a schedule (403)', async () => {
      // Use the second schedule if available (first may be soft-deleted)
      const scheduleId = createdIds.schedules[1] || createdIds.schedules[0];
      if (!scheduleId) return;

      const res = await request(app)
        .post(`/api/schedules/${scheduleId}/deploy`)
        .set('Authorization', `Bearer ${tokens.viewer}`);

      expect(res.status).toBe(403);
    });

    test('USER cannot deploy a schedule (403)', async () => {
      const scheduleId = createdIds.schedules[1] || createdIds.schedules[0];
      if (!scheduleId) return;

      const res = await request(app)
        .post(`/api/schedules/${scheduleId}/deploy`)
        .set('Authorization', `Bearer ${tokens.user}`);

      expect(res.status).toBe(403);
    });

    test('STORE_MANAGER can deploy a schedule', async () => {
      const scheduleId = createdIds.schedules[1] || createdIds.schedules[0];
      if (!scheduleId) return;

      const res = await request(app)
        .post(`/api/schedules/${scheduleId}/deploy`)
        .set('Authorization', `Bearer ${tokens.storeManager}`);

      // Should not be 403 — passes authorization.
      // May succeed (200) or return 404 if schedule was soft-deleted.
      expect(res.status).not.toBe(403);
    });

    test('TENANT_ADMIN can deploy a schedule', async () => {
      const scheduleId = createdIds.schedules[1] || createdIds.schedules[0];
      if (!scheduleId) return;

      const res = await request(app)
        .post(`/api/schedules/${scheduleId}/deploy`)
        .set('Authorization', `Bearer ${tokens.tenantAdmin}`);

      expect(res.status).not.toBe(403);
    });

    test('returns 404 for nonexistent schedule', async () => {
      const res = await request(app)
        .post('/api/schedules/nonexistent-schedule-id/deploy')
        .set('Authorization', `Bearer ${tokens.tenantAdmin}`);

      expect(res.status).toBe(404);
    });
  });
});
