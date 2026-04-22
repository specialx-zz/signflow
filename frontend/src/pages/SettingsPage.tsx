import { useQuery } from '@tanstack/react-query'
import { Settings, Server, Shield, HardDrive, Globe, Info } from 'lucide-react'
import apiClient from '@/api/client'
import { PageLoader } from '@/components/ui/LoadingSpinner'
import { useAuthStore } from '@/store/authStore'
import { formatBytes } from '@/utils/formatBytes'

export default function SettingsPage() {
  const { user } = useAuthStore()

  const { data: settings, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const res = await apiClient.get('/settings')
      return res.data
    }
  })

  if (isLoading) return <PageLoader />

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">설정</h1>
        <p className="text-gray-500 text-sm mt-1">시스템 설정을 관리하세요</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Server Info */}
        <div className="card">
          <div className="flex items-center gap-2 mb-5">
            <Server className="w-5 h-5 text-blue-500" />
            <h2 className="text-base font-semibold text-gray-800">서버 정보</h2>
          </div>
          <dl className="space-y-4">
            {[
              { label: '시스템 이름', value: settings?.server?.name || 'VueSign Clone' },
              { label: '버전', value: settings?.server?.version || '1.0.0' },
              { label: '시간대', value: settings?.server?.timezone || 'Asia/Seoul' },
              { label: '언어', value: settings?.server?.language === 'ko' ? '한국어' : 'English' },
            ].map(item => (
              <div key={item.label} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                <dt className="text-sm text-gray-500">{item.label}</dt>
                <dd className="text-sm font-medium text-gray-800">{item.value}</dd>
              </div>
            ))}
          </dl>
        </div>

        {/* Storage Settings */}
        <div className="card">
          <div className="flex items-center gap-2 mb-5">
            <HardDrive className="w-5 h-5 text-orange-500" />
            <h2 className="text-base font-semibold text-gray-800">저장소 설정</h2>
          </div>
          <dl className="space-y-4">
            {[
              {
                label: '최대 파일 크기',
                value: formatBytes(settings?.storage?.maxFileSize || 104857600)
              },
              {
                label: '허용 파일 유형',
                value: (settings?.storage?.allowedTypes || []).join(', ') || 'IMAGE, VIDEO, AUDIO, HTML, DOCUMENT'
              },
            ].map(item => (
              <div key={item.label} className="flex items-start justify-between py-2 border-b border-gray-50 last:border-0">
                <dt className="text-sm text-gray-500">{item.label}</dt>
                <dd className="text-sm font-medium text-gray-800 text-right max-w-40">{item.value}</dd>
              </div>
            ))}
          </dl>
        </div>

        {/* Security Settings */}
        <div className="card">
          <div className="flex items-center gap-2 mb-5">
            <Shield className="w-5 h-5 text-red-500" />
            <h2 className="text-base font-semibold text-gray-800">보안 설정</h2>
          </div>
          <dl className="space-y-4">
            {[
              { label: '세션 만료', value: `${settings?.security?.sessionTimeout || 480}분` },
              { label: '최대 로그인 시도', value: `${settings?.security?.maxLoginAttempts || 5}회` },
            ].map(item => (
              <div key={item.label} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                <dt className="text-sm text-gray-500">{item.label}</dt>
                <dd className="text-sm font-medium text-gray-800">{item.value}</dd>
              </div>
            ))}
          </dl>
        </div>

        {/* Account Info */}
        <div className="card">
          <div className="flex items-center gap-2 mb-5">
            <Settings className="w-5 h-5 text-purple-500" />
            <h2 className="text-base font-semibold text-gray-800">내 계정 정보</h2>
          </div>
          <dl className="space-y-4">
            {[
              { label: '사용자명', value: user?.username },
              { label: '이메일', value: user?.email },
              { label: '역할', value: ({ SUPER_ADMIN: '최고관리자', TENANT_ADMIN: '업체관리자', ADMIN: '업체관리자', STORE_MANAGER: '매장관리자', USER: '사용자', VIEWER: '뷰어' } as Record<string, string>)[user?.role || ''] || user?.role },
            ].map(item => (
              <div key={item.label} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                <dt className="text-sm text-gray-500">{item.label}</dt>
                <dd className="text-sm font-medium text-gray-800">{item.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>

      {/* About */}
      <div className="card">
        <div className="flex items-center gap-2 mb-5">
          <Info className="w-5 h-5 text-gray-400" />
          <h2 className="text-base font-semibold text-gray-800">시스템 정보</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { label: '플랫폼', value: 'VueSign Clone', sub: 'Digital Signage Management System' },
            { label: '기술 스택', value: 'React + Node.js + SQLite', sub: 'TypeScript / Express / Prisma' },
            { label: '실시간 통신', value: 'Socket.IO', sub: 'WebSocket 기반 양방향 통신' }
          ].map(item => (
            <div key={item.label} className="p-4 bg-gray-50 rounded-xl">
              <div className="text-xs text-gray-500 mb-1">{item.label}</div>
              <div className="text-sm font-semibold text-gray-800">{item.value}</div>
              <div className="text-xs text-gray-400 mt-0.5">{item.sub}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
