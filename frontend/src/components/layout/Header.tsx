import { useLocation, Link } from 'react-router-dom'
import { ChevronRight, LogOut, Menu, Sun, Moon, Monitor, User, Wifi, WifiOff } from 'lucide-react'
import NotificationCenter from './NotificationCenter'
import TenantSwitcher from './TenantSwitcher'
import { useAuthStore } from '@/store/authStore'
import { useTheme } from '@/hooks/useTheme'
import { useSocket, disconnectSocket } from '@/hooks/useSocket'
import { authApi } from '@/api/auth'
import toast from 'react-hot-toast'

const roleDisplayName: Record<string, string> = {
  SUPER_ADMIN: '최고관리자',
  TENANT_ADMIN: '업체관리자',
  ADMIN: '업체관리자',
  STORE_MANAGER: '매장관리자',
  USER: '사용자',
  VIEWER: '뷰어',
}

const breadcrumbMap: Record<string, string> = {
  dashboard: '대시보드',
  content: '콘텐츠 관리',
  playlists: '플레이리스트',
  schedules: '스케줄 관리',
  devices: '장치 관리',
  stats: '통계',
  users: '사용자 관리',
  settings: '설정'
}

interface HeaderProps {
  onMenuToggle?: () => void
}

const themeIcons = {
  light: Sun,
  dark: Moon,
  system: Monitor,
} as const

const themeLabels = {
  light: '라이트 모드',
  dark: '다크 모드',
  system: '시스템 설정',
} as const

const themeOrder: Array<'light' | 'dark' | 'system'> = ['light', 'dark', 'system']

export default function Header({ onMenuToggle }: HeaderProps) {
  const location = useLocation()
  const { user, logout } = useAuthStore()
  const { isConnected: connected } = useSocket()
  const { theme, setTheme } = useTheme()

  const cycleTheme = () => {
    const currentIndex = themeOrder.indexOf(theme)
    const nextIndex = (currentIndex + 1) % themeOrder.length
    setTheme(themeOrder[nextIndex])
  }

  const ThemeIcon = themeIcons[theme]

  const pathParts = location.pathname.split('/').filter(Boolean)
  const breadcrumbs = pathParts.map((part, idx) => ({
    label: breadcrumbMap[part] || part,
    path: '/' + pathParts.slice(0, idx + 1).join('/')
  }))

  const handleLogout = async () => {
    try {
      await authApi.logout()
    } catch {}
    disconnectSocket()      // disconnect the useSocket hook singleton
    logout()
    toast.success('로그아웃되었습니다')
    window.location.href = '/login'
  }

  return (
    <header className="h-14 bg-white border-b border-gray-200 dark:bg-gray-800 dark:border-gray-700 flex items-center justify-between px-4 lg:px-6 flex-shrink-0">
      {/* Left side: hamburger + breadcrumb */}
      <div className="flex items-center gap-2">
        {/* Mobile hamburger menu */}
        {onMenuToggle && (
          <button
            onClick={onMenuToggle}
            className="lg:hidden p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Toggle menu"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}

        {/* Breadcrumb */}
        <nav className="items-center gap-1 text-sm hidden sm:flex">
          <Link to="/dashboard" className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">홈</Link>
          {breadcrumbs.map((crumb, idx) => (
            <span key={crumb.path} className="flex items-center gap-1">
              <ChevronRight className="w-4 h-4 text-gray-300" />
              {idx === breadcrumbs.length - 1 ? (
                <span className="text-gray-700 dark:text-gray-200 font-medium">{crumb.label}</span>
              ) : (
                <Link to={crumb.path} className="text-gray-500 hover:text-gray-700">{crumb.label}</Link>
              )}
            </span>
          ))}
        </nav>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-2 lg:gap-4">
        {/* Tenant switcher — SUPER_ADMIN only (SPEC-001) */}
        <TenantSwitcher />

        {/* Connection status */}
        <div className={`items-center gap-1.5 text-xs hidden sm:flex ${connected ? 'text-green-600' : 'text-gray-400'}`}>
          {connected ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
          <span>{connected ? '연결됨' : '오프라인'}</span>
        </div>

        {/* Theme toggle */}
        <button
          onClick={cycleTheme}
          className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:text-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
          title={themeLabels[theme]}
        >
          <ThemeIcon className="w-5 h-5" />
        </button>

        {/* Notification center */}
        <NotificationCenter />

        {/* User menu */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 px-2 lg:px-3 py-1.5 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <div className="w-7 h-7 bg-blue-100 rounded-full flex items-center justify-center">
              <User className="w-4 h-4 text-blue-600" />
            </div>
            <div className="text-sm hidden sm:block">
              <div className="font-medium text-gray-700 dark:text-gray-200">{user?.username}</div>
              <div className="text-xs text-gray-400">{roleDisplayName[user?.role || ''] || user?.role}</div>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            title="로그아웃"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>
    </header>
  )
}
