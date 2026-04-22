/**
 * VueSign Phase W1: 날씨 API 클라이언트
 */
import apiClient from './client'

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
  listLocations: async (search?: string): Promise<{ locations: WeatherLocationLite[] }> => {
    const res = await apiClient.get('/weather/locations', { params: { search } })
    return res.data
  },
  getLocation: async (id: string): Promise<{ location: WeatherLocationLite }> => {
    const res = await apiClient.get(`/weather/locations/${id}`)
    return res.data
  },
  current: async (locationId: string): Promise<WeatherCurrentResponse> => {
    const res = await apiClient.get('/weather/current', { params: { locationId } })
    return res.data
  },
  weekly: async (locationId: string, days = 7): Promise<WeatherWeeklyResponse> => {
    const res = await apiClient.get('/weather/weekly', { params: { locationId, days } })
    return res.data
  },
  air: async (locationId: string): Promise<AirResponse> => {
    const res = await apiClient.get('/weather/air', { params: { locationId } })
    return res.data
  },
}
