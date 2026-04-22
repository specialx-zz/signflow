/**
 * VueSign Phase W1: 기상청 단기예보 (동네예보) 서비스
 *
 * 엔드포인트: https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getVilageFcst
 * 발표 주기: 1일 8회 (02/05/08/11/14/17/20/23시)
 * 제공 범위: 발표일 + 2~3일 (오늘/내일/모레)
 *
 * 반환 데이터:
 *   - 현재 기온 (가장 가까운 미래 시각의 TMP)
 *   - 오늘 최고기온 (TMX, 1500 고정)
 *   - 오늘 최저기온 (TMN, 0600 고정)
 *   - 현재 날씨 상태 (PTY + SKY 조합 → condition 코드)
 *   - 오늘~D+2 일별 요약 (최고/최저/상태)
 *
 * 위치 지정: nx/ny 격자 좌표
 */
const { withCache } = require('./cache');

const BASE_URL = 'https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getVilageFcst';
const TTL_SECONDS = 30 * 60; // 30분
const TIMEOUT_MS = 10 * 1000;

// ─── 유틸: 가장 최근 발표 시각 계산 ─────────────────
// 발표 시각: 02, 05, 08, 11, 14, 17, 20, 23시
// 데이터 제공 시각: 발표시각 + 약 10분
// 따라서 현재 시각에서 10분 뺀 후, 그 이하 가장 가까운 발표시각 선택.
const BASE_TIMES = [2, 5, 8, 11, 14, 17, 20, 23];

function getBaseDateTime(now = new Date()) {
  // KST 기준 (서버가 UTC일 수도 있으니 Asia/Seoul 강제)
  const kstOffsetMs = 9 * 60 * 60 * 1000;
  const utcMs = now.getTime() + (now.getTimezoneOffset() * 60 * 1000);
  const kstDate = new Date(utcMs + kstOffsetMs);

  // 10분 여유를 둠
  const minuted = new Date(kstDate.getTime() - 10 * 60 * 1000);
  let baseHour = null;
  const currentHour = minuted.getHours();
  for (let i = BASE_TIMES.length - 1; i >= 0; i--) {
    if (BASE_TIMES[i] <= currentHour) {
      baseHour = BASE_TIMES[i];
      break;
    }
  }

  let targetDate = minuted;
  if (baseHour === null) {
    // 자정~02시: 전날 23시 발표
    targetDate = new Date(minuted.getTime() - 24 * 60 * 60 * 1000);
    baseHour = 23;
  }

  const yyyy = targetDate.getFullYear();
  const mm = String(targetDate.getMonth() + 1).padStart(2, '0');
  const dd = String(targetDate.getDate()).padStart(2, '0');
  const hh = String(baseHour).padStart(2, '0');

  return {
    baseDate: `${yyyy}${mm}${dd}`,
    baseTime: `${hh}00`,
  };
}

// ─── SKY + PTY → 표준 condition 매핑 ───────────────
// 문서: https://datawiki.kma.go.kr/doku.php?id=기상예보:날씨예보:단기예보
function mapCondition(ptyValue, skyValue) {
  const pty = Number(ptyValue);
  const sky = Number(skyValue);
  if (pty === 1 || pty === 2) return { key: 'rain',           label: '비' };
  if (pty === 3)              return { key: 'snow',           label: '눈' };
  if (pty === 4)              return { key: 'shower',         label: '소나기' };
  if (sky === 1)              return { key: 'sunny',          label: '맑음' };
  if (sky === 3)              return { key: 'partly_cloudy',  label: '구름많음' };
  if (sky === 4)              return { key: 'cloudy',         label: '흐림' };
  return { key: 'unknown', label: '정보없음' };
}

async function fetchShortForecast(nx, ny) {
  const serviceKey = process.env.KMA_SERVICE_KEY;
  if (!serviceKey) {
    throw new Error('KMA_SERVICE_KEY is not configured');
  }

  const { baseDate, baseTime } = getBaseDateTime();
  const url = new URL(BASE_URL);
  url.searchParams.set('serviceKey', serviceKey);
  url.searchParams.set('numOfRows', '1000');
  url.searchParams.set('pageNo', '1');
  url.searchParams.set('dataType', 'JSON');
  url.searchParams.set('base_date', baseDate);
  url.searchParams.set('base_time', baseTime);
  url.searchParams.set('nx', String(nx));
  url.searchParams.set('ny', String(ny));

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let json;
  try {
    const res = await fetch(url.toString(), { signal: controller.signal });
    if (!res.ok) throw new Error(`KMA short HTTP ${res.status}`);
    const text = await res.text();
    try {
      json = JSON.parse(text);
    } catch {
      // 공공데이터포털은 에러 시 XML 반환하기도 함
      throw new Error(`KMA short non-JSON response: ${text.slice(0, 200)}`);
    }
  } finally {
    clearTimeout(timer);
  }

  const header = json?.response?.header;
  if (!header || header.resultCode !== '00') {
    throw new Error(`KMA short error: ${header?.resultMsg || 'unknown'}`);
  }

  const items = json?.response?.body?.items?.item || [];
  return parseShortForecastItems(items, baseDate, baseTime);
}

/**
 * 기상청 items 배열을 정규화된 구조로 변환.
 *
 * 반환:
 *   {
 *     baseDate, baseTime,
 *     currentTemp: number,          // TMP 중 가장 가까운 미래 시각
 *     currentCondition: { key, label },
 *     todayMax: number,             // TMX (없으면 null)
 *     todayMin: number,             // TMN (없으면 null)
 *     days: [{ date, max, min, condition: { key, label } }]  // 오늘 포함 최대 3일
 *   }
 */
function parseShortForecastItems(items, baseDate, baseTime) {
  // items를 fcstDate → fcstTime → category 형태로 그룹화
  const byDate = new Map();
  for (const it of items) {
    if (!byDate.has(it.fcstDate)) byDate.set(it.fcstDate, new Map());
    const dateMap = byDate.get(it.fcstDate);
    if (!dateMap.has(it.fcstTime)) dateMap.set(it.fcstTime, {});
    dateMap.get(it.fcstTime)[it.category] = it.fcstValue;
  }

  // 현재 KST 기준 "현재 시각" 계산
  const now = new Date();
  const kst = new Date(now.getTime() + (9 * 60 + now.getTimezoneOffset()) * 60 * 1000);
  const nowDateStr = `${kst.getFullYear()}${String(kst.getMonth() + 1).padStart(2, '0')}${String(kst.getDate()).padStart(2, '0')}`;
  const nowTimeNumber = kst.getHours() * 100 + kst.getMinutes();

  // 현재 기온: 오늘 날짜 중 현재 시각과 같거나 바로 이후의 TMP
  let currentTemp = null;
  let currentPty = '0';
  let currentSky = '1';
  const todayMap = byDate.get(nowDateStr);
  if (todayMap) {
    const sortedTimes = [...todayMap.keys()].sort();
    for (const t of sortedTimes) {
      const tNum = parseInt(t, 10);
      if (tNum >= nowTimeNumber) {
        const e = todayMap.get(t);
        if (e.TMP !== undefined) {
          currentTemp = Number(e.TMP);
          currentPty = e.PTY ?? currentPty;
          currentSky = e.SKY ?? currentSky;
          break;
        }
      }
    }
    // 못 찾으면 마지막 시각 값
    if (currentTemp === null && sortedTimes.length > 0) {
      const last = todayMap.get(sortedTimes[sortedTimes.length - 1]);
      if (last.TMP !== undefined) currentTemp = Number(last.TMP);
      currentPty = last.PTY ?? currentPty;
      currentSky = last.SKY ?? currentSky;
    }
  }

  // 일별 최고/최저/상태
  const days = [];
  const sortedDates = [...byDate.keys()].sort();
  for (const date of sortedDates) {
    const dateMap = byDate.get(date);
    let max = null;
    let min = null;
    // SKY/PTY 대표값 선택 (14시 또는 12시 기준)
    let repPty = null;
    let repSky = null;

    for (const [time, cats] of dateMap.entries()) {
      if (cats.TMX !== undefined) max = Number(cats.TMX);
      if (cats.TMN !== undefined) min = Number(cats.TMN);

      // 12~15시 데이터를 날씨 상태 대표값으로 사용 (기상청 관례)
      const tNum = parseInt(time, 10);
      if (tNum >= 1200 && tNum <= 1500 && cats.SKY !== undefined) {
        repSky = cats.SKY;
        repPty = cats.PTY ?? '0';
      }
    }

    // 오후 대표값이 없으면 아무 값이나 (첫 번째)
    if (repSky === null) {
      for (const cats of dateMap.values()) {
        if (cats.SKY !== undefined) {
          repSky = cats.SKY;
          repPty = cats.PTY ?? '0';
          break;
        }
      }
    }

    // TMX/TMN이 없는 날짜는 모든 TMP의 max/min 계산
    if (max === null || min === null) {
      let calcMax = -Infinity;
      let calcMin = Infinity;
      let found = false;
      for (const cats of dateMap.values()) {
        if (cats.TMP !== undefined) {
          const t = Number(cats.TMP);
          if (t > calcMax) calcMax = t;
          if (t < calcMin) calcMin = t;
          found = true;
        }
      }
      if (found) {
        if (max === null) max = calcMax;
        if (min === null) min = calcMin;
      }
    }

    const condition = mapCondition(repPty, repSky);
    days.push({
      date: `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`,
      max,
      min,
      condition,
    });
  }

  const todayDay = days.find(d => d.date === `${nowDateStr.slice(0, 4)}-${nowDateStr.slice(4, 6)}-${nowDateStr.slice(6, 8)}`) || days[0];

  return {
    baseDate,
    baseTime,
    currentTemp,
    currentCondition: mapCondition(currentPty, currentSky),
    todayMax: todayDay?.max ?? null,
    todayMin: todayDay?.min ?? null,
    days,
  };
}

// ─── Public API: 캐시 wrapper ───────────────────────
async function getShortForecast(nx, ny) {
  const cacheKey = `short:${nx}:${ny}`;
  return withCache(cacheKey, TTL_SECONDS, () => fetchShortForecast(nx, ny));
}

module.exports = {
  getShortForecast,
  // 내부 테스트용 export
  _internal: { getBaseDateTime, mapCondition, parseShortForecastItems },
};
