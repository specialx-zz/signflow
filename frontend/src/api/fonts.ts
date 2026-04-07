/**
 * V4 Phase 12b: 폰트 관리 + 콘텐츠 버저닝 API
 */
import apiClient from './client'

// ─── 폰트 타입 ───────────────────────────────
export interface SystemFont {
  id: string
  name: string
  family: string
  type: 'system'
  weight: string
}

export interface CustomFont {
  id: string
  name: string
  family: string
  fileUrl: string
  format: string
  weight: string
  style: string
  type: 'custom'
  tenantId?: string
  isActive?: boolean
  createdAt?: string
}

export interface FontListResponse {
  system: SystemFont[]
  custom: CustomFont[]
}

// ─── 버전 타입 ───────────────────────────────
export interface ContentVersion {
  id: string
  contentId: string
  version: number
  comment?: string | null
  thumbnail?: string | null
  createdBy: string
  createdAt: string
  canvasData?: Record<string, unknown>
}

// ─── API ─────────────────────────────────────
export const fontApi = {
  list: async (): Promise<FontListResponse> => {
    const res = await apiClient.get('/fonts')
    return res.data
  },
  upload: async (data: FormData): Promise<CustomFont> => {
    const res = await apiClient.post('/fonts', data, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
    return res.data
  },
  delete: async (id: string) => {
    const res = await apiClient.delete(`/fonts/${id}`)
    return res.data
  }
}

export const versionApi = {
  list: async (contentId: string): Promise<ContentVersion[]> => {
    const res = await apiClient.get(`/canvas/versions/${contentId}`)
    return res.data
  },
  create: async (contentId: string, data: { canvasJson: string; comment?: string; thumbnail?: string }) => {
    const res = await apiClient.post(`/canvas/versions/${contentId}`, data)
    return res.data
  },
  get: async (versionId: string): Promise<ContentVersion> => {
    const res = await apiClient.get(`/canvas/versions/detail/${versionId}`)
    return res.data
  },
  restore: async (versionId: string) => {
    const res = await apiClient.post(`/canvas/versions/restore/${versionId}`)
    return res.data
  }
}
