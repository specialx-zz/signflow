import api from './client'
import type { PaginatedResponse } from '@/types'

export interface SharedContent {
  id: string
  name: string
  type: string
  mimeType?: string
  size: number
  filePath: string
  storageType: string
  thumbnail?: string
  tags?: string
  category?: string
  description?: string
  url?: string
  thumbnailUrl?: string
  isActive: boolean
  createdAt: string
}

export const sharedContentApi = {
  getAll: (params?: { type?: string; category?: string; search?: string; page?: number; limit?: number }) =>
    api.get<PaginatedResponse<SharedContent>>('/shared-content', { params }).then(r => r.data),

  upload: (formData: FormData) =>
    api.post<SharedContent>('/shared-content', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then(r => r.data),

  import: (id: string) =>
    api.post(`/shared-content/${id}/import`).then(r => r.data),

  delete: (id: string) =>
    api.delete(`/shared-content/${id}`).then(r => r.data),
}
