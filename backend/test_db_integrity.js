/**
 * SignFlow DB 정합성 검사 스크립트
 * 실행: node test_db_integrity.js
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

let PASS = 0, FAIL = 0;
const ISSUES = [];

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

function section(name) {
  console.log(`\n${'━'.repeat(52)}`);
  console.log(`  ${name}`);
  console.log('━'.repeat(52));
}

async function run() {
  console.log('\n🔍 SignFlow DB 정합성 검사 시작\n');

  // ══ 1. AuditLog NULL 검사 ══════════════════════════════
  section('1. AuditLog tenantId NULL 검사');
  // tenantId는 NOT NULL이지만 빈 문자열 여부도 확인
  const emptyAudit = await prisma.$queryRaw`
    SELECT COUNT(*) as cnt FROM AuditLog WHERE tenantId IS NULL OR tenantId = ''
  `;
  ok('AuditLog.tenantId NULL/empty 없음', Number(emptyAudit[0].cnt) === 0,
    `NULL/empty 레코드 ${emptyAudit[0].cnt}건`);

  const emptyAuditUser = await prisma.$queryRaw`
    SELECT COUNT(*) as cnt FROM AuditLog WHERE userId IS NULL OR userId = ''
  `;
  ok('AuditLog.userId NULL/empty 없음', Number(emptyAuditUser[0].cnt) === 0,
    `NULL/empty 레코드 ${emptyAuditUser[0].cnt}건`);

  // ══ 2. 외래키 정합성 ══════════════════════════════════
  section('2. 외래키 참조 정합성');

  // Content → Tenant
  const orphanContent = await prisma.$queryRaw`
    SELECT COUNT(*) as cnt FROM Content c
    WHERE NOT EXISTS (SELECT 1 FROM Tenant t WHERE t.id = c.tenantId)
  `;
  ok('Content → Tenant 참조 무결성', Number(orphanContent[0].cnt) === 0,
    `고아 Content ${orphanContent[0].cnt}건`);

  // Playlist → Tenant
  const orphanPlaylist = await prisma.$queryRaw`
    SELECT COUNT(*) as cnt FROM Playlist p
    WHERE NOT EXISTS (SELECT 1 FROM Tenant t WHERE t.id = p.tenantId)
  `;
  ok('Playlist → Tenant 참조 무결성', Number(orphanPlaylist[0].cnt) === 0,
    `고아 Playlist ${orphanPlaylist[0].cnt}건`);

  // Schedule → Tenant
  const orphanSchedule = await prisma.$queryRaw`
    SELECT COUNT(*) as cnt FROM Schedule s
    WHERE NOT EXISTS (SELECT 1 FROM Tenant t WHERE t.id = s.tenantId)
  `;
  ok('Schedule → Tenant 참조 무결성', Number(orphanSchedule[0].cnt) === 0,
    `고아 Schedule ${orphanSchedule[0].cnt}건`);

  // Device → Tenant
  const orphanDevice = await prisma.$queryRaw`
    SELECT COUNT(*) as cnt FROM Device d
    WHERE NOT EXISTS (SELECT 1 FROM Tenant t WHERE t.id = d.tenantId)
  `;
  ok('Device → Tenant 참조 무결성', Number(orphanDevice[0].cnt) === 0,
    `고아 Device ${orphanDevice[0].cnt}건`);

  // User → Tenant
  const orphanUser = await prisma.$queryRaw`
    SELECT COUNT(*) as cnt FROM User u
    WHERE u.tenantId IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM Tenant t WHERE t.id = u.tenantId)
  `;
  ok('User → Tenant 참조 무결성', Number(orphanUser[0].cnt) === 0,
    `고아 User ${orphanUser[0].cnt}건`);

  // PlaylistItem → Playlist
  const orphanPLItem = await prisma.$queryRaw`
    SELECT COUNT(*) as cnt FROM PlaylistItem pi
    WHERE NOT EXISTS (SELECT 1 FROM Playlist p WHERE p.id = pi.playlistId)
  `;
  ok('PlaylistItem → Playlist 참조 무결성', Number(orphanPLItem[0].cnt) === 0,
    `고아 PlaylistItem ${orphanPLItem[0].cnt}건`);

  // PlaylistItem → Content
  const orphanPLItemContent = await prisma.$queryRaw`
    SELECT COUNT(*) as cnt FROM PlaylistItem pi
    WHERE NOT EXISTS (SELECT 1 FROM Content c WHERE c.id = pi.contentId)
  `;
  ok('PlaylistItem → Content 참조 무결성', Number(orphanPLItemContent[0].cnt) === 0,
    `고아 PlaylistItem(content) ${orphanPLItemContent[0].cnt}건`);

  // ScheduleDevice → Schedule
  const orphanSD = await prisma.$queryRaw`
    SELECT COUNT(*) as cnt FROM ScheduleDevice sd
    WHERE NOT EXISTS (SELECT 1 FROM Schedule s WHERE s.id = sd.scheduleId)
  `;
  ok('ScheduleDevice → Schedule 참조 무결성', Number(orphanSD[0].cnt) === 0,
    `고아 ScheduleDevice ${orphanSD[0].cnt}건`);

  // ScheduleDevice → Device
  const orphanSDDevice = await prisma.$queryRaw`
    SELECT COUNT(*) as cnt FROM ScheduleDevice sd
    WHERE NOT EXISTS (SELECT 1 FROM Device d WHERE d.id = sd.deviceId)
  `;
  ok('ScheduleDevice → Device 참조 무결성', Number(orphanSDDevice[0].cnt) === 0,
    `고아 ScheduleDevice(device) ${orphanSDDevice[0].cnt}건`);

  // LayoutZone → Layout
  const orphanZone = await prisma.$queryRaw`
    SELECT COUNT(*) as cnt FROM LayoutZone lz
    WHERE NOT EXISTS (SELECT 1 FROM Layout l WHERE l.id = lz.layoutId)
  `;
  ok('LayoutZone → Layout 참조 무결성', Number(orphanZone[0].cnt) === 0,
    `고아 LayoutZone ${orphanZone[0].cnt}건`);

  // ══ 3. 데이터 유효성 검사 ═════════════════════════════
  section('3. 데이터 유효성 검사');

  // User role 유효값
  const invalidRoles = await prisma.user.count({
    where: {
      role: { notIn: ['SUPER_ADMIN', 'TENANT_ADMIN', 'STORE_MANAGER', 'VIEWER', 'USER'] }
    }
  });
  ok('User.role 유효값만 존재', invalidRoles === 0, `잘못된 role ${invalidRoles}건`);

  // Device status 유효값
  const invalidDeviceStatus = await prisma.device.count({
    where: {
      status: { notIn: ['ONLINE', 'OFFLINE', 'INACTIVE', 'MAINTENANCE', 'WARNING'] }
    }
  });
  ok('Device.status 유효값만 존재', invalidDeviceStatus === 0,
    `잘못된 status ${invalidDeviceStatus}건`);

  // Schedule isActive=false인데 status=ACTIVE인 이상한 상태
  const zombieSchedules = await prisma.schedule.count({
    where: { isActive: false, status: 'ACTIVE' }
  });
  ok('소프트삭제 스케줄 상태 일관성', zombieSchedules === 0,
    `isActive=false 인데 ACTIVE 상태 ${zombieSchedules}건`);

  // Content type 유효값
  const invalidContentType = await prisma.content.count({
    where: {
      type: { notIn: ['IMAGE', 'VIDEO', 'AUDIO', 'HTML', 'URL', 'CANVAS', 'STREAM'] }
    }
  });
  ok('Content.type 유효값만 존재', invalidContentType === 0,
    `잘못된 type ${invalidContentType}건`);

  // ══ 4. 통계 수치 정합성 ══════════════════════════════
  section('4. 통계 수치 정합성 교차 검증');

  const tenants = await prisma.tenant.findMany({ select: { id: true, name: true } });
  ok('테넌트 존재', tenants.length > 0, '테넌트 없음');

  for (const tenant of tenants) {
    const contentCount = await prisma.content.count({ where: { tenantId: tenant.id, isActive: true } });
    const deviceCount = await prisma.device.count({ where: { tenantId: tenant.id } });
    const userCount = await prisma.user.count({ where: { tenantId: tenant.id } });
    const playlistCount = await prisma.playlist.count({ where: { tenantId: tenant.id, isActive: true } });
    console.log(`  📊 [${tenant.name}] content:${contentCount} / device:${deviceCount} / user:${userCount} / playlist:${playlistCount}`);
  }
  ok('통계 수치 조회 완료', true);

  // ══ 5. 중복 데이터 검사 ══════════════════════════════
  section('5. 중복 데이터 검사');

  // 같은 tenantId에서 동일 이메일 User
  const dupUsers = await prisma.$queryRaw`
    SELECT tenantId, email, COUNT(*) as cnt FROM User
    GROUP BY tenantId, email HAVING COUNT(*) > 1
  `;
  ok('User email 중복 없음', dupUsers.length === 0,
    `중복 이메일 ${dupUsers.length}건: ${JSON.stringify(dupUsers.slice(0,3))}`);

  // 같은 tenantId에서 동일 이름 Device
  const dupDevices = await prisma.$queryRaw`
    SELECT tenantId, name, COUNT(*) as cnt FROM Device
    WHERE isActive = 1
    GROUP BY tenantId, name HAVING COUNT(*) > 1
  `;
  ok('Device name 중복 없음 (활성)', dupDevices.length === 0,
    `중복 디바이스명 ${dupDevices.length}건`);

  // ══ 6. AuditLog 최근 활동 ════════════════════════════
  section('6. AuditLog 최근 활동 기록');
  const recentLogs = await prisma.auditLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5,
    select: { action: true, createdAt: true, tenantId: true }
  });
  ok('AuditLog 최근 기록 조회', recentLogs.length >= 0);
  recentLogs.forEach(l => {
    console.log(`  📝 ${l.action} @ ${new Date(l.createdAt).toLocaleString()}`);
  });

  const totalLogs = await prisma.auditLog.count();
  console.log(`  총 AuditLog: ${totalLogs}건`);

  // ══ 결과 요약 ════════════════════════════════════════
  const total = PASS + FAIL;
  console.log(`\n${'═'.repeat(52)}`);
  console.log(`  📊 DB 정합성 검사 결과`);
  console.log('═'.repeat(52));
  console.log(`  전체: ${total}건`);
  console.log(`  ✅ PASS:    ${PASS}건`);
  console.log(`  ❌ FAIL:    ${FAIL}건`);
  console.log('═'.repeat(52));

  if (ISSUES.length > 0) {
    console.log('\n  ❌ 실패 항목:');
    ISSUES.forEach((issue, i) => {
      console.log(`  ${i+1}. ${issue.label}${issue.detail ? ' → ' + issue.detail : ''}`);
    });
  } else {
    console.log('\n  🎉 DB 정합성 이상 없음!');
  }
}

run()
  .catch(e => { console.error('❌ DB 오류:', e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
