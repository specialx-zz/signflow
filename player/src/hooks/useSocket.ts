import { useEffect, useRef, useCallback } from 'react'
import { io, Socket } from 'socket.io-client'
import html2canvas from 'html2canvas'
import { usePlayerStore } from '../store/playerStore'
import { fetchSchedules, reportStatus, sendScreenshot, setBaseURL } from '../utils/api'
import type { RemoteCommandPayload, EmergencyMessage } from '../types'

const RECONNECT_INTERVAL = 10000
const STATUS_INTERVAL = 30000
const SCREENSHOT_INTERVAL = 60000
const SCHEDULE_REFRESH_INTERVAL = 5 * 60 * 1000 // 5분마다 스케줄 강제 갱신

export function useSocket() {
  const socketRef = useRef<Socket | null>(null)
  const sendStatusUpdateRef = useRef<(() => void) | null>(null)
  const scheduleRefreshDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const statusIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const screenshotIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const scheduleRefreshIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Only subscribe to config to avoid re-renders from status changes
  const config = usePlayerStore((s) => s.config)
  const setConnected = usePlayerStore((s) => s.setConnected)
  const setServerReachable = usePlayerStore((s) => s.setServerReachable)
  const setSchedules = usePlayerStore((s) => s.setSchedules)

  const captureScreenshot = useCallback(async (): Promise<Blob | null> => {
    // ── 1차 시도: html2canvas (iframe · img · video · CSS 전부 렌더링) ──
    try {
      const scale = Math.min(0.5, 960 / window.innerWidth)
      const canvas = await html2canvas(document.body, {
        allowTaint: false,   // cross-origin 요소는 그리지 않고 건너뜀
        useCORS: true,       // CORS 헤더가 있는 이미지는 직접 그림
        scale,
        logging: false,
        backgroundColor: '#000',
        // 비디오는 html2canvas가 건너뛰므로 아래에서 수동으로 덮어씀
        ignoreElements: (el) => {
          // script, style은 제외 (내부적으로 이미 제외되지만 명시)
          return el.tagName === 'NOSCRIPT'
        },
        onclone: (_doc, el) => {
          // 클론된 DOM에서도 전체화면 유지
          el.style.width = `${window.innerWidth}px`
          el.style.height = `${window.innerHeight}px`
        },
      })

      // html2canvas는 <video>를 그리지 못하므로 수동으로 현재 프레임 덮어씀
      const ctx = canvas.getContext('2d')
      if (ctx) {
        for (const vid of document.querySelectorAll<HTMLVideoElement>('video')) {
          if (vid.readyState < 2 || vid.videoWidth === 0) continue
          const rect = vid.getBoundingClientRect()
          if (rect.width <= 0 || rect.height <= 0) continue
          try {
            ctx.drawImage(
              vid,
              Math.floor(rect.left * scale),
              Math.floor(rect.top * scale),
              Math.floor(rect.width * scale),
              Math.floor(rect.height * scale)
            )
          } catch { /* cross-origin 비디오 무시 */ }
        }
      }

      const blob = await new Promise<Blob | null>(resolve =>
        canvas.toBlob(resolve, 'image/jpeg', 0.85)
      )
      if (blob && blob.size > 1000) {
        console.log(`[Screenshot] html2canvas OK – ${blob.size} bytes`)
        return blob
      }
    } catch (e) {
      console.error('[Screenshot] html2canvas failed:', e)
    }

    // ── 최종 폴백: 장치명 + 시각 텍스트 (완전히 실패했을 때만) ─────────
    try {
      const W = Math.floor(window.innerWidth * 0.5)
      const H = Math.floor(window.innerHeight * 0.5)
      const cvs = document.createElement('canvas')
      cvs.width = W
      cvs.height = H
      const cx = cvs.getContext('2d')!
      cx.fillStyle = '#111'
      cx.fillRect(0, 0, W, H)
      cx.fillStyle = '#888'
      const fs = Math.max(14, Math.floor(H / 18))
      cx.font = `${fs}px monospace`
      cx.fillText(config?.deviceName ?? 'Unknown Device', Math.floor(W * 0.05), Math.floor(H * 0.4))
      cx.fillText(new Date().toLocaleString('ko-KR'), Math.floor(W * 0.05), Math.floor(H * 0.55))
      return new Promise(resolve => cvs.toBlob(resolve, 'image/jpeg', 0.8))
    } catch {
      return null
    }
  }, [config])

  const sendStatusUpdate = useCallback(() => {
    if (!config || !socketRef.current?.connected) return

    const store = usePlayerStore.getState()
    const status = {
      isOnline: true,
      currentContent:
        store.currentPlaylist?.items[store.currentItemIndex]?.content?.name ?? null,
      currentPlaylist: store.currentPlaylist?.name ?? null,
      currentSchedule: store.currentSchedule?.id ?? null,
      volume: store.volume,
      brightness: store.brightness,
      isPlaying: store.isPlaying,
    }

    socketRef.current.emit('device:status', {
      deviceId: config.deviceId,
      status,
    })

    // Also report via REST API
    reportStatus(config.deviceId, status).catch(() => {})
  }, [config])

  const handleRemoteCommand = useCallback(
    async (payload: RemoteCommandPayload) => {
      console.log('[Socket] Remote command:', payload)
      const store = usePlayerStore.getState()

      switch (payload.command) {
        case 'PLAY':
          store.setIsPlaying(true)
          break
        case 'PAUSE':
          store.setIsPlaying(false)
          break
        case 'NEXT':
          store.nextItem()
          break
        case 'PREV':
          store.prevItem()
          break
        case 'VOLUME_UP':
          store.setVolume(store.volume + 10)
          break
        case 'VOLUME_DOWN':
          store.setVolume(store.volume - 10)
          break
        case 'VOLUME_SET': {
          const vol = payload.value ?? payload.params?.value
          if (vol !== undefined) store.setVolume(Number(vol))
          break
        }
        case 'BRIGHTNESS': {
          const bri = payload.value ?? payload.params?.value
          if (bri !== undefined) store.setBrightness(Number(bri))
          break
        }
        case 'MUTE':
          store.setVolume(store.volume === 0 ? 50 : 0)
          break
        case 'POWER_OFF':
          // Darken screen
          document.body.style.filter = 'brightness(0)'
          break
        case 'POWER_ON':
          document.body.style.filter = ''
          break
        case 'POWER_TOGGLE':
          document.body.style.filter = document.body.style.filter === 'brightness(0)' ? '' : 'brightness(0)'
          break
        case 'REFRESH':
          setTimeout(() => window.location.reload(), 500)
          break
        case 'RESTART':
          setTimeout(() => window.location.reload(), 500)
          break
        case 'SCREENSHOT': {
          if (!config) break
          try {
            const blob = await captureScreenshot()
            if (blob) {
              console.log(`[Screenshot] Captured ${blob.size} bytes, uploading...`)
              await sendScreenshot(config.deviceId, blob)
              console.log('[Screenshot] Upload OK')
            } else {
              console.warn('[Screenshot] captureScreenshot returned null')
            }
          } catch (e) {
            console.error('[Screenshot] Failed:', e)
          }
          break
        }
      }
    },
    [config, captureScreenshot]
  )

  const connectSocket = useCallback(() => {
    if (!config) return
    if (socketRef.current?.connected) return

    const serverUrl = config.serverUrl.replace(/\/$/, '')
    setBaseURL(serverUrl)

    console.log(`[Socket] Connecting to ${serverUrl}`)

    const socket = io(serverUrl, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: Infinity,
      reconnectionDelay: RECONNECT_INTERVAL,
      reconnectionDelayMax: RECONNECT_INTERVAL * 3,
      timeout: 10000,
    })

    socketRef.current = socket

    socket.on('connect', () => {
      console.log('[Socket] Connected:', socket.id)
      setConnected(true)
      setServerReachable(true)

      // Register device with server
      socket.emit('device:register', {
        deviceId: config.deviceId,
        deviceName: config.deviceName,
        playerVersion: '1.0.0',
        socketId: socket.id,
      })

      // Fetch current schedules
      fetchSchedules(config.deviceId)
        .then((result) => {
          setSchedules(result.schedules)
          const store = usePlayerStore.getState()
          store.setDefaultChannel(result.defaultChannel || null)
          store.setDeviceTags(result.deviceTags || null)
        })
        .catch(() => {})

      // Send initial status
      sendStatusUpdate()
    })

    socket.on('disconnect', (reason) => {
      console.log('[Socket] Disconnected:', reason)
      setConnected(false)
    })

    socket.on('connect_error', (err) => {
      console.error('[Socket] Connection error:', err.message)
      setConnected(false)
      setServerReachable(false)
    })

    // Debounced schedule refresh — prevents triple calls when schedule:update,
    // content:update, and channel:update all fire in the same deployment cycle.
    const debouncedFetchSchedules = () => {
      if (scheduleRefreshDebounceRef.current) {
        clearTimeout(scheduleRefreshDebounceRef.current)
      }
      scheduleRefreshDebounceRef.current = setTimeout(() => {
        if (!config) return
        fetchSchedules(config.deviceId)
          .then((result) => {
            setSchedules(result.schedules)
            const store = usePlayerStore.getState()
            store.setDefaultChannel(result.defaultChannel || null)
            store.setDeviceTags(result.deviceTags || null)
          })
          .catch(() => {})
      }, 500)
    }

    socket.on('schedule:update', () => {
      console.log('[Socket] Schedule update received')
      debouncedFetchSchedules()
    })

    socket.on('content:update', () => {
      console.log('[Socket] Content update received')
      debouncedFetchSchedules()
    })

    // V5.2: 채널 콘텐츠 변경 시 스케줄 재조회 (기본 채널 포함)
    socket.on('channel:update', () => {
      console.log('[Socket] Channel update received')
      debouncedFetchSchedules()
    })

    // V5.3: 긴급 메시지 이벤트 리스너
    socket.on('emergency:message', (data: EmergencyMessage) => {
      console.log('[Socket] Emergency message received:', data.id)
      const store = usePlayerStore.getState()
      store.addEmergencyMessage(data)
    })

    socket.on('emergency:dismiss', (data: { id: string }) => {
      console.log('[Socket] Emergency dismiss received:', data.id)
      const store = usePlayerStore.getState()
      store.dismissEmergencyMessage(data.id)
    })

    socket.on('remote:command', (payload: RemoteCommandPayload) => {
      handleRemoteCommand(payload)
    })

    socket.on('remote:screenshot', () => {
      handleRemoteCommand({ command: 'SCREENSHOT' })
    })

    socket.on('device:ping', () => {
      // Use ref to always call the latest sendStatusUpdate (avoids stale closure)
      sendStatusUpdateRef.current?.()
    })

    return socket
  }, [config, setConnected, setServerReachable, setSchedules, handleRemoteCommand])

  // Initial connection
  useEffect(() => {
    if (!config) return

    const socket = connectSocket()

    // Status reporting interval
    statusIntervalRef.current = setInterval(sendStatusUpdate, STATUS_INTERVAL)

    // Auto-periodic screenshot interval (every 60 seconds)
    screenshotIntervalRef.current = setInterval(async () => {
      if (!config || !socketRef.current?.connected) return
      try {
        const blob = await captureScreenshot()
        if (blob && config) {
          await sendScreenshot(config.deviceId, blob)
        }
      } catch (e) {
        console.error('[Screenshot] Periodic capture failed:', e)
      }
    }, SCREENSHOT_INTERVAL)

    // 5분마다 스케줄 강제 갱신 (소켓 이벤트를 놓쳤을 때를 대비)
    scheduleRefreshIntervalRef.current = setInterval(() => {
      if (config) {
        fetchSchedules(config.deviceId)
          .then((result) => {
            setSchedules(result.schedules)
            const store = usePlayerStore.getState()
            store.setDefaultChannel(result.defaultChannel || null)
            store.setDeviceTags(result.deviceTags || null)
          })
          .catch(() => {})
      }
    }, SCHEDULE_REFRESH_INTERVAL)

    return () => {
      if (statusIntervalRef.current) clearInterval(statusIntervalRef.current)
      if (screenshotIntervalRef.current) clearInterval(screenshotIntervalRef.current)
      if (scheduleRefreshIntervalRef.current) clearInterval(scheduleRefreshIntervalRef.current)
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current)
      socket?.removeAllListeners()
      socket?.disconnect()
      socketRef.current = null
    }
  }, [config]) // eslint-disable-line react-hooks/exhaustive-deps

  // Keep sendStatusUpdate ref up to date so socket handlers always call the latest version
  useEffect(() => {
    sendStatusUpdateRef.current = sendStatusUpdate
  }, [sendStatusUpdate])

  // Keep interval up to date without reconnecting
  useEffect(() => {
    if (statusIntervalRef.current) {
      clearInterval(statusIntervalRef.current)
      statusIntervalRef.current = setInterval(sendStatusUpdate, STATUS_INTERVAL)
    }
  }, [sendStatusUpdate])

  return {
    socket: socketRef.current,
    isConnected: socketRef.current?.connected ?? false,
  }
}
