/**
 * V4 Phase 11: 콘텐츠 생애주기 자동화 서비스
 *
 * 매 분 실행되는 cron job으로:
 * 1. 만료된 콘텐츠 자동 비활성화 (published → expired)
 * 2. 엠바고 해제된 콘텐츠 자동 활성화 (scheduled → published)
 *
 * ⚠️ publishStatus = 'disabled'인 콘텐츠는 절대 건드리지 않음
 *    (사용자가 의도적으로 비활성화한 콘텐츠)
 */

const cron = require('node-cron');
const prisma = require('../utils/prisma');

let isRunning = false;

/**
 * 콘텐츠 생애주기 처리
 * - expired: expiresAt이 지난 published 콘텐츠
 * - published: startAt이 지난 scheduled 콘텐츠
 */
async function processContentLifecycle() {
  if (isRunning) {
    console.log('[Lifecycle] 이전 작업 실행 중 — 스킵');
    return;
  }

  isRunning = true;
  const now = new Date();

  try {
    // 1. 만료된 콘텐츠 비활성화 (published → expired)
    const expiredResult = await prisma.content.updateMany({
      where: {
        expiresAt: { lte: now },
        publishStatus: 'published',
        expiresAt: { not: null }
      },
      data: {
        isActive: false,
        publishStatus: 'expired'
      }
    });

    if (expiredResult.count > 0) {
      console.log(`[Lifecycle] ${expiredResult.count}개 콘텐츠 만료 처리됨`);
    }

    // 2. 엠바고 해제 (scheduled → published)
    // ⚠️ disabled 상태는 건드리지 않음!
    const publishedResult = await prisma.content.updateMany({
      where: {
        startAt: { lte: now },
        publishStatus: 'scheduled'
      },
      data: {
        isActive: true,
        publishStatus: 'published'
      }
    });

    if (publishedResult.count > 0) {
      console.log(`[Lifecycle] ${publishedResult.count}개 콘텐츠 엠바고 해제됨`);
    }

    // 3. 곧 만료될 콘텐츠 로깅 (D-1 이내)
    const soonExpiring = await prisma.content.count({
      where: {
        publishStatus: 'published',
        expiresAt: {
          gt: now,
          lte: new Date(now.getTime() + 24 * 60 * 60 * 1000) // 24시간 이내
        }
      }
    });

    if (soonExpiring > 0) {
      console.log(`[Lifecycle] ${soonExpiring}개 콘텐츠 24시간 이내 만료 예정`);
    }

  } catch (error) {
    console.error('[Lifecycle] 콘텐츠 생애주기 처리 오류:', error);
  } finally {
    isRunning = false;
  }
}

/**
 * Cron 스케줄러 시작
 * 매 분 실행 (* * * * *)
 */
function startContentLifecycleCron() {
  // 매 분마다 실행
  const task = cron.schedule('* * * * *', processContentLifecycle, {
    scheduled: true,
    timezone: 'Asia/Seoul'
  });

  console.log('[Lifecycle] 콘텐츠 생애주기 cron 시작 (매 분 실행)');

  // 서버 시작 시 즉시 1회 실행
  processContentLifecycle();

  return task;
}

module.exports = {
  startContentLifecycleCron,
  processContentLifecycle // 테스트용 export
};
