import { useState, useEffect, useRef, useCallback } from 'react'
import { usePlayerStore } from '../store/playerStore'
import type { PlaylistItem } from '../types'
import ContentRenderer from './ContentRenderer'

// Animation durations must match the CSS in index.css
const TRANSITION_DURATIONS: Record<string, number> = {
  none: 0,
  fade: 700,
  'slide-left': 550,
  'slide-right': 550,
  'slide-up': 550,
  'zoom-in': 650,
  blur: 750,
}

interface Zone {
  id: string
  name: string
  x: number
  y: number
  width: number
  height: number
  zIndex: number
  contentType: string
  playlistId: string | null
  sourceUrl?: string | null
  sourceHtml?: string | null
  bgColor: string
  fit: string
  playlist?: { id: string; name: string; items: PlaylistItem[] } | null
}

export interface Layout {
  id: string
  name: string
  baseWidth: number
  baseHeight: number
  zones: Zone[]
}

function ZonePlayer({ zone }: { zone: Zone }) {
  const { isPlaying } = usePlayerStore()
  const items = zone.playlist?.items ?? []
  const sortedItems = [...items].sort((a, b) => a.order - b.order)

  const [stableIndex, setStableIndex] = useState(0)
  const [stableKey, setStableKey] = useState(0)
  const [enteringIndex, setEnteringIndex] = useState<number | null>(null)
  const [enteringClass, setEnteringClass] = useState('')
  const [leavingClass, setLeavingClass] = useState('')
  const transitionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const advanceToNext = useCallback(() => {
    if (transitionTimerRef.current) return
    if (sortedItems.length <= 1) {
      // 단일 항목: key 변경으로 ContentRenderer 재마운트 → 루프
      setStableKey(prev => prev + 1)
      return
    }

    const nextIdx = (stableIndex + 1) % sortedItems.length
    const nextItem = sortedItems[nextIdx]
    const transition = nextItem?.transition || 'fade'
    const duration = TRANSITION_DURATIONS[transition] ?? 700

    if (transition === 'none' || duration === 0) {
      setStableIndex(nextIdx)
      return
    }

    setEnteringIndex(nextIdx)
    setEnteringClass(`plx-entering-${transition}`)
    if (transition === 'fade') {
      setLeavingClass('plx-leaving-fade')
    }

    transitionTimerRef.current = setTimeout(() => {
      setStableIndex(nextIdx)
      setEnteringIndex(null)
      setEnteringClass('')
      setLeavingClass('')
      transitionTimerRef.current = null
    }, duration)
  }, [sortedItems, stableIndex])

  useEffect(() => {
    return () => {
      if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current)
    }
  }, [])

  const objectFit = (zone.fit || 'contain') as 'contain' | 'cover' | 'fill'

  // URL 존 타입
  if (zone.contentType === 'URL' && zone.sourceUrl) {
    return (
      <div style={{ width: '100%', height: '100%', overflow: 'hidden', backgroundColor: zone.bgColor || '#000' }}>
        <iframe
          src={zone.sourceUrl}
          style={{ width: '100%', height: '100%', border: 'none' }}
          title={zone.name}
          allowFullScreen
        />
      </div>
    )
  }

  // HTML 존 타입
  if (zone.contentType === 'HTML' && zone.sourceHtml) {
    return (
      <div style={{ width: '100%', height: '100%', overflow: 'hidden', backgroundColor: zone.bgColor || '#000' }}>
        <iframe
          srcDoc={zone.sourceHtml}
          style={{ width: '100%', height: '100%', border: 'none' }}
          title={zone.name}
          sandbox="allow-scripts allow-same-origin"
        />
      </div>
    )
  }

  if (sortedItems.length === 0) {
    return <div style={{ width: '100%', height: '100%', backgroundColor: zone.bgColor || '#000' }} />
  }

  const stableItem = sortedItems[stableIndex % sortedItems.length]
  const enteringItem = enteringIndex !== null ? sortedItems[enteringIndex % sortedItems.length] : null

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        backgroundColor: zone.bgColor || '#000',
        position: 'relative',
      }}
    >
      {/* Stable 레이어 */}
      <div className={leavingClass} style={{ position: 'absolute', inset: 0, zIndex: 1 }}>
        <ContentRenderer
          key={`zone-stable-${zone.id}-${stableItem.content.id}-${stableKey}`}
          content={stableItem.content}
          onEnded={advanceToNext}
          objectFit={objectFit}
        />
      </div>

      {/* Entering 레이어 */}
      {enteringItem && (
        <div className={enteringClass} style={{ position: 'absolute', inset: 0, zIndex: 2 }}>
          <ContentRenderer
            key={`zone-entering-${zone.id}-${enteringItem.content.id}`}
            content={enteringItem.content}
            onEnded={() => {}}
            objectFit={objectFit}
          />
        </div>
      )}
    </div>
  )
}

export default function ZoneLayoutPlayer({ layout }: { layout: Layout }) {
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', background: '#000' }}>
      {layout.zones.map(zone => (
        <div
          key={zone.id}
          style={{
            position: 'absolute',
            left: `${zone.x}%`,
            top: `${zone.y}%`,
            width: `${zone.width}%`,
            height: `${zone.height}%`,
            zIndex: zone.zIndex,
          }}
        >
          <ZonePlayer zone={zone} />
        </div>
      ))}
    </div>
  )
}
