import apiClient from './client'

export const playlistApi = {
  getAll: async (params?: Record<string, unknown>) => {
    const res = await apiClient.get('/playlists', { params })
    return res.data
  },
  getById: async (id: string) => {
    const res = await apiClient.get(`/playlists/${id}`)
    return res.data
  },
  create: async (data: Record<string, unknown>) => {
    const res = await apiClient.post('/playlists', data)
    return res.data
  },
  update: async (id: string, data: Record<string, unknown>) => {
    const res = await apiClient.put(`/playlists/${id}`, data)
    return res.data
  },
  delete: async (id: string) => {
    const res = await apiClient.delete(`/playlists/${id}`)
    return res.data
  },
  addItem: async (playlistId: string, data: Record<string, unknown>) => {
    const res = await apiClient.post(`/playlists/${playlistId}/items`, data)
    return res.data
  },
  updateItem: async (playlistId: string, itemId: string, data: Record<string, unknown>) => {
    const res = await apiClient.put(`/playlists/${playlistId}/items/${itemId}`, data)
    return res.data
  },
  removeItem: async (playlistId: string, itemId: string) => {
    const res = await apiClient.delete(`/playlists/${playlistId}/items/${itemId}`)
    return res.data
  },
  reorderItems: async (playlistId: string, items: { id: string; order: number }[]) => {
    const res = await apiClient.put(`/playlists/${playlistId}/items/reorder`, { items })
    return res.data
  }
}
