/**
 * seedTestDb.js — Create integration-test-specific users and data.
 *
 * Uses upsert so the script is idempotent: safe to call in beforeAll
 * without worrying about duplicate-key errors across test reruns.
 */
const prisma = require('../../src/utils/prisma');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const TEST_TENANT_ID = 'test-tenant-integ';
const TEST_STORE_ID = 'test-store-integ';
const TEST_PASSWORD = 'TestPass1';

async function seedTestData() {
  const password = await bcrypt.hash(TEST_PASSWORD, 10);

  // 1. Test tenant
  const tenant = await prisma.tenant.upsert({
    where: { id: TEST_TENANT_ID },
    update: {},
    create: {
      id: TEST_TENANT_ID,
      name: 'Integration Test Company',
      slug: 'integ-test-company',
      contactEmail: 'integ@test.com',
      timezone: 'Asia/Seoul',
      isActive: true,
    },
  });

  // 2. Subscription for the test tenant
  await prisma.subscription.upsert({
    where: { tenantId: TEST_TENANT_ID },
    update: {},
    create: {
      id: uuidv4(),
      tenantId: TEST_TENANT_ID,
      plan: 'enterprise',
      status: 'active',
      maxDevices: 100,
      maxStorageGB: 100,
      maxUsers: 50,
      maxStores: 20,
      startDate: new Date(),
    },
  });

  // 3. Users — one per role
  const roleDefs = [
    { key: 'superAdmin', email: 'test-super@integ.com', username: 'test-super', name: 'Test Super', role: 'SUPER_ADMIN' },
    { key: 'tenantAdmin', email: 'test-admin@integ.com', username: 'test-admin', name: 'Test Admin', role: 'TENANT_ADMIN' },
    { key: 'storeManager', email: 'test-manager@integ.com', username: 'test-manager', name: 'Test Manager', role: 'STORE_MANAGER' },
    { key: 'user', email: 'test-user@integ.com', username: 'test-user', name: 'Test User', role: 'USER' },
    { key: 'viewer', email: 'test-viewer@integ.com', username: 'test-viewer', name: 'Test Viewer', role: 'VIEWER' },
  ];

  const users = {};
  for (const u of roleDefs) {
    users[u.key] = await prisma.user.upsert({
      where: { email: u.email },
      update: { password, isActive: true },
      create: {
        id: uuidv4(),
        tenantId: TEST_TENANT_ID,
        username: u.username,
        email: u.email,
        password,
        role: u.role,
        isActive: true,
      },
    });
  }

  // 4. Test store
  const store = await prisma.store.upsert({
    where: { id: TEST_STORE_ID },
    update: {},
    create: {
      id: TEST_STORE_ID,
      tenantId: TEST_TENANT_ID,
      name: 'Integration Test Store',
    },
  });

  return { tenant, users, store, password: TEST_PASSWORD };
}

/**
 * Remove only the data created by seedTestData.
 * Called in afterAll to keep the dev.db clean.
 */
async function cleanTestData() {
  try {
    // Delete in reverse dependency order to avoid FK violations
    // 1. Schedule-related
    await prisma.scheduleDevice.deleteMany({ where: { schedule: { tenantId: TEST_TENANT_ID } } }).catch(() => {});
    await prisma.schedule.deleteMany({ where: { tenantId: TEST_TENANT_ID } }).catch(() => {});
    // 2. Playlist items & playlists
    await prisma.playlistItem.deleteMany({ where: { playlist: { tenantId: TEST_TENANT_ID } } }).catch(() => {});
    await prisma.playlist.deleteMany({ where: { tenantId: TEST_TENANT_ID } }).catch(() => {});
    // 3. Layout zones & layouts
    await prisma.layoutZone.deleteMany({ where: { layout: { tenantId: TEST_TENANT_ID } } }).catch(() => {});
    await prisma.layout.deleteMany({ where: { tenantId: TEST_TENANT_ID } }).catch(() => {});
    // 4. Content & categories
    await prisma.content.deleteMany({ where: { tenantId: TEST_TENANT_ID } }).catch(() => {});
    await prisma.contentCategory.deleteMany({ where: { tenantId: TEST_TENANT_ID } }).catch(() => {});
    // 5. Devices & groups
    await prisma.device.deleteMany({ where: { tenantId: TEST_TENANT_ID } }).catch(() => {});
    await prisma.deviceGroup.deleteMany({ where: { tenantId: TEST_TENANT_ID } }).catch(() => {});
    // 6. Statistics & audit logs
    await prisma.statistics.deleteMany({ where: { tenantId: TEST_TENANT_ID } }).catch(() => {});
    await prisma.auditLog.deleteMany({ where: { tenantId: TEST_TENANT_ID } }).catch(() => {});
    // 7. Users
    await prisma.user.deleteMany({ where: { tenantId: TEST_TENANT_ID } }).catch(() => {});
    // 8. Store
    await prisma.store.deleteMany({ where: { tenantId: TEST_TENANT_ID } }).catch(() => {});
    // 9. Subscription
    await prisma.subscription.deleteMany({ where: { tenantId: TEST_TENANT_ID } }).catch(() => {});
    // 10. Tenant
    await prisma.tenant.deleteMany({ where: { id: TEST_TENANT_ID } }).catch(() => {});
  } catch (e) {
    console.warn('[cleanTestData] partial cleanup error:', e.message);
  }
}

module.exports = { seedTestData, cleanTestData, TEST_TENANT_ID, TEST_STORE_ID, TEST_PASSWORD };
