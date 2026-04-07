/**
 * V4 Phase 16: Google Sheets 임베드 위젯
 * Google Sheets 공유 URL을 iframe으로 표시
 */
import { useEffect, useRef } from 'react'
import { FileSpreadsheet } from 'lucide-react'

interface Props {
  config?: {
    url?: string
    refreshInterval?: number
  }
  width?: number
  height?: number
}

function convertToEmbedUrl(url: string): string {
  // Google Sheets URL을 embed URL로 변환
  // https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit → /pubhtml
  if (url.includes('docs.google.com/spreadsheets')) {
    const match = url.match(/\/d\/([a-zA-Z0-9-_]+)/)
    if (match) {
      return `https://docs.google.com/spreadsheets/d/${match[1]}/pubhtml?widget=true&headers=false`
    }
  }
  return url
}

export default function SpreadsheetWidget({ config = {}, width = 800, height = 500 }: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const url = config.url

  // 자동 새로고침
  useEffect(() => {
    if (!url || !config.refreshInterval || config.refreshInterval < 60) return
    const interval = setInterval(() => {
      if (iframeRef.current) {
        iframeRef.current.src = convertToEmbedUrl(url)
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
        <FileSpreadsheet style={{ width: 40, height: 40, color: 'rgba(255,255,255,0.3)' }} />
        <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 8, fontFamily: 'Noto Sans KR' }}>
          Google Sheets URL을 설정하세요
        </span>
      </div>
    )
  }

  return (
    <iframe
      ref={iframeRef}
      src={convertToEmbedUrl(url)}
      style={{
        width, height,
        border: 'none',
        borderRadius: 4,
        backgroundColor: '#fff'
      }}
      title="Spreadsheet Widget"
    />
  )
}

export const spreadsheetWidgetDefaults = {
  url: '',
  refreshInterval: 300
}
