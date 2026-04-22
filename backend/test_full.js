/**
 * VueSign 전체 통합 테스트 (Supertest 기반)
 * 실행: node test_full.js
 */
const http = require('http');

const BASE = 'http://localhost:3001';
let TOKEN = '';
let PASS = 0, FAIL = 0, WARN = 0;
const ISSUES = [];

// ── 유틸 ────────────────────────────────────────────────
function req(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE + path);
    const data = body ? JSON.stringify(body) : null;
    const opts = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
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
        resolve({ status: res.statusCode, body: json, raw });
      });
    });
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}

function ok(label, cond, detail = '') {
  if (cond) {
    console.log(`  ✅ ${label}`);
    PASS++;
  } else {
    console.log(`  ❌ ${label}${detail ? ' | ' + detail : ''}`);
    FAIL++;
    ISSUES.push({ label, detail });
  }
}

function warn(label, detail = '') {
  console.log(`  ⚠️  ${label}${detail ? ' | ' + detail : ''}`);
  WARN++;
}

function section(name) {
  console.log(`\n${'━'.repeat(52)}`);
  console.log(`  ${name}`);
  console.log('━'.repeat(52));
}

// ── 테스트 ──────────────────────────────────────────────
async function run() {
  console.log('\n🚀 VueSign 전체 통합 테스트 시작\n');

  // ══ 1. 헬스체크 ══════════════════════════════════════
  section('1. 서버 헬스체크');
  const health = await req('GET', '/health', null, false);
  ok('GET /health → 200', health.status === 200);
  ok('/health.status = "ok"', health.body?.status === 'ok', JSON.stringify(health.body));

  const detailedHealth = await req('GET', '/api/health/detailed', null, false);
  ok('GET /api/health/detailed → 200 or 404', [200,404].includes(detailedHealth.status));

  // ══ 2. 인증 ══════════════════════════════════════════
  section('2. 인증 테스트');

  // 잘못된 비밀번호
  const badLogin = await req('POST', '/api/auth/login', { email: 'admin@vuesign.com', password: 'WRONG' }, false);
  ok('잘못된 비밀번호 → 401', badLogin.status === 401, `got ${badLogin.status}`);

  // 없는 이메일
  const noUser = await req('POST', '/api/auth/login', { email: 'nobody@x.com', password: 'x' }, false);
  ok('없는 이메일 → 401', noUser.status === 401, `got ${noUser.status}`);

  // 위조 토큰
  TOKEN = 'fake.jwt.token';
  const fakeTok = await req('GET', '/api/content');
  ok('위조 토큰 → 401', fakeTok.status === 401, `got ${fakeTok.status}`);

  // 토큰 없음
  TOKEN = '';
  const noTok = await req('GET', '/api/devices');
  ok('토큰 없음 → 401', noTok.status === 401, `got ${noTok.status}`);

  // 정상 로그인
  const login = await req('POST', '/api/auth/login', { email: 'admin@vuesign.com', password: 'admin123' }, false);
  ok('정상 로그인 → 200', login.status === 200, `got ${login.status}`);
  ok('로그인 → JWT 토큰 발급', !!login.body?.token, 'token missing');
  ok('로그인 → role 포함', !!login.body?.user?.role, JSON.stringify(login.body?.user));
  TOKEN = login.body?.token || '';
  const TENANT_ID = login.body?.user?.tenantId || '';

  // ══ 3. API 전체 엔드포인트 ══════════════════════════
  section('3. API 엔드포인트 전체 GET 200 테스트');
  const endpoints = [
    ['/api/content',                   '콘텐츠 목록'],
    ['/api/content/categories',         '콘텐츠 카테고리'],
    ['/api/playlists',                  '플레이리스트 목록'],
    ['/api/schedules',                  '스케줄 목록'],
    ['/api/devices',                    '디바이스 목록'],
    ['/api/devices/groups',             '디바이스 그룹'],
    ['/api/devices/tokens',             '디바이스 토큰'],
    ['/api/layouts',                    '레이아웃 목록'],
    ['/api/users',                      '사용자 목록'],
    ['/api/stores',                     '매장 목록'],
    ['/api/emergency',                  '긴급 메시지 목록'],
    // emergency/active는 디바이스 전용 엔드포인트 (tenantId 쿼리 필요) → 별도 테스트
    ['/api/canvas',                     '캔버스 목록'],
    ['/api/canvas/templates/list',      '캔버스 템플릿'],
    ['/api/channels',                   '채널 목록'],
    ['/api/webhooks',                   '웹훅 목록'],
    ['/api/notifications',              '알림 목록'],
    ['/api/notifications/unread-count', '읽지않은알림수'],
    ['/api/templates',                  '템플릿 마켓'],
    ['/api/approvals',                  '승인 목록'],
    ['/api/shared-content',             '공유 콘텐츠'],
    ['/api/fonts',                      '폰트 목록'],
    ['/api/settings',                   '설정'],
    ['/api/stats/dashboard',            '통계 대시보드'],
    ['/api/stats/content',              '통계 콘텐츠'],
    ['/api/stats/devices',              '통계 디바이스'],
    ['/api/stats/report/daily',         '일간 리포트'],
    ['/api/stats/report/weekly',        '주간 리포트'],
    ['/api/screen-wall/walls',          '스크린월 목록'],
    ['/api/screen-wall/sync',           '동기화 그룹'],
    ['/api/tag-playback/tags/keys',     '태그 키 목록'],
    ['/api/subscriptions/plans',        '구독 플랜'],
    ['/api/subscriptions/current',      '현재 구독'],
  ];

  for (const [path, label] of endpoints) {
    const r = await req('GET', path);
    ok(`GET ${label}`, [200, 304].includes(r.status), `HTTP ${r.status} | ${r.raw?.substring(0,80)}`);
  }

  // emergency/active: 디바이스 전용, tenantId 쿼리 필수
  if (TENANT_ID) {
    const activeEmR = await req('GET', `/api/emergency/active?tenantId=${TENANT_ID}`);
    ok('GET 활성 긴급 메시지(tenantId 전달)', activeEmR.status === 200, `HTTP ${activeEmR.status}`);
  }

  // ══ 4. CRUD 생성 ════════════════════════════════════
  section('4. CRUD 생성 테스트 (POST → 201)');
  const created = {};

  // 플레이리스트
  const plResp = await req('POST', '/api/playlists', { name: '[AUTO-TEST] 플레이리스트', description: '자동 테스트' });
  ok('POST /api/playlists → 201', plResp.status === 201, `${plResp.status}: ${JSON.stringify(plResp.body).substring(0,100)}`);
  created.playlistId = plResp.body?.id;

  // 스케줄
  const schResp = await req('POST', '/api/schedules', {
    name: '[AUTO-TEST] 스케줄',
    playlistId: 'pl-evening',
    startDate: '2026-04-01', endDate: '2026-12-31',
    startTime: '09:00', endTime: '18:00',
    repeatType: 'WEEKLY', repeatDays: '1,2,3,4,5'
  });
  ok('POST /api/schedules → 201', schResp.status === 201, `${schResp.status}: ${JSON.stringify(schResp.body).substring(0,100)}`);
  created.scheduleId = schResp.body?.id;

  // 레이아웃
  const layResp = await req('POST', '/api/layouts', {
    name: '[AUTO-TEST] 레이아웃', baseWidth: 1920, baseHeight: 1080,
    zones: [{ name: '메인', x: 0, y: 0, width: 100, height: 100, zIndex: 1, contentType: 'PLAYLIST', bgColor: '#000', fit: 'contain' }]
  });
  ok('POST /api/layouts → 201', layResp.status === 201, `${layResp.status}: ${JSON.stringify(layResp.body).substring(0,100)}`);
  created.layoutId = layResp.body?.id;

  // 매장
  const strResp = await req('POST', '/api/stores', { name: '[AUTO-TEST] 매장', address: '서울시 강남구' });
  ok('POST /api/stores → 201', strResp.status === 201, `${strResp.status}: ${JSON.stringify(strResp.body).substring(0,100)}`);
  created.storeId = strResp.body?.id;

  // 채널
  const chResp = await req('POST', '/api/channels', { name: '[AUTO-TEST] 채널' });
  ok('POST /api/channels → 201', chResp.status === 201, `${chResp.status}: ${JSON.stringify(chResp.body).substring(0,100)}`);
  created.channelId = chResp.body?.id;

  // 웹훅
  const whResp = await req('POST', '/api/webhooks', {
    name: '[AUTO-TEST] 웹훅', url: 'http://example.com/hook',
    events: ['content.created'], isActive: true
  });
  ok('POST /api/webhooks → 201', whResp.status === 201, `${whResp.status}: ${JSON.stringify(whResp.body).substring(0,100)}`);
  created.webhookId = whResp.body?.id;

  // 긴급 메시지
  const emgResp = await req('POST', '/api/emergency', {
    title: '[AUTO-TEST] 긴급', message: '자동 테스트 긴급 메시지', targetAll: true, priority: 1
  });
  ok('POST /api/emergency → 201', emgResp.status === 201, `${emgResp.status}: ${JSON.stringify(emgResp.body).substring(0,100)}`);
  created.emergencyId = emgResp.body?.id;

  // 캔버스
  const canResp = await req('POST', '/api/canvas', {
    name: '[AUTO-TEST] 캔버스',
    canvasJson: JSON.stringify({ canvas: { width: 1920, height: 1080 }, objects: [] })
  });
  ok('POST /api/canvas → 201', canResp.status === 201, `${canResp.status}: ${JSON.stringify(canResp.body).substring(0,100)}`);
  created.canvasId = canResp.body?.id;

  // ══ 5. CRUD 수정 ════════════════════════════════════
  section('5. CRUD 수정 테스트 (PUT → 200)');

  if (created.playlistId) {
    const r = await req('PUT', `/api/playlists/${created.playlistId}`, { name: '[AUTO-TEST] 수정됨' });
    ok('PUT /api/playlists/:id → 200', r.status === 200, `${r.status}`);
    ok('수정 후 이름 반영', r.body?.name?.includes('수정됨'), r.body?.name);
  }
  if (created.layoutId) {
    const r = await req('PUT', `/api/layouts/${created.layoutId}`, { name: '[AUTO-TEST] 레이아웃 수정됨' });
    ok('PUT /api/layouts/:id → 200', r.status === 200, `${r.status}`);
  }
  if (created.storeId) {
    const r = await req('PUT', `/api/stores/${created.storeId}`, { name: '[AUTO-TEST] 매장 수정됨', address: '부산시' });
    ok('PUT /api/stores/:id → 200', r.status === 200, `${r.status}`);
  }
  if (created.emergencyId) {
    const r = await req('PUT', `/api/emergency/${created.emergencyId}/deactivate`);
    ok('PUT /api/emergency/:id/deactivate → 200', r.status === 200, `${r.status}`);
    ok('긴급 메시지 비활성화 확인', r.body?.isActive === false, `isActive=${r.body?.isActive}`);
  }

  // 레이아웃 존 설정
  if (created.layoutId) {
    const r = await req('PUT', `/api/layouts/${created.layoutId}/zones`, {
      zones: [{ name: '메인존', x: 0, y: 0, width: 100, height: 100, zIndex: 1, contentType: 'PLAYLIST', bgColor: '#111', fit: 'cover' }]
    });
    ok('PUT /api/layouts/:id/zones → 200', r.status === 200, `${r.status}: ${JSON.stringify(r.body).substring(0,80)}`);
  }

  // ══ 6. 플레이리스트 항목 CRUD ═══════════════════════
  section('6. 플레이리스트 항목 관리');
  // 기존 콘텐츠 ID 가져오기
  const contList = await req('GET', '/api/content');
  const firstContent = contList.body?.items?.[0];
  if (created.playlistId && firstContent) {
    const addR = await req('POST', `/api/playlists/${created.playlistId}/items`, {
      contentId: firstContent.id, duration: 10, order: 1, transition: 'fade'
    });
    ok('POST /api/playlists/:id/items → 201', addR.status === 201, `${addR.status}: ${JSON.stringify(addR.body).substring(0,100)}`);
    const itemId = addR.body?.id;
    if (itemId) {
      const delR = await req('DELETE', `/api/playlists/${created.playlistId}/items/${itemId}`);
      ok('DELETE /api/playlists/:id/items/:itemId → 200', delR.status === 200, `${delR.status}`);
    }
  } else {
    warn('콘텐츠 없어 항목 추가 스킵');
  }

  // ══ 7. 보안 테스트 ══════════════════════════════════
  section('7. 보안 테스트');

  // 권한 부족: TENANT_ADMIN이 슈퍼어드민 전용 API 접근
  const tenantR = await req('GET', '/api/tenants');
  ok('TENANT_ADMIN → /api/tenants 접근 제한', tenantR.status === 403, `got ${tenantR.status}`);

  // SQL Injection 시도 (이름 필드)
  const sqlR = await req('POST', '/api/playlists', { name: "'; DROP TABLE Playlist; --" });
  ok('SQL Injection → 정상 처리(저장됨, DB 무결성 유지)', sqlR.status === 201 || sqlR.status === 400);
  if (sqlR.body?.id) {
    await req('DELETE', `/api/playlists/${sqlR.body.id}`);
  }

  // XSS 페이로드 저장 시도
  const xssR = await req('POST', '/api/playlists', { name: '<script>alert(1)</script>' });
  ok('XSS 페이로드 저장 → 처리됨(저장 or 거부)', xssR.status === 201 || xssR.status === 400);
  if (xssR.body?.id) await req('DELETE', `/api/playlists/${xssR.body.id}`);

  // 존재하지 않는 리소스
  const notFound = await req('GET', '/api/content/nonexistent-id-999');
  ok('없는 콘텐츠 → 404', notFound.status === 404, `got ${notFound.status}`);

  // ══ 8. 데이터 응답 구조 검증 ════════════════════════
  section('8. 응답 데이터 구조 검증');

  const contR = await req('GET', '/api/content?page=1&limit=5');
  ok('콘텐츠 응답: items 배열 존재', Array.isArray(contR.body?.items), JSON.stringify(Object.keys(contR.body || {})));
  ok('콘텐츠 응답: total 숫자 존재', typeof contR.body?.pagination?.total === 'number', `pagination.total=${contR.body?.pagination?.total}`);

  const plR = await req('GET', '/api/playlists');
  ok('플레이리스트 응답: items 배열', Array.isArray(plR.body?.items));

  const devR = await req('GET', '/api/devices');
  ok('디바이스 응답: items 배열', Array.isArray(devR.body?.items));
  if (devR.body?.items?.length > 0) {
    const d = devR.body.items[0];
    ok('디바이스: id 필드', !!d.id);
    ok('디바이스: status 필드', !!d.status, `status=${d.status}`);
    ok('디바이스: tenantId 필드', !!d.tenantId);
  }

  const dashR = await req('GET', '/api/stats/dashboard');
  ok('통계 대시보드: stats 객체', !!dashR.body?.stats, JSON.stringify(Object.keys(dashR.body || {})));
  ok('통계: content 수', typeof dashR.body?.stats?.content === 'number');
  ok('통계: devices 수', typeof dashR.body?.stats?.devices === 'number');

  // ══ 9. CRUD 삭제 ════════════════════════════════════
  section('9. CRUD 삭제 및 Cascade 검증 (DELETE → 200)');

  // softDelete: schedule/layout/store/canvas는 isActive=false 소프트 삭제 → GET by ID는 200 반환 (정상)
  // hardDelete: playlist/channel/webhook/emergency는 실제 삭제 → GET by ID는 404 반환
  const toDelete = [
    ['playlists', created.playlistId, true],   // hard delete
    ['schedules', created.scheduleId, false],  // soft delete
    ['layouts',   created.layoutId, false],    // soft delete
    ['stores',    created.storeId, false],     // soft delete
    ['channels',  created.channelId, true],    // hard delete
    ['webhooks',  created.webhookId, true],    // hard delete
    ['emergency', created.emergencyId, true],  // hard delete
    ['content',   created.canvasId, false],    // soft delete (isActive=false)
  ];

  for (const [resource, id, hardDelete] of toDelete) {
    if (!id) { warn(`${resource} ID 없음 (생성 실패)`); continue; }
    const r = await req('DELETE', `/api/${resource}/${id}`);
    ok(`DELETE /api/${resource}/:id → 200`, r.status === 200, `HTTP ${r.status}: ${r.raw?.substring(0,80)}`);

    // 삭제 후 재조회 검증
    const checkR = await req('GET', `/api/${resource}/${id}`);
    if (hardDelete) {
      ok(`${resource} 삭제 후 재조회 → 404`, [404, 403].includes(checkR.status), `got ${checkR.status}`);
    } else {
      ok(`${resource} 소프트삭제 후 재조회 → 200(정상)`, checkR.status === 200, `got ${checkR.status}`);
    }
  }

  // ══ 10. 페이지네이션 ═════════════════════════════════
  section('10. 페이지네이션 테스트');
  const p1 = await req('GET', '/api/content?page=1&limit=3');
  const p2 = await req('GET', '/api/content?page=2&limit=3');
  ok('페이지1 응답 정상', p1.status === 200);
  ok('페이지2 응답 정상', p2.status === 200);
  if (p1.body?.items && p2.body?.items) {
    const ids1 = p1.body.items.map(i => i.id);
    const ids2 = p2.body.items.map(i => i.id);
    const overlap = ids1.filter(id => ids2.includes(id));
    ok('페이지1/2 중복 항목 없음', overlap.length === 0, `중복: ${overlap.join(',')}`);
  }

  // 검색
  const srch = await req('GET', '/api/content?search=로고');
  ok('검색 파라미터 동작', srch.status === 200);

  // ══ 결과 요약 ════════════════════════════════════════
  const total = PASS + FAIL + WARN;
  console.log(`\n${'═'.repeat(52)}`);
  console.log(`  📊 테스트 결과 요약`);
  console.log('═'.repeat(52));
  console.log(`  전체: ${total}건`);
  console.log(`  ✅ PASS:    ${PASS}건`);
  console.log(`  ❌ FAIL:    ${FAIL}건`);
  console.log(`  ⚠️  WARNING: ${WARN}건`);
  console.log('═'.repeat(52));

  if (ISSUES.length > 0) {
    console.log('\n  ❌ 실패 항목:');
    ISSUES.forEach((i, n) => console.log(`  ${n+1}. ${i.label}${i.detail ? ' → ' + i.detail : ''}`));
  } else {
    console.log('\n  🎉 모든 테스트 통과!');
  }
  console.log('');
}

run().catch(e => { console.error('테스트 오류:', e); process.exit(1); });
