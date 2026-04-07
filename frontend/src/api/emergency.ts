import api from './client'

export interface EmergencyMessage {
  id: string
  tenantId: string
  title: string
  message: string
  type: 'INFO' | 'WARNING' | 'DANGER' | 'CUSTOM'
  bgColor: string
  textColor: string
  fontSize: number
  displayMode: 'OVERLAY' | 'FULLSCREEN' | 'TICKER'
  priority: number
  targetType: 'ALL' | 'STORE' | 'DEVICE'
  targetIds?: string
  isActive: boolean
  startAt: string
  expiresAt?: string
  createdBy: string
  createdAt: string
}

export interface CreateEmergencyRequest {
  title: string
  message: string
  type?: string
  bgColor?: string
  textColor?: string
  fontSize?: number
  displayMode?: string
  priority?: number
  targetType?: string
  targetIds?: string[]
  expiresAt?: string
}

export const emergencyApi = {
  getAll: (active?: boolean) =>
    api.get<EmergencyMessage[]>('/emergency', { params: active !== undefined ? { active } : {} }).then(r => r.data),

  create: (data: CreateEmergencyRequest) =>
    api.post<EmergencyMessage>('/emergency', data).then(r => r.data),

  deactivate: (id: string) =>
    api.put<EmergencyMessage>(`/emergency/${id}/deactivate`).then(r => r.data),

  delete: (id: string) =>
    api.delete(`/emergency/${id}`).then(r => r.data),
}
