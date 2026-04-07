import { describe, it, expect, beforeEach } from 'vitest'
import { useAuthStore } from '@/store/authStore'
import type { User } from '@/types'

const testUser: User = {
  id: 'user-1',
  username: 'Test User',
  email: 'test@signflow.com',
  role: 'USER',
  tenantId: 'tenant-1',
  tenantName: 'Test Tenant',
  isActive: true,
  createdAt: '2024-01-01T00:00:00Z',
}

describe('authStore', () => {
  beforeEach(() => {
    // Reset store to initial state before each test
    useAuthStore.setState({
      user: null,
      token: null,
      isAuthenticated: false,
    })
    localStorage.clear()
  })

  it('has correct initial state', () => {
    const state = useAuthStore.getState()
    expect(state.isAuthenticated).toBe(false)
    expect(state.user).toBeNull()
    expect(state.token).toBeNull()
  })

  it('sets auth state after login via setAuth', () => {
    useAuthStore.getState().setAuth(testUser, 'test-token-123')

    const state = useAuthStore.getState()
    expect(state.isAuthenticated).toBe(true)
    expect(state.user).toEqual(testUser)
    expect(state.token).toBe('test-token-123')
  })

  it('resets state after logout', () => {
    // First log in
    useAuthStore.getState().setAuth(testUser, 'test-token-123')
    expect(useAuthStore.getState().isAuthenticated).toBe(true)

    // Then log out
    useAuthStore.getState().logout()

    const state = useAuthStore.getState()
    expect(state.isAuthenticated).toBe(false)
    expect(state.user).toBeNull()
    expect(state.token).toBeNull()
  })

  it('updates user fields via updateUser', () => {
    useAuthStore.getState().setAuth(testUser, 'test-token-123')

    useAuthStore.getState().updateUser({ username: 'Updated Name', email: 'new@signflow.com' })

    const state = useAuthStore.getState()
    expect(state.user?.username).toBe('Updated Name')
    expect(state.user?.email).toBe('new@signflow.com')
    // Other fields remain unchanged
    expect(state.user?.role).toBe('USER')
    expect(state.user?.id).toBe('user-1')
  })

  it('updateUser does nothing when user is null', () => {
    useAuthStore.getState().updateUser({ username: 'Ghost' })

    expect(useAuthStore.getState().user).toBeNull()
  })

  it('persists auth state to localStorage under signflow-auth key', () => {
    useAuthStore.getState().setAuth(testUser, 'persist-token')

    const stored = localStorage.getItem('signflow-auth')
    expect(stored).not.toBeNull()

    const parsed = JSON.parse(stored!)
    expect(parsed.state.token).toBe('persist-token')
    expect(parsed.state.user).toEqual(testUser)
    expect(parsed.state.isAuthenticated).toBe(true)
  })

  it('removes auth data from localStorage after logout', () => {
    useAuthStore.getState().setAuth(testUser, 'persist-token')
    expect(localStorage.getItem('signflow-auth')).not.toBeNull()

    useAuthStore.getState().logout()

    const stored = localStorage.getItem('signflow-auth')
    expect(stored).not.toBeNull()
    const parsed = JSON.parse(stored!)
    expect(parsed.state.token).toBeNull()
    expect(parsed.state.user).toBeNull()
    expect(parsed.state.isAuthenticated).toBe(false)
  })
})
