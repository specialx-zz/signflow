import React from 'react'
import ReactDOM from 'react-dom/client'
import App, { BrowserNotSupported } from './App'
import { isElectron, isCapacitor } from './utils/electronBridge'
import './index.css'

// Register service worker (Electron/Web 전용, Capacitor는 불필요)
if ('serviceWorker' in navigator && !isCapacitor()) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Service worker registration failed silently
    })
  })
}

// Electron(Windows) 또는 Capacitor(Android)면 앱 실행, 순수 웹 브라우저면 차단
const Root = (isElectron() || isCapacitor()) ? App : BrowserNotSupported

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
)
