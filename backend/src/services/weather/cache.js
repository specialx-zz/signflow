/**
 * VueSign Phase W1: 날씨 응답 캐시 (DB 기반)
 *
 * Redis 없는 환경을 위해 WeatherCache 모델을 사용.
 * 같은 격자/측정소를 공유하는 모든 매장이 단일 fetch 결과를 재사용한다.
 */
const prisma = require('../../utils/prisma');

async function getCache(cacheKey) {
  const row = await prisma.weatherCache.findUnique({ where: { cacheKey } });
  if (!row) return null;
  const isExpired = row.expiresAt.getTime() < Date.now();
  try {
    const payload = JSON.parse(row.payload);
    return { payload, fetchedAt: row.fetchedAt, expired: isExpired };
  } catch {
    return null;
  }
}

async function setCache(cacheKey, payload, ttlSeconds) {
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
  const body = JSON.stringify(payload);
  // 여러 위젯이 동시에 같은 cacheKey 로 upsert 하면 Prisma 에서
  // P2002 (Unique constraint failed) race condition 이 발생한다.
  // 충돌 시 update 로 폴백해서 실패를 흡수한다.
  try {
    await prisma.weatherCache.upsert({
      where: { cacheKey },
      update: { payload: body, fetchedAt: new Date(), expiresAt },
      create: { cacheKey, payload: body, fetchedAt: new Date(), expiresAt },
    });
  } catch (err) {
    if (err && err.code === 'P2002') {
      try {
        await prisma.weatherCache.update({
          where: { cacheKey },
          data: { payload: body, fetchedAt: new Date(), expiresAt },
        });
      } catch (updateErr) {
        // 여기까지 실패해도 캐시 저장 실패일 뿐 호출자 로직은 계속 진행
        console.warn(`[weather-cache] setCache fallback update failed for ${cacheKey}:`, updateErr.message);
      }
    } else {
      // upsert 실패는 캐시 쓰기 실패로만 취급하고 호출자로 에러를 전파하지 않는다
      // (그렇지 않으면 외부 API 에서 성공적으로 받은 데이터조차 날아가 버린다)
      console.warn(`[weather-cache] setCache failed for ${cacheKey}:`, err.message);
    }
  }
}

/**
 * 캐시 우선 fetch. 캐시 히트 시 외부 API 호출 없음.
 * 캐시 미스/만료 시 fetcher() 호출 → 성공 시 저장, 실패 시 만료된 캐시라도 stale 플래그와 함께 반환.
 */
async function withCache(cacheKey, ttlSeconds, fetcher) {
  const cached = await getCache(cacheKey);
  if (cached && !cached.expired) {
    return { data: cached.payload, stale: false, cached: true };
  }

  try {
    const fresh = await fetcher();
    await setCache(cacheKey, fresh, ttlSeconds);
    return { data: fresh, stale: false, cached: false };
  } catch (err) {
    // 실패 — 만료된 캐시라도 있으면 stale로 반환
    if (cached) {
      console.warn(`[weather-cache] ${cacheKey} fetcher failed, returning stale cache:`, err.message);
      return { data: cached.payload, stale: true, cached: true };
    }
    throw err;
  }
}

module.exports = { getCache, setCache, withCache };
