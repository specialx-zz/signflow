import React, { useRef, useEffect, useState, useCallback } from 'react'
import type { ContentItem } from '../types'
import { usePlayerStore } from '../store/playerStore'
import {
  electronGetCachedUrl,
  electronCacheDownloadWithProgress,
  onDownloadProgress,
} from '../utils/electronBridge'
import CanvasRenderer from './CanvasRenderer'
import DownloadingOverlay from './DownloadingOverlay'

interface ContentRendererProps {
  content: ContentItem
  onEnded: () => void
  objectFit?: 'contain' | 'cover' | 'fill'
}

type LoadState =
  | { phase: 'resolving' }                                     // 캐시 확인 중
  | { phase: 'downloading'; percent: number; received: number; total: number }  // 다운로드 중
  | { phase: 'ready'; url: string }                            // 재생 준비 완료
  | { phase: 'error' }                                         // 에러

export default function ContentRenderer({
  content,
  onEnded,
  objectFit = 'contain',
}: ContentRendererProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [loadState, setLoadState] = useState<LoadState>({ phase: 'resolving' })
  const { volume, brightness, isPlaying } = usePlayerStore()

  // URL/HTML 타입은 캐시 불필요 → 즉시 ready
  const isExternalType = content.type === 'URL' || content.type === 'HTML' || content.type === 'CANVAS'

  useEffect(() => {
    if (isExternalType) {
      setLoadState({ phase: 'ready', url: content.fileUrl || '' })
      return
    }
    if (!content.fileUrl) {
      setLoadState({ phase: 'ready', url: '' })
      return
    }

    let cancelled = false
    const filename = content.fileUrl.split('/').pop() || content.id

    async function resolveOrDownload() {
      setLoadState({ phase: 'resolving' })

      // 1. 파일시스템 캐시 확인
      const cachedUrl = await electronGetCachedUrl(content.id, filename)
      if (cancelled) return

      if (cachedUrl) {
        setLoadState({ phase: 'ready', url: cachedUrl })
        return
      }

      // 2. 캐시 없음 → 다운로드 후 재생
      setLoadState({ phase: 'downloading', percent: 0, received: 0, total: 0 })

      // 진행률 이벤트 구독
      const unsubscribe = onDownloadProgress(({ contentId, percent, received, total }) => {
        if (contentId !== content.id || cancelled) return
        setLoadState({ phase: 'downloading', percent, received, total })
      })

      try {
        const result = await electronCacheDownloadWithProgress(
          content.fileUrl,
          content.id,
          filename
        )
        unsubscribe()
        if (cancelled) return

        if (result.success && result.localUrl) {
          setLoadState({ phase: 'ready', url: result.localUrl })
        } else {
          console.error('[ContentRenderer] 다운로드 실패:', result.error)
          setLoadState({ phase: 'error' })
        }
      } catch (err) {
        unsubscribe()
        if (cancelled) return
        console.error('[ContentRenderer] 다운로드 오류:', err)
        setLoadState({ phase: 'error' })
      }
    }

    resolveOrDownload()

    return () => {
      cancelled = true
    }
  }, [content.id, content.fileUrl, content.type, isExternalType])

  // 에러 시 2초 후 다음 콘텐츠로
  useEffect(() => {
    if (loadState.phase === 'error') {
      timerRef.current = setTimeout(onEnded, 2000)
      return () => {
        if (timerRef.current) clearTimeout(timerRef.current)
      }
    }
  }, [loadState.phase, onEnded])

  // 비디오 외 콘텐츠 duration 기반 자동 전환 (ready 상태일 때만)
  useEffect(() => {
    if (loadState.phase !== 'ready') return
    if (content.type === 'VIDEO') return
    if (content.type === 'CANVAS') return
    if (!isPlaying) return

    const duration = (content.duration || 10) * 1000
    timerRef.current = setTimeout(onEnded, duration)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [loadState, content.type, content.duration, onEnded, isPlaying])

  // 비디오 볼륨
  useEffect(() => {
    if (videoRef.current) videoRef.current.volume = volume / 100
  }, [volume])

  // 비디오 재생/일시정지
  useEffect(() => {
    if (!videoRef.current) return
    if (isPlaying) videoRef.current.play().catch(() => {})
    else videoRef.current.pause()
  }, [isPlaying])

  // 오디오 재생/일시정지
  useEffect(() => {
    if (!audioRef.current) return
    if (isPlaying) audioRef.current.play().catch(() => {})
    else audioRef.current.pause()
  }, [isPlaying])

  // 오디오 볼륨
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume / 100
  }, [volume])

  const handleVideoEnded = useCallback(() => onEnded(), [onEnded])

  const handleError = useCallback(() => {
    console.error('[ContentRenderer] 미디어 로드 실패')
    setLoadState({ phase: 'error' })
  }, [])

  const baseStyle: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    filter: `brightness(${brightness}%)`,
    transition: 'filter 0.3s ease',
  }

  // ── 로딩/다운로드 중 ─────────────────────────────────────
  if (loadState.phase === 'resolving') {
    return (
      <div style={{ ...baseStyle, background: '#000' }} />
    )
  }

  if (loadState.phase === 'downloading') {
    const filename = content.fileUrl?.split('/').pop() || content.name
    return (
      <div style={{ ...baseStyle, background: '#000' }}>
        <DownloadingOverlay
          filename={filename}
          percent={loadState.percent}
          received={loadState.received}
          total={loadState.total}
        />
      </div>
    )
  }

  // ── 에러 ─────────────────────────────────────────────────
  if (loadState.phase === 'error') {
    return (
      <div
        style={{
          ...baseStyle,
          background: '#111',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        <div style={{ fontSize: '48px' }}>⚠</div>
        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '16px' }}>
          콘텐츠를 불러올 수 없습니다
        </p>
        <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '13px', fontFamily: 'monospace' }}>
          {content.name}
        </p>
      </div>
    )
  }

  // ── ready: 실제 렌더링 ─────────────────────────────────
  const { url } = loadState

  if (content.type === 'IMAGE') {
    return (
      <img
        key={url}
        src={url}
        alt={content.name}
        onError={handleError}
        style={{ ...baseStyle, objectFit, display: 'block' }}
      />
    )
  }

  if (content.type === 'VIDEO') {
    return (
      <video
        key={url}
        ref={videoRef}
        src={url}
        autoPlay
        muted={volume === 0}
        playsInline
        crossOrigin="anonymous"
        onEnded={handleVideoEnded}
        onError={handleError}
        style={{ ...baseStyle, objectFit, display: 'block' }}
      />
    )
  }

  if (content.type === 'AUDIO') {
    return (
      <div
        style={{
          ...baseStyle,
          background: '#0a0a1a',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          gap: '24px',
        }}
      >
        <audio
          key={url}
          ref={audioRef}
          src={url}
          autoPlay
          onEnded={handleVideoEnded}
          onError={handleError}
          style={{ display: 'none' }}
        />
        <div style={{ display: 'flex', gap: '6px', alignItems: 'flex-end', height: '60px' }}>
          {Array.from({ length: 12 }).map((_, i) => (
            <div
              key={i}
              style={{
                width: '8px',
                borderRadius: '4px',
                background: '#0078ff',
                animation: `audioBar ${0.6 + (i % 4) * 0.15}s ease-in-out ${i * 0.05}s infinite alternate`,
              }}
            />
          ))}
        </div>
        <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '18px' }}>{content.name}</p>
        <style>{`
          @keyframes audioBar {
            from { height: 8px; }
            to { height: 48px; }
          }
        `}</style>
      </div>
    )
  }

  if (content.type === 'HTML') {
    return (
      <iframe
        key={url}
        src={url}
        title={content.name}
        sandbox="allow-scripts allow-same-origin allow-popups"
        style={{ ...baseStyle, border: 'none' }}
        onError={handleError}
      />
    )
  }

  if (content.type === 'URL') {
    return (
      <iframe
        key={url}
        src={url}
        title={content.name}
        style={{ ...baseStyle, border: 'none' }}
        onError={handleError}
        allow="autoplay; fullscreen"
      />
    )
  }

  if (content.type === 'CANVAS' && content.canvasData) {
    return (
      <CanvasRenderer
        canvasData={content.canvasData}
        onEnded={onEnded}
      />
    )
  }

  // DOCUMENT / 미지원 타입
  return (
    <div
      style={{
        ...baseStyle,
        background: '#111',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: '12px',
      }}
    >
      <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '16px' }}>{content.name}</p>
      <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '13px', fontFamily: 'monospace' }}>{content.type}</p>
    </div>
  )
}
