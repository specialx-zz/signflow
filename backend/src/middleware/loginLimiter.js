/**
 * loginLimiter.js — 로그인 시도 제한 + 계정 잠금
 *
 * - IP 기반: 15분간 최대 15회 시도
 * - 계정 기반: 연속 5회 실패 → 15분 잠금
 * - 메모리 기반 (단일 인스턴스). 클러스터 배포 시 Redis로 교체 가능
 */

// ─── In-memory stores ───────────────────────────────
const ipAttempts = new Map();    // key: ip, value: { count, firstAttempt }
const accountAttempts = new Map(); // key: email, value: { count, lockedUntil }

const CONFIG = {
  // IP-based
  ipMaxAttempts: 15,
  ipWindowMs: 15 * 60 * 1000,    // 15분

  // Account-based
  accountMaxAttempts: 5,
  accountLockMs: 15 * 60 * 1000, // 15분 잠금

  // Cleanup interval
  cleanupIntervalMs: 10 * 60 * 1000, // 10분마다 만료 항목 정리
};

// ─── 주기적 정리 ─────────────────────────────────────
setInterval(() => {
  const now = Date.now();

  for (const [ip, data] of ipAttempts.entries()) {
    if (now - data.firstAttempt > CONFIG.ipWindowMs) {
      ipAttempts.delete(ip);
    }
  }

  for (const [email, data] of accountAttempts.entries()) {
    if (data.lockedUntil && now > data.lockedUntil) {
      accountAttempts.delete(email);
    } else if (!data.lockedUntil && now - data.firstAttempt > CONFIG.ipWindowMs) {
      accountAttempts.delete(email);
    }
  }
}, CONFIG.cleanupIntervalMs);

/**
 * IP 기반 로그인 제한 미들웨어
 */
function checkIpLimit(req, res, next) {
  const ip = req.ip || req.headers['x-forwarded-for'] || 'unknown';
  const now = Date.now();

  let record = ipAttempts.get(ip);
  if (!record || (now - record.firstAttempt > CONFIG.ipWindowMs)) {
    record = { count: 0, firstAttempt: now };
    ipAttempts.set(ip, record);
  }

  if (record.count >= CONFIG.ipMaxAttempts) {
    const retryAfter = Math.ceil((record.firstAttempt + CONFIG.ipWindowMs - now) / 1000);
    return res.status(429).json({
      error: '너무 많은 로그인 시도입니다. 잠시 후 다시 시도해주세요.',
      retryAfterSeconds: retryAfter,
      code: 'IP_RATE_LIMITED',
    });
  }

  next();
}

/**
 * 계정 잠금 체크 미들웨어
 */
function checkAccountLock(req, res, next) {
  const { email } = req.body;
  if (!email) return next();

  const now = Date.now();
  const record = accountAttempts.get(email.toLowerCase());

  if (record && record.lockedUntil) {
    if (now < record.lockedUntil) {
      const retryAfter = Math.ceil((record.lockedUntil - now) / 1000);
      return res.status(423).json({
        error: '계정이 일시적으로 잠겼습니다. 잠시 후 다시 시도해주세요.',
        retryAfterSeconds: retryAfter,
        code: 'ACCOUNT_LOCKED',
      });
    }
    // 잠금 해제
    accountAttempts.delete(email.toLowerCase());
  }

  next();
}

/**
 * 로그인 실패 기록
 */
function recordFailedLogin(ip, email) {
  const now = Date.now();

  // IP 기록
  const ipRecord = ipAttempts.get(ip) || { count: 0, firstAttempt: now };
  ipRecord.count++;
  ipAttempts.set(ip, ipRecord);

  // 계정 기록
  if (email) {
    const key = email.toLowerCase();
    const acctRecord = accountAttempts.get(key) || { count: 0, firstAttempt: now };
    acctRecord.count++;

    if (acctRecord.count >= CONFIG.accountMaxAttempts) {
      acctRecord.lockedUntil = now + CONFIG.accountLockMs;
      console.warn(`[Security] Account locked: ${email} (${acctRecord.count} failed attempts)`);
    }

    accountAttempts.set(key, acctRecord);
  }
}

/**
 * 로그인 성공 시 기록 초기화
 */
function recordSuccessfulLogin(ip, email) {
  if (email) {
    accountAttempts.delete(email.toLowerCase());
  }
  // IP 기록은 윈도우 만료 시 자동 정리
}

/**
 * 계정 잠금 상태 조회 (관리자용)
 */
function getAccountStatus(email) {
  const record = accountAttempts.get(email.toLowerCase());
  if (!record) return { locked: false, failedAttempts: 0 };
  return {
    locked: record.lockedUntil ? Date.now() < record.lockedUntil : false,
    failedAttempts: record.count,
    lockedUntil: record.lockedUntil ? new Date(record.lockedUntil).toISOString() : null,
  };
}

/**
 * 관리자 계정 잠금 해제
 */
function unlockAccount(email) {
  accountAttempts.delete(email.toLowerCase());
}

module.exports = {
  checkIpLimit,
  checkAccountLock,
  recordFailedLogin,
  recordSuccessfulLogin,
  getAccountStatus,
  unlockAccount,
  CONFIG,
};
