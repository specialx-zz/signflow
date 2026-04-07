/**
 * Canvas Content Renderer for Player
 * Renders canvas JSON data (pages with elements/widgets) as HTML
 */
import React, { useState, useEffect, useRef } from 'react'
import type { CanvasData, CanvasPage, CanvasElement } from '../types'

interface CanvasRendererProps {
  canvasData: CanvasData
  onEnded: () => void
  width?: number
  height?: number
}

export default function CanvasRenderer({ canvasData, onEnded, width, height }: CanvasRendererProps) {
  const [currentPageIndex, setCurrentPageIndex] = useState(0)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const { canvas, pages } = canvasData

  // Container dimensions — scale to fit
  const containerWidth = width || window.innerWidth
  const containerHeight = height || window.innerHeight
  const scaleX = containerWidth / canvas.width
  const scaleY = containerHeight / canvas.height
  const scale = Math.min(scaleX, scaleY)

  // Auto-advance pages, then call onEnded when all done
  useEffect(() => {
    if (!pages || pages.length === 0) return

    const page = pages[currentPageIndex]
    const duration = (page?.duration || 10) * 1000

    timerRef.current = setTimeout(() => {
      if (currentPageIndex < pages.length - 1) {
        setCurrentPageIndex(prev => prev + 1)
      } else {
        // All pages done
        onEnded()
      }
    }, duration)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [currentPageIndex, pages, onEnded])

  if (!pages || pages.length === 0) {
    return <div style={{ background: '#000', width: '100%', height: '100%' }} />
  }

  const page = pages[currentPageIndex]

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
        background: canvas.background || '#000',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'relative',
          width: canvas.width,
          height: canvas.height,
          transform: `scale(${scale})`,
          transformOrigin: 'center center',
          background: canvas.background || '#000',
        }}
      >
        {page.elements
          .filter(el => el.visible !== false)
          .sort((a, b) => a.zIndex - b.zIndex)
          .map(element => (
            <ElementRenderer key={element.id} element={element} />
          ))}
      </div>
    </div>
  )
}

// ─── Element Renderer ─────────────────────────
function ElementRenderer({ element }: { element: CanvasElement }) {
  const animStyle = getAnimationStyle(element)

  const wrapperStyle: React.CSSProperties = {
    position: 'absolute',
    left: element.x,
    top: element.y,
    width: element.width,
    height: element.height,
    opacity: element.opacity ?? 1,
    transform: `rotate(${element.rotation || 0}deg)`,
    zIndex: element.zIndex,
    overflow: 'hidden',
    ...animStyle,
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
              textAlign: (element.textAlign as any) || 'left',
              lineHeight: element.lineHeight || 1.2,
              wordBreak: 'break-word',
              whiteSpace: 'pre-wrap',
            }}
          >
            {element.content || ''}
          </div>
        </div>
      )

    case 'shape':
      return <ShapeRenderer element={element} style={wrapperStyle} />

    case 'image':
      return (
        <div style={wrapperStyle}>
          {element.src ? (
            <img
              src={element.src}
              alt=""
              style={{
                width: '100%',
                height: '100%',
                objectFit: (element.fit as any) || 'cover',
              }}
            />
          ) : (
            <div style={{ width: '100%', height: '100%', background: '#374151' }} />
          )}
        </div>
      )

    case 'widget':
      return <WidgetRenderer element={element} style={wrapperStyle} />

    default:
      return <div style={wrapperStyle} />
  }
}

// ─── Shape Renderer ─────────────────────────
function ShapeRenderer({ element, style }: { element: CanvasElement; style: React.CSSProperties }) {
  const { shape, fill, stroke, strokeWidth, borderRadius } = element

  switch (shape) {
    case 'rect':
      return (
        <div
          style={{
            ...style,
            background: fill || '#3B82F6',
            border: stroke ? `${strokeWidth || 1}px solid ${stroke}` : undefined,
            borderRadius: borderRadius || 0,
          }}
        />
      )

    case 'circle':
      return (
        <div
          style={{
            ...style,
            background: fill || '#10B981',
            border: stroke ? `${strokeWidth || 1}px solid ${stroke}` : undefined,
            borderRadius: '50%',
          }}
        />
      )

    case 'triangle':
      return (
        <div style={style}>
          <svg width="100%" height="100%" viewBox={`0 0 ${element.width} ${element.height}`}>
            <polygon
              points={`${element.width / 2},0 ${element.width},${element.height} 0,${element.height}`}
              fill={fill || '#F59E0B'}
              stroke={stroke || 'none'}
              strokeWidth={strokeWidth || 0}
            />
          </svg>
        </div>
      )

    case 'line':
      return (
        <div style={style}>
          <svg width="100%" height="100%">
            <line
              x1="0" y1={element.height / 2}
              x2={element.width} y2={element.height / 2}
              stroke={stroke || fill || '#FFFFFF'}
              strokeWidth={strokeWidth || 2}
            />
          </svg>
        </div>
      )

    case 'arrow':
      const w = element.width
      const h = Math.max(element.height, 4)
      const headLen = Math.min(20, w * 0.2)
      const headW = Math.max(h * 2, 10)
      const midY = h / 2
      return (
        <div style={style}>
          <svg width="100%" height="100%" viewBox={`0 0 ${w} ${h}`}>
            <line x1="0" y1={midY} x2={w - headLen} y2={midY}
              stroke={stroke || fill || '#FFFFFF'} strokeWidth={strokeWidth || 2} />
            <polyline
              points={`${w - headLen},${midY - headW / 2} ${w},${midY} ${w - headLen},${midY + headW / 2}`}
              fill="none" stroke={stroke || fill || '#FFFFFF'} strokeWidth={strokeWidth || 2}
            />
          </svg>
        </div>
      )

    default:
      return (
        <div style={{ ...style, background: fill || '#3B82F6', borderRadius: borderRadius || 0 }} />
      )
  }
}

// ─── Widget Renderer (simplified for player) ─────────────────────────
function WidgetRenderer({ element, style }: { element: CanvasElement; style: React.CSSProperties }) {
  const config = element.config || {}

  switch (element.widget) {
    case 'clock':
      return <ClockWidgetPlayer config={config} style={style} />

    case 'weather':
      return (
        <div style={{ ...style, background: (config.bgColor as string) || 'rgba(0,0,0,0.4)', borderRadius: 8, padding: 16, color: (config.color as string) || '#fff' }}>
          <div style={{ fontSize: 14, opacity: 0.7 }}>{(config.city as string) || 'Seoul'}</div>
          <div style={{ fontSize: 36, fontWeight: 'bold' }}>--°</div>
        </div>
      )

    case 'rss':
      return (
        <div style={{ ...style, background: (config.bgColor as string) || 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', borderRadius: 4, overflow: 'hidden' }}>
          <div style={{ padding: '0 8px', background: '#EF4444', height: '100%', display: 'flex', alignItems: 'center' }}>
            <span style={{ color: '#fff', fontSize: 12, fontWeight: 'bold' }}>NEWS</span>
          </div>
          <div style={{ color: (config.color as string) || '#fff', fontSize: (config.fontSize as number) || 14, whiteSpace: 'nowrap', paddingLeft: 8, animation: 'rssScroll 20s linear infinite' }}>
            RSS 뉴스 피드
          </div>
        </div>
      )

    case 'qrcode':
      return (
        <div style={{ ...style, background: '#fff', borderRadius: 8, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 8 }}>
          <div style={{ width: (config.size as number) || 120, height: (config.size as number) || 120, background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#666' }}>
            QR
          </div>
          {config.label ? <div style={{ marginTop: 4, fontSize: 12 }}>{String(config.label)}</div> : null}
        </div>
      )

    case 'video':
      return (
        <div style={style}>
          {config.src ? (
            <video
              src={config.src as string}
              autoPlay
              loop={config.loop as boolean}
              muted={config.muted as boolean}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <div style={{ width: '100%', height: '100%', background: '#1F2937', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666' }}>
              비디오 없음
            </div>
          )}
        </div>
      )

    case 'webpage':
      return (
        <div style={style}>
          <iframe
            src={(config.url as string) || 'about:blank'}
            style={{ width: '100%', height: '100%', border: 'none' }}
            title="webpage"
          />
        </div>
      )

    case 'spreadsheet':
      return (
        <div style={style}>
          <iframe
            src={(config.url as string) || 'about:blank'}
            style={{ width: '100%', height: '100%', border: 'none' }}
            title="spreadsheet"
          />
        </div>
      )

    case 'chart':
      return (
        <div style={{ ...style, background: (config.bgColor as string) || 'rgba(0,0,0,0.4)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: (config.color as string) || '#fff' }}>
          {(config.title as string) || '차트'}
        </div>
      )

    default:
      return <div style={{ ...style, background: 'rgba(0,0,0,0.3)' }} />
  }
}

// ─── Clock Widget for Player ─────────────────────────
function ClockWidgetPlayer({ config, style }: { config: Record<string, unknown>; style: React.CSSProperties }) {
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const fmt = (config.format as string) || 'HH:mm:ss'
  const showDate = config.showDate !== false
  const dateFmt = (config.dateFormat as string) || 'yyyy-MM-dd'

  // Simple time formatting
  const pad = (n: number) => n.toString().padStart(2, '0')
  const h24 = pad(now.getHours())
  const h12 = pad(now.getHours() % 12 || 12)
  const m = pad(now.getMinutes())
  const s = pad(now.getSeconds())
  const ampm = now.getHours() >= 12 ? 'PM' : 'AM'

  let timeStr = fmt
    .replace('HH', h24).replace('hh', h12)
    .replace('mm', m).replace('ss', s)
    .replace('a', ampm)

  const y = now.getFullYear().toString()
  const mo = pad(now.getMonth() + 1)
  const d = pad(now.getDate())
  let dateStr = dateFmt
    .replace('yyyy', y).replace('MM', mo).replace('dd', d)

  return (
    <div style={{
      ...style,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      fontFamily: (config.fontFamily as string) || 'Noto Sans KR, sans-serif',
      color: (config.color as string) || '#FFFFFF',
    }}>
      <div style={{ fontSize: Math.min(style.width as number || 300, style.height as number || 120) * 0.35, fontWeight: 'bold', fontVariantNumeric: 'tabular-nums' }}>
        {timeStr}
      </div>
      {showDate && (
        <div style={{ fontSize: Math.min(style.width as number || 300, style.height as number || 120) * 0.14, opacity: 0.7, marginTop: 4 }}>
          {dateStr}
        </div>
      )}
    </div>
  )
}

// ─── Animation helpers ─────────────────────────
function getAnimationStyle(element: CanvasElement): React.CSSProperties {
  const anim = element.animation
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
