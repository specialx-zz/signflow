/**
 * VueSign Phase W1: 플레이어용 날씨/대기질 위젯
 *
 * 에디터(frontend/WeatherWidgets.tsx)와 동일한 9개 위젯을 제공하지만,
 *   - react-query 대신 직접 fetch + setInterval 폴링
 *   - lucide-react 대신 인라인 SVG 아이콘
 * 을 사용한다.
 *
 * 폴링 주기:
 *   - weather.current / today.minmax / location / icon / temp:  5분
 *   - weather.weekly:  30분
 *   - air.pm.* :  10분
 */
import React, { useEffect, useRef, useState } from 'react'
import type { WidgetKey, WidgetConfig } from '../types'
import {
  weatherApi,
  type WeatherCurrentResponse,
  type WeatherWeeklyResponse,
  type AirResponse,
  type WeatherLocationLite,
} from '../utils/weatherApi'

// ─── 공통 훅 ─────────────────────────────────────
function usePolledData<T>(
  key: string | null,
  fetcher: () => Promise<T>,
  intervalMs: number
) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!key) {
      setData(null)
      setError(null)
      return
    }
    let cancelled = false

    async function run() {
      try {
        setLoading(true)
        const result = await fetcher()
        if (!cancelled) {
          setData(result)
          setError(null)
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'fetch error')
          console.warn('[WeatherWidget] fetch 실패:', e)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    run()
    timerRef.current = setInterval(run, intervalMs)
    return () => {
      cancelled = true
      if (timerRef.current) clearInterval(timerRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, intervalMs])

  return { data, loading, error }
}

// ─── 상태 표시 ───────────────────────────────────
function NeedsLocation({ style }: { style?: React.CSSProperties }) {
  return (
    <div
      style={{
        ...style,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(59, 130, 246, 0.12)',
        border: '2px dashed rgba(59, 130, 246, 0.6)',
        color: '#1D4ED8',
        fontSize: 14,
        fontWeight: 600,
        textAlign: 'center',
        padding: 12,
        borderRadius: 12,
        gap: 4,
      }}
    >
      <div style={{ fontSize: 28 }}>📍</div>
      <div>위치 미설정</div>
      <div style={{ fontSize: 11, opacity: 0.75, fontWeight: 400 }}>
        캔버스 편집기에서 위치를 선택하세요
      </div>
    </div>
  )
}

function ErrorBox({ style, message }: { style?: React.CSSProperties; message: string }) {
  return (
    <div
      style={{
        ...style,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(127, 29, 29, 0.4)',
        border: '1px solid rgba(239, 68, 68, 0.4)',
        color: '#FECACA',
        fontSize: 12,
        textAlign: 'center',
        padding: 8,
        borderRadius: 8,
      }}
    >
      {message}
    </div>
  )
}

function Loading({ style }: { style?: React.CSSProperties }) {
  return (
    <div
      style={{
        ...style,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(30, 41, 59, 0.4)',
        color: '#CBD5E1',
        fontSize: 12,
        borderRadius: 8,
      }}
    >
      불러오는 중…
    </div>
  )
}

// ─── 인라인 SVG 날씨 아이콘 ──────────────────────
// lucide-react 와 유사한 스타일의 라인 아이콘.
function getWeatherColor(condition: string): string {
  switch (condition) {
    case 'sunny': return '#FBBF24'
    case 'partly_cloudy': return '#FCD34D'
    case 'cloudy': return '#9CA3AF'
    case 'rain': return '#60A5FA'
    case 'snow': return '#E0F2FE'
    case 'shower': return '#38BDF8'
    default: return '#D1D5DB'
  }
}

function WeatherSvgIcon({
  condition,
  size = 48,
  color,
  strokeWidth = 1.6,
}: {
  condition: string
  size?: number
  color?: string
  strokeWidth?: number
}) {
  const c = color || getWeatherColor(condition)
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: c,
    strokeWidth,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  }

  switch (condition) {
    case 'sunny':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
        </svg>
      )
    case 'partly_cloudy':
      return (
        <svg {...common}>
          <path d="M12 2v2M5.22 5.22l1.42 1.42M2 12h2M20 12h2M17.36 6.64l1.42-1.42" />
          <circle cx="10" cy="10" r="3" />
          <path d="M17 18h-7a4 4 0 1 1 .5-7.97" />
        </svg>
      )
    case 'cloudy':
      return (
        <svg {...common}>
          <path d="M17.5 19a4.5 4.5 0 1 0-2.95-7.89A6 6 0 1 0 6 19h11.5z" />
        </svg>
      )
    case 'rain':
      return (
        <svg {...common}>
          <path d="M17.5 15a4.5 4.5 0 1 0-2.95-7.89A6 6 0 1 0 6 15h11.5z" />
          <path d="M8 18v3M12 19v3M16 18v3" />
        </svg>
      )
    case 'shower':
      return (
        <svg {...common}>
          <path d="M17.5 13a4.5 4.5 0 1 0-2.95-7.89A6 6 0 1 0 6 13h11.5z" />
          <path d="M8 15l-1 4M12 15l-1 4M16 15l-1 4" />
        </svg>
      )
    case 'snow':
      return (
        <svg {...common}>
          <path d="M17.5 15a4.5 4.5 0 1 0-2.95-7.89A6 6 0 1 0 6 15h11.5z" />
          <path d="M8 18h.01M12 19h.01M16 18h.01M8 22h.01M12 23h.01M16 22h.01" />
        </svg>
      )
    default:
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="10" />
          <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01" />
        </svg>
      )
  }
}

// ─── 대기질 등급 색상 ────────────────────────────
function gradeColor(grade: number | null): string {
  switch (grade) {
    case 1: return '#22C55E'
    case 2: return '#3B82F6'
    case 3: return '#F97316'
    case 4: return '#DC2626'
    default: return '#6B7280'
  }
}

// ─── 공통 Props ──────────────────────────────────
interface RenderProps {
  widget: WidgetKey
  config: WidgetConfig
  width: number
  height: number
  style?: React.CSSProperties
}

// ─── 1. weather.current — 종합 카드 ──────────────
function WeatherCurrentCard({ config, style }: RenderProps) {
  const locationId = config.locationId || null
  const textColor = config.textColor || '#FFFFFF'
  const fontFamily = config.fontFamily || 'Noto Sans KR, sans-serif'
  const bgColor = config.bgColor || 'rgba(15, 23, 42, 0.55)'
  const showIcon = config.showIcon !== false
  const showLocation = config.showLocation !== false
  const showMinMax = config.showMinMax !== false

  const { data, loading, error } = usePolledData<WeatherCurrentResponse>(
    locationId,
    () => weatherApi.current(locationId!),
    5 * 60 * 1000
  )

  if (!locationId) return <NeedsLocation style={style} />
  if (loading && !data) return <Loading style={style} />
  if (error || !data) return <ErrorBox style={style} message="현재 날씨 로드 실패" />

  return (
    <div
      style={{
        ...style,
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        padding: 16,
        borderRadius: 12,
        background: bgColor,
        color: textColor,
        fontFamily,
      }}
    >
      {showIcon && (
        <WeatherSvgIcon condition={data.current.condition} size={72} strokeWidth={1.5} />
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        {showLocation && (
          <div style={{ fontSize: 12, opacity: 0.8 }}>{data.location.displayName}</div>
        )}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span style={{ fontSize: 48, fontWeight: 'bold', lineHeight: 1 }}>
            {data.current.temperature != null ? Math.round(data.current.temperature) : '--'}°
          </span>
          <span style={{ fontSize: 14, opacity: 0.9 }}>{data.current.conditionLabel}</span>
        </div>
        {showMinMax && (
          <div style={{ fontSize: 12, opacity: 0.8, marginTop: 4 }}>
            최고 {data.today.max != null ? Math.round(data.today.max) : '--'}° · 최저{' '}
            {data.today.min != null ? Math.round(data.today.min) : '--'}°
          </div>
        )}
      </div>
    </div>
  )
}

// ─── 2. weather.current.icon ─────────────────────
function WeatherCurrentIcon({ config, width, height, style }: RenderProps) {
  const locationId = config.locationId || null
  const { data, loading, error } = usePolledData<WeatherCurrentResponse>(
    locationId,
    () => weatherApi.current(locationId!),
    5 * 60 * 1000
  )

  if (!locationId) return <NeedsLocation style={style} />
  if (loading && !data) return <Loading style={style} />
  if (error || !data) return <ErrorBox style={style} message="날씨 로드 실패" />

  const iconSize = Math.floor(Math.min(width, height) * 0.85)
  return (
    <div
      style={{
        ...style,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <WeatherSvgIcon
        condition={data.current.condition}
        size={iconSize}
        color={(config.textColor as string) || undefined}
        strokeWidth={1.4}
      />
    </div>
  )
}

// ─── 3. weather.current.temp ─────────────────────
function WeatherCurrentTemp({ config, width, height, style }: RenderProps) {
  const locationId = config.locationId || null
  const textColor = config.textColor || '#FFFFFF'
  const fontFamily = config.fontFamily || 'Noto Sans KR, sans-serif'
  const fontSize = config.fontSize

  const { data, loading, error } = usePolledData<WeatherCurrentResponse>(
    locationId,
    () => weatherApi.current(locationId!),
    5 * 60 * 1000
  )

  if (!locationId) return <NeedsLocation style={style} />
  if (loading && !data) return <Loading style={style} />
  if (error || !data) return <ErrorBox style={style} message="온도 로드 실패" />

  const autoSize = fontSize || Math.floor(Math.min(width, height) * 0.65)
  return (
    <div
      style={{
        ...style,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 'bold',
        color: textColor,
        fontFamily,
        fontSize: autoSize,
        lineHeight: 1,
      }}
    >
      {data.current.temperature != null ? Math.round(data.current.temperature) : '--'}°
    </div>
  )
}

// ─── 4. weather.today.minmax ─────────────────────
function WeatherTodayMinMax({ config, style }: RenderProps) {
  const locationId = config.locationId || null
  const textColor = config.textColor || '#FFFFFF'
  const fontFamily = config.fontFamily || 'Noto Sans KR, sans-serif'
  const fontSize = config.fontSize || 28

  const { data, loading, error } = usePolledData<WeatherCurrentResponse>(
    locationId,
    () => weatherApi.current(locationId!),
    5 * 60 * 1000
  )

  if (!locationId) return <NeedsLocation style={style} />
  if (loading && !data) return <Loading style={style} />
  if (error || !data) return <ErrorBox style={style} message="로드 실패" />

  return (
    <div
      style={{
        ...style,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        color: textColor,
        fontFamily,
        fontSize,
      }}
    >
      <span style={{ color: '#FCA5A5' }}>
        ▲ {data.today.max != null ? Math.round(data.today.max) : '--'}°
      </span>
      <span style={{ opacity: 0.6 }}>|</span>
      <span style={{ color: '#93C5FD' }}>
        ▼ {data.today.min != null ? Math.round(data.today.min) : '--'}°
      </span>
    </div>
  )
}

// ─── 5. weather.location ─────────────────────────
function WeatherLocationLabel({ config, style }: RenderProps) {
  const locationId = config.locationId || null
  const textColor = config.textColor || '#FFFFFF'
  const fontFamily = config.fontFamily || 'Noto Sans KR, sans-serif'
  const fontSize = config.fontSize || 24

  const { data, loading, error } = usePolledData<{ location: WeatherLocationLite }>(
    locationId,
    () => weatherApi.getLocation(locationId!),
    60 * 60 * 1000
  )

  if (!locationId) return <NeedsLocation style={style} />
  if (loading && !data) return <Loading style={style} />
  if (error || !data) return <ErrorBox style={style} message="위치 로드 실패" />

  return (
    <div
      style={{
        ...style,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: textColor,
        fontFamily,
        fontSize,
      }}
    >
      📍 {data.location.displayName}
    </div>
  )
}

// ─── 6. weather.weekly ───────────────────────────
function WeatherWeekly({ config, style }: RenderProps) {
  const locationId = config.locationId || null
  const textColor = config.textColor || '#FFFFFF'
  const fontFamily = config.fontFamily || 'Noto Sans KR, sans-serif'
  const bgColor = config.bgColor || 'rgba(15, 23, 42, 0.55)'
  const days = config.days || 7

  const { data, loading, error } = usePolledData<WeatherWeeklyResponse>(
    locationId ? `${locationId}:${days}` : null,
    () => weatherApi.weekly(locationId!, days),
    30 * 60 * 1000
  )

  if (!locationId) return <NeedsLocation style={style} />
  if (loading && !data) return <Loading style={style} />
  if (error || !data) return <ErrorBox style={style} message="주간 예보 로드 실패" />

  return (
    <div
      style={{
        ...style,
        display: 'flex',
        alignItems: 'stretch',
        padding: 12,
        borderRadius: 12,
        background: bgColor,
        color: textColor,
        fontFamily,
      }}
    >
      {data.days.slice(0, days).map((day) => (
        <div
          key={day.date}
          style={{
            flex: 1,
            minWidth: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 4,
            padding: '0 4px',
          }}
        >
          <div style={{ fontSize: 12, opacity: 0.8 }}>{day.dow}</div>
          <WeatherSvgIcon condition={day.condition} size={28} strokeWidth={1.6} />
          <div style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
            <span style={{ color: '#FCA5A5' }}>
              {day.max != null ? Math.round(day.max) : '--'}°
            </span>
            <span style={{ opacity: 0.6, margin: '0 2px' }}>/</span>
            <span style={{ color: '#93C5FD' }}>
              {day.min != null ? Math.round(day.min) : '--'}°
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── 7. air.pm.value ─────────────────────────────
function AirPmValue({ config, width, height, style }: RenderProps) {
  const locationId = config.locationId || null
  const metric = (config.metric as 'pm10' | 'pm25') || 'pm25'
  const textColor = config.textColor || '#FFFFFF'
  const fontFamily = config.fontFamily || 'Noto Sans KR, sans-serif'
  const fontSize = config.fontSize

  const { data, loading, error } = usePolledData<AirResponse>(
    locationId,
    () => weatherApi.air(locationId!),
    10 * 60 * 1000
  )

  if (!locationId) return <NeedsLocation style={style} />
  if (loading && !data) return <Loading style={style} />
  if (error || !data) return <ErrorBox style={style} message="대기질 로드 실패" />

  const pm = metric === 'pm10' ? data.pm10 : data.pm25
  const autoSize = fontSize || Math.floor(Math.min(width, height) * 0.5)
  return (
    <div
      style={{
        ...style,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        color: textColor,
        fontFamily,
      }}
    >
      <div style={{ fontSize: 12, opacity: 0.8, textTransform: 'uppercase' }}>
        {metric === 'pm10' ? 'PM10' : 'PM2.5'}
      </div>
      <div style={{ fontSize: autoSize, fontWeight: 'bold', lineHeight: 1 }}>
        {pm.value ?? '--'}
      </div>
      <div style={{ fontSize: 12, opacity: 0.7 }}>㎍/㎥</div>
    </div>
  )
}

// ─── 8. air.pm.grade ─────────────────────────────
function AirPmGrade({ config, style }: RenderProps) {
  const locationId = config.locationId || null
  const metric = (config.metric as 'pm10' | 'pm25') || 'pm25'
  const fontFamily = config.fontFamily || 'Noto Sans KR, sans-serif'
  const fontSize = config.fontSize || 24

  const { data, loading, error } = usePolledData<AirResponse>(
    locationId,
    () => weatherApi.air(locationId!),
    10 * 60 * 1000
  )

  if (!locationId) return <NeedsLocation style={style} />
  if (loading && !data) return <Loading style={style} />
  if (error || !data) return <ErrorBox style={style} message="대기질 로드 실패" />

  const pm = metric === 'pm10' ? data.pm10 : data.pm25
  return (
    <div
      style={{
        ...style,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 12,
        background: gradeColor(pm.grade),
        color: '#FFFFFF',
        fontWeight: 'bold',
        fontFamily,
        fontSize,
      }}
    >
      {metric === 'pm10' ? 'PM10' : 'PM2.5'} · {pm.gradeLabel || '정보없음'}
    </div>
  )
}

// ─── 9. air.pm.card ──────────────────────────────
function AirPmCard({ config, style }: RenderProps) {
  const locationId = config.locationId || null
  const metric = (config.metric as 'pm10' | 'pm25') || 'pm25'
  const textColor = config.textColor || '#FFFFFF'
  const fontFamily = config.fontFamily || 'Noto Sans KR, sans-serif'
  const bgColor = config.bgColor || 'rgba(15, 23, 42, 0.55)'

  const { data, loading, error } = usePolledData<AirResponse>(
    locationId,
    () => weatherApi.air(locationId!),
    10 * 60 * 1000
  )

  if (!locationId) return <NeedsLocation style={style} />
  if (loading && !data) return <Loading style={style} />
  if (error || !data) return <ErrorBox style={style} message="대기질 로드 실패" />

  const pm = metric === 'pm10' ? data.pm10 : data.pm25
  return (
    <div
      style={{
        ...style,
        padding: 16,
        borderRadius: 12,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        background: bgColor,
        color: textColor,
        fontFamily,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 14, opacity: 0.85 }}>{data.location.displayName}</span>
        <span
          style={{
            fontSize: 12,
            padding: '2px 8px',
            borderRadius: 999,
            fontWeight: 600,
            background: gradeColor(pm.grade),
            color: '#FFFFFF',
          }}
        >
          {pm.gradeLabel || '정보없음'}
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span style={{ fontSize: 12, opacity: 0.7, textTransform: 'uppercase' }}>
          {metric === 'pm10' ? 'PM10' : 'PM2.5'}
        </span>
        <span style={{ fontSize: 36, fontWeight: 'bold', lineHeight: 1 }}>
          {pm.value ?? '--'}
        </span>
        <span style={{ fontSize: 12, opacity: 0.7 }}>㎍/㎥</span>
      </div>
      {data.dataTime && (
        <div style={{ fontSize: 12, opacity: 0.6, textAlign: 'right' }}>{data.dataTime} 기준</div>
      )}
    </div>
  )
}

// ─── Dispatcher ──────────────────────────────────
export default function WeatherWidgetsPlayer(props: RenderProps) {
  switch (props.widget) {
    case 'weather.current':       return <WeatherCurrentCard {...props} />
    case 'weather.current.icon':  return <WeatherCurrentIcon {...props} />
    case 'weather.current.temp':  return <WeatherCurrentTemp {...props} />
    case 'weather.today.minmax':  return <WeatherTodayMinMax {...props} />
    case 'weather.location':      return <WeatherLocationLabel {...props} />
    case 'weather.weekly':        return <WeatherWeekly {...props} />
    case 'air.pm.value':          return <AirPmValue {...props} />
    case 'air.pm.grade':          return <AirPmGrade {...props} />
    case 'air.pm.card':           return <AirPmCard {...props} />
    default:
      return <ErrorBox style={props.style} message={`미지원 위젯: ${String(props.widget)}`} />
  }
}
