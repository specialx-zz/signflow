import apiClient from './client'

export const contentApi = {
  getAll: async (params?: Record<string, unknown>) => {
    const res = await apiClient.get('/content', { params })
    return res.data
  },
  getById: async (id: string) => {
    const res = await apiClient.get(`/content/${id}`)
    return res.data
  },
  upload: async (formData: FormData) => {
    const res = await apiClient.post('/content/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
    return res.data
  },
  update: async (id: string, data: Record<string, unknown>) => {
    const res = await apiClient.put(`/content/${id}`, data)
    return res.data
  },
  delete: async (id: string) => {
    const res = await apiClient.delete(`/content/${id}`)
    return res.data
  },
  getCategories: async () => {
    const res = await apiClient.get('/content/categories')
    return res.data
  },
  createCategory: async (data: { name: string; parentId?: string }) => {
    const res = await apiClient.post('/content/categories', data)
    return res.data
  },
  // V4 Phase 11: 콘텐츠 생애주기 API
  getLifecycleStats: async () => {
    const res = await apiClient.get('/content/lifecycle/stats')
    return res.data
  },
  disable: async (id: string) => {
    const res = await apiClient.post(`/content/${id}/disable`)
    return res.data
  },
  enable: async (id: string) => {
    const res = await apiClient.post(`/content/${id}/enable`)
    return res.data
  }
}
