import React, { useEffect, useState, useRef } from 'react'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import { usePlayerStore } from '../store/playerStore'

const OSD_DISPLAY_DURATION = 8000 // ms

export default function OSDOverlay() {
  const { showOSD, setShowOSD, config, currentSchedule, currentPlaylist, currentItemIndex, isConnected, volume, brightness } =
    usePlayerStore()

  const [currentTime, setCurrentTime] = useState(new Date())
  const [ipAddress, setIpAddress] = useState<string>('...')
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  // Fetch IP via public API or local fallback
  useEffect(() => {
    fetch('https://api.ipify.org?format=json')
      .then((r) => r.json())
      .then((d) => setIpAddress(d.ip ?? 'N/A'))
      .catch(() => setIpAddress(window.location.hostname))
  }, [])

  // Auto-hide after duration
  useEffect(() => {
    if (!showOSD) return

    if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
    hideTimerRef.current = setTimeout(() => {
      setShowOSD(false)
    }, OSD_DISPLAY_DURATION)

    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
    }
  }, [showOSD, setShowOSD])

  if (!showOSD) return null

  const sortedItems = currentPlaylist?.items
    ? [...currentPlaylist.items].sort((a, b) => a.order - b.order)
    : []
  const currentContent = sortedItems[currentItemIndex]?.content

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        background: 'linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.7) 70%, transparent 100%)',
        padding: '40px 32px 24px',
        zIndex: 9000,
        animation: 'osdFadeIn 0.3s ease',
        fontFamily: "'Segoe UI', system-ui, sans-serif",
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          gap: '24px',
        }}
      >
        {/* Left: Device info */}
        <div style={{ flex: 1 }}>
          <div style={{ marginBottom: '12px' }}>
            <span
              style={{
                color: 'rgba(255,255,255,0.5)',
                fontSize: '11px',
                textTransform: 'uppercase',
                letterSpacing: '1px',
              }}
            >
              장치
            </span>
            <p style={{ color: '#fff', fontSize: '18px', fontWeight: '600', margin: '2px 0 0' }}>
              {config?.deviceName ?? 'Unknown'}
            </p>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', fontFamily: 'monospace', margin: '2px 0 0' }}>
              ID: {config?.deviceId?.slice(-8).toUpperCase() ?? 'N/A'}
            </p>
          </div>

          {/* Current schedule / content */}
          <div>
            <span
              style={{
                color: 'rgba(255,255,255,0.5)',
                fontSize: '11px',
                textTransform: 'uppercase',
                letterSpacing: '1px',
              }}
            >
              현재 재생 중
            </span>
            {currentSchedule && (
              <p style={{ color: '#0094ff', fontSize: '14px', margin: '2px 0 0' }}>
                {currentSchedule.playlist?.name ?? '스케줄'}
              </p>
            )}
            {currentContent && (
              <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '13px', margin: '2px 0 0' }}>
                {currentContent.name}
                {currentPlaylist && (
                  <span style={{ color: 'rgba(255,255,255,0.35)', marginLeft: '8px' }}>
                    {currentItemIndex + 1} / {currentPlaylist.items.length}
                  </span>
                )}
              </p>
            )}
          </div>
        </div>

        {/* Center: System info */}
        <div style={{ textAlign: 'center' }}>
          <div style={{ display: 'flex', gap: '20px', alignItems: 'center', marginBottom: '8px' }}>
            {/* Volume */}
            <div style={{ textAlign: 'center' }}>
              <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px', marginBottom: '2px' }}>음량</div>
              <div style={{ color: '#fff', fontSize: '16px', fontWeight: '600' }}>{volume}%</div>
            </div>
            {/* Brightness */}
            <div style={{ textAlign: 'center' }}>
              <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px', marginBottom: '2px' }}>밝기</div>
              <div style={{ color: '#fff', fontSize: '16px', fontWeight: '600' }}>{brightness}%</div>
            </div>
          </div>

          {/* Connection status */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              background: isConnected ? 'rgba(0,200,80,0.15)' : 'rgba(255,60,60,0.15)',
              border: `1px solid ${isConnected ? 'rgba(0,200,80,0.3)' : 'rgba(255,60,60,0.3)'}`,
              borderRadius: '100px',
              padding: '4px 12px',
            }}
          >
            <div
              style={{
                width: '7px',
                height: '7px',
                borderRadius: '50%',
                background: isConnected ? '#00c850' : '#ff3c3c',
                boxShadow: isConnected ? '0 0 6px #00c850' : 'none',
              }}
            />
            <span
              style={{
                color: isConnected ? '#00c850' : '#ff6060',
                fontSize: '12px',
                fontWeight: '500',
              }}
            >
              {isConnected ? '서버 연결됨' : '오프라인'}
            </span>
          </div>

          {/* IP */}
          <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '11px', fontFamily: 'monospace', marginTop: '6px' }}>
            {ipAddress}
          </p>
        </div>

        {/* Right: Clock */}
        <div style={{ textAlign: 'right', flex: 1 }}>
          <div
            style={{
              color: '#fff',
              fontSize: '48px',
              fontWeight: '300',
              letterSpacing: '-1px',
              lineHeight: 1,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {format(currentTime, 'HH:mm')}
            <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '32px' }}>
              :{format(currentTime, 'ss')}
            </span>
          </div>
          <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px', marginTop: '4px' }}>
            {format(currentTime, 'yyyy년 MM월 dd일 EEEE', { locale: ko })}
          </div>
          <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '12px', marginTop: '2px' }}>
            {format(currentTime, 'yyyy-MM-dd')}
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '2px',
          background: 'rgba(255,255,255,0.1)',
        }}
      >
        <div
          style={{
            height: '100%',
            background: '#0078ff',
            animation: `osdProgress ${OSD_DISPLAY_DURATION}ms linear`,
            transformOrigin: 'left',
          }}
        />
      </div>

      <style>{`
        @keyframes osdFadeIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes osdProgress {
          from { width: 100%; }
          to { width: 0%; }
        }
      `}</style>
    </div>
  )
}
