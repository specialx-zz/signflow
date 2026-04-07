/**
 * V4 Phase 12b: Fabric.js 캔버스 스테이지
 * - JSON <-> Fabric.js 양방향 동기화
 * - 위젯 요소를 HTML 오버레이로 렌더링
 * - 애니메이션 지원
 */
import { useRef, useEffect, useCallback, useMemo } from 'react'
import { Canvas as FabricCanvas, Rect, Circle, Textbox, FabricImage, Triangle as FabricTriangle, Line, Path } from 'fabric'
import { useCanvasStore } from '@/store/canvasStore'
import { CanvasElement } from '@/api/canvas'

// Widget components (lazy-friendly)
import ClockWidget from './widgets/ClockWidget'
import WeatherWidget from './widgets/WeatherWidget'
import RSSWidget from './widgets/RSSWidget'
import QRCodeWidget from './widgets/QRCodeWidget'
import VideoWidget from './widgets/VideoWidget'
import WebpageWidget from './widgets/WebpageWidget'
import SpreadsheetWidget from './widgets/SpreadsheetWidget'
import ChartWidget from './widgets/ChartWidget'

const WIDGET_COMPONENTS: Record<string, React.FC<any>> = {
  clock: ClockWidget,
  weather: WeatherWidget,
  rss: RSSWidget,
  qrcode: QRCodeWidget,
  video: VideoWidget,
  webpage: WebpageWidget,
  spreadsheet: SpreadsheetWidget,
  chart: ChartWidget,
}

export default function CanvasStage() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fabricRef = useRef<FabricCanvas | null>(null)
  const isSyncingRef = useRef(false)

  const {
    canvasData, currentPageIndex, zoom,
    selectedElementId, selectElement,
    updateElement, getCurrentPage
  } = useCanvasStore()

  const page = getCurrentPage()
  const { width, height, background } = canvasData.canvas

  // Separate widget elements from fabric elements
  const widgetElements = useMemo(
    () => page.elements.filter(el => el.type === 'widget' && el.visible !== false),
    [page.elements]
  )
  const fabricElements = useMemo(
    () => page.elements.filter(el => el.type !== 'widget'),
    [page.elements]
  )

  // ─── Fabric.js 초기화 ─────────────────────────
  useEffect(() => {
    if (!canvasRef.current || fabricRef.current) return

    const canvas = new FabricCanvas(canvasRef.current, {
      width,
      height,
      backgroundColor: background,
      selection: true,
      preserveObjectStacking: true,
    })

    fabricRef.current = canvas

    // 선택 이벤트
    canvas.on('selection:created', (e) => {
      const obj = e.selected?.[0]
      if (obj && (obj as any)._elementId) {
        selectElement((obj as any)._elementId)
      }
    })

    canvas.on('selection:updated', (e) => {
      const obj = e.selected?.[0]
      if (obj && (obj as any)._elementId) {
        selectElement((obj as any)._elementId)
      }
    })

    canvas.on('selection:cleared', () => {
      selectElement(null)
    })

    // 이동/리사이즈 완료 이벤트 → store 동기화
    canvas.on('object:modified', (e) => {
      const obj = e.target
      if (!obj || !(obj as any)._elementId) return
      isSyncingRef.current = true

      const elementId = (obj as any)._elementId
      const scaleX = obj.scaleX || 1
      const scaleY = obj.scaleY || 1

      updateElement(elementId, {
        x: Math.round(obj.left || 0),
        y: Math.round(obj.top || 0),
        width: Math.round((obj.width || 0) * scaleX),
        height: Math.round((obj.height || 0) * scaleY),
        rotation: Math.round(obj.angle || 0),
      })

      // 스케일을 1로 리셋
      obj.set({ scaleX: 1, scaleY: 1 })
      obj.setCoords()

      setTimeout(() => { isSyncingRef.current = false }, 50)
    })

    return () => {
      canvas.dispose()
      fabricRef.current = null
    }
  }, [])

  // ─── 캔버스 크기/배경 변경 ───────────────────
  useEffect(() => {
    const canvas = fabricRef.current
    if (!canvas) return
    canvas.setDimensions({ width, height })
    canvas.backgroundColor = background
    canvas.requestRenderAll()
  }, [width, height, background])

  // ─── 줌 적용 ────────────────────────────────
  useEffect(() => {
    const canvas = fabricRef.current
    if (!canvas) return
    canvas.setZoom(zoom)
    canvas.setDimensions({
      width: width * zoom,
      height: height * zoom
    })
  }, [zoom, width, height])

  // ─── 페이지/요소 변경 시 Fabric 동기화 ──────────
  useEffect(() => {
    const canvas = fabricRef.current
    if (!canvas || isSyncingRef.current) return

    // 기존 객체 모두 제거
    canvas.clear()
    canvas.backgroundColor = background

    // 위젯이 아닌 요소만 Fabric에 추가 (위젯은 HTML 오버레이)
    const sortedElements = [...fabricElements].sort((a, b) => a.zIndex - b.zIndex)

    for (const element of sortedElements) {
      if (element.visible === false) continue
      const obj = createFabricObject(element)
      if (obj) {
        (obj as any)._elementId = element.id
        obj.set({
          selectable: !element.locked,
          evented: !element.locked,
          hasControls: !element.locked,
          opacity: element.opacity ?? 1,
        })
        canvas.add(obj)
      }
    }

    // 위젯 요소에 대해 투명 프록시 Rect 추가 (드래그/리사이즈 지원)
    // pointerEvents: 'none' on HTML overlay means all mouse events go through to these proxy Rects
    const sortedWidgets = [...widgetElements].sort((a, b) => a.zIndex - b.zIndex)
    for (const element of sortedWidgets) {
      if (element.visible === false) continue
      const proxy = new Rect({
        left: element.x,
        top: element.y,
        width: element.width,
        height: element.height,
        angle: element.rotation || 0,
        fill: 'rgba(59, 130, 246, 0.05)',
        stroke: 'rgba(59, 130, 246, 0.3)',
        strokeWidth: 1,
        strokeDashArray: [6, 3],
        selectable: !element.locked,
        evented: !element.locked,
        hasControls: true,
        hasBorders: true,
        cornerColor: '#3B82F6',
        cornerStyle: 'circle',
        cornerSize: 8,
        transparentCorners: false,
        borderColor: '#3B82F6',
      });
      (proxy as any)._elementId = element.id;
      (proxy as any)._isWidgetProxy = true
      canvas.add(proxy)
    }

    canvas.requestRenderAll()
  }, [fabricElements, widgetElements, currentPageIndex, background])

  // ─── 선택 상태 동기화 (store → fabric) ────────
  useEffect(() => {
    const canvas = fabricRef.current
    if (!canvas) return

    if (!selectedElementId) {
      canvas.discardActiveObject()
      canvas.requestRenderAll()
      return
    }

    const objects = canvas.getObjects()
    const target = objects.find(obj => (obj as any)._elementId === selectedElementId)
    if (target) {
      canvas.setActiveObject(target)
      canvas.requestRenderAll()
    }
  }, [selectedElementId])

  // ─── 애니메이션 CSS 클래스 생성 ─────────────────
  const getAnimationStyle = (element: CanvasElement): React.CSSProperties => {
    const anim = (element as any).animation
    if (!anim) return {}

    const styles: React.CSSProperties = {}
    const enter = anim.enter || 'none'
    const loop = anim.loop || 'none'
    const duration = anim.duration || 0.5
    const delay = anim.delay || 0
    const easing = anim.easing || 'ease'

    if (enter !== 'none') {
      styles.animation = `${enter} ${duration}s ${easing} ${delay}s both`
    }
    if (loop !== 'none') {
      const loopAnim = `${loop} ${duration}s ${easing} ${delay}s infinite`
      styles.animation = styles.animation ? `${styles.animation}, ${loopAnim}` : loopAnim
    }

    return styles
  }

  return (
    <div className="flex-1 bg-gray-800 overflow-auto flex items-center justify-center p-8">
      <div
        className="shadow-2xl relative"
        style={{ width: width * zoom, height: height * zoom }}
      >
        {/* Fabric.js Canvas (non-widget elements) */}
        <canvas ref={canvasRef} />

        {/* Widget HTML Overlays — pointerEvents: 'none' so Fabric proxy Rects receive drag/resize */}
        {widgetElements.map(element => {
          const WidgetComponent = WIDGET_COMPONENTS[element.widget || '']
          if (!WidgetComponent) return null

          return (
            <div
              key={element.id}
              className={`absolute ${selectedElementId === element.id ? 'ring-2 ring-blue-500 ring-offset-1' : ''}`}
              style={{
                left: element.x * zoom,
                top: element.y * zoom,
                width: element.width * zoom,
                height: element.height * zoom,
                opacity: element.opacity ?? 1,
                transform: `rotate(${element.rotation || 0}deg)`,
                zIndex: element.zIndex + 1000,
                pointerEvents: 'none',
                ...getAnimationStyle(element),
              }}
            >
              <WidgetComponent
                config={element.config || {}}
                width={element.width}
                height={element.height}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Element → Fabric Object 변환 ─────────────────
function createFabricObject(element: CanvasElement) {
  const baseProps = {
    left: element.x,
    top: element.y,
    angle: element.rotation || 0,
  }

  switch (element.type) {
    case 'text': {
      const textbox = new Textbox(element.content || '텍스트', {
        ...baseProps,
        width: element.width,
        fontSize: element.fontSize || 32,
        fontFamily: element.fontFamily || 'Noto Sans KR',
        fill: element.color || '#FFFFFF',
        fontWeight: element.bold ? 'bold' : 'normal',
        fontStyle: element.italic ? 'italic' : 'normal',
        underline: element.underline || false,
        textAlign: element.textAlign || 'left',
        lineHeight: element.lineHeight || 1.2,
      })
      return textbox
    }

    case 'shape': {
      switch (element.shape) {
        case 'rect':
          return new Rect({
            ...baseProps,
            width: element.width,
            height: element.height,
            fill: element.fill || '#3B82F6',
            stroke: element.stroke || '',
            strokeWidth: element.strokeWidth || 0,
            rx: element.borderRadius || 0,
            ry: element.borderRadius || 0,
          })

        case 'circle':
          return new Circle({
            ...baseProps,
            radius: Math.min(element.width, element.height) / 2,
            fill: element.fill || '#10B981',
            stroke: element.stroke || '',
            strokeWidth: element.strokeWidth || 0,
          })

        case 'triangle':
          return new FabricTriangle({
            ...baseProps,
            width: element.width,
            height: element.height,
            fill: element.fill || '#F59E0B',
            stroke: element.stroke || '',
            strokeWidth: element.strokeWidth || 0,
          })

        case 'line':
          return new Line(
            [0, 0, element.width, 0],
            {
              ...baseProps,
              stroke: element.stroke || element.fill || '#FFFFFF',
              strokeWidth: element.strokeWidth || 2,
            }
          )

        case 'arrow': {
          const w = element.width
          const h = Math.max(element.height, 4)
          const headLen = Math.min(20, w * 0.2)
          const headW = Math.max(h * 2, 10)
          const midY = h / 2
          const pathStr = [
            `M 0 ${midY}`,
            `L ${w - headLen} ${midY}`,
            `M ${w - headLen} ${midY - headW/2}`,
            `L ${w} ${midY}`,
            `L ${w - headLen} ${midY + headW/2}`,
          ].join(' ')
          return new Path(pathStr, {
            ...baseProps,
            stroke: element.stroke || element.fill || '#FFFFFF',
            strokeWidth: element.strokeWidth || 2,
            fill: '',
            width: w,
            height: h,
          })
        }

        default:
          return new Rect({
            ...baseProps,
            width: element.width,
            height: element.height,
            fill: element.fill || '#3B82F6',
          })
      }
    }

    case 'image': {
      if (!element.src) {
        return new Rect({
          ...baseProps,
          width: element.width,
          height: element.height,
          fill: '#374151',
          stroke: '#6B7280',
          strokeWidth: 1,
          strokeDashArray: [5, 5],
        })
      }
      return new Rect({
        ...baseProps,
        width: element.width,
        height: element.height,
        fill: '#1F2937',
      })
    }

    default:
      return null
  }
}
