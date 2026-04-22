import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import Sidebar from '@/components/layout/Sidebar'
import { createMockUser, mockAuthStore } from '../mocks/authStore'

// Mock react-router-dom
vi.mock('react-router-dom', () => ({
  NavLink: ({ children, to, className }: any) => (
    <a href={to} className={typeof className === 'function' ? className({ isActive: false }) : className}>
      {children}
    </a>
  ),
  useLocation: () => ({ pathname: '/dashboard' }),
}))

// Mock the auth store
const mockUseAuthStore = vi.fn()
vi.mock('@/store/authStore', () => ({
  useAuthStore: (...args: any[]) => mockUseAuthStore(...args),
}))

describe('Sidebar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the VueSign branding', () => {
    mockUseAuthStore.mockReturnValue(mockAuthStore(createMockUser({ role: 'USER' })))
    render(<Sidebar />)

    expect(screen.getByText('VueSign')).toBeInTheDocument()
    expect(screen.getByText('Digital Signage')).toBeInTheDocument()
  })

  it('renders common navigation items for all roles', () => {
    mockUseAuthStore.mockReturnValue(mockAuthStore(createMockUser({ role: 'USER' })))
    render(<Sidebar />)

    expect(screen.getByText('대시보드')).toBeInTheDocument()
    expect(screen.getByText('콘텐츠')).toBeInTheDocument()
    expect(screen.getByText('플레이리스트')).toBeInTheDocument()
    expect(screen.getByText('레이아웃')).toBeInTheDocument()
    expect(screen.getByText('스케줄')).toBeInTheDocument()
    expect(screen.getByText('장치')).toBeInTheDocument()
    expect(screen.getByText('모니터링')).toBeInTheDocument()
    expect(screen.getByText('통계')).toBeInTheDocument()
  })

  it('VIEWER should not see admin-only items', () => {
    mockUseAuthStore.mockReturnValue(mockAuthStore(createMockUser({ role: 'VIEWER' })))
    render(<Sidebar />)

    // VIEWER (level 10) should not see items with minRole >= 30 or roles: ['SUPER_ADMIN']
    expect(screen.queryByText('업체 관리')).not.toBeInTheDocument() // SUPER_ADMIN only
    expect(screen.queryByText('구독/과금')).not.toBeInTheDocument() // SUPER_ADMIN only
    expect(screen.queryByText('매장 관리')).not.toBeInTheDocument() // minRole: 40
    expect(screen.queryByText('사용자')).not.toBeInTheDocument() // minRole: 40
    expect(screen.queryByText('긴급 메시지')).not.toBeInTheDocument() // minRole: 30
    expect(screen.queryByText('콘텐츠 승인')).not.toBeInTheDocument() // minRole: 30
    expect(screen.queryByText('설정')).not.toBeInTheDocument() // minRole: 40
  })

  it('TENANT_ADMIN sees store and user management items', () => {
    mockUseAuthStore.mockReturnValue(mockAuthStore(createMockUser({ role: 'TENANT_ADMIN' })))
    render(<Sidebar />)

    expect(screen.getByText('매장 관리')).toBeInTheDocument()
    expect(screen.getByText('사용자')).toBeInTheDocument()
    expect(screen.getByText('긴급 메시지')).toBeInTheDocument()
    expect(screen.getByText('콘텐츠 승인')).toBeInTheDocument()
    expect(screen.getByText('구독 관리')).toBeInTheDocument()
    expect(screen.getByText('설정')).toBeInTheDocument()

    // But TENANT_ADMIN should NOT see SUPER_ADMIN-only items
    expect(screen.queryByText('업체 관리')).not.toBeInTheDocument()
    expect(screen.queryByText('구독/과금')).not.toBeInTheDocument()
  })

  it('SUPER_ADMIN sees all items including tenant management', () => {
    mockUseAuthStore.mockReturnValue(mockAuthStore(createMockUser({ role: 'SUPER_ADMIN' })))
    render(<Sidebar />)

    // Super admin exclusive items
    expect(screen.getByText('업체 관리')).toBeInTheDocument()
    expect(screen.getByText('구독/과금')).toBeInTheDocument()

    // Plus all regular items
    expect(screen.getByText('대시보드')).toBeInTheDocument()
    expect(screen.getByText('매장 관리')).toBeInTheDocument()
    expect(screen.getByText('사용자')).toBeInTheDocument()
    expect(screen.getByText('설정')).toBeInTheDocument()
    expect(screen.getByText('긴급 메시지')).toBeInTheDocument()
    expect(screen.getByText('콘텐츠 승인')).toBeInTheDocument()
  })
})
