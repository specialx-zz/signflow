import apiClient from './client'

export const scheduleApi = {
  getAll: async (params?: Record<string, unknown>) => {
    const res = await apiClient.get('/schedules', { params })
    return res.data
  },
  getById: async (id: string) => {
    const res = await apiClient.get(`/schedules/${id}`)
    return res.data
  },
  create: async (data: Record<string, unknown>) => {
    const res = await apiClient.post('/schedules', data)
    return res.data
  },
  update: async (id: string, data: Record<string, unknown>) => {
    const res = await apiClient.put(`/schedules/${id}`, data)
    return res.data
  },
  delete: async (id: string) => {
    const res = await apiClient.delete(`/schedules/${id}`)
    return res.data
  },
  deploy: async (id: string, force = false) => {
    const res = await apiClient.post(`/schedules/${id}/deploy${force ? '?force=true' : ''}`)
    return res.data
  }
}
