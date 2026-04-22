/**
 * VueSign Phase W1: Canvas v2.0 Store
 *
 * 이전 버전(V4 Phase 12a)에서 제거된 기능:
 *   - pages / currentPageIndex / addPage / duplicatePage …
 *   - Command Pattern 기반 세밀한 undo/redo (스냅샷 기반으로 교체)
 *   - shape 요소 전반 (도형, 화살표, 선)
 *
 * 유지된 기능:
 *   - 캔버스 크기/배경/배경이미지
 *   - 텍스트/이미지/위젯 요소 CRUD
 *   - zIndex 기반 레이어 순서
 *   - 선택/잠금/숨김
 *   - 스냅샷 기반 Undo/Redo (최대 30)
 *
 * 새로 추가된 것:
 *   - 배경 이미지 (backgroundImage, backgroundFit)
 *   - 날씨/대기질 전용 위젯 추가 헬퍼 (addWeatherWidget 등)
 */
import { create } from 'zustand'
import { v4 as uuidv4 } from 'uuid'
import {
  CanvasData,
  CanvasElement,
  WidgetKey,
  WidgetConfig,
  normalizeCanvasData,
} from '@/api/canvas'

const MAX_HISTORY = 30

// ─── 초기 v2.0 데이터 ────────────────────────────
function createDefaultCanvasData(): CanvasData {
  return {
    version: '2.0',
    canvas: {
      width: 1920,
      height: 1080,
      backgroundColor: '#0F172A',
      backgroundImage: undefined,
      backgroundFit: 'cover',
    },
    elements: [],
  }
}

// 깊은 복사 (JSON safe) — 스냅샷용
function snapshot<T>(value: T): T {
  return JSON.parse(JSON.stringify(value))
}

// ─── Store Type ──────────────────────────────────
interface CanvasStore {
  // Content info
  contentId: string | null
  contentName: string
  isDirty: boolean

  // Canvas
  canvasData: CanvasData

  // Selection
  selectedElementId: string | null

  // History (snapshot based)
  past: CanvasData[]
  future: CanvasData[]

  // Zoom
  zoom: number

  // ─── Actions ──────────────────────────────────
  // Init / meta
  initCanvas: (data?: CanvasData | unknown, contentId?: string, name?: string) => void
  setContentId: (id: string) => void
  setContentName: (name: string) => void
  markClean: () => void

  // Canvas settings
  setCanvasSize: (width: number, height: number) => void
  setCanvasBackgroundColor: (color: string) => void
  setCanvasBackgroundImage: (url: string | undefined) => void
  setCanvasBackgroundFit: (fit: 'contain' | 'cover' | 'fill') => void
  setZoom: (zoom: number) => void

  // Elements
  addElement: (element: Partial<CanvasElement>) => string
  updateElement: (elementId: string, updates: Partial<CanvasElement>) => void
  deleteElement: (elementId: string) => void
  duplicateElement: (elementId: string) => void

  // Widget helpers — 기획서의 7개 위젯 생성 shortcut
  addWidget: (widget: WidgetKey, locationId?: string, overrides?: Partial<CanvasElement>) => string

  // 레거시 캔버스 마이그레이션: locationId 없는 위젯에 기본 위치 채우기
  fillMissingWidgetLocations: (defaultLocationId: string) => number

  // Selection
  selectElement: (elementId: string | null) => void

  // Layer ordering
  bringForward: (elementId: string) => void
  sendBackward: (elementId: string) => void
  bringToFront: (elementId: string) => void
  sendToBack: (elementId: string) => void

  // Undo/Redo
  undo: () => void
  redo: () => void
  canUndo: () => boolean
  canRedo: () => boolean

  // Export
  getCanvasData: () => CanvasData
}

// ─── 히스토리 헬퍼: 변경 전 현재 상태를 past에 push ─────────
function pushHistory(state: CanvasStore, next: CanvasData): Partial<CanvasStore> {
  const past = [...state.past, state.canvasData].slice(-MAX_HISTORY)
  return {
    canvasData: next,
    past,
    future: [],
    isDirty: true,
  }
}

// ─── 위젯별 기본 사이즈 ────────────────────────────
const WIDGET_DEFAULTS: Record<WidgetKey, { w: number; h: number; config?: Partial<WidgetConfig> }> = {
  'weather.current':        { w: 360, h: 200, config: { showIcon: true, showLocation: true, showMinMax: true } },
  'weather.current.icon':   { w: 120, h: 120, config: { iconStyle: 'filled' } },
  'weather.current.temp':   { w: 200, h: 120, config: { fontSize: 84 } },
  'weather.today.minmax':   { w: 260, h: 60,  config: { fontSize: 28 } },
  'weather.location':       { w: 260, h: 50,  config: { fontSize: 24 } },
  'weather.weekly':         { w: 760, h: 180, config: { days: 7 } },
  'air.pm.value':           { w: 200, h: 100, config: { metric: 'pm25', fontSize: 48 } },
  'air.pm.grade':           { w: 200, h: 60,  config: { metric: 'pm25', fontSize: 24 } },
  'air.pm.card':            { w: 360, h: 180, config: { metric: 'pm25' } },
}

// ─── Store ───────────────────────────────────────
export const useCanvasStore = create<CanvasStore>((set, get) => ({
  // Initial state
  contentId: null,
  contentName: '새 캔버스',
  isDirty: false,
  canvasData: createDefaultCanvasData(),
  selectedElementId: null,
  past: [],
  future: [],
  zoom: 0.5,

  // ─── Init ─────────────────────────────────────
  initCanvas: (data, contentId, name) => {
    const normalized = data ? normalizeCanvasData(data) : createDefaultCanvasData()
    set({
      canvasData: normalized,
      contentId: contentId || null,
      contentName: name || '새 캔버스',
      selectedElementId: null,
      past: [],
      future: [],
      isDirty: false,
      zoom: 0.5,
    })
  },

  setContentId: (id) => set({ contentId: id }),
  setContentName: (name) => set({ contentName: name, isDirty: true }),
  markClean: () => set({ isDirty: false }),

  // ─── Canvas settings ──────────────────────────
  setCanvasSize: (width, height) =>
    set(state =>
      pushHistory(state, {
        ...state.canvasData,
        canvas: { ...state.canvasData.canvas, width, height },
      })
    ),

  setCanvasBackgroundColor: (color) =>
    set(state =>
      pushHistory(state, {
        ...state.canvasData,
        canvas: { ...state.canvasData.canvas, backgroundColor: color },
      })
    ),

  setCanvasBackgroundImage: (url) =>
    set(state =>
      pushHistory(state, {
        ...state.canvasData,
        canvas: { ...state.canvasData.canvas, backgroundImage: url },
      })
    ),

  setCanvasBackgroundFit: (fit) =>
    set(state =>
      pushHistory(state, {
        ...state.canvasData,
        canvas: { ...state.canvasData.canvas, backgroundFit: fit },
      })
    ),

  setZoom: (zoom) => set({ zoom: Math.max(0.1, Math.min(3, zoom)) }),

  // ─── Elements ─────────────────────────────────
  addElement: (element) => {
    const state = get()
    const newId = element.id || uuidv4()
    const maxZ = state.canvasData.elements.reduce(
      (max, el) => Math.max(max, el.zIndex || 0),
      0
    )

    const { width: cw, height: ch } = state.canvasData.canvas
    const elW = element.width ?? 200
    const elH = element.height ?? 100
    const centerX = element.x ?? Math.round((cw - elW) / 2)
    const centerY = element.y ?? Math.round((ch - elH) / 2)

    const newElement: CanvasElement = {
      ...(element as CanvasElement),
      id: newId,
      type: (element.type || 'text') as 'text' | 'image' | 'widget',
      x: centerX,
      y: centerY,
      width: elW,
      height: elH,
      zIndex: element.zIndex ?? maxZ + 1,
      rotation: element.rotation ?? 0,
      opacity: element.opacity ?? 1,
      locked: element.locked ?? false,
      visible: element.visible ?? true,
    }

    set(s =>
      pushHistory(s, {
        ...s.canvasData,
        elements: [...s.canvasData.elements, newElement],
      })
    )
    set({ selectedElementId: newId })
    return newId
  },

  updateElement: (elementId, updates) => {
    set(state => {
      const elements = state.canvasData.elements.map(el =>
        el.id === elementId ? { ...el, ...updates } : el
      )
      return pushHistory(state, { ...state.canvasData, elements })
    })
  },

  deleteElement: (elementId) => {
    set(state => {
      const elements = state.canvasData.elements.filter(el => el.id !== elementId)
      return {
        ...pushHistory(state, { ...state.canvasData, elements }),
        selectedElementId:
          state.selectedElementId === elementId ? null : state.selectedElementId,
      }
    })
  },

  duplicateElement: (elementId) => {
    const state = get()
    const source = state.canvasData.elements.find(el => el.id === elementId)
    if (!source) return
    get().addElement({
      ...snapshot(source),
      id: undefined,
      x: source.x + 20,
      y: source.y + 20,
    })
  },

  // ─── Widget helper ────────────────────────────
  addWidget: (widget, locationId, overrides) => {
    const def = WIDGET_DEFAULTS[widget]
    return get().addElement({
      type: 'widget',
      widget,
      width: def.w,
      height: def.h,
      config: {
        locationId,
        textColor: '#FFFFFF',
        fontFamily: 'Noto Sans KR',
        ...def.config,
      },
      ...overrides,
    })
  },

  // ─── 레거시 캔버스 마이그레이션 ────────────────
  // 저장된 캔버스를 열었을 때 locationId 가 비어 있는 위젯에
  // 기본 위치를 자동으로 채워 준다. 히스토리는 건드리지 않고
  // dirty 플래그만 켜서, 사용자가 저장 시 실제 값이 반영되도록 한다.
  fillMissingWidgetLocations: (defaultLocationId) => {
    let patched = 0
    set(state => {
      const elements = state.canvasData.elements.map(el => {
        if (el.type !== 'widget') return el
        const cfg = (el.config || {}) as WidgetConfig
        if (cfg.locationId) return el
        patched += 1
        return { ...el, config: { ...cfg, locationId: defaultLocationId } }
      })
      if (patched === 0) return state
      return {
        canvasData: { ...state.canvasData, elements },
        isDirty: true,
      }
    })
    return patched
  },

  // ─── Selection ────────────────────────────────
  selectElement: (elementId) => set({ selectedElementId: elementId }),

  // ─── Layer ordering ───────────────────────────
  bringForward: (elementId) =>
    set(state => {
      const els = [...state.canvasData.elements].sort((a, b) => a.zIndex - b.zIndex)
      const idx = els.findIndex(el => el.id === elementId)
      if (idx === -1 || idx >= els.length - 1) return state
      const swapped = [...els]
      const tmp = swapped[idx].zIndex
      swapped[idx] = { ...swapped[idx], zIndex: swapped[idx + 1].zIndex }
      swapped[idx + 1] = { ...swapped[idx + 1], zIndex: tmp }
      return pushHistory(state, { ...state.canvasData, elements: swapped })
    }),

  sendBackward: (elementId) =>
    set(state => {
      const els = [...state.canvasData.elements].sort((a, b) => a.zIndex - b.zIndex)
      const idx = els.findIndex(el => el.id === elementId)
      if (idx <= 0) return state
      const swapped = [...els]
      const tmp = swapped[idx].zIndex
      swapped[idx] = { ...swapped[idx], zIndex: swapped[idx - 1].zIndex }
      swapped[idx - 1] = { ...swapped[idx - 1], zIndex: tmp }
      return pushHistory(state, { ...state.canvasData, elements: swapped })
    }),

  bringToFront: (elementId) =>
    set(state => {
      const maxZ = state.canvasData.elements.reduce(
        (m, el) => Math.max(m, el.zIndex),
        0
      )
      const elements = state.canvasData.elements.map(el =>
        el.id === elementId ? { ...el, zIndex: maxZ + 1 } : el
      )
      return pushHistory(state, { ...state.canvasData, elements })
    }),

  sendToBack: (elementId) =>
    set(state => {
      const minZ = state.canvasData.elements.reduce(
        (m, el) => Math.min(m, el.zIndex),
        0
      )
      const elements = state.canvasData.elements.map(el =>
        el.id === elementId ? { ...el, zIndex: minZ - 1 } : el
      )
      return pushHistory(state, { ...state.canvasData, elements })
    }),

  // ─── Undo/Redo (snapshot based) ───────────────
  undo: () => {
    const state = get()
    if (state.past.length === 0) return
    const previous = state.past[state.past.length - 1]
    const newPast = state.past.slice(0, -1)
    set({
      past: newPast,
      future: [state.canvasData, ...state.future].slice(0, MAX_HISTORY),
      canvasData: previous,
      isDirty: true,
      selectedElementId: null,
    })
  },

  redo: () => {
    const state = get()
    if (state.future.length === 0) return
    const next = state.future[0]
    const newFuture = state.future.slice(1)
    set({
      past: [...state.past, state.canvasData].slice(-MAX_HISTORY),
      future: newFuture,
      canvasData: next,
      isDirty: true,
      selectedElementId: null,
    })
  },

  canUndo: () => get().past.length > 0,
  canRedo: () => get().future.length > 0,

  // ─── Export ───────────────────────────────────
  getCanvasData: () => get().canvasData,
}))
