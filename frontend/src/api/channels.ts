import apiClient from './client'

export interface Channel {
  id: string
  tenantId: string
  name: string
  description?: string
  isDefault: boolean
  isActive: boolean
  createdBy: string
  createdAt: string
  updatedAt: string
  creator?: { id: string; username: string }
  _count?: { contents: number; devices: number }
  contents?: ChannelContentItem[]
  devices?: ChannelDeviceItem[]
}

export interface ChannelContentItem {
  id: string
  channelId: string
  contentId: string
  order: number
  duration?: number
  content: { id: string; name: string; type: string; thumbnail?: string; duration?: number; isCanvas?: boolean }
}

export interface ChannelDeviceItem {
  channelId: string
  deviceId: string
  device: { id: string; name: string; deviceId: string; status: string; location?: string }
}

export interface JourneyMap {
  content: { id: string; name: string; type: string; thumbnail?: string }
  playlists: { id: string; name: string }[]
  channels: { id: string; name: string; isDefault: boolean }[]
  totalDevices: number
  graph: {
    nodes: { id: string; type: string; data: Record<string, unknown> }[]
    edges: { source: string; target: string }[]
  }
}

export const channelApi = {
  list: async (params?: Record<string, unknown>) => {
    const res = await apiClient.get('/channels', { params })
    return res.data
  },
  get: async (id: string): Promise<Channel> => {
    const res = await apiClient.get(`/channels/${id}`)
    return res.data
  },
  create: async (data: { name: string; description?: string; isDefault?: boolean }) => {
    const res = await apiClient.post('/channels', data)
    return res.data
  },
  update: async (id: string, data: Partial<Channel>) => {
    const res = await apiClient.put(`/channels/${id}`, data)
    return res.data
  },
  delete: async (id: string) => {
    const res = await apiClient.delete(`/channels/${id}`)
    return res.data
  },
  // Contents
  addContent: async (channelId: string, data: { contentId: string; duration?: number }) => {
    const res = await apiClient.post(`/channels/${channelId}/contents`, data)
    return res.data
  },
  removeContent: async (channelId: string, contentItemId: string) => {
    const res = await apiClient.delete(`/channels/${channelId}/contents/${contentItemId}`)
    return res.data
  },
  reorderContents: async (channelId: string, items: { id: string; order: number }[]) => {
    const res = await apiClient.put(`/channels/${channelId}/contents/reorder`, { items })
    return res.data
  },
  // Devices
  assignDevices: async (channelId: string, deviceIds: string[]) => {
    const res = await apiClient.put(`/channels/${channelId}/devices`, { deviceIds })
    return res.data
  },
  // Journey map
  getJourney: async (contentId: string): Promise<JourneyMap> => {
    const res = await apiClient.get(`/channels/journey/${contentId}`)
    return res.data
  }
}
