/**
 * 업체 격리 미들웨어
 *
 * authenticate 미들웨어 이후에 실행되며:
 *   - req.tenantId 설정 (현재 사용자의 업체)
 *   - SUPER_ADMIN은 X-Tenant-Id 헤더로 특정 업체 컨텍스트 전환 가능
 *   - req.tenantWhere(extra) 헬퍼로 모든 쿼리에 tenantId 자동 주입
 */

/**
 * 업체 컨텍스트 미들웨어
 * - SUPER_ADMIN: X-Tenant-Id 헤더가 있으면 해당 업체, 없으면 전체 접근
 * - 일반 사용자: 자기 업체만
 */
const tenantContext = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  if (req.user.role === 'SUPER_ADMIN') {
    // 슈퍼어드민은 헤더로 특정 업체를 지정하거나, 전체 접근
    const headerTenantId = req.headers['x-tenant-id'];
    req.tenantId = headerTenantId || null; // null = 전체 접근
  } else {
    if (!req.user.tenantId) {
      // Non-SUPER_ADMIN users must always have a tenantId
      return res.status(403).json({ error: '유효하지 않은 사용자 컨텍스트입니다' });
    }
    req.tenantId = req.user.tenantId;
  }

  // 헬퍼: tenantId를 where 조건에 자동 추가
  req.tenantWhere = (extra = {}) => {
    if (req.tenantId) {
      return { tenantId: req.tenantId, ...extra };
    }
    // SUPER_ADMIN이 특정 업체를 지정하지 않은 경우 → 필터 없음
    return extra;
  };

  // 헬퍼: 생성 시 tenantId 자동 포함
  req.tenantData = (extra = {}) => {
    const tid = req.tenantId || req.user.tenantId;
    return { tenantId: tid, ...extra };
  };

  next();
};

/**
 * 업체 필수 미들웨어 — tenantId가 반드시 있어야 하는 라우트용
 */
const requireTenant = (req, res, next) => {
  if (!req.tenantId) {
    return res.status(400).json({ error: '업체 컨텍스트가 필요합니다. X-Tenant-Id 헤더를 설정하세요.' });
  }
  next();
};

/**
 * 매장 필터 미들웨어 — STORE_MANAGER인 경우 자기 매장만 접근
 */
const storeFilter = (req, res, next) => {
  if (req.user.role === 'STORE_MANAGER' && req.user.storeId) {
    req.storeId = req.user.storeId;
  } else {
    req.storeId = null; // 필터 없음
  }
  next();
};

/**
 * 리소스 소유권 확인
 * - 해당 리소스가 현재 업체에 속하는지 확인
 */
function verifyTenantOwnership(resource, req) {
  if (!resource) return false;
  // SUPER_ADMIN이 특정 업체를 지정하지 않은 경우 → 항상 통과
  if (req.user.role === 'SUPER_ADMIN' && !req.tenantId) return true;
  return resource.tenantId === req.tenantId;
}

module.exports = { tenantContext, requireTenant, storeFilter, verifyTenantOwnership };
