import { describe, it, expect, beforeEach } from 'vitest'
import { useAuthStore } from '@/store/authStore'
import type { User } from '@/types'

const testUser: User = {
  id: 'user-1',
  username: 'Test User',
  email: 'test@vuesign.com',
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
      activeTenantId: null,
    })
    sessionStorage.clear()
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

    useAuthStore.getState().updateUser({ username: 'Updated Name', email: 'new@vuesign.com' })

    const state = useAuthStore.getState()
    expect(state.user?.username).toBe('Updated Name')
    expect(state.user?.email).toBe('new@vuesign.com')
    // Other fields remain unchanged
    expect(state.user?.role).toBe('USER')
    expect(state.user?.id).toBe('user-1')
  })

  it('updateUser does nothing when user is null', () => {
    useAuthStore.getState().updateUser({ username: 'Ghost' })

    expect(useAuthStore.getState().user).toBeNull()
  })

  it('persists auth state to sessionStorage under vuesign-auth key', () => {
    useAuthStore.getState().setAuth(testUser, 'persist-token')

    const stored = sessionStorage.getItem('vuesign-auth')
    expect(stored).not.toBeNull()

    const parsed = JSON.parse(stored!)
    expect(parsed.state.token).toBe('persist-token')
    expect(parsed.state.user).toEqual(testUser)
    expect(parsed.state.isAuthenticated).toBe(true)
  })

  it('removes auth data from sessionStorage after logout', () => {
    useAuthStore.getState().setAuth(testUser, 'persist-token')
    expect(sessionStorage.getItem('vuesign-auth')).not.toBeNull()

    useAuthStore.getState().logout()

    const stored = sessionStorage.getItem('vuesign-auth')
    expect(stored).not.toBeNull()
    const parsed = JSON.parse(stored!)
    expect(parsed.state.token).toBeNull()
    expect(parsed.state.user).toBeNull()
    expect(parsed.state.isAuthenticated).toBe(false)
  })

  // ─── SPEC-001: activeTenantId ─────────────────────────────────────────────
  describe('activeTenantId (SPEC-001)', () => {
    const superAdmin: User = {
      ...testUser,
      id: 'sa-1',
      role: 'SUPER_ADMIN',
      username: 'Super Admin',
    }

    it('defaults to null', () => {
      expect(useAuthStore.getState().activeTenantId).toBeNull()
    })

    it('setActiveTenantId stores the selected tenantId', () => {
      useAuthStore.getState().setActiveTenantId('tenant-X')
      expect(useAuthStore.getState().activeTenantId).toBe('tenant-X')
    })

    it('setActiveTenantId(null) reverts to "전체 업체" mode', () => {
      useAuthStore.getState().setActiveTenantId('tenant-X')
      useAuthStore.getState().setActiveTenantId(null)
      expect(useAuthStore.getState().activeTenantId).toBeNull()
    })

    it('logout clears activeTenantId along with credentials', () => {
      useAuthStore.getState().setAuth(superAdmin, 'token')
      useAuthStore.getState().setActiveTenantId('tenant-A')
      expect(useAuthStore.getState().activeTenantId).toBe('tenant-A')

      useAuthStore.getState().logout()
      expect(useAuthStore.getState().activeTenantId).toBeNull()
      expect(useAuthStore.getState().token).toBeNull()
    })

    it('persists activeTenantId in storage', () => {
      useAuthStore.getState().setAuth(superAdmin, 'token')
      useAuthStore.getState().setActiveTenantId('tenant-B')

      const stored = sessionStorage.getItem('vuesign-auth')
      expect(stored).not.toBeNull()
      const parsed = JSON.parse(stored!)
      expect(parsed.state.activeTenantId).toBe('tenant-B')
    })
  })
})
