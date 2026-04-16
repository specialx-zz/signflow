import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { User } from '@/types'

interface AuthState {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  /** SUPER_ADMIN tenant scope. null = all tenants ("전체 업체"). */
  activeTenantId: string | null
  setAuth: (user: User, token: string) => void
  logout: () => void
  updateUser: (user: Partial<User>) => void
  setActiveTenantId: (id: string | null) => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      activeTenantId: null,
      setAuth: (user, token) => set({ user, token, isAuthenticated: true }),
      logout: () => set({ user: null, token: null, isAuthenticated: false, activeTenantId: null }),
      updateUser: (updates) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...updates } : null
        })),
      setActiveTenantId: (id) => set({ activeTenantId: id }),
    }),
    {
      name: 'vuesign-auth',
      // sessionStorage: tab closes → session cleared; reduces XSS token theft window
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({
        token: state.token,
        user: state.user,
        isAuthenticated: state.isAuthenticated,
        activeTenantId: state.activeTenantId,
      }),
      // Rehydration guard: discard activeTenantId when role is not SUPER_ADMIN.
      // Covers role-demotion between sessions — the backend would ignore the
      // header anyway, but the UI would show stale switcher state.
      onRehydrateStorage: () => (state) => {
        if (state && state.user?.role !== 'SUPER_ADMIN') {
          state.activeTenantId = null
        }
      },
    }
  )
)
