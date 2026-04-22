import React, { useEffect, useState, useRef } from 'react'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import { usePlayerStore } from '../store/playerStore'

interface Particle {
  id: number
  x: number
  y: number
  size: number
  speedX: number
  speedY: number
  opacity: number
  color: string
}

const COLORS = ['#0078ff', '#00d4ff', '#0056d6', '#00a8ff', '#4488ff']

function createParticle(id: number): Particle {
  return {
    id,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: Math.random() * 3 + 1,
    speedX: (Math.random() - 0.5) * 0.03,
    speedY: (Math.random() - 0.5) * 0.03,
    opacity: Math.random() * 0.5 + 0.1,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
  }
}

export default function DefaultScreen() {
  const { config, isConnected, brightness, schedules } = usePlayerStore()
  const [currentTime, setCurrentTime] = useState(new Date())
  const [particles, setParticles] = useState<Particle[]>(() =>
    Array.from({ length: 40 }, (_, i) => createParticle(i))
  )
  const animFrameRef = useRef<number>()

  // Clock update
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  // Particle animation
  useEffect(() => {
    let lastTime = performance.now()

    const animate = (now: number) => {
      const delta = now - lastTime
      lastTime = now

      if (delta > 16) {
        // ~60fps
        setParticles((prev) =>
          prev.map((p) => {
            let x = p.x + p.speedX
            let y = p.y + p.speedY

            // Bounce off edges
            let speedX = p.speedX
            let speedY = p.speedY
            if (x < 0 || x > 100) speedX = -speedX
            if (y < 0 || y > 100) speedY = -speedY
            x = Math.max(0, Math.min(100, x))
            y = Math.max(0, Math.min(100, y))

            return { ...p, x, y, speedX, speedY }
          })
        )
      }

      animFrameRef.current = requestAnimationFrame(animate)
    }

    animFrameRef.current = requestAnimationFrame(animate)
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
    }
  }, [])

  const timeStr = format(currentTime, 'HH:mm:ss')
  const dateStr = format(currentTime, 'yyyy년 MM월 dd일', { locale: ko })
  const dayStr = format(currentTime, 'EEEE', { locale: ko })

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: '#000',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        filter: `brightness(${brightness}%)`,
        fontFamily: "'Segoe UI', system-ui, sans-serif",
      }}
    >
      {/* Gradient background */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(ellipse at 30% 40%, rgba(0,40,100,0.4) 0%, transparent 60%), radial-gradient(ellipse at 70% 60%, rgba(0,20,80,0.3) 0%, transparent 50%)',
          pointerEvents: 'none',
        }}
      />

      {/* Particles */}
      <svg
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
      >
        {particles.map((p) => (
          <circle
            key={p.id}
            cx={p.x}
            cy={p.y}
            r={p.size * 0.15}
            fill={p.color}
            opacity={p.opacity}
          />
        ))}
        {/* Connection lines between nearby particles */}
        {particles.map((p1, i) =>
          particles.slice(i + 1).map((p2) => {
            const dist = Math.hypot(p1.x - p2.x, p1.y - p2.y)
            if (dist > 12) return null
            const opacity = (1 - dist / 12) * 0.2
            return (
              <line
                key={`${p1.id}-${p2.id}`}
                x1={p1.x}
                y1={p1.y}
                x2={p2.x}
                y2={p2.y}
                stroke="#0078ff"
                strokeWidth="0.05"
                opacity={opacity}
              />
            )
          })
        )}
      </svg>

      {/* Decorative rings */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              width: `${400 + i * 160}px`,
              height: `${400 + i * 160}px`,
              marginTop: `${-(200 + i * 80)}px`,
              marginLeft: `${-(200 + i * 80)}px`,
              borderRadius: '50%',
              border: `1px solid rgba(0,120,255,${0.06 - i * 0.015})`,
            }}
          />
        ))}
      </div>

      {/* Main clock */}
      <div style={{ position: 'relative', textAlign: 'center' }}>
        {/* Logo */}
        <div
          style={{
            width: '56px',
            height: '56px',
            borderRadius: '16px',
            background: 'linear-gradient(135deg, rgba(0,120,255,0.8) 0%, rgba(0,180,255,0.6) 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 32px',
            boxShadow: '0 0 30px rgba(0,120,255,0.3)',
          }}
        >
          <span style={{ fontSize: '26px', fontWeight: '900', color: '#fff' }}>N</span>
        </div>

        {/* Time */}
        <div
          style={{
            fontSize: 'clamp(72px, 12vw, 160px)',
            fontWeight: '100',
            color: '#fff',
            letterSpacing: '-4px',
            lineHeight: 1,
            fontVariantNumeric: 'tabular-nums',
            textShadow: '0 0 60px rgba(0,120,255,0.3)',
          }}
        >
          {timeStr.slice(0, 5)}
          <span
            style={{
              fontSize: 'clamp(36px, 6vw, 80px)',
              color: 'rgba(255,255,255,0.4)',
              letterSpacing: '0',
            }}
          >
            :{timeStr.slice(6)}
          </span>
        </div>

        {/* Date */}
        <div
          style={{
            marginTop: '16px',
            color: 'rgba(255,255,255,0.6)',
            fontSize: 'clamp(16px, 2.5vw, 28px)',
            fontWeight: '300',
            letterSpacing: '2px',
          }}
        >
          {dateStr}
        </div>
        <div
          style={{
            marginTop: '8px',
            color: 'rgba(255,255,255,0.35)',
            fontSize: 'clamp(14px, 2vw, 20px)',
            fontWeight: '300',
            letterSpacing: '4px',
            textTransform: 'uppercase',
          }}
        >
          {dayStr}
        </div>
      </div>

      {/* Bottom bar */}
      <div
        style={{
          position: 'absolute',
          bottom: '32px',
          left: '32px',
          right: '32px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div>
          <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '14px', fontWeight: '500', margin: 0 }}>
            {config?.deviceName ?? 'VueSign Player'}
          </p>
          <p style={{ color: 'rgba(255,255,255,0.15)', fontSize: '11px', fontFamily: 'monospace', margin: '2px 0 0' }}>
            {config?.deviceId?.slice(-8).toUpperCase()}
          </p>
        </div>

        {/* 스케줄 상태 디버그 */}
        <div style={{ textAlign: 'center' }}>
          {schedules.length === 0 ? (
            <p style={{ color: 'rgba(255,180,0,0.6)', fontSize: '11px', margin: 0 }}>
              ⚠ 배포된 스케줄 없음
            </p>
          ) : (
            <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: '11px', margin: 0 }}>
              스케줄 {schedules.length}개 로드됨 · 현재 활성 없음
            </p>
          )}
          {schedules.length > 0 && (
            <p style={{ color: 'rgba(255,255,255,0.15)', fontSize: '10px', margin: '2px 0 0', fontFamily: 'monospace' }}>
              {schedules[0]?.startTime}~{schedules[0]?.endTime} | {schedules[0]?.startDate}~{schedules[0]?.endDate?.slice(0,10)}
            </p>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
          {/* Connection indicator */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: isConnected ? 'rgba(0,200,80,0.08)' : 'rgba(255,100,0,0.08)',
              border: `1px solid ${isConnected ? 'rgba(0,200,80,0.2)' : 'rgba(255,100,0,0.2)'}`,
              borderRadius: '100px',
              padding: '6px 14px',
            }}
          >
            <div
              style={{
                width: '7px',
                height: '7px',
                borderRadius: '50%',
                background: isConnected ? '#00c850' : '#ff6400',
                boxShadow: isConnected ? '0 0 8px #00c850' : 'none',
                animation: isConnected ? 'none' : 'blink 2s ease-in-out infinite',
              }}
            />
            <span style={{ color: isConnected ? 'rgba(0,200,80,0.8)' : 'rgba(255,100,0,0.8)', fontSize: '12px' }}>
              {isConnected ? '서버 연결됨' : '서버 연결 대기 중'}
            </span>
          </div>
          {/* 종료 단축키 힌트 */}
          <span style={{ color: 'rgba(255,255,255,0.1)', fontSize: '10px', fontFamily: 'monospace' }}>
            Ctrl+Shift+Alt+Q: 종료
          </span>
        </div>
      </div>

      <style>{`
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </div>
  )
}
