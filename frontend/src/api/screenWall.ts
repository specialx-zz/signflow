import apiClient from './client'

export interface ScreenWall {
  id: string
  tenantId: string
  name: string
  rows: number
  cols: number
  bezelH: number
  bezelV: number
  screenW?: number
  screenH?: number
  isActive: boolean
  createdAt: string
  devices?: ScreenWallDeviceItem[]
  totalResolution?: { width: number; height: number; label: string }
}

export interface ScreenWallDeviceItem {
  id: string
  wallId: string
  deviceId: string
  row: number
  col: number
  device: { id: string; name: string; deviceId: string; status: string; resolution?: string }
}

export interface SyncGroup {
  id: string
  name: string
  masterDeviceId?: string
  syncMode: string
  driftThreshold: number
  isActive: boolean
  devices?: SyncGroupDeviceItem[]
  createdAt: string
}

export interface SyncGroupDeviceItem {
  id: string
  groupId: string
  deviceId: string
  isMaster: boolean
  device: { id: string; name: string; deviceId: string; status: string }
}

export const screenWallApi = {
  // Screen Walls
  listWalls: async (): Promise<ScreenWall[]> => {
    const res = await apiClient.get('/screen-wall/walls')
    return res.data
  },
  getWall: async (id: string): Promise<ScreenWall> => {
    const res = await apiClient.get(`/screen-wall/walls/${id}`)
    return res.data
  },
  createWall: async (data: Partial<ScreenWall>) => {
    const res = await apiClient.post('/screen-wall/walls', data)
    return res.data
  },
  updateWall: async (id: string, data: Partial<ScreenWall>) => {
    const res = await apiClient.put(`/screen-wall/walls/${id}`, data)
    return res.data
  },
  deleteWall: async (id: string) => {
    const res = await apiClient.delete(`/screen-wall/walls/${id}`)
    return res.data
  },
  assignDevice: async (wallId: string, data: { deviceId: string; row: number; col: number }) => {
    const res = await apiClient.post(`/screen-wall/walls/${wallId}/devices`, data)
    return res.data
  },
  removeDevice: async (wallId: string, deviceId: string) => {
    const res = await apiClient.delete(`/screen-wall/walls/${wallId}/devices/${deviceId}`)
    return res.data
  },
  setLayout: async (wallId: string, devices: { deviceId: string; row: number; col: number }[]) => {
    const res = await apiClient.put(`/screen-wall/walls/${wallId}/layout`, { devices })
    return res.data
  },
  getDeviceWallInfo: async (deviceId: string) => {
    const res = await apiClient.get(`/screen-wall/device/${deviceId}/wall-info`)
    return res.data
  },
  // Sync Groups
  listSyncGroups: async (): Promise<SyncGroup[]> => {
    const res = await apiClient.get('/screen-wall/sync')
    return res.data
  },
  createSyncGroup: async (data: { name: string; syncMode?: string; deviceIds?: string[]; masterDeviceId?: string }) => {
    const res = await apiClient.post('/screen-wall/sync', data)
    return res.data
  },
  updateSyncGroup: async (id: string, data: Partial<SyncGroup>) => {
    const res = await apiClient.put(`/screen-wall/sync/${id}`, data)
    return res.data
  },
  deleteSyncGroup: async (id: string) => {
    const res = await apiClient.delete(`/screen-wall/sync/${id}`)
    return res.data
  },
  setSyncGroupDevices: async (id: string, deviceIds: string[], masterDeviceId?: string) => {
    const res = await apiClient.put(`/screen-wall/sync/${id}/devices`, { deviceIds, masterDeviceId })
    return res.data
  }
}
