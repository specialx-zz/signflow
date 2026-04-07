import React, { useEffect } from 'react'
import { usePlayerStore } from '../store/playerStore'

/**
 * V5.3: 긴급 메시지 오버레이 컴포넌트
 *
 * playerStore의 emergencyMessages를 구독하여 화면에 표시
 * Socket.IO 이벤트는 useSocket에서 store로 전달됨
 * - OVERLAY: 화면 상단에 배너 형태
 * - FULLSCREEN: 전체 화면 대체
 * - TICKER: 하단 스크롤 자막
 */
export default function EmergencyOverlay() {
  const messages = usePlayerStore((s) => s.emergencyMessages)
  const clearExpired = usePlayerStore((s) => s.clearExpiredEmergencies)

  // 만료 체크 (1분마다)
  useEffect(() => {
    const timer = setInterval(() => {
      clearExpired()
    }, 60000)
    return () => clearInterval(timer)
  }, [clearExpired])

  if (messages.length === 0) return null

  const topMessage = messages[0]

  // FULLSCREEN mode
  if (topMessage.displayMode === 'FULLSCREEN') {
    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 99999,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: topMessage.bgColor,
          color: topMessage.textColor,
          padding: '60px',
          animation: 'emergencyPulse 2s ease-in-out infinite',
        }}
      >
        <div style={{ fontSize: '64px', marginBottom: '20px' }}>
          {topMessage.type === 'DANGER' ? '🚨' : topMessage.type === 'WARNING' ? '⚠️' : '📢'}
        </div>
        <h1 style={{ fontSize: `${topMessage.fontSize}px`, fontWeight: 'bold', marginBottom: '20px', textAlign: 'center' }}>
          {topMessage.title}
        </h1>
        <p style={{ fontSize: `${Math.max(topMessage.fontSize * 0.6, 24)}px`, textAlign: 'center', opacity: 0.9, maxWidth: '80%' }}>
          {topMessage.message}
        </p>
        <style>{`
          @keyframes emergencyPulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.85; }
          }
        `}</style>
      </div>
    )
  }

  // TICKER mode
  if (topMessage.displayMode === 'TICKER') {
    return (
      <div
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 99998,
          backgroundColor: topMessage.bgColor,
          color: topMessage.textColor,
          padding: '12px 0',
          overflow: 'hidden',
          whiteSpace: 'nowrap',
        }}
      >
        <div
          style={{
            display: 'inline-block',
            animation: 'tickerScroll 20s linear infinite',
            fontSize: '24px',
            fontWeight: 'bold',
          }}
        >
          {messages.map(m => (
            <span key={m.id} style={{ marginRight: '100px' }}>
              {m.type === 'DANGER' ? '🚨 ' : m.type === 'WARNING' ? '⚠️ ' : '📢 '}
              {m.title} — {m.message}
            </span>
          ))}
        </div>
        <style>{`
          @keyframes tickerScroll {
            from { transform: translateX(100vw); }
            to { transform: translateX(-100%); }
          }
        `}</style>
      </div>
    )
  }

  // OVERLAY mode (default) — banner at top
  return (
    <>
      {messages.map(msg => (
        <div
          key={msg.id}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            zIndex: 99997,
            backgroundColor: msg.bgColor,
            color: msg.textColor,
            padding: '16px 24px',
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            animation: 'emergencySlideDown 0.5s ease',
            boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
          }}
        >
          <span style={{ fontSize: '32px' }}>
            {msg.type === 'DANGER' ? '🚨' : msg.type === 'WARNING' ? '⚠️' : '📢'}
          </span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '20px', fontWeight: 'bold' }}>{msg.title}</div>
            <div style={{ fontSize: '16px', opacity: 0.9, marginTop: '2px' }}>{msg.message}</div>
          </div>
        </div>
      ))}
      <style>{`
        @keyframes emergencySlideDown {
          from { transform: translateY(-100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </>
  )
}
