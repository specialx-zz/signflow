import api from './client'

export interface ContentTemplate {
  id: string
  name: string
  description?: string
  category: string
  type: string
  thumbnail?: string
  thumbnailUrl?: string
  fileUrl?: string
  downloads: number
  rating: number
  reviewCount: number
  isPremium: boolean
  tags?: string
  isActive: boolean
  createdAt: string
}

export interface TemplateReview {
  id: string
  templateId: string
  userId: string
  rating: number
  comment?: string
  createdAt: string
}

export const templateApi = {
  getAll: (params?: { page?: number; limit?: number; search?: string; category?: string; type?: string; sort?: string }) =>
    api.get('/templates', { params }),
  getCategories: () => api.get('/templates/categories'),
  getOne: (id: string) => api.get(`/templates/${id}`),
  use: (id: string) => api.post(`/templates/${id}/use`),
  review: (id: string, data: { rating: number; comment?: string }) =>
    api.post(`/templates/${id}/review`, data),
  upload: (formData: FormData) => api.post('/templates', formData),
  delete: (id: string) => api.delete(`/templates/${id}`),
}
