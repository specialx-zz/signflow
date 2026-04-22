# VueSign V3 기획서 - SaaS 고도화 & 프로덕션 준비

> 작성일: 2026-03-30
> 대상 버전: V2.0 → V3.0
> 예상 기간: 12~16주 (Phase 7~10)

---

## 1. 현재 시스템 현황 (V2 완료 상태)

### 1.1 기술 스택
| 구분 | 기술 | 비고 |
|------|------|------|
| Backend | Express.js + Prisma ORM | Node.js, JavaScript |
| Frontend | React 18 + TypeScript + Vite | Tailwind CSS |
| Player | React + Electron | 웹/데스크탑 겸용 |
| Database | SQLite | 파일 기반 |
| 실시간통신 | Socket.IO | WebSocket |
| 파일저장 | 로컬 / Cloudflare R2 | S3 호환 |
| 인증 | JWT (단일 토큰) | 7일 만료 |
| 배포 | Docker + Nginx | SSL, 리버스프록시 |

### 1.2 규모
| 항목 | 수량 |
|------|------|
| 백엔드 컨트롤러 | 16개 (131 메소드) |
| API 엔드포인트 | 118개 (15 라우트파일) |
| 미들웨어 | 7개 |
| DB 모델 | 21개 |
| 프론트엔드 페이지 | 18개 |
| 프론트엔드 컴포넌트 | 9개 |
| API 클라이언트 | 15개 |
| 플레이어 컴포넌트 | 10개 |
| 테스트 커버리지 | 0% |

### 1.3 V2에서 완료된 기능
- [x] Phase 1: 멀티테넌트 인프라 (업체/매장/구독 모델)
- [x] Phase 2: 콘텐츠 배포 최적화 (R2, 매니페스트, 오프라인)
- [x] Phase 3: 과금 시스템 (구독 플랜, 쿼터)
- [x] Phase 4: 플레이어 고도화 (Electron, 캐시, 원격제어)
- [x] Phase 5: 보안 & 운영 (비밀번호 정책, 감사로그, Docker)
- [x] Phase 6: 고급 기능 (긴급메시지, 공유라이브러리, 콘텐츠 승인)
- [x] 추가: 역할별 권한 강화, 업체 명칭 통일, 테스트 계정

---

## 2. V3 로드맵 개요

```
Phase 7: 자동화 테스트 & 안정성          (3~4주)  ★★★ 필수
Phase 8: 프로덕션 배포 준비              (2~3주)  ★★★ 필수
Phase 9: UX 품질 고도화                  (3~4주)  ★★  중요
Phase 10: 비즈니스 기능 확장             (4~5주)  ★   선택
```

---

## 3. Phase 7: 자동화 테스트 & 안정성 (3~4주)

### 3.1 목표
기존 118개 API 엔드포인트와 21개 DB 모델에 대한 테스트 커버리지를 확보하여
이후 Phase 8~10 작업 시 기존 서비스 안정성을 보장한다.

### 3.2 작업 항목

#### 7-1. 백엔드 테스트 인프라 구축
```
영향 범위: package.json (devDependencies 추가만)
기존 코드 변경: 없음 (테스트 파일만 추가)
```

- [ ] Jest + Supertest + node-mocks-http 설치
- [ ] jest.config.js 생성 (테스트 환경 설정)
- [ ] 테스트용 SQLite in-memory DB 설정
- [ ] 테스트 헬퍼 함수 생성 (인증 토큰 발급, 시드 데이터)
- [ ] package.json에 test 스크립트 추가

**신규 파일:**
```
backend/
├── jest.config.js
├── tests/
│   ├── setup.js                    (테스트 환경 초기화)
│   ├── helpers/
│   │   ├── auth.js                 (테스트용 토큰 생성)
│   │   ├── seed.js                 (테스트 시드 데이터)
│   │   └── request.js              (Supertest 래퍼)
│   ├── unit/
│   │   ├── middleware/
│   │   │   ├── auth.test.js
│   │   │   ├── tenant.test.js
│   │   │   ├── quota.test.js
│   │   │   ├── loginLimiter.test.js
│   │   │   └── auditLogger.test.js
│   │   └── utils/
│   │       ├── password.test.js
│   │       └── storage.test.js
│   └── integration/
│       ├── auth.test.js
│       ├── users.test.js
│       ├── content.test.js
│       ├── playlists.test.js
│       ├── schedules.test.js
│       ├── devices.test.js
│       ├── stores.test.js
│       ├── layouts.test.js
│       ├── emergency.test.js
│       ├── approvals.test.js
│       ├── sharedContent.test.js
│       ├── tenants.test.js
│       └── subscriptions.test.js
```

**영향도 분석:**
| 대상 | 영향 | 위험도 |
|------|------|--------|
| package.json | devDependencies 추가 | 🟢 없음 |
| 기존 소스코드 | 변경 없음 | 🟢 없음 |
| 빌드 프로세스 | test 스크립트 추가 | 🟢 없음 |
| 배포 | 영향 없음 (devDependency) | 🟢 없음 |

#### 7-2. 역할별 권한 통합 테스트
```
영향 범위: tests/ 디렉토리만
기존 코드 변경: 없음
```

- [ ] 5개 역할 × 118개 엔드포인트 권한 매트릭스 테스트
- [ ] VIEWER가 CUD 차단되는지 확인 (403)
- [ ] USER가 스케줄/장치 CUD 차단되는지 확인
- [ ] STORE_MANAGER가 매장/사용자 관리 차단되는지 확인
- [ ] TENANT_ADMIN이 업체 관리 차단되는지 확인
- [ ] SUPER_ADMIN이 모든 기능 접근 가능한지 확인
- [ ] 크로스 테넌트 접근 차단 테스트

**테스트 케이스 수 예상:** ~200개

#### 7-3. 프론트엔드 테스트 인프라 구축
```
영향 범위: package.json (devDependencies), vite.config.ts (test 설정)
기존 코드 변경: 없음
```

- [ ] Vitest + @testing-library/react + jsdom 설치
- [ ] vitest.config.ts 또는 vite.config.ts에 test 블록 추가
- [ ] 컴포넌트 테스트 작성 (주요 UI 컴포넌트)
- [ ] API mock 설정 (MSW - Mock Service Worker)

**신규 파일:**
```
frontend/
├── vitest.config.ts               (또는 vite.config.ts test 블록)
├── tests/
│   ├── setup.ts                   (테스트 환경)
│   ├── mocks/
│   │   └── handlers.ts            (MSW API mock)
│   ├── components/
│   │   ├── Modal.test.tsx
│   │   ├── Sidebar.test.tsx
│   │   └── StatusBadge.test.tsx
│   └── pages/
│       ├── LoginPage.test.tsx
│       ├── ContentPage.test.tsx
│       └── UsersPage.test.tsx
```

#### 7-4. E2E 테스트 (Playwright)
```
영향 범위: 프로젝트 루트에 playwright 설정 추가
기존 코드 변경: 없음
```

- [ ] Playwright 설치 및 설정
- [ ] 핵심 사용자 시나리오 E2E 테스트:
  - 로그인 → 콘텐츠 업로드 → 플레이리스트 생성 → 스케줄 배포
  - 업체관리자: 매장 추가 → 사용자 추가 → 권한 확인
  - 뷰어: 조회만 가능한지 확인
  - 긴급메시지 발송 → 플레이어 수신
- [ ] CI/CD 파이프라인에 E2E 테스트 통합

**신규 파일:**
```
e2e/
├── playwright.config.ts
├── tests/
│   ├── auth.spec.ts
│   ├── content-workflow.spec.ts
│   ├── permission.spec.ts
│   └── emergency.spec.ts
```

#### 7-5. 부하 테스트
```
영향 범위: 프로젝트 루트에 설정 파일 추가
기존 코드 변경: 없음
```

- [ ] Artillery 설치 및 시나리오 작성
- [ ] API 엔드포인트 부하 테스트 (동시 100명)
- [ ] WebSocket 연결 부하 테스트 (동시 500대 장치)
- [ ] 파일 업로드 부하 테스트
- [ ] 테넌트별 레이트 리밋 동작 확인

**신규 파일:**
```
load-tests/
├── api-load.yml
├── websocket-load.yml
└── upload-load.yml
```

---

## 4. Phase 8: 프로덕션 배포 준비 (2~3주)

### 4.1 목표
현재 개발 환경 기반의 시스템을 프로덕션 레벨로 격상한다.
데이터 안정성, 모니터링, 자동 복구 체계를 구축한다.

### 4.2 작업 항목

#### 8-1. 환경변수 분리 & 보안 강화
```
영향 범위: .env 파일 구조 변경, app.js 초기화 로직
기존 코드 변경: 최소 (환경변수 참조 방식)
```

- [ ] 환경별 .env 분리 (.env.development, .env.staging, .env.production)
- [ ] JWT_SECRET 자동 생성 스크립트 (crypto.randomBytes)
- [ ] 민감 정보 검증 미들웨어 (시작 시 필수 환경변수 확인)
- [ ] dotenv-vault 또는 secrets manager 연동 가이드

**영향도 분석:**
| 대상 | 영향 | 위험도 |
|------|------|--------|
| app.js | 시작 시 env 검증 로직 추가 (5줄) | 🟡 낮음 |
| .env | 파일 구조 변경 | 🟡 낮음 |
| Docker | ENV 주입 방식 변경 가능 | 🟡 낮음 |
| 기존 기능 | 영향 없음 | 🟢 없음 |

**기존 코드 변경 상세:**
```javascript
// app.js 상단에 추가 (기존 코드 변경 없음, 삽입만)
const requiredEnvVars = ['JWT_SECRET', 'DATABASE_URL'];
requiredEnvVars.forEach(key => {
  if (!process.env[key]) {
    console.error(`Missing required env var: ${key}`);
    process.exit(1);
  }
});
```

#### 8-2. PostgreSQL 마이그레이션 준비
```
영향 범위: schema.prisma (provider 변경), 일부 쿼리 수정
기존 코드 변경: 중간 (SQLite 특화 쿼리가 있을 경우)
⚠️ 주의: 데이터 마이그레이션 스크립트 필수
```

- [ ] Prisma provider를 postgresql로 변경
- [ ] SQLite → PostgreSQL 데이터 타입 매핑 확인
  - SQLite `TEXT` → PostgreSQL `TEXT` (호환)
  - SQLite `INTEGER` → PostgreSQL `INTEGER` (호환)
  - SQLite `REAL` → PostgreSQL `DOUBLE PRECISION`
  - DateTime 처리 방식 확인
- [ ] JSON 필드 마이그레이션 (Tenant.settings: String → JsonB)
- [ ] 마이그레이션 스크립트 작성 (기존 데이터 보존)
- [ ] docker-compose에 PostgreSQL 서비스 추가
- [ ] 인덱스 최적화 (tenantId, deviceId, createdAt 복합 인덱스)

**영향도 분석:**
| 대상 | 영향 | 위험도 |
|------|------|--------|
| schema.prisma | provider, 타입 변경 | 🔴 높음 |
| 컨트롤러 | raw SQL 사용 부분 수정 | 🟡 낮음 (Prisma ORM 사용 중) |
| seed.js | 동일 (Prisma 추상화) | 🟢 없음 |
| docker-compose | PostgreSQL 컨테이너 추가 | 🟡 낮음 |
| 데이터 | 마이그레이션 스크립트 필요 | 🔴 높음 |

**안전한 마이그레이션 전략:**
```
1단계: PostgreSQL 지원 추가 (SQLite도 계속 동작)
2단계: 마이그레이션 스크립트 개발 & 테스트
3단계: 스테이징에서 마이그레이션 실행 & 검증
4단계: 프로덕션 마이그레이션 (다운타임 최소화)
```

#### 8-3. Redis 연동 (세션/캐시/레이트리밋)
```
영향 범위: loginLimiter.js, tenantRateLimit.js, socket.js
기존 코드 변경: 중간 (인메모리 → Redis 교체)
```

현재 문제: 서버 재시작 시 모든 인메모리 데이터 소실
- loginLimiter: IP/계정 잠금 정보 소실
- tenantRateLimit: 요청 카운터 리셋
- Socket.IO: 연결 디바이스 목록 소실

- [ ] Redis 클라이언트 설정 (ioredis)
- [ ] loginLimiter.js: Map → Redis Hash 전환
- [ ] tenantRateLimit.js: Map → Redis Key+TTL 전환
- [ ] Socket.IO: Redis Adapter 적용 (클러스터 지원)
- [ ] 세션 스토어 Redis 전환 (JWT 블랙리스트용)
- [ ] docker-compose에 Redis 서비스 추가

**영향도 분석:**
| 대상 | 영향 | 위험도 |
|------|------|--------|
| loginLimiter.js | 내부 저장소 교체 (API 인터페이스 유지) | 🟡 중간 |
| tenantRateLimit.js | 내부 저장소 교체 (API 인터페이스 유지) | 🟡 중간 |
| socket.js | Redis Adapter 추가 | 🟡 중간 |
| app.js | Redis 연결 초기화 추가 | 🟡 낮음 |
| 기존 API 동작 | 영향 없음 (내부 구현만 변경) | 🟢 없음 |

**안전 장치:**
```javascript
// Redis 연결 실패 시 인메모리 폴백
const store = redis.isReady ? redisStore : memoryStore;
```

#### 8-4. API 문서 자동화 (Swagger/OpenAPI)
```
영향 범위: 라우트 파일에 JSDoc 주석 추가
기존 코드 변경: 주석만 추가 (기능 변경 없음)
```

- [ ] swagger-jsdoc + swagger-ui-express 설치
- [ ] 라우트별 JSDoc 주석 추가 (118개 엔드포인트)
- [ ] /api/docs 경로로 Swagger UI 서빙
- [ ] 요청/응답 스키마 문서화
- [ ] 인증 방식 문서화 (Bearer Token)

**영향도 분석:**
| 대상 | 영향 | 위험도 |
|------|------|--------|
| 라우트 파일 15개 | JSDoc 주석 추가 | 🟢 없음 |
| app.js | swagger-ui 미들웨어 1줄 추가 | 🟢 없음 |
| package.json | 2개 dependency 추가 | 🟢 없음 |

#### 8-5. 헬스체크 & 모니터링 대시보드
```
영향 범위: 신규 라우트 추가, 신규 프론트엔드 페이지
기존 코드 변경: 없음
```

- [ ] /api/health 상세 헬스체크 확장
  - DB 연결 상태
  - Redis 연결 상태
  - 디스크 사용량
  - 메모리 사용량
  - 활성 WebSocket 연결 수
- [ ] /api/metrics 프로메테우스 호환 메트릭
- [ ] 시스템 모니터링 대시보드 페이지 (SUPER_ADMIN 전용)
  - 서버 상태 실시간 표시
  - API 응답 시간 차트
  - 에러율 차트
  - 테넌트별 사용량

#### 8-6. 자동 백업 & 복구
```
영향 범위: 신규 스크립트, docker-compose 서비스 추가
기존 코드 변경: 없음
```

- [ ] PostgreSQL 자동 백업 cron job (매일 새벽 3시)
- [ ] 업로드 파일 증분 백업
- [ ] 백업 복구 스크립트 (1-click restore)
- [ ] 백업 상태 알림 (이메일/Slack)
- [ ] 보관 기간 자동 정리 (기본 30일)

#### 8-7. CI/CD 파이프라인
```
영향 범위: .github/workflows/ 추가
기존 코드 변경: 없음
```

- [ ] GitHub Actions 워크플로우:
  - PR 시: 린트 + 테스트 자동 실행
  - main 머지 시: Docker 빌드 + 스테이징 배포
  - 태그 생성 시: 프로덕션 배포
- [ ] Docker 이미지 빌드 & 레지스트리 푸시
- [ ] 배포 롤백 스크립트

**신규 파일:**
```
.github/
├── workflows/
│   ├── test.yml            (PR 테스트)
│   ├── staging.yml         (스테이징 배포)
│   └── production.yml      (프로덕션 배포)
scripts/
├── backup.sh
├── restore.sh
├── deploy.sh
└── rollback.sh
```

---

## 5. Phase 9: UX 품질 고도화 (3~4주)

### 5.1 목표
데스크탑 중심의 현재 UI를 모바일/태블릿 대응으로 확장하고,
다크모드 및 실시간 알림 등 사용자 경험을 개선한다.

### 5.2 작업 항목

#### 9-1. 반응형 모바일 대응
```
영향 범위: Sidebar.tsx, Header.tsx, Layout.tsx + 각 페이지 스타일
기존 코드 변경: 스타일/레이아웃만 수정 (기능 로직 변경 없음)
```

- [ ] 모바일 사이드바 (햄버거 메뉴 → 드로어)
- [ ] 반응형 테이블 → 카드 뷰 전환 (768px 이하)
- [ ] 모달 풀스크린 모드 (모바일)
- [ ] 터치 제스처 지원 (스와이프 네비게이션)
- [ ] 대시보드 카드 스택 레이아웃 (모바일)

**영향도 분석:**
| 대상 | 영향 | 위험도 |
|------|------|--------|
| Layout.tsx | 사이드바 토글 로직 추가 | 🟡 낮음 |
| Sidebar.tsx | 드로어 모드 추가 | 🟡 낮음 |
| Header.tsx | 햄버거 버튼 추가 | 🟡 낮음 |
| 각 페이지 | Tailwind 반응형 클래스 추가 | 🟡 낮음 |
| 기존 데스크탑 UI | 변경 없음 (추가만) | 🟢 없음 |

**안전 전략:**
```
모바일 대응은 기존 데스크탑 스타일을 유지하면서
@media (max-width: 768px) 에서만 새로운 레이아웃 적용.
기존 데스크탑 사용자는 영향 없음.
```

#### 9-2. 다크모드 지원
```
영향 범위: tailwind.config.js, index.css, 일부 컴포넌트
기존 코드 변경: CSS 클래스 추가 (기능 변경 없음)
```

- [ ] Tailwind dark 모드 활성화 (`darkMode: 'class'`)
- [ ] 다크 색상 팔레트 정의
- [ ] 테마 토글 컴포넌트 (Header에 배치)
- [ ] 사용자 테마 설정 localStorage 저장
- [ ] 시스템 설정 자동 감지 (prefers-color-scheme)

**영향도 분석:**
| 대상 | 영향 | 위험도 |
|------|------|--------|
| tailwind.config.js | darkMode 설정 추가 | 🟢 없음 |
| index.css | dark: 프리픽스 스타일 추가 | 🟢 없음 |
| 컴포넌트 | dark: 클래스 추가 | 🟡 낮음 |
| 기존 라이트 모드 | 변경 없음 | 🟢 없음 |

**구현 원칙:**
```
모든 dark: 클래스는 기존 클래스에 "추가"하는 방식.
기존 라이트 모드는 어떤 변경도 없음.
예: className="bg-white dark:bg-gray-800"
```

#### 9-3. 실시간 알림 시스템
```
영향 범위: 신규 컴포넌트, Socket.IO 이벤트 추가
기존 코드 변경: Layout.tsx에 알림 컴포넌트 삽입
```

- [ ] 알림 센터 컴포넌트 (Header 우측 벨 아이콘)
- [ ] 알림 유형:
  - 장치 상태 변경 (온라인 → 오프라인)
  - 콘텐츠 승인 요청/결과
  - 긴급메시지 발송
  - 구독 만료 임박
  - 쿼터 80% 도달
- [ ] 브라우저 Push Notification 지원
- [ ] 알림 읽음/안읽음 상태 관리
- [ ] DB에 알림 히스토리 저장

**영향도 분석:**
| 대상 | 영향 | 위험도 |
|------|------|--------|
| schema.prisma | Notification 모델 추가 | 🟡 낮음 (신규 테이블) |
| socket.js | 알림 이벤트 핸들러 추가 | 🟡 낮음 |
| Layout.tsx | NotificationCenter 컴포넌트 삽입 | 🟡 낮음 |
| 기존 Socket 이벤트 | 변경 없음 | 🟢 없음 |

**신규 DB 모델:**
```prisma
model Notification {
  id        String   @id @default(uuid())
  tenantId  String
  userId    String
  type      String   // DEVICE_STATUS, APPROVAL, EMERGENCY, QUOTA, SUBSCRIPTION
  title     String
  message   String
  data      String?  // JSON 추가 데이터
  isRead    Boolean  @default(false)
  createdAt DateTime @default(now())
  @@index([userId, isRead])
  @@index([tenantId])
}
```

#### 9-4. 드래그앤드롭 스케줄 편집
```
영향 범위: SchedulesPage.tsx
기존 코드 변경: 캘린더 이벤트 핸들러 추가
⚠️ 주의: 가장 큰 페이지(966줄), 신중한 리팩토링 필요
```

- [ ] FullCalendar 이벤트 드래그 이동 (날짜 변경)
- [ ] 이벤트 리사이즈 (시간 변경)
- [ ] 드래그로 새 스케줄 생성
- [ ] 드롭 시 자동 API 호출 (PUT /api/schedules/:id)
- [ ] Undo/Redo 지원

**영향도 분석:**
| 대상 | 영향 | 위험도 |
|------|------|--------|
| SchedulesPage.tsx | eventDrop, eventResize 핸들러 추가 | 🟡 중간 |
| scheduleController.js | 기존 updateSchedule 활용 (변경 없음) | 🟢 없음 |
| routes/schedules.js | 변경 없음 | 🟢 없음 |

**안전 전략:**
```
FullCalendar의 editable, eventDrop, eventResize는
기존 캘린더 렌더링에 props만 추가하는 방식.
기존 클릭/모달 동작은 그대로 유지.
```

#### 9-5. 대시보드 위젯 커스터마이징
```
영향 범위: DashboardPage.tsx 리팩토링
기존 코드 변경: 위젯 분리 리팩토링
```

- [ ] 대시보드 위젯을 독립 컴포넌트로 분리
  - KPI 카드 위젯
  - 장치 상태 차트 위젯
  - 재생 현황 차트 위젯
  - 최근 콘텐츠 목록 위젯
  - 알림 피드 위젯
  - 업체별 사용량 위젯 (SUPER_ADMIN)
- [ ] 위젯 레이아웃 드래그앤드롭 (react-grid-layout)
- [ ] 사용자별 대시보드 레이아웃 저장
- [ ] 위젯 설정 (표시/숨김, 새로고침 간격)

**영향도 분석:**
| 대상 | 영향 | 위험도 |
|------|------|--------|
| DashboardPage.tsx | 컴포넌트 분리 리팩토링 | 🟡 중간 |
| 신규 위젯 컴포넌트 | 추가만 | 🟢 없음 |
| authStore 또는 settings | 위젯 레이아웃 저장 | 🟡 낮음 |

---

## 6. Phase 10: 비즈니스 기능 확장 (4~5주)

### 6.1 목표
SaaS 상품으로서의 차별화 기능을 추가하고
외부 서비스 연동을 통한 콘텐츠 활용도를 높인다.

### 6.2 작업 항목

#### 10-1. 콘텐츠 템플릿 마켓플레이스
```
영향 범위: 신규 모델/컨트롤러/라우트/페이지 추가
기존 코드 변경: 없음 (완전 독립 모듈)
```

- [ ] ContentTemplate 모델 (이름, 카테고리, 미리보기, 가격)
- [ ] 템플릿 업로드 (SUPER_ADMIN)
- [ ] 템플릿 검색/필터 (카테고리, 인기순, 최신순)
- [ ] 템플릿 다운로드 → 내 콘텐츠로 복사
- [ ] 별점/리뷰 시스템
- [ ] 마켓플레이스 페이지

**신규 파일:**
```
backend/
├── controllers/templateController.js
├── routes/templates.js
frontend/
├── pages/TemplatePage.tsx
├── api/templates.ts
```

**신규 DB 모델:**
```prisma
model ContentTemplate {
  id          String   @id @default(uuid())
  name        String
  description String?
  category    String
  type        String   // IMAGE, VIDEO, HTML
  thumbnail   String
  filePath    String
  downloads   Int      @default(0)
  rating      Float    @default(0)
  isPremium   Boolean  @default(false)
  price       Int      @default(0)
  createdBy   String
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model TemplateReview {
  id         String   @id @default(uuid())
  templateId String
  userId     String
  tenantId   String
  rating     Int      // 1-5
  comment    String?
  createdAt  DateTime @default(now())
  @@unique([templateId, userId])
}
```

**영향도 분석:**
| 대상 | 영향 | 위험도 |
|------|------|--------|
| app.js | 라우트 등록 1줄 추가 | 🟢 없음 |
| schema.prisma | 2개 모델 추가 | 🟡 낮음 |
| Sidebar.tsx | 메뉴 항목 1개 추가 | 🟢 없음 |
| App.tsx | 라우트 1개 추가 | 🟢 없음 |
| 기존 기능 | 변경 없음 | 🟢 없음 |

#### 10-2. 다국어 지원 (i18n)
```
영향 범위: 모든 프론트엔드 페이지 (18개)
기존 코드 변경: 높음 (하드코딩된 한국어 문자열 추출)
⚠️ 주의: 가장 큰 영향 범위, 단계적 적용 권장
```

- [ ] react-i18next 라이브러리 설치
- [ ] 번역 키 체계 설계 (namespace별 분리)
- [ ] 한국어 문자열 추출 → JSON 번역 파일
- [ ] 영어 번역 파일 추가
- [ ] 언어 선택기 (Header에 배치)
- [ ] 사용자 언어 설정 저장
- [ ] 날짜/숫자 포맷 로케일 대응

**영향도 분석:**
| 대상 | 영향 | 위험도 |
|------|------|--------|
| 모든 페이지 (18개) | 하드코딩 → t() 함수 교체 | 🔴 높음 |
| 모든 컴포넌트 (9개) | 하드코딩 → t() 함수 교체 | 🟡 중간 |
| package.json | i18next 관련 패키지 추가 | 🟢 없음 |
| main.tsx | i18n 초기화 추가 | 🟡 낮음 |
| 백엔드 에러 메시지 | 에러 코드 기반으로 변경 | 🟡 중간 |

**안전한 적용 전략 (단계적):**
```
1단계: i18n 인프라 설치 + 한국어를 기본 번역 파일로 추출
       → 기존 동작 100% 동일 (한국어만 지원)
2단계: 영어 번역 파일 추가 + 언어 선택기
       → 영어 전환 가능
3단계: 페이지별 점진적 t() 함수 교체
       → 한 페이지씩 안전하게 교체
```

**번역 파일 구조:**
```
frontend/src/locales/
├── ko/
│   ├── common.json      (공통: 버튼, 상태 등)
│   ├── auth.json        (로그인/로그아웃)
│   ├── content.json     (콘텐츠 관리)
│   ├── devices.json     (장치 관리)
│   ├── schedules.json   (스케줄 관리)
│   └── admin.json       (관리자 기능)
└── en/
    ├── common.json
    ├── auth.json
    ├── content.json
    ├── devices.json
    ├── schedules.json
    └── admin.json
```

#### 10-3. 리포트/분석 기능 강화
```
영향 범위: statsController 확장, 신규 페이지
기존 코드 변경: 최소 (기존 통계 API 유지, 신규 추가)
```

- [ ] 일간/주간/월간 리포트 자동 생성
- [ ] 콘텐츠 재생 이력 상세 조회
- [ ] 장치별 가동률 분석
- [ ] 피크 시간대 분석
- [ ] PDF 리포트 다운로드
- [ ] 이메일 리포트 자동 발송 (node-cron 활용)

**영향도 분석:**
| 대상 | 영향 | 위험도 |
|------|------|--------|
| statsController.js | 신규 메소드 추가 (기존 유지) | 🟡 낮음 |
| routes/stats.js | 신규 라우트 추가 | 🟢 없음 |
| Statistics 모델 | 기존 활용 | 🟢 없음 |
| 신규 페이지 | ReportsPage.tsx 추가 | 🟢 없음 |

#### 10-4. 외부 API 연동 (날씨, RSS, SNS)
```
영향 범위: 완전 독립 모듈
기존 코드 변경: 없음
```

- [ ] 외부 데이터 소스 연동 프레임워크
  - 날씨 API (OpenWeatherMap)
  - RSS 피드 파서
  - 소셜 미디어 위젯 (Instagram, Twitter)
  - 주식/환율 정보
- [ ] 위젯 컴포넌트 라이브러리
- [ ] 플레이어에서 동적 위젯 렌더링
- [ ] 위젯 설정 관리 (API 키, 갱신 주기)

**신규 파일:**
```
backend/
├── controllers/widgetController.js
├── routes/widgets.js
├── services/
│   ├── weatherService.js
│   ├── rssService.js
│   └── socialService.js
frontend/
├── pages/WidgetsPage.tsx
├── api/widgets.ts
player/
├── components/widgets/
│   ├── WeatherWidget.tsx
│   ├── RssWidget.tsx
│   └── SocialWidget.tsx
```

**영향도 분석:**
| 대상 | 영향 | 위험도 |
|------|------|--------|
| 기존 코드 전체 | 변경 없음 | 🟢 없음 |
| app.js | 라우트 등록 1줄 추가 | 🟢 없음 |
| Player App.tsx | 위젯 컴포넌트 import 추가 | 🟡 낮음 |

#### 10-5. Webhook & 외부 알림
```
영향 범위: 신규 모듈
기존 코드 변경: 이벤트 발생 지점에 hook 삽입
```

- [ ] Webhook 등록 관리 (URL, 이벤트 유형, 시크릿)
- [ ] 이벤트 트리거:
  - device.online / device.offline
  - content.uploaded / content.deleted
  - schedule.deployed
  - emergency.created
  - subscription.expiring
- [ ] Slack/Teams 연동 템플릿
- [ ] Webhook 발송 이력 & 재시도

**영향도 분석:**
| 대상 | 영향 | 위험도 |
|------|------|--------|
| 각 컨트롤러 | 이벤트 emit 1줄 추가 | 🟡 낮음 |
| 신규 webhook 서비스 | 독립 모듈 | 🟢 없음 |

---

## 7. 전체 영향도 매트릭스

### 7.1 기존 파일 변경 영향도 요약

| 기존 파일 | Phase 7 | Phase 8 | Phase 9 | Phase 10 |
|-----------|---------|---------|---------|----------|
| **app.js** | 없음 | env검증 추가, Redis/Swagger | 없음 | 라우트 등록 |
| **schema.prisma** | 없음 | PostgreSQL 전환 | Notification 추가 | Template 등 추가 |
| **auth.js** | 없음 | Redis 블랙리스트 | 없음 | 없음 |
| **loginLimiter.js** | 없음 | Redis 전환 | 없음 | 없음 |
| **tenantRateLimit.js** | 없음 | Redis 전환 | 없음 | 없음 |
| **socket.js** | 없음 | Redis Adapter | 알림 이벤트 | 없음 |
| **Layout.tsx** | 없음 | 없음 | 사이드바 토글, 알림 | 없음 |
| **Sidebar.tsx** | 없음 | 없음 | 모바일 드로어 | 메뉴 추가 |
| **Header.tsx** | 없음 | 없음 | 다크모드 토글, 알림벨 | 언어선택기 |
| **DashboardPage** | 없음 | 없음 | 위젯 분리 | 없음 |
| **SchedulesPage** | 없음 | 없음 | 드래그앤드롭 | 없음 |
| **모든 페이지 (18개)** | 없음 | 없음 | dark: 클래스 | i18n t() |
| **각 컨트롤러** | 없음 | 없음 | 없음 | webhook emit |

### 7.2 위험도 등급

```
🟢 없음   : 기존 기능에 영향 없음 (파일 추가만 또는 주석만)
🟡 낮음   : 기존 코드에 소규모 추가 (인터페이스 유지)
🟡 중간   : 내부 구현 변경 (인터페이스는 유지, 테스트 필요)
🔴 높음   : 데이터 마이그레이션 또는 대규모 리팩토링 필요
```

### 7.3 Phase별 위험 요약

| Phase | 위험 등급 | 핵심 위험 요소 | 완화 전략 |
|-------|----------|---------------|----------|
| Phase 7 | 🟢 매우 낮음 | 없음 (파일 추가만) | - |
| Phase 8 | 🟡 중간 | PostgreSQL 마이그레이션, Redis 전환 | 스테이징 환경 검증, 폴백 준비 |
| Phase 9 | 🟡 낮음 | 다크모드 클래스 추가, 스케줄 페이지 수정 | 기존 스타일 유지 + 추가 방식 |
| Phase 10 | 🟡~🔴 | i18n 전체 문자열 교체 | 단계적 적용, 한국어 기본 유지 |

---

## 8. 의존성 관계

```
Phase 7 (테스트) ──→ Phase 8 (배포) ──→ Phase 9 (UX)
                                    └──→ Phase 10 (기능)
```

- **Phase 7은 반드시 먼저** 완료 (이후 작업의 안전성 보장)
- **Phase 8은 Phase 7 이후** (테스트 있어야 안전한 인프라 변경 가능)
- **Phase 9, 10은 병렬 가능** (독립적인 기능 영역)

---

## 9. 추가되는 인프라 요약

### 9.1 신규 서비스
| 서비스 | Phase | 용도 |
|--------|-------|------|
| PostgreSQL 15 | Phase 8 | 프로덕션 DB |
| Redis 7 | Phase 8 | 캐시, 세션, 레이트리밋 |

### 9.2 신규 npm 패키지 (예상)

**Backend devDependencies:**
```
jest, supertest, node-mocks-http          (Phase 7)
artillery                                  (Phase 7)
```

**Backend dependencies:**
```
ioredis                                    (Phase 8)
swagger-jsdoc, swagger-ui-express          (Phase 8)
pdfkit (또는 puppeteer)                    (Phase 10)
node-fetch (또는 axios 추가 인스턴스)      (Phase 10)
```

**Frontend devDependencies:**
```
vitest, @testing-library/react, jsdom      (Phase 7)
msw (Mock Service Worker)                  (Phase 7)
@playwright/test                           (Phase 7)
```

**Frontend dependencies:**
```
react-grid-layout                          (Phase 9)
react-i18next, i18next                     (Phase 10)
```

### 9.3 신규 DB 모델 (예상)
| 모델 | Phase | 용도 |
|------|-------|------|
| Notification | Phase 9 | 실시간 알림 |
| DashboardLayout | Phase 9 | 위젯 레이아웃 저장 |
| ContentTemplate | Phase 10 | 템플릿 마켓 |
| TemplateReview | Phase 10 | 템플릿 리뷰 |
| Webhook | Phase 10 | 외부 연동 |
| WebhookLog | Phase 10 | 발송 이력 |
| Report | Phase 10 | 리포트 저장 |
| Widget | Phase 10 | 외부 위젯 설정 |

---

## 10. 일정 요약

```
Week 1-4:   Phase 7 (자동화 테스트)
Week 5-7:   Phase 8 (프로덕션 배포 준비)
Week 8-11:  Phase 9 (UX 고도화)
Week 8-13:  Phase 10 (비즈니스 기능) ← Phase 9와 병렬
Week 14-16: 통합 테스트 & 안정화
```

---

## 부록 A: 현재 파일 목록 & 라인 수

### Backend (46 파일, ~6,000 LOC)
```
src/app.js                              ~200 LOC
src/controllers/ (16 파일)              ~4,200 LOC
src/middleware/ (7 파일)                 ~800 LOC
src/routes/ (15 파일)                   ~500 LOC
src/utils/ (7 파일)                     ~400 LOC
prisma/schema.prisma                    ~300 LOC
```

### Frontend (51 파일, ~8,000 LOC)
```
src/App.tsx                             91 LOC
src/pages/ (18 파일)                    ~7,000 LOC
src/components/ (9 파일)                ~350 LOC
src/api/ (15 파일)                      ~400 LOC
src/stores/ (1 파일)                    32 LOC
src/hooks/ (1 파일)                     55 LOC
```

### Player (15 파일, ~2,500 LOC)
```
src/App.tsx + components/ (10 파일)     ~1,500 LOC
src/hooks/ (4 파일)                     ~600 LOC
src/utils/ (3 파일)                     ~400 LOC
```

---

## 부록 B: 테스트 계정 (V2 현재)

| 역할 | 이메일 | 비밀번호 | 설명 |
|------|--------|---------|------|
| 최고관리자 | superadmin@vuesign.com | superadmin123 | 전체 시스템 관리 |
| 업체관리자 | admin@vuesign.com | admin123 | 업체 내 전체 관리 |
| 매장관리자 | manager@vuesign.com | manager123 | 매장 단위 운영 |
| 사용자 | user@vuesign.com | user123 | 콘텐츠 작업 |
| 뷰어 | viewer@vuesign.com | viewer123 | 조회만 가능 |
