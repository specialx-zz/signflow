/**
 * V4 Phase 16: 웹페이지 임베드 위젯
 * iframe으로 외부 URL 표시
 */
import { useEffect, useRef } from 'react'
import { Globe } from 'lucide-react'

interface Props {
  config?: {
    url?: string
    refreshInterval?: number
  }
  width?: number
  height?: number
}

export default function WebpageWidget({ config = {}, width = 800, height = 600 }: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const url = config.url

  // 자동 새로고침
  useEffect(() => {
    if (!url || !config.refreshInterval || config.refreshInterval <= 0) return
    const interval = setInterval(() => {
      if (iframeRef.current) {
        iframeRef.current.src = url
      }
    }, config.refreshInterval * 1000)
    return () => clearInterval(interval)
  }, [url, config.refreshInterval])

  if (!url) {
    return (
      <div
        style={{
          width, height,
          backgroundColor: 'rgba(0,0,0,0.4)',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          borderRadius: 8, border: '2px dashed rgba(255,255,255,0.2)'
        }}
      >
        <Globe style={{ width: 40, height: 40, color: 'rgba(255,255,255,0.3)' }} />
        <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 8, fontFamily: 'Noto Sans KR' }}>
          웹페이지 URL을 설정하세요
        </span>
      </div>
    )
  }

  return (
    <iframe
      ref={iframeRef}
      src={url}
      style={{
        width, height,
        border: 'none',
        borderRadius: 4,
        backgroundColor: '#fff'
      }}
      sandbox="allow-scripts allow-same-origin allow-popups"
      title="Webpage Widget"
    />
  )
}

export const webpageWidgetDefaults = {
  url: 'https://example.com',
  refreshInterval: 0
}
