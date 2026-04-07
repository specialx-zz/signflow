import apiClient from './client'

export interface TagKeyValues {
  key: string
  values: string[]
}

export interface DeviceTags {
  deviceId: string
  name: string
  tags: Record<string, string>
}

export interface ScheduleCondition {
  id: string
  scheduleId: string
  tagKey: string
  tagValue: string
  playlistId: string
  priority: number
  playlist?: { id: string; name: string }
}

export interface ResolveResult {
  scheduleId: string
  scheduleName: string
  conditionCount: number
  deviceCount: number
  results: {
    device: { id: string; name: string; deviceId: string; tags: Record<string, string> }
    matchedPlaylist: { id: string; name: string } | null
    matchedCondition: { tagKey: string; tagValue: string; priority: number } | null
    fallback: boolean
  }[]
}

export const tagPlaybackApi = {
  // Tags
  getDeviceTags: async (deviceId: string): Promise<DeviceTags> => {
    const res = await apiClient.get(`/tag-playback/tags/${deviceId}`)
    return res.data
  },
  setDeviceTags: async (deviceId: string, tags: Record<string, string>) => {
    const res = await apiClient.put(`/tag-playback/tags/${deviceId}`, { tags })
    return res.data
  },
  updateDeviceTags: async (deviceId: string, tags: Record<string, string | null>) => {
    const res = await apiClient.patch(`/tag-playback/tags/${deviceId}`, { tags })
    return res.data
  },
  listTagKeys: async (): Promise<TagKeyValues[]> => {
    const res = await apiClient.get('/tag-playback/tags/keys')
    return res.data
  },
  // Conditions
  listConditions: async (scheduleId: string): Promise<ScheduleCondition[]> => {
    const res = await apiClient.get(`/tag-playback/conditions/${scheduleId}`)
    return res.data
  },
  addCondition: async (scheduleId: string, data: {
    tagKey: string; tagValue: string; playlistId: string; priority?: number
  }) => {
    const res = await apiClient.post(`/tag-playback/conditions/${scheduleId}`, data)
    return res.data
  },
  updateCondition: async (scheduleId: string, conditionId: string, data: Partial<ScheduleCondition>) => {
    const res = await apiClient.put(`/tag-playback/conditions/${scheduleId}/${conditionId}`, data)
    return res.data
  },
  deleteCondition: async (scheduleId: string, conditionId: string) => {
    const res = await apiClient.delete(`/tag-playback/conditions/${scheduleId}/${conditionId}`)
    return res.data
  },
  // Resolve
  resolve: async (scheduleId: string): Promise<ResolveResult> => {
    const res = await apiClient.post(`/tag-playback/resolve/${scheduleId}`)
    return res.data
  },
  searchDevices: async (tagKey: string, tagValue?: string) => {
    const res = await apiClient.get('/tag-playback/devices', { params: { tagKey, tagValue } })
    return res.data
  }
}
