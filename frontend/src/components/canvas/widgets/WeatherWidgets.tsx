/**
 * VueSign Phase W1: 날씨/대기질 위젯 모음 (에디터용)
 *
 * 9개 위젯:
 *   1. weather.current        종합 카드 (아이콘 + 현재온도 + 오늘 고/저 + 위치)
 *   2. weather.current.icon   아이콘 단독
 *   3. weather.current.temp   현재 온도 숫자
 *   4. weather.today.minmax   오늘 최고/최저
 *   5. weather.location       위치 라벨
 *   6. weather.weekly         주간 예보 카드
 *   7. air.pm.value           PM 수치
 *   8. air.pm.grade           PM 등급 뱃지
 *   9. air.pm.card            대기질 종합 카드
 *
 * 모든 위젯은 react-query로 데이터를 가져오며, locationId 미설정 시 안내 문구를 표시한다.
 */
import { useQuery } from '@tanstack/react-query'
import { weatherApi } from '@/api/weather'
import { WidgetKey, WidgetConfig } from '@/api/canvas'
import WeatherIcon, { getWeatherColor } from './WeatherIcon'

interface RenderProps {
  widget: WidgetKey
  config: WidgetConfig
  width: number
  height: number
}

// ─── 공통: 위치 필수 안내 ─────────────────────
function NeedsLocation({ label = '위치 선택 필요' }: { label?: string }) {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-sky-500/10 to-indigo-500/10 border-2 border-dashed border-sky-400/60 text-sky-600 rounded-lg p-2 text-center">
      <div className="text-2xl mb-1">📍</div>
      <div className="text-xs font-semibold">{label}</div>
      <div className="text-[10px] text-sky-500/80 mt-1">오른쪽 패널 → 위치 선택</div>
    </div>
  )
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div className="w-full h-full flex items-center justify-center bg-red-900/40 border border-red-500/40 text-red-200 text-xs rounded-lg p-2 text-center">
      {message}
    </div>
  )
}

function Loading() {
  return (
    <div className="w-full h-full flex items-center justify-center bg-slate-800/40 text-slate-300 text-xs rounded-lg">
      불러오는 중…
    </div>
  )
}

// ─── 1. weather.current — 종합 카드 ───────────
function WeatherCurrentCard({ config }: RenderProps) {
  const { locationId, textColor = '#FFFFFF', fontFamily = 'Noto Sans KR', bgColor, showIcon = true, showLocation = true, showMinMax = true } = config
  const { data, isLoading, error } = useQuery({
    queryKey: ['weather.current', locationId],
    queryFn: () => weatherApi.current(locationId!),
    enabled: !!locationId,
    staleTime: 5 * 60 * 1000,
  })

  if (!locationId) return <NeedsLocation />
  if (isLoading) return <Loading />
  if (error || !data) return <ErrorBox message="현재 날씨 로드 실패" />

  return (
    <div
      className="w-full h-full flex items-center gap-4 p-4 rounded-xl"
      style={{ color: textColor, fontFamily, background: bgColor || 'rgba(15, 23, 42, 0.55)' }}
    >
      {showIcon && (
        <WeatherIcon condition={data.current.condition} size={72} strokeWidth={1.5} />
      )}
      <div className="flex-1 min-w-0">
        {showLocation && (
          <div className="text-xs opacity-80 truncate">{data.location.displayName}</div>
        )}
        <div className="flex items-baseline gap-2">
          <span className="text-5xl font-bold leading-none">
            {data.current.temperature != null ? Math.round(data.current.temperature) : '--'}°
          </span>
          <span className="text-sm opacity-90">{data.current.conditionLabel}</span>
        </div>
        {showMinMax && (
          <div className="text-xs opacity-80 mt-1">
            최고 {data.today.max != null ? Math.round(data.today.max) : '--'}° · 최저 {data.today.min != null ? Math.round(data.today.min) : '--'}°
          </div>
        )}
      </div>
    </div>
  )
}

// ─── 2. weather.current.icon ───────────
function WeatherCurrentIcon({ config, width, height }: RenderProps) {
  const { locationId, textColor } = config
  const { data, isLoading, error } = useQuery({
    queryKey: ['weather.current', locationId],
    queryFn: () => weatherApi.current(locationId!),
    enabled: !!locationId,
    staleTime: 5 * 60 * 1000,
  })

  if (!locationId) return <NeedsLocation />
  if (isLoading) return <Loading />
  if (error || !data) return <ErrorBox message="날씨 로드 실패" />

  const iconSize = Math.floor(Math.min(width, height) * 0.85)
  return (
    <div className="w-full h-full flex items-center justify-center">
      <WeatherIcon
        condition={data.current.condition}
        size={iconSize}
        color={textColor || getWeatherColor(data.current.condition)}
        strokeWidth={1.4}
      />
    </div>
  )
}

// ─── 3. weather.current.temp ───────────
function WeatherCurrentTemp({ config, width, height }: RenderProps) {
  const { locationId, textColor = '#FFFFFF', fontFamily = 'Noto Sans KR', fontSize } = config
  const { data, isLoading, error } = useQuery({
    queryKey: ['weather.current', locationId],
    queryFn: () => weatherApi.current(locationId!),
    enabled: !!locationId,
    staleTime: 5 * 60 * 1000,
  })

  if (!locationId) return <NeedsLocation />
  if (isLoading) return <Loading />
  if (error || !data) return <ErrorBox message="온도 로드 실패" />

  const autoSize = fontSize || Math.floor(Math.min(width, height) * 0.65)
  return (
    <div
      className="w-full h-full flex items-center justify-center font-bold"
      style={{ color: textColor, fontFamily, fontSize: autoSize, lineHeight: 1 }}
    >
      {data.current.temperature != null ? Math.round(data.current.temperature) : '--'}°
    </div>
  )
}

// ─── 4. weather.today.minmax ───────────
function WeatherTodayMinMax({ config }: RenderProps) {
  const { locationId, textColor = '#FFFFFF', fontFamily = 'Noto Sans KR', fontSize = 28 } = config
  const { data, isLoading, error } = useQuery({
    queryKey: ['weather.current', locationId],
    queryFn: () => weatherApi.current(locationId!),
    enabled: !!locationId,
    staleTime: 5 * 60 * 1000,
  })

  if (!locationId) return <NeedsLocation />
  if (isLoading) return <Loading />
  if (error || !data) return <ErrorBox message="로드 실패" />

  return (
    <div
      className="w-full h-full flex items-center justify-center gap-3"
      style={{ color: textColor, fontFamily, fontSize }}
    >
      <span className="text-red-300">▲ {data.today.max != null ? Math.round(data.today.max) : '--'}°</span>
      <span className="opacity-60">|</span>
      <span className="text-blue-300">▼ {data.today.min != null ? Math.round(data.today.min) : '--'}°</span>
    </div>
  )
}

// ─── 5. weather.location ───────────
function WeatherLocationLabel({ config }: RenderProps) {
  const { locationId, textColor = '#FFFFFF', fontFamily = 'Noto Sans KR', fontSize = 24 } = config
  const { data, isLoading, error } = useQuery({
    queryKey: ['weather.location', locationId],
    queryFn: () => weatherApi.getLocation(locationId!),
    enabled: !!locationId,
    staleTime: 60 * 60 * 1000,
  })

  if (!locationId) return <NeedsLocation />
  if (isLoading) return <Loading />
  if (error || !data) return <ErrorBox message="위치 로드 실패" />

  return (
    <div
      className="w-full h-full flex items-center justify-center"
      style={{ color: textColor, fontFamily, fontSize }}
    >
      📍 {data.location.displayName}
    </div>
  )
}

// ─── 6. weather.weekly ───────────
function WeatherWeekly({ config }: RenderProps) {
  const { locationId, textColor = '#FFFFFF', fontFamily = 'Noto Sans KR', bgColor, days = 7 } = config
  const { data, isLoading, error } = useQuery({
    queryKey: ['weather.weekly', locationId, days],
    queryFn: () => weatherApi.weekly(locationId!, days),
    enabled: !!locationId,
    staleTime: 30 * 60 * 1000,
  })

  if (!locationId) return <NeedsLocation />
  if (isLoading) return <Loading />
  if (error || !data) return <ErrorBox message="주간 예보 로드 실패" />

  return (
    <div
      className="w-full h-full flex items-stretch p-3 rounded-xl"
      style={{ color: textColor, fontFamily, background: bgColor || 'rgba(15, 23, 42, 0.55)' }}
    >
      {data.days.slice(0, days).map((day) => (
        <div key={day.date} className="flex-1 min-w-0 flex flex-col items-center justify-center gap-1 px-1">
          <div className="text-xs opacity-80 truncate">{day.dow}</div>
          <WeatherIcon condition={day.condition} size={28} strokeWidth={1.6} />
          <div className="text-xs whitespace-nowrap">
            <span className="text-red-300">{day.max != null ? Math.round(day.max) : '--'}°</span>
            <span className="opacity-60 mx-0.5">/</span>
            <span className="text-blue-300">{day.min != null ? Math.round(day.min) : '--'}°</span>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── 대기질 등급 색상 매핑 ───────────
function gradeColor(grade: number | null): string {
  switch (grade) {
    case 1: return '#22C55E' // 좋음 green-500
    case 2: return '#3B82F6' // 보통 blue-500
    case 3: return '#F97316' // 나쁨 orange-500
    case 4: return '#DC2626' // 매우나쁨 red-600
    default: return '#6B7280' // gray-500
  }
}

// ─── 7. air.pm.value ───────────
function AirPmValue({ config, width, height }: RenderProps) {
  const { locationId, metric = 'pm25', textColor = '#FFFFFF', fontFamily = 'Noto Sans KR', fontSize } = config
  const { data, isLoading, error } = useQuery({
    queryKey: ['air', locationId],
    queryFn: () => weatherApi.air(locationId!),
    enabled: !!locationId,
    staleTime: 10 * 60 * 1000,
  })

  if (!locationId) return <NeedsLocation />
  if (isLoading) return <Loading />
  if (error || !data) return <ErrorBox message="대기질 로드 실패" />

  const pm = metric === 'pm10' ? data.pm10 : data.pm25
  const autoSize = fontSize || Math.floor(Math.min(width, height) * 0.5)
  return (
    <div className="w-full h-full flex flex-col items-center justify-center" style={{ color: textColor, fontFamily }}>
      <div className="text-xs opacity-80 uppercase">{metric === 'pm10' ? 'PM10' : 'PM2.5'}</div>
      <div className="font-bold leading-none" style={{ fontSize: autoSize }}>
        {pm.value ?? '--'}
      </div>
      <div className="text-xs opacity-70">㎍/㎥</div>
    </div>
  )
}

// ─── 8. air.pm.grade ───────────
function AirPmGrade({ config }: RenderProps) {
  const { locationId, metric = 'pm25', fontFamily = 'Noto Sans KR', fontSize = 24 } = config
  const { data, isLoading, error } = useQuery({
    queryKey: ['air', locationId],
    queryFn: () => weatherApi.air(locationId!),
    enabled: !!locationId,
    staleTime: 10 * 60 * 1000,
  })

  if (!locationId) return <NeedsLocation />
  if (isLoading) return <Loading />
  if (error || !data) return <ErrorBox message="대기질 로드 실패" />

  const pm = metric === 'pm10' ? data.pm10 : data.pm25
  const bg = gradeColor(pm.grade)
  return (
    <div
      className="w-full h-full flex items-center justify-center rounded-xl font-bold"
      style={{ background: bg, color: '#FFFFFF', fontFamily, fontSize }}
    >
      {metric === 'pm10' ? 'PM10' : 'PM2.5'} · {pm.gradeLabel || '정보없음'}
    </div>
  )
}

// ─── 9. air.pm.card ───────────
function AirPmCard({ config }: RenderProps) {
  const { locationId, metric = 'pm25', textColor = '#FFFFFF', fontFamily = 'Noto Sans KR', bgColor } = config
  const { data, isLoading, error } = useQuery({
    queryKey: ['air', locationId],
    queryFn: () => weatherApi.air(locationId!),
    enabled: !!locationId,
    staleTime: 10 * 60 * 1000,
  })

  if (!locationId) return <NeedsLocation />
  if (isLoading) return <Loading />
  if (error || !data) return <ErrorBox message="대기질 로드 실패" />

  const pm = metric === 'pm10' ? data.pm10 : data.pm25
  return (
    <div
      className="w-full h-full p-4 rounded-xl flex flex-col justify-between"
      style={{ color: textColor, fontFamily, background: bgColor || 'rgba(15, 23, 42, 0.55)' }}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm opacity-85 truncate">{data.location.displayName}</span>
        <span
          className="text-xs px-2 py-0.5 rounded-full font-semibold"
          style={{ background: gradeColor(pm.grade), color: '#FFFFFF' }}
        >
          {pm.gradeLabel || '정보없음'}
        </span>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-xs opacity-70 uppercase">{metric === 'pm10' ? 'PM10' : 'PM2.5'}</span>
        <span className="text-4xl font-bold leading-none">{pm.value ?? '--'}</span>
        <span className="text-xs opacity-70">㎍/㎥</span>
      </div>
      {data.dataTime && (
        <div className="text-xs opacity-60 text-right">{data.dataTime} 기준</div>
      )}
    </div>
  )
}

// ─── Dispatch 함수 ───────────
export default function WeatherWidgets(props: RenderProps) {
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
      return <ErrorBox message={`알 수 없는 위젯: ${props.widget}`} />
  }
}

export const WEATHER_WIDGET_LABELS: Record<WidgetKey, string> = {
  'weather.current': '현재 날씨 (카드)',
  'weather.current.icon': '날씨 아이콘',
  'weather.current.temp': '현재 온도',
  'weather.today.minmax': '오늘 최고/최저',
  'weather.location': '위치 라벨',
  'weather.weekly': '주간 예보',
  'air.pm.value': '미세먼지 수치',
  'air.pm.grade': '미세먼지 등급',
  'air.pm.card': '대기질 카드',
}
