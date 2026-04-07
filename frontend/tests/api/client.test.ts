import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { User } from '@/types'

// Mock the auth store before importing the client
const mockGetState = vi.fn()
vi.mock('@/store/authStore', () => ({
  useAuthStore: {
    getState: (...args: any[]) => mockGetState(...args),
  },
}))

// Track interceptor callbacks
let requestInterceptor: (config: any) => any
let responseSuccessInterceptor: (response: any) => any
let responseErrorInterceptor: (error: any) => any

vi.mock('axios', () => {
  const createMock = vi.fn(() => ({
    interceptors: {
      request: {
        use: vi.fn((fn) => {
          requestInterceptor = fn
        }),
      },
      response: {
        use: vi.fn((successFn, errorFn) => {
          responseSuccessInterceptor = successFn
          responseErrorInterceptor = errorFn
        }),
      },
    },
  }))
  return {
    default: {
      create: createMock,
    },
  }
})

// Import after mocks are set up so interceptors get captured
import axios from 'axios'

describe('API Client', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Re-import to re-run module setup and capture interceptors
  })

  it('creates axios instance with correct baseURL and headers', async () => {
    // Force re-evaluation of the module to capture interceptors
    vi.resetModules()

    // Re-apply mocks after resetModules
    vi.doMock('@/store/authStore', () => ({
      useAuthStore: {
        getState: () => ({ token: null, logout: vi.fn() }),
      },
    }))

    vi.doMock('axios', () => {
      const instance = {
        interceptors: {
          request: {
            use: vi.fn((fn) => { requestInterceptor = fn }),
          },
          response: {
            use: vi.fn((successFn, errorFn) => {
              responseSuccessInterceptor = successFn
              responseErrorInterceptor = errorFn
            }),
          },
        },
      }
      return {
        default: {
          create: vi.fn(() => instance),
        },
      }
    })

    const axiosMod = await import('axios')
    await import('@/api/client')

    expect(axiosMod.default.create).toHaveBeenCalledWith({
      baseURL: '/api',
      headers: {
        'Content-Type': 'application/json',
      },
    })
  })

  it('request interceptor adds Authorization header when token exists', async () => {
    vi.resetModules()

    const mockLogout = vi.fn()
    vi.doMock('@/store/authStore', () => ({
      useAuthStore: {
        getState: () => ({ token: 'my-jwt-token', logout: mockLogout }),
      },
    }))

    vi.doMock('axios', () => {
      const instance = {
        interceptors: {
          request: {
            use: vi.fn((fn) => { requestInterceptor = fn }),
          },
          response: {
            use: vi.fn((successFn, errorFn) => {
              responseSuccessInterceptor = successFn
              responseErrorInterceptor = errorFn
            }),
          },
        },
      }
      return {
        default: {
          create: vi.fn(() => instance),
        },
      }
    })

    await import('@/api/client')

    const config = { headers: {} as Record<string, string> }
    const result = requestInterceptor(config)
    expect(result.headers.Authorization).toBe('Bearer my-jwt-token')
  })

  it('request interceptor does not add Authorization header when no token', async () => {
    vi.resetModules()

    vi.doMock('@/store/authStore', () => ({
      useAuthStore: {
        getState: () => ({ token: null, logout: vi.fn() }),
      },
    }))

    vi.doMock('axios', () => {
      const instance = {
        interceptors: {
          request: {
            use: vi.fn((fn) => { requestInterceptor = fn }),
          },
          response: {
            use: vi.fn((successFn, errorFn) => {
              responseSuccessInterceptor = successFn
              responseErrorInterceptor = errorFn
            }),
          },
        },
      }
      return {
        default: {
          create: vi.fn(() => instance),
        },
      }
    })

    await import('@/api/client')

    const config = { headers: {} as Record<string, string> }
    const result = requestInterceptor(config)
    expect(result.headers.Authorization).toBeUndefined()
  })

  it('response interceptor passes through successful responses', async () => {
    vi.resetModules()

    vi.doMock('@/store/authStore', () => ({
      useAuthStore: {
        getState: () => ({ token: null, logout: vi.fn() }),
      },
    }))

    vi.doMock('axios', () => {
      const instance = {
        interceptors: {
          request: {
            use: vi.fn((fn) => { requestInterceptor = fn }),
          },
          response: {
            use: vi.fn((successFn, errorFn) => {
              responseSuccessInterceptor = successFn
              responseErrorInterceptor = errorFn
            }),
          },
        },
      }
      return {
        default: {
          create: vi.fn(() => instance),
        },
      }
    })

    await import('@/api/client')

    const mockResponse = { status: 200, data: { ok: true } }
    const result = responseSuccessInterceptor(mockResponse)
    expect(result).toBe(mockResponse)
  })

  it('response interceptor calls logout and redirects on 401', async () => {
    vi.resetModules()

    const mockLogout = vi.fn()
    vi.doMock('@/store/authStore', () => ({
      useAuthStore: {
        getState: () => ({ token: 'expired-token', logout: mockLogout }),
      },
    }))

    vi.doMock('axios', () => {
      const instance = {
        interceptors: {
          request: {
            use: vi.fn((fn) => { requestInterceptor = fn }),
          },
          response: {
            use: vi.fn((successFn, errorFn) => {
              responseSuccessInterceptor = successFn
              responseErrorInterceptor = errorFn
            }),
          },
        },
      }
      return {
        default: {
          create: vi.fn(() => instance),
        },
      }
    })

    // Mock window.location
    const originalLocation = window.location
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { href: '' },
    })

    await import('@/api/client')

    const error = { response: { status: 401 } }
    await expect(responseErrorInterceptor(error)).rejects.toEqual(error)
    expect(mockLogout).toHaveBeenCalled()
    expect(window.location.href).toBe('/login')

    // Restore
    Object.defineProperty(window, 'location', {
      writable: true,
      value: originalLocation,
    })
  })

  it('response interceptor rejects non-401 errors without logout', async () => {
    vi.resetModules()

    const mockLogout = vi.fn()
    vi.doMock('@/store/authStore', () => ({
      useAuthStore: {
        getState: () => ({ token: 'valid-token', logout: mockLogout }),
      },
    }))

    vi.doMock('axios', () => {
      const instance = {
        interceptors: {
          request: {
            use: vi.fn((fn) => { requestInterceptor = fn }),
          },
          response: {
            use: vi.fn((successFn, errorFn) => {
              responseSuccessInterceptor = successFn
              responseErrorInterceptor = errorFn
            }),
          },
        },
      }
      return {
        default: {
          create: vi.fn(() => instance),
        },
      }
    })

    await import('@/api/client')

    const error = { response: { status: 500 } }
    await expect(responseErrorInterceptor(error)).rejects.toEqual(error)
    expect(mockLogout).not.toHaveBeenCalled()
  })
})
