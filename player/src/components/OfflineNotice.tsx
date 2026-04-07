import React, { useEffect, useState } from 'react'
import { usePlayerStore } from '../store/playerStore'

export default function OfflineNotice() {
  const { isConnected, config } = usePlayerStore()
  const [visible, setVisible] = useState(false)
  const [countdown, setCountdown] = useState(10)

  useEffect(() => {
    if (!isConnected && config) {
      // Show notice after 5 seconds of being disconnected
      const showTimer = setTimeout(() => setVisible(true), 5000)
      return () => clearTimeout(showTimer)
    } else {
      setVisible(false)
    }
  }, [isConnected, config])

  // Countdown to next reconnect attempt
  useEffect(() => {
    if (!visible) return

    setCountdown(10)
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) return 10
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [visible])

  if (!visible) return null

  return (
    <div
      style={{
        position: 'fixed',
        top: '20px',
        right: '20px',
        zIndex: 8000,
        background: 'rgba(20,20,30,0.95)',
        border: '1px solid rgba(255,120,0,0.4)',
        borderRadius: '12px',
        padding: '14px 18px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        animation: 'slideIn 0.3s ease',
        backdropFilter: 'blur(10px)',
        maxWidth: '280px',
      }}
    >
      {/* Warning icon */}
      <div
        style={{
          width: '36px',
          height: '36px',
          borderRadius: '50%',
          background: 'rgba(255,120,0,0.15)',
          border: '2px solid rgba(255,120,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          animation: 'pulse 2s ease-in-out infinite',
        }}
      >
        <span style={{ color: '#ff7800', fontSize: '16px', fontWeight: '700' }}>!</span>
      </div>

      <div>
        <p
          style={{
            color: '#ff9830',
            fontSize: '13px',
            fontWeight: '600',
            margin: '0 0 3px',
            fontFamily: 'system-ui, sans-serif',
          }}
        >
          서버 연결 끊김
        </p>
        <p
          style={{
            color: 'rgba(255,255,255,0.5)',
            fontSize: '11px',
            margin: 0,
            fontFamily: 'system-ui, sans-serif',
          }}
        >
          캐시 콘텐츠 재생 중 · {countdown}초 후 재시도
        </p>
      </div>

      <style>{`
        @keyframes slideIn {
          from { opacity: 0; transform: translateX(30px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.1); }
        }
      `}</style>
    </div>
  )
}
