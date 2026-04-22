/**
 * VueSign Phase W1: 날씨 서비스 통합 진입점
 *
 * 컨트롤러에서 위치 ID만 넘기면 현재/주간/대기질 데이터를 정규화된 형태로 반환.
 */
const prisma = require('../../utils/prisma');
const { getShortForecast } = require('./kmaShortForecast');
const { getMidForecast } = require('./kmaMidForecast');
const { getAirByStation } = require('./airKorea');

async function getLocation(locationId) {
  const loc = await prisma.weatherLocation.findUnique({ where: { id: locationId } });
  if (!loc) throw new Error('Location not found');
  return loc;
}

// ─── 요일 한글 ─────────
const DOW_KR = ['일', '월', '화', '수', '목', '금', '토'];

function dowLabel(dateStr) {
  // dateStr: "YYYY-MM-DD"
  const d = new Date(`${dateStr}T00:00:00+09:00`);
  return DOW_KR[d.getDay()];
}

/**
 * 현재 날씨 (기온, 상태, 오늘 최고/최저)
 */
async function getCurrent(locationId) {
  const loc = await getLocation(locationId);
  const short = await getShortForecast(loc.nx, loc.ny);
  const d = short.data;
  return {
    location: {
      id: loc.id,
      sido: loc.sido,
      sigungu: loc.sigungu,
      displayName: loc.displayName,
    },
    fetchedAt: new Date().toISOString(),
    current: {
      temperature: d.currentTemp,
      condition: d.currentCondition.key,
      conditionLabel: d.currentCondition.label,
    },
    today: {
      max: d.todayMax,
      min: d.todayMin,
    },
    stale: short.stale,
  };
}

/**
 * 주간 날씨 (오늘 포함 N일치)
 * 단기예보(D0~D2) + 중기예보(D+3~D+N)를 병합.
 */
async function getWeekly(locationId, days = 7) {
  const loc = await getLocation(locationId);

  const [short, mid] = await Promise.all([
    getShortForecast(loc.nx, loc.ny),
    getMidForecast(loc.regIdLand, loc.regIdTa).catch(err => {
      console.warn('[weather] midForecast failed:', err.message);
      return { data: { days: [] }, stale: true };
    }),
  ]);

  // 단기: 오늘 포함 D0~D2
  const shortDays = short.data.days.map(d => ({
    date: d.date,
    dow: dowLabel(d.date),
    max: d.max,
    min: d.min,
    condition: d.condition.key,
    conditionLabel: d.condition.label,
  }));

  const midDays = (mid.data.days || []).map(d => ({
    date: d.date,
    dow: dowLabel(d.date),
    max: d.max,
    min: d.min,
    condition: d.condition.key,
    conditionLabel: d.condition.label,
  }));

  // 병합: 중복 제거 (같은 date는 단기 우선)
  const byDate = new Map();
  for (const d of shortDays) byDate.set(d.date, d);
  for (const d of midDays) {
    if (!byDate.has(d.date)) byDate.set(d.date, d);
  }

  const merged = [...byDate.values()]
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, days);

  return {
    location: {
      id: loc.id,
      sido: loc.sido,
      sigungu: loc.sigungu,
      displayName: loc.displayName,
    },
    fetchedAt: new Date().toISOString(),
    days: merged,
    stale: short.stale || mid.stale,
  };
}

/**
 * 대기질 (PM10, PM2.5)
 */
async function getAir(locationId) {
  const loc = await getLocation(locationId);
  if (!loc.airStationName) {
    throw new Error(`No air station mapping for location ${loc.displayName}`);
  }
  const air = await getAirByStation(loc.airStationName);
  const d = air.data;
  return {
    location: {
      id: loc.id,
      sido: loc.sido,
      sigungu: loc.sigungu,
      displayName: loc.displayName,
      stationName: d.stationName,
    },
    fetchedAt: new Date().toISOString(),
    dataTime: d.dataTime,
    pm10: d.pm10,
    pm25: d.pm25,
    stale: air.stale,
  };
}

module.exports = { getCurrent, getWeekly, getAir, getLocation };
