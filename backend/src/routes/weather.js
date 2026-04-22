/**
 * VueSign Phase W1: 날씨 API 라우트
 *
 * 인증 불필요:
 *   - 데이터 소스가 공공 API(기상청/에어코리아)
 *   - WeatherLocation 카탈로그도 관리자가 seed한 공개 데이터
 *   - 플레이어(디바이스)와 프론트엔드가 모두 호출해야 함
 *   - 글로벌 rate limiter(/api)로 남용 방지
 */
const express = require('express');
const router = express.Router();
const {
  listLocations,
  getLocation,
  getCurrent,
  getWeekly,
  getAir,
} = require('../controllers/weatherController');

// 날씨 데이터 조회 (구체 경로를 와일드카드보다 먼저 등록)
router.get('/current', getCurrent);
router.get('/weekly', getWeekly);
router.get('/air', getAir);

// 위치 목록/단건
router.get('/locations', listLocations);
router.get('/locations/:id', getLocation);

module.exports = router;
