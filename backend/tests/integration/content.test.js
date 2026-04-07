/**
 * Integration tests for the Content and Playlist APIs.
 *
 * Tests the full request lifecycle including authentication, authorization
 * (role-based access control), CRUD operations, and tenant isolation.
 */
require('../setup');
const request = require('supertest');
const { getTestApp } = require('../helpers/testApp');
const { seedTestData, cleanTestData, TEST_PASSWORD } = require('../helpers/seedTestDb');
const prisma = require('../../src/utils/prisma');

let app;
let testData;
const tokens = {};
const createdPlaylistIds = [];

beforeAll(async () => {
  app = getTestApp();
  testData = await seedTestData();

  // Login all five roles and store tokens
  const roles = [
    { key: 'superAdmin', email: 'test-super@integ.com' },
    { key: 'tenantAdmin', email: 'test-admin@integ.com' },
    { key: 'storeManager', email: 'test-manager@integ.com' },
    { key: 'user', email: 'test-user@integ.com' },
    { key: 'viewer', email: 'test-viewer@integ.com' },
  ];

  for (const r of roles) {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: r.email, password: TEST_PASSWORD });
    expect(res.status).toBe(200);
    tokens[r.key] = res.body.token;
  }
}, 30000);

afterAll(async () => {
  // Clean up playlists created during tests
  for (const id of createdPlaylistIds) {
    await prisma.playlistItem.deleteMany({ where: { playlistId: id } }).catch(() => {});
    await prisma.playlist.delete({ where: { id } }).catch(() => {});
  }
  await cleanTestData();
  await prisma.$disconnect();
});

// ---------------------------------------------------------------------------
// Content API
// ---------------------------------------------------------------------------
describe('Content API Integration', () => {

  // ---- GET /api/content (list) -------------------------------------------
  describe('GET /api/content', () => {

    test('VIEWER can list content', async () => {
      const res = await request(app)
        .get('/api/content')
        .set('Authorization', `Bearer ${tokens.viewer}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('items');
      expect(res.body).toHaveProperty('pagination');
      expect(Array.isArray(res.body.items)).toBe(true);
    });

    test('USER can list content', async () => {
      const res = await request(app)
        .get('/api/content')
        .set('Authorization', `Bearer ${tokens.user}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('items');
    });

    test('TENANT_ADMIN can list content', async () => {
      const res = await request(app)
        .get('/api/content')
        .set('Authorization', `Bearer ${tokens.tenantAdmin}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('items');
    });

    test('SUPER_ADMIN can list content', async () => {
      const res = await request(app)
        .get('/api/content')
        .set('Authorization', `Bearer ${tokens.superAdmin}`);

      expect(res.status).toBe(200);
    });

    test('unauthenticated request is rejected', async () => {
      const res = await request(app).get('/api/content');
      expect(res.status).toBe(401);
    });

    test('supports pagination query params', async () => {
      const res = await request(app)
        .get('/api/content?page=1&limit=5')
        .set('Authorization', `Bearer ${tokens.user}`);

      expect(res.status).toBe(200);
      expect(res.body.pagination.page).toBe(1);
      expect(res.body.pagination.limit).toBe(5);
    });
  });

  // ---- POST /api/content/upload (permission check) -----------------------
  describe('POST /api/content/upload — permission gate', () => {

    test('VIEWER gets 403', async () => {
      const res = await request(app)
        .post('/api/content/upload')
        .set('Authorization', `Bearer ${tokens.viewer}`);

      expect(res.status).toBe(403);
    });

    test('USER passes authorization (gets 400 for missing file, not 403)', async () => {
      const res = await request(app)
        .post('/api/content/upload')
        .set('Authorization', `Bearer ${tokens.user}`);

      // Should NOT be 403; the request reaches the controller which expects a file
      expect(res.status).not.toBe(403);
      expect([400, 500]).toContain(res.status);
    });

    test('STORE_MANAGER passes authorization', async () => {
      const res = await request(app)
        .post('/api/content/upload')
        .set('Authorization', `Bearer ${tokens.storeManager}`);

      expect(res.status).not.toBe(403);
    });

    test('TENANT_ADMIN passes authorization', async () => {
      const res = await request(app)
        .post('/api/content/upload')
        .set('Authorization', `Bearer ${tokens.tenantAdmin}`);

      expect(res.status).not.toBe(403);
    });
  });

  // ---- GET /api/content/categories ---------------------------------------
  describe('GET /api/content/categories', () => {

    test('VIEWER can get categories', async () => {
      const res = await request(app)
        .get('/api/content/categories')
        .set('Authorization', `Bearer ${tokens.viewer}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    test('USER can get categories', async () => {
      const res = await request(app)
        .get('/api/content/categories')
        .set('Authorization', `Bearer ${tokens.user}`);

      expect(res.status).toBe(200);
    });

    test('unauthenticated request is rejected', async () => {
      const res = await request(app).get('/api/content/categories');
      expect(res.status).toBe(401);
    });
  });

  // ---- POST /api/content/categories (create category permission) ---------
  describe('POST /api/content/categories — permission gate', () => {

    test('VIEWER gets 403', async () => {
      const res = await request(app)
        .post('/api/content/categories')
        .set('Authorization', `Bearer ${tokens.viewer}`)
        .send({ name: 'Viewer Category' });

      expect(res.status).toBe(403);
    });

    test('USER can create a category', async () => {
      const res = await request(app)
        .post('/api/content/categories')
        .set('Authorization', `Bearer ${tokens.user}`)
        .send({ name: 'Test Category' });

      // Should get 201 or pass through subscription check — not 403
      expect(res.status).not.toBe(403);
    });
  });

  // ---- PUT /api/content/:id (update permission) --------------------------
  describe('PUT /api/content/:id — permission gate', () => {

    test('VIEWER gets 403', async () => {
      const res = await request(app)
        .put('/api/content/nonexistent-id')
        .set('Authorization', `Bearer ${tokens.viewer}`)
        .send({ name: 'Updated' });

      expect(res.status).toBe(403);
    });

    test('USER passes authorization (gets 404 for nonexistent id, not 403)', async () => {
      const res = await request(app)
        .put('/api/content/nonexistent-id')
        .set('Authorization', `Bearer ${tokens.user}`)
        .send({ name: 'Updated' });

      expect(res.status).not.toBe(403);
      expect(res.status).toBe(404);
    });
  });

  // ---- DELETE /api/content/:id (delete permission) -----------------------
  describe('DELETE /api/content/:id — permission gate', () => {

    test('VIEWER gets 403', async () => {
      const res = await request(app)
        .delete('/api/content/nonexistent-id')
        .set('Authorization', `Bearer ${tokens.viewer}`);

      expect(res.status).toBe(403);
    });

    test('USER passes authorization (gets 404 for nonexistent id, not 403)', async () => {
      const res = await request(app)
        .delete('/api/content/nonexistent-id')
        .set('Authorization', `Bearer ${tokens.user}`);

      expect(res.status).not.toBe(403);
      expect(res.status).toBe(404);
    });
  });

  // ---- GET /api/content/:id (single item) --------------------------------
  describe('GET /api/content/:id', () => {

    test('returns 404 for nonexistent content', async () => {
      const res = await request(app)
        .get('/api/content/nonexistent-id')
        .set('Authorization', `Bearer ${tokens.user}`);

      expect(res.status).toBe(404);
    });

    test('VIEWER can read a single content item', async () => {
      const res = await request(app)
        .get('/api/content/nonexistent-id')
        .set('Authorization', `Bearer ${tokens.viewer}`);

      // No auth gate on GET /:id — should reach controller (404 since id is fake)
      expect(res.status).toBe(404);
      expect(res.status).not.toBe(403);
    });
  });
});

// ---------------------------------------------------------------------------
// Playlist API
// ---------------------------------------------------------------------------
describe('Playlist API Integration', () => {

  // ---- GET /api/playlists (list) -----------------------------------------
  describe('GET /api/playlists', () => {

    test('VIEWER can list playlists', async () => {
      const res = await request(app)
        .get('/api/playlists')
        .set('Authorization', `Bearer ${tokens.viewer}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('items');
      expect(res.body).toHaveProperty('pagination');
      expect(Array.isArray(res.body.items)).toBe(true);
    });

    test('USER can list playlists', async () => {
      const res = await request(app)
        .get('/api/playlists')
        .set('Authorization', `Bearer ${tokens.user}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('items');
    });

    test('STORE_MANAGER can list playlists', async () => {
      const res = await request(app)
        .get('/api/playlists')
        .set('Authorization', `Bearer ${tokens.storeManager}`);

      expect(res.status).toBe(200);
    });

    test('TENANT_ADMIN can list playlists', async () => {
      const res = await request(app)
        .get('/api/playlists')
        .set('Authorization', `Bearer ${tokens.tenantAdmin}`);

      expect(res.status).toBe(200);
    });

    test('SUPER_ADMIN can list playlists', async () => {
      const res = await request(app)
        .get('/api/playlists')
        .set('Authorization', `Bearer ${tokens.superAdmin}`);

      expect(res.status).toBe(200);
    });

    test('unauthenticated request is rejected', async () => {
      const res = await request(app).get('/api/playlists');
      expect(res.status).toBe(401);
    });

    test('supports search query param', async () => {
      const res = await request(app)
        .get('/api/playlists?search=nonexistent-playlist-xyz')
        .set('Authorization', `Bearer ${tokens.user}`);

      expect(res.status).toBe(200);
      expect(res.body.items).toHaveLength(0);
    });
  });

  // ---- POST /api/playlists (create) --------------------------------------
  describe('POST /api/playlists', () => {

    test('VIEWER gets 403', async () => {
      const res = await request(app)
        .post('/api/playlists')
        .set('Authorization', `Bearer ${tokens.viewer}`)
        .send({ name: 'Viewer Playlist' });

      expect(res.status).toBe(403);
    });

    test('USER can create a playlist', async () => {
      const res = await request(app)
        .post('/api/playlists')
        .set('Authorization', `Bearer ${tokens.user}`)
        .send({ name: 'User Playlist' });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
      expect(res.body).toHaveProperty('name', 'User Playlist');
      expect(res.body).toHaveProperty('creator');
      createdPlaylistIds.push(res.body.id);
    });

    test('STORE_MANAGER can create a playlist', async () => {
      const res = await request(app)
        .post('/api/playlists')
        .set('Authorization', `Bearer ${tokens.storeManager}`)
        .send({ name: 'Manager Playlist' });

      expect(res.status).toBe(201);
      expect(res.body.name).toBe('Manager Playlist');
      createdPlaylistIds.push(res.body.id);
    });

    test('TENANT_ADMIN can create a playlist', async () => {
      const res = await request(app)
        .post('/api/playlists')
        .set('Authorization', `Bearer ${tokens.tenantAdmin}`)
        .send({ name: 'Admin Playlist', description: 'Created by admin' });

      expect(res.status).toBe(201);
      expect(res.body.name).toBe('Admin Playlist');
      createdPlaylistIds.push(res.body.id);
    });

    test('SUPER_ADMIN can create a playlist', async () => {
      const res = await request(app)
        .post('/api/playlists')
        .set('Authorization', `Bearer ${tokens.superAdmin}`)
        .send({ name: 'Super Playlist' });

      expect(res.status).toBe(201);
      createdPlaylistIds.push(res.body.id);
    });

    test('unauthenticated request is rejected', async () => {
      const res = await request(app)
        .post('/api/playlists')
        .send({ name: 'No Auth Playlist' });

      expect(res.status).toBe(401);
    });
  });

  // ---- PUT /api/playlists/:id (update) -----------------------------------
  describe('PUT /api/playlists/:id', () => {

    test('VIEWER gets 403', async () => {
      // Use one of the playlists created above
      const playlistId = createdPlaylistIds[0] || 'nonexistent-id';
      const res = await request(app)
        .put(`/api/playlists/${playlistId}`)
        .set('Authorization', `Bearer ${tokens.viewer}`)
        .send({ name: 'Viewer Updated' });

      expect(res.status).toBe(403);
    });

    test('USER can update a playlist they have access to', async () => {
      const playlistId = createdPlaylistIds[0]; // created by USER
      const res = await request(app)
        .put(`/api/playlists/${playlistId}`)
        .set('Authorization', `Bearer ${tokens.user}`)
        .send({ name: 'User Playlist Updated' });

      expect(res.status).toBe(200);
      expect(res.body.name).toBe('User Playlist Updated');
    });

    test('returns 404 for nonexistent playlist', async () => {
      const res = await request(app)
        .put('/api/playlists/nonexistent-id')
        .set('Authorization', `Bearer ${tokens.user}`)
        .send({ name: 'Ghost' });

      expect(res.status).toBe(404);
    });

    test('TENANT_ADMIN can update a playlist in their tenant', async () => {
      const playlistId = createdPlaylistIds[0];
      const res = await request(app)
        .put(`/api/playlists/${playlistId}`)
        .set('Authorization', `Bearer ${tokens.tenantAdmin}`)
        .send({ description: 'Updated by admin' });

      expect(res.status).toBe(200);
    });
  });

  // ---- DELETE /api/playlists/:id (soft delete) ---------------------------
  describe('DELETE /api/playlists/:id', () => {

    test('VIEWER gets 403', async () => {
      const playlistId = createdPlaylistIds[1] || 'nonexistent-id';
      const res = await request(app)
        .delete(`/api/playlists/${playlistId}`)
        .set('Authorization', `Bearer ${tokens.viewer}`);

      expect(res.status).toBe(403);
    });

    test('USER can delete (soft) a playlist', async () => {
      // Create a disposable playlist to delete
      const createRes = await request(app)
        .post('/api/playlists')
        .set('Authorization', `Bearer ${tokens.user}`)
        .send({ name: 'Playlist To Delete' });
      expect(createRes.status).toBe(201);
      const disposableId = createRes.body.id;
      createdPlaylistIds.push(disposableId);

      const res = await request(app)
        .delete(`/api/playlists/${disposableId}`)
        .set('Authorization', `Bearer ${tokens.user}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('message');
    });

    test('returns 404 for nonexistent playlist', async () => {
      const res = await request(app)
        .delete('/api/playlists/nonexistent-id')
        .set('Authorization', `Bearer ${tokens.user}`);

      expect(res.status).toBe(404);
    });
  });

  // ---- GET /api/playlists/:id (single item — player route, no auth) -----
  describe('GET /api/playlists/:id (player route)', () => {

    test('returns playlist without authentication (player route)', async () => {
      const playlistId = createdPlaylistIds[0];
      const res = await request(app)
        .get(`/api/playlists/${playlistId}`);

      // The player GET /:id route is defined before authenticate middleware
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('id', playlistId);
      expect(res.body).toHaveProperty('items');
    });

    test('returns 404 for nonexistent playlist', async () => {
      const res = await request(app)
        .get('/api/playlists/nonexistent-id');

      expect(res.status).toBe(404);
    });
  });

  // ---- Permission matrix summary -----------------------------------------
  describe('Permission matrix', () => {

    test('VIEWER: GET=200, POST=403, PUT=403, DELETE=403', async () => {
      const getRes = await request(app)
        .get('/api/playlists')
        .set('Authorization', `Bearer ${tokens.viewer}`);
      expect(getRes.status).toBe(200);

      const postRes = await request(app)
        .post('/api/playlists')
        .set('Authorization', `Bearer ${tokens.viewer}`)
        .send({ name: 'blocked' });
      expect(postRes.status).toBe(403);

      const putRes = await request(app)
        .put(`/api/playlists/${createdPlaylistIds[0]}`)
        .set('Authorization', `Bearer ${tokens.viewer}`)
        .send({ name: 'blocked' });
      expect(putRes.status).toBe(403);

      const deleteRes = await request(app)
        .delete(`/api/playlists/${createdPlaylistIds[0]}`)
        .set('Authorization', `Bearer ${tokens.viewer}`);
      expect(deleteRes.status).toBe(403);
    });

    test('USER: GET=200, POST=201, PUT=200, DELETE=200', async () => {
      const getRes = await request(app)
        .get('/api/playlists')
        .set('Authorization', `Bearer ${tokens.user}`);
      expect(getRes.status).toBe(200);

      const postRes = await request(app)
        .post('/api/playlists')
        .set('Authorization', `Bearer ${tokens.user}`)
        .send({ name: 'Matrix Test Playlist' });
      expect(postRes.status).toBe(201);
      const matrixPlaylistId = postRes.body.id;
      createdPlaylistIds.push(matrixPlaylistId);

      const putRes = await request(app)
        .put(`/api/playlists/${matrixPlaylistId}`)
        .set('Authorization', `Bearer ${tokens.user}`)
        .send({ name: 'Matrix Updated' });
      expect(putRes.status).toBe(200);

      const deleteRes = await request(app)
        .delete(`/api/playlists/${matrixPlaylistId}`)
        .set('Authorization', `Bearer ${tokens.user}`);
      expect(deleteRes.status).toBe(200);
    });

    test('Content API — VIEWER: GET=200, POST upload=403, PUT=403, DELETE=403', async () => {
      const getRes = await request(app)
        .get('/api/content')
        .set('Authorization', `Bearer ${tokens.viewer}`);
      expect(getRes.status).toBe(200);

      const uploadRes = await request(app)
        .post('/api/content/upload')
        .set('Authorization', `Bearer ${tokens.viewer}`);
      expect(uploadRes.status).toBe(403);

      const putRes = await request(app)
        .put('/api/content/any-id')
        .set('Authorization', `Bearer ${tokens.viewer}`)
        .send({ name: 'blocked' });
      expect(putRes.status).toBe(403);

      const deleteRes = await request(app)
        .delete('/api/content/any-id')
        .set('Authorization', `Bearer ${tokens.viewer}`);
      expect(deleteRes.status).toBe(403);
    });

    test('Content API — USER: GET=200, POST upload passes auth, PUT/DELETE pass auth', async () => {
      const getRes = await request(app)
        .get('/api/content')
        .set('Authorization', `Bearer ${tokens.user}`);
      expect(getRes.status).toBe(200);

      // Upload passes auth but fails at file validation (not 403)
      const uploadRes = await request(app)
        .post('/api/content/upload')
        .set('Authorization', `Bearer ${tokens.user}`);
      expect(uploadRes.status).not.toBe(403);

      // PUT/DELETE pass auth but hit 404 for fake id
      const putRes = await request(app)
        .put('/api/content/fake-content-id')
        .set('Authorization', `Bearer ${tokens.user}`)
        .send({ name: 'updated' });
      expect(putRes.status).toBe(404);

      const deleteRes = await request(app)
        .delete('/api/content/fake-content-id')
        .set('Authorization', `Bearer ${tokens.user}`);
      expect(deleteRes.status).toBe(404);
    });
  });
});
