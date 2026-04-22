# VueSign V4 기획서 — Samsung VXT CMS 벤치마킹 기반

> 작성일: 2026-03-30
> 참고: Samsung VXT CMS 공식 문서 (https://docs.samsungvx.com/kor/)
> 대상 버전: V3.0 → V4.0
> 예상 기간: 24~32주 (Phase 11~15)
> 리뷰: Opus 4.6 검토 반영 (2026-03-30)

---

## 1. Samsung VXT CMS 분석 요약

### 1.1 핵심 발견사항

Samsung VXT CMS는 아래 5가지 핵심 차별점을 가집니다:

| # | 차별점 | 핵심 내용 |
|---|--------|----------|
| 1 | **VXT Canvas** | 드래그앤드롭 WYSIWYG 콘텐츠 에디터 (레이어, 위젯, 텍스트, 도형) |
| 2 | **위젯 생태계** | Instagram, Google Drive, Excel, Power BI, Dropbox 등 외부 앱 연동 |
| 3 | **콘텐츠 저니맵** | 콘텐츠가 어떤 채널/스크린에서 재생되는지 시각화 |
| 4 | **콘텐츠 생애주기** | 라이프스팬(만료일) + 엠바고(게시일) 자동 관리 |
| 5 | **스크린 월** | 여러 화면을 하나로 확장 재생 (멀티스크린) |

### 1.2 VueSign V3 vs VXT CMS 기능 비교

| 기능 영역 | VueSign V3 | VXT CMS | 비고 |
|----------|------------|---------|------|
| 콘텐츠 업로드 | ✅ | ✅ | 동일 수준 |
| 플레이리스트 | ✅ | ✅ | 동일 수준 |
| 스케줄/일정 | ✅ | ✅ | VXT는 채널 개념 추가 |
| 장치 원격제어 | ✅ | ✅ | 동일 수준 |
| 긴급메시지 | ✅ | ✅ | 동일 수준 |
| 멀티테넌트 | ✅ | ✅ (워크스페이스) | 개념 동일 |
| 구독/과금 | ✅ | ✅ | 동일 수준 |
| 콘텐츠 승인 | ✅ | ❌ | **VueSign 우위** |
| 웹훅 | ✅ | ❌ | **VueSign 우위** |
| **캔버스 에디터** | ❌ | ✅ | **VXT 우위 (핵심)** |
| **위젯 시스템** | ❌ | ✅ | **VXT 우위** |
| **콘텐츠 저니맵** | ❌ | ✅ | **VXT 우위** |
| **라이프스팬/엠바고** | ❌ | ✅ | **VXT 우위** |
| **스크린 월** | ❌ | ✅ | **VXT 우위** |
| **동기화 재생** | ❌ | ✅ | **VXT 우위** |
| **태그 기반 조건 재생** | ❌ | ✅ | **VXT 우위** |
| **이벤트 기반 재생** | ❌ | ✅ | **VXT 우위 (터치/네트워크/센서)** |

---

## 2. V4 전략 방향

### 취할 것 (VXT에서 배울 것)
1. **캔버스 에디터** — 가장 핵심적인 차별화 기능
2. **콘텐츠 생애주기** — 구현 난이도 낮고 실용적
3. **위젯 시스템** — 기본 위젯(시계, 날씨, RSS)부터 시작
4. **태그 기반 조건 재생** — 콘텐츠 자동화의 핵심
5. **콘텐츠 저니맵** — 운영자 UX 개선

### 버릴 것 (VueSign에 불필요한 것)
- TV 채널맵 구성 (삼성 하드웨어 종속)
- BrightSign 플레이어 (특수 하드웨어)
- E-Paper 전용 기능 (시장 규모 작음)
- Samsung SmartThings 연동 (생태계 종속)

### VueSign 강점 유지
- 콘텐츠 승인 워크플로우 (VXT에 없음)
- 멀티테넌트 SaaS 구조
- 웹훅 & 외부 알림 연동
- 자동화 테스트 기반

---

## 3. V4 로드맵 개요

```
Phase 11 : 콘텐츠 생애주기 (라이프스팬/엠바고)  2~3주   ★★★ 빠른 성과 (Quick Win)
Phase 12 : 캔버스 에디터 MVP (12a)             6~8주   ★★★ 핵심
Phase 12b: 캔버스 에디터 고급 (12b)            6~8주   ★★★ 핵심
Phase 13 : 채널 시스템 & 저니맵                3~4주   ★★★ 필수
Phase 14 : 태그 기반 조건 재생 & 이벤트         3~4주   ★★  중요
Phase 15 : 스크린 월 & 동기화 재생             4~5주   ★★  중요
Phase 16 : 외부 앱 연동 위젯                   4~6주   ★   선택
```

> **Phase 순서 변경 사유:** 라이프스팬/엠바고는 기존 Content 모델에 필드 2개 추가 + cron 로직으로
> 2~3주 내 구현 가능한 빠른 성과(Quick Win)입니다. 캔버스 에디터(12~16주)를 먼저 시작하면
> V4 출시까지 고객에게 보여줄 수 있는 기능이 3~4개월간 없으므로, 라이프스팬을 먼저 배포하여
> 고객 가치를 빠르게 전달합니다.
>
> **캔버스 에디터 분할 사유:** 원래 8~10주 예상은 비현실적입니다.
> Fabric.js 학습, 커스텀 프로퍼티 패널, 폰트 관리, Undo/Redo, 듀얼 렌더러 검증 등을 고려하면
> 최소 12~16주가 필요합니다. MVP(12a)에서 텍스트/이미지/도형 기본 기능을 먼저 출시하고,
> 고급(12b)에서 위젯/애니메이션/템플릿 시스템을 추가합니다.

---

## 4. Phase 11: 콘텐츠 생애주기 — 라이프스팬 & 엠바고 (2~3주) ★★★ Quick Win

### 4.1 목표
콘텐츠의 게시일(엠바고)과 만료일(라이프스팬)을 자동 관리하여
운영자의 수동 콘텐츠 on/off 작업을 제거한다.

> **Quick Win 선정 이유:** 기존 Content 모델에 필드 2개 + cron 1개 추가로 2~3주 내 구현 가능.
> 캔버스 에디터(12~16주)보다 먼저 배포하여 V4 초기 고객 가치를 빠르게 전달.

### 4.2 Content 모델 필드 추가

```prisma
model Content {
  // ... 기존 필드 ...
  startAt       DateTime?  // 엠바고: 이 시각 이후부터 사용 가능
  expiresAt     DateTime?  // 라이프스팬: 이 시각 이후 자동 비활성화
  publishStatus String     @default("published")
  // "published" | "scheduled" | "expired" | "disabled"
  // disabled = 사용자가 수동 비활성화 (cron이 건드리지 않음)
}
```

> **publishStatus 필드 추가 이유 (Issue #3 수정):**
> 단순히 `isActive` 필드만 사용하면 엠바고 cron이 "사용자가 의도적으로 비활성화한 콘텐츠"까지
> 엠바고 시간이 지났다고 다시 활성화시키는 버그가 발생합니다.
> `publishStatus`로 상태를 명확히 구분하여 `disabled` 상태는 cron이 무시합니다.

### 4.3 자동화 (node-cron) — 수정된 로직

```javascript
// 매 분마다 실행
cron.schedule('* * * * *', async () => {
  const now = new Date();

  // 만료된 콘텐츠 비활성화 (published → expired)
  await prisma.content.updateMany({
    where: {
      expiresAt: { lte: now },
      publishStatus: 'published'
    },
    data: { isActive: false, publishStatus: 'expired' }
  });

  // 엠바고 해제 (scheduled → published)
  // ⚠️ disabled 상태는 건드리지 않음!
  await prisma.content.updateMany({
    where: {
      startAt: { lte: now },
      publishStatus: 'scheduled'
    },
    data: { isActive: true, publishStatus: 'published' }
  });
});
```

### 4.4 프론트엔드 UI

- ContentPage에서 업로드/수정 시 "시작일" / "만료일" DatePicker 추가
- 콘텐츠 카드에 상태 배지 표시:
  - 🕐 예약됨 (scheduled) — 엠바고 대기 중
  - ✅ 게시됨 (published) — 활성 상태
  - ⏰ 만료 임박 (D-7, D-3, D-1 배지)
  - ❌ 만료됨 (expired) — 자동 비활성화
  - 🚫 비활성화 (disabled) — 수동 비활성화
- 만료된 콘텐츠 별도 탭으로 분류
- "수동 비활성화" 버튼 → publishStatus = 'disabled' (cron이 재활성화하지 않음)

### 4.5 영향도 분석

| 대상 | 영향 | 위험도 |
|------|------|--------|
| schema.prisma | 필드 3개 추가 (startAt, expiresAt, publishStatus) | 🟡 낮음 |
| contentController.js | 필터 로직 추가 | 🟡 낮음 |
| ContentPage.tsx | DatePicker UI + 상태 배지 추가 | 🟡 낮음 |
| 기존 콘텐츠 | 기본값 null/published → 영향 없음 | 🟢 없음 |

---

## 5. Phase 12a: 캔버스 에디터 MVP (6~8주) ★★★

### 5.1 목표
사용자가 브라우저에서 직접 디지털 사이니지 콘텐츠를 제작할 수 있는
WYSIWYG 캔버스 에디터의 MVP(최소 기능 제품)를 구현한다.
MVP는 텍스트, 이미지, 도형 편집 + 저장/배포가 가능한 수준.

### 5.2 기술 스택 선정

**핵심 라이브러리: Fabric.js 6.x**
```
선정 이유:
- HTML5 Canvas 기반 WYSIWYG 에디터 라이브러리
- 텍스트, 이미지, 도형, 그룹화 내장 지원
- 드래그앤드롭, 리사이즈, 회전 기본 지원
- 레이어(z-index) 관리 내장
- MIT 라이선스 (상업적 사용 가능)
- 커뮤니티 활성도 높음

대안: Konva.js (성능↑, API 복잡),
      GSAP (애니메이션↑, 에디터 기능↓)
```

### 5.3 ⚠️ 렌더러 아키텍처 결정 (Critical Decision)

> **문제 (Issue #1 — 듀얼 렌더러):**
> 에디터는 Fabric.js (Canvas API)로 렌더링하고, 플레이어는 HTML/CSS로 렌더링하면
> **동일한 JSON임에도 시각적 결과가 다를 수 있습니다.**
> 예: 텍스트 줄바꿈 위치, 폰트 렌더링, 그라디언트 방향, 도형 모서리 처리 등이
> Canvas API와 CSS에서 미묘하게 다릅니다. "에디터에서 보이는 것 ≠ 실제 재생 화면"은
> 사용자 신뢰를 크게 떨어뜨리는 치명적 UX 문제입니다.

**방안 A: 통합 렌더러 (Fabric.js 에디터 + Fabric.js 플레이어) ✅ 권장**
```
장점:
- WYSIWYG 보장 — 에디터와 플레이어가 동일한 렌더링 엔진
- Fabric.js의 toDataURL()로 정적 프레임 캡처 가능
- 렌더링 차이 QA 불필요

단점:
- 플레이어에도 Fabric.js 번들 포함 (~500KB gzip)
- Canvas API는 접근성(a11y) 지원 약함
- 일부 저사양 디바이스에서 Canvas 성능 이슈 가능

구현:
- 에디터: Fabric.js (편집 모드)
- 플레이어: Fabric.js (읽기 전용 모드, loadFromJSON)
- 위젯: Fabric.js Custom Object로 구현
```

**방안 B: 듀얼 렌더러 (Fabric.js 에디터 + HTML/CSS 플레이어)**
```
장점:
- 플레이어 번들 크기 작음
- HTML/CSS가 더 넓은 디바이스 호환성
- SEO/접근성 유리

단점:
- ⚠️ 렌더링 불일치 위험 (가장 큰 문제)
- 모든 요소 타입에 대해 Canvas↔CSS 매핑 테스트 필요
- 유지보수 비용 2배 (에디터 변경 시 플레이어도 수정)
- 폰트 렌더링 차이 (Canvas vs CSS font-rendering)

구현:
- 에디터: Fabric.js
- 플레이어: React 컴포넌트 (CSS transform 기반)
- 반드시 "미리보기" 모드에서 플레이어 렌더러로 검증 필요
```

**결론: 방안 A (통합 렌더러) 권장**
```
사이니지 플레이어는 대부분 Chrome 기반 키오스크 브라우저이므로
Canvas API 호환성 문제가 거의 없습니다.
500KB 번들 추가는 사이니지 환경(Wi-Fi/LAN)에서 무시 가능합니다.
"에디터에서 보이는 그대로 재생된다"는 UX 신뢰가 가장 중요합니다.

만약 방안 B를 선택한다면, 반드시 Visual Regression Test를 도입하여
에디터 스크린샷 vs 플레이어 스크린샷을 자동 비교해야 합니다.
```

### 5.4 템플릿 저장 형식: JSON
```json
{
  "version": "1.0",
  "canvas": {
    "width": 1920,
    "height": 1080,
    "orientation": "landscape",
    "background": "#000000"
  },
  "pages": [
    {
      "id": "page-1",
      "name": "메인",
      "duration": 10,
      "transition": "fade",
      "elements": [
        {
          "type": "image",
          "id": "el-1",
          "src": "/uploads/images/bg.jpg",
          "x": 0, "y": 0,
          "width": 1920, "height": 1080,
          "zIndex": 0
        },
        {
          "type": "text",
          "id": "el-2",
          "content": "오늘의 메뉴",
          "x": 100, "y": 80,
          "width": 400, "height": 80,
          "fontSize": 64,
          "fontFamily": "Noto Sans KR",
          "color": "#FFFFFF",
          "bold": true,
          "animation": "fadeIn",
          "zIndex": 2
        },
        {
          "type": "shape",
          "id": "el-3",
          "shape": "rect",
          "x": 80, "y": 60,
          "width": 440, "height": 500,
          "fill": "rgba(0,0,0,0.6)",
          "borderRadius": 16,
          "zIndex": 1
        },
        {
          "type": "widget",
          "id": "el-4",
          "widget": "clock",
          "x": 1700, "y": 30,
          "width": 200, "height": 60,
          "config": { "format": "HH:mm", "color": "#FFFFFF" },
          "zIndex": 3
        }
      ]
    }
  ],
  "primeElements": []
}
```

### 5.5 작업 항목 (MVP 범위)

#### 12a-1. 캔버스 에디터 UI 구조 (2주)
```
영향 범위: 신규 페이지 CanvasEditorPage.tsx (완전 독립)
기존 코드 변경: Sidebar에 메뉴 1개 추가, App.tsx에 라우트 추가
```

**에디터 레이아웃:**
```
┌────────────────────────────────────────────────────────┐
│  [뒤로] [저장] [미리보기] [배포] .............. [더보기]  │  TopBar
├──────────┬─────────────────────────────┬───────────────┤
│          │                             │               │
│  메뉴패널 │     캔버스 편집 영역         │  속성 패널    │
│  (왼쪽)  │     (중앙 메인)             │  (오른쪽)     │
│          │                             │               │
│ ▶ 템플릿  │   ┌──────────────────┐     │ 위치: x,y     │
│ ▶ 텍스트  │   │   1920 × 1080    │     │ 크기: w,h     │
│ ▶ 도형   │   │                  │     │ 스타일        │
│ ▶ 미디어  │   │   [캔버스]        │     │ 애니메이션    │
│ ▶ 위젯   │   │                  │     │ 레이어        │
│ ▶ 라이브러│   └──────────────────┘     │               │
│   리      │                             │               │
├──────────┴─────────────────────────────┴───────────────┤
│  [페이지1] [페이지2] [+ 추가]  재생시간: [10s]          │  BottomBar
└────────────────────────────────────────────────────────┘
```

**신규 파일:**
```
frontend/src/pages/CanvasEditorPage.tsx     (메인 에디터)
frontend/src/components/canvas/
├── CanvasStage.tsx                          (Fabric.js 캔버스)
├── LeftPanel.tsx                            (메뉴 패널)
├── RightPanel.tsx                           (속성 패널)
├── BottomPageBar.tsx                        (페이지 관리)
├── TopBar.tsx                              (저장/배포 버튼)
├── elements/
│   ├── TextElement.tsx                     (텍스트 속성)
│   ├── ShapeElement.tsx                    (도형 속성)
│   ├── ImageElement.tsx                    (이미지 속성)
│   └── WidgetElement.tsx                   (위젯 속성)
└── panels/
    ├── TemplatePanel.tsx                   (템플릿 선택)
    ├── MediaPanel.tsx                      (미디어 라이브러리)
    ├── WidgetPanel.tsx                     (위젯 목록)
    └── ShapePanel.tsx                      (도형 목록)
```

**영향도 분석:**
| 대상 | 영향 | 위험도 |
|------|------|--------|
| 기존 콘텐츠 시스템 | 없음 (신규 추가) | 🟢 없음 |
| App.tsx | 라우트 1개 추가 | 🟢 없음 |
| Sidebar.tsx | 메뉴 1개 추가 | 🟢 없음 |
| package.json | fabricjs 추가 | 🟢 없음 |

#### 12a-2. 요소 타입 구현 — MVP (2주)

> MVP에서는 ①②③만 구현. ④위젯과 ⑤라이브러리는 Phase 12b로 이동.

**① 텍스트 요소**
- 폰트 선택 (시스템 폰트 + Google Fonts + 업로드 폰트)
- 폰트 크기, 색상, 굵기, 기울임, 밑줄
- 텍스트 정렬 (좌/중/우)
- 행간, 자간
- 텍스트 테두리, 그림자
- 배경색
- 애니메이션 (페이드인, 슬라이드 인/아웃 등)

**② 도형 요소**
- 사각형, 원, 삼각형, 직선, 화살표
- 채우기 색상 (단색, 그라디언트)
- 테두리 색상, 두께, 스타일
- 투명도 (opacity)
- 모서리 둥글기 (border-radius)
- 그림자

**③ 이미지/영상 요소**
- 내 미디어 라이브러리에서 선택
- 외부 URL 입력
- 크롭, 맞춤 (contain/cover/fill)
- 투명도
- 필터 (밝기, 대비, 채도)

**④ 위젯 요소 (기본 세트)**
- 디지털 시계 (시/분/초, 12h/24h, 폰트/색상)
- 날짜 표시 (형식 선택, 요일 포함)
- 날씨 위젯 (도시 설정, OpenWeatherMap API)
- RSS 뉴스 티커 (URL 입력, 스크롤 속도)
- QR코드 생성 (URL 입력)

**⑤ 라이브러리 요소**
- 공유 라이브러리에서 콘텐츠 삽입
- 최근 사용 미디어
- 즐겨찾기

#### 12a-3. 레이어 & 정렬 시스템 (1주)
- 레이어 패널 (우측 또는 상단 토글)
- 레이어 순서 드래그앤드롭 변경
- 레이어 잠금/숨김
- 요소 정렬 도구 (상/중/하/좌/중/우, 간격 균등)
- 그룹화/해제
- 복사/붙여넣기/삭제
- 눈금자, 안내선, 격자 스냅

#### 12a-4. Undo/Redo 시스템 — Command Pattern (1주)

> **Issue #7 추가:** 단순히 "Ctrl+Z/Y 지원"이 아니라, 구체적인 아키텍처 설계가 필요합니다.

**Command Pattern 기반 Undo/Redo:**
```typescript
// 모든 편집 동작을 Command 객체로 캡슐화
interface CanvasCommand {
  execute(): void;    // 실행 (redo)
  undo(): void;       // 실행취소
  description: string; // "텍스트 이동", "색상 변경" 등
}

// History Manager
class HistoryManager {
  private undoStack: CanvasCommand[] = [];  // 최대 50단계
  private redoStack: CanvasCommand[] = [];

  execute(command: CanvasCommand) {
    command.execute();
    this.undoStack.push(command);
    this.redoStack = [];  // 새 동작 시 redo 스택 초기화
    if (this.undoStack.length > 50) this.undoStack.shift();
  }

  undo() {
    const cmd = this.undoStack.pop();
    if (cmd) { cmd.undo(); this.redoStack.push(cmd); }
  }

  redo() {
    const cmd = this.redoStack.pop();
    if (cmd) { cmd.execute(); this.undoStack.push(cmd); }
  }
}

// 예시: 요소 이동 Command
class MoveElementCommand implements CanvasCommand {
  constructor(
    private element: FabricObject,
    private oldPos: { x: number; y: number },
    private newPos: { x: number; y: number }
  ) {}

  execute() { this.element.set(this.newPos); }
  undo() { this.element.set(this.oldPos); }
  description = '요소 이동';
}
```

**지원 Command 유형:**
| Command | execute | undo |
|---------|---------|------|
| AddElement | 캔버스에 추가 | 캔버스에서 제거 |
| RemoveElement | 캔버스에서 제거 | 캔버스에 복원 |
| MoveElement | 새 위치로 이동 | 이전 위치로 복원 |
| ResizeElement | 새 크기로 변경 | 이전 크기로 복원 |
| StyleChange | 새 스타일 적용 | 이전 스타일 복원 |
| ReorderLayer | 새 z-index | 이전 z-index |
| GroupElements | 그룹화 | 해제 |
| BatchCommand | 여러 Command 묶음 | 역순 undo |

**키보드 단축키:**
- `Ctrl+Z` — Undo
- `Ctrl+Y` / `Ctrl+Shift+Z` — Redo
- 최대 50단계 히스토리

#### 12a-5. 페이지 시스템 (1주)
- 다중 페이지 (최대 50페이지)
- 페이지별 재생시간 (5초~60분)
- 페이지 전환 효과 (없음/페이드/슬라이드/줌)
- Prime 페이지 (공통 요소 — 로고, 워터마크 등)
- 페이지 복제, 순서 변경, 삭제
- 썸네일 미리보기 (하단 바)

#### 12a-6. 저장 & 배포 + 플레이어 렌더러 (1주)

> 아래 11-6, 11-7 내용을 MVP에 통합합니다. 렌더러는 방안 A(통합 Fabric.js) 기준.

---

## 6. Phase 12b: 캔버스 에디터 고급 기능 (6~8주) ★★★

### 6.1 목표
MVP에서 빠진 위젯, 애니메이션, 폰트 관리, 템플릿 시스템, 콘텐츠 버저닝을 추가하여
캔버스 에디터를 프로덕션 수준으로 완성한다.

### 6.2 작업 항목

#### 12b-1. 위젯 요소 (1주)
- 디지털 시계 (시/분/초, 12h/24h, 폰트/색상)
- 날짜 표시 (형식 선택, 요일 포함)
- 날씨 위젯 (도시 설정, OpenWeatherMap API)
- RSS 뉴스 티커 (URL 입력, 스크롤 속도)
- QR코드 생성 (URL 입력)

#### 12b-2. 폰트 관리 시스템 (1주) — Issue #4 신규

> **누락 사항:** 원본 기획서에 폰트 관리가 완전히 빠져있었습니다.
> 디지털 사이니지에서 폰트는 핵심 요소입니다. 에디터에서 선택한 폰트가
> 플레이어에 없으면 대체 폰트로 렌더링되어 레이아웃이 깨집니다.

**폰트 3계층:**
```
1. 시스템 기본 폰트 (Noto Sans KR, Roboto 등 5~10종)
   → 에디터/플레이어에 기본 번들
2. Google Fonts 연동 (CDN 로드, 무료 800+ 폰트)
   → 에디터에서 선택 시 URL 저장, 플레이어에서 동적 로드
3. 커스텀 폰트 업로드 (WOFF2, 업체별 브랜드 폰트)
   → 업체관리자가 업로드 → 서버 저장 → 플레이어 다운로드
```

**DB 모델:**
```prisma
model CustomFont {
  id         String   @id @default(uuid())
  tenantId   String
  name       String   // 표시 이름 (예: "나눔스퀘어 Bold")
  family     String   // CSS font-family 값
  fileUrl    String   // /uploads/fonts/xxx.woff2
  format     String   @default("woff2")  // woff2 | woff | ttf
  weight     String   @default("400")     // 100~900
  style      String   @default("normal")  // normal | italic
  isActive   Boolean  @default(true)
  uploadedBy String
  createdAt  DateTime @default(now())
  @@index([tenantId])
  @@unique([tenantId, family, weight, style])
}
```

**플레이어 폰트 로딩 전략:**
```javascript
// 콘텐츠 재생 전 사용된 폰트 목록 추출 → 선로드
const usedFonts = extractFontsFromCanvasJSON(canvasJson);
await Promise.all(usedFonts.map(font => {
  if (font.type === 'google') return loadGoogleFont(font.family);
  if (font.type === 'custom') return loadCustomFont(font.fileUrl);
  return Promise.resolve(); // 시스템 폰트
}));
// 모든 폰트 로드 완료 후 캔버스 렌더링 시작
```

#### 12b-3. 콘텐츠 버저닝 (1주) — Issue #5 신규

> **누락 사항:** VXT CMS는 콘텐츠 버저닝을 지원합니다.
> 에디터에서 실수로 저장한 경우 이전 버전으로 복원할 수 있어야 합니다.

**DB 모델:**
```prisma
model ContentVersion {
  id         String   @id @default(uuid())
  contentId  String
  version    Int      // 1, 2, 3, ...
  canvasJson String   // 해당 버전의 전체 JSON
  thumbnail  String?
  comment    String?  // 저장 시 메모 (선택)
  createdBy  String
  createdAt  DateTime @default(now())
  @@index([contentId])
  @@unique([contentId, version])
}
```

**동작:**
```
저장 버튼 클릭 시:
  1. 현재 canvasJson → ContentVersion에 새 레코드
  2. Content.canvasJson 업데이트
  3. version 자동 증가

버전 히스토리 UI:
  - 사이드 패널에 버전 목록 (타임라인)
  - 각 버전 썸네일 + 저장 시각 + 작성자
  - "이 버전으로 복원" 버튼
  - 최대 30개 버전 유지 (초과 시 오래된 버전 자동 삭제)
```

#### 12b-4. 템플릿 시스템 (1주)
- 내 템플릿으로 저장 (현재 캔버스 → 템플릿)
- 템플릿 라이브러리 패널 (카테고리별 분류)
- 기본 제공 템플릿 (메뉴판, 공지사항, 프로모션, 웰컴보드 등)
- 템플릿 불러와서 편집
- 공유 템플릿 (SUPER_ADMIN이 등록 → 모든 업체 사용)

**새 DB 모델:**
```prisma
model CanvasTemplate {
  id          String   @id @default(uuid())
  name        String
  description String?
  category    String
  thumbnail   String?
  canvasJson  String   // 전체 캔버스 JSON
  tags        String?
  isPublic    Boolean  @default(false)  // 공유 템플릿 여부
  tenantId    String?  // null이면 공개 템플릿
  createdBy   String
  useCount    Int      @default(0)
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  @@index([tenantId])
  @@index([category])
}
```

#### 12b-5. 애니메이션 시스템 (1주)
- 요소 등장 애니메이션 (fadeIn, slideIn, bounceIn, zoomIn)
- 요소 퇴장 애니메이션 (fadeOut, slideOut)
- 루프 애니메이션 (pulse, bounce, spin)
- 애니메이션 타이밍 설정 (duration, delay, easing)
- 미리보기에서 애니메이션 확인

#### 12b-6. 캔버스 콘텐츠 저장 & 배포 (1주, MVP에서 기본 구현 → 고급 기능 추가)

**기존 Content 모델 확장:**
```prisma
// 기존 Content 모델에 필드 추가
model Content {
  // ... 기존 필드 유지 ...

  // 신규 추가 (캔버스 에디터용)
  isCanvas    Boolean  @default(false)   // 캔버스로 만든 콘텐츠 여부
  canvasJson  String?                    // 캔버스 JSON 데이터
  thumbnail   String?                    // 캔버스 썸네일 이미지
}
```

**저장 흐름:**
```
캔버스 에디터 → [저장] 버튼
  ↓
1. canvasJson을 Content.canvasJson에 저장
2. 첫 페이지를 PNG로 렌더링 → thumbnail 저장
3. Content 목록에 표시 (isCanvas = true 아이콘)

캔버스 에디터 → [배포] 버튼
  ↓
기존 배포 플로우 동일 (플레이리스트 → 스케줄 → 장치)
```

**플레이어 렌더러 업데이트:**
```
isCanvas = true인 콘텐츠:
  canvasJson을 받아 Canvas 렌더러로 표시
  페이지별 duration 적용
  위젯 실시간 업데이트 (시계, 날씨 등)

isCanvas = false인 콘텐츠:
  기존 방식 그대로 (이미지/영상 파일 재생)
```

#### 12b-7. 플레이어 캔버스 렌더러 (고급 기능)

**player/src/components/CanvasRenderer.tsx:**
```
방안 A (통합 렌더러) 기준:
  Fabric.js loadFromJSON() → 읽기 전용 캔버스
  페이지 전환 타이머
  위젯 실시간 갱신 (30초마다)
  애니메이션 Fabric.js animate() 적용
  폰트 선로드 후 렌더링 시작

방안 B (듀얼 렌더러) 기준:
  canvasJson 파싱 → React 컴포넌트 트리로 변환
  Visual Regression Test 필수
```

**기술 선택 (방안 A 권장 — 섹션 5.3 참조):**
- 에디터: Fabric.js (편집 모드)
- 플레이어: Fabric.js (읽기 전용 모드)
- 동일 엔진 → WYSIWYG 완전 보장

---

## 7. Phase 13: 채널 시스템 & 저니맵 (3~4주) ★★★

### 7.1 목표
채널 기반 콘텐츠 배포를 추가하고, 콘텐츠 저니맵으로 운영 가시성을 높인다.

### 7.2 채널 vs 플레이리스트 — 사용자 시나리오 비교 (Issue #9)

> **혼동 방지:** "채널"과 "플레이리스트"는 언뜻 비슷해 보이지만, 사용 시나리오가 다릅니다.

| 구분 | 플레이리스트 | 채널 |
|------|------------|------|
| **비유** | 음악 앨범 (곡 목록) | TV 채널 (24시간 편성) |
| **목적** | 콘텐츠를 순서대로 묶는 단위 | 장치에 "무엇을 틀 것인지" 배정하는 단위 |
| **시간** | 재생 순서만 관리 | 항상 재생 중 (스케줄 불필요) |
| **배포** | 스케줄에 넣어야 장치에 배포됨 | 장치에 직접 배정 → 즉시 재생 |
| **변경** | 수정해도 재배포 필요 | 콘텐츠 추가/삭제 시 즉시 반영 |

**사용자 시나리오:**
```
시나리오 A — 플레이리스트 방식 (기존):
  1. 콘텐츠 3개로 "카페 메뉴" 플레이리스트 생성
  2. 스케줄 생성: "카페 메뉴"를 09:00~18:00에 재생
  3. 스케줄을 장치 5대에 배포
  → 정해진 시간에만 재생, 변경 시 재배포 필요

시나리오 B — 채널 방식 (신규):
  1. "1층 로비" 채널 생성
  2. 콘텐츠 5개를 채널에 추가
  3. 장치 3대를 채널에 배정
  → 항상 재생, 콘텐츠 추가만 하면 즉시 반영
  → 스케줄 없이 "기본 채널"로 설정 가능
```

### 7.3 작업 항목

#### 13-1. 채널 시스템
```
영향 범위: 신규 모델/컨트롤러/라우트/페이지
기존 코드 변경: 없음 (완전 독립 모듈)
```

**채널이란?**
- 플레이리스트의 상위 개념
- 특정 스크린 그룹에 연속 콘텐츠를 배포하는 "방송 채널"
- 스케줄 없이 항상 재생 중인 기본 채널 설정 가능
- 콘텐츠 추가 시 즉시 배포 (스케줄 불필요)

```prisma
model Channel {
  id          String   @id @default(uuid())
  tenantId    String
  name        String
  description String?
  isDefault   Boolean  @default(false)  // 기본 채널 (스케줄 없을 때 재생)
  isActive    Boolean  @default(true)
  createdBy   String
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  @@index([tenantId])
}

model ChannelContent {
  id         String   @id @default(uuid())
  channelId  String
  contentId  String
  order      Int
  duration   Int?     // null이면 콘텐츠 기본 재생시간 사용
  createdAt  DateTime @default(now())
}

model ChannelDevice {
  channelId  String
  deviceId   String
  @@id([channelId, deviceId])
}
```

#### 13-2. 콘텐츠 저니맵 (Journey Map)
```
영향 범위: 신규 API 엔드포인트 + 신규 프론트엔드 모달
기존 코드 변경: 없음
```

**기능:**
- 특정 콘텐츠를 클릭 → "저니맵 보기" 메뉴
- 해당 콘텐츠가 포함된 플레이리스트, 채널, 스케줄, 장치 시각화
- 노드-링크 다이어그램 (react-flow 라이브러리)
- 각 노드 클릭 시 해당 페이지로 이동

**API:**
```
GET /api/content/:id/journey
→ {
    content: {...},
    playlists: [{id, name, schedules: [...], devices: [...]}],
    channels: [{id, name, devices: [...]}],
    totalDevices: 5
  }
```

---

## 8. Phase 14: 태그 기반 조건 재생 & 이벤트 (3~4주) ★★

### 8.1 목표
장치 태그에 따라 다른 콘텐츠를 자동 재생하고,
터치/센서/네트워크 이벤트 기반 화면 전환을 구현한다.

### 8.2 작업 항목

#### 14-1. 태그 기반 조건 재생
```
영향 범위: 장치 모델 태그 필드 확인/추가, 스케줄 조건 로직 추가
기존 코드 변경: scheduleController.js에 태그 필터 추가
```

**동작 방식:**
```
스케줄 생성 시:
  [조건 추가] → 태그 규칙 설정
    예) "매장 타입 = 카페 이면 → 카페메뉴 플레이리스트"
        "지역 = 서울 이면 → 서울 프로모션"
        "기본 = 기본 플레이리스트"

장치에 태그 설정:
  장치 상세 → 태그: { "매장타입": "카페", "지역": "서울" }

배포 시:
  각 장치의 태그 확인 → 맞는 조건의 플레이리스트 자동 배포
```

**DB 변경:**
```prisma
model Device {
  // ... 기존 필드 ...
  tags  String?  // JSON: {"매장타입": "카페", "지역": "서울"}
}

model ScheduleCondition {
  id         String   @id @default(uuid())
  scheduleId String
  tagKey     String   // 예: "매장타입"
  tagValue   String   // 예: "카페"
  playlistId String   // 이 조건에 해당하면 재생할 플레이리스트
  priority   Int      @default(0)
  @@index([scheduleId])
}
```

#### 14-2. 이벤트 기반 페이지 전환 (캔버스 에디터 연동)
```
영향 범위: 캔버스 에디터 이벤트 패널 + 플레이어 이벤트 핸들러
기존 코드 변경: player/src/App.tsx에 이벤트 핸들러 추가
```

**지원 이벤트 유형:**
1. **터치/클릭** — 특정 영역 터치 시 페이지 이동
2. **유휴 시간** — N초 동안 이벤트 없으면 페이지 전환
3. **네트워크 신호** — 외부 HTTP 신호 수신 시 전환
4. **타이머** — 특정 시간 도달 시 자동 전환

**캔버스 JSON 확장:**
```json
{
  "events": [
    {
      "type": "idle",
      "timeout": 30,
      "action": "navigate",
      "target": "page-1"
    },
    {
      "type": "touch",
      "elementId": "btn-menu",
      "action": "navigate",
      "target": "page-2"
    }
  ]
}
```

#### 14-3. 태그 세트 관리
```
영향 범위: 신규 설정 페이지
기존 코드 변경: 없음
```

**기능:**
- 태그 카테고리 정의 (예: "매장타입", "지역", "규모")
- 허용 값 설정 (예: "매장타입" = [카페, 레스토랑, 편의점, 의류])
- 필수 태그 설정 (장치 등록 시 반드시 입력)
- 태그 세트 내보내기/가져오기 (CSV)

---

## 9. Phase 15: 스크린 월 & 동기화 재생 (4~5주) ★★

### 9.1 목표
여러 장치를 하나의 대형 화면처럼 구성하고(스크린 월),
다수 장치에서 콘텐츠를 동기화하여 재생한다.

### 9.2 작업 항목

#### 15-1. 스크린 월 (Screen Wall)
```
영향 범위: 신규 DB 모델, 신규 관리 페이지, 플레이어 렌더링 수정
기존 코드 변경: player/src/App.tsx 에 벽 구성 로직 추가
```

**동작 방식:**
```
스크린 월 설정:
  3 × 2 배열 (가로 3개 × 세로 2개 = 6개 장치)
  전체 해상도: 5760 × 2160

각 장치의 역할:
  장치 (0,0): 전체 화면의 왼쪽 상단 1/6 표시
  장치 (1,0): 전체 화면의 가운데 상단 1/6 표시
  ...

콘텐츠 배포:
  스크린 월 단위로 배포
  각 장치는 자신의 position에 해당하는 부분만 렌더링
```

**DB 모델:**
```prisma
model ScreenWall {
  id         String   @id @default(uuid())
  tenantId   String
  name       String
  rows       Int      // 행 수
  cols       Int      // 열 수
  bezelH     Float    @default(0)  // 수평 베젤 두께 (mm)
  bezelV     Float    @default(0)  // 수직 베젤 두께 (mm)
  screenW    Float?   // 개별 화면 물리 가로 (mm, 베젤 보정 계산용)
  screenH    Float?   // 개별 화면 물리 세로 (mm)
  isActive   Boolean  @default(true)
  createdBy  String
  createdAt  DateTime @default(now())
  @@index([tenantId])
}

model ScreenWallDevice {
  wallId   String
  deviceId String
  row      Int      // 0-based
  col      Int      // 0-based
  @@id([wallId, deviceId])
}
```

**플레이어 수정:**
```javascript
// 장치가 스크린 월에 속해 있으면
if (device.screenWall) {
  const { rows, cols, row, col } = device.screenWall;
  const scaleX = cols;
  const scaleY = rows;
  const translateX = -col * (100 / cols) * cols;
  const translateY = -row * (100 / rows) * rows;

  // CSS transform으로 해당 부분만 표시
  container.style.transform =
    `scale(${1/cols}, ${1/rows}) translate(${translateX}%, ${translateY}%)`;
}
```

#### 15-1b. 베젤 보정 (Bezel Compensation) — Issue #6 추가

> **누락 사항:** 물리적 디스플레이에는 베젤(테두리)이 있습니다.
> 베젤 보정 없이 CSS transform만 적용하면, 베젤 두께만큼 이미지가 잘려
> 직선이 꺾여 보이는 등 시각적 부정확이 발생합니다.

**베젤 보정 로직:**
```javascript
// ScreenWall 모델에 베젤 설정 추가
// bezelH: 수평 베젤 두께 (mm), bezelV: 수직 베젤 두께 (mm)

if (device.screenWall) {
  const { rows, cols, row, col, bezelH, bezelV, screenW, screenH } = device.screenWall;

  // 베젤을 픽셀로 변환 (화면 DPI 기반)
  const bezelPxH = (bezelH / screenW) * device.resolution.width;
  const bezelPxV = (bezelV / screenH) * device.resolution.height;

  // 전체 캔버스에서 이 장치가 보여줄 영역 계산 (베젤 보정 포함)
  const totalWidth = cols * device.resolution.width;
  const totalHeight = rows * device.resolution.height;

  const offsetX = col * (device.resolution.width + bezelPxH * 2);
  const offsetY = row * (device.resolution.height + bezelPxV * 2);

  // 베젤 영역까지 포함한 확대/이동
  container.style.transform =
    `scale(${totalWidth / device.resolution.width}) ` +
    `translate(-${offsetX}px, -${offsetY}px)`;
  container.style.transformOrigin = 'top left';
}
```

#### 15-2. 동기화 재생 (Sync Play)
```
영향 범위: socket.js 동기화 로직 추가, 플레이어 sync 모드 추가
기존 코드 변경: socket.js에 sync room 로직 추가
```

**동작 방식:**
```
동기화 그룹 생성:
  선택한 장치들을 동기화 그룹으로 설정

재생 시작:
  마스터 장치 지정
  마스터가 "syncStart" 신호 발송

동기화 정밀도 목표 (Issue #10 수정):
  ⚠️ 원래 "±100ms WAN 목표"는 비현실적 — 네트워크 지연/지터 때문에 달성 불가
  ✅ LAN (같은 네트워크): ±50ms 목표 (NTP 동기화 + Socket.IO)
  ✅ WAN (인터넷 경유):  ±500ms 목표 (최선 노력, 보장 불가)
  → 스크린 월은 반드시 LAN 환경 권장 (같은 라우터/스위치)
  → WAN 동기화는 "대략 같이 시작" 수준으로 마케팅

재생 중:
  마스터가 매초 타임스탬프 브로드캐스트
  슬레이브는 drift 감지 시 자동 조정
  drift > 200ms(LAN) 또는 1000ms(WAN) 시 강제 재동기화
```

**Socket.IO 이벤트 추가:**
```javascript
// 서버
io.on('sync:join', ({ groupId, deviceId }) => {
  socket.join(`sync:${groupId}`);
});

io.on('sync:start', ({ groupId, timestamp }) => {
  io.to(`sync:${groupId}`).emit('sync:play', {
    timestamp,
    startAt: Date.now() + 1000  // 1초 후 동시 시작
  });
});

io.on('sync:tick', ({ groupId, position }) => {
  io.to(`sync:${groupId}`).emit('sync:tick', { position });
});
```

---

## 10. Phase 16: 외부 앱 연동 위젯 (4~6주) ★

### 10.1 목표
VXT CMS의 외부 앱 연동 기능을 벤치마킹하여
가장 수요가 높은 연동 위젯을 구현한다.

### 10.2 작업 항목 (우선순위 순)

#### 16-1. Google Drive 연동 (2주)
- Google OAuth 2.0 연동
- Drive 파일 탐색 & 선택
- 이미지/PDF/Google Slides → 콘텐츠로 가져오기
- 자동 갱신 주기 설정

#### 16-2. Microsoft 365 연동 (2주)
- Microsoft OAuth 연동
- PowerPoint 파일 → 슬라이드별 이미지 변환
- Excel 파일 → 차트/표 실시간 표시
- OneDrive 파일 탐색

#### 16-3. SNS 위젯 (1주)
- Instagram 피드 위젯 (최신 N개 게시물 슬라이드쇼)
- 게시물 자동 갱신
- 필터/정렬 설정

#### 16-4. Power BI 위젯 (1주)
- Power BI 리포트 iframe 임베드
- 대시보드 자동 갱신
- 인증 토큰 자동 갱신

---

## 11. 전체 영향도 매트릭스

### 11.1 기존 파일 변경 영향 요약

| 기존 파일 | P11 (생애주기) | P12a/b (캔버스) | P13 (채널) | P14 (태그) | P15 (스크린월) | P16 (외부앱) |
|----------|---------------|----------------|-----------|-----------|--------------|------------|
| schema.prisma | 필드 3개 추가 | Content 2필드 + 3모델 | 4모델 추가 | 2모델 추가 | 2모델 추가 | 연동 모델 |
| contentController.js | 시간 필터+상태 | 없음 | 없음 | 없음 | 없음 | 없음 |
| scheduleController.js | 없음 | 없음 | 없음 | 조건 로직 | 없음 | 없음 |
| socket.js | 없음 | 없음 | 없음 | 없음 | sync 이벤트 | 없음 |
| player/App.tsx | 없음 | CanvasRenderer | 없음 | 이벤트 핸들러 | sync/wall 렌더 | 위젯 컴포넌트 |
| Sidebar.tsx | 없음 | 메뉴 1개 | 메뉴 2개 | 설정 추가 | 메뉴 1개 | 메뉴 추가 |
| App.tsx | 없음 | 라우트 1개 | 라우트 2개 | 라우트 추가 | 라우트 추가 | 라우트 추가 |

### 11.2 위험 요소 & 완화 전략

| 위험 요소 | 위험도 | 완화 전략 |
|----------|--------|----------|
| Fabric.js 학습 곡선 | 🟡 중간 | 에디터를 독립 모듈로 분리, MVP(12a)/고급(12b) 2단계 접근 |
| 듀얼 렌더러 불일치 | 🔴 높음 | **방안 A(통합 렌더러) 채택으로 해소**. 방안 B 시 Visual Regression Test 필수 |
| 캔버스 JSON 스키마 설계 | 🟡 중간 | 버저닝 적용 (version: "1.0"), 하위 호환 유지 |
| 폰트 로딩 실패 | 🟡 중간 | 선로드 + fallback 폰트 체인 + 로드 실패 시 경고 표시 |
| 엠바고 cron 오동작 | 🟡 중간 | **publishStatus 4단계로 해소** (published/scheduled/expired/disabled) |
| 스크린 월 베젤 보정 | 🟡 중간 | mm 단위 베젤 입력 + 미리보기 시뮬레이션 |
| 동기화 재생 정밀도 | 🔴 높음 | **LAN ±50ms / WAN ±500ms 현실적 목표**. 스크린 월은 LAN 필수 |
| OAuth 토큰 관리 (P16) | 🟡 중간 | 업체별 토큰 안전 저장, 갱신 로직 |

---

## 12. 신규 기술 스택 추가

### 12.1 신규 npm 패키지

**Frontend:**
```
fabric                         (캔버스 에디터 코어)
react-flow                     (저니맵 시각화)
@dnd-kit/core                  (드래그앤드롭 - 레이어/페이지)
date-fns                       (날짜 처리 - 라이프스팬/엠바고)
react-datepicker               (날짜 선택기)
qrcode                         (QR코드 위젯)
```

**Backend:**
```
node-cron                      (이미 설치됨 - 라이프스팬 자동화)
googleapis                     (Google Drive 연동)
@microsoft/microsoft-graph-client  (MS 365 연동)
```

### 12.2 신규 DB 모델 (Phase 11~16)

| 모델 | Phase | 용도 |
|------|-------|------|
| *(Content 필드 추가)* | 11 | startAt, expiresAt, publishStatus |
| CanvasTemplate | 12a | 캔버스 템플릿 저장 |
| CustomFont | 12b | 커스텀 폰트 관리 |
| ContentVersion | 12b | 콘텐츠 버전 히스토리 |
| Channel | 13 | 채널 관리 |
| ChannelContent | 13 | 채널 내 콘텐츠 |
| ChannelDevice | 13 | 채널-장치 연결 |
| ScheduleCondition | 14 | 태그 조건 재생 |
| TagSet | 14 | 태그 카테고리/값 관리 |
| ScreenWall | 15 | 스크린 월 구성 (베젤 보정 포함) |
| ScreenWallDevice | 15 | 스크린 월-장치 연결 |
| SyncGroup | 15 | 동기화 재생 그룹 |
| AppIntegration | 16 | 외부 앱 OAuth 토큰 |

---

## 13. 일정 요약

```
Week 1-3:    Phase 11  (콘텐츠 생애주기) ← Quick Win 먼저!
Week 4-11:   Phase 12a (캔버스 에디터 MVP) ← 핵심
Week 12-19:  Phase 12b (캔버스 에디터 고급) ← 폰트/버전/위젯/애니메이션
Week 20-23:  Phase 13  (채널 시스템 & 저니맵)
Week 24-27:  Phase 14  (태그 조건 재생 & 이벤트)
Week 24-28:  Phase 15  (스크린 월 & 동기화) ← P14와 병렬 가능
Week 29-34:  Phase 16  (외부 앱 연동)
```

> **총 예상 기간: 24~32주** (기존 20~26주에서 상향)
> Phase 12a/12b 분할, 폰트 관리, 콘텐츠 버저닝, Undo/Redo 설계 등 추가 반영

---

## 부록 A: VXT Canvas 요소 타입 완전 목록

VXT CMS 문서에서 확인된 모든 요소 타입:

| 카테고리 | 요소 | VueSign V4 구현 여부 |
|----------|------|---------------------|
| **템플릿** | 디자인 템플릿 (수백 개 제공) | P12b에서 기본 세트 제공 |
| **아트** | 예술 작품, 사진 컬렉션 | P12b 라이브러리 패널 |
| **위젯** | 시계, 날씨, RSS, QR코드 | P12b 기본 4종 |
| **위젯** | Instagram, Dropbox, Google Drive | P16 |
| **위젯** | Excel, PowerPoint, Power BI, OneDrive | P16 |
| **위젯** | 버튼 리스트 (인터랙티브 키오스크) | P14 터치 이벤트 |
| **미디어** | 이미지, 동영상, 오디오 | P12a 미디어 패널 |
| **텍스트** | 텍스트박스 (폰트/색상/효과) | P12a |
| **도형** | 사각형, 원, 삼각형, 선, 화살표 | P12a |
| **라이브러리** | 내 미디어 라이브러리 | P12a |

---

## 부록 B: 현재 "템플릿 마켓" 재기획

**현재 구현 (V3):**
- 이미지/영상 파일 업로드 → "템플릿"이라고 부르고 있음
- 실질적으로 공유 미디어 라이브러리

**V4에서 재정의:**
```
기존 TemplatesPage → "미디어 마켓"으로 이름 변경
  → 이미지/영상 파일 공유 기능 유지

신규 CanvasTemplatePage → "디자인 템플릿"
  → canvasJson 기반 진짜 편집 가능한 템플릿
  → 사용하기 = 캔버스 에디터에서 열기
```

---

## 부록 C: VXT CMS 역할 구조 vs VueSign 역할 구조 비교

| VXT CMS | 역할 수준 | VueSign V4 |
|---------|---------|------------|
| Owner (조직 최고 관리자) | 최상위 | 최고관리자 (SUPER_ADMIN) |
| Admin (워크스페이스 관리자) | 업체 단위 | 업체관리자 (TENANT_ADMIN) |
| Editor (콘텐츠 편집자) | 작업 단위 | 매장관리자 + 사용자 통합 |
| Viewer (조회만) | 최하위 | 뷰어 (VIEWER) |

**차이점:**
- VXT는 조직(Organization) > 워크스페이스(Workspace) > 사용자
- VueSign는 플랫폼 > 업체(Tenant) > 매장(Store) > 사용자
- V4에서는 VueSign의 계층 구조가 더 SaaS에 적합 (현행 유지)
