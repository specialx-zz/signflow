require('../../setup');

const {
  checkIpLimit,
  checkAccountLock,
  recordFailedLogin,
  recordSuccessfulLogin,
  getAccountStatus,
  unlockAccount,
  CONFIG,
} = require('../../../src/middleware/loginLimiter');

// ─── Helpers ──────────────────────────────────────────
function mockReq(overrides = {}) {
  return {
    ip: '127.0.0.1',
    headers: {},
    body: {},
    ...overrides,
  };
}

function mockRes() {
  const res = {
    statusCode: null,
    body: null,
    status(code) {
      res.statusCode = code;
      return res;
    },
    json(data) {
      res.body = data;
      return res;
    },
  };
  return res;
}

// ─── Reset state between tests ───────────────────────
// The module uses module-level Maps. We clear them by unlocking /
// recording successful logins and relying on internal cleanup.
// A more direct approach: reach into the module internals.
// Since the Maps are not exported, we reset via the public API.

const TEST_IP = '10.0.0.1';
const TEST_EMAIL = 'test@example.com';

beforeEach(() => {
  // Reset account state via public API
  unlockAccount(TEST_EMAIL);
  // For IP state, record a successful login won't clear IP records,
  // but we can use a unique IP per test if needed.
  // We'll use unique IPs where IP isolation matters.
});

// ─── recordFailedLogin / getAccountStatus ─────────────
describe('recordFailedLogin', () => {
  test('tracks failed attempts for an account', () => {
    const ip = '10.1.0.1';
    recordFailedLogin(ip, TEST_EMAIL);

    const status = getAccountStatus(TEST_EMAIL);
    expect(status.failedAttempts).toBe(1);
    expect(status.locked).toBe(false);
  });

  test('increments count on repeated failures', () => {
    const ip = '10.1.0.2';
    recordFailedLogin(ip, TEST_EMAIL);
    recordFailedLogin(ip, TEST_EMAIL);
    recordFailedLogin(ip, TEST_EMAIL);

    const status = getAccountStatus(TEST_EMAIL);
    expect(status.failedAttempts).toBe(3);
    expect(status.locked).toBe(false);
  });

  test(`locks account after ${CONFIG.accountMaxAttempts} failed attempts`, () => {
    const ip = '10.1.0.3';
    for (let i = 0; i < CONFIG.accountMaxAttempts; i++) {
      recordFailedLogin(ip, TEST_EMAIL);
    }

    const status = getAccountStatus(TEST_EMAIL);
    expect(status.locked).toBe(true);
    expect(status.failedAttempts).toBe(CONFIG.accountMaxAttempts);
    expect(status.lockedUntil).toBeTruthy();
  });

  test('handles null email gracefully (IP-only tracking)', () => {
    const ip = '10.1.0.4';
    expect(() => recordFailedLogin(ip, null)).not.toThrow();
    // No account record created
    const status = getAccountStatus('nonexistent@test.com');
    expect(status.failedAttempts).toBe(0);
    expect(status.locked).toBe(false);
  });

  test('email is case-insensitive', () => {
    const ip = '10.1.0.5';
    recordFailedLogin(ip, 'User@Example.COM');
    recordFailedLogin(ip, 'user@example.com');

    const status = getAccountStatus('USER@EXAMPLE.COM');
    expect(status.failedAttempts).toBe(2);
  });
});

// ─── recordSuccessfulLogin ────────────────────────────
describe('recordSuccessfulLogin', () => {
  test('resets failed attempt counter for the account', () => {
    const ip = '10.2.0.1';
    recordFailedLogin(ip, TEST_EMAIL);
    recordFailedLogin(ip, TEST_EMAIL);
    expect(getAccountStatus(TEST_EMAIL).failedAttempts).toBe(2);

    recordSuccessfulLogin(ip, TEST_EMAIL);
    const status = getAccountStatus(TEST_EMAIL);
    expect(status.failedAttempts).toBe(0);
    expect(status.locked).toBe(false);
  });

  test('handles null email without error', () => {
    expect(() => recordSuccessfulLogin('10.2.0.2', null)).not.toThrow();
  });
});

// ─── getAccountStatus ─────────────────────────────────
describe('getAccountStatus', () => {
  test('returns unlocked with 0 attempts for unknown email', () => {
    const status = getAccountStatus('unknown@test.com');
    expect(status).toEqual({
      locked: false,
      failedAttempts: 0,
    });
  });

  test('returns correct locked status with lockedUntil timestamp', () => {
    const ip = '10.3.0.1';
    for (let i = 0; i < CONFIG.accountMaxAttempts; i++) {
      recordFailedLogin(ip, TEST_EMAIL);
    }

    const status = getAccountStatus(TEST_EMAIL);
    expect(status.locked).toBe(true);
    expect(status.lockedUntil).toBeTruthy();
    // lockedUntil should be an ISO string in the future
    expect(new Date(status.lockedUntil).getTime()).toBeGreaterThan(Date.now());
  });
});

// ─── unlockAccount ────────────────────────────────────
describe('unlockAccount', () => {
  test('unlocks a locked account', () => {
    const ip = '10.4.0.1';
    for (let i = 0; i < CONFIG.accountMaxAttempts; i++) {
      recordFailedLogin(ip, TEST_EMAIL);
    }
    expect(getAccountStatus(TEST_EMAIL).locked).toBe(true);

    unlockAccount(TEST_EMAIL);

    const status = getAccountStatus(TEST_EMAIL);
    expect(status.locked).toBe(false);
    expect(status.failedAttempts).toBe(0);
  });

  test('is a no-op for an account that is not locked', () => {
    expect(() => unlockAccount('nobody@test.com')).not.toThrow();
    const status = getAccountStatus('nobody@test.com');
    expect(status.locked).toBe(false);
  });

  test('email is case-insensitive', () => {
    const ip = '10.4.0.2';
    for (let i = 0; i < CONFIG.accountMaxAttempts; i++) {
      recordFailedLogin(ip, 'Lock@Test.COM');
    }
    expect(getAccountStatus('lock@test.com').locked).toBe(true);

    unlockAccount('LOCK@TEST.COM');
    expect(getAccountStatus('lock@test.com').locked).toBe(false);
  });
});

// ─── checkIpLimit middleware ──────────────────────────
describe('checkIpLimit', () => {
  test('allows request when under the IP limit', () => {
    const req = mockReq({ ip: '10.5.0.1' });
    const res = mockRes();
    const next = jest.fn();

    checkIpLimit(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(res.statusCode).toBeNull();
  });

  test(`blocks request after ${CONFIG.ipMaxAttempts} attempts from same IP`, () => {
    const ip = '10.5.0.2';

    // Record failures to fill IP counter
    for (let i = 0; i < CONFIG.ipMaxAttempts; i++) {
      recordFailedLogin(ip, `user${i}@test.com`);
    }

    const req = mockReq({ ip });
    const res = mockRes();
    const next = jest.fn();

    checkIpLimit(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(429);
    expect(res.body.code).toBe('IP_RATE_LIMITED');
    expect(res.body.retryAfterSeconds).toBeGreaterThan(0);
  });

  test('uses x-forwarded-for header when req.ip is not set', () => {
    const req = mockReq({ ip: undefined, headers: { 'x-forwarded-for': '10.5.0.3' } });
    const res = mockRes();
    const next = jest.fn();

    checkIpLimit(req, res, next);
    expect(next).toHaveBeenCalled();
  });
});

// ─── checkAccountLock middleware ──────────────────────
describe('checkAccountLock', () => {
  test('allows request when account is not locked', () => {
    const req = mockReq({ body: { email: TEST_EMAIL } });
    const res = mockRes();
    const next = jest.fn();

    checkAccountLock(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  test('blocks request when account is locked', () => {
    const ip = '10.6.0.1';
    for (let i = 0; i < CONFIG.accountMaxAttempts; i++) {
      recordFailedLogin(ip, TEST_EMAIL);
    }

    const req = mockReq({ body: { email: TEST_EMAIL } });
    const res = mockRes();
    const next = jest.fn();

    checkAccountLock(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(423);
    expect(res.body.code).toBe('ACCOUNT_LOCKED');
    expect(res.body.retryAfterSeconds).toBeGreaterThan(0);
  });

  test('calls next when no email is provided in body', () => {
    const req = mockReq({ body: {} });
    const res = mockRes();
    const next = jest.fn();

    checkAccountLock(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  test('email lookup is case-insensitive', () => {
    const ip = '10.6.0.2';
    for (let i = 0; i < CONFIG.accountMaxAttempts; i++) {
      recordFailedLogin(ip, 'Case@Test.COM');
    }

    const req = mockReq({ body: { email: 'case@test.com' } });
    const res = mockRes();
    const next = jest.fn();

    checkAccountLock(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(423);
  });
});

// ─── CONFIG sanity checks ─────────────────────────────
describe('CONFIG', () => {
  test('has expected default values', () => {
    expect(CONFIG.ipMaxAttempts).toBe(15);
    expect(CONFIG.accountMaxAttempts).toBe(5);
    expect(CONFIG.ipWindowMs).toBe(15 * 60 * 1000);
    expect(CONFIG.accountLockMs).toBe(15 * 60 * 1000);
  });
});
