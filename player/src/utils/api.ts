import axios from 'axios'
import type { DeviceConfig, ScheduleEntry, Playlist, DeviceStatus } from '../types'

// 빌드 시 VITE_API_URL 환경변수로 기본 서버 URL 주입 가능
// 예) VITE_API_URL=https://api.vuesign.com npm run build
// 미설정 시 개발용 localhost 사용
let baseURL = (import.meta.env.VITE_API_URL as string) || 'http://localhost:3001'

export function setBaseURL(url: string) {
  baseURL = url.replace(/\/$/, '')
  apiClient.defaults.baseURL = baseURL
}

export const apiClient = axios.create({
  baseURL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
})

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('[API Error]', error.message)
    return Promise.reject(error)
  }
)

export interface RegisterDevicePayload {
  deviceId: string
  deviceName: string
  playerVersion?: string
  userAgent?: string
}

export interface RegisterDeviceResponse {
  deviceId: string
  deviceName: string
  registeredAt: string
  message?: string
}

/**
 * Register this device with the VueSign server.
 */
export async function registerDevice(config: Omit<DeviceConfig, 'registeredAt'>): Promise<RegisterDeviceResponse> {
  const payload: RegisterDevicePayload = {
    deviceId: config.deviceId,
    deviceName: config.deviceName,
    playerVersion: '1.0.0',
    userAgent: navigator.userAgent,
  }
  const response = await apiClient.post<RegisterDeviceResponse>('/api/devices/register', payload)
  return response.data
}

export interface ScheduleResponse {
  schedules: ScheduleEntry[]
  defaultChannel?: import('../types').ChannelData | null
  deviceTags?: Record<string, string> | null
}

/**
 * Fetch schedules assigned to this device.
 * V5.2: Also returns defaultChannel and deviceTags if available.
 * V5.3: Returns full response data instead of mutating store (prevents race condition).
 */
export async function fetchSchedules(deviceId: string): Promise<ScheduleResponse> {
  const response = await apiClient.get(`/api/devices/${deviceId}/schedules`)
  const data = response.data

  // V5.2: New response format { schedules, defaultChannel, deviceTags }
  if (data && typeof data === 'object' && Array.isArray(data.schedules)) {
    return {
      schedules: data.schedules,
      defaultChannel: data.defaultChannel || null,
      deviceTags: data.deviceTags || null,
    }
  }

  // Backward compatible: plain array response
  return {
    schedules: Array.isArray(data) ? data : [],
    defaultChannel: null,
    deviceTags: null,
  }
}

/**
 * V5.2: Fetch screen wall info for this device.
 */
export async function fetchWallInfo(deviceId: string) {
  const response = await apiClient.get(`/api/screen-wall/device/${deviceId}/wall-info`)
  return response.data
}

/**
 * Fetch a single playlist by ID.
 *
 * The deviceId is REQUIRED on unauthenticated player requests — the backend
 * uses it to verify the device and the playlist belong to the same tenant
 * (replaces the old self-validating ?tenantId=... query that allowed IDOR).
 */
export async function fetchPlaylist(playlistId: string, deviceId: string): Promise<Playlist> {
  const response = await apiClient.get<Playlist>(`/api/playlists/${playlistId}`, {
    params: { deviceId }
  })
  return response.data
}

/**
 * Report device status to the server.
 */
export async function reportStatus(deviceId: string, status: Partial<DeviceStatus>): Promise<void> {
  await apiClient.post(`/api/devices/${deviceId}/status`, status)
}

/**
 * Send a screenshot blob to the server.
 */
export async function sendScreenshot(deviceId: string, blob: Blob): Promise<void> {
  const formData = new FormData()
  formData.append('screenshot', blob, `screenshot_${Date.now()}.png`)
  await apiClient.post(`/api/devices/${deviceId}/screenshot`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 30000,
  })
}

/**
 * Fetch the content manifest for pre-download.
 */
export async function fetchContentManifest(deviceId: string) {
  const response = await apiClient.get(`/api/devices/${deviceId}/manifest`)
  return response.data
}

/**
 * Report content deployment status to the server.
 */
export async function reportDeploymentStatus(
  deviceId: string,
  items: { contentId: string; status: string; progress: number; errorMessage?: string; fileSize?: number }[]
) {
  await apiClient.post(`/api/devices/${deviceId}/deployment-status`, { items })
}

/**
 * Ping the server to check connectivity.
 */
export async function pingServer(serverUrl: string): Promise<boolean> {
  try {
    await axios.get(`${serverUrl.replace(/\/$/, '')}/api/health`, { timeout: 5000 })
    return true
  } catch {
    return false
  }
}
