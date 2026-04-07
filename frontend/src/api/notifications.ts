import client from './client'

export interface Notification {
  id: string
  tenantId: string
  userId: string
  type: string
  title: string
  message: string
  data?: string
  isRead: boolean
  createdAt: string
}

export const notificationApi = {
  getAll: (params?: { page?: number; limit?: number; unreadOnly?: boolean }) =>
    client.get('/notifications', { params }),

  getUnreadCount: () =>
    client.get('/notifications/unread-count'),

  markAsRead: (id: string) =>
    client.put(`/notifications/${id}/read`),

  markAllAsRead: () =>
    client.put('/notifications/read-all'),

  delete: (id: string) =>
    client.delete(`/notifications/${id}`),
}
