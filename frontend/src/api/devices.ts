import apiClient from './client'

export const deviceApi = {
  getAll: async (params?: Record<string, unknown>) => {
    const filteredParams = params ? Object.fromEntries(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== '')
    ) : undefined
    const res = await apiClient.get('/devices', { params: filteredParams })
    return res.data
  },
  getById: async (id: string) => {
    const res = await apiClient.get(`/devices/${id}`)
    return res.data
  },
  create: async (data: Record<string, unknown>) => {
    const res = await apiClient.post('/devices', data)
    return res.data
  },
  update: async (id: string, data: Record<string, unknown>) => {
    const res = await apiClient.put(`/devices/${id}`, data)
    return res.data
  },
  delete: async (id: string) => {
    const res = await apiClient.delete(`/devices/${id}`)
    return res.data
  },
  getStatus: async (id: string) => {
    const res = await apiClient.get(`/devices/${id}/status`)
    return res.data
  },
  control: async (id: string, command: string, params?: Record<string, unknown>) => {
    const res = await apiClient.post(`/devices/${id}/control`, { command, params })
    return res.data
  },
  getGroups: async () => {
    const res = await apiClient.get('/devices/groups')
    return res.data
  },
  createGroup: async (data: Record<string, unknown>) => {
    const res = await apiClient.post('/devices/groups', data)
    return res.data
  },

  // ─── Registration Token Management ────────────────────
  getTokens: async () => {
    const res = await apiClient.get('/devices/tokens')
    return res.data
  },
  createToken: async (data: { name?: string; storeId?: string; expiresInHours?: number }) => {
    const res = await apiClient.post('/devices/tokens', data)
    return res.data
  },
  deleteToken: async (code: string) => {
    const res = await apiClient.delete(`/devices/tokens/${code}`)
    return res.data
  },
}
