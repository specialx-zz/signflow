import React, { useEffect, useState, useMemo } from 'react'
import { usePlayerStore } from './store/playerStore'
import { setBaseURL, registerDevice, fetchWallInfo } from './utils/api'
import { getDeviceId } from './utils/deviceId'

import SetupScreen from './components/SetupScreen'
import ConnectingScreen from './components/ConnectingScreen'
import PlaylistPlayer from './components/PlaylistPlayer'
import ZoneLayoutPlayer from './components/ZoneLayoutPlayer'
import DefaultScreen from './components/DefaultScreen'
import OSDOverlay from './components/OSDOverlay'
import RemoteControlHandler from './components/RemoteControlHandler'
import OfflineNotice from './components/OfflineNotice'
import EmergencyOverlay from './components/EmergencyOverlay'

import { useSocket } from './hooks/useSocket'
import { useSchedule } from './hooks/useSchedule'
import { useOfflineCache } from './hooks/useOfflineCache'
import { useContentSync } from './hooks/useContentSync'

import type { DeviceConfig } from './types'

// ─── 브라우저 직접 접근 차단 화면 ────────────────────────────────────────────
export function BrowserNotSupported() {
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
      }}
    >
      <div
        style={{
          textAlign: 'center',
          color: '#fff',
          maxWidth: '480px',
          padding: '40px',
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '20px',
          backdropFilter: 'blur(20px)',
        }}
      >
        {/* 아이콘 */}
        <div
          style={{
            width: '72px',
            height: '72px',
            borderRadius: '20px',
            background: 'rgba(255,80,80,0.15)',
            border: '1px solid rgba(255,80,80,0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 24px',
            fontSize: '32px',
          }}
        >
          🖥️
        </div>

        <h1 style={{ fontSize: '22px', fontWeight: '700', margin: '0 0 12px', color: '#fff' }}>
          VueSign Player
        </h1>
        <p style={{ fontSize: '15px', color: 'rgba(255,255,255,0.5)', margin: '0 0 8px', lineHeight: '1.6' }}>
          이 앱은 <strong style={{ color: 'rgba(255,255,255,0.8)' }}>Electron 데스크탑 앱</strong>으로만 실행할 수 있습니다.
        </p>
        <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.3)', margin: '0 0 32px', lineHeight: '1.5' }}>
          웹 브라우저에서는 지원되지 않습니다.
        </p>

        <div
          style={{
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '12px',
            padding: '16px 20px',
            textAlign: 'left',
          }}
        >
          <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            실행 방법
          </p>
          <code
            style={{
              fontSize: '13px',
              color: '#4fc3f7',
              fontFamily: 'monospace',
              display: 'block',
              lineHeight: '1.8',
            }}
          >
            npm run electron:dev
          </code>
        </div>
      </div>
    </div>
  )
}

// Inner component that uses hooks (needs config to be set first)
function PlayerCore() {
  useSocket()
  useSchedule()
  useOfflineCache()
  const { syncStatus } = useContentSync()

  const { currentPlaylist, currentLayout, showOSD, isConnected, config, wallInfo, setWallInfo } = usePlayerStore()

  // V5.2: 스크린월 정보 조회
  useEffect(() => {
    if (config?.deviceId) {
      fetchWallInfo(config.deviceId)
        .then(info => {
          if (info?.inWall) {
            console.log(`[Wall] Device is in wall: ${info.wallName} (${info.row},${info.col})`)
          }
          setWallInfo(info)
        })
        .catch(() => setWallInfo({ inWall: false }))
    }
  }, [config?.deviceId, setWallInfo])

  // V5.2: 스크린월 CSS transform
  const wallStyle: React.CSSProperties = useMemo(() => {
    if (wallInfo?.inWall && wallInfo.transform) {
      return {
        transform: wallInfo.transform.css,
        transformOrigin: wallInfo.transform.transformOrigin,
        width: '100vw',
        height: '100vh',
      }
    }
    return {}
  }, [wallInfo])

  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', background: '#000' }}>
      {/* V5.2: 스크린월 transform wrapper */}
      <div style={wallStyle}>
        {/* Main content area */}
        {currentLayout && currentLayout.zones.length > 0 ? (
          <ZoneLayoutPlayer layout={currentLayout} />
        ) : currentPlaylist && currentPlaylist.items.length > 0 ? (
          <PlaylistPlayer playlist={currentPlaylist} />
        ) : (
          <DefaultScreen />
        )}
      </div>

      {/* Overlays — 월 transform 밖에 (항상 전체 화면) */}
      <EmergencyOverlay />
      {showOSD && <OSDOverlay />}
      <OfflineNotice />
      <RemoteControlHandler />
    </div>
  )
}

export default function App() {
  const { config, setConfig, isConnected } = usePlayerStore()
  const [isInitializing, setIsInitializing] = useState(true)
  const [isConnectingPhase, setIsConnectingPhase] = useState(false)

  // Handle URL params for auto-config on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const paramServer = params.get('server')
    const paramName = params.get('name')

    if (paramServer && paramName && !config) {
      const deviceId = getDeviceId()
      const cleanUrl = paramServer.replace(/\/$/, '')
      setBaseURL(cleanUrl)

      // URL 파라미터로 자동 설정 시 서버에 장치 등록 API 호출
      registerDevice({ serverUrl: cleanUrl, deviceName: paramName, deviceId })
        .then((res) => {
          const autoConfig: DeviceConfig = {
            serverUrl: cleanUrl,
            deviceName: paramName,
            deviceId: res.deviceId ?? deviceId,
            registeredAt: res.registeredAt ?? new Date().toISOString(),
          }
          setConfig(autoConfig)
        })
        .catch(() => {
          // 서버 등록 실패해도 일단 로컬 config로 동작 (오프라인 모드)
          const autoConfig: DeviceConfig = {
            serverUrl: cleanUrl,
            deviceName: paramName,
            deviceId,
            registeredAt: new Date().toISOString(),
          }
          setConfig(autoConfig)
        })
        .finally(() => {
          setIsInitializing(false)
        })
    } else {
      setIsInitializing(false)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Set base URL when config loads
  useEffect(() => {
    if (config?.serverUrl) {
      setBaseURL(config.serverUrl)
    }
  }, [config?.serverUrl])

  // Connecting phase: show connecting screen for 2 seconds after config is set
  useEffect(() => {
    if (config && !isConnected) {
      setIsConnectingPhase(true)
      const timer = setTimeout(() => {
        setIsConnectingPhase(false)
      }, 4000)
      return () => clearTimeout(timer)
    } else if (isConnected) {
      setIsConnectingPhase(false)
    }
  }, [config, isConnected])

  const handleConfigured = (newConfig: DeviceConfig) => {
    setBaseURL(newConfig.serverUrl)
    setConfig(newConfig)
    setIsConnectingPhase(true)
  }

  if (isInitializing) {
    return (
      <div
        style={{
          width: '100vw',
          height: '100vh',
          background: '#000',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      />
    )
  }

  if (!config) {
    return <SetupScreen onConfigured={handleConfigured} />
  }

  if (isConnectingPhase && !isConnected) {
    return <ConnectingScreen serverUrl={config.serverUrl} deviceName={config.deviceName} />
  }

  return <PlayerCore />
}
