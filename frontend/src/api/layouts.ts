import apiClient from './client'

export const layoutApi = {
  getAll: async (params?: Record<string, unknown>) => {
    const res = await apiClient.get('/layouts', { params })
    return res.data
  },
  getById: async (id: string) => {
    const res = await apiClient.get(`/layouts/${id}`)
    return res.data
  },
  create: async (data: Record<string, unknown>) => {
    const res = await apiClient.post('/layouts', data)
    return res.data
  },
  update: async (id: string, data: Record<string, unknown>) => {
    const res = await apiClient.put(`/layouts/${id}`, data)
    return res.data
  },
  delete: async (id: string) => {
    const res = await apiClient.delete(`/layouts/${id}`)
    return res.data
  },
  saveZones: async (id: string, zones: unknown[]) => {
    const res = await apiClient.put(`/layouts/${id}/zones`, { zones })
    return res.data
  },
}
