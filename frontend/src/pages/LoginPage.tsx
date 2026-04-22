import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Tv2, Eye, EyeOff, Lock, Mail } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { authApi } from '@/api/auth'
import toast from 'react-hot-toast'

export default function LoginPage() {
  const navigate = useNavigate()
  const { setAuth } = useAuthStore()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    try {
      const data = await authApi.login(email, password)
      setAuth(data.user, data.token)
      toast.success(`환영합니다, ${data.user.username}!`)
      navigate('/dashboard')
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } }
      toast.error(error.response?.data?.error || '로그인에 실패했습니다')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex" style={{ backgroundColor: '#0f172a' }}>
      {/* Left panel */}
      <div className="hidden lg:flex flex-col justify-center px-16 w-1/2"
        style={{ backgroundColor: '#1a1a2e' }}>
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center">
              <Tv2 className="w-7 h-7 text-white" />
            </div>
            <div>
              <div className="text-white text-2xl font-bold">VueSign</div>
              <div className="text-blue-400 text-sm">Digital Signage Management System</div>
            </div>
          </div>
          <h1 className="text-4xl font-bold text-white leading-tight mb-4">
            디지털 사이니지<br />
            <span className="text-blue-400">통합 관리 시스템</span>
          </h1>
          <p className="text-gray-400 text-lg leading-relaxed">
            콘텐츠, 플레이리스트, 스케줄, 장치를<br />
            하나의 플랫폼에서 효율적으로 관리하세요.
          </p>
        </div>

        {/* Feature bullets */}
        <div className="space-y-4">
          {[
            '실시간 장치 모니터링 및 원격 제어',
            '직관적인 드래그앤드롭 콘텐츠 관리',
            '유연한 스케줄링 및 자동 배포',
            '상세한 재생 통계 및 분석'
          ].map((feature, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="w-2 h-2 bg-blue-400 rounded-full flex-shrink-0" />
              <span className="text-gray-300 text-sm">{feature}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Right panel - Login form */}
      <div className="flex-1 flex items-center justify-center px-8">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="flex items-center gap-3 mb-8 lg:hidden">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
              <Tv2 className="w-6 h-6 text-white" />
            </div>
            <div className="text-white text-xl font-bold">VueSign</div>
          </div>

          <div className="bg-white rounded-2xl shadow-2xl p-8">
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-gray-800">로그인</h2>
              <p className="text-gray-500 text-sm mt-1">계정 정보를 입력하여 로그인하세요</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="label">이메일</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="input pl-10"
                    placeholder="이메일을 입력하세요"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="label">비밀번호</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="input pl-10 pr-10"
                    placeholder="비밀번호를 입력하세요"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
              >
                {isLoading ? '로그인 중...' : '로그인'}
              </button>
            </form>

            {import.meta.env.DEV && <div className="mt-6 pt-6 border-t border-gray-100">
              <p className="text-xs text-gray-400 text-center mb-3">테스트 계정 (개발 모드)</p>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: '최고관리자', email: 'superadmin@vuesign.com', password: 'superadmin123', bg: 'bg-red-50 hover:bg-red-100', color: 'text-red-600', badge: 'bg-red-100 text-red-700' },
                  { label: '업체관리자', email: 'admin@vuesign.com', password: 'admin123', bg: 'bg-blue-50 hover:bg-blue-100', color: 'text-blue-600', badge: 'bg-blue-100 text-blue-700' },
                  { label: '매장관리자', email: 'manager@vuesign.com', password: 'manager123', bg: 'bg-green-50 hover:bg-green-100', color: 'text-green-600', badge: 'bg-green-100 text-green-700' },
                  { label: '사용자', email: 'user@vuesign.com', password: 'user123', bg: 'bg-amber-50 hover:bg-amber-100', color: 'text-amber-600', badge: 'bg-amber-100 text-amber-700' },
                  { label: '뷰어', email: 'viewer@vuesign.com', password: 'viewer123', bg: 'bg-purple-50 hover:bg-purple-100', color: 'text-purple-600', badge: 'bg-purple-100 text-purple-700' },
                ].map((account) => (
                  <button
                    key={account.email}
                    type="button"
                    onClick={() => { setEmail(account.email); setPassword(account.password) }}
                    className={`text-xs px-3 py-2.5 ${account.bg} rounded-lg text-left transition-colors border border-transparent hover:border-gray-200`}
                  >
                    <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold ${account.badge} mb-1`}>
                      {account.label}
                    </span>
                    <div className="text-gray-500 truncate">{account.email.split('@')[0]}@</div>
                  </button>
                ))}
              </div>
            </div>}
          </div>
        </div>
      </div>
    </div>
  )
}
