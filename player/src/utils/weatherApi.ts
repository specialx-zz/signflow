/**
 * VueSign Phase W1: Player 측 날씨 API 클라이언트
 *
 * /api/weather/* 엔드포인트는 인증 불필요.
 * 프론트엔드와 동일한 응답 구조를 공유한다.
 */
import { apiClient } from './api'

export interface WeatherLocationLite {
  id: string
  sido: string
  sigungu: string
  displayName: string
  searchKey: string
  airStationName?: string | null
}

export interface WeatherCurrentResponse {
  location: {
    id: string
    sido: string
    sigungu: string
    displayName: string
  }
  fetchedAt: string
  current: {
    temperature: number | null
    condition: string
    conditionLabel: string
  }
  today: {
    max: number | null
    min: number | null
  }
  stale: boolean
}

export interface WeatherDayItem {
  date: string
  dow: string
  max: number | null
  min: number | null
  condition: string
  conditionLabel: string
}

export interface WeatherWeeklyResponse {
  location: WeatherCurrentResponse['location']
  fetchedAt: string
  days: WeatherDayItem[]
  stale: boolean
}

export interface PmMetric {
  value: number | null
  grade: number | null
  gradeLabel: string | null
}

export interface AirResponse {
  location: WeatherCurrentResponse['location'] & { stationName?: string }
  fetchedAt: string
  dataTime: string | null
  pm10: PmMetric
  pm25: PmMetric
  stale: boolean
}

export const weatherApi = {
  async getLocation(id: string): Promise<{ location: WeatherLocationLite }> {
    const res = await apiClient.get(`/api/weather/locations/${id}`)
    return res.data
  },
  async current(locationId: string): Promise<WeatherCurrentResponse> {
    const res = await apiClient.get('/api/weather/current', { params: { locationId } })
    return res.data
  },
  async weekly(locationId: string, days = 7): Promise<WeatherWeeklyResponse> {
    const res = await apiClient.get('/api/weather/weekly', { params: { locationId, days } })
    return res.data
  },
  async air(locationId: string): Promise<AirResponse> {
    const res = await apiClient.get('/api/weather/air', { params: { locationId } })
    return res.data
  },
}
