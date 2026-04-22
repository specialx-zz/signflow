/**
 * VueSign Phase W1: 기상청 중기예보 서비스 (D+3 ~ D+10)
 *
 * 2종 API 병합:
 *   - getMidLandFcst: 중기 육상예보 (하늘상태/강수확률)
 *   - getMidTa:      중기 기온예보 (최고/최저)
 *
 * 발표 주기: 1일 2회 (06:00, 18:00)
 * 반환 범위: D+3 ~ D+10 (7일)
 *
 * 위치 지정:
 *   - getMidLandFcst: regIdLand (예: 11B00000 = 서울/인천/경기)
 *   - getMidTa:       regIdTa   (예: 11B10101 = 서울, 11H20201 = 부산)
 */
const { withCache } = require('./cache');

const LAND_URL = 'https://apis.data.go.kr/1360000/MidFcstInfoService/getMidLandFcst';
const TA_URL = 'https://apis.data.go.kr/1360000/MidFcstInfoService/getMidTa';
const TTL_SECONDS = 6 * 60 * 60; // 6시간
const TIMEOUT_MS = 10 * 1000;

// 중기예보 발표 시각: 06:00, 18:00
function getMidBaseTime(now = new Date()) {
  const kst = new Date(now.getTime() + (9 * 60 + now.getTimezoneOffset()) * 60 * 1000);
  let hh;
  let useYesterday = false;
  const h = kst.getHours();
  if (h >= 18) {
    hh = '1800';
  } else if (h >= 6) {
    hh = '0600';
  } else {
    // 자정~06시: 전날 18시 발표본 사용
    hh = '1800';
    useYesterday = true;
  }

  const target = useYesterday
    ? new Date(kst.getTime() - 24 * 60 * 60 * 1000)
    : kst;

  const yyyy = target.getFullYear();
  const mm = String(target.getMonth() + 1).padStart(2, '0');
  const dd = String(target.getDate()).padStart(2, '0');
  return `${yyyy}${mm}${dd}${hh}`;
}

// 중기 하늘상태 텍스트 → 표준 condition 매핑
function mapMidWfToCondition(wf) {
  if (!wf) return { key: 'unknown', label: '정보없음' };
  const w = String(wf);
  if (w.includes('비')) return { key: 'rain', label: w };
  if (w.includes('눈')) return { key: 'snow', label: w };
  if (w.includes('소나기')) return { key: 'shower', label: w };
  if (w.includes('맑음')) return { key: 'sunny', label: '맑음' };
  if (w.includes('구름많음')) return { key: 'partly_cloudy', label: '구름많음' };
  if (w.includes('흐림')) return { key: 'cloudy', label: '흐림' };
  return { key: 'unknown', label: w };
}

async function fetchLand(regIdLand, tmFc) {
  const serviceKey = process.env.KMA_SERVICE_KEY;
  if (!serviceKey) throw new Error('KMA_SERVICE_KEY is not configured');

  const url = new URL(LAND_URL);
  url.searchParams.set('serviceKey', serviceKey);
  url.searchParams.set('numOfRows', '10');
  url.searchParams.set('pageNo', '1');
  url.searchParams.set('dataType', 'JSON');
  url.searchParams.set('regId', regIdLand);
  url.searchParams.set('tmFc', tmFc);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url.toString(), { signal: controller.signal });
    if (!res.ok) throw new Error(`KMA midLand HTTP ${res.status}`);
    const text = await res.text();
    const json = JSON.parse(text);
    if (json?.response?.header?.resultCode !== '00') {
      throw new Error(`KMA midLand error: ${json?.response?.header?.resultMsg || 'unknown'}`);
    }
    const item = json?.response?.body?.items?.item?.[0];
    if (!item) throw new Error('KMA midLand: no data');
    return item;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchTa(regIdTa, tmFc) {
  const serviceKey = process.env.KMA_SERVICE_KEY;
  if (!serviceKey) throw new Error('KMA_SERVICE_KEY is not configured');

  const url = new URL(TA_URL);
  url.searchParams.set('serviceKey', serviceKey);
  url.searchParams.set('numOfRows', '10');
  url.searchParams.set('pageNo', '1');
  url.searchParams.set('dataType', 'JSON');
  url.searchParams.set('regId', regIdTa);
  url.searchParams.set('tmFc', tmFc);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url.toString(), { signal: controller.signal });
    if (!res.ok) throw new Error(`KMA midTa HTTP ${res.status}`);
    const text = await res.text();
    const json = JSON.parse(text);
    if (json?.response?.header?.resultCode !== '00') {
      throw new Error(`KMA midTa error: ${json?.response?.header?.resultMsg || 'unknown'}`);
    }
    const item = json?.response?.body?.items?.item?.[0];
    if (!item) throw new Error('KMA midTa: no data');
    return item;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * 중기예보 Land + Ta 응답을 D+3 ~ D+10 일별 배열로 병합.
 */
function mergeMidItems(landItem, taItem) {
  const days = [];
  const today = new Date();
  const kst = new Date(today.getTime() + (9 * 60 + today.getTimezoneOffset()) * 60 * 1000);

  for (let offset = 3; offset <= 10; offset++) {
    const targetDate = new Date(kst.getTime() + offset * 24 * 60 * 60 * 1000);
    const yyyy = targetDate.getFullYear();
    const mm = String(targetDate.getMonth() + 1).padStart(2, '0');
    const dd = String(targetDate.getDate()).padStart(2, '0');
    const date = `${yyyy}-${mm}-${dd}`;

    // wfXAm/wfXPm (~7일만 Am/Pm 분리, 8~10일은 단일)
    let wf;
    if (offset <= 7) {
      wf = landItem[`wf${offset}Am`] || landItem[`wf${offset}Pm`];
    } else {
      wf = landItem[`wf${offset}`];
    }

    // taMinX, taMaxX
    const maxV = taItem[`taMax${offset}`];
    const minV = taItem[`taMin${offset}`];
    const max = maxV !== undefined && maxV !== null && maxV !== '' ? Number(maxV) : null;
    const min = minV !== undefined && minV !== null && minV !== '' ? Number(minV) : null;

    days.push({
      date,
      max,
      min,
      condition: mapMidWfToCondition(wf),
      offset,
    });
  }

  return days;
}

async function fetchMidForecast(regIdLand, regIdTa) {
  const tmFc = getMidBaseTime();
  const [land, ta] = await Promise.all([
    fetchLand(regIdLand, tmFc),
    fetchTa(regIdTa, tmFc),
  ]);
  return {
    tmFc,
    days: mergeMidItems(land, ta),
  };
}

async function getMidForecast(regIdLand, regIdTa) {
  const cacheKey = `mid:${regIdLand}:${regIdTa}`;
  return withCache(cacheKey, TTL_SECONDS, () => fetchMidForecast(regIdLand, regIdTa));
}

module.exports = {
  getMidForecast,
  _internal: { getMidBaseTime, mapMidWfToCondition, mergeMidItems },
};
