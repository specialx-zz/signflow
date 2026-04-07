/**
 * 날씨 위젯 — OpenWeatherMap API 기반
 */
import { useState, useEffect } from 'react'
import { Cloud, Sun, CloudRain, CloudSnow, CloudLightning, CloudDrizzle, Wind } from 'lucide-react'

interface Props {
  config?: {
    city?: string
    apiKey?: string
    units?: 'metric' | 'imperial'
    color?: string
    fontSize?: number
    showIcon?: boolean
    showHumidity?: boolean
  }
  width?: number
  height?: number
}

interface WeatherData {
  temp: number
  description: string
  icon: string
  humidity: number
  city: string
}

const weatherIcons: Record<string, React.ElementType> = {
  '01': Sun, '02': Cloud, '03': Cloud, '04': Cloud,
  '09': CloudDrizzle, '10': CloudRain, '11': CloudLightning,
  '13': CloudSnow, '50': Wind,
}

export default function WeatherWidget({ config = {}, width = 250, height = 80 }: Props) {
  const [weather, setWeather] = useState<WeatherData | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    const fetchWeather = async () => {
      const city = config.city || 'Seoul'
      const apiKey = config.apiKey || ''
      if (!apiKey) {
        // 데모 데이터
        setWeather({ temp: 18, description: '맑음', icon: '01d', humidity: 45, city })
        return
      }
      try {
        const res = await fetch(
          `https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${apiKey}&units=${config.units || 'metric'}&lang=kr`
        )
        const data = await res.json()
        setWeather({
          temp: Math.round(data.main.temp),
          description: data.weather[0].description,
          icon: data.weather[0].icon,
          humidity: data.main.humidity,
          city: data.name
        })
      } catch {
        setError(true)
      }
    }

    fetchWeather()
    const timer = setInterval(fetchWeather, 10 * 60 * 1000) // 10분마다 갱신
    return () => clearInterval(timer)
  }, [config.city, config.apiKey])

  const IconComp = weather ? (weatherIcons[weather.icon?.substring(0, 2)] || Cloud) : Cloud

  return (
    <div
      style={{
        width, height,
        display: 'flex', alignItems: 'center', gap: 12,
        color: config.color || '#FFFFFF',
        fontFamily: 'Noto Sans KR',
      }}
    >
      {config.showIcon !== false && (
        <IconComp style={{ width: (config.fontSize || 24) * 1.5, height: (config.fontSize || 24) * 1.5, opacity: 0.9 }} />
      )}
      <div>
        <div style={{ fontSize: config.fontSize || 24, fontWeight: 'bold', lineHeight: 1 }}>
          {weather ? `${weather.temp}°` : '--°'}
        </div>
        <div style={{ fontSize: (config.fontSize || 24) * 0.5, opacity: 0.7 }}>
          {weather?.description || '로딩 중'}
          {config.showHumidity && weather && ` · ${weather.humidity}%`}
        </div>
      </div>
    </div>
  )
}

export const weatherWidgetDefaults = {
  city: 'Seoul',
  apiKey: '',
  units: 'metric' as const,
  color: '#FFFFFF',
  fontSize: 32,
  showIcon: true,
  showHumidity: true
}
