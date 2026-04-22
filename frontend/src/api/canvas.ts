/**
 * VueSign Phase W1: Canvas v2.0 데이터 모델
 *
 * v1(페이지/도형 중심)에서 v2(이미지 + 실시간 데이터 위젯 중심)로 전환.
 * - pages 제거 (단일 페이지)
 * - shape 요소 제거 (도형 편집 기능 삭제)
 * - 이미지 배경 지원 (backgroundImage + backgroundFit)
 * - 날씨/미세먼지 전용 위젯 세트 추가
 *
 * 서버는 canvasJson을 opaque 문자열로 저장하므로 버전 전환은 프론트엔드에서 처리.
 */
import apiClient from './client'

// ─── Widget 키 정의 ───────────────────────────
// 날씨/대기질은 locationId를 공유한다.
export type WidgetKey =
  | 'weather.current'        // 종합 카드: 아이콘 + 현재 온도 + 상태 + 오늘 최고/최저 + 위치
  | 'weather.current.icon'   // 현재 날씨 아이콘만
  | 'weather.current.temp'   // 현재 온도 숫자만
  | 'weather.today.minmax'   // 오늘 최고/최저 (예: "최고 23° / 최저 12°")
  | 'weather.location'       // 위치 라벨 (예: "서울 강남구")
  | 'weather.weekly'         // 주간 예보 카드 (N일치 가로 스트립)
  | 'air.pm.value'           // PM10/PM2.5 수치
  | 'air.pm.grade'           // 등급 뱃지 (좋음/보통/나쁨/매우나쁨)
  | 'air.pm.card'            // 종합 대기질 카드

export interface WidgetConfig {
  // 공통: 대부분의 날씨/대기질 위젯이 사용
  locationId?: string

  // 대기질 위젯: 어떤 지표를 보여줄지
  metric?: 'pm10' | 'pm25'

  // 주간 예보 위젯
  days?: number              // 기본 7

  // 스타일 (위젯 내부 텍스트용)
  textColor?: string
  accentColor?: string       // 강조색 (예: 아이콘 하이라이트)
  fontSize?: number
  fontFamily?: string
  bgColor?: string           // 위젯 자체 배경 (기본 transparent)
  borderRadius?: number

  // weather.current 카드 옵션
  showIcon?: boolean
  showLocation?: boolean
  showMinMax?: boolean

  // weather.current.icon 옵션
  iconStyle?: 'filled' | 'outline'
}

export interface CanvasElement {
  id: string
  type: 'text' | 'image' | 'widget'
  x: number
  y: number
  width: number
  height: number
  zIndex: number
  rotation?: number
  opacity?: number
  locked?: boolean
  visible?: boolean

  // text
  content?: string
  fontSize?: number
  fontFamily?: string
  color?: string
  bold?: boolean
  italic?: boolean
  underline?: boolean
  textAlign?: 'left' | 'center' | 'right'
  lineHeight?: number
  textShadow?: string   // 배경 위 가독성

  // image
  src?: string
  fit?: 'contain' | 'cover' | 'fill'

  // widget
  widget?: WidgetKey
  config?: WidgetConfig
}

export interface CanvasData {
  version: '2.0'
  canvas: {
    width: number
    height: number
    backgroundColor: string
    backgroundImage?: string
    backgroundFit?: 'contain' | 'cover' | 'fill'
  }
  elements: CanvasElement[]
}

// ─── 레거시 v1 → v2 마이그레이션 ────────────────────────
// 기존에 저장된 v1(pages/shapes) 캔버스를 v2로 변환하여 읽는다.
// shape 요소는 버려지고, text/image/widget만 첫 페이지에서 흡수한다.
interface LegacyCanvasV1 {
  version?: string
  canvas?: {
    width?: number
    height?: number
    background?: string
    backgroundColor?: string
  }
  pages?: Array<{
    elements?: Array<any>
  }>
  elements?: Array<any>
}

export function normalizeCanvasData(raw: unknown): CanvasData {
  // 이미 v2
  const data = raw as LegacyCanvasV1
  if (data && (data as any).version === '2.0' && Array.isArray((data as any).elements)) {
    return raw as CanvasData
  }

  // v1 또는 빈 값 → v2로 변환
  const width = data?.canvas?.width || 1920
  const height = data?.canvas?.height || 1080
  const bg = data?.canvas?.backgroundColor || data?.canvas?.background || '#0F172A'

  // v1 pages 첫 페이지만 사용, shape 요소는 제외
  const legacyElements =
    (data?.pages && data.pages[0]?.elements) ||
    data?.elements ||
    []

  const elements: CanvasElement[] = legacyElements
    .filter((el: any) => el && el.type !== 'shape')
    .map((el: any, i: number) => ({
      id: el.id || `legacy-${i}`,
      type: (el.type === 'widget' ? 'widget' : el.type === 'image' ? 'image' : 'text') as any,
      x: Number(el.x) || 0,
      y: Number(el.y) || 0,
      width: Number(el.width) || 200,
      height: Number(el.height) || 100,
      zIndex: Number(el.zIndex) || i,
      rotation: Number(el.rotation) || 0,
      opacity: el.opacity ?? 1,
      locked: !!el.locked,
      visible: el.visible !== false,
      // text
      content: el.content,
      fontSize: el.fontSize,
      fontFamily: el.fontFamily,
      color: el.color,
      bold: el.bold,
      italic: el.italic,
      underline: el.underline,
      textAlign: el.textAlign,
      lineHeight: el.lineHeight,
      // image
      src: el.src,
      fit: el.fit,
      // widget: 기존 위젯(clock/rss/...)은 legacy로 남겨둠 — 호환성 유지용, 신규 생성 불가
      widget: el.widget,
      config: el.config,
    }))

  return {
    version: '2.0',
    canvas: {
      width,
      height,
      backgroundColor: bg,
      backgroundImage: undefined,
      backgroundFit: 'cover',
    },
    elements,
  }
}

// ─── 콘텐츠/템플릿 API ─────────────────────────
export interface CanvasContentItem {
  id: string
  name: string
  thumbnail?: string | null
  width?: number
  height?: number
  publishStatus?: string
  createdAt: string
  updatedAt: string
  creator?: { id: string; username: string }
}

export interface CanvasTemplate {
  id: string
  name: string
  description?: string
  category: string
  thumbnail?: string
  tags?: string
  isPublic: boolean
  useCount: number
  createdAt: string
}

export const canvasApi = {
  list: async (params?: Record<string, unknown>) => {
    const res = await apiClient.get('/canvas', { params })
    return res.data
  },
  get: async (id: string) => {
    const res = await apiClient.get(`/canvas/${id}`)
    return res.data
  },
  save: async (data: { name: string; canvasJson: CanvasData; thumbnail?: string }) => {
    const res = await apiClient.post('/canvas', {
      ...data,
      canvasJson: JSON.stringify(data.canvasJson),
    })
    return res.data
  },
  update: async (id: string, data: { name?: string; canvasJson?: CanvasData; thumbnail?: string }) => {
    const payload: Record<string, unknown> = {}
    if (data.name) payload.name = data.name
    if (data.canvasJson) payload.canvasJson = JSON.stringify(data.canvasJson)
    if (data.thumbnail) payload.thumbnail = data.thumbnail
    const res = await apiClient.put(`/canvas/${id}`, payload)
    return res.data
  },
  // Templates
  listTemplates: async (params?: Record<string, unknown>) => {
    const res = await apiClient.get('/canvas/templates/list', { params })
    return res.data
  },
  saveTemplate: async (data: Record<string, unknown>) => {
    const res = await apiClient.post('/canvas/templates', data)
    return res.data
  },
  useTemplate: async (id: string) => {
    const res = await apiClient.post(`/canvas/templates/${id}/use`)
    return res.data
  },
}
