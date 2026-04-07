import apiClient from './client'
import type { Store, Device } from '@/types'

export const storeApi = {
  getAll: async () => {
    const res = await apiClient.get('/stores')
    // 백엔드가 { items: Store[] } 형태로 반환
    return res.data.items ?? res.data
  },
  getById: async (id: string) => {
    const res = await apiClient.get<Store>(`/stores/${id}`)
    return res.data
  },
  create: async (data: { name: string; address?: string; phone?: string }) => {
    const res = await apiClient.post<Store>('/stores', data)
    return res.data
  },
  update: async (id: string, data: Partial<Store>) => {
    const res = await apiClient.put<Store>(`/stores/${id}`, data)
    return res.data
  },
  delete: async (id: string) => {
    const res = await apiClient.delete(`/stores/${id}`)
    return res.data
  },

  // ─── Store-Device Management ─────────────────────────
  getDevices: async (storeId: string) => {
    const res = await apiClient.get(`/stores/${storeId}/devices`)
    return res.data.items ?? res.data
  },
  assignDevice: async (storeId: string, deviceId: string) => {
    const res = await apiClient.post<Device>(`/stores/${storeId}/devices`, { deviceId })
    return res.data
  },
  removeDevice: async (storeId: string, deviceId: string) => {
    const res = await apiClient.delete<Device>(`/stores/${storeId}/devices/${deviceId}`)
    return res.data
  },
}
