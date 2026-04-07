import { vi } from 'vitest'
import type { User } from '@/types'

export function createMockUser(overrides: Partial<User> = {}): User {
  return {
    id: 'test-user-id',
    username: 'Test User',
    email: 'test@signflow.com',
    role: 'USER',
    tenantId: 'tenant-1',
    tenantName: 'Test Tenant',
    isActive: true,
    createdAt: '2024-01-01T00:00:00Z',
    ...overrides,
  }
}

export function mockAuthStore(user: User | null = createMockUser()) {
  return {
    user,
    token: user ? 'mock-token' : null,
    isAuthenticated: !!user,
    setAuth: vi.fn(),
    logout: vi.fn(),
    updateUser: vi.fn(),
  }
}
