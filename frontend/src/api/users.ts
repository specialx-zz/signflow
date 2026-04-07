import apiClient from './client'

export const userApi = {
  getAll: async (params?: Record<string, unknown>) => {
    const res = await apiClient.get('/users', { params })
    return res.data
  },
  getById: async (id: string) => {
    const res = await apiClient.get(`/users/${id}`)
    return res.data
  },
  create: async (data: Record<string, unknown>) => {
    const res = await apiClient.post('/users', data)
    return res.data
  },
  update: async (id: string, data: Record<string, unknown>) => {
    const res = await apiClient.put(`/users/${id}`, data)
    return res.data
  },
  delete: async (id: string) => {
    const res = await apiClient.delete(`/users/${id}`)
    return res.data
  }
}
