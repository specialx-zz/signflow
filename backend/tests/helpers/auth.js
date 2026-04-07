const jwt = require('jsonwebtoken');

const TEST_SECRET = 'test-jwt-secret-key-for-testing';

const testUsers = {
  superAdmin: {
    id: 'test-super-admin-id',
    email: 'superadmin@test.com',
    name: 'Test Super Admin',
    role: 'SUPER_ADMIN',
    tenantId: 'test-tenant-1',
    isActive: true
  },
  tenantAdmin: {
    id: 'test-tenant-admin-id',
    email: 'admin@test.com',
    name: 'Test Tenant Admin',
    role: 'TENANT_ADMIN',
    tenantId: 'test-tenant-1',
    isActive: true
  },
  storeManager: {
    id: 'test-store-manager-id',
    email: 'manager@test.com',
    name: 'Test Store Manager',
    role: 'STORE_MANAGER',
    tenantId: 'test-tenant-1',
    storeId: 'test-store-1',
    isActive: true
  },
  user: {
    id: 'test-user-id',
    email: 'user@test.com',
    name: 'Test User',
    role: 'USER',
    tenantId: 'test-tenant-1',
    isActive: true
  },
  viewer: {
    id: 'test-viewer-id',
    email: 'viewer@test.com',
    name: 'Test Viewer',
    role: 'VIEWER',
    tenantId: 'test-tenant-1',
    isActive: true
  },
  otherTenantAdmin: {
    id: 'test-other-admin-id',
    email: 'other@test.com',
    name: 'Other Tenant Admin',
    role: 'TENANT_ADMIN',
    tenantId: 'test-tenant-2',
    isActive: true
  }
};

function generateToken(userKey) {
  const user = testUsers[userKey];
  if (!user) throw new Error(`Unknown test user: ${userKey}`);
  return jwt.sign(
    { userId: user.id, email: user.email, role: user.role, tenantId: user.tenantId },
    TEST_SECRET,
    { expiresIn: '1h' }
  );
}

function getAuthHeader(userKey) {
  return `Bearer ${generateToken(userKey)}`;
}

module.exports = { testUsers, generateToken, getAuthHeader, TEST_SECRET };
