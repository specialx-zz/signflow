import React, { useState, useEffect } from 'react'
import { getDeviceId } from '../utils/deviceId'
import { registerDevice, pingServer, setBaseURL, apiClient } from '../utils/api'
import { usePlayerStore } from '../store/playerStore'
import { isElectron } from '../utils/electronBridge'
import type { DeviceConfig } from '../types'

interface SetupScreenProps {
  onConfigured: (config: DeviceConfig) => void
}

export default function SetupScreen({ onConfigured }: SetupScreenProps) {
  const [serverUrl, setServerUrl] = useState('http://localhost:3001')
  const [deviceName, setDeviceName] = useState('')
  const [registrationCode, setRegistrationCode] = useState('')
  const [mode, setMode] = useState<'url' | 'token'>('url') // url: 직접입력, token: 등록코드
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [step, setStep] = useState<'form' | 'connecting'>('form')
  const autoSubmitRef = React.useRef(false)

  useEffect(() => {
    // Auto-populate device name from hostname or default
    const hostname = window.location.hostname
    const defaultName = hostname !== 'localhost' ? `Player-${hostname}` : `Player-${Date.now().toString(36).toUpperCase()}`
    setDeviceName(defaultName)

    // Check URL params for auto-config
    const params = new URLSearchParams(window.location.search)
    const paramServer = params.get('server')
    const paramName = params.get('name')
    if (paramServer) setServerUrl(paramServer)
    if (paramName) setDeviceName(paramName)

    // Auto-submit handled via autoSubmitRef below
    if (paramServer && paramName) {
      autoSubmitRef.current = true
    }
  }, [])

  // Auto-submit when URL params provide both server and name
  useEffect(() => {
    if (autoSubmitRef.current && serverUrl && deviceName) {
      autoSubmitRef.current = false
      handleSubmit({ preventDefault: () => {} } as React.FormEvent)
    }
  }) // intentionally no deps - runs after state updates settle

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (mode === 'token') {
      return handleTokenRegistration()
    }

    if (!serverUrl.trim() || !deviceName.trim()) {
      setError('서버 URL과 장치 이름을 입력해주세요.')
      return
    }

    setIsLoading(true)
    setError(null)
    setStep('connecting')

    const cleanUrl = serverUrl.replace(/\/$/, '')
    const deviceId = getDeviceId()

    try {
      // First, check if server is reachable
      setBaseURL(cleanUrl)
      const reachable = await pingServer(cleanUrl)
      if (!reachable) {
        throw new Error('서버에 연결할 수 없습니다. URL을 확인해주세요.')
      }

      // Register device
      const response = await registerDevice({
        serverUrl: cleanUrl,
        deviceName: deviceName.trim(),
        deviceId,
      })

      const config: DeviceConfig = {
        serverUrl: cleanUrl,
        deviceName: deviceName.trim(),
        deviceId: response.deviceId ?? deviceId,
        registeredAt: response.registeredAt ?? new Date().toISOString(),
      }

      onConfigured(config)
    } catch (err) {
      console.error('[Setup] Registration failed:', err)
      const message =
        err instanceof Error ? err.message : '서버 연결에 실패했습니다.'
      setError(message)
      setStep('form')
    } finally {
      setIsLoading(false)
    }
  }

  const handleTokenRegistration = async () => {
    if (!serverUrl.trim() || !registrationCode.trim()) {
      setError('서버 URL과 등록 코드를 입력해주세요.')
      return
    }

    setIsLoading(true)
    setError(null)
    setStep('connecting')

    const cleanUrl = serverUrl.replace(/\/$/, '')
    const deviceId = getDeviceId()

    try {
      setBaseURL(cleanUrl)
      const reachable = await pingServer(cleanUrl)
      if (!reachable) {
        throw new Error('서버에 연결할 수 없습니다.')
      }

      const response = await apiClient.post('/api/devices/register-with-token', {
        code: registrationCode.trim().toUpperCase(),
        deviceId,
        deviceName: deviceName.trim() || undefined,
        playerVersion: '1.0.0',
      })

      const data = response.data
      const config: DeviceConfig = {
        serverUrl: cleanUrl,
        deviceName: data.deviceName || deviceName || `Device-${registrationCode}`,
        deviceId: data.deviceId || deviceId,
        registeredAt: data.registeredAt || new Date().toISOString(),
      }

      onConfigured(config)
    } catch (err: any) {
      console.error('[Setup] Token registration failed:', err)
      const message = err.response?.data?.error || err.message || '등록에 실패했습니다.'
      setError(message)
      setStep('form')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        background: 'linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 50%, #0d1117 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: "'Segoe UI', system-ui, sans-serif",
        cursor: 'default',
      }}
    >
      {/* Background grid effect */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `
            linear-gradient(rgba(0,120,255,0.05) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0,120,255,0.05) 1px, transparent 1px)
          `,
          backgroundSize: '60px 60px',
          pointerEvents: 'none',
        }}
      />

      <div
        style={{
          position: 'relative',
          width: '440px',
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '20px',
          padding: '48px 40px',
          backdropFilter: 'blur(20px)',
          boxShadow: '0 24px 60px rgba(0,0,0,0.5)',
        }}
      >
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <div
            style={{
              width: '72px',
              height: '72px',
              borderRadius: '20px',
              background: 'linear-gradient(135deg, #0078ff 0%, #00d4ff 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px',
              boxShadow: '0 8px 24px rgba(0,120,255,0.4)',
            }}
          >
            <span style={{ fontSize: '36px', fontWeight: '900', color: '#fff', letterSpacing: '-2px' }}>
              N
            </span>
          </div>
          <h1 style={{ color: '#fff', fontSize: '26px', fontWeight: '700', margin: '0 0 8px' }}>
            VueSign Player
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px', margin: 0 }}>
            디지털 사이니지 플레이어
          </p>
        </div>

        {step === 'connecting' ? (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div
              style={{
                width: '48px',
                height: '48px',
                border: '3px solid rgba(255,255,255,0.1)',
                borderTopColor: '#0078ff',
                borderRadius: '50%',
                margin: '0 auto 20px',
                animation: 'spin 0.8s linear infinite',
              }}
            />
            <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '16px' }}>
              서버에 연결 중...
            </p>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px', marginTop: '8px' }}>
              {serverUrl}
            </p>
          </div>
        ) : (
          <form id="setup-form" onSubmit={handleSubmit}>
            {/* Mode Toggle */}
            <div style={{ display: 'flex', gap: '4px', marginBottom: '24px', background: 'rgba(255,255,255,0.06)', borderRadius: '10px', padding: '4px' }}>
              <button
                type="button"
                onClick={() => { setMode('url'); setError(null) }}
                style={{
                  flex: 1, padding: '8px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                  background: mode === 'url' ? 'rgba(0,120,255,0.8)' : 'transparent',
                  color: mode === 'url' ? '#fff' : 'rgba(255,255,255,0.5)',
                  fontSize: '13px', fontWeight: '600', transition: 'all 0.2s',
                }}
              >
                URL 직접 입력
              </button>
              <button
                type="button"
                onClick={() => { setMode('token'); setError(null) }}
                style={{
                  flex: 1, padding: '8px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                  background: mode === 'token' ? 'rgba(0,120,255,0.8)' : 'transparent',
                  color: mode === 'token' ? '#fff' : 'rgba(255,255,255,0.5)',
                  fontSize: '13px', fontWeight: '600', transition: 'all 0.2s',
                }}
              >
                등록 코드
              </button>
            </div>

            {/* Server URL (both modes) */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', color: 'rgba(255,255,255,0.6)', fontSize: '13px', fontWeight: '500', marginBottom: '8px', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                서버 URL
              </label>
              <input
                type="url"
                value={serverUrl}
                onChange={(e) => setServerUrl(e.target.value)}
                placeholder="http://192.168.1.100:3001"
                required
                style={{ width: '100%', padding: '12px 16px', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '10px', color: '#fff', fontSize: '15px', outline: 'none', transition: 'border-color 0.2s', cursor: 'text' }}
                onFocus={(e) => (e.target.style.borderColor = '#0078ff')}
                onBlur={(e) => (e.target.style.borderColor = 'rgba(255,255,255,0.12)')}
              />
            </div>

            {mode === 'token' ? (
              /* Token Mode: Registration Code */
              <>
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', color: 'rgba(255,255,255,0.6)', fontSize: '13px', fontWeight: '500', marginBottom: '8px', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                    등록 코드 (6자리)
                  </label>
                  <input
                    type="text"
                    value={registrationCode}
                    onChange={(e) => setRegistrationCode(e.target.value.toUpperCase().slice(0, 6))}
                    placeholder="ABC123"
                    required
                    maxLength={6}
                    style={{ width: '100%', padding: '16px', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '10px', color: '#fff', fontSize: '24px', fontWeight: '700', letterSpacing: '8px', textAlign: 'center', fontFamily: 'monospace', outline: 'none', transition: 'border-color 0.2s', cursor: 'text' }}
                    onFocus={(e) => (e.target.style.borderColor = '#0078ff')}
                    onBlur={(e) => (e.target.style.borderColor = 'rgba(255,255,255,0.12)')}
                  />
                  <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '12px', marginTop: '6px', textAlign: 'center' }}>
                    관리자에게 받은 등록 코드를 입력하세요
                  </p>
                </div>
                <div style={{ marginBottom: '28px' }}>
                  <label style={{ display: 'block', color: 'rgba(255,255,255,0.6)', fontSize: '13px', fontWeight: '500', marginBottom: '8px', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                    장치 이름 (선택)
                  </label>
                  <input
                    type="text"
                    value={deviceName}
                    onChange={(e) => setDeviceName(e.target.value)}
                    placeholder="자동 할당됨"
                    style={{ width: '100%', padding: '12px 16px', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '10px', color: '#fff', fontSize: '15px', outline: 'none', transition: 'border-color 0.2s', cursor: 'text' }}
                    onFocus={(e) => (e.target.style.borderColor = '#0078ff')}
                    onBlur={(e) => (e.target.style.borderColor = 'rgba(255,255,255,0.12)')}
                  />
                </div>
              </>
            ) : (
              /* URL Mode: Device Name */
              <div style={{ marginBottom: '28px' }}>
                <label style={{ display: 'block', color: 'rgba(255,255,255,0.6)', fontSize: '13px', fontWeight: '500', marginBottom: '8px', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                  장치 이름
                </label>
                <input
                  type="text"
                  value={deviceName}
                  onChange={(e) => setDeviceName(e.target.value)}
                  placeholder="Lobby-Display-1"
                  required
                  style={{ width: '100%', padding: '12px 16px', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '10px', color: '#fff', fontSize: '15px', outline: 'none', transition: 'border-color 0.2s', cursor: 'text' }}
                  onFocus={(e) => (e.target.style.borderColor = '#0078ff')}
                  onBlur={(e) => (e.target.style.borderColor = 'rgba(255,255,255,0.12)')}
                />
              </div>
            )}

            {error && (
              <div style={{ background: 'rgba(255,60,60,0.1)', border: '1px solid rgba(255,60,60,0.3)', borderRadius: '8px', padding: '12px 14px', color: '#ff6b6b', fontSize: '13px', marginBottom: '20px' }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              style={{
                width: '100%', padding: '14px',
                background: isLoading ? 'rgba(0,120,255,0.4)' : 'linear-gradient(135deg, #0078ff 0%, #0056d6 100%)',
                border: 'none', borderRadius: '10px', color: '#fff', fontSize: '15px', fontWeight: '600',
                cursor: isLoading ? 'not-allowed' : 'pointer', transition: 'all 0.2s',
                boxShadow: isLoading ? 'none' : '0 4px 16px rgba(0,120,255,0.3)',
              }}
            >
              {isLoading ? '연결 중...' : mode === 'token' ? '코드로 등록' : '연결 및 등록'}
            </button>
          </form>
        )}

        {/* Device ID display */}
        <div style={{ marginTop: '24px', textAlign: 'center' }}>
          <span
            style={{
              color: 'rgba(255,255,255,0.25)',
              fontSize: '11px',
              fontFamily: 'monospace',
            }}
          >
            Device ID: {getDeviceId().slice(-8).toUpperCase()}
          </span>
        </div>

        {/* 종료 단축키 안내 */}
        <div style={{ marginTop: '16px', textAlign: 'center' }}>
          <span style={{ color: 'rgba(255,255,255,0.15)', fontSize: '11px' }}>
            종료: <kbd style={{ background: 'rgba(255,255,255,0.08)', padding: '2px 6px', borderRadius: '4px', fontFamily: 'monospace', fontSize: '11px', color: 'rgba(255,255,255,0.3)' }}>Ctrl+Shift+Alt+Q</kbd>
          </span>
        </div>
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        input::placeholder { color: rgba(255,255,255,0.25); }
      `}</style>
    </div>
  )
}
