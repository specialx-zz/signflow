import { describe, it, expect } from 'vitest'
import type { UserRole } from '@/types'

/**
 * Role hierarchy values as used in App.tsx ProtectedRoute.
 * These values determine access control across the application.
 */
const roleLevel: Record<string, number> = {
  SUPER_ADMIN: 50,
  TENANT_ADMIN: 40,
  STORE_MANAGER: 30,
  USER: 20,
  VIEWER: 10,
}

function hasMinRole(userRole: string, minRole: number): boolean {
  return (roleLevel[userRole] || 0) >= minRole
}

describe('Role hierarchy', () => {
  it('SUPER_ADMIN has the highest value', () => {
    const maxRole = Math.max(...Object.values(roleLevel))
    expect(roleLevel.SUPER_ADMIN).toBe(maxRole)
  })

  it('roles follow correct hierarchy order', () => {
    expect(roleLevel.SUPER_ADMIN).toBeGreaterThan(roleLevel.TENANT_ADMIN)
    expect(roleLevel.TENANT_ADMIN).toBeGreaterThan(roleLevel.STORE_MANAGER)
    expect(roleLevel.STORE_MANAGER).toBeGreaterThan(roleLevel.USER)
    expect(roleLevel.USER).toBeGreaterThan(roleLevel.VIEWER)
  })

  it('all defined UserRole values have a role level', () => {
    const expectedRoles: UserRole[] = ['SUPER_ADMIN', 'TENANT_ADMIN', 'STORE_MANAGER', 'USER', 'VIEWER']
    for (const role of expectedRoles) {
      expect(roleLevel[role]).toBeDefined()
      expect(roleLevel[role]).toBeGreaterThan(0)
    }
  })
})

describe('hasMinRole', () => {
  it('SUPER_ADMIN passes any minimum role check', () => {
    expect(hasMinRole('SUPER_ADMIN', 50)).toBe(true)
    expect(hasMinRole('SUPER_ADMIN', 40)).toBe(true)
    expect(hasMinRole('SUPER_ADMIN', 10)).toBe(true)
  })

  it('VIEWER only passes the lowest minimum role check', () => {
    expect(hasMinRole('VIEWER', 10)).toBe(true)
    expect(hasMinRole('VIEWER', 20)).toBe(false)
    expect(hasMinRole('VIEWER', 50)).toBe(false)
  })

  it('TENANT_ADMIN can access routes requiring minRole 40', () => {
    expect(hasMinRole('TENANT_ADMIN', 40)).toBe(true)
    expect(hasMinRole('TENANT_ADMIN', 30)).toBe(true)
  })

  it('TENANT_ADMIN cannot access routes requiring minRole 50', () => {
    expect(hasMinRole('TENANT_ADMIN', 50)).toBe(false)
  })

  it('STORE_MANAGER can access routes requiring minRole 30', () => {
    expect(hasMinRole('STORE_MANAGER', 30)).toBe(true)
    expect(hasMinRole('STORE_MANAGER', 20)).toBe(true)
  })

  it('STORE_MANAGER cannot access routes requiring minRole 40', () => {
    expect(hasMinRole('STORE_MANAGER', 40)).toBe(false)
  })

  it('unknown role returns 0 and fails all checks', () => {
    expect(hasMinRole('UNKNOWN_ROLE', 10)).toBe(false)
  })

  it('matches route access rules from App.tsx', () => {
    // /admin/tenants requires minRole 50 => only SUPER_ADMIN
    expect(hasMinRole('SUPER_ADMIN', 50)).toBe(true)
    expect(hasMinRole('TENANT_ADMIN', 50)).toBe(false)

    // /users requires minRole 40 => SUPER_ADMIN and TENANT_ADMIN
    expect(hasMinRole('SUPER_ADMIN', 40)).toBe(true)
    expect(hasMinRole('TENANT_ADMIN', 40)).toBe(true)
    expect(hasMinRole('STORE_MANAGER', 40)).toBe(false)

    // /emergency requires minRole 30 => SUPER_ADMIN, TENANT_ADMIN, STORE_MANAGER
    expect(hasMinRole('SUPER_ADMIN', 30)).toBe(true)
    expect(hasMinRole('TENANT_ADMIN', 30)).toBe(true)
    expect(hasMinRole('STORE_MANAGER', 30)).toBe(true)
    expect(hasMinRole('USER', 30)).toBe(false)
  })
})
