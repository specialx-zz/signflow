/**
 * VueSign Phase W1: 날씨/미세먼지 위치 마스터 시드
 *
 * 주요 시/도 대표 지역의 다음 정보를 한 row에 묶어서 저장한다:
 *   - 기상청 단기예보 격자 (nx, ny)
 *   - 기상청 중기예보 육상 권역 코드 (regIdLand)
 *   - 기상청 중기예보 기온 세부 코드 (regIdTa)
 *   - 에어코리아 대표 측정소명 (airStationName)
 *
 * 실제 격자 좌표는 기상청 API허브에서 배포하는 "지점_좌표(위경도_격자X_Y).xlsx" 기준.
 * regId는 공공데이터포털 "기상청_예보구역정보 조회서비스" 부록 문서 기준.
 *
 * 1차 출시용: 17개 광역 시/도의 대표 지역 + 서울 25개 자치구.
 * 필요에 따라 관리 페이지나 별도 import 스크립트로 확장 가능.
 *
 * 실행: `npm run db:seed:weather`
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const prisma = require('../src/utils/prisma');
const { v4: uuidv4 } = require('uuid');

// 17개 광역 시/도 + 서울 25개 자치구 (총 41개).
// regIdLand: 육상예보 10개 권역 (여러 시/도 공유), regIdTa: 기온예보 도시 단위.
// 실제 값은 기상청 공식 활용가이드 기준.
const LOCATIONS = [
  // ─── 서울 25개 자치구 (모두 regIdLand=11B00000, regIdTa=11B10101 공유) ───
  { sido: '서울특별시', sigungu: '종로구',   nx: 60, ny: 127, airStationName: '종로구' },
  { sido: '서울특별시', sigungu: '중구',     nx: 60, ny: 127, airStationName: '중구' },
  { sido: '서울특별시', sigungu: '용산구',   nx: 60, ny: 126, airStationName: '용산구' },
  { sido: '서울특별시', sigungu: '성동구',   nx: 61, ny: 127, airStationName: '성동구' },
  { sido: '서울특별시', sigungu: '광진구',   nx: 62, ny: 126, airStationName: '광진구' },
  { sido: '서울특별시', sigungu: '동대문구', nx: 61, ny: 127, airStationName: '동대문구' },
  { sido: '서울특별시', sigungu: '중랑구',   nx: 62, ny: 128, airStationName: '중랑구' },
  { sido: '서울특별시', sigungu: '성북구',   nx: 61, ny: 127, airStationName: '성북구' },
  { sido: '서울특별시', sigungu: '강북구',   nx: 61, ny: 128, airStationName: '강북구' },
  { sido: '서울특별시', sigungu: '도봉구',   nx: 61, ny: 129, airStationName: '도봉구' },
  { sido: '서울특별시', sigungu: '노원구',   nx: 61, ny: 129, airStationName: '노원구' },
  { sido: '서울특별시', sigungu: '은평구',   nx: 59, ny: 127, airStationName: '은평구' },
  { sido: '서울특별시', sigungu: '서대문구', nx: 59, ny: 127, airStationName: '서대문구' },
  { sido: '서울특별시', sigungu: '마포구',   nx: 59, ny: 127, airStationName: '마포구' },
  { sido: '서울특별시', sigungu: '양천구',   nx: 58, ny: 126, airStationName: '양천구' },
  { sido: '서울특별시', sigungu: '강서구',   nx: 58, ny: 126, airStationName: '강서구' },
  { sido: '서울특별시', sigungu: '구로구',   nx: 58, ny: 125, airStationName: '구로구' },
  { sido: '서울특별시', sigungu: '금천구',   nx: 59, ny: 124, airStationName: '금천구' },
  { sido: '서울특별시', sigungu: '영등포구', nx: 58, ny: 126, airStationName: '영등포구' },
  { sido: '서울특별시', sigungu: '동작구',   nx: 59, ny: 125, airStationName: '동작구' },
  { sido: '서울특별시', sigungu: '관악구',   nx: 59, ny: 125, airStationName: '관악구' },
  { sido: '서울특별시', sigungu: '서초구',   nx: 61, ny: 125, airStationName: '서초구' },
  { sido: '서울특별시', sigungu: '강남구',   nx: 61, ny: 126, airStationName: '강남구' },
  { sido: '서울특별시', sigungu: '송파구',   nx: 62, ny: 126, airStationName: '송파구' },
  { sido: '서울특별시', sigungu: '강동구',   nx: 62, ny: 126, airStationName: '강동구' },

  // ─── 부산 (regIdLand=11H20000, regIdTa=11H20201) ───
  { sido: '부산광역시', sigungu: '중구',     nx: 97, ny: 74, airStationName: '중구', _regIdLand: '11H20000', _regIdTa: '11H20201' },
  { sido: '부산광역시', sigungu: '해운대구', nx: 99, ny: 75, airStationName: '해운대구', _regIdLand: '11H20000', _regIdTa: '11H20201' },
  { sido: '부산광역시', sigungu: '수영구',   nx: 98, ny: 74, airStationName: '수영구',  _regIdLand: '11H20000', _regIdTa: '11H20201' },

  // ─── 대구 (regIdLand=11H10000, regIdTa=11H10701) ───
  { sido: '대구광역시', sigungu: '중구',     nx: 89, ny: 90, airStationName: '중구',   _regIdLand: '11H10000', _regIdTa: '11H10701' },
  { sido: '대구광역시', sigungu: '동구',     nx: 89, ny: 91, airStationName: '동구',   _regIdLand: '11H10000', _regIdTa: '11H10701' },

  // ─── 인천 (regIdLand=11B00000, regIdTa=11B20201) ───
  { sido: '인천광역시', sigungu: '중구',     nx: 54, ny: 124, airStationName: '중구',  _regIdLand: '11B00000', _regIdTa: '11B20201' },
  { sido: '인천광역시', sigungu: '남동구',   nx: 57, ny: 124, airStationName: '남동구', _regIdLand: '11B00000', _regIdTa: '11B20201' },

  // ─── 광주 (regIdLand=11F20000, regIdTa=11F20501) ───
  { sido: '광주광역시', sigungu: '동구',     nx: 60, ny: 74, airStationName: '동구',   _regIdLand: '11F20000', _regIdTa: '11F20501' },
  { sido: '광주광역시', sigungu: '서구',     nx: 59, ny: 74, airStationName: '서구',   _regIdLand: '11F20000', _regIdTa: '11F20501' },

  // ─── 대전 (regIdLand=11C20000, regIdTa=11C20401) ───
  { sido: '대전광역시', sigungu: '중구',     nx: 68, ny: 100, airStationName: '중구',  _regIdLand: '11C20000', _regIdTa: '11C20401' },
  { sido: '대전광역시', sigungu: '유성구',   nx: 67, ny: 100, airStationName: '유성구', _regIdLand: '11C20000', _regIdTa: '11C20401' },

  // ─── 울산 (regIdLand=11H20000, regIdTa=11H20101) ───
  { sido: '울산광역시', sigungu: '남구',     nx: 102, ny: 84, airStationName: '남구',  _regIdLand: '11H20000', _regIdTa: '11H20101' },

  // ─── 세종 (regIdLand=11C20000, regIdTa=11C20404) ───
  { sido: '세종특별자치시', sigungu: '',    nx: 66, ny: 103, airStationName: '세종시', _regIdLand: '11C20000', _regIdTa: '11C20404' },

  // ─── 경기 (regIdLand=11B00000, regIdTa=11B20601 수원 기준) ───
  { sido: '경기도', sigungu: '수원시',       nx: 60, ny: 121, airStationName: '수원',   _regIdLand: '11B00000', _regIdTa: '11B20601' },
  { sido: '경기도', sigungu: '성남시',       nx: 63, ny: 124, airStationName: '성남',   _regIdLand: '11B00000', _regIdTa: '11B20601' },
  { sido: '경기도', sigungu: '고양시',       nx: 57, ny: 128, airStationName: '고양',   _regIdLand: '11B00000', _regIdTa: '11B20302' },
  { sido: '경기도', sigungu: '용인시',       nx: 64, ny: 119, airStationName: '용인',   _regIdLand: '11B00000', _regIdTa: '11B20601' },

  // ─── 강원 (regIdLand=11D10000 영서 / 11D20000 영동, regIdTa=11D10301 춘천) ───
  { sido: '강원특별자치도', sigungu: '춘천시', nx: 73, ny: 134, airStationName: '춘천',  _regIdLand: '11D10000', _regIdTa: '11D10301' },
  { sido: '강원특별자치도', sigungu: '강릉시', nx: 92, ny: 131, airStationName: '강릉',  _regIdLand: '11D20000', _regIdTa: '11D20501' },

  // ─── 충북 (regIdLand=11C10000, regIdTa=11C10301) ───
  { sido: '충청북도', sigungu: '청주시',    nx: 69, ny: 106, airStationName: '청주',   _regIdLand: '11C10000', _regIdTa: '11C10301' },

  // ─── 충남 (regIdLand=11C20000, regIdTa=11C20101) ───
  { sido: '충청남도', sigungu: '천안시',    nx: 63, ny: 110, airStationName: '천안',   _regIdLand: '11C20000', _regIdTa: '11C20101' },

  // ─── 전북 (regIdLand=11F10000, regIdTa=11F10201) ───
  { sido: '전북특별자치도', sigungu: '전주시', nx: 63, ny: 89, airStationName: '전주',  _regIdLand: '11F10000', _regIdTa: '11F10201' },

  // ─── 전남 (regIdLand=11F20000, regIdTa=11F20401 목포) ───
  { sido: '전라남도', sigungu: '목포시',    nx: 50, ny: 67, airStationName: '목포',   _regIdLand: '11F20000', _regIdTa: '11F20401' },
  { sido: '전라남도', sigungu: '여수시',    nx: 73, ny: 66, airStationName: '여수',   _regIdLand: '11F20000', _regIdTa: '11F20601' },

  // ─── 경북 (regIdLand=11H10000, regIdTa=11H10201 포항) ───
  { sido: '경상북도', sigungu: '포항시',    nx: 102, ny: 94, airStationName: '포항',  _regIdLand: '11H10000', _regIdTa: '11H10201' },

  // ─── 경남 (regIdLand=11H20000, regIdTa=11H20301 창원) ───
  { sido: '경상남도', sigungu: '창원시',    nx: 91, ny: 77, airStationName: '창원',   _regIdLand: '11H20000', _regIdTa: '11H20301' },

  // ─── 제주 (regIdLand=11G00000, regIdTa=11G00201) ───
  { sido: '제주특별자치도', sigungu: '제주시', nx: 53, ny: 38, airStationName: '제주',  _regIdLand: '11G00000', _regIdTa: '11G00201' },
  { sido: '제주특별자치도', sigungu: '서귀포시', nx: 52, ny: 33, airStationName: '서귀포', _regIdLand: '11G00000', _regIdTa: '11G00401' },
];

// 서울 25개 자치구는 동일 regId 공유
const SEOUL_REG_LAND = '11B00000';
const SEOUL_REG_TA = '11B10101';

async function main() {
  console.log('[weather-seed] 기존 위치 데이터 삭제...');
  await prisma.weatherLocation.deleteMany({});

  console.log(`[weather-seed] ${LOCATIONS.length}개 위치 시드 중...`);
  let sortOrder = 0;

  for (const loc of LOCATIONS) {
    const regIdLand = loc._regIdLand || SEOUL_REG_LAND;
    const regIdTa = loc._regIdTa || SEOUL_REG_TA;
    const displayName = loc.sigungu ? `${loc.sido} ${loc.sigungu}` : loc.sido;
    const searchKey = displayName.toLowerCase();

    await prisma.weatherLocation.create({
      data: {
        id: uuidv4(),
        sido: loc.sido,
        sigungu: loc.sigungu || '',
        nx: loc.nx,
        ny: loc.ny,
        regIdLand,
        regIdTa,
        airStationName: loc.airStationName || null,
        searchKey,
        displayName,
        isActive: true,
        sortOrder: sortOrder++,
      }
    });
  }

  const count = await prisma.weatherLocation.count();
  console.log(`[weather-seed] 완료. 총 ${count}개 위치 저장됨.`);
}

main()
  .catch(e => {
    console.error('[weather-seed] 실패:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
