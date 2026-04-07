import apiClient from './client'

export const statsApi = {
  getDashboard: async () => {
    const res = await apiClient.get('/stats/dashboard')
    return res.data
  },
  getContent: async (params?: Record<string, unknown>) => {
    const res = await apiClient.get('/stats/content', { params })
    return res.data
  },
  getDevices: async () => {
    const res = await apiClient.get('/stats/devices')
    return res.data
  }
}
