import axios from 'axios'
import toast from 'react-hot-toast'
import { useAuthStore } from '@/store/authStore'

const apiClient = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json'
  }
})

apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// ─── 응답 에러 인터셉터 ───────────────────────────────────────────────────────
// - 401: 자동 로그아웃
// - 403: 권한 없음 toast
// - 422/400: 서버 검증 오류 toast (응답 body의 error 메시지 사용)
// - 5xx: 서버 오류 toast
// - network: 네트워크 연결 오류 toast
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status
    const serverMsg: string =
      error.response?.data?.error ||
      error.response?.data?.message ||
      error.response?.data ||
      null

    if (status === 401) {
      useAuthStore.getState().logout()
      window.location.href = '/login'
      return Promise.reject(error)
    }

    if (status === 403) {
      toast.error(serverMsg || '접근 권한이 없습니다')
      return Promise.reject(error)
    }

    if (status === 400 || status === 422) {
      // 개별 컴포넌트에서 처리하도록 toast는 생략 — 에러를 re-throw만 함
      return Promise.reject(error)
    }

    if (status === 404) {
      // 404는 보통 컴포넌트에서 처리
      return Promise.reject(error)
    }

    if (status && status >= 500) {
      toast.error(serverMsg || '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.')
      return Promise.reject(error)
    }

    if (!error.response) {
      // 네트워크 오류 (서버 미응답, CORS 등)
      toast.error('네트워크 연결을 확인해주세요.')
    }

    return Promise.reject(error)
  }
)

export default apiClient
