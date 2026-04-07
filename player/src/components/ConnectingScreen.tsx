import React, { useEffect, useState } from 'react'

interface ConnectingScreenProps {
  serverUrl: string
  deviceName: string
}

export default function ConnectingScreen({ serverUrl, deviceName }: ConnectingScreenProps) {
  const [dots, setDots] = useState('.')

  useEffect(() => {
    const timer = setInterval(() => {
      setDots((prev) => (prev.length >= 3 ? '.' : prev + '.'))
    }, 500)
    return () => clearInterval(timer)
  }, [])

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        background: '#0a0a0f',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: "'Segoe UI', system-ui, sans-serif",
      }}
    >
      {/* Pulsing rings */}
      <div style={{ position: 'relative', width: '120px', height: '120px', marginBottom: '40px' }}>
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              inset: `${i * 12}px`,
              borderRadius: '50%',
              border: `2px solid rgba(0,120,255,${0.6 - i * 0.15})`,
              animation: `pulse ${1.4 + i * 0.3}s ease-in-out ${i * 0.2}s infinite`,
            }}
          />
        ))}
        {/* Center icon */}
        <div
          style={{
            position: 'absolute',
            inset: '36px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #0078ff, #00d4ff)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <span style={{ color: '#fff', fontSize: '20px', fontWeight: '900' }}>N</span>
        </div>
      </div>

      <h2
        style={{
          color: '#fff',
          fontSize: '22px',
          fontWeight: '600',
          margin: '0 0 12px',
        }}
      >
        연결 중{dots}
      </h2>

      <p
        style={{
          color: 'rgba(255,255,255,0.5)',
          fontSize: '14px',
          margin: '0 0 8px',
        }}
      >
        {serverUrl}
      </p>

      <p
        style={{
          color: 'rgba(255,255,255,0.3)',
          fontSize: '13px',
          margin: 0,
        }}
      >
        {deviceName}
      </p>

      {/* Loading bar */}
      <div
        style={{
          marginTop: '48px',
          width: '200px',
          height: '2px',
          background: 'rgba(255,255,255,0.1)',
          borderRadius: '1px',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            width: '60%',
            background: 'linear-gradient(90deg, transparent, #0078ff, transparent)',
            animation: 'slide 1.4s ease-in-out infinite',
          }}
        />
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.05); opacity: 0.6; }
        }
        @keyframes slide {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(250%); }
        }
      `}</style>
    </div>
  )
}
