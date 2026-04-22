/**
 * VueSign Phase W1: Canvas v2.0 Stage (HTML 기반, Fabric.js 제거)
 *
 * 구조:
 *   - 배경색 + 배경 이미지 (img 태그)
 *   - 각 요소는 absolute 포지션된 div
 *   - 선택/이동/리사이즈는 자체 마우스 이벤트로 처리
 *
 * 지원 요소 타입:
 *   - text   : <div contentEditable>
 *   - image  : <img>
 *   - widget : <WeatherWidgets>
 */
import { useRef, useState, useCallback, useEffect } from 'react'
import { useCanvasStore } from '@/store/canvasStore'
import { CanvasElement } from '@/api/canvas'
import WeatherWidgets from './widgets/WeatherWidgets'

type ResizeHandle = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'

interface DragState {
  elementId: string
  startX: number
  startY: number
  origX: number
  origY: number
  origW: number
  origH: number
  mode: 'move' | ResizeHandle
}

export default function CanvasStage() {
  const stageRef = useRef<HTMLDivElement>(null)
  const [drag, setDrag] = useState<DragState | null>(null)

  const {
    canvasData,
    zoom,
    selectedElementId,
    selectElement,
    updateElement,
  } = useCanvasStore()

  const { width, height, backgroundColor, backgroundImage, backgroundFit = 'cover' } = canvasData.canvas

  // ─── Drag/Resize 이벤트 ─────────────────────
  const handleMouseDown = useCallback(
    (e: React.MouseEvent, element: CanvasElement, mode: 'move' | ResizeHandle) => {
      e.stopPropagation()
      e.preventDefault()
      if (element.locked) return

      selectElement(element.id)

      setDrag({
        elementId: element.id,
        startX: e.clientX,
        startY: e.clientY,
        origX: element.x,
        origY: element.y,
        origW: element.width,
        origH: element.height,
        mode,
      })
    },
    [selectElement]
  )

  // 전역 mousemove/mouseup 리스너
  useEffect(() => {
    if (!drag) return

    const handleMove = (e: MouseEvent) => {
      const dx = (e.clientX - drag.startX) / zoom
      const dy = (e.clientY - drag.startY) / zoom

      if (drag.mode === 'move') {
        updateElement(drag.elementId, {
          x: Math.round(drag.origX + dx),
          y: Math.round(drag.origY + dy),
        })
      } else {
        const updates: Partial<CanvasElement> = {}
        let nx = drag.origX
        let ny = drag.origY
        let nw = drag.origW
        let nh = drag.origH

        if (drag.mode.includes('e')) nw = Math.max(20, drag.origW + dx)
        if (drag.mode.includes('w')) {
          nw = Math.max(20, drag.origW - dx)
          nx = drag.origX + (drag.origW - nw)
        }
        if (drag.mode.includes('s')) nh = Math.max(20, drag.origH + dy)
        if (drag.mode.includes('n')) {
          nh = Math.max(20, drag.origH - dy)
          ny = drag.origY + (drag.origH - nh)
        }

        updates.x = Math.round(nx)
        updates.y = Math.round(ny)
        updates.width = Math.round(nw)
        updates.height = Math.round(nh)
        updateElement(drag.elementId, updates)
      }
    }

    const handleUp = () => setDrag(null)

    window.addEventListener('mousemove', handleMove)
    window.addEventListener('mouseup', handleUp)
    return () => {
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('mouseup', handleUp)
    }
  }, [drag, zoom, updateElement])

  // ─── Stage 클릭 시 선택 해제 ─────────────────
  const handleStageClick = (e: React.MouseEvent) => {
    if (e.target === stageRef.current || (e.target as HTMLElement).dataset.stageBg === '1') {
      selectElement(null)
    }
  }

  // ─── 정렬: zIndex 기준 오름차순 렌더 ─────────
  const sortedElements = [...canvasData.elements].sort((a, b) => a.zIndex - b.zIndex)

  return (
    <div className="flex-1 bg-gray-800 overflow-auto flex items-center justify-center p-8">
      <div
        ref={stageRef}
        onMouseDown={handleStageClick}
        className="shadow-2xl relative"
        style={{
          width: width * zoom,
          height: height * zoom,
          backgroundColor,
          backgroundImage: backgroundImage ? `url(${backgroundImage})` : undefined,
          backgroundSize: backgroundFit === 'fill' ? '100% 100%' : backgroundFit,
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        }}
        data-stage-bg="1"
      >
        {sortedElements.map(element => {
          if (element.visible === false) return null
          const isSelected = selectedElementId === element.id

          return (
            <ElementBox
              key={element.id}
              element={element}
              zoom={zoom}
              isSelected={isSelected}
              onMouseDown={handleMouseDown}
            />
          )
        })}
      </div>
    </div>
  )
}

// ─── 개별 요소 박스 ─────────────────────
interface ElementBoxProps {
  element: CanvasElement
  zoom: number
  isSelected: boolean
  onMouseDown: (e: React.MouseEvent, element: CanvasElement, mode: 'move' | ResizeHandle) => void
}

function ElementBox({ element, zoom, isSelected, onMouseDown }: ElementBoxProps) {
  const style: React.CSSProperties = {
    position: 'absolute',
    left: element.x * zoom,
    top: element.y * zoom,
    width: element.width * zoom,
    height: element.height * zoom,
    opacity: element.opacity ?? 1,
    transform: `rotate(${element.rotation || 0}deg)`,
    zIndex: element.zIndex,
    cursor: element.locked ? 'default' : 'move',
    outline: isSelected ? '2px solid #3B82F6' : undefined,
    outlineOffset: isSelected ? '1px' : undefined,
    boxSizing: 'border-box',
  }

  return (
    <div style={style} onMouseDown={e => onMouseDown(e, element, 'move')}>
      <ElementContent element={element} zoom={zoom} />

      {isSelected && !element.locked && (
        <>
          {/* 모서리 리사이즈 핸들 */}
          {(['nw', 'ne', 'sw', 'se'] as ResizeHandle[]).map(pos => (
            <div
              key={pos}
              onMouseDown={e => onMouseDown(e, element, pos)}
              style={{
                position: 'absolute',
                width: 10,
                height: 10,
                background: '#3B82F6',
                border: '2px solid #FFFFFF',
                borderRadius: '50%',
                cursor: `${pos}-resize`,
                ...(pos.includes('n') ? { top: -5 } : { bottom: -5 }),
                ...(pos.includes('w') ? { left: -5 } : { right: -5 }),
              }}
            />
          ))}
          {/* 변 리사이즈 핸들 (옵션) */}
          {(['n', 's', 'e', 'w'] as ResizeHandle[]).map(pos => {
            const isVertical = pos === 'e' || pos === 'w'
            return (
              <div
                key={pos}
                onMouseDown={e => onMouseDown(e, element, pos)}
                style={{
                  position: 'absolute',
                  width: isVertical ? 8 : '100%',
                  height: isVertical ? '100%' : 8,
                  cursor: `${pos}-resize`,
                  ...(pos === 'n' ? { top: -4, left: 0 } : {}),
                  ...(pos === 's' ? { bottom: -4, left: 0 } : {}),
                  ...(pos === 'e' ? { right: -4, top: 0 } : {}),
                  ...(pos === 'w' ? { left: -4, top: 0 } : {}),
                }}
              />
            )
          })}
        </>
      )}
    </div>
  )
}

// ─── 요소 실제 렌더링 ─────────────────────
function ElementContent({ element, zoom }: { element: CanvasElement; zoom: number }) {
  const common: React.CSSProperties = {
    width: '100%',
    height: '100%',
    pointerEvents: 'none', // 컨테이너에서 드래그 받음
  }

  if (element.type === 'text') {
    const style: React.CSSProperties = {
      ...common,
      color: element.color || '#FFFFFF',
      fontFamily: element.fontFamily || 'Noto Sans KR',
      fontSize: (element.fontSize || 32) * zoom,
      fontWeight: element.bold ? 'bold' : 'normal',
      fontStyle: element.italic ? 'italic' : 'normal',
      textDecoration: element.underline ? 'underline' : undefined,
      textAlign: (element.textAlign || 'left') as React.CSSProperties['textAlign'],
      lineHeight: element.lineHeight || 1.3,
      textShadow: element.textShadow,
      wordBreak: 'break-word',
      whiteSpace: 'pre-wrap',
      padding: 4,
      display: 'flex',
      alignItems: 'center',
      justifyContent:
        (element.textAlign || 'left') === 'center' ? 'center' :
        (element.textAlign || 'left') === 'right' ? 'flex-end' : 'flex-start',
    }
    return <div style={style}>{element.content || '텍스트'}</div>
  }

  if (element.type === 'image') {
    if (!element.src) {
      return (
        <div
          style={{
            ...common,
            background: 'rgba(55, 65, 81, 0.5)',
            border: '2px dashed #6B7280',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#9CA3AF',
            fontSize: 12 * zoom,
          }}
        >
          이미지 없음
        </div>
      )
    }
    return (
      <img
        src={element.src}
        alt=""
        style={{
          ...common,
          objectFit: element.fit || 'cover',
        }}
        draggable={false}
      />
    )
  }

  if (element.type === 'widget' && element.widget) {
    return (
      <div style={{ ...common, transform: `scale(${zoom})`, transformOrigin: 'top left', width: element.width, height: element.height }}>
        <WeatherWidgets
          widget={element.widget}
          config={element.config || {}}
          width={element.width}
          height={element.height}
        />
      </div>
    )
  }

  return null
}
