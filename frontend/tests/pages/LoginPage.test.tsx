import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import LoginPage from '@/pages/LoginPage'
import { mockAuthStore } from '../mocks/authStore'

// Mock react-router-dom
vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
  useLocation: () => ({ pathname: '/' }),
  Link: ({ children, to }: any) => <a href={to}>{children}</a>,
}))

// Mock the auth store
const mockUseAuthStore = vi.fn()
vi.mock('@/store/authStore', () => ({
  useAuthStore: (...args: any[]) => mockUseAuthStore(...args),
}))

// Mock auth API
vi.mock('@/api/auth', () => ({
  authApi: {
    login: vi.fn(),
  },
}))

// Mock react-hot-toast
vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseAuthStore.mockReturnValue(mockAuthStore(null))
  })

  it('renders email and password inputs', () => {
    render(<LoginPage />)

    const emailInput = screen.getByPlaceholderText('이메일을 입력하세요')
    expect(emailInput).toBeInTheDocument()
    expect(emailInput).toHaveAttribute('type', 'email')

    const passwordInput = screen.getByPlaceholderText('비밀번호를 입력하세요')
    expect(passwordInput).toBeInTheDocument()
    expect(passwordInput).toHaveAttribute('type', 'password')
  })

  it('renders the submit button', () => {
    render(<LoginPage />)

    const submitButton = screen.getByRole('button', { name: '로그인' })
    expect(submitButton).toBeInTheDocument()
    expect(submitButton).toHaveAttribute('type', 'submit')
  })

  it('renders the VueSign branding', () => {
    render(<LoginPage />)

    // There may be multiple "VueSign" text nodes (mobile + desktop)
    const vuesignElements = screen.getAllByText('VueSign')
    expect(vuesignElements.length).toBeGreaterThan(0)
  })

  it('renders test account buttons', () => {
    render(<LoginPage />)

    expect(screen.getByText('테스트 계정')).toBeInTheDocument()
    expect(screen.getByText('최고관리자')).toBeInTheDocument()
    expect(screen.getByText('업체관리자')).toBeInTheDocument()
    expect(screen.getByText('매장관리자')).toBeInTheDocument()
    expect(screen.getByText('사용자')).toBeInTheDocument()
    expect(screen.getByText('뷰어')).toBeInTheDocument()
  })

  it('has default email and password prefilled', () => {
    render(<LoginPage />)

    const emailInput = screen.getByPlaceholderText('이메일을 입력하세요') as HTMLInputElement
    expect(emailInput.value).toBe('admin@vuesign.com')

    const passwordInput = screen.getByPlaceholderText('비밀번호를 입력하세요') as HTMLInputElement
    expect(passwordInput.value).toBe('admin123')
  })
})
