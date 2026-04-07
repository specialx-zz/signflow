process.env.NODE_ENV = 'test';

const { tenantRateLimit, setTenantPlan, PLAN_LIMITS } = require('../../../src/middleware/tenantRateLimit');

// Helper to build mock req/res/next
function createMocks(overrides = {}) {
  const req = {
    user: { role: 'ADMIN', tenantId: 'tenant-1' },
    tenantId: 'tenant-1',
    ...overrides,
  };
  const res = {
    _status: null,
    _json: null,
    _headers: {},
    status(code) { this._status = code; return this; },
    json(body) { this._json = body; return this; },
    set(key, val) { this._headers[key] = val; },
  };
  const next = jest.fn();
  return { req, res, next };
}

describe('tenantRateLimit middleware', () => {
  // Use a unique tenantId per test to avoid cross-test pollution
  let tenantSeq = 0;
  function uniqueTenantId() {
    tenantSeq++;
    return `test-tenant-${tenantSeq}-${Date.now()}`;
  }

  describe('setTenantPlan', () => {
    it('sets the plan for a new tenant', () => {
      const tid = uniqueTenantId();
      // Should not throw
      setTenantPlan(tid, 'business');

      // Verify by sending a request and checking the rate limit header matches business (300)
      const { req, res, next } = createMocks({ tenantId: tid, user: { role: 'ADMIN', tenantId: tid } });
      tenantRateLimit(req, res, next);
      expect(res._headers['X-RateLimit-Limit']).toBe('300');
    });

    it('updates the plan for an existing tenant bucket', () => {
      const tid = uniqueTenantId();

      // First request creates a bucket with default plan
      const m1 = createMocks({ tenantId: tid, user: { role: 'ADMIN', tenantId: tid } });
      tenantRateLimit(m1.req, m1.res, m1.next);
      expect(m1.res._headers['X-RateLimit-Limit']).toBe('60'); // default starter

      // Now update plan
      setTenantPlan(tid, 'enterprise');

      const m2 = createMocks({ tenantId: tid, user: { role: 'ADMIN', tenantId: tid } });
      tenantRateLimit(m2.req, m2.res, m2.next);
      expect(m2.res._headers['X-RateLimit-Limit']).toBe('1000');
    });
  });

  describe('allows requests under the limit', () => {
    it('calls next() and does not return 429 when under limit', () => {
      const tid = uniqueTenantId();
      setTenantPlan(tid, 'starter'); // 60 rpm

      const { req, res, next } = createMocks({ tenantId: tid, user: { role: 'ADMIN', tenantId: tid } });
      tenantRateLimit(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res._status).toBeNull();
      expect(res._headers['X-RateLimit-Remaining']).toBeDefined();
      expect(Number(res._headers['X-RateLimit-Remaining'])).toBeGreaterThanOrEqual(0);
    });
  });

  describe('blocks requests over the limit (429)', () => {
    it('returns 429 when count exceeds plan limit', () => {
      const tid = uniqueTenantId();
      setTenantPlan(tid, 'starter'); // 60 rpm

      // Send 60 requests to exhaust the limit
      for (let i = 0; i < 60; i++) {
        const m = createMocks({ tenantId: tid, user: { role: 'ADMIN', tenantId: tid } });
        tenantRateLimit(m.req, m.res, m.next);
      }

      // The 61st request should be blocked
      const { req, res, next } = createMocks({ tenantId: tid, user: { role: 'ADMIN', tenantId: tid } });
      tenantRateLimit(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res._status).toBe(429);
      expect(res._json).toBeDefined();
      expect(res._json.code).toBe('TENANT_RATE_LIMITED');
      expect(res._json.limit).toBe(60);
      expect(res._json.retryAfterSeconds).toBeGreaterThan(0);
      expect(res._headers['Retry-After']).toBeDefined();
    });
  });

  describe('SUPER_ADMIN bypasses rate limiting', () => {
    it('calls next() without checking limits for SUPER_ADMIN', () => {
      const { req, res, next } = createMocks({
        tenantId: 'any-tenant',
        user: { role: 'SUPER_ADMIN', tenantId: 'any-tenant' },
      });

      tenantRateLimit(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res._status).toBeNull();
      // No rate limit headers should be set for SUPER_ADMIN
      expect(res._headers['X-RateLimit-Limit']).toBeUndefined();
    });

    it('SUPER_ADMIN is never blocked even after many requests', () => {
      for (let i = 0; i < 2000; i++) {
        const { req, res, next } = createMocks({
          tenantId: 'super-tenant',
          user: { role: 'SUPER_ADMIN', tenantId: 'super-tenant' },
        });
        tenantRateLimit(req, res, next);
        expect(next).toHaveBeenCalled();
        expect(res._status).toBeNull();
      }
    });
  });

  describe('different plans have different limits', () => {
    it.each([
      ['starter', 60],
      ['business', 300],
      ['enterprise', 1000],
      ['custom', 2000],
    ])('%s plan has rpm limit of %i', (plan, expectedRpm) => {
      const tid = uniqueTenantId();
      setTenantPlan(tid, plan);

      const { req, res, next } = createMocks({ tenantId: tid, user: { role: 'ADMIN', tenantId: tid } });
      tenantRateLimit(req, res, next);

      expect(res._headers['X-RateLimit-Limit']).toBe(String(expectedRpm));
    });

    it('PLAN_LIMITS matches expected values', () => {
      expect(PLAN_LIMITS.starter.rpm).toBe(60);
      expect(PLAN_LIMITS.business.rpm).toBe(300);
      expect(PLAN_LIMITS.enterprise.rpm).toBe(1000);
      expect(PLAN_LIMITS.custom.rpm).toBe(2000);
    });
  });

  describe('rate limit resets after the time window', () => {
    it('resets count when the 1-minute window expires', () => {
      const tid = uniqueTenantId();
      setTenantPlan(tid, 'starter'); // 60 rpm

      // Exhaust the limit
      for (let i = 0; i < 60; i++) {
        const m = createMocks({ tenantId: tid, user: { role: 'ADMIN', tenantId: tid } });
        tenantRateLimit(m.req, m.res, m.next);
      }

      // Verify blocked
      const blocked = createMocks({ tenantId: tid, user: { role: 'ADMIN', tenantId: tid } });
      tenantRateLimit(blocked.req, blocked.res, blocked.next);
      expect(blocked.res._status).toBe(429);

      // Advance time by > 60 seconds
      const realDateNow = Date.now;
      Date.now = jest.fn(() => realDateNow() + 61 * 1000);

      try {
        // After window reset, request should succeed
        const { req, res, next } = createMocks({ tenantId: tid, user: { role: 'ADMIN', tenantId: tid } });
        tenantRateLimit(req, res, next);

        expect(next).toHaveBeenCalled();
        expect(res._status).toBeNull();
        expect(res._headers['X-RateLimit-Remaining']).toBe(String(60 - 1));
      } finally {
        Date.now = realDateNow;
      }
    });
  });

  describe('edge cases', () => {
    it('passes through when no tenantId is present', () => {
      const { req, res, next } = createMocks({ tenantId: undefined, user: { role: 'ADMIN' } });
      delete req.tenantId;
      tenantRateLimit(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it('falls back to starter limits for unknown plan', () => {
      const tid = uniqueTenantId();
      setTenantPlan(tid, 'nonexistent_plan');

      const { req, res, next } = createMocks({ tenantId: tid, user: { role: 'ADMIN', tenantId: tid } });
      tenantRateLimit(req, res, next);

      expect(res._headers['X-RateLimit-Limit']).toBe('60');
    });

    it('uses req.user.tenantId when req.tenantId is missing', () => {
      const tid = uniqueTenantId();
      setTenantPlan(tid, 'business');

      const { req, res, next } = createMocks({ user: { role: 'ADMIN', tenantId: tid } });
      delete req.tenantId;
      tenantRateLimit(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res._headers['X-RateLimit-Limit']).toBe('300');
    });
  });
});
