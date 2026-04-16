/**
 * TenantSwitcher — SUPER_ADMIN-only header control for scoping all API
 * requests to a specific tenant via X-Tenant-Id.
 *
 * SPEC-001: SUPER_ADMIN Tenant Switcher
 */
import { useCallback } from 'react'
import { Building2 } from 'lucide-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/store/authStore'
import { tenantApi } from '@/api/tenants'

export default function TenantSwitcher() {
  const user = useAuthStore((s) => s.user)
  const activeTenantId = useAuthStore((s) => s.activeTenantId)
  const setActiveTenantId = useAuthStore((s) => s.setActiveTenantId)
  const queryClient = useQueryClient()

  // Role gate: invisible for non-SUPER_ADMIN (R2)
  if (user?.role !== 'SUPER_ADMIN') return null

  const { data: tenantData, isLoading } = useQuery({
    queryKey: ['tenants-switcher'],
    queryFn: () => tenantApi.getAll({ limit: 200 }),
    staleTime: 5 * 60_000,  // N1: 5-minute cache
    refetchOnWindowFocus: false,
  })

  const tenants = tenantData?.items ?? []

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const value = e.target.value || null
      setActiveTenantId(value)
      // R7: drop all cached responses so visible queries refetch under new scope
      queryClient.invalidateQueries()
    },
    [setActiveTenantId, queryClient]
  )

  return (
    <div className="flex items-center gap-1.5">
      <Building2 className="w-4 h-4 text-indigo-500 flex-shrink-0" />
      <select
        value={activeTenantId ?? ''}
        onChange={handleChange}
        disabled={isLoading}
        className="text-xs font-medium bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-700 rounded-md px-2 py-1 max-w-[160px] truncate focus:outline-none focus:ring-2 focus:ring-indigo-400"
        title="업체 컨텍스트 전환"
      >
        <option value="">전체 업체</option>
        {isLoading && <option disabled>로딩 중...</option>}
        {tenants.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
    </div>
  )
}
