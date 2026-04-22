/**
 * VueSign Phase W1: Canvas v2.0 Player Renderer
 *
 * 특징:
 *   - 단일 페이지(flat elements) 렌더링 (v1 pages 개념 제거)
 *   - 배경: backgroundColor + backgroundImage(fit: contain/cover/fill)
 *   - 요소 타입: text, image, widget (shape 제거, legacy v1 shape 는 무시)
 *   - widget: 날씨/대기질 위젯 9종을 WeatherWidgetsPlayer 로 위임
 *
 * 동작:
 *   - Canvas 컨텐츠 자체는 "끝" 개념이 없으므로 PlaylistItem.duration 을 사용해
 *     ContentRenderer 에서 onEnded 를 호출한다. 하지만 기존 호환성을 위해
 *     props.onEnded 가 호출되지 않아도 ContentRenderer 의 duration 타이머가
 *     V2 캔버스에도 적용되도록 CanvasRenderer 는 의무적으로 onEnded 를 호출하지 않는다.
 *     (CanvasRenderer 내부에서 time-based 로 호출하지 않음.)
 *
 * 레거시 v1 지원:
 *   - version !== '2.0' 인 경우 pages[0].elements 를 사용하고 shape 는 필터링한다.
 */
import React, { useMemo } from 'react'
import type { CanvasData, CanvasElement, WidgetKey, WidgetConfig } from '../types'
import WeatherWidgetsPlayer from './WeatherWidgetsPlayer'

interface CanvasRendererProps {
  canvasData: CanvasData
  onEnded: () => void
  width?: number
  height?: number
}

// ─── v1 → v2 정규화 ─────────────────────────────
interface NormalizedCanvas {
  width: number
  height: number
  backgroundColor: string
  backgroundImage?: string
  backgroundFit: 'contain' | 'cover' | 'fill'
  elements: CanvasElement[]
}

function normalize(data: CanvasData): NormalizedCanvas {
  const width = data.canvas?.width || 1920
  const height = data.canvas?.height || 1080
  const backgroundColor =
    data.canvas?.backgroundColor || data.canvas?.background || '#000000'
  const backgroundImage = data.canvas?.backgroundImage
  const backgroundFit = (data.canvas?.backgroundFit || 'cover') as
    | 'contain'
    | 'cover'
    | 'fill'

  // v2.0: elements 직접 사용
  let rawElements: CanvasElement[] = []
  if (data.version === '2.0' && Array.isArray(data.elements)) {
    rawElements = data.elements
  } else if (Array.isArray(data.elements)) {
    rawElements = data.elements
  } else if (Array.isArray(data.pages) && data.pages[0]?.elements) {
    // 레거시 v1: 첫 페이지만 사용
    rawElements = data.pages[0].elements || []
  }

  // shape 제거, visible !== false 만 남김
  const elements = rawElements
    .filter((el) => el && el.type !== 'shape' && el.visible !== false)
    .sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0))

  return {
    width,
    height,
    backgroundColor,
    backgroundImage,
    backgroundFit,
    elements,
  }
}

// ─── 메인 Renderer ───────────────────────────────
export default function CanvasRenderer({
  canvasData,
  width,
  height,
}: CanvasRendererProps) {
  const normalized = useMemo(() => normalize(canvasData), [canvasData])

  // Container dimensions — scale to fit
  const containerWidth = width || window.innerWidth
  const containerHeight = height || window.innerHeight
  const scaleX = containerWidth / normalized.width
  const scaleY = containerHeight / normalized.height
  const scale = Math.min(scaleX, scaleY)

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: normalized.backgroundColor,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'relative',
          width: normalized.width,
          height: normalized.height,
          transform: `scale(${scale})`,
          transformOrigin: 'center center',
          background: normalized.backgroundColor,
        }}
      >
        {/* 배경 이미지 */}
        {normalized.backgroundImage && (
          <img
            src={normalized.backgroundImage}
            alt=""
            draggable={false}
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: normalized.backgroundFit,
              pointerEvents: 'none',
              userSelect: 'none',
            }}
          />
        )}

        {/* 요소 */}
        {normalized.elements.map((element) => (
          <ElementRenderer key={element.id} element={element} />
        ))}
      </div>
    </div>
  )
}

// ─── Element Renderer ───────────────────────────
function ElementRenderer({ element }: { element: CanvasElement }) {
  const wrapperStyle: React.CSSProperties = {
    position: 'absolute',
    left: element.x,
    top: element.y,
    width: element.width,
    height: element.height,
    opacity: element.opacity ?? 1,
    transform: element.rotation ? `rotate(${element.rotation}deg)` : undefined,
    zIndex: element.zIndex,
    overflow: 'hidden',
  }

  switch (element.type) {
    case 'text':
      return (
        <div style={wrapperStyle}>
          <div
            style={{
              width: '100%',
              height: '100%',
              fontSize: element.fontSize || 32,
              fontFamily: element.fontFamily || 'Noto Sans KR, sans-serif',
              color: element.color || '#FFFFFF',
              fontWeight: element.bold ? 'bold' : 'normal',
              fontStyle: element.italic ? 'italic' : 'normal',
              textDecoration: element.underline ? 'underline' : 'none',
              textAlign: (element.textAlign as 'left' | 'center' | 'right') || 'left',
              lineHeight: element.lineHeight || 1.2,
              textShadow: element.textShadow,
              wordBreak: 'break-word',
              whiteSpace: 'pre-wrap',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            {element.content || ''}
          </div>
        </div>
      )

    case 'image':
      return (
        <div style={wrapperStyle}>
          {element.src ? (
            <img
              src={element.src}
              alt=""
              draggable={false}
              style={{
                width: '100%',
                height: '100%',
                objectFit: (element.fit as 'cover' | 'contain' | 'fill') || 'cover',
                userSelect: 'none',
              }}
            />
          ) : (
            <div style={{ width: '100%', height: '100%', background: '#374151' }} />
          )}
        </div>
      )

    case 'widget':
      return (
        <WeatherWidgetsPlayer
          widget={(element.widget || 'weather.current') as WidgetKey}
          config={(element.config || {}) as WidgetConfig}
          width={element.width}
          height={element.height}
          style={wrapperStyle}
        />
      )

    default:
      // 레거시 shape 등은 빈 박스로 처리 (이미 filter 단계에서 제거되지만 안전장치)
      return <div style={wrapperStyle} />
  }
}
