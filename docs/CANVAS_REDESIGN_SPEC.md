# 캔버스/레이아웃 재설계 기획서

> **문서 버전:** 1.0
> **작성일:** 2026-04-09
> **상태:** 초안 (사용자 승인 대기)
> **대상 시스템:** VueSign (Backend / Frontend / Player)

---

## 0. TL;DR

- **현재 캔버스는 다른 사이니지 솔루션을 모방한 범용 그래픽 에디터**다. Fabric.js 기반으로 도형/화살표/선/페이지/애니메이션/Undo/버전 관리 등 사용자가 실제로는 거의 안 쓰는 기능이 80% 이상.
- **새 컨셉:** "사용자는 빈칸이 있는 배경 이미지만 만든다. 그 빈칸 위에 실시간으로 변하는 데이터(날씨/미세먼지)를 위젯으로 끌어다 놓는다." → **이미지 + 라이브 데이터 오버레이** 에디터로 단순화.
- **신규 위젯(한국향):** 오늘 날씨, 주간 날씨, 미세먼지. 데이터 소스는 **기상청 단기/중기예보 + 에어코리아**.
- **레이아웃 에디터:** 캔버스 너비가 800px로 하드코딩되어 있어 작음. **사용자가 자유롭게 리사이즈할 수 있게 변경.**
- **기존 자산:** 이미지 업로드, 좌표/스케일링, 플레이어 렌더링, Layout/Zone 모델, CustomFont — 모두 유지.

---

## 1. 배경 및 문제 정의

### 1.1 현재 캔버스가 가진 기능 (분석 결과)

| 카테고리 | 기능 | 사용자 평가 |
|---|---|---|
| **그리기 도구** | 텍스트, 사각형, 원, 삼각형, 직선, 화살표 | 사각형/원/삼각형/직선/화살표 → **불필요** |
| **이미지** | 업로드, 배치, fit(contain/cover/fill) | **유지** (핵심 자산) |
| **위젯(8종)** | Clock, Weather(OpenWeatherMap), RSS, QRCode, Video, Webpage, Spreadsheet, Chart | 거의 다 **불필요**. 한국향 날씨/미세먼지로 대체 |
| **편집 보조** | Undo/Redo, 다중 선택, 잠금/숨김, 복제, 정렬, 회전, 투명도 | 단순 에디터에는 과도. **선택/이동/삭제만 유지** |
| **애니메이션** | Entrance/Loop/Exit, easing, delay | **불필요** (정적 사이니지) |
| **페이지** | 다중 페이지 슬라이드, 페이지 전환, duration | **불필요** (1캔버스 = 1화면) |
| **버전 관리** | ContentVersion 모델, 히스토리 패널 | **불필요** |
| **템플릿** | Save/Load, 카테고리, 사용 횟수 | **불필요** (현 단계) |
| **커스텀 폰트** | tenant별 woff2 업로드 | **유지** |

### 1.2 사용자가 진짜 원하는 것

> "HTML 편집자가 없고 그림 파일만 만들 수 있다고 가정하고, 빈칸이 있는 배경 그림 위에 실시간으로 변하는 데이터(날씨, 미세먼지)를 끌어다 놓고 저장하면, 키오스크가 그 빈칸만 진짜 데이터로 채워서 보여준다."

이 한 문장이 모든 설계의 기준이다.

### 1.3 결과

- **"범용 그래픽 에디터" → "이미지 위 데이터 오버레이 에디터"** 로 컨셉 전환
- 도형/페이지/애니메이션/Undo/버전 등 80%+ 기능 제거
- 한국향 날씨/미세먼지 위젯 신규 개발
- 레이아웃 에디터의 캔버스 영역 리사이즈 가능하게

---

## 2. 핵심 컨셉

### 2.1 "Image-First" 캔버스

캔버스는 본질적으로 **하나의 배경 이미지**다. 사용자가 디자인 도구(Photoshop, Figma, 파워포인트 등)에서 만든 1920×1080(또는 세로) PNG/JPG를 통째로 업로드한다.

배경 이미지에는 **빈칸**이 있다 — 예를 들어 "현재 기온이 들어갈 자리", "PM10 수치가 들어갈 자리", "주간 날씨 7개가 들어갈 자리".

### 2.2 "Live Data Overlay" 위젯

사용자는 그 빈칸 위에 **데이터 위젯**을 드래그해서 위치를 잡는다. 위젯은 보이는 모양은 단순한 텍스트(또는 아이콘)지만, 플레이어가 렌더링할 때 백엔드에서 받은 실시간 데이터로 채워진다.

### 2.3 "WYSIWYG 미리보기"

에디터에서도 위젯에 **현재 위치 기준의 실제 데이터**를 미리 보여준다. 사용자는 디자인 시점에 폰트 크기/색상이 빈칸과 잘 맞는지 즉시 확인.

---

## 3. 사용자 시나리오 (Story)

### 시나리오 A — 매장 입구 키오스크용 날씨 화면 만들기

1. 디자이너가 Figma에서 매장 브랜드 컬러로 1920×1080 배경을 만든다.
   - "오늘 날씨" 글자 옆에 큰 아이콘 자리 (빈 사각형)
   - 그 아래 "00°C" 자리 (빈 텍스트)
   - 우측에 "최고/최저 00°/00°" 자리
   - 하단에 7일짜리 카드 7개 (빈 카드 7개)
2. PNG로 export 후 VueSign 캔버스 에디터에서 **"새 캔버스"** 클릭 → 1920×1080 + 가로 선택.
3. **배경으로 이미지 업로드** → 캔버스 전체를 덮는다.
4. 좌측 위젯 패널에서 **"오늘 날씨 아이콘"** 위젯을 드래그해서 빈 아이콘 자리에 놓고 크기를 맞춘다.
5. **"현재 기온"** 위젯을 드래그 → 빈 "00°C" 자리에 놓고 폰트 크기를 빈칸 크기에 맞춘다.
6. **"오늘 최고/최저"** 위젯을 드래그 → 우측 자리에 배치.
7. **"주간 날씨 카드"** 위젯을 드래그 → 하단에 배치 (하나의 위젯이 7일치를 가로로 표시).
8. 우측 패널에서 위젯의 **위치(서울/부산/...)**, **폰트 패밀리/크기/색상**, **단위(°C)** 설정.
9. 에디터 안에서 실제 서울 날씨가 미리 보임 → 잘 맞는지 확인.
10. **저장** → "여름 매장 날씨 v1"이라는 이름으로 Content에 저장.
11. 레이아웃 에디터로 이동, 새 레이아웃 생성, Zone 1개 추가, Zone에 방금 만든 캔버스를 할당.
12. 레이아웃을 디바이스/플레이리스트에 배포.
13. 키오스크에서 30분마다 자동 갱신되는 라이브 화면이 뜬다.

### 시나리오 B — 미세먼지 안내 화면

배경에 "오늘의 공기질" 디자인 + 빈칸 → "PM10 수치 위젯", "PM2.5 수치 위젯", "등급 라벨 위젯", "위치명 위젯" 4개를 얹어서 저장.

### 시나리오 C — 같은 디자인을 매장별로 다르게 (지역 오버라이드)

→ **Phase 2 기능 (3.4 참조)**. 1차 출시에서는 캔버스마다 위치를 고정한다.

---

## 4. 기능 명세

### 4.1 캔버스 에디터 (신규 단순 버전)

#### 4.1.1 캔버스 설정
- **크기:** 가로(1920×1080) / 세로(1080×1920) 2개 프리셋 + 사용자 정의 (px)
- **방향:** Landscape / Portrait
- **배경색:** 단색 (배경 이미지 없을 때 fallback)
- **다중 페이지: 제거** — 1캔버스 = 1화면

#### 4.1.2 추가 가능한 요소 (3종으로 축소)

| 종류 | 설명 | 비고 |
|---|---|---|
| **배경 이미지** | 캔버스 전체를 덮는 이미지 (1캔버스 1배경 권장) | fit: contain/cover/fill |
| **이미지** | 일반 오버레이 이미지 (로고 등) | 위치/크기/회전 |
| **위젯 (Widget)** | 라이브 데이터 위젯 | 4.2 참조 |

> **제거 대상:** Text(단독), Rect, Circle, Triangle, Line, Arrow, RSS, QRCode, Video, Webpage, Spreadsheet, Chart, Clock(2차 검토)

> **참고:** 단독 텍스트 요소도 1차 출시에서는 빼는 방향 권장. 사용자 의도("그림 파일만 만들 수 있다고 가정")에 따르면, 글자는 배경 이미지에 이미 그려져 있고 캔버스에서 글씨를 추가로 적을 일이 없다. 만약 "위치명만 동적으로 표시" 같은 케이스가 있다면 그건 위젯("위치 라벨" 위젯)으로 처리.

#### 4.1.3 편집 기능 (대폭 축소)

| 기능 | 유지 여부 |
|---|---|
| 선택 / 다중 선택 | 유지 (단일만, 다중은 제거) |
| 이동 (드래그) | 유지 |
| 리사이즈 | 유지 |
| 회전 | **제거** (수평 사이니지에 회전 거의 없음) |
| 삭제 (Del 키) | 유지 |
| 복제 (Ctrl+D) | 유지 |
| Undo/Redo | **제거** (1차) |
| 잠금/숨김 | **제거** |
| z-index 조정 (앞으로/뒤로) | 유지 |
| 정렬 도우미 (좌/중/우) | 신규 추가 (선택 사항) |
| 줌 (10%~300%) | 유지 |
| 그리드/스냅 | 신규 (5px 또는 1% 그리드, 토글) |

#### 4.1.4 우측 패널 (속성 편집)

- **공통:** X, Y, Width, Height (px 또는 %), z-index
- **이미지:** Source URL, Fit (contain/cover/fill), Opacity
- **위젯:** 위젯별 config (4.2 참조)

#### 4.1.5 좌측 패널 (요소 라이브러리)

탭 2개로 단순화:

1. **이미지 (Images)** — 업로드, 갤러리에서 선택
2. **위젯 (Widgets)** — 4.2의 위젯 카드 목록

> 기존의 "Templates" 탭, "Shapes" 탭, "Animations" 탭은 모두 제거.

#### 4.1.6 상단 바
- 캔버스 이름
- 크기 표시 (1920×1080)
- 줌 컨트롤
- 미리보기 버튼 (선택)
- **저장** (자동 저장 아님, 수동)
- 닫기

---

### 4.2 신규 위젯 명세 (Korea-First)

> 모든 위젯은 **위치(시/군/구)** 를 config로 받는다. 위치는 캔버스마다 고정 또는 "레이아웃 Zone에서 오버라이드 가능"(Phase 2).

#### 4.2.1 [날씨] 현재 날씨 아이콘 위젯
- **타입:** `weather.current.icon`
- **표시:** 날씨 상태에 해당하는 아이콘 (맑음/구름많음/흐림/비/소나기/눈)
- **데이터 소스:** 기상청 단기예보 `getVilageFcst` → SKY/PTY 코드 조합
- **Config:**
  - `location` (예: `{ sido: '서울', sigungu: '중구', nx: 60, ny: 127 }`)
  - `iconStyle` (filled / outlined / colorful) — 기본 colorful
  - `tintColor` (옵션, 단색 모드일 때만)
- **렌더링:** 단일 SVG/PNG 아이콘. 위젯 박스 크기에 맞춰 contain.
- **갱신:** 백엔드 캐시 30분 + 플레이어 5분마다 fetch

#### 4.2.2 [날씨] 현재 기온 위젯
- **타입:** `weather.current.temp`
- **표시:** `12°C` 형태 텍스트 1개
- **데이터 소스:** 기상청 단기예보 `TMP` (1시간 기온, 가장 가까운 미래 시각의 값)
- **Config:**
  - `location`
  - `unit` (`C` / `F`) — 기본 `C`
  - `showUnit` (bool) — 기본 true
  - `fontFamily`, `fontSize`, `fontWeight`, `color`, `textAlign`
- **갱신:** 30분

#### 4.2.3 [날씨] 오늘 최고/최저 위젯
- **타입:** `weather.today.minmax`
- **표시:** `↑18° ↓6°` 또는 사용자 정의 포맷
- **데이터 소스:** 기상청 단기예보 `TMX`(1500 기준), `TMN`(0600 기준)
- **Config:**
  - `location`
  - `format` (예: `↑{max}° ↓{min}°`, `최고 {max}° / 최저 {min}°`)
  - `fontFamily`, `fontSize`, `color`, `textAlign`
  - `separator` (옵션, 두 값 사이 구분자)
- **갱신:** 30분

#### 4.2.4 [날씨] 위치명 위젯
- **타입:** `weather.location.label`
- **표시:** `서울 중구` 등 위치 텍스트
- **데이터 소스:** Config에서 직접 (API 호출 없음)
- **Config:** `location`, `format` (`{sido}` / `{sido} {sigungu}`), 폰트 속성
- **이유:** 위치만 동적으로 보이기 위한 가벼운 위젯

#### 4.2.5 [날씨] 주간 날씨 위젯
- **타입:** `weather.weekly.cards`
- **표시:** 가로 또는 세로로 7일치 카드. 각 카드는 [요일/날짜, 아이콘, 최고°, 최저°]
- **데이터 소스:**
  - D0~D2: 기상청 단기예보
  - D3~D7: 기상청 중기예보 `getMidLandFcst` (날씨) + `getMidTa` (기온)
  - 백엔드에서 두 API 결과를 7일치 배열로 합쳐서 단일 응답 제공
- **Config:**
  - `location` (단기예보 격자, 중기 regIdLand, 중기 regIdTa 모두 매핑)
  - `direction` (`horizontal` / `vertical`)
  - `days` (5~7) — 기본 7
  - `iconStyle`
  - `fontFamily`, `fontSize`, `color`, `cardBgColor`, `cardBorderRadius`
  - `gap` (카드 간격 px)
- **렌더링:** 위젯 박스 크기 안에 자동 배치 (Flex)
- **갱신:** 6시간

#### 4.2.6 [미세먼지] PM 수치 위젯
- **타입:** `air.pm.value`
- **표시:** `42` (단위 옵션)
- **데이터 소스:** 에어코리아 `getMsrstnAcctoRltmMesureDnsty` (측정소 직접 호출)
- **Config:**
  - `location` (사전에 매핑된 측정소명 포함)
  - `pollutant` (`pm10` / `pm25`)
  - `showUnit` (bool, "㎍/㎥")
  - 폰트 속성
- **갱신:** 15분

#### 4.2.7 [미세먼지] 등급 라벨 위젯
- **타입:** `air.pm.grade`
- **표시:** `좋음` / `보통` / `나쁨` / `매우나쁨` 텍스트, 등급별 색상 자동 또는 사용자 지정
- **데이터 소스:** 에어코리아 응답의 `pm10Grade` / `pm25Grade` (1~4)
- **Config:**
  - `location`
  - `pollutant` (`pm10` / `pm25`)
  - `useGradeColor` (bool) — true면 등급 색상으로 자동 채움 (1=파랑, 2=초록, 3=주황, 4=빨강)
  - 폰트 속성
- **갱신:** 15분

#### 4.2.8 [미세먼지] 통합 카드 위젯 (옵션)
- **타입:** `air.pm.card`
- **표시:** PM10 + PM2.5 + 등급 + 위치를 한 카드에 통합
- **위 위젯들을 따로 배치하기 귀찮을 때 쓰는 편의 위젯**
- **Config:** 위치, 카드 스타일, 폰트 속성

---

### 4.3 레이아웃 에디터 개선

#### 4.3.1 현재 문제
- `LayoutEditorPage.tsx`에서 캔버스 영역이 **`CANVAS_WIDTH = 800px`로 하드코딩**되어 있다.
- 사용자가 "너무 작다"고 명시적으로 불만 제기.

#### 4.3.2 변경 사항
- 캔버스 컨테이너에 **사용자가 드래그로 리사이즈할 수 있는 핸들** 추가
- 또는 더 단순하게: **줌 컨트롤** (50% / 75% / 100% / 125% / 150%) + **"화면에 맞춤" 버튼**
- **권장:** 줌 + 화면 맞춤. 리사이즈 핸들보다 단순하고 종횡비 유지가 자동.
- 캔버스 컨테이너 크기는 **viewport에 반응형**으로 (창 크기 따라 자동 확대/축소)
- 사용자가 직접 픽셀 너비 입력도 가능 (`canvasDisplayWidth` localStorage 저장)
- 종횡비는 항상 `baseWidth/baseHeight` 기준으로 자동 계산

---

## 5. 데이터 모델 변경

### 5.1 변경 없음 (재사용)
- `Content` 모델 — `canvasJson` 필드 그대로 사용 (LongText)
- `Layout`, `LayoutZone` — 그대로
- `CustomFont` — 그대로

### 5.2 신규 모델

#### 5.2.1 `WeatherLocation` (지역 마스터)
키오스크 매장이 위치를 선택할 때 쓰는 마스터 테이블. 1회 import 후 변경 거의 없음.

```prisma
model WeatherLocation {
  id           String  @id @default(uuid())
  sido         String  // "서울특별시", "부산광역시" 등
  sigungu      String  // "중구", "해운대구" 등
  // 기상청 단기예보용 격자
  nx           Int
  ny           Int
  // 기상청 중기예보용
  regIdLand    String  // "11B00000" (육상 권역)
  regIdTa      String  // "11B10101" (기온 세부)
  // 에어코리아용
  airStationName String? // "중구" (대표 측정소)
  // 검색용
  searchKey    String  // "서울 중구" (사용자 검색 인덱스)
  isActive     Boolean @default(true)

  @@index([sido, sigungu])
  @@index([searchKey])
}
```

#### 5.2.2 `WeatherCache` (응답 캐시)
백엔드가 외부 API 호출 결과를 캐시. Redis가 없으므로 DB로.

```prisma
model WeatherCache {
  id        String   @id @default(uuid())
  cacheKey  String   @unique  // "short:60:127" / "mid:11B00000:11B10101" / "air:중구"
  payload   String   @db.LongText  // JSON 응답
  fetchedAt DateTime @default(now())
  expiresAt DateTime

  @@index([cacheKey])
  @@index([expiresAt])
}
```

> Redis 도입 시 이 모델은 폐기 가능. 1차에는 DB 캐시로 충분 (격자/측정소 단위 키라 row 수 수십개 수준).

### 5.3 캔버스 JSON 구조 단순화

기존:
```typescript
interface CanvasData {
  version: '1.0'
  canvas: { width, height, orientation, background }
  pages: CanvasPage[]   // ← 다중 페이지
}
```

신규 (v2.0):
```typescript
interface CanvasDataV2 {
  version: '2.0'
  canvas: {
    width: number
    height: number
    orientation: 'landscape' | 'portrait'
    background: string  // fallback color
    backgroundImage?: {
      src: string
      fit: 'contain' | 'cover' | 'fill'
    }
  }
  elements: CanvasElement[]   // ← 단일 화면, 페이지 개념 제거
}

interface CanvasElement {
  id: string
  type: 'image' | 'widget'
  x: number      // px
  y: number      // px
  width: number  // px
  height: number // px
  zIndex: number
  opacity?: number  // 0~1

  // image
  src?: string
  fit?: 'contain' | 'cover' | 'fill'

  // widget
  widget?: WidgetType  // 'weather.current.temp' 등
  config?: Record<string, unknown>
}

type WidgetType =
  | 'weather.current.icon'
  | 'weather.current.temp'
  | 'weather.today.minmax'
  | 'weather.location.label'
  | 'weather.weekly.cards'
  | 'air.pm.value'
  | 'air.pm.grade'
  | 'air.pm.card'
```

> **하위 호환성:** 기존 v1.0 JSON은 마이그레이션 단계에서 변환하거나, 렌더러가 version에 따라 분기. 8장 참조.

---

## 6. 백엔드 API 설계

### 6.1 신규 API

#### 6.1.1 위치 마스터
| 메서드 | 경로 | 설명 |
|---|---|---|
| GET | `/weather/locations?search=서울` | 위치 검색 (자동완성용) |
| GET | `/weather/locations/:id` | 위치 단건 조회 |

#### 6.1.2 날씨 데이터
| 메서드 | 경로 | 설명 |
|---|---|---|
| GET | `/weather/current?locationId=...` | 현재 날씨 (기온, 상태, 오늘 최고/최저) |
| GET | `/weather/weekly?locationId=...&days=7` | 주간 날씨 (오늘+6일) |
| GET | `/weather/air?locationId=...` | 미세먼지 (PM10, PM2.5, 등급) |

응답 예 (`/weather/current`):
```json
{
  "location": { "sido": "서울", "sigungu": "중구" },
  "fetchedAt": "2026-04-09T14:30:00+09:00",
  "current": {
    "temperature": 12,
    "condition": "cloudy",       // sunny | partly_cloudy | cloudy | rain | snow | shower
    "conditionLabel": "구름많음"
  },
  "today": {
    "max": 18,
    "min": 6
  },
  "stale": false
}
```

응답 예 (`/weather/weekly`):
```json
{
  "location": { "sido": "서울", "sigungu": "중구" },
  "fetchedAt": "...",
  "days": [
    { "date": "2026-04-09", "dow": "목", "max": 18, "min": 6, "condition": "cloudy", "conditionLabel": "구름많음" },
    { "date": "2026-04-10", "dow": "금", "max": 20, "min": 8, "condition": "sunny", "conditionLabel": "맑음" },
    ...
  ],
  "stale": false
}
```

응답 예 (`/weather/air`):
```json
{
  "location": { "sido": "서울", "sigungu": "중구", "stationName": "중구" },
  "fetchedAt": "...",
  "pm10": { "value": 42, "grade": 2, "gradeLabel": "보통" },
  "pm25": { "value": 18, "grade": 2, "gradeLabel": "보통" },
  "stale": false
}
```

> `stale: true`는 외부 API가 실패해서 마지막 캐시값을 반환했음을 의미.

### 6.2 캐싱 전략 (Node.js)

| 데이터 | TTL | 비고 |
|---|---|---|
| 단기예보 | 30분 | 원본 발표 3시간 간격 |
| 중기예보 | 6시간 | 원본 발표 06/18시 2회 |
| 미세먼지 | 15분 | 측정소 1시간 단위 집계 |

- 캐시 키: `weather:short:{nx}:{ny}` / `weather:mid:{regIdLand}:{regIdTa}` / `air:{stationName}`
- 캐시 미스 시: 외부 API 호출 → 성공 시 캐시 저장 → 실패 시 직전 캐시값 반환 (`stale: true`)
- **여러 매장이 같은 격자/측정소 공유 시 1회 fetch만** — 호출 수 절약

### 6.3 외부 API 통합

| 데이터 | 1차 소스 | 폴백 |
|---|---|---|
| 단기예보 (현재/오늘/D+1~D+2) | 기상청 `getVilageFcst` | Open-Meteo `/v1/kma` (비상업 한도 내) |
| 중기예보 (D+3~D+7) | 기상청 `getMidLandFcst` + `getMidTa` | Open-Meteo `/v1/kma` (단일 호출) |
| 미세먼지 | 에어코리아 `getMsrstnAcctoRltmMesureDnsty` | (1차에는 폴백 없음, 캐시 stale 표시) |

#### 6.3.1 환경변수
```env
# 기상청 (공공데이터포털)
KMA_SERVICE_KEY="..."
# 에어코리아 (공공데이터포털)
AIRKOREA_SERVICE_KEY="..."
# (옵션) Open-Meteo 폴백은 키 불필요
```

#### 6.3.2 가입 작업
- [공공데이터포털](https://www.data.go.kr/) 회원가입 → 다음 3개 API 활용신청 (자동 승인, 운영계정 전환은 활용사례 등록 후)
  1. 기상청_단기예보 조회서비스
  2. 기상청_중기예보 조회서비스
  3. 한국환경공단_에어코리아_대기오염정보
- **에어코리아 개발계정은 500건/일** → 출시 전 운영계정 전환 필수

### 6.4 제거할 API

| 메서드 | 경로 | 사유 |
|---|---|---|
| GET | `/canvas/templates/list` | 1차 제거 |
| POST | `/canvas/templates` | 1차 제거 |
| POST | `/canvas/templates/:id/use` | 1차 제거 |
| GET | `/content/:contentId/versions` | 1차 제거 |
| POST | `/content/:contentId/versions` | 1차 제거 |

> Prisma 모델 `CanvasTemplate`, `ContentVersion`은 우선 **유지**하되 사용 안 함. 추후 필요 시 다시 활성화.

---

## 7. 컴포넌트별 변경 작업

### 7.1 Frontend (대규모)

| 파일 | 변경 |
|---|---|
| `frontend/src/pages/CanvasEditorPage.tsx` | **재작성** — 단순화 |
| `frontend/src/components/canvas/CanvasStage.tsx` | **재작성** — Fabric.js 의존 제거, HTML/CSS absolute positioning으로 변경 |
| `frontend/src/components/canvas/LeftPanel.tsx` | **재작성** — 탭 2개(이미지, 위젯)로 축소 |
| `frontend/src/components/canvas/RightPanel.tsx` | **재작성** — 위젯 config 폼만 |
| `frontend/src/components/canvas/TopBar.tsx` | 단순화 — 페이지 관련 제거 |
| `frontend/src/components/canvas/BottomPageBar.tsx` | **삭제** |
| `frontend/src/components/canvas/SaveTemplateModal.tsx` | **삭제** |
| `frontend/src/components/canvas/VersionHistoryPanel.tsx` | **삭제** |
| `frontend/src/components/canvas/widgets/ClockWidget.tsx` | 1차 제거 (또는 2차로 미룸) |
| `frontend/src/components/canvas/widgets/WeatherWidget.tsx` | **삭제 (OpenWeatherMap 기반)** → 신규 위젯 7종으로 대체 |
| `frontend/src/components/canvas/widgets/RSSWidget.tsx` | **삭제** |
| `frontend/src/components/canvas/widgets/QRCodeWidget.tsx` | **삭제** |
| `frontend/src/components/canvas/widgets/VideoWidget.tsx` | **삭제** |
| `frontend/src/components/canvas/widgets/WebpageWidget.tsx` | **삭제** |
| `frontend/src/components/canvas/widgets/SpreadsheetWidget.tsx` | **삭제** |
| `frontend/src/components/canvas/widgets/ChartWidget.tsx` | **삭제** |
| `frontend/src/components/canvas/widgets/index.ts` | 신규 위젯 7종 등록 |
| `frontend/src/components/canvas/widgets/weather/*.tsx` | **신규 7개 파일** |
| `frontend/src/store/canvasStore.ts` | **재작성** — 페이지/Undo/잠금 등 제거, 단순화 |
| `frontend/src/api/canvas.ts` | 그대로 (응답 형식만 v2.0 호환) |
| `frontend/src/api/weather.ts` | **신규** — `/weather/*` 호출 |
| `frontend/src/pages/LayoutEditorPage.tsx` | 캔버스 영역 줌/리사이즈 추가 |
| `frontend/src/components/layout/LocationPicker.tsx` | **신규** — 위치 검색/선택 컴포넌트 (위젯 config에서 사용) |

### 7.2 Backend (중간)

| 파일 | 변경 |
|---|---|
| `backend/prisma/schema.prisma` | `WeatherLocation`, `WeatherCache` 모델 추가 |
| `backend/prisma/migrations/...` | 신규 마이그레이션 1개 |
| `backend/prisma/seed.js` 또는 `backend/scripts/seed-weather-locations.js` | **신규** — 격자/regId/측정소 마스터 import |
| `backend/src/services/weather/kmaShortForecast.js` | **신규** — 기상청 단기 호출 |
| `backend/src/services/weather/kmaMidForecast.js` | **신규** — 기상청 중기 (육상+기온) |
| `backend/src/services/weather/airKorea.js` | **신규** — 에어코리아 |
| `backend/src/services/weather/openMeteoFallback.js` | **신규** — 폴백 |
| `backend/src/services/weather/cache.js` | **신규** — `WeatherCache` 모델 wrapper |
| `backend/src/services/weather/index.js` | **신규** — current/weekly/air 통합 진입점 |
| `backend/src/controllers/weatherController.js` | **신규** — `/weather/*` 라우트 핸들러 |
| `backend/src/routes/weather.js` | **신규** |
| `backend/src/app.js` | weather 라우트 등록 |
| `backend/src/controllers/canvasController.js` | template/version 메서드 제거 또는 비활성화 |
| `backend/src/routes/canvas.js` | template/version 라우트 제거 |

### 7.3 Player (Electron)

| 파일 | 변경 |
|---|---|
| `player/src/components/CanvasRenderer.tsx` | v2.0 JSON 지원 추가 (페이지 → 단일 elements 배열) |
| `player/src/components/widgets/weather/*.tsx` | **신규 7개** — 백엔드에서 fetch + 캐시 |
| `player/src/api/weather.ts` | **신규** — 백엔드 호출 (Player 캐시 5분) |

---

## 8. 마이그레이션 전략

### 8.1 기존 캔버스 콘텐츠 (v1.0 → v2.0)

조사 결과 v1.0은 페이지/도형 등을 포함하므로 자동 변환은 손실이 크다.

**선택지:**

| 옵션 | 설명 | 권장 |
|---|---|---|
| **A. 강제 변환** | 페이지 첫 장의 image/widget만 추출, 나머지는 버림 | △ — 데이터 손실 |
| **B. 읽기 전용 분리** | v1.0 콘텐츠는 별도 "Legacy Canvas" 메뉴에서 읽기/재생만 가능, 신규 작성 불가 | ◎ — 안전 |
| **C. 전부 삭제** | 개발 단계라 기존 데이터가 테스트용밖에 없으면 깨끗이 시작 | ○ — 빠름, 단 사용자 확인 필수 |

> **권장: C** — 현재 vuesign DB는 시드+테스트 데이터만 있으므로 깨끗하게 시작. 사용자 명시적 확인 후 진행.

### 8.2 Prisma 모델
- `Content.canvasJson`은 컬럼 그대로 둠 (포맷만 변경)
- `CanvasTemplate`, `ContentVersion`은 모델 유지하되 라우트만 비활성화 (롤백 안전)
- `WeatherLocation`, `WeatherCache` 신규 추가 (1개 마이그레이션)

### 8.3 외부 API 키
- 기상청/에어코리아 키 발급 → `.env` 추가 → 운영 시 반드시 운영계정으로 증설

---

## 9. 개발 단계 (Phase)

### Phase 0 — 준비 (선행 작업)
1. 사용자 의사결정: 8.1에서 옵션 C로 갈지 확정
2. 공공데이터포털 가입 + 3개 API 활용신청
3. 위치 마스터 데이터 준비 (격자좌표 엑셀 + regId 매핑 + 측정소 매핑)

### Phase 1 — 백엔드 (날씨/미세먼지 API)
1. `WeatherLocation`, `WeatherCache` 마이그레이션
2. 위치 마스터 시드 스크립트
3. 기상청/에어코리아/Open-Meteo 서비스 모듈
4. 캐시 wrapper
5. `/weather/*` 컨트롤러/라우트
6. 단위 테스트 (모킹된 외부 API 응답)

### Phase 2 — Frontend 캔버스 에디터 재작성
1. 기존 `canvas/` 폴더 백업 후 정리
2. 새 `CanvasStage` (HTML 기반)
3. 단순화된 `LeftPanel` (이미지/위젯 탭)
4. 단순화된 `RightPanel`
5. 단순화된 `canvasStore`
6. 위젯 컴포넌트 7개 + LocationPicker

### Phase 3 — Player 렌더링
1. `CanvasRenderer` v2.0 지원
2. Player 위젯 7개
3. Player 측 5분 캐시

### Phase 4 — 레이아웃 에디터 개선
1. `LayoutEditorPage` 줌 컨트롤
2. "화면에 맞춤" 버튼
3. localStorage로 사용자별 줌/너비 저장

### Phase 5 — QA & 정리
1. 캔버스 → 레이아웃 → 디바이스 전체 플로우 통합 테스트
2. 키 만료/외부 API 장애 시 Stale 표시 확인
3. 제거된 라우트/컴포넌트 코드 정리
4. 사용자 가이드 작성 (간단한 README 또는 인앱 툴팁)

---

## 10. 영향도 / 위험 요소

### 10.1 영향도
| 영역 | 영향 |
|---|---|
| Frontend 캔버스 에디터 | **파괴적** — 사실상 재작성 |
| Backend 캔버스 라우트 | 소폭 (template/version 제거) |
| Backend 신규 weather 모듈 | 신규 |
| Player 렌더러 | 중간 — v2.0 분기 추가 |
| Layout 에디터 | 소폭 |
| DB 스키마 | 추가 2개 모델 |
| 기존 콘텐츠 | 옵션 C 시 삭제, 옵션 B 시 분리 보관 |

### 10.2 위험 요소
| 위험 | 영향 | 완화책 |
|---|---|---|
| 공공데이터 API 키 발급 지연 (1~2일) | Phase 1 시작 지연 | 즉시 신청 시작 |
| 에어코리아 500건/일 제한 | 매장 늘면 소진 | 운영계정 전환 + 캐시로 격자/측정소 단위 공유 |
| 기상청 응답 파싱 복잡 (TMX/TMN 시각 의존) | 파싱 버그 | 단위 테스트 + 응답 fixture |
| 격자/regId 매핑 누락 | 일부 지역 위젯 동작 안 함 | 시드 단계에서 누락 검증 |
| Fabric.js 의존 제거로 회귀 버그 | 기존 콘텐츠 깨짐 | 8.1 옵션 C로 회피 |
| 폴백 Open-Meteo 상업 라이선스 이슈 | 라이선스 위반 가능성 | 1차에는 폴백 호출 빈도 매우 낮게 또는 비활성화 |

---

## 11. 의사결정이 필요한 사항 (사용자 확인 요청)

기획서를 확정하기 전에 다음 4가지에 대해 결정이 필요합니다.

1. **기존 캔버스 콘텐츠 처리** — 옵션 A/B/C 중 어느 것?
   - 권장: **C (전부 삭제, 깨끗하게 시작)** — 현재 테스트 데이터뿐이라 가정
2. **단독 텍스트 요소** — 1차에서 완전히 빼도 되는지?
   - 권장: **빼고 시작** — 빈칸은 배경 이미지에 그려놓고, 동적 텍스트는 위젯으로만
3. **위치 선택 UX** — 캔버스마다 위치를 고정 vs. 레이아웃 Zone에서 오버라이드 가능
   - 권장: **1차는 캔버스마다 고정.** Phase 2에서 Zone 오버라이드 추가 (캔버스 1개로 매장별 다른 위치 가능)
4. **Open-Meteo 폴백** — 상업 라이선스 부담을 감수하고 폴백으로 둘지?
   - 권장: **1차에서는 비활성화**, 기상청/에어코리아만 사용. 장애 시 Stale 캐시값 표시.

---

## 12. 부록

### 12.1 위젯 카탈로그 (요약)

| 카테고리 | 위젯 | 타입 키 | 데이터 소스 |
|---|---|---|---|
| 날씨 | 현재 날씨 아이콘 | `weather.current.icon` | 기상청 단기 |
| 날씨 | 현재 기온 | `weather.current.temp` | 기상청 단기 |
| 날씨 | 오늘 최고/최저 | `weather.today.minmax` | 기상청 단기 |
| 날씨 | 위치명 라벨 | `weather.location.label` | (config) |
| 날씨 | 주간 카드 | `weather.weekly.cards` | 기상청 단기+중기 |
| 미세먼지 | PM 수치 | `air.pm.value` | 에어코리아 |
| 미세먼지 | 등급 라벨 | `air.pm.grade` | 에어코리아 |
| 미세먼지 | 통합 카드 | `air.pm.card` | 에어코리아 |

### 12.2 외부 API 참고 링크 (실제 출처)
- 기상청 단기예보: https://www.data.go.kr/data/15084084/openapi.do
- 기상청 중기예보: https://www.data.go.kr/data/15059468/openapi.do
- 기상청 예보구역 정보: https://www.data.go.kr/data/15057111/openapi.do
- 에어코리아 대기오염정보: https://www.data.go.kr/tcs/dss/selectApiDataDetailView.do?publicDataPk=15073861
- 에어코리아 OpenAPI 포털: http://openapi.airkorea.or.kr/
- 기상청 API허브 (격자좌표 엑셀): https://apihub.kma.go.kr/
- Open-Meteo KMA: https://open-meteo.com/en/docs/kma-api

### 12.3 기상청 SKY/PTY → 표준 condition 매핑
| PTY | SKY | condition |
|---|---|---|
| 0 | 1 | sunny (맑음) |
| 0 | 3 | partly_cloudy (구름많음) |
| 0 | 4 | cloudy (흐림) |
| 1 | * | rain (비) |
| 2 | * | rain (비/눈) |
| 3 | * | snow (눈) |
| 4 | * | shower (소나기) |

### 12.4 에어코리아 등급 → 라벨/색상
| Grade | PM10 | PM2.5 | Label | Color |
|---|---|---|---|---|
| 1 | 0~30 | 0~15 | 좋음 | #1E88E5 (파랑) |
| 2 | 31~80 | 16~35 | 보통 | #43A047 (초록) |
| 3 | 81~150 | 36~75 | 나쁨 | #FB8C00 (주황) |
| 4 | 151+ | 76+ | 매우나쁨 | #E53935 (빨강) |

---

**문서 끝.**
