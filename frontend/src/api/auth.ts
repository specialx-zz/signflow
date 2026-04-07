import apiClient from './client'

export const authApi = {
  login: async (email: string, password: string) => {
    const res = await apiClient.post('/auth/login', { email, password })
    return res.data
  },
  logout: async () => {
    await apiClient.post('/auth/logout')
  },
  getMe: async () => {
    const res = await apiClient.get('/auth/me')
    return res.data
  },
  changePassword: async (currentPassword: string, newPassword: string) => {
    const res = await apiClient.put('/auth/change-password', { currentPassword, newPassword })
    return res.data
  }
}
