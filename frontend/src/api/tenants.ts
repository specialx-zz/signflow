import apiClient from './client'
import type { Tenant, PaginatedResponse } from '@/types'

export const tenantApi = {
  getAll: async (params?: { page?: number; limit?: number; search?: string }) => {
    const res = await apiClient.get<PaginatedResponse<Tenant>>('/tenants', { params })
    return res.data
  },
  getById: async (id: string) => {
    const res = await apiClient.get<Tenant>(`/tenants/${id}`)
    return res.data
  },
  create: async (data: { name: string; slug: string; contactName?: string; contactEmail?: string; contactPhone?: string; address?: string }) => {
    const res = await apiClient.post<Tenant>('/tenants', data)
    return res.data
  },
  update: async (id: string, data: Partial<Tenant>) => {
    const res = await apiClient.put<Tenant>(`/tenants/${id}`, data)
    return res.data
  },
  delete: async (id: string) => {
    const res = await apiClient.delete(`/tenants/${id}`)
    return res.data
  },
  getStats: async (id: string) => {
    const res = await apiClient.get(`/tenants/${id}/stats`)
    return res.data
  },
}
