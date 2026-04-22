import { NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, Film, ListVideo, Calendar, Monitor,
  BarChart2, BarChart3, Users, Settings, ChevronRight, Tv2, Eye, Layout,
  Building2, Warehouse, CreditCard, Shield, AlertTriangle,
  Library, FileCheck, ShoppingBag, X, Link2, Paintbrush, Radio, Tag, LayoutGrid
} from 'lucide-react'
import { clsx } from 'clsx'
import { useAuthStore } from '@/store/authStore'

interface NavItem {
  path: string
  icon: React.ElementType
  label: string
  section?: string
  roles?: string[]
  minRole?: number
}

interface SidebarProps {
  onClose?: () => void
}

const ROLE_LEVEL: Record<string, number> = {
  SUPER_ADMIN: 50, TENANT_ADMIN: 40, STORE_MANAGER: 30, USER: 20, VIEWER: 10, ADMIN: 40
}

const allNavItems: NavItem[] = [
  // Super admin section
  { path: '/admin/tenants', icon: Building2, label: '업체 관리', section: '플랫폼 관리', roles: ['SUPER_ADMIN'] },
  { path: '/admin/billing', icon: CreditCard, label: '구독/과금', roles: ['SUPER_ADMIN'] },

  // Regular section
  { path: '/dashboard', icon: LayoutDashboard, label: '대시보드', section: '서비스 관리' },
  { path: '/stores', icon: Warehouse, label: '매장 관리', minRole: 40 },
  { path: '/content', icon: Film, label: '콘텐츠' },
  { path: '/canvas', icon: Paintbrush, label: '캔버스 에디터' },
  { path: '/templates', icon: ShoppingBag, label: '템플릿 마켓' },
  { path: '/channels', icon: Radio, label: '채널' },
  { path: '/playlists', icon: ListVideo, label: '플레이리스트' },
  { path: '/layouts', icon: Layout, label: '레이아웃' },
  { path: '/schedules', icon: Calendar, label: '스케줄' },
  { path: '/tag-playback', icon: Tag, label: '조건부 재생' },
  { path: '/devices', icon: Monitor, label: '장치' },
  { path: '/screen-wall', icon: LayoutGrid, label: '스크린 월', minRole: 30 },
  { path: '/monitoring', icon: Eye, label: '모니터링' },
  { path: '/stats', icon: BarChart2, label: '통계' },
  { path: '/users', icon: Users, label: '사용자', minRole: 40 },
  { path: '/emergency', icon: AlertTriangle, label: '긴급 메시지', section: '고급 기능', minRole: 30 },
  { path: '/shared-content', icon: Library, label: '공유 라이브러리' },
  { path: '/approvals', icon: FileCheck, label: '콘텐츠 승인', minRole: 30 },
  { path: '/reports', icon: BarChart3, label: '리포트', section: '분석' },
  { path: '/subscription', icon: CreditCard, label: '구독 관리', section: '계정', minRole: 40 },
  { path: '/webhooks', icon: Link2, label: '웹훅', minRole: 40 },
  { path: '/settings', icon: Settings, label: '설정', minRole: 40 },
]

export default function Sidebar({ onClose }: SidebarProps) {
  const location = useLocation()
  const { user } = useAuthStore()
  const userLevel = ROLE_LEVEL[user?.role || 'VIEWER'] || 10

  const visibleItems = allNavItems.filter(item => {
    if (item.roles && !item.roles.includes(user?.role || '')) return false
    if (item.minRole && userLevel < item.minRole) return false
    return true
  })

  return (
    <div className="flex flex-col h-full" style={{ backgroundColor: '#1a1a2e' }}>
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-white/10">
        <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
          <Tv2 className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1">
          <div className="text-white font-bold text-base leading-tight">VueSign</div>
          <div className="text-blue-400 text-xs">Digital Signage</div>
        </div>
        {/* Mobile close button */}
        {onClose && (
          <button
            onClick={onClose}
            className="lg:hidden p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
            aria-label="Close sidebar"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-3 overflow-y-auto">
        <div className="space-y-0.5">
          {visibleItems.map((item, index) => {
            const isActive = location.pathname === item.path ||
              (item.path !== '/dashboard' && location.pathname.startsWith(item.path))
            const prevSection = index > 0 ? visibleItems[index - 1].section : undefined
            const showSection = item.section && item.section !== prevSection

            return (
              <div key={item.path}>
                {showSection && (
                  <div className={clsx(
                    'px-3 pt-4 pb-1 text-xs font-semibold text-gray-500 uppercase tracking-wider',
                    index > 0 && 'border-t border-white/10 mt-2'
                  )}>
                    {item.section}
                  </div>
                )}
                <NavLink
                  to={item.path}
                  onClick={onClose}
                  className={clsx(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150 group relative',
                    isActive
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-400 hover:bg-white/10 hover:text-white'
                  )}
                >
                  {isActive && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-blue-300 rounded-r-full" />
                  )}
                  <item.icon className={clsx(
                    'w-5 h-5 flex-shrink-0',
                    isActive ? 'text-white' : 'text-gray-500 group-hover:text-gray-300'
                  )} />
                  <span className="text-sm font-medium flex-1">{item.label}</span>
                  {isActive && <ChevronRight className="w-4 h-4 text-blue-300" />}
                </NavLink>
              </div>
            )
          })}
        </div>
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-white/10">
        <div className="text-center text-xs text-gray-600">
          <div>VueSign v2.0</div>
          <div className="mt-0.5">&copy; 2024 Digital Signage</div>
        </div>
      </div>
    </div>
  )
}
