/**
 * V4 Phase 12a: 캔버스 에디터 상태 관리 (Zustand)
 * - 캔버스 데이터 (pages, elements)
 * - 선택 상태
 * - Undo/Redo (Command Pattern)
 * - 페이지 관리
 */
import { create } from 'zustand'
import { CanvasData, CanvasPage, CanvasElement } from '@/api/canvas'
import { v4 as uuidv4 } from 'uuid'

// ─── Command Pattern for Undo/Redo ─────────────────
interface CanvasCommand {
  execute: () => void
  undo: () => void
  description: string
}

// ─── Store Types ────────────────────────────────────
interface CanvasStore {
  // Content info
  contentId: string | null
  contentName: string
  isDirty: boolean

  // Canvas data
  canvasData: CanvasData
  currentPageIndex: number

  // Selection
  selectedElementId: string | null
  selectedElementIds: string[]

  // Undo/Redo
  undoStack: CanvasCommand[]
  redoStack: CanvasCommand[]
  maxHistory: number

  // Zoom
  zoom: number

  // ─── Actions ──────────────────────────────────
  // Init
  initCanvas: (data?: CanvasData, contentId?: string, name?: string) => void
  setContentId: (id: string) => void
  setContentName: (name: string) => void
  markClean: () => void

  // Canvas settings
  setCanvasSize: (width: number, height: number) => void
  setCanvasBackground: (color: string) => void
  setZoom: (zoom: number) => void

  // Page management
  getCurrentPage: () => CanvasPage
  addPage: () => void
  deletePage: (index: number) => void
  setCurrentPage: (index: number) => void
  updatePageDuration: (index: number, duration: number) => void
  updatePageName: (index: number, name: string) => void
  reorderPages: (fromIndex: number, toIndex: number) => void
  duplicatePage: (index: number) => void

  // Element management
  addElement: (element: Partial<CanvasElement>) => void
  updateElement: (elementId: string, updates: Partial<CanvasElement>) => void
  deleteElement: (elementId: string) => void
  duplicateElement: (elementId: string) => void

  // Selection
  selectElement: (elementId: string | null) => void
  selectMultipleElements: (elementIds: string[]) => void

  // Layer ordering
  bringForward: (elementId: string) => void
  sendBackward: (elementId: string) => void
  bringToFront: (elementId: string) => void
  sendToBack: (elementId: string) => void

  // Undo/Redo
  executeCommand: (command: CanvasCommand) => void
  undo: () => void
  redo: () => void
  canUndo: () => boolean
  canRedo: () => boolean

  // Export
  getCanvasData: () => CanvasData
}

function createDefaultCanvasData(): CanvasData {
  return {
    version: '1.0',
    canvas: {
      width: 1920,
      height: 1080,
      orientation: 'landscape' as const,
      background: '#000000'
    },
    pages: [
      {
        id: uuidv4(),
        name: '페이지 1',
        duration: 10,
        transition: 'none',
        elements: []
      }
    ]
  }
}

export const useCanvasStore = create<CanvasStore>((set, get) => ({
  // Initial state
  contentId: null,
  contentName: '새 캔버스',
  isDirty: false,
  canvasData: createDefaultCanvasData(),
  currentPageIndex: 0,
  selectedElementId: null,
  selectedElementIds: [],
  undoStack: [],
  redoStack: [],
  maxHistory: 50,
  zoom: 1,

  // ─── Init ─────────────────────────────────────
  initCanvas: (data, contentId, name) => {
    set({
      canvasData: data || createDefaultCanvasData(),
      contentId: contentId || null,
      contentName: name || '새 캔버스',
      currentPageIndex: 0,
      selectedElementId: null,
      selectedElementIds: [],
      undoStack: [],
      redoStack: [],
      isDirty: false,
      zoom: 1
    })
  },

  setContentId: (id) => set({ contentId: id }),
  setContentName: (name) => set({ contentName: name, isDirty: true }),
  markClean: () => set({ isDirty: false }),

  // ─── Canvas settings ──────────────────────────
  setCanvasSize: (width, height) => set(state => ({
    canvasData: {
      ...state.canvasData,
      canvas: {
        ...state.canvasData.canvas,
        width, height,
        orientation: width >= height ? 'landscape' : 'portrait'
      }
    },
    isDirty: true
  })),

  setCanvasBackground: (color) => set(state => ({
    canvasData: {
      ...state.canvasData,
      canvas: { ...state.canvasData.canvas, background: color }
    },
    isDirty: true
  })),

  setZoom: (zoom) => set({ zoom: Math.max(0.1, Math.min(3, zoom)) }),

  // ─── Page management ──────────────────────────
  getCurrentPage: () => {
    const { canvasData, currentPageIndex } = get()
    return canvasData.pages[currentPageIndex] || canvasData.pages[0]
  },

  addPage: () => set(state => {
    const newPage: CanvasPage = {
      id: uuidv4(),
      name: `페이지 ${state.canvasData.pages.length + 1}`,
      duration: 10,
      transition: 'none',
      elements: []
    }
    return {
      canvasData: {
        ...state.canvasData,
        pages: [...state.canvasData.pages, newPage]
      },
      currentPageIndex: state.canvasData.pages.length,
      isDirty: true
    }
  }),

  deletePage: (index) => set(state => {
    if (state.canvasData.pages.length <= 1) return state
    const pages = state.canvasData.pages.filter((_, i) => i !== index)
    return {
      canvasData: { ...state.canvasData, pages },
      currentPageIndex: Math.min(state.currentPageIndex, pages.length - 1),
      selectedElementId: null,
      isDirty: true
    }
  }),

  setCurrentPage: (index) => set({
    currentPageIndex: index,
    selectedElementId: null,
    selectedElementIds: []
  }),

  updatePageDuration: (index, duration) => set(state => {
    const pages = [...state.canvasData.pages]
    pages[index] = { ...pages[index], duration }
    return { canvasData: { ...state.canvasData, pages }, isDirty: true }
  }),

  updatePageName: (index, name) => set(state => {
    const pages = [...state.canvasData.pages]
    pages[index] = { ...pages[index], name }
    return { canvasData: { ...state.canvasData, pages }, isDirty: true }
  }),

  reorderPages: (fromIndex, toIndex) => set(state => {
    const pages = [...state.canvasData.pages]
    const [moved] = pages.splice(fromIndex, 1)
    pages.splice(toIndex, 0, moved)
    return {
      canvasData: { ...state.canvasData, pages },
      currentPageIndex: toIndex,
      isDirty: true
    }
  }),

  duplicatePage: (index) => set(state => {
    const source = state.canvasData.pages[index]
    const newPage: CanvasPage = {
      ...JSON.parse(JSON.stringify(source)),
      id: uuidv4(),
      name: `${source.name} (복사)`,
      elements: source.elements.map(el => ({ ...el, id: uuidv4() }))
    }
    const pages = [...state.canvasData.pages]
    pages.splice(index + 1, 0, newPage)
    return {
      canvasData: { ...state.canvasData, pages },
      currentPageIndex: index + 1,
      isDirty: true
    }
  }),

  // ─── Element management ───────────────────────
  addElement: (element) => {
    const state = get()
    const pageIndex = state.currentPageIndex
    const maxZ = state.canvasData.pages[pageIndex].elements.reduce(
      (max, el) => Math.max(max, el.zIndex || 0), 0
    )

    const newId = uuidv4()
    // Center element on canvas if no explicit position given
    const { width: cw, height: ch } = state.canvasData.canvas
    const elW = element.width ?? 200
    const elH = element.height ?? 200
    const centerX = Math.round((cw - elW) / 2)
    const centerY = Math.round((ch - elH) / 2)

    const newElement: CanvasElement = {
      type: element.type || 'shape',
      id: newId,
      x: element.x ?? centerX,
      y: element.y ?? centerY,
      width: elW,
      height: elH,
      zIndex: maxZ + 1,
      opacity: 1,
      rotation: 0,
      locked: false,
      visible: true,
      ...element,
    }
    newElement.id = newId // always override with fresh id

    // Execute via command for undo support
    const command: CanvasCommand = {
      description: `${element.type} 추가`,
      execute: () => {
        set(s => {
          const pages = [...s.canvasData.pages]
          pages[pageIndex] = {
            ...pages[pageIndex],
            elements: [...pages[pageIndex].elements, newElement]
          }
          return {
            canvasData: { ...s.canvasData, pages },
            selectedElementId: newElement.id,
            isDirty: true
          }
        })
      },
      undo: () => {
        set(s => {
          const pages = [...s.canvasData.pages]
          pages[pageIndex] = {
            ...pages[pageIndex],
            elements: pages[pageIndex].elements.filter(el => el.id !== newElement.id)
          }
          return {
            canvasData: { ...s.canvasData, pages },
            selectedElementId: null,
            isDirty: true
          }
        })
      }
    }

    get().executeCommand(command)
  },

  updateElement: (elementId, updates) => {
    const state = get()
    const pageIndex = state.currentPageIndex
    const oldElement = state.canvasData.pages[pageIndex].elements.find(el => el.id === elementId)
    if (!oldElement) return

    const oldValues: Partial<CanvasElement> = {}
    for (const key of Object.keys(updates) as (keyof CanvasElement)[]) {
      (oldValues as any)[key] = (oldElement as any)[key]
    }

    const command: CanvasCommand = {
      description: '요소 수정',
      execute: () => {
        set(s => {
          const pages = [...s.canvasData.pages]
          pages[pageIndex] = {
            ...pages[pageIndex],
            elements: pages[pageIndex].elements.map(el =>
              el.id === elementId ? { ...el, ...updates } : el
            )
          }
          return { canvasData: { ...s.canvasData, pages }, isDirty: true }
        })
      },
      undo: () => {
        set(s => {
          const pages = [...s.canvasData.pages]
          pages[pageIndex] = {
            ...pages[pageIndex],
            elements: pages[pageIndex].elements.map(el =>
              el.id === elementId ? { ...el, ...oldValues } : el
            )
          }
          return { canvasData: { ...s.canvasData, pages }, isDirty: true }
        })
      }
    }

    get().executeCommand(command)
  },

  deleteElement: (elementId) => {
    const state = get()
    const pageIndex = state.currentPageIndex
    const element = state.canvasData.pages[pageIndex].elements.find(el => el.id === elementId)
    if (!element) return

    const command: CanvasCommand = {
      description: '요소 삭제',
      execute: () => {
        set(s => {
          const pages = [...s.canvasData.pages]
          pages[pageIndex] = {
            ...pages[pageIndex],
            elements: pages[pageIndex].elements.filter(el => el.id !== elementId)
          }
          return {
            canvasData: { ...s.canvasData, pages },
            selectedElementId: s.selectedElementId === elementId ? null : s.selectedElementId,
            isDirty: true
          }
        })
      },
      undo: () => {
        set(s => {
          const pages = [...s.canvasData.pages]
          pages[pageIndex] = {
            ...pages[pageIndex],
            elements: [...pages[pageIndex].elements, element]
          }
          return {
            canvasData: { ...s.canvasData, pages },
            selectedElementId: elementId,
            isDirty: true
          }
        })
      }
    }

    get().executeCommand(command)
  },

  duplicateElement: (elementId) => {
    const state = get()
    const page = state.canvasData.pages[state.currentPageIndex]
    const source = page.elements.find(el => el.id === elementId)
    if (!source) return

    get().addElement({
      ...source,
      x: source.x + 20,
      y: source.y + 20
    })
  },

  // ─── Selection ────────────────────────────────
  selectElement: (elementId) => set({
    selectedElementId: elementId,
    selectedElementIds: elementId ? [elementId] : []
  }),

  selectMultipleElements: (elementIds) => set({
    selectedElementIds: elementIds,
    selectedElementId: elementIds[0] || null
  }),

  // ─── Layer ordering ───────────────────────────
  bringForward: (elementId) => set(state => {
    const pages = [...state.canvasData.pages]
    const page = pages[state.currentPageIndex]
    const sorted = [...page.elements].sort((a, b) => a.zIndex - b.zIndex)
    const idx = sorted.findIndex(el => el.id === elementId)
    if (idx < sorted.length - 1) {
      const temp = sorted[idx].zIndex
      sorted[idx] = { ...sorted[idx], zIndex: sorted[idx + 1].zIndex }
      sorted[idx + 1] = { ...sorted[idx + 1], zIndex: temp }
    }
    pages[state.currentPageIndex] = { ...page, elements: sorted }
    return { canvasData: { ...state.canvasData, pages }, isDirty: true }
  }),

  sendBackward: (elementId) => set(state => {
    const pages = [...state.canvasData.pages]
    const page = pages[state.currentPageIndex]
    const sorted = [...page.elements].sort((a, b) => a.zIndex - b.zIndex)
    const idx = sorted.findIndex(el => el.id === elementId)
    if (idx > 0) {
      const temp = sorted[idx].zIndex
      sorted[idx] = { ...sorted[idx], zIndex: sorted[idx - 1].zIndex }
      sorted[idx - 1] = { ...sorted[idx - 1], zIndex: temp }
    }
    pages[state.currentPageIndex] = { ...page, elements: sorted }
    return { canvasData: { ...state.canvasData, pages }, isDirty: true }
  }),

  bringToFront: (elementId) => set(state => {
    const pages = [...state.canvasData.pages]
    const page = pages[state.currentPageIndex]
    const maxZ = page.elements.reduce((max, el) => Math.max(max, el.zIndex), 0)
    pages[state.currentPageIndex] = {
      ...page,
      elements: page.elements.map(el =>
        el.id === elementId ? { ...el, zIndex: maxZ + 1 } : el
      )
    }
    return { canvasData: { ...state.canvasData, pages }, isDirty: true }
  }),

  sendToBack: (elementId) => set(state => {
    const pages = [...state.canvasData.pages]
    const page = pages[state.currentPageIndex]
    const minZ = page.elements.reduce((min, el) => Math.min(min, el.zIndex), Infinity)
    pages[state.currentPageIndex] = {
      ...page,
      elements: page.elements.map(el =>
        el.id === elementId ? { ...el, zIndex: minZ - 1 } : el
      )
    }
    return { canvasData: { ...state.canvasData, pages }, isDirty: true }
  }),

  // ─── Undo/Redo ────────────────────────────────
  executeCommand: (command) => {
    command.execute()
    set(state => ({
      undoStack: [...state.undoStack.slice(-(state.maxHistory - 1)), command],
      redoStack: []
    }))
  },

  undo: () => {
    const { undoStack } = get()
    if (undoStack.length === 0) return
    const command = undoStack[undoStack.length - 1]
    command.undo()
    set(state => ({
      undoStack: state.undoStack.slice(0, -1),
      redoStack: [...state.redoStack, command]
    }))
  },

  redo: () => {
    const { redoStack } = get()
    if (redoStack.length === 0) return
    const command = redoStack[redoStack.length - 1]
    command.execute()
    set(state => ({
      redoStack: state.redoStack.slice(0, -1),
      undoStack: [...state.undoStack, command]
    }))
  },

  canUndo: () => get().undoStack.length > 0,
  canRedo: () => get().redoStack.length > 0,

  // ─── Export ───────────────────────────────────
  getCanvasData: () => get().canvasData
}))
