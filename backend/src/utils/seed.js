require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const prisma = new PrismaClient();

const DEFAULT_TENANT_ID = 'default-tenant';

async function seed() {
  console.log('Seeding database...');

  // ─── 1. 기본 테넌트 생성 ─────────────────────────
  const tenant = await prisma.tenant.upsert({
    where: { id: DEFAULT_TENANT_ID },
    update: {},
    create: {
      id: DEFAULT_TENANT_ID,
      name: 'Default Tenant',
      slug: 'default',
      contactEmail: 'admin@signflow.com',
      timezone: 'Asia/Seoul',
    }
  });
  console.log('Default tenant created');

  // ─── 2. 기본 구독 생성 ──────────────────────────
  await prisma.subscription.upsert({
    where: { tenantId: DEFAULT_TENANT_ID },
    update: {},
    create: {
      id: uuidv4(),
      tenantId: DEFAULT_TENANT_ID,
      plan: 'enterprise',
      status: 'active',
      maxDevices: 999,
      maxStorageGB: 999,
      maxUsers: 999,
      maxStores: 999,
      startDate: new Date(),
    }
  });
  console.log('Default subscription created');

  // ─── 3. 슈퍼어드민 생성 ─────────────────────────
  const superAdminPassword = await bcrypt.hash('superadmin123', 10);
  const adminPassword = await bcrypt.hash('admin123', 10);
  const userPassword = await bcrypt.hash('user123', 10);

  const superAdmin = await prisma.user.upsert({
    where: { email: 'superadmin@signflow.com' },
    update: { role: 'SUPER_ADMIN' },
    create: {
      id: uuidv4(),
      tenantId: DEFAULT_TENANT_ID,
      username: 'superadmin',
      email: 'superadmin@signflow.com',
      password: superAdminPassword,
      role: 'SUPER_ADMIN',
    }
  });

  const admin = await prisma.user.upsert({
    where: { email: 'admin@signflow.com' },
    update: { role: 'TENANT_ADMIN', tenantId: DEFAULT_TENANT_ID },
    create: {
      id: uuidv4(),
      tenantId: DEFAULT_TENANT_ID,
      username: 'admin',
      email: 'admin@signflow.com',
      password: adminPassword,
      role: 'TENANT_ADMIN',
    }
  });

  const user1 = await prisma.user.upsert({
    where: { email: 'user@signflow.com' },
    update: { tenantId: DEFAULT_TENANT_ID },
    create: {
      id: uuidv4(),
      tenantId: DEFAULT_TENANT_ID,
      username: 'user1',
      email: 'user@signflow.com',
      password: userPassword,
      role: 'USER',
    }
  });

  // Store Manager account
  const storeManagerPassword = await bcrypt.hash('manager123', 10);
  await prisma.user.upsert({
    where: { email: 'manager@signflow.com' },
    update: { role: 'STORE_MANAGER', tenantId: DEFAULT_TENANT_ID },
    create: {
      id: uuidv4(),
      tenantId: DEFAULT_TENANT_ID,
      username: 'manager',
      email: 'manager@signflow.com',
      password: storeManagerPassword,
      role: 'STORE_MANAGER',
    }
  });

  // Viewer account
  const viewerPassword = await bcrypt.hash('viewer123', 10);
  await prisma.user.upsert({
    where: { email: 'viewer@signflow.com' },
    update: { role: 'VIEWER', tenantId: DEFAULT_TENANT_ID },
    create: {
      id: uuidv4(),
      tenantId: DEFAULT_TENANT_ID,
      username: 'viewer',
      email: 'viewer@signflow.com',
      password: viewerPassword,
      role: 'VIEWER',
    }
  });

  console.log('Users created');

  // ─── 4. 콘텐츠 카테고리 ─────────────────────────
  const cat1 = await prisma.contentCategory.upsert({
    where: { id: 'cat-promo' },
    update: { tenantId: DEFAULT_TENANT_ID },
    create: { id: 'cat-promo', tenantId: DEFAULT_TENANT_ID, name: '프로모션' }
  });

  const cat2 = await prisma.contentCategory.upsert({
    where: { id: 'cat-info' },
    update: { tenantId: DEFAULT_TENANT_ID },
    create: { id: 'cat-info', tenantId: DEFAULT_TENANT_ID, name: '공지사항' }
  });

  const cat3 = await prisma.contentCategory.upsert({
    where: { id: 'cat-entertainment' },
    update: { tenantId: DEFAULT_TENANT_ID },
    create: { id: 'cat-entertainment', tenantId: DEFAULT_TENANT_ID, name: '엔터테인먼트' }
  });

  console.log('Categories created');

  // ─── 5. 샘플 콘텐츠 ─────────────────────────────
  const contentItems = [
    { name: '여름 프로모션 배너', type: 'IMAGE', mimeType: 'image/jpeg', size: 1024000, categoryId: cat1.id },
    { name: '신제품 소개 영상', type: 'VIDEO', mimeType: 'video/mp4', size: 52428800, duration: 120, categoryId: cat1.id },
    { name: '공지사항 슬라이드', type: 'IMAGE', mimeType: 'image/png', size: 512000, categoryId: cat2.id },
    { name: '배경음악', type: 'AUDIO', mimeType: 'audio/mpeg', size: 5242880, duration: 180, categoryId: cat3.id },
    { name: '이벤트 안내 HTML', type: 'HTML', mimeType: 'text/html', size: 10240, categoryId: cat2.id },
    { name: '브랜드 로고 이미지', type: 'IMAGE', mimeType: 'image/png', size: 204800, categoryId: cat1.id },
  ];

  const createdContent = [];
  for (const item of contentItems) {
    const existing = await prisma.content.findFirst({ where: { name: item.name } });
    if (!existing) {
      const content = await prisma.content.create({
        data: {
          id: uuidv4(),
          tenantId: DEFAULT_TENANT_ID,
          ...item,
          filePath: `uploads/${item.type.toLowerCase()}s/sample.${item.mimeType.split('/')[1]}`,
          createdBy: admin.id,
          tags: '샘플,테스트'
        }
      });
      createdContent.push(content);
    } else {
      createdContent.push(existing);
    }
  }

  console.log('Content created');

  // ─── 6. 디바이스 그룹 ───────────────────────────
  const group1 = await prisma.deviceGroup.upsert({
    where: { id: 'group-floor1' },
    update: { tenantId: DEFAULT_TENANT_ID },
    create: { id: 'group-floor1', tenantId: DEFAULT_TENANT_ID, name: '1층 디스플레이', description: '1층 매장 디스플레이' }
  });

  const group2 = await prisma.deviceGroup.upsert({
    where: { id: 'group-floor2' },
    update: { tenantId: DEFAULT_TENANT_ID },
    create: { id: 'group-floor2', tenantId: DEFAULT_TENANT_ID, name: '2층 디스플레이', description: '2층 매장 디스플레이' }
  });

  console.log('Device groups created');

  // ─── 7. 디바이스 ────────────────────────────────
  const devices = [
    { name: '메인 디스플레이 A', deviceId: 'DEV-001', groupId: group1.id, status: 'ONLINE', ipAddress: '192.168.1.101', model: 'Samsung QM55R', resolution: '1920x1080', location: '1층 입구' },
    { name: '메인 디스플레이 B', deviceId: 'DEV-002', groupId: group1.id, status: 'ONLINE', ipAddress: '192.168.1.102', model: 'Samsung QM65R', resolution: '3840x2160', location: '1층 중앙' },
    { name: '안내 키오스크', deviceId: 'DEV-003', groupId: group1.id, status: 'OFFLINE', ipAddress: '192.168.1.103', model: 'Samsung KM24A', resolution: '1920x1080', location: '1층 안내데스크' },
    { name: '2층 디스플레이 A', deviceId: 'DEV-004', groupId: group2.id, status: 'ONLINE', ipAddress: '192.168.1.201', model: 'Samsung QM43R', resolution: '1920x1080', location: '2층 입구' },
    { name: '2층 디스플레이 B', deviceId: 'DEV-005', groupId: group2.id, status: 'WARNING', ipAddress: '192.168.1.202', model: 'Samsung QM55R', resolution: '1920x1080', location: '2층 전시관' },
  ];

  for (const device of devices) {
    await prisma.device.upsert({
      where: { deviceId: device.deviceId },
      update: { status: device.status, tenantId: DEFAULT_TENANT_ID, lastSeen: device.status === 'ONLINE' ? new Date() : undefined },
      create: {
        id: uuidv4(),
        tenantId: DEFAULT_TENANT_ID,
        ...device,
        firmware: 'v3.1.2',
        lastSeen: new Date()
      }
    });
  }

  console.log('Devices created');

  // ─── 8. 플레이리스트 ────────────────────────────
  const playlist1 = await prisma.playlist.upsert({
    where: { id: 'pl-morning' },
    update: { tenantId: DEFAULT_TENANT_ID },
    create: {
      id: 'pl-morning',
      tenantId: DEFAULT_TENANT_ID,
      name: '오전 프로모션 플레이리스트',
      type: 'GENERAL',
      description: '오전 시간대 프로모션 콘텐츠',
      createdBy: admin.id,
      duration: 300
    }
  });

  const playlist2 = await prisma.playlist.upsert({
    where: { id: 'pl-evening' },
    update: { tenantId: DEFAULT_TENANT_ID },
    create: {
      id: 'pl-evening',
      tenantId: DEFAULT_TENANT_ID,
      name: '저녁 이벤트 플레이리스트',
      type: 'GENERAL',
      description: '저녁 시간대 이벤트 콘텐츠',
      createdBy: admin.id,
      duration: 600
    }
  });

  console.log('Playlists created');

  // ─── 9. 플레이리스트 아이템 ─────────────────────
  if (createdContent.length > 0) {
    const existingItems = await prisma.playlistItem.findMany({ where: { playlistId: 'pl-morning' } });
    if (existingItems.length === 0) {
      for (let i = 0; i < Math.min(3, createdContent.length); i++) {
        await prisma.playlistItem.create({
          data: {
            id: uuidv4(),
            playlistId: 'pl-morning',
            contentId: createdContent[i].id,
            order: i,
            duration: 15
          }
        });
      }
    }
  }

  console.log('Playlist items created');

  // ─── 10. 스케줄 ─────────────────────────────────
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);

  await prisma.schedule.upsert({
    where: { id: 'sch-1' },
    update: { tenantId: DEFAULT_TENANT_ID },
    create: {
      id: 'sch-1',
      tenantId: DEFAULT_TENANT_ID,
      name: '오전 프로모션 스케줄',
      type: 'CONTENT',
      playlistId: 'pl-morning',
      startDate: now,
      endDate: tomorrow,
      startTime: '09:00',
      endTime: '12:00',
      repeatType: 'DAILY',
      status: 'ACTIVE',
      createdBy: admin.id
    }
  });

  await prisma.schedule.upsert({
    where: { id: 'sch-2' },
    update: { tenantId: DEFAULT_TENANT_ID },
    create: {
      id: 'sch-2',
      tenantId: DEFAULT_TENANT_ID,
      name: '저녁 이벤트 스케줄',
      type: 'CONTENT',
      playlistId: 'pl-evening',
      startDate: now,
      endDate: tomorrow,
      startTime: '18:00',
      endTime: '21:00',
      repeatType: 'WEEKLY',
      repeatDays: '1,2,3,4,5',
      status: 'ACTIVE',
      createdBy: admin.id
    }
  });

  console.log('Schedules created');

  // ─── 11. 통계 ───────────────────────────────────
  const statsData = [];
  for (let i = 30; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);

    if (createdContent.length > 0) {
      statsData.push({
        id: uuidv4(),
        tenantId: DEFAULT_TENANT_ID,
        contentId: createdContent[0].id,
        type: 'PLAY_COUNT',
        value: Math.floor(Math.random() * 100) + 10,
        date
      });
    }
  }

  for (const stat of statsData) {
    await prisma.statistics.upsert({
      where: { id: stat.id },
      update: {},
      create: stat
    });
  }

  console.log('Statistics created');
  console.log('Seeding complete!');
  console.log('\nLogin credentials:');
  console.log('Super Admin: superadmin@signflow.com / superadmin123');
  console.log('Company Admin: admin@signflow.com / admin123');
  console.log('Store Manager: manager@signflow.com / manager123');
  console.log('User: user@signflow.com / user123');
  console.log('Viewer: viewer@signflow.com / viewer123');
}

seed()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
