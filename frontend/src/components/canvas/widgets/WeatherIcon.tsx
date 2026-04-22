/**
 * VueSign Phase W1: 날씨 아이콘 매핑
 *
 * 백엔드에서 내려오는 condition key (sunny / partly_cloudy / cloudy / rain / snow / shower / unknown)
 * 를 lucide-react 아이콘으로 매핑한다.
 */
import {
  Sun,
  Cloud,
  CloudSun,
  CloudRain,
  CloudSnow,
  CloudDrizzle,
  HelpCircle,
  type LucideIcon,
} from 'lucide-react'

export function getWeatherIcon(condition: string): LucideIcon {
  switch (condition) {
    case 'sunny':
      return Sun
    case 'partly_cloudy':
      return CloudSun
    case 'cloudy':
      return Cloud
    case 'rain':
      return CloudRain
    case 'snow':
      return CloudSnow
    case 'shower':
      return CloudDrizzle
    default:
      return HelpCircle
  }
}

export function getWeatherColor(condition: string): string {
  switch (condition) {
    case 'sunny':
      return '#FBBF24' // amber-400
    case 'partly_cloudy':
      return '#FCD34D' // amber-300
    case 'cloudy':
      return '#9CA3AF' // gray-400
    case 'rain':
      return '#60A5FA' // blue-400
    case 'snow':
      return '#E0F2FE' // sky-100
    case 'shower':
      return '#38BDF8' // sky-400
    default:
      return '#D1D5DB' // gray-300
  }
}

interface WeatherIconProps {
  condition: string
  size?: number | string
  color?: string
  className?: string
  strokeWidth?: number
}

export default function WeatherIcon({
  condition,
  size = 48,
  color,
  className,
  strokeWidth = 1.8,
}: WeatherIconProps) {
  const Icon = getWeatherIcon(condition)
  const resolvedColor = color || getWeatherColor(condition)
  return <Icon size={size} color={resolvedColor} className={className} strokeWidth={strokeWidth} />
}
