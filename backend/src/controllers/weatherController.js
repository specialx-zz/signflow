/**
 * VueSign Phase W1: 날씨 API 컨트롤러
 *
 * 엔드포인트:
 *   GET /api/weather/locations            - 위치 목록/검색
 *   GET /api/weather/locations/:id        - 위치 단건 조회
 *   GET /api/weather/current              - 현재 날씨
 *   GET /api/weather/weekly               - 주간 날씨 (오늘 포함 N일)
 *   GET /api/weather/air                  - 미세먼지(PM10, PM2.5)
 *
 * 모든 엔드포인트는 locationId를 사용한다.
 * 외부 API 호출 결과는 WeatherCache로 공유되므로 tenant 간 격리 대상 아님.
 */
const prisma = require('../utils/prisma');
const weatherService = require('../services/weather');

// ─── GET /api/weather/locations?search=서울 ───────────────
const listLocations = async (req, res) => {
  try {
    const { search } = req.query;
    const where = { isActive: true };

    if (search && typeof search === 'string' && search.trim()) {
      const term = search.trim();
      where.OR = [
        { sido:        { contains: term } },
        { sigungu:     { contains: term } },
        { searchKey:   { contains: term } },
        { displayName: { contains: term } },
      ];
    }

    const locations = await prisma.weatherLocation.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { sido: 'asc' }, { sigungu: 'asc' }],
      select: {
        id: true,
        sido: true,
        sigungu: true,
        displayName: true,
        searchKey: true,
        airStationName: true,
      },
    });

    res.json({ locations });
  } catch (err) {
    console.error('[weather] listLocations error:', err);
    res.status(500).json({ error: err.message || 'Failed to list weather locations' });
  }
};

// ─── GET /api/weather/locations/:id ───────────────────────
const getLocation = async (req, res) => {
  try {
    const { id } = req.params;
    const loc = await prisma.weatherLocation.findUnique({
      where: { id },
      select: {
        id: true,
        sido: true,
        sigungu: true,
        displayName: true,
        searchKey: true,
        airStationName: true,
      },
    });
    if (!loc) return res.status(404).json({ error: 'Location not found' });
    res.json({ location: loc });
  } catch (err) {
    console.error('[weather] getLocation error:', err);
    res.status(500).json({ error: err.message || 'Failed to get location' });
  }
};

// ─── GET /api/weather/current?locationId=... ──────────────
const getCurrent = async (req, res) => {
  try {
    const { locationId } = req.query;
    if (!locationId) return res.status(400).json({ error: 'locationId is required' });
    const data = await weatherService.getCurrent(locationId);
    res.json(data);
  } catch (err) {
    console.error('[weather] getCurrent error:', err);
    const status = /not found/i.test(err.message) ? 404 : 500;
    res.status(status).json({ error: err.message || 'Failed to fetch current weather' });
  }
};

// ─── GET /api/weather/weekly?locationId=...&days=7 ────────
const getWeekly = async (req, res) => {
  try {
    const { locationId } = req.query;
    if (!locationId) return res.status(400).json({ error: 'locationId is required' });
    const days = Math.min(Math.max(parseInt(req.query.days, 10) || 7, 1), 10);
    const data = await weatherService.getWeekly(locationId, days);
    res.json(data);
  } catch (err) {
    console.error('[weather] getWeekly error:', err);
    const status = /not found/i.test(err.message) ? 404 : 500;
    res.status(status).json({ error: err.message || 'Failed to fetch weekly weather' });
  }
};

// ─── GET /api/weather/air?locationId=... ──────────────────
const getAir = async (req, res) => {
  try {
    const { locationId } = req.query;
    if (!locationId) return res.status(400).json({ error: 'locationId is required' });
    const data = await weatherService.getAir(locationId);
    res.json(data);
  } catch (err) {
    console.error('[weather] getAir error:', err);
    const status = /not found/i.test(err.message) ? 404 : 500;
    res.status(status).json({ error: err.message || 'Failed to fetch air quality' });
  }
};

module.exports = {
  listLocations,
  getLocation,
  getCurrent,
  getWeekly,
  getAir,
};
