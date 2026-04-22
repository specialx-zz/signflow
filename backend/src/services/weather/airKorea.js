/**
 * VueSign Phase W1: 에어코리아 대기오염정보 서비스
 *
 * 엔드포인트: https://apis.data.go.kr/B552584/ArpltnInforInqireSvc/getMsrstnAcctoRltmMesureDnsty
 * 방식: 측정소명 직접 호출 (시군구 → 대표 측정소명은 WeatherLocation 테이블에 저장됨)
 *
 * 응답에서 PM10, PM2.5, 등급(1~4)을 추출.
 *
 * ─── 등급 (2018년 개정 기준) ─────────
 *   PM10: 1=0~30, 2=31~80, 3=81~150, 4=151+
 *   PM2.5: 1=0~15, 2=16~35, 3=36~75, 4=76+
 */
const { withCache } = require('./cache');

const BASE_URL = 'https://apis.data.go.kr/B552584/ArpltnInforInqireSvc/getMsrstnAcctoRltmMesureDnsty';
const TTL_SECONDS = 15 * 60; // 15분
const TIMEOUT_MS = 10 * 1000;

const GRADE_LABELS = { 1: '좋음', 2: '보통', 3: '나쁨', 4: '매우나쁨' };

function normalizeGrade(raw) {
  const n = Number(raw);
  if (n >= 1 && n <= 4) return n;
  return null;
}

async function fetchAirByStation(stationName) {
  const serviceKey = process.env.AIRKOREA_SERVICE_KEY;
  if (!serviceKey) throw new Error('AIRKOREA_SERVICE_KEY is not configured');

  const url = new URL(BASE_URL);
  url.searchParams.set('serviceKey', serviceKey);
  url.searchParams.set('returnType', 'json');
  url.searchParams.set('numOfRows', '1');
  url.searchParams.set('pageNo', '1');
  url.searchParams.set('stationName', stationName);
  url.searchParams.set('dataTerm', 'DAILY');
  url.searchParams.set('ver', '1.3');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let json;
  try {
    const res = await fetch(url.toString(), { signal: controller.signal });
    if (!res.ok) throw new Error(`AirKorea HTTP ${res.status}`);
    const text = await res.text();
    try {
      json = JSON.parse(text);
    } catch {
      throw new Error(`AirKorea non-JSON response: ${text.slice(0, 200)}`);
    }
  } finally {
    clearTimeout(timer);
  }

  const header = json?.response?.header;
  if (!header || header.resultCode !== '00') {
    throw new Error(`AirKorea error: ${header?.resultMsg || 'unknown'}`);
  }

  const item = json?.response?.body?.items?.[0];
  if (!item) throw new Error('AirKorea: no data');

  const pm10Value = item.pm10Value && item.pm10Value !== '-' ? Number(item.pm10Value) : null;
  const pm25Value = item.pm25Value && item.pm25Value !== '-' ? Number(item.pm25Value) : null;
  const pm10Grade = normalizeGrade(item.pm10Grade);
  const pm25Grade = normalizeGrade(item.pm25Grade);

  return {
    stationName,
    dataTime: item.dataTime || null,
    pm10: {
      value: Number.isFinite(pm10Value) ? pm10Value : null,
      grade: pm10Grade,
      gradeLabel: pm10Grade ? GRADE_LABELS[pm10Grade] : null,
    },
    pm25: {
      value: Number.isFinite(pm25Value) ? pm25Value : null,
      grade: pm25Grade,
      gradeLabel: pm25Grade ? GRADE_LABELS[pm25Grade] : null,
    },
  };
}

async function getAirByStation(stationName) {
  if (!stationName) throw new Error('stationName required');
  const cacheKey = `air:${stationName}`;
  return withCache(cacheKey, TTL_SECONDS, () => fetchAirByStation(stationName));
}

module.exports = { getAirByStation, GRADE_LABELS };
