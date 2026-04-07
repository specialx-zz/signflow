import api from './client'
import type { PaginatedResponse } from '@/types'

export interface ContentApproval {
  id: string
  tenantId: string
  contentId: string
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  requestedBy: string
  reviewedBy?: string
  comment?: string
  requestedAt: string
  reviewedAt?: string
  content?: { id: string; name: string; type: string; thumbnail?: string; filePath?: string }
  requester?: { id: string; username: string }
  reviewer?: { id: string; username: string }
}

export const approvalsApi = {
  getAll: (params?: { status?: string; page?: number; limit?: number }) =>
    api.get<PaginatedResponse<ContentApproval>>('/approvals', { params }).then(r => r.data),

  request: (contentId: string, comment?: string) =>
    api.post<ContentApproval>('/approvals', { contentId, comment }).then(r => r.data),

  approve: (id: string, comment?: string) =>
    api.put<ContentApproval>(`/approvals/${id}/approve`, { comment }).then(r => r.data),

  reject: (id: string, comment: string) =>
    api.put<ContentApproval>(`/approvals/${id}/reject`, { comment }).then(r => r.data),
}
