/**
 * 디지털 시계 위젯 — 캔버스 에디터 & 플레이어용
 */
import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'

interface Props {
  config?: {
    format?: string      // 'HH:mm:ss' | 'HH:mm' | 'hh:mm a'
    color?: string
    fontSize?: number
    fontFamily?: string
    showDate?: boolean
    dateFormat?: string  // 'yyyy-MM-dd' | 'MM/dd' | 'yyyy년 MM월 dd일'
  }
  width?: number
  height?: number
}

export default function ClockWidget({ config = {}, width = 200, height = 60 }: Props) {
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const timeStr = format(now, config.format || 'HH:mm:ss')
  const dateStr = config.showDate ? format(now, config.dateFormat || 'yyyy-MM-dd', { locale: ko }) : ''

  return (
    <div
      style={{
        width, height,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        color: config.color || '#FFFFFF',
        fontFamily: config.fontFamily || 'Noto Sans KR',
      }}
    >
      <span style={{ fontSize: config.fontSize || 32, fontWeight: 'bold', lineHeight: 1 }}>
        {timeStr}
      </span>
      {dateStr && (
        <span style={{ fontSize: (config.fontSize || 32) * 0.4, opacity: 0.7, marginTop: 4 }}>
          {dateStr}
        </span>
      )}
    </div>
  )
}

export const clockWidgetDefaults = {
  format: 'HH:mm:ss',
  color: '#FFFFFF',
  fontSize: 48,
  fontFamily: 'Noto Sans KR',
  showDate: true,
  dateFormat: 'yyyy-MM-dd'
}
