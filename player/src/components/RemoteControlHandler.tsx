import { useEffect } from 'react'
import { usePlayerStore } from '../store/playerStore'

/**
 * Invisible component that handles keyboard shortcuts for remote control.
 * Also handles fullscreen management.
 */
export default function RemoteControlHandler() {
  const { toggleOSD, nextItem, prevItem, setIsPlaying, isPlaying, setVolume, setBrightness, volume, brightness, clearConfig } =
    usePlayerStore()

  // Request fullscreen after a short delay or on user interaction
  useEffect(() => {
    const requestFullscreen = () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {})
      }
    }

    // Try after 3 seconds
    const timer = setTimeout(requestFullscreen, 3000)

    // Also on first click
    const handleClick = () => {
      requestFullscreen()
      document.removeEventListener('click', handleClick)
    }
    document.addEventListener('click', handleClick)

    return () => {
      clearTimeout(timer)
      document.removeEventListener('click', handleClick)
    }
  }, [])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'F1':
          e.preventDefault()
          toggleOSD()
          break

        case 'F11':
          e.preventDefault()
          if (document.fullscreenElement) {
            document.exitFullscreen().catch(() => {})
          } else {
            document.documentElement.requestFullscreen().catch(() => {})
          }
          break

        case 'Escape':
          // ESC with Ctrl+Shift → show setup (admin escape)
          if (e.ctrlKey && e.shiftKey) {
            e.preventDefault()
            if (window.confirm('장치 설정을 초기화하시겠습니까?')) {
              clearConfig()
              window.location.reload()
            }
          }
          break

        case ' ':
          // Space → play/pause
          e.preventDefault()
          setIsPlaying(!isPlaying)
          break

        case 'ArrowRight':
          e.preventDefault()
          nextItem()
          break

        case 'ArrowLeft':
          e.preventDefault()
          prevItem()
          break

        case 'ArrowUp':
          e.preventDefault()
          setVolume(Math.min(100, volume + 10))
          break

        case 'ArrowDown':
          e.preventDefault()
          setVolume(Math.max(0, volume - 10))
          break

        case '+':
        case '=':
          if (e.ctrlKey) {
            e.preventDefault()
            setBrightness(Math.min(100, brightness + 10))
          }
          break

        case '-':
          if (e.ctrlKey) {
            e.preventDefault()
            setBrightness(Math.max(10, brightness - 10))
          }
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [toggleOSD, nextItem, prevItem, setIsPlaying, isPlaying, setVolume, setBrightness, volume, brightness, clearConfig])

  // Long press handler for touch screens (toggle OSD)
  useEffect(() => {
    let longPressTimer: ReturnType<typeof setTimeout> | null = null

    const handleTouchStart = () => {
      longPressTimer = setTimeout(() => {
        toggleOSD()
      }, 2000)
    }

    const handleTouchEnd = () => {
      if (longPressTimer) {
        clearTimeout(longPressTimer)
        longPressTimer = null
      }
    }

    document.addEventListener('touchstart', handleTouchStart)
    document.addEventListener('touchend', handleTouchEnd)
    document.addEventListener('touchmove', handleTouchEnd)

    return () => {
      document.removeEventListener('touchstart', handleTouchStart)
      document.removeEventListener('touchend', handleTouchEnd)
      document.removeEventListener('touchmove', handleTouchEnd)
      if (longPressTimer) clearTimeout(longPressTimer)
    }
  }, [toggleOSD])

  return null
}
