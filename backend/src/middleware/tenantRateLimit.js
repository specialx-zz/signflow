/**
 * tenantRateLimit.js — 테넌트별 API 요청 제한
 *
 * 구독 플랜에 따라 분당 요청 수 제한
 * - starter:    60 req/min
 * - business:  300 req/min
 * - enterprise: 1000 req/min
 * - SUPER_ADMIN: 무제한
 */

const PLAN_LIMITS = {
  starter:    { rpm: 60 },
  business:   { rpm: 300 },
  enterprise: { rpm: 1000 },
  custom:     { rpm: 2000 },
};

const DEFAULT_RPM = 60;
const WINDOW_MS = 60 * 1000; // 1분

// key: tenantId, value: { count, windowStart }
const tenantBuckets = new Map();

// 주기적 정리 (5분마다)
setInterval(() => {
  const now = Date.now();
  for (const [tenantId, bucket] of tenantBuckets.entries()) {
    if (now - bucket.windowStart > WINDOW_MS * 2) {
      tenantBuckets.delete(tenantId);
    }
  }
}, 5 * 60 * 1000);

/**
 * 테넌트별 Rate Limit 미들웨어
 * - authenticate 미들웨어 이후에 사용
 * - req.user.role과 req.user.tenantId 필요
 */
const tenantRateLimit = (req, res, next) => {
  // SUPER_ADMIN은 제한 없음
  if (req.user && req.user.role === 'SUPER_ADMIN') {
    return next();
  }

  const tenantId = req.tenantId || (req.user && req.user.tenantId);
  if (!tenantId) return next(); // 테넌트 정보 없으면 패스

  const now = Date.now();
  let bucket = tenantBuckets.get(tenantId);

  if (!bucket || (now - bucket.windowStart > WINDOW_MS)) {
    bucket = { count: 0, windowStart: now, plan: bucket?.plan || 'starter' };
    tenantBuckets.set(tenantId, bucket);
  }

  bucket.count++;

  // 플랜 한도 (subscription에서 가져온 plan 우선, 아니면 기본값)
  const planName = bucket.plan;
  const limit = (PLAN_LIMITS[planName] || PLAN_LIMITS.starter).rpm;

  // Rate limit 헤더
  res.set('X-RateLimit-Limit', String(limit));
  res.set('X-RateLimit-Remaining', String(Math.max(0, limit - bucket.count)));
  res.set('X-RateLimit-Reset', String(Math.ceil((bucket.windowStart + WINDOW_MS) / 1000)));

  if (bucket.count > limit) {
    const retryAfter = Math.ceil((bucket.windowStart + WINDOW_MS - now) / 1000);
    res.set('Retry-After', String(retryAfter));
    return res.status(429).json({
      error: 'API 요청 한도를 초과했습니다.',
      code: 'TENANT_RATE_LIMITED',
      limit,
      retryAfterSeconds: retryAfter,
    });
  }

  next();
};

/**
 * 테넌트의 플랜 정보 캐싱 (subscription 미들웨어나 로그인 시 호출)
 */
function setTenantPlan(tenantId, plan) {
  const bucket = tenantBuckets.get(tenantId);
  if (bucket) {
    bucket.plan = plan;
  } else {
    tenantBuckets.set(tenantId, { count: 0, windowStart: Date.now(), plan });
  }
}

module.exports = { tenantRateLimit, setTenantPlan, PLAN_LIMITS };
