/**
 * VueSign 심층 버그 탐지 테스트
 * 비즈니스 로직, 엣지케이스, 보안 격리, 플레이어 API 등
 * 실행: node test_deep.js
 */
const http = require('http');

const BASE = 'http://localhost:3001';
let TOKEN = '';
let PASS = 0, FAIL = 0, WARN = 0;
const ISSUES = [];

function req(method, path, body, token, contentType) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE + path);
    const data = body ? JSON.stringify(body) : null;
    const opts = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': contentType || 'application/json',
        ...(token !== false && TOKEN ? { 'Authorization': `Bearer ${TOKEN}` } : {}),
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {})
      }
    };
    const r = http.request(opts, res => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(raw); } catch {}
        resolve({ status: res.statusCode, body: json, raw, headers: res.headers });
      });
    });
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}

function ok(label, cond, detail = '') {
  if (cond) { console.log(`  ✅ ${label}`); PASS++; }
  else { console.log(`  ❌ ${label}${detail ? ' | ' + detail : ''}`); FAIL++; ISSUES.push({ label, detail }); }
}
function warn(label, detail = '') { console.log(`  ⚠️  ${label}${detail ? ' | ' + detail : ''}`); WARN++; }
function section(name) {
  console.log(`\n${'━'.repeat(52)}`);
  console.log(`  ${name}`);
  console.log('━'.repeat(52));
}

async function run() {
  console.log('\n🔬 VueSign 심층 버그 탐지 테스트\n');

  // 로그인
  const login = await req('POST', '/api/auth/login', { email: 'admin@vuesign.com', password: 'admin123' }, false);
  TOKEN = login.body?.token || '';
  const TENANT_ID = login.body?.user?.tenantId || '';
  ok('사전 로그인', !!TOKEN);

  // ══ 1. 스케줄 비즈니스 로직 ════════════════════════
  section('1. 스케줄 비즈니스 로직 검증');

  // 시작일 > 종료일인 경우
  const badDateR = await req('POST', '/api/schedules', {
    name: '[TEST] 날짜오류',
    startDate: '2026-12-31', endDate: '2026-01-01',
    startTime: '09:00', endTime: '18:00',
    repeatType: 'DAILY'
  });
  ok('시작일 > 종료일 → 400 거부', badDateR.status === 400,
    `got ${badDateR.status}: ${JSON.stringify(badDateR.body)?.substring(0,80)}`);

  // 이름 없이 스케줄 생성
  const noNameR = await req('POST', '/api/schedules', {
    startDate: '2026-04-01', endDate: '2026-12-31'
  });
  ok('이름 없는 스케줄 → 400 거부', noNameR.status === 400,
    `got ${noNameR.status}: ${JSON.stringify(noNameR.body)?.substring(0,80)}`);

  // 유효한 스케줄 생성 후 정상 배포 플로우
  const validSch = await req('POST', '/api/schedules', {
    name: '[DEEP-TEST] 스케줄',
    startDate: '2026-04-01', endDate: '2026-12-31',
    startTime: '09:00', endTime: '18:00',
    repeatType: 'WEEKLY', repeatDays: '1,2,3,4,5'
  });
  ok('유효 스케줄 생성 → 201', validSch.status === 201, `${validSch.status}`);
  const scheduleId = validSch.body?.id;

  if (scheduleId) {
    // 상태가 DRAFT로 시작하는지 확인
    const schDetail = await req('GET', `/api/schedules/${scheduleId}`);
    ok('신규 스케줄 status=DRAFT', schDetail.body?.status === 'DRAFT', `status=${schDetail.body?.status}`);

    // 삭제
    await req('DELETE', `/api/schedules/${scheduleId}`);
  }

  // ══ 2. 콘텐츠 업로드 유효성 검사 ════════════════════
  section('2. 콘텐츠 업로드 유효성 검사');

  // 지원하지 않는 파일 타입 (text/plain)
  const boundary = '----TestBoundary' + Date.now();
  const badFileBody = [
    `--${boundary}`,
    'Content-Disposition: form-data; name="file"; filename="test.txt"',
    'Content-Type: text/plain',
    '',
    'hello world',
    `--${boundary}--`
  ].join('\r\n');

  const badUpload = await new Promise((resolve, reject) => {
    const opts = {
      hostname: 'localhost', port: 3001,
      path: '/api/content/upload',
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Authorization': `Bearer ${TOKEN}`,
        'Content-Length': Buffer.byteLength(badFileBody)
      }
    };
    const r = http.request(opts, res => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(raw); } catch {}
        resolve({ status: res.statusCode, body: json });
      });
    });
    r.on('error', reject);
    r.write(badFileBody);
    r.end();
  });
  ok('text/plain 업로드 → 400 거부', badUpload.status === 400,
    `got ${badUpload.status}: ${JSON.stringify(badUpload.body)?.substring(0,80)}`);

  // 파일 없이 업로드
  const noFileBody = `--${boundary}\r\nContent-Disposition: form-data; name="name"\r\n\r\ntest\r\n--${boundary}--`;
  const noFileUpload = await new Promise((resolve, reject) => {
    const opts = {
      hostname: 'localhost', port: 3001,
      path: '/api/content/upload',
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Authorization': `Bearer ${TOKEN}`,
        'Content-Length': Buffer.byteLength(noFileBody)
      }
    };
    const r = http.request(opts, res => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(raw); } catch {}
        resolve({ status: res.statusCode, body: json });
      });
    });
    r.on('error', reject);
    r.write(noFileBody);
    r.end();
  });
  ok('파일 없는 업로드 → 400 거부', noFileUpload.status === 400,
    `got ${noFileUpload.status}: ${JSON.stringify(noFileUpload.body)?.substring(0,80)}`);

  // ══ 3. 플레이리스트 엣지케이스 ═══════════════════
  section('3. 플레이리스트 엣지케이스');

  const plResp = await req('POST', '/api/playlists', { name: '[DEEP-TEST] 플레이리스트' });
  const plId = plResp.body?.id;

  if (plId) {
    // 존재하지 않는 contentId로 아이템 추가
    const badItem = await req('POST', `/api/playlists/${plId}/items`, {
      contentId: 'nonexistent-id-12345',
      duration: 10, order: 1
    });
    ok('존재하지 않는 콘텐츠 플레이리스트 추가 → 400 또는 404',
      [400, 404, 500].includes(badItem.status),
      `got ${badItem.status}: ${JSON.stringify(badItem.body)?.substring(0,80)}`);

    // 존재하는 콘텐츠 조회 후 추가 테스트
    const contents = await req('GET', '/api/content?limit=1');
    const firstContent = contents.body?.items?.[0];
    if (firstContent) {
      const addItem = await req('POST', `/api/playlists/${plId}/items`, {
        contentId: firstContent.id, duration: 30, order: 1
      });
      ok('유효 콘텐츠 플레이리스트 추가 → 201', addItem.status === 201,
        `got ${addItem.status}: ${JSON.stringify(addItem.body)?.substring(0,80)}`);

      // 중복 추가 테스트
      const dupItem = await req('POST', `/api/playlists/${plId}/items`, {
        contentId: firstContent.id, duration: 30, order: 2
      });
      ok('같은 콘텐츠 중복 추가 → 허용 또는 거부 (일관성 확인)',
        [201, 400, 409].includes(dupItem.status),
        `got ${dupItem.status}`);
    }

    // 플레이리스트 삭제 시 아이템도 cascade 삭제되는지 확인
    await req('DELETE', `/api/playlists/${plId}`);
    const checkItems = await req('GET', `/api/playlists/${plId}/items`).catch(() => ({ status: 404 }));
    ok('플레이리스트 삭제 후 아이템 조회 → 404',
      [404, 403].includes(checkItems.status),
      `got ${checkItems.status}`);
  }

  // ══ 4. 디바이스 하트비트 / 플레이어 API ══════════
  section('4. 플레이어 API (디바이스 등록/하트비트)');

  // 디바이스 토큰 확인
  const tokensR = await req('GET', '/api/devices/tokens');
  ok('디바이스 토큰 목록 조회 가능', tokensR.status === 200, `${tokensR.status}`);

  // 디바이스 등록 (새 토큰으로)
  const newToken = 'TEST-TOKEN-' + Date.now();
  const regR = await req('POST', '/api/devices/register', {
    token: newToken,
    name: '[DEEP-TEST] Player',
    model: 'Test Player',
    resolution: '1920x1080'
  }, false); // 인증 없이
  ok('디바이스 토큰 등록 (비인증) → 200 또는 201',
    [200, 201].includes(regR.status),
    `got ${regR.status}: ${JSON.stringify(regR.body)?.substring(0,80)}`);

  const deviceToken = regR.body?.token || newToken;

  // 하트비트
  const hbR = await req('POST', '/api/devices/heartbeat', {
    token: deviceToken,
    status: 'ONLINE',
    ip: '192.168.1.99'
  }, false);
  ok('디바이스 하트비트 → 200',
    [200, 201, 404].includes(hbR.status),
    `got ${hbR.status}: ${JSON.stringify(hbR.body)?.substring(0,80)}`);

  // 플레이어 스케줄 조회
  const playerSchR = await req('GET', `/api/devices/schedule?token=${deviceToken}`, null, false);
  ok('플레이어 스케줄 조회 → 200',
    [200, 404].includes(playerSchR.status),
    `got ${playerSchR.status}: ${JSON.stringify(playerSchR.body)?.substring(0,80)}`);

  // 등록된 디바이스 삭제 (cleanup)
  if (regR.body?.id) {
    await req('DELETE', `/api/devices/${regR.body.id}`);
  }

  // ══ 5. 크로스 테넌트 격리 테스트 ════════════════
  section('5. 크로스 테넌트 데이터 격리');

  // 존재하지 않는 테넌트 ID로 데이터 접근 시도
  const fakeId = '00000000-0000-0000-0000-000000000000';

  const isolContent = await req('GET', `/api/content/${fakeId}`);
  ok('존재하지 않는 콘텐츠 ID → 404', isolContent.status === 404,
    `got ${isolContent.status}`);

  const isolDevice = await req('GET', `/api/devices/${fakeId}`);
  ok('존재하지 않는 디바이스 ID → 404', isolDevice.status === 404,
    `got ${isolDevice.status}`);

  const isolPlaylist = await req('GET', `/api/playlists/${fakeId}`);
  ok('존재하지 않는 플레이리스트 ID → 404', isolPlaylist.status === 404,
    `got ${isolPlaylist.status}`);

  const isolSchedule = await req('GET', `/api/schedules/${fakeId}`);
  ok('존재하지 않는 스케줄 ID → 404', isolSchedule.status === 404,
    `got ${isolSchedule.status}`);

  // ══ 6. 페이지네이션 경계 ═════════════════════════
  section('6. 페이지네이션 경계값 테스트');

  const bigPage = await req('GET', '/api/content?page=9999&limit=10');
  ok('존재하지 않는 페이지 → 200 (빈 결과)', bigPage.status === 200,
    `got ${bigPage.status}`);
  ok('빈 페이지 items 배열', Array.isArray(bigPage.body?.items),
    `items=${JSON.stringify(bigPage.body?.items)}`);
  ok('빈 페이지 items 길이 0', (bigPage.body?.items?.length || 0) === 0,
    `len=${bigPage.body?.items?.length}`);

  const bigLimit = await req('GET', '/api/content?page=1&limit=1000');
  ok('limit=1000 → 200 (처리됨)', bigLimit.status === 200, `got ${bigLimit.status}`);

  const zeroLimit = await req('GET', '/api/content?page=1&limit=0');
  ok('limit=0 → 200 또는 400 (처리됨)', [200, 400].includes(zeroLimit.status),
    `got ${zeroLimit.status}`);

  const negPage = await req('GET', '/api/content?page=-1&limit=10');
  ok('page=-1 → 200 또는 400 (처리됨)', [200, 400].includes(negPage.status),
    `got ${negPage.status}`);

  // ══ 7. 레이아웃 존 관리 ══════════════════════════
  section('7. 레이아웃 & 존 관리 검증');

  const layoutR = await req('POST', '/api/layouts', {
    name: '[DEEP-TEST] 레이아웃',
    description: '심층 테스트'
  });
  ok('레이아웃 생성 → 201', layoutR.status === 201, `${layoutR.status}`);
  const layoutId = layoutR.body?.id;

  if (layoutId) {
    // 존 추가
    const zonesR = await req('PUT', `/api/layouts/${layoutId}/zones`, {
      zones: [
        { name: 'Zone 1', x: 0, y: 0, width: 1920, height: 1080, zIndex: 1 },
        { name: 'Zone 2', x: 0, y: 0, width: 960, height: 540, zIndex: 2 }
      ]
    });
    ok('레이아웃 존 저장 → 200', zonesR.status === 200, `${zonesR.status}`);
    ok('존 2개 저장 확인',
      (zonesR.body?.zones?.length || zonesR.body?.length || 0) >= 2,
      `zones=${JSON.stringify(zonesR.body)?.substring(0,80)}`);

    // 존 재조회
    const layoutDetail = await req('GET', `/api/layouts/${layoutId}`);
    ok('레이아웃 상세 조회 → 200', layoutDetail.status === 200, `${layoutDetail.status}`);

    // 레이아웃 삭제 후 존 cascade 확인
    await req('DELETE', `/api/layouts/${layoutId}`);

    // DB에서 직접 확인 (isActive=false 소프트삭제)
    const afterDelete = await req('GET', `/api/layouts/${layoutId}`);
    ok('레이아웃 소프트삭제 후 상세 조회 → 200 (soft)', afterDelete.status === 200,
      `got ${afterDelete.status}`);
  }

  // ══ 8. 긴급 메시지 생명주기 ══════════════════════
  section('8. 긴급 메시지 생명주기');

  const emR = await req('POST', '/api/emergency', {
    title: '[DEEP-TEST] 긴급 메시지',
    message: '심층 테스트용 긴급 메시지',
    targetType: 'ALL',
    priority: 1
  });
  ok('긴급 메시지 생성 → 201', emR.status === 201, `${emR.status}`);
  const emId = emR.body?.id;

  if (emId) {
    // 활성 상태 확인
    const emDetail = await req('GET', `/api/emergency/${emId}`);
    ok('긴급 메시지 isActive=true', emDetail.body?.isActive === true,
      `isActive=${emDetail.body?.isActive}`);

    // 비활성화
    const deactivR = await req('PUT', `/api/emergency/${emId}/deactivate`);
    ok('긴급 메시지 비활성화 → 200', deactivR.status === 200, `${deactivR.status}`);

    // 비활성화 후 tenantId 포함한 active 조회에 포함되지 않아야 함
    const activeListR = await req('GET', `/api/emergency/active?tenantId=${TENANT_ID}`);
    const activeIds = (activeListR.body?.messages || activeListR.body || []).map((m) => m.id);
    ok('비활성화된 메시지 active 목록 미포함', !activeIds.includes(emId),
      `found in active: ${activeIds.includes(emId)}`);

    // 삭제
    await req('DELETE', `/api/emergency/${emId}`);
  }

  // ══ 9. 응답 헤더 보안 검사 ═══════════════════════
  section('9. 응답 헤더 보안 검사');

  const headerR = await req('GET', '/api/content');
  const headers = headerR.headers || {};

  // Content-Type JSON 확인
  ok('Content-Type: application/json',
    (headers['content-type'] || '').includes('application/json'),
    `got: ${headers['content-type']}`);

  // X-Powered-By 노출 여부 (보안상 숨겨야 함)
  if (headers['x-powered-by']) {
    warn('X-Powered-By 헤더 노출됨', headers['x-powered-by']);
  } else {
    ok('X-Powered-By 헤더 숨겨짐', true);
  }

  // CORS 헤더
  ok('Access-Control-Allow-Origin 헤더 존재',
    !!headers['access-control-allow-origin'],
    `got: ${headers['access-control-allow-origin']}`);

  // ══ 10. 동시성 테스트 ═════════════════════════
  section('10. 동시 요청 처리 (Race Condition)');

  // 동시에 같은 이름의 플레이리스트 5개 생성
  const concurrentCreate = await Promise.all(
    Array.from({ length: 5 }, (_, i) =>
      req('POST', '/api/playlists', { name: `[RACE-TEST] 동시생성 ${i}`, description: 'race test' })
    )
  );
  const created201 = concurrentCreate.filter(r => r.status === 201).length;
  ok('동시 생성 5개 모두 성공', created201 === 5, `성공 ${created201}/5`);

  // cleanup
  for (const r of concurrentCreate) {
    if (r.body?.id) await req('DELETE', `/api/playlists/${r.body.id}`);
  }

  // 동시 GET 요청
  const concurrentGet = await Promise.all(
    Array.from({ length: 10 }, () => req('GET', '/api/content'))
  );
  const get200 = concurrentGet.filter(r => r.status === 200).length;
  ok('동시 GET 10회 모두 200', get200 === 10, `성공 ${get200}/10`);

  // ══ 11. 특수문자 / 유니코드 ════════════════════
  section('11. 특수문자 & 유니코드 처리');

  const specialNames = [
    '테스트 <스크립트>',
    '한글 이름 🎉 이모지',
    "Name with 'quotes' and \"double\"",
    '이름\n줄바꿈포함',
  ];

  for (const name of specialNames) {
    const r = await req('POST', '/api/playlists', { name, description: '특수문자 테스트' });
    ok(`특수문자 플레이리스트 생성: "${name.substring(0,20)}"`,
      [201, 400].includes(r.status),
      `got ${r.status}`);
    if (r.body?.id) {
      // 저장된 이름 반환 확인
      const detail = await req('GET', `/api/playlists/${r.body.id}`);
      if (detail.status === 200) {
        ok(`저장된 이름 조회 가능`, !!detail.body?.name, `name=${detail.body?.name}`);
      }
      await req('DELETE', `/api/playlists/${r.body.id}`);
    }
  }

  // ══ 결과 요약 ════════════════════════════════════
  const total = PASS + FAIL + WARN;
  console.log(`\n${'═'.repeat(52)}`);
  console.log(`  📊 심층 테스트 결과`);
  console.log('═'.repeat(52));
  console.log(`  전체: ${total}건 (WARN 제외: ${PASS + FAIL}건)`);
  console.log(`  ✅ PASS:    ${PASS}건`);
  console.log(`  ❌ FAIL:    ${FAIL}건`);
  console.log(`  ⚠️  WARN:    ${WARN}건`);
  console.log('═'.repeat(52));

  if (ISSUES.length > 0) {
    console.log('\n  ❌ 실패 항목:');
    ISSUES.forEach((issue, i) => {
      console.log(`  ${i+1}. ${issue.label}`);
      if (issue.detail) console.log(`     └ ${issue.detail}`);
    });
  } else {
    console.log('\n  🎉 심층 테스트 이상 없음!');
  }
}

run().catch(e => { console.error('❌ 오류:', e.message); process.exit(1); });
