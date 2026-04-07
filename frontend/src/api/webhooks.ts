import client from './client'

export interface Webhook {
  id: string
  tenantId: string
  name: string
  url: string
  secret?: string
  events: string
  isActive: boolean
  createdAt: string
}

export interface WebhookLog {
  id: string
  webhookId: string
  event: string
  payload: string
  statusCode?: number
  response?: string
  success: boolean
  attempts: number
  createdAt: string
}

export const WEBHOOK_EVENTS = [
  { value: 'device.online', label: '장치 온라인' },
  { value: 'device.offline', label: '장치 오프라인' },
  { value: 'content.uploaded', label: '콘텐츠 업로드' },
  { value: 'content.deleted', label: '콘텐츠 삭제' },
  { value: 'schedule.deployed', label: '스케줄 배포' },
  { value: 'emergency.created', label: '긴급메시지 발송' },
  { value: 'approval.requested', label: '승인 요청' },
  { value: 'approval.completed', label: '승인 완료' },
]

export const webhookApi = {
  getAll: () => client.get('/webhooks'),
  create: (data: { name: string; url: string; events: string[] }) => client.post('/webhooks', data),
  update: (id: string, data: Partial<Webhook>) => client.put(`/webhooks/${id}`, data),
  delete: (id: string) => client.delete(`/webhooks/${id}`),
  getLogs: (id: string, params?: { page?: number }) => client.get(`/webhooks/${id}/logs`, { params }),
  test: (id: string) => client.post(`/webhooks/${id}/test`),
}
