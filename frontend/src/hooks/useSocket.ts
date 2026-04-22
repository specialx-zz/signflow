import { useEffect, useRef, useState } from 'react'
import { io, type Socket } from 'socket.io-client'
import { useAuthStore } from '@/store/authStore'

// 개발: VITE_API_URL 환경변수 / 프로덕션: 같은 도메인 (Nginx가 /socket.io 프록시)
const SERVER_URL = (import.meta.env.VITE_API_URL as string) || window.location.origin

let globalSocket: Socket | null = null

export function useSocket() {
  const [isConnected, setIsConnected] = useState(false)
  const socketRef = useRef<Socket | null>(null)

  useEffect(() => {
    if (!globalSocket) {
      // Read token from Zustand authStore (persisted under 'vuesign-auth' key)
      const token = useAuthStore.getState().token
      globalSocket = io(SERVER_URL, {
        transports: ['websocket', 'polling'],
        reconnectionAttempts: Infinity,
        reconnectionDelay: 3000,
      })
      if (token) {
        globalSocket.emit('authenticate', { token })
      }
    }

    socketRef.current = globalSocket

    const onConnect = () => setIsConnected(true)
    const onDisconnect = () => setIsConnected(false)

    globalSocket.on('connect', onConnect)
    globalSocket.on('disconnect', onDisconnect)
    setIsConnected(globalSocket.connected)

    return () => {
      globalSocket?.off('connect', onConnect)
      globalSocket?.off('disconnect', onDisconnect)
    }
  }, [])

  // globalSocket is a module-level singleton, always returns the live instance
  return { socket: globalSocket, isConnected }
}

/**
 * Disconnect and destroy the global socket (call on logout).
 */
export function disconnectSocket() {
  if (globalSocket) {
    globalSocket.disconnect()
    globalSocket = null
  }
}
