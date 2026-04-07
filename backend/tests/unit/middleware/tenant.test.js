process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing';

const { tenantContext, requireTenant, storeFilter, verifyTenantOwnership } = require('../../../src/middleware/tenant');

// ─── Helper ────────────────────────────────────────
function mockReqRes(user = {}, headers = {}) {
  const req = {
    user,
    headers,
    get: (name) => headers[name.toLowerCase()] || headers[name],
  };
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
  const next = jest.fn();
  return { req, res, next };
}

// ─── tenantContext ──────────────────────────────────
describe('tenantContext middleware', () => {
  it('sets req.tenantId from req.user.tenantId for regular users', () => {
    const { req, res, next } = mockReqRes({ role: 'TENANT_ADMIN', tenantId: 'tenant-1' });
    tenantContext(req, res, next);

    expect(req.tenantId).toBe('tenant-1');
    expect(next).toHaveBeenCalled();
  });

  it('SUPER_ADMIN can override tenantId via X-Tenant-Id header', () => {
    const { req, res, next } = mockReqRes(
      { role: 'SUPER_ADMIN', tenantId: null },
      { 'x-tenant-id': 'tenant-override' }
    );
    tenantContext(req, res, next);

    expect(req.tenantId).toBe('tenant-override');
    expect(next).toHaveBeenCalled();
  });

  it('SUPER_ADMIN without X-Tenant-Id header gets null tenantId (full access)', () => {
    const { req, res, next } = mockReqRes({ role: 'SUPER_ADMIN', tenantId: null });
    tenantContext(req, res, next);

    expect(req.tenantId).toBeNull();
    expect(next).toHaveBeenCalled();
  });

  it('non-SUPER_ADMIN cannot override tenantId via X-Tenant-Id header', () => {
    const { req, res, next } = mockReqRes(
      { role: 'TENANT_ADMIN', tenantId: 'tenant-1' },
      { 'x-tenant-id': 'tenant-other' }
    );
    tenantContext(req, res, next);

    expect(req.tenantId).toBe('tenant-1');
    expect(next).toHaveBeenCalled();
  });

  it('returns 401 when req.user is missing', () => {
    const req = { headers: {} };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    const next = jest.fn();

    req.user = undefined;
    tenantContext(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Authentication required' });
    expect(next).not.toHaveBeenCalled();
  });
});

// ─── requireTenant ─────────────────────────────────
describe('requireTenant middleware', () => {
  it('passes when req.tenantId is set', () => {
    const { req, res, next } = mockReqRes();
    req.tenantId = 'tenant-1';
    requireTenant(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('returns 400 when req.tenantId is not set (null)', () => {
    const { req, res, next } = mockReqRes();
    req.tenantId = null;
    requireTenant(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 400 when req.tenantId is undefined', () => {
    const { req, res, next } = mockReqRes();
    req.tenantId = undefined;
    requireTenant(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(next).not.toHaveBeenCalled();
  });
});

// ─── storeFilter ───────────────────────────────────
describe('storeFilter middleware', () => {
  it('STORE_MANAGER gets storeId filter applied', () => {
    const { req, res, next } = mockReqRes({ role: 'STORE_MANAGER', storeId: 'store-42' });
    storeFilter(req, res, next);

    expect(req.storeId).toBe('store-42');
    expect(next).toHaveBeenCalled();
  });

  it('STORE_MANAGER without storeId does not get store filtering', () => {
    const { req, res, next } = mockReqRes({ role: 'STORE_MANAGER', storeId: null });
    storeFilter(req, res, next);

    expect(req.storeId).toBeNull();
    expect(next).toHaveBeenCalled();
  });

  it('non-STORE_MANAGER does not get store filtering', () => {
    const { req, res, next } = mockReqRes({ role: 'TENANT_ADMIN', storeId: 'store-99' });
    storeFilter(req, res, next);

    expect(req.storeId).toBeNull();
    expect(next).toHaveBeenCalled();
  });

  it('SUPER_ADMIN skips store filtering', () => {
    const { req, res, next } = mockReqRes({ role: 'SUPER_ADMIN', storeId: 'store-1' });
    storeFilter(req, res, next);

    expect(req.storeId).toBeNull();
    expect(next).toHaveBeenCalled();
  });
});

// ─── verifyTenantOwnership ─────────────────────────
describe('verifyTenantOwnership', () => {
  it('returns true when resource.tenantId matches req.tenantId', () => {
    const resource = { tenantId: 'tenant-1' };
    const req = { user: { role: 'TENANT_ADMIN' }, tenantId: 'tenant-1' };

    expect(verifyTenantOwnership(resource, req)).toBe(true);
  });

  it('returns false when resource.tenantId does not match req.tenantId', () => {
    const resource = { tenantId: 'tenant-2' };
    const req = { user: { role: 'TENANT_ADMIN' }, tenantId: 'tenant-1' };

    expect(verifyTenantOwnership(resource, req)).toBe(false);
  });

  it('returns false when resource is null or undefined', () => {
    const req = { user: { role: 'TENANT_ADMIN' }, tenantId: 'tenant-1' };

    expect(verifyTenantOwnership(null, req)).toBe(false);
    expect(verifyTenantOwnership(undefined, req)).toBe(false);
  });

  it('SUPER_ADMIN with no tenantId always passes', () => {
    const resource = { tenantId: 'tenant-any' };
    const req = { user: { role: 'SUPER_ADMIN' }, tenantId: null };

    expect(verifyTenantOwnership(resource, req)).toBe(true);
  });

  it('SUPER_ADMIN with specific tenantId checks ownership normally', () => {
    const resource = { tenantId: 'tenant-1' };
    const req = { user: { role: 'SUPER_ADMIN' }, tenantId: 'tenant-1' };

    expect(verifyTenantOwnership(resource, req)).toBe(true);
  });

  it('SUPER_ADMIN with mismatched tenantId returns false', () => {
    const resource = { tenantId: 'tenant-2' };
    const req = { user: { role: 'SUPER_ADMIN' }, tenantId: 'tenant-1' };

    expect(verifyTenantOwnership(resource, req)).toBe(false);
  });
});

// ─── Helper methods (tenantWhere, tenantData) ──────
describe('tenantWhere helper', () => {
  it('returns { tenantId, ...extra } when tenantId is set', () => {
    const { req, res, next } = mockReqRes({ role: 'TENANT_ADMIN', tenantId: 'tenant-1' });
    tenantContext(req, res, next);

    const where = req.tenantWhere({ status: 'active' });
    expect(where).toEqual({ tenantId: 'tenant-1', status: 'active' });
  });

  it('returns only extra when tenantId is null (SUPER_ADMIN full access)', () => {
    const { req, res, next } = mockReqRes({ role: 'SUPER_ADMIN' });
    tenantContext(req, res, next);

    const where = req.tenantWhere({ status: 'active' });
    expect(where).toEqual({ status: 'active' });
  });

  it('returns { tenantId } with no extra args', () => {
    const { req, res, next } = mockReqRes({ role: 'TENANT_ADMIN', tenantId: 'tenant-1' });
    tenantContext(req, res, next);

    const where = req.tenantWhere();
    expect(where).toEqual({ tenantId: 'tenant-1' });
  });

  it('returns empty object when no tenantId and no extra', () => {
    const { req, res, next } = mockReqRes({ role: 'SUPER_ADMIN' });
    tenantContext(req, res, next);

    const where = req.tenantWhere();
    expect(where).toEqual({});
  });
});

describe('tenantData helper', () => {
  it('returns { tenantId, ...extra } when tenantId is set', () => {
    const { req, res, next } = mockReqRes({ role: 'TENANT_ADMIN', tenantId: 'tenant-1' });
    tenantContext(req, res, next);

    const data = req.tenantData({ name: 'New Item' });
    expect(data).toEqual({ tenantId: 'tenant-1', name: 'New Item' });
  });

  it('falls back to req.user.tenantId when req.tenantId is null', () => {
    const { req, res, next } = mockReqRes({ role: 'SUPER_ADMIN', tenantId: 'sa-tenant' });
    tenantContext(req, res, next);

    // SUPER_ADMIN without X-Tenant-Id header -> req.tenantId is null
    // tenantData falls back to req.user.tenantId
    const data = req.tenantData({ name: 'Item' });
    expect(data).toEqual({ tenantId: 'sa-tenant', name: 'Item' });
  });

  it('SUPER_ADMIN with X-Tenant-Id uses the overridden tenantId', () => {
    const { req, res, next } = mockReqRes(
      { role: 'SUPER_ADMIN', tenantId: 'sa-tenant' },
      { 'x-tenant-id': 'tenant-override' }
    );
    tenantContext(req, res, next);

    const data = req.tenantData({ name: 'Item' });
    expect(data).toEqual({ tenantId: 'tenant-override', name: 'Item' });
  });

  it('returns { tenantId } with no extra args', () => {
    const { req, res, next } = mockReqRes({ role: 'TENANT_ADMIN', tenantId: 'tenant-1' });
    tenantContext(req, res, next);

    const data = req.tenantData();
    expect(data).toEqual({ tenantId: 'tenant-1' });
  });
});
