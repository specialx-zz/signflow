# VueSign V2 기획서 — 멀티테넌트 SaaS 디지털 사이니지 플랫폼

> 작성일: 2026-03-27
> 현재 버전: V1 (단일 서버, 단일 관리자)
> 목표: 판매점별 독립 운영 + 본사 총괄 관리 + 과금 체계를 갖춘 상용 SaaS

---

## 목차

1. [V2 핵심 목표](#1-v2-핵심-목표)
2. [멀티테넌트 아키텍처](#2-멀티테넌트-아키텍처)
3. [사용자 역할 체계](#3-사용자-역할-체계)
4. [콘텐츠 배포 & 트래픽 전략](#4-콘텐츠-배포--트래픽-전략)
5. [플레이어 아키텍처 개선](#5-플레이어-아키텍처-개선)
6. [과금 및 라이선스 시스템](#6-과금-및-라이선스-시스템)
7. [데이터베이스 스키마 변경](#7-데이터베이스-스키마-변경)
8. [API 설계 변경](#8-api-설계-변경)
9. [프론트엔드 변경](#9-프론트엔드-변경)
10. [보안 강화](#10-보안-강화)
11. [운영 & 모니터링](#11-운영--모니터링)
12. [개발 로드맵](#12-개발-로드맵)
13. [추가 권장 기능](#13-추가-권장-기능)

---

## 1. V2 핵심 목표

### 비즈니스 목표
- **SaaS 상용화**: 월정액/연정액으로 판매점에 서비스 제공
- **멀티테넌트**: 업체(테넌트)마다 독립된 데이터 공간, 하나의 서버에서 다수 운영
- **총괄 관리**: 본사(슈퍼어드민)가 모든 테넌트를 관리·과금·모니터링
- **트래픽 최적화**: 동영상 등 대용량 미디어를 본사 서버에서 직접 스트리밍하지 않는 구조

### 기술 목표
- DB를 SQLite → PostgreSQL로 전환 (멀티테넌트, 동시성, 확장성)
- 파일 저장소를 로컬 → **Cloudflare R2** (S3 호환 오브젝트 스토리지, 전송료 무료)
- 플레이어에 로컬 다운로드 + 오프라인 재생 강화
- Row-level 테넌트 격리 (모든 쿼리에 tenantId 조건)

---

## 2. 멀티테넌트 아키텍처

### 2.1 테넌트 구조

```
┌─────────────────────────────────────────────────────┐
│                 슈퍼어드민 (본사)                      │
│  - 테넌트(업체) 생성/관리/과금                         │
│  - 전체 디바이스 현황 모니터링                          │
│  - 공유 콘텐츠 라이브러리 관리                          │
│  - 시스템 설정, 라이선스 관리                           │
└──────────────┬──────────────┬───────────────────────┘
               │              │
     ┌─────────▼──────┐  ┌───▼────────────┐
     │  테넌트 A       │  │  테넌트 B       │  ...
     │  (카페 프랜차이즈)│  │ (의류 매장)     │
     │                 │  │                │
     │  ┌──────────┐   │  │  ┌──────────┐  │
     │  │ 매장 1   │   │  │  │ 매장 1   │  │
     │  │ 디바이스3대│   │  │  │ 디바이스1대│  │
     │  └──────────┘   │  │  └──────────┘  │
     │  ┌──────────┐   │  │  ┌──────────┐  │
     │  │ 매장 2   │   │  │  │ 매장 2   │  │
     │  │ 디바이스2대│   │  │  │ 디바이스2대│  │
     │  └──────────┘   │  │  └──────────┘  │
     └─────────────────┘  └────────────────┘
```

### 2.2 데이터 격리 방식

**Shared Database, Shared Schema** (공유 DB + 테넌트 ID 필터링)

- 이유: 소규모~중규모 SaaS에서 운영 비용 최적
- 모든 테이블에 `tenantId` 컬럼 추가
- 미들웨어에서 자동으로 `WHERE tenantId = ?` 주입
- 슈퍼어드민은 tenantId 필터 없이 전체 조회 가능

```
[모든 요청] → [Auth 미들웨어] → [Tenant 미들웨어] → [컨트롤러]
                  │                    │
                  │                    ├─ req.user.tenantId 주입
                  │                    └─ Prisma 쿼리에 자동 필터
                  └─ JWT → user + role + tenantId 추출
```

### 2.3 테넌트별 설정

| 설정 항목 | 설명 |
|----------|------|
| `brandName` | 테넌트 표시 이름 |
| `brandLogo` | 로그인 화면, 대시보드 로고 |
| `brandColor` | 테마 컬러 |
| `maxDevices` | 최대 디바이스 수 (플랜 연동) |
| `maxStorage` | 최대 스토리지 (GB) |
| `maxUsers` | 최대 사용자 수 |
| `subdomain` | `tenant-a.vuesign.co.kr` 형태 |
| `defaultTransition` | 기본 전환 효과 |
| `contentApproval` | 콘텐츠 승인 워크플로 on/off |
| `timezone` | 기본 시간대 |

---

## 3. 사용자 역할 체계

### 3.1 역할 계층

```
슈퍼어드민 (SUPER_ADMIN)
  └─ 플랫폼 전체 관리, 테넌트 생성/삭제, 과금, 시스템 설정

테넌트 관리자 (TENANT_ADMIN)
  └─ 테넌트 내 모든 권한: 사용자/디바이스/콘텐츠/스케줄 관리

매장 관리자 (STORE_MANAGER)
  └─ 특정 매장(디바이스 그룹) 내에서만 관리 권한
  └─ 자기 매장의 디바이스, 스케줄, 콘텐츠만 접근 가능

일반 사용자 (USER)
  └─ 읽기 전용 또는 제한된 콘텐츠 편집 권한

뷰어 (VIEWER)
  └─ 대시보드/모니터링만 조회 가능
```

### 3.2 권한 매트릭스

| 기능 | SUPER_ADMIN | TENANT_ADMIN | STORE_MANAGER | USER | VIEWER |
|------|:-:|:-:|:-:|:-:|:-:|
| 테넌트 생성/관리 | ✅ | ❌ | ❌ | ❌ | ❌ |
| 과금/라이선스 관리 | ✅ | ❌ | ❌ | ❌ | ❌ |
| 사용자 관리 | ✅ | ✅(테넌트내) | ❌ | ❌ | ❌ |
| 디바이스 등록/삭제 | ✅ | ✅ | ✅(매장내) | ❌ | ❌ |
| 디바이스 리모컨 | ✅ | ✅ | ✅(매장내) | ❌ | ❌ |
| 콘텐츠 업로드 | ✅ | ✅ | ✅ | ✅ | ❌ |
| 플레이리스트 편집 | ✅ | ✅ | ✅ | ✅ | ❌ |
| 레이아웃 편집 | ✅ | ✅ | ✅ | ❌ | ❌ |
| 스케줄 배포 | ✅ | ✅ | ✅(매장내) | ❌ | ❌ |
| 대시보드 조회 | ✅ | ✅ | ✅(매장내) | ✅ | ✅ |
| 모니터링 | ✅ | ✅ | ✅(매장내) | ✅ | ✅ |
| 통계 조회 | ✅ | ✅ | ✅(매장내) | ✅ | ✅ |
| 감사 로그 | ✅ | ✅ | ❌ | ❌ | ❌ |

### 3.3 매장(Store) 개념

현재 `DeviceGroup`을 **Store(매장)** 개념으로 확장:

```
Tenant (업체)
  └─ Store (매장) = DeviceGroup 확장
       ├─ name: "강남점"
       ├─ address: "서울 강남구..."
       ├─ manager: User (STORE_MANAGER)
       ├─ devices: [디바이스1, 디바이스2, ...]
       └─ localSettings: { timezone, defaultPlaylist, ... }
```

---

## 4. 콘텐츠 배포 & 트래픽 전략

### 4.1 현재 문제

```
현재: 모든 미디어를 본사 서버에서 직접 스트리밍

판매점A 디바이스1 ──HTTP GET──→ ┌─────────┐
판매점A 디바이스2 ──HTTP GET──→ │ 본사서버  │  ← 동영상 100MB x 50대 = 5GB 트래픽
판매점B 디바이스1 ──HTTP GET──→ │ (단일)   │
판매점B 디바이스2 ──HTTP GET──→ └─────────┘
...50대 동시 스트리밍                              ← 대역폭 초과, 비용 폭탄
```

### 4.2 파일 저장소: Cloudflare R2 (확정)

#### R2를 선택한 이유

| | AWS S3 | Cloudflare R2 | 본사 서버 직접 |
|---|---|---|---|
| 저장 비용 | $0.025/GB | **$0.015/GB** | 디스크 비용 |
| 전송(다운로드) 비용 | **$0.126/GB** | **무료** ✅ | 서버 대역폭 |
| 무료 티어 | 5GB/12개월 | **10GB/영구** | 없음 |
| AWS 계정 필요 | ✅ | ❌ | ❌ |
| CDN 내장 | ❌ (CloudFront 별도) | ✅ (자체 캐시) | ❌ |
| S3 API 호환 | 원본 | ✅ 100% 호환 | 해당없음 |

**핵심**: R2는 전송(egress) 비용이 무료 → 디바이스가 아무리 많이 다운로드해도 전송 요금 $0

#### R2 연동 구조

```
관리자가 업로드
       │
       ▼
┌─────────────┐    @aws-sdk/client-s3    ┌──────────────────┐
│  본사 서버    │ ──────────────────────→  │  Cloudflare R2   │
│  (API 서버)  │    endpoint만 R2로 변경   │  (오브젝트 스토리지)│
│              │                          │                  │
│  - 메타데이터 │    ← 업로드 완료 후       │  vuesign-content│
│    DB 저장   │      로컬 임시파일 삭제    │  /{tenantId}/    │
└─────────────┘                          │   images/...     │
                                          │   videos/...     │
                                          └────────┬─────────┘
                                                   │
                              공개 URL 또는 Signed URL로 다운로드
                                                   │
                                    ┌──────────────▼──────────────┐
                                    │  각 판매점 디바이스 (플레이어)  │
                                    │  1회 다운로드 → 로컬 저장     │
                                    │  이후 100% 로컬 재생         │
                                    └─────────────────────────────┘
```

#### R2 연동 코드 (백엔드)

```javascript
// @aws-sdk/client-s3 사용 — AWS가 아닌 R2에 연결
const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3')
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner')

const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  }
})

const BUCKET = 'vuesign-content'

// 업로드
async function uploadToR2(tenantId, file, filename) {
  const key = `${tenantId}/${file.type.toLowerCase()}s/${filename}`
  await r2.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: file.buffer,
    ContentType: file.mimetype,
  }))
  return key  // DB에 이 key만 저장
}

// 다운로드 URL 생성 (15분 유효 Signed URL)
async function getDownloadUrl(key) {
  return getSignedUrl(r2, new GetObjectCommand({
    Bucket: BUCKET,
    Key: key,
  }), { expiresIn: 900 })
}
```

#### R2 비용 시뮬레이션

**시나리오별 월 비용 (R2 기준)**

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 시나리오 1: 초기 (업체 3곳, 디바이스 15대)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 저장: 업체당 이미지 2GB + 영상 5GB = 약 21GB 총합
 R2 저장: 21GB × $0.015 = $0.32/월 (약 420원)
 전송: 무료 ($0)
 Class A 작업 (업로드): 월 200건 × $4.50/백만 = 무시 가능
 Class B 작업 (다운로드): 월 3,000건 × $0.36/백만 = 무시 가능
 ─────────────────────────────────────────────
 월 합계: 약 $0.50 (약 650원)          ← 무료 티어 10GB 제외 시
 무료 티어 적용 시: $0 (10GB까지 무료)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 시나리오 2: 성장기 (업체 15곳, 디바이스 80대)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 저장: 업체당 평균 10GB = 약 150GB
 R2 저장: 150GB × $0.015 = $2.25/월 (약 2,900원)
 전송: 무료 ($0)
 작업 비용: 약 $0.10
 ─────────────────────────────────────────────
 월 합계: 약 $2.35 (약 3,000원)

 ※ 같은 조건 AWS S3라면:
    저장: 150GB × $0.025 = $3.75
    전송: 80대 × 10GB 초기배포 = 800GB × $0.126 = $100.80
    월 합계: 약 $104 (약 13만원) ← R2 대비 44배 비쌈
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 시나리오 3: 확장기 (업체 50곳, 디바이스 300대)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 저장: 업체당 평균 15GB = 약 750GB
 R2 저장: 750GB × $0.015 = $11.25/월 (약 14,600원)
 전송: 무료 ($0)
 작업 비용: 약 $0.50
 ─────────────────────────────────────────────
 월 합계: 약 $11.75 (약 15,000원)

 ※ 같은 조건 AWS S3라면:
    전송만: 300대 × 15GB = 4.5TB × $0.126 = $567
    월 합계: 약 $586 (약 76만원)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 시나리오 4: 대규모 (업체 200곳, 디바이스 1,000대)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 저장: 평균 20GB × 200 = 약 4TB
 R2 저장: 4,000GB × $0.015 = $60/월 (약 78,000원)
 전송: 무료 ($0)
 ─────────────────────────────────────────────
 월 합계: 약 $60 (약 78,000원)

 ※ AWS S3 전송만: 1000대 × 20GB = 20TB × $0.126 = $2,520/월 (약 327만원)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**비용 비교 요약표**

| 규모 | R2 월 비용 | AWS S3 월 비용 | 절감률 |
|------|-----------|---------------|-------|
| 초기 (15대) | ~$0 (무료) | ~$15 | 100% |
| 성장 (80대) | ~$2 (3천원) | ~$104 (13만원) | 98% |
| 확장 (300대) | ~$12 (1.5만원) | ~$586 (76만원) | 98% |
| 대규모 (1000대) | ~$60 (7.8만원) | ~$2,520 (327만원) | 98% |

> **핵심**: R2는 전송 무료이므로 디바이스가 늘어도 저장 비용만 선형 증가.
> 콘텐츠를 디바이스에 1회 다운로드 후 로컬 재생하므로 반복 전송도 거의 없음.

#### R2 설정 방법 (초기 세팅)

```
1. Cloudflare 무료 계정 가입 (cloudflare.com)
2. 대시보드 → R2 Object Storage → 활성화
3. 버킷 생성: "vuesign-content"
4. API 토큰 생성: R2 읽기/쓰기 권한
5. 백엔드 .env에 설정:
   R2_ACCOUNT_ID=계정ID
   R2_ACCESS_KEY_ID=발급받은키
   R2_SECRET_ACCESS_KEY=발급받은시크릿
   R2_BUCKET=vuesign-content
6. 끝! npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
```

### 4.3 콘텐츠 배포 흐름: 플레이어 로컬 다운로드

```
스케줄 배포 시:
1. 서버 → 플레이어: "새 스케줄 배포됨" (Socket.IO)
2. 플레이어: 스케줄 정보 수신 (JSON, 수 KB)
3. 플레이어: 필요한 콘텐츠 목록 확인
4. 플레이어: 각 콘텐츠를 R2에서 1회 다운로드 → 로컬 저장
5. 플레이어: 이후 100% 로컬에서 재생 (네트워크 불필요)
6. 플레이어: 서버와는 상태보고 + 스크린샷만 통신 (수 KB/분)
```

**이 방식은 삼성 매직인포와 동일** — 콘텐츠를 디바이스에 미리 배포(push)하고 로컬 재생

### 4.4 매장 로컬 서버 (선택적, 대형 매장 Phase 3 이후)

대형 판매점(디바이스 10대 이상)의 경우:

```
┌─────────┐                ┌──────────────┐        ┌─────────┐
│ 본사서버  │ ── 동기화 ──→  │ 매장 로컬서버  │ ──LAN──→│ 디바이스 │ x10
│          │    (1회)       │ (미니 PC)    │        └─────────┘
└─────────┘                └──────────────┘
                             R2에서 1회 다운 →
                             LAN으로 10대에 배포
```

### 4.5 콘텐츠 유형별 전략

| 콘텐츠 유형 | 저장 위치 | 전송 방식 | 비고 |
|------------|----------|----------|------|
| 이미지 (< 10MB) | R2 | 다운로드 → 로컬 캐시 | 트래픽 미미, 전송 무료 |
| 동영상 (> 10MB) | R2 | **사전 다운로드** → 로컬 재생 | 핵심! 스트리밍 안 함, 전송 무료 |
| HTML/URL 콘텐츠 | 없음 | 실시간 iframe 로드 | 외부 URL이므로 R2 무관 |
| 레이아웃 HTML | R2 | 다운로드 → 로컬 캐시 | 용량 작음 |
| 오디오 | R2 | 다운로드 → 로컬 캐시 | |

### 4.6 현장 DID 설치 구성

#### DID 디스플레이 + 재생 장치

DID 모니터는 화면만 표시하는 장치이므로 콘텐츠를 재생할 **별도 장치**가 반드시 필요합니다.

```
┌─────────────┐     HDMI      ┌──────────────┐
│  미니 PC     │ ───────────→  │  DID 모니터   │
│  (재생 장치)  │               │  (화면만 표시) │
│              │               │              │
│ - 플레이어앱  │               │ 55인치 세로형  │
│ - 콘텐츠 캐시 │               │              │
│ - WiFi/LAN  │               │              │
└─────────────┘               └──────────────┘
```

#### 재생 장치 옵션

| 방식 | 장치 예시 | 가격대 | 장점 | 단점 |
|------|----------|--------|------|------|
| **미니 PC** (권장) | Beelink, Intel NUC | 15~30만원 | 성능 우수, Electron 앱 | 별도 구매 |
| **스틱 PC** | Intel Compute Stick | 10~20만원 | HDMI 직접 연결, 소형 | 발열, 성능 제한 |
| **안드로이드 셋톱** | Fire TV Stick, 미박스 | 5~10만원 | 저렴 | 웹앱만, 제한적 |
| **SoC 내장형** | 삼성 SSSP, LG webOS | 추가비용 없음 | 별도 장치 불필요 | 특정 제조사 종속 |
| **라즈베리파이** | RPi 4/5 | 5~10만원 | 초저렴, 리눅스 | 초기 설정 필요 |

#### 전체 시스템 구성도

```
                         ☁️ 클라우드
    ┌──────────────────────────────────────────────────┐
    │   본사 서버 (VueSign API + DB)                    │
    │   + Cloudflare R2 (파일 저장, 전송 무료)           │
    └────────────────────┬─────────────────────────────┘
                         │ 인터넷
          ┌──────────────┼──────────────┐
          │              │              │
    ━━━━━━▼━━━━━━  ━━━━━▼━━━━━━  ━━━━━▼━━━━━━
    ┃  A업체      ┃ ┃  B업체     ┃ ┃  C업체     ┃
    ┃ (카페체인)   ┃ ┃ (의류매장)  ┃ ┃ (병원)     ┃
    ┃             ┃ ┃            ┃ ┃            ┃
    ┃  강남점     ┃ ┃  홍대점    ┃ ┃  로비      ┃
    ┃  [PC]→[DID] ┃ ┃  [PC]→[DID]┃ ┃  [PC]→[DID]┃
    ┃  [PC]→[DID] ┃ ┃            ┃ ┃  [PC]→[DID]┃
    ┃             ┃ ┃  강남점    ┃ ┃            ┃
    ┃  홍대점     ┃ ┃  [PC]→[DID]┃ ┗━━━━━━━━━━━┛
    ┃  [PC]→[DID] ┃ ┃  [PC]→[DID]┃
    ┗━━━━━━━━━━━━┛ ┗━━━━━━━━━━━━┛

    [PC] = 미니PC (플레이어 앱 설치, R2에서 콘텐츠 1회 다운로드)
    [DID] = 디스플레이 모니터 (HDMI 연결, 화면만 표시)
```

#### 납품 ~ 운영 흐름

```
[납품 시]
1. 업체에 DID 모니터 + 미니 PC 세트 설치
2. 미니 PC에 플레이어 앱 설치 (Electron 또는 Chrome 키오스크)
3. 등록 코드 입력 → 본사 서버에 자동 연결 + 테넌트에 할당
4. 부팅 시 자동 실행 설정

[운영 시]
1. 업체 담당자: PC/폰에서 본사 서버 웹사이트 접속 (관리 화면)
2. 콘텐츠 업로드 → R2에 저장
3. 플레이리스트/스케줄 설정 → 배포 버튼
4. 디바이스가 R2에서 콘텐츠 1회 다운로드 → 로컬 재생
5. 이후 콘텐츠 변경 없으면 서버 통신 = 상태보고만 (수 KB/분)
```

### 4.4 다운로드 매니저 (플레이어)

```typescript
// 플레이어의 콘텐츠 다운로드 매니저 개념
interface DownloadManager {
  // 스케줄 수신 시 필요한 콘텐츠 목록 추출
  getRequiredContent(schedule: ScheduleEntry): ContentItem[]

  // 로컬 캐시에 없는 콘텐츠만 필터링
  getMissingContent(required: ContentItem[]): ContentItem[]

  // 백그라운드 다운로드 (우선순위 큐)
  downloadQueue: PriorityQueue<DownloadTask>

  // 다운로드 상태를 서버에 보고
  reportProgress(deviceId: string, progress: DownloadProgress): void

  // 로컬 스토리지 관리 (LRU 캐시)
  evictOldContent(maxSizeGB: number): void
}

interface DownloadProgress {
  totalFiles: number
  downloadedFiles: number
  totalBytes: number
  downloadedBytes: number
  status: 'downloading' | 'complete' | 'error'
  errors: string[]
}
```

### 4.5 콘텐츠 배포 상태 추적

서버에서 각 디바이스의 콘텐츠 다운로드 상태를 추적:

```
스케줄 배포 → 디바이스별 상태:
  ┌──────────────┬───────────┬──────────┐
  │ 디바이스      │ 상태      │ 진행률    │
  ├──────────────┼───────────┼──────────┤
  │ 강남점-1호기  │ ✅ 완료   │ 100%     │
  │ 강남점-2호기  │ 🔄 다운로드│ 67%      │
  │ 홍대점-1호기  │ ⏳ 대기   │ 0%       │
  │ 홍대점-2호기  │ ❌ 실패   │ 45%      │
  └──────────────┴───────────┴──────────┘
```

---

## 5. 플레이어 아키텍처 개선

### 5.1 현재 vs V2

| 항목 | V1 (현재) | V2 (목표) |
|------|----------|----------|
| 실행 방식 | 웹 브라우저 탭 | 웹앱 또는 Electron 래퍼 |
| 콘텐츠 | 서버에서 실시간 스트리밍 | 사전 다운로드 → 로컬 재생 |
| 오프라인 | 부분 지원 (IndexedDB) | 완전 오프라인 재생 |
| 업데이트 | Vite HMR | 자동 업데이트 (Electron) |
| 시스템 제어 | 불가 (브라우저 제한) | 전원/볼륨/밝기 OS 제어 |
| 저장 용량 | ~50MB (IndexedDB 제한) | 수 GB (로컬 파일시스템) |
| 스케줄링 | 서버 의존 | 로컬 스케줄러 + 서버 동기화 |

### 5.2 Electron 래퍼 (Phase 2)

```
┌─────────────────────────────────────────────┐
│ Electron 앱                                  │
│  ┌───────────────────────────────────────┐   │
│  │ Chromium (현재 웹 플레이어 그대로)       │   │
│  │  - React 앱                           │   │
│  │  - Socket.IO 통신                     │   │
│  └───────────────────────────────────────┘   │
│                                              │
│  ┌───────────────────────────────────────┐   │
│  │ Node.js Main Process (새로 추가)       │   │
│  │  - 파일시스템 콘텐츠 캐시              │   │
│  │  - OS 시스템 제어 (전원, 볼륨 등)       │   │
│  │  - 자동 업데이트                       │   │
│  │  - 부팅 시 자동 실행                    │   │
│  │  - 키오스크 모드 (전체화면 고정)         │   │
│  └───────────────────────────────────────┘   │
└─────────────────────────────────────────────┘
```

**장점**:
- 현재 웹 플레이어 코드를 거의 그대로 재사용
- 파일시스템 접근으로 대용량 콘텐츠 캐시 가능
- OS 레벨 제어 (전원 on/off, 스크린세이버 차단 등)
- 자동 업데이트 (electron-updater)
- 키오스크 모드 (사용자가 창을 닫지 못하게)

**웹 모드도 유지**: Electron 없이 브라우저에서도 동작 (기능 제한적)

### 5.3 로컬 스케줄 엔진

```
현재:
  서버가 스케줄 데이터 전송 → 플레이어가 매분 체크 → 활성 스케줄 재생

V2:
  서버가 스케줄 데이터 전송 → 플레이어가 로컬 DB에 저장
  → 로컬 스케줄 엔진이 독립적으로 재생 관리
  → 서버 연결 끊겨도 스케줄대로 정상 재생
  → 서버 재연결 시 변경사항만 동기화 (delta sync)
```

---

## 6. 과금 및 라이선스 시스템

### 6.1 플랜 구조

```
┌─────────────────────────────────────────────────────────────┐
│                        요금 플랜                              │
├───────────┬───────────┬───────────┬────────────────────────┤
│  Starter  │  Business │ Enterprise│  Custom                 │
├───────────┼───────────┼───────────┼────────────────────────┤
│ 디바이스   │           │           │                        │
│  최대 5대  │  최대 30대 │ 최대 200대│  협의                  │
├───────────┼───────────┼───────────┼────────────────────────┤
│ 스토리지   │           │           │                        │
│  5 GB     │  50 GB    │  500 GB   │  협의                  │
├───────────┼───────────┼───────────┼────────────────────────┤
│ 매장 수    │           │           │                        │
│  2개      │  10개     │  무제한    │  협의                  │
├───────────┼───────────┼───────────┼────────────────────────┤
│ 사용자     │           │           │                        │
│  3명      │  15명     │  무제한    │  협의                  │
├───────────┼───────────┼───────────┼────────────────────────┤
│ 레이아웃   │           │           │                        │
│  기본형만  │  무제한    │  무제한    │  무제한               │
├───────────┼───────────┼───────────┼────────────────────────┤
│ 콘텐츠승인 │  ❌       │  ✅       │  ✅                   │
│ 워크플로   │           │           │                        │
├───────────┼───────────┼───────────┼────────────────────────┤
│ API 접근   │  ❌       │  ✅       │  ✅                   │
├───────────┼───────────┼───────────┼────────────────────────┤
│ 감사로그   │  30일     │  90일     │  1년                   │
├───────────┼───────────┼───────────┼────────────────────────┤
│ 지원      │  이메일    │ 이메일+채팅│ 전담 매니저            │
├───────────┼───────────┼───────────┼────────────────────────┤
│ 월 요금    │  3만원    │  15만원    │  협의                  │
│ (디바이스당)│  /대     │  /대 기본  │                        │
└───────────┴───────────┴───────────┴────────────────────────┘
```

### 6.2 과금 모델

```typescript
interface Subscription {
  id: string
  tenantId: string
  planId: string           // starter | business | enterprise | custom

  // 기간
  billingCycle: 'monthly' | 'yearly'  // 연간 20% 할인
  startDate: Date
  endDate: Date
  trialEndDate?: Date      // 14일 무료 체험

  // 사용량
  maxDevices: number
  maxStorageGB: number
  maxUsers: number
  maxStores: number

  // 현재 사용량
  currentDevices: number
  currentStorageGB: number
  currentUsers: number
  currentStores: number

  // 상태
  status: 'trial' | 'active' | 'past_due' | 'cancelled' | 'suspended'

  // 결제
  paymentMethod?: PaymentMethod
  nextBillingDate: Date
  lastPaymentDate?: Date
  lastPaymentAmount?: number
}
```

### 6.3 사용량 초과 처리

```
사용량 체크 시점:
  - 디바이스 등록 시 → maxDevices 체크
  - 콘텐츠 업로드 시 → maxStorageGB 체크
  - 사용자 생성 시 → maxUsers 체크
  - 매장 생성 시 → maxStores 체크

초과 시 동작:
  1. 소프트 리밋: 80% 도달 → 관리자에게 알림
  2. 하드 리밋: 100% 도달 → 추가 등록 차단 + 업그레이드 안내
  3. 기존 서비스: 정상 작동 (이미 등록된 디바이스는 계속 재생)

구독 만료 시:
  1. D-7: 이메일 알림
  2. D-1: 대시보드 경고 배너
  3. D+0: 관리 기능 제한 (콘텐츠 수정 불가)
  4. D+7: 그레이스 기간 — 디바이스는 마지막 스케줄 계속 재생
  5. D+30: 디바이스 기본 화면 전환 + 데이터 보존 (삭제 안 함)
  6. D+90: 데이터 삭제 경고
```

### 6.4 라이선스 키 시스템

온프레미스 배포 고객을 위한 오프라인 라이선스:

```
라이선스 키 구조:
  SF-{PLAN}-{DEVICES}-{EXPIRY}-{CHECKSUM}
  예: SF-BIZ-030-20270401-A3F2B1

발급 방식:
  1. 온라인: 대시보드에서 자동 발급 + 활성화
  2. 오프라인: 라이선스 포털에서 키 생성 → 수동 입력

검증:
  - 서버 시작 시 로컬 라이선스 파일 검증
  - 온라인 시 주기적으로 라이선스 서버와 동기화 (7일 주기)
  - 오프라인 허용: 최대 30일 (이후 경고)
```

---

## 7. 데이터베이스 스키마 변경

### 7.1 새로운 모델

```prisma
// ─── 테넌트 (업체) ─────────────────────────────────

model Tenant {
  id            String    @id @default(uuid())
  name          String                          // "카페베네"
  slug          String    @unique               // "cafebene" (서브도메인용)
  logo          String?                         // 로고 URL
  brandColor    String?   @default("#3B82F6")
  isActive      Boolean   @default(true)

  // 연락처
  contactName   String?
  contactEmail  String?
  contactPhone  String?
  address       String?

  // 설정
  settings      String?   @default("{}")        // JSON
  timezone      String    @default("Asia/Seoul")

  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  // Relations
  subscription  Subscription?
  users         User[]
  stores        Store[]
  devices       Device[]
  content       Content[]
  playlists     Playlist[]
  layouts       Layout[]
  schedules     Schedule[]
  auditLogs     AuditLog[]
  sharedContent TenantSharedContent[]
}

// ─── 매장 ─────────────────────────────────────────

model Store {
  id          String    @id @default(uuid())
  tenantId    String
  name        String                            // "강남점"
  address     String?
  phone       String?
  managerId   String?                           // STORE_MANAGER 사용자
  isActive    Boolean   @default(true)
  settings    String?   @default("{}")

  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  tenant      Tenant    @relation(fields: [tenantId], references: [id])
  manager     User?     @relation("StoreManager", fields: [managerId], references: [id])
  devices     Device[]
}

// ─── 구독 / 과금 ──────────────────────────────────

model Subscription {
  id              String    @id @default(uuid())
  tenantId        String    @unique
  planId          String                        // starter | business | enterprise

  billingCycle    String    @default("monthly")  // monthly | yearly
  startDate       DateTime
  endDate         DateTime
  trialEndDate    DateTime?

  maxDevices      Int
  maxStorageGB    Int
  maxUsers        Int
  maxStores       Int

  status          String    @default("trial")   // trial | active | past_due | cancelled | suspended

  // 결제 정보 (별도 결제 시스템 연동)
  externalCustomerId  String?                   // Stripe/토스 고객 ID
  externalSubId       String?                   // 외부 구독 ID

  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  tenant          Tenant    @relation(fields: [tenantId], references: [id])
  invoices        Invoice[]
}

model Invoice {
  id              String    @id @default(uuid())
  subscriptionId  String
  amount          Int                           // 원 단위
  currency        String    @default("KRW")
  status          String    @default("pending") // pending | paid | failed | refunded
  issuedAt        DateTime  @default(now())
  paidAt          DateTime?
  dueDate         DateTime
  description     String?

  subscription    Subscription @relation(fields: [subscriptionId], references: [id])
}

// ─── 공유 콘텐츠 라이브러리 ──────────────────────────

model SharedContentLibrary {
  id          String    @id @default(uuid())
  name        String
  contentId   String
  category    String?
  isActive    Boolean   @default(true)
  createdAt   DateTime  @default(now())

  content     Content   @relation(fields: [contentId], references: [id])
  tenants     TenantSharedContent[]
}

model TenantSharedContent {
  id          String    @id @default(uuid())
  tenantId    String
  libraryId   String
  addedAt     DateTime  @default(now())

  tenant      Tenant                @relation(fields: [tenantId], references: [id])
  library     SharedContentLibrary  @relation(fields: [libraryId], references: [id])

  @@unique([tenantId, libraryId])
}

// ─── 콘텐츠 배포 추적 ────────────────────────────────

model ContentDeployment {
  id          String    @id @default(uuid())
  deviceId    String
  contentId   String
  scheduleId  String?

  status      String    @default("pending")     // pending | downloading | complete | failed
  progress    Int       @default(0)             // 0-100
  fileSize    BigInt?
  downloadedBytes BigInt?
  errorMessage String?

  startedAt   DateTime?
  completedAt DateTime?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  device      Device    @relation(fields: [deviceId], references: [id])
  content     Content   @relation(fields: [contentId], references: [id])
}
```

### 7.2 기존 모델 변경

기존 모든 주요 모델에 `tenantId` 추가:

```prisma
model User {
  // 기존 필드 유지 +
  tenantId    String?                           // null = 슈퍼어드민
  role        String    @default("USER")        // SUPER_ADMIN | TENANT_ADMIN | STORE_MANAGER | USER | VIEWER
  storeId     String?                           // STORE_MANAGER인 경우 담당 매장

  tenant      Tenant?   @relation(fields: [tenantId], references: [id])
}

model Device {
  // 기존 필드 유지 +
  tenantId    String
  storeId     String?                           // 매장 소속

  tenant      Tenant    @relation(fields: [tenantId], references: [id])
  store       Store?    @relation(fields: [storeId], references: [id])
  deployments ContentDeployment[]
}

model Content {
  // 기존 필드 유지 +
  tenantId    String

  // 파일 저장 경로 변경: /{tenantId}/images/uuid.jpg
  tenant      Tenant    @relation(fields: [tenantId], references: [id])
}

// Playlist, Layout, Schedule 모두 동일하게 tenantId 추가
```

---

## 8. API 설계 변경

### 8.1 슈퍼어드민 전용 API

```
POST   /api/admin/tenants              테넌트 생성
GET    /api/admin/tenants              전체 테넌트 목록
GET    /api/admin/tenants/:id          테넌트 상세
PUT    /api/admin/tenants/:id          테넌트 수정
DELETE /api/admin/tenants/:id          테넌트 비활성화
GET    /api/admin/tenants/:id/usage    사용량 조회

POST   /api/admin/subscriptions        구독 생성/변경
GET    /api/admin/subscriptions        전체 구독 현황
GET    /api/admin/invoices             전체 청구서

GET    /api/admin/dashboard            플랫폼 전체 대시보드
GET    /api/admin/devices/overview     전체 디바이스 현황
```

### 8.2 테넌트 미들웨어

```javascript
// 모든 /api/* 요청에 적용 (admin 제외)
const tenantMiddleware = async (req, res, next) => {
  // 슈퍼어드민은 tenantId 필터 안 함
  if (req.user.role === 'SUPER_ADMIN') {
    req.tenantId = req.query.tenantId || null  // 특정 테넌트 조회 가능
    return next()
  }

  // 일반 사용자는 자기 테넌트만
  req.tenantId = req.user.tenantId
  if (!req.tenantId) {
    return res.status(403).json({ error: '테넌트에 소속되지 않은 사용자입니다' })
  }

  // 구독 상태 체크
  const subscription = await getSubscription(req.tenantId)
  if (subscription.status === 'suspended') {
    return res.status(403).json({ error: '구독이 정지되었습니다' })
  }

  next()
}
```

### 8.3 매장 권한 미들웨어

```javascript
// STORE_MANAGER인 경우 자기 매장 디바이스만 접근
const storeMiddleware = async (req, res, next) => {
  if (req.user.role !== 'STORE_MANAGER') return next()

  const userStoreId = req.user.storeId
  // 디바이스 접근 시: 해당 디바이스가 자기 매장 소속인지 체크
  // 스케줄 접근 시: 해당 스케줄의 대상 디바이스가 자기 매장인지 체크
  req.storeFilter = { storeId: userStoreId }
  next()
}
```

### 8.4 콘텐츠 배포 API (신규)

```
POST   /api/content/:id/deploy           콘텐츠를 디바이스에 사전 배포
GET    /api/deployments                   배포 현황 목록
GET    /api/deployments/:deviceId         디바이스별 배포 상태
PUT    /api/deployments/:id/retry         실패한 배포 재시도

// 플레이어용 (인증 없음)
GET    /api/player/:deviceId/manifest     다운로드 필요한 콘텐츠 매니페스트
POST   /api/player/:deviceId/download-complete  다운로드 완료 보고
```

**매니페스트 응답 예시:**
```json
{
  "version": "2026-03-27T10:00:00Z",
  "contents": [
    {
      "id": "content-uuid-1",
      "url": "https://cdn.vuesign.co.kr/tenant-a/videos/abc123.mp4",
      "hash": "sha256:a1b2c3...",
      "size": 104857600,
      "type": "VIDEO",
      "priority": 1
    },
    {
      "id": "content-uuid-2",
      "url": "https://cdn.vuesign.co.kr/tenant-a/images/def456.jpg",
      "hash": "sha256:d4e5f6...",
      "size": 2048000,
      "type": "IMAGE",
      "priority": 2
    }
  ],
  "removeIds": ["old-content-id-1"]
}
```

---

## 9. 프론트엔드 변경

### 9.1 URL 구조 변경

```
현재:    https://vuesign.co.kr/dashboard
V2:      https://app.vuesign.co.kr/dashboard          (테넌트 관리자)
         https://admin.vuesign.co.kr/dashboard         (슈퍼어드민)

또는 서브도메인:
         https://cafebene.vuesign.co.kr/dashboard      (테넌트별)
```

### 9.2 새로운 페이지

**슈퍼어드민 전용:**
```
/admin/tenants           테넌트 목록 (업체 관리)
/admin/tenants/:id       테넌트 상세 (사용량, 설정, 구독)
/admin/subscriptions     구독/과금 관리
/admin/invoices          청구서 관리
/admin/shared-content    공유 콘텐츠 라이브러리
/admin/system            시스템 설정 (DB, 스토리지, CDN)
/admin/overview          플랫폼 전체 현황 대시보드
```

**테넌트 관리자:**
```
/stores                  매장 목록
/stores/:id              매장 상세 (소속 디바이스, 담당자)
/billing                 구독/결제 정보
/billing/invoices        청구서 이력
/settings/brand          브랜딩 설정 (로고, 컬러)
/deployments             콘텐츠 배포 현황
```

### 9.3 대시보드 개선

**슈퍼어드민 대시보드:**
```
┌────────────────────────────────────────────────────┐
│  전체 현황                                          │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐    │
│  │ 12   │ │ 87   │ │ 74   │ │ 1.2TB│ │ 15   │    │
│  │테넌트 │ │디바이스│ │온라인 │ │스토리지│ │알림   │    │
│  └──────┘ └──────┘ └──────┘ └──────┘ └──────┘    │
│                                                    │
│  테넌트별 현황                    매출 추이          │
│  ┌──────────────────┐  ┌────────────────────┐     │
│  │ 카페베네  30대 ✅  │  │  📈 월 매출 차트    │     │
│  │ ABC의류  15대 ⚠️  │  │                    │     │
│  │ 호텔XYZ  42대 ✅  │  │                    │     │
│  └──────────────────┘  └────────────────────┘     │
└────────────────────────────────────────────────────┘
```

**테넌트 대시보드:**
```
┌────────────────────────────────────────────────────┐
│  내 매장 현황                                       │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐              │
│  │ 5    │ │ 12   │ │ 11   │ │ 2.1GB│              │
│  │매장   │ │디바이스│ │온라인 │ │사용량 │              │
│  └──────┘ └──────┘ └──────┘ └──────┘              │
│                                                    │
│  매장별 상태                   콘텐츠 배포 현황       │
│  ┌──────────────────┐  ┌────────────────────┐     │
│  │ 📍강남점  3대 ✅  │  │  3/5 배포 완료      │     │
│  │ 📍홍대점  2대 ✅  │  │  ████████░░  67%   │     │
│  │ 📍부산점  2대 ⚠️  │  │  2건 실패 → 재시도  │     │
│  └──────────────────┘  └────────────────────┘     │
└────────────────────────────────────────────────────┘
```

---

## 10. 보안 강화

### 10.1 인증 개선

| 항목 | V1 | V2 |
|------|----|----|
| 인증 방식 | JWT (7일 만료) | JWT + Refresh Token (AT: 15분, RT: 7일) |
| 비밀번호 | bcrypt | bcrypt + 비밀번호 정책 (최소 8자, 대소문자+숫자+특수문자) |
| 2FA | 없음 | TOTP (Google Authenticator) 선택적 |
| 세션 관리 | 없음 | 활성 세션 목록 + 강제 로그아웃 |
| IP 제한 | 없음 | 테넌트별 허용 IP 대역 설정 |
| 로그인 시도 | 무제한 | 5회 실패 → 15분 잠금 |

### 10.2 API 보안

```
- Rate limiting: 테넌트별 API 호출 제한 (1000 req/min)
- CORS: 테넌트 서브도메인만 허용
- CSP: 콘텐츠 보안 정책 헤더
- API Key: 외부 연동용 API 키 발급 (Enterprise 플랜)
- Webhook: 이벤트 알림 (디바이스 오프라인, 배포 완료 등)
```

### 10.3 데이터 보안

```
- 전송: HTTPS 필수 (Let's Encrypt 자동 갱신)
- 저장: 민감 데이터 AES-256 암호화 (결제 정보 등)
- 파일: 테넌트별 스토리지 격리 (S3 prefix 또는 별도 버킷)
- 백업: 일일 자동 백업 + 30일 보존
- 감사: 모든 관리 행위 감사 로그 기록
```

### 10.4 플레이어 보안

```
- 디바이스 등록 시 1회성 토큰 발급 → 이후 디바이스 인증서로 통신
- 콘텐츠 다운로드 URL: Signed URL (15분 만료)
- 스크린샷 업로드: 디바이스 인증 필수
- 원격 제어: 테넌트 관리자만 해당 테넌트 디바이스 제어 가능
```

---

## 11. 운영 & 모니터링

### 11.1 인프라 구성 (프로덕션)

```
┌──────────────────────────────────────────────────────────┐
│  Reverse Proxy (Nginx / Caddy)                           │
│  - SSL 종단                                               │
│  - 서브도메인 라우팅                                       │
│  - 정적 파일 캐싱                                         │
│  - Rate limiting                                         │
└──────────┬───────────────────────┬───────────────────────┘
           │                       │
    ┌──────▼──────┐        ┌──────▼──────┐
    │ API 서버 #1  │        │ API 서버 #2  │    (수평 확장)
    │ (Node.js)   │        │ (Node.js)   │
    └──────┬──────┘        └──────┬──────┘
           │                       │
    ┌──────▼───────────────────────▼──────┐
    │          PostgreSQL (Primary)        │
    │          + Read Replica             │
    └──────┬──────────────────────────────┘
           │
    ┌──────▼──────┐    ┌──────────────┐
    │  Redis      │    │  S3 / MinIO  │
    │  (캐시+세션) │    │  (파일 저장)  │
    └─────────────┘    └──────────────┘
```

### 11.2 Socket.IO 확장

다중 서버 환경에서 Socket.IO 동기화:

```
API 서버 #1  ←─ Redis Adapter ─→  API 서버 #2
    │                                   │
    ├─ 디바이스 A                       ├─ 디바이스 C
    └─ 디바이스 B                       └─ 디바이스 D

# Socket.IO Redis Adapter로 서버 간 이벤트 동기화
# 어느 서버에 연결된 디바이스든 메시지 전달 가능
```

### 11.3 헬스 체크 & 알림

```
모니터링 항목:
  - 서버 CPU/메모리/디스크 사용률
  - API 응답 시간 (P50, P95, P99)
  - 데이터베이스 커넥션 풀 상태
  - Socket.IO 연결 수
  - 디바이스 온라인/오프라인 비율
  - CDN 트래픽 사용량
  - 스토리지 사용량 (테넌트별)
  - 콘텐츠 배포 실패율

알림 채널:
  - 이메일 (필수)
  - Slack / Discord / Telegram webhook
  - SMS (긴급: 서버 다운, 전체 오프라인 등)
```

### 11.4 로깅

```
# 구조화 로깅 (JSON 형식)
{
  "timestamp": "2026-03-27T10:30:00.000Z",
  "level": "info",
  "service": "api",
  "tenantId": "tenant-uuid",
  "userId": "user-uuid",
  "action": "schedule:deploy",
  "target": "schedule-uuid",
  "deviceCount": 5,
  "duration_ms": 230,
  "ip": "1.2.3.4"
}

# 로그 저장: 파일 → Loki / ELK 스택 (검색·분석)
# 보존 기간: 최소 90일 (Enterprise: 1년)
```

---

## 12. 개발 로드맵

### Phase 1: 기반 인프라 (4~6주)

```
우선순위: ★★★ 필수

□ PostgreSQL 마이그레이션 (SQLite → PostgreSQL)
□ Tenant, Store, Subscription 모델 추가
□ 테넌트 미들웨어 구현 (모든 쿼리에 tenantId 자동 필터)
□ 사용자 역할 체계 리팩토링 (5단계 역할)
□ JWT → Access Token + Refresh Token 전환
□ 슈퍼어드민 로그인 / 테넌트 생성 API
□ 테넌트 관리자 로그인 (테넌트 컨텍스트 주입)
□ 매장(Store) CRUD API
□ 기존 API에 tenantId 필터 적용 (Content, Playlist, Schedule, Device, Layout)
□ 프론트엔드: 로그인 → 역할별 라우팅
```

### Phase 2: 콘텐츠 배포 최적화 (3~4주)

```
우선순위: ★★★ 필수

□ S3/MinIO 오브젝트 스토리지 연동 (업로드 시 S3에 저장)
□ CDN Signed URL 생성 (CloudFront / Cloudflare)
□ 콘텐츠 매니페스트 API (/api/player/:deviceId/manifest)
□ 플레이어: 콘텐츠 사전 다운로드 매니저 구현
□ 플레이어: 다운로드 진행률 서버 보고
□ 서버: ContentDeployment 모델로 배포 상태 추적
□ 프론트엔드: 콘텐츠 배포 현황 페이지
□ 파일 해시(SHA-256) 기반 중복 다운로드 방지
□ LRU 캐시: 오래된 콘텐츠 자동 삭제 (디바이스 저장 공간 관리)
```

### Phase 3: 과금 시스템 (3~4주)

```
우선순위: ★★☆ 중요

□ 플랜 정의 (Starter / Business / Enterprise)
□ Subscription 모델 + API
□ 사용량 제한 미들웨어 (디바이스, 스토리지, 사용자 수)
□ 구독 상태별 기능 제한 로직
□ 청구서(Invoice) 생성 + 이메일 발송
□ 결제 연동 (토스페이먼츠 또는 Stripe)
□ 프론트엔드: 구독/결제 페이지 (테넌트 관리자용)
□ 슈퍼어드민: 전체 구독/매출 대시보드
□ 무료 체험(Trial) 14일 자동 생성
□ 구독 만료 시 그레이스 기간 + 기능 제한 로직
```

### Phase 4: 플레이어 고도화 (4~6주)

```
우선순위: ★★☆ 중요

□ Electron 래퍼 프로젝트 세팅
□ 로컬 파일시스템 캐시 (IndexedDB → fs, 수 GB 지원)
□ 키오스크 모드 (전체화면 고정, Esc 차단)
□ 부팅 시 자동 실행
□ 자동 업데이트 (electron-updater)
□ OS 레벨 제어 (화면 밝기, 볼륨, 전원 스케줄)
□ 로컬 스케줄 엔진 (서버 연결 없이도 스케줄 실행)
□ 디바이스 등록 토큰 방식 (QR코드 또는 6자리 코드)
□ 설치 위저드 (서버 주소 + 등록 코드 입력)
□ 웹 모드 하위 호환 유지
```

### Phase 5: 보안 & 운영 (2~3주)

```
우선순위: ★☆☆ 개선

□ 2FA (TOTP) 구현
□ 비밀번호 정책 적용
□ 로그인 시도 제한 + 계정 잠금
□ API Rate Limiting (테넌트별)
□ 감사 로그 강화 (모든 CUD 작업)
□ 구조화 로깅 (Winston/Pino)
□ Docker Compose 프로덕션 구성
□ 자동 백업 스크립트
□ 헬스 체크 엔드포인트
□ Nginx 리버스 프록시 설정 (SSL, 서브도메인)
```

### Phase 6: 고급 기능 (지속)

```
우선순위: ☆☆☆ 확장

□ 콘텐츠 승인 워크플로 (작성 → 검토 → 승인 → 배포)
□ 공유 콘텐츠 라이브러리 (본사 → 전 매장 배포)
□ 태그 기반 동적 플레이리스트
□ 긴급 메시지 기능 (즉시 전 디바이스에 표시)
□ 배경 음악 스케줄 (영상 위에 별도 오디오 레이어)
□ 매장 로컬 서버 옵션 (대형 매장용)
□ Webhook API (이벤트 알림)
□ 외부 연동 API (서드파티 앱에서 콘텐츠 관리)
□ 통계 리포트 자동 생성 + 이메일 발송
□ A/B 테스트 (동일 시간대에 다른 콘텐츠 성과 비교)
```

---

## 13. 추가 권장 기능

아래는 상용 사이니지 솔루션에서 경쟁력을 갖추기 위해 추가로 권장하는 기능입니다.

### 13.1 긴급 메시지 시스템 ⭐

```
관리자가 즉시 전 디바이스(또는 특정 매장)에 긴급 메시지 표시
- 재난 안내, 긴급 공지, 임시 휴무 등
- 현재 재생 중인 콘텐츠 위에 오버레이 또는 완전 대체
- 만료 시간 설정 가능
- 예: "오늘 15시 이후 임시 휴무합니다"

구현: Socket.IO로 즉시 전송 → 플레이어에서 최우선 표시
```

### 13.2 콘텐츠 승인 워크플로

```
매장 직원이 콘텐츠 업로드 → 본사 검토 → 승인 후 배포 가능

상태: DRAFT → PENDING_REVIEW → APPROVED → REJECTED
- 브랜드 가이드라인 준수 여부 확인
- 본사에서 일괄 승인/반려 + 코멘트
- Enterprise 플랜 기능
```

### 13.3 디바이스 자동 프로비저닝

```
현재: 플레이어에서 서버 URL + 디바이스 이름 수동 입력
개선:
  1. 관리자가 "디바이스 등록 코드" 생성 (6자리, 24시간 유효)
  2. 플레이어 설치 후 코드만 입력
  3. 자동으로 테넌트 + 매장에 연결
  4. 기본 스케줄 자동 적용

  또는 QR코드 스캔 방식:
  - 관리자가 QR 생성 → 플레이어 카메라로 스캔 → 자동 등록
```

### 13.4 디바이스 그룹 태그 & 필터

```
디바이스에 태그 부여: "1층", "엘리베이터앞", "세로형", "가로형"
스케줄 배포 시 태그 기반 대상 선택:
  - "1층" + "가로형" 디바이스에만 이 스케줄 배포
  - 매장별 + 태그별 조합 가능
```

### 13.5 콘텐츠 유효 기간

```
콘텐츠에 유효 시작일/종료일 설정:
  - 프로모션 콘텐츠: 3/1~3/31만 유효
  - 만료된 콘텐츠는 자동으로 플레이리스트에서 제외
  - 만료 예정 콘텐츠 알림 (D-3, D-1)
```

### 13.6 날씨/시간 기반 동적 콘텐츠 (RuleSet)

```
조건부 콘텐츠 표시:
  - 오전(09~12시) → 모닝 메뉴 표시
  - 오후(12~17시) → 런치 메뉴 표시
  - 저녁(17~22시) → 디너 메뉴 표시
  - 비 오는 날 → "우산 할인" 프로모션 자동 표시

구현: DataLink API 또는 외부 데이터 연동
```

### 13.7 실시간 데이터 연동 (DataLink)

```
외부 데이터 소스를 레이아웃에 실시간 표시:
  - RSS 뉴스 피드 → 하단 뉴스 티커
  - 날씨 API → 현재 날씨/기온 표시
  - 환율 API → 실시간 환율 표시
  - Google Sheets → 메뉴/가격표 실시간 반영
  - 사내 API → 재고현황, 대기인원 등

플레이어에서 주기적 polling 또는 Server-Sent Events
```

### 13.8 재생 증빙 리포트

```
광고 사이니지의 경우 광고주에게 "실제로 재생되었는지" 증빙 필요:
  - 디바이스별 콘텐츠 재생 로그 (시작시간, 종료시간, 정상완료 여부)
  - 스크린샷 기반 재생 증빙
  - 월간 리포트 자동 생성 (PDF)
  - 재생률: 예정 횟수 대비 실제 재생 횟수
```

### 13.9 화면 분할 프리뷰

```
관리자가 스케줄/레이아웃을 배포하기 전에:
  - 실제 디바이스 해상도에 맞춘 프리뷰
  - 시간대별 표시될 콘텐츠 시뮬레이션
  - "24시간 타임라인" 뷰에서 시간별 콘텐츠 확인
```

### 13.10 멀티 디스플레이 (비디오월)

```
여러 디바이스를 하나의 큰 화면처럼 사용:
  - 2x2, 3x3 등 매트릭스 구성
  - 하나의 콘텐츠를 분할하여 각 디바이스에 해당 영역 표시
  - 동기화 재생 (같은 시각에 같은 프레임)
```

### 13.11 원격 진단 & 유지보수

```
디바이스 문제 발생 시:
  - 원격 스크린샷 (현재 구현됨 ✅)
  - 원격 로그 수집 (플레이어 콘솔 로그 서버 전송)
  - 원격 재시작 명령
  - 디바이스 상태 이력 (CPU/메모리/디스크 사용률 추이)
  - 네트워크 상태 (핑, 대역폭 테스트)
  - 원격 설정 변경 (서버 URL 변경, 캐시 초기화 등)
```

### 13.12 화이트라벨 지원

```
리셀러/파트너사가 자기 브랜드로 판매 가능:
  - 로그인 화면 로고/컬러 커스터마이징
  - 플레이어 스플래시 화면 커스터마이징
  - 이메일 발신자 이름/주소 변경
  - 커스텀 도메인 지원

  예: 파트너사 "스마트사인" → smartsign.co.kr 도메인으로 서비스
      내부적으로는 VueSign 엔진 사용
```

### 13.13 모바일 앱 (관리자용)

```
관리자가 이동 중에도 관리 가능:
  - 디바이스 상태 확인 + 푸시 알림 (오프라인 디바이스)
  - 실시간 스크린샷 확인
  - 긴급 메시지 전송
  - 간단한 콘텐츠 업로드 (사진 촬영 → 즉시 업로드)
  - 스케줄 on/off 토글

기술: React Native 또는 PWA
```

---

## 부록: 상용 사이니지 비교

| 기능 | Samsung MagicINFO 9 | VueSign V1 | VueSign V2 (목표) |
|------|:---:|:---:|:---:|
| 멀티테넌트 | ✅ (조직) | ❌ | ✅ |
| 콘텐츠 사전배포 | ✅ | ❌ (스트리밍) | ✅ |
| 오프라인 재생 | ✅ | △ (부분) | ✅ |
| 디바이스 모니터링 | ✅ | ✅ | ✅ |
| 원격 제어 | ✅ (VNC 포함) | ✅ (기본) | ✅ |
| 레이아웃 편집기 | ✅ (Author) | ✅ | ✅ |
| 전환 효과 | ✅ | ✅ | ✅ |
| 스케줄링 | ✅ | ✅ | ✅ |
| 콘텐츠 승인 | ✅ | ❌ | ✅ |
| 비디오월 | ✅ | ❌ | △ (Phase 6) |
| RuleSet/조건부 | ✅ | ❌ | △ (Phase 6) |
| 재생 통계 | ✅ | △ | ✅ |
| 2FA | ✅ (OTP) | ❌ | ✅ |
| LDAP | ✅ | ❌ | △ (Enterprise) |
| 모바일 앱 | ✅ | ❌ | △ (Phase 6) |
| 과금 시스템 | ❌ (패키지 판매) | ❌ | ✅ |
| SaaS 모델 | △ (Cloud) | ❌ | ✅ |
| 가격 | 디바이스당 높음 | - | 경쟁력 있는 가격 |
| 설치 복잡도 | 높음 (Tomcat+DB) | 낮음 | 낮음 |
| 하드웨어 종속 | Samsung 디스플레이 | 없음 (웹 기반) | 없음 |

---

## 결론

VueSign V2의 핵심 차별점:

1. **SaaS 기반 과금**: 설치형이 아닌 월정액 서비스로 진입 장벽 낮춤
2. **하드웨어 무관**: 삼성 전용이 아닌, 웹 브라우저가 있는 모든 디바이스에서 작동
3. **콘텐츠 로컬 캐시**: 동영상도 1회 다운로드 후 로컬 재생 → 트래픽 비용 최소화
4. **멀티테넌트 + 매장관리**: 프랜차이즈 구조에 최적화된 계층형 관리
5. **간편한 설치**: Electron 앱 하나 설치하면 끝 (vs MagicINFO의 복잡한 서버 설치)
6. **경쟁력 있는 가격**: 삼성 MagicINFO 대비 합리적인 가격대
