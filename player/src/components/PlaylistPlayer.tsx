import React, { useEffect, useRef, useState, useCallback } from 'react'
import type { Playlist, PlaylistItem } from '../types'
import { usePlayerStore } from '../store/playerStore'
import ContentRenderer from './ContentRenderer'
import { electronCacheDownload, electronIsCached } from '../utils/electronBridge'

// 전환 애니메이션 duration (index.css와 동기화)
const TRANSITION_DURATIONS: Record<string, number> = {
  none: 0,
  fade: 700,
  'slide-left': 550,
  'slide-right': 550,
  'slide-up': 550,
  'zoom-in': 650,
  blur: 750,
}

function getItemTransition(item?: PlaylistItem): string {
  if (!item) return 'fade'
  if (item.transition) return item.transition
  return 'fade'
}

interface PlaylistPlayerProps {
  playlist: Playlist
}

export default function PlaylistPlayer({ playlist }: PlaylistPlayerProps) {
  const { currentItemIndex, nextItem: advanceStore, config } = usePlayerStore()

  const sortedItems = React.useMemo(
    () => [...playlist.items].sort((a, b) => a.order - b.order),
    [playlist.items]
  )

  const safeIndex = Math.min(currentItemIndex, Math.max(0, sortedItems.length - 1))

  // 듀얼 레이어 상태 (전환 애니메이션용)
  const [stableIndex, setStableIndex] = useState(safeIndex)
  const [stableKey, setStableKey] = useState(0)
  const [enteringIndex, setEnteringIndex] = useState<number | null>(null)
  const [enteringClass, setEnteringClass] = useState('')
  const [leavingClass, setLeavingClass] = useState('')
  const transitionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const preloadRef = useRef<Set<string>>(new Set())

  // 다음 콘텐츠 파일시스템에 미리 다운로드 (Preload)
  useEffect(() => {
    if (!config || sortedItems.length <= 1) return
    const nextIdx = (safeIndex + 1) % sortedItems.length
    const candidate = sortedItems[nextIdx]

    if (
      candidate?.content?.fileUrl &&
      !preloadRef.current.has(candidate.content.id) &&
      candidate.content.type !== 'URL' &&
      candidate.content.type !== 'HTML'
    ) {
      preloadRef.current.add(candidate.content.id)

      const filename = candidate.content.fileUrl.split('/').pop() || candidate.content.id

      // 이미 캐시됐으면 스킵, 아니면 다운로드
      electronIsCached(candidate.content.id, filename).then((cached) => {
        if (!cached) {
          electronCacheDownload(candidate.content.fileUrl, candidate.content.id, filename).catch(() => {
            preloadRef.current.delete(candidate.content.id)
          })
        }
      })
    }
  }, [safeIndex, sortedItems, config])

  const advanceToNext = useCallback(() => {
    if (transitionTimerRef.current) return

    if (sortedItems.length <= 1) {
      setStableKey((prev) => prev + 1)
      return
    }

    const nextIdx = (stableIndex + 1) % sortedItems.length
    const nextItemData = sortedItems[nextIdx]
    const transition = getItemTransition(nextItemData)
    const duration = TRANSITION_DURATIONS[transition] ?? 700

    console.log(`[PlaylistPlayer] transition=${transition} duration=${duration}ms nextIdx=${nextIdx}`, nextItemData)

    if (transition === 'none' || duration === 0) {
      setStableIndex(nextIdx)
      advanceStore()
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
      advanceStore()
    }, duration)
  }, [sortedItems, stableIndex, advanceStore])

  // 외부 명령(NEXT/PREV)으로 currentItemIndex 변경 시 동기화
  useEffect(() => {
    if (safeIndex !== stableIndex) {
      if (transitionTimerRef.current) {
        clearTimeout(transitionTimerRef.current)
        transitionTimerRef.current = null
      }
      setStableIndex(safeIndex)
      setEnteringIndex(null)
      setEnteringClass('')
      setLeavingClass('')
    }
  }, [safeIndex]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    return () => {
      if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current)
    }
  }, [])

  const stableItem = sortedItems[stableIndex]
  const enteringItem = enteringIndex !== null ? sortedItems[enteringIndex] : null

  if (!stableItem || sortedItems.length === 0) {
    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: '#000',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '18px' }}>
          재생목록에 콘텐츠가 없습니다
        </p>
      </div>
    )
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: '#000',
        overflow: 'hidden',
      }}
    >
      {/* Stable 레이어 — 항상 표시, z-index 1 */}
      <div
        className={leavingClass}
        style={{ position: 'absolute', inset: 0, zIndex: 1 }}
      >
        <ContentRenderer
          key={`stable-${stableItem.content.id}-${stableKey}`}
          content={stableItem.content}
          onEnded={advanceToNext}
          objectFit="contain"
        />
      </div>

      {/* Entering 레이어 — 전환 애니메이션, z-index 2 */}
      {enteringItem && (
        <div
          className={enteringClass}
          style={{ position: 'absolute', inset: 0, zIndex: 2 }}
        >
          <ContentRenderer
            key={`entering-${enteringItem.content.id}`}
            content={enteringItem.content}
            onEnded={() => {}}
            objectFit="contain"
          />
        </div>
      )}
    </div>
  )
}
