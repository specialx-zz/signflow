# SPEC-001 — Implementation Plan

## Architecture Overview

```
┌─────────────────────────────┐         ┌──────────────────────┐
│ Header.tsx                  │         │ authStore (Zustand)  │
│  └─ TenantSwitcher.tsx ─────┼─ sets ─▶│  activeTenantId      │
│     (SUPER_ADMIN only)      │         │  setActiveTenantId() │
└─────────────────────────────┘         └──────────┬───────────┘
                                                    │ read
                                                    ▼
                                        ┌─────────────────────────┐
                                        │ api/client.ts           │
                                        │  request interceptor    │
                                        │  injects X-Tenant-Id    │
                                        └──────────┬──────────────┘
                                                   ▼
                                       backend tenantContext
                                       (no changes needed)
```

Data flow for switching:

```
user clicks new tenant in select
  → authStore.setActiveTenantId(newId)
  → useEffect in TenantSwitcher: queryClient.invalidateQueries()
  → visible pages refetch with new X-Tenant-Id
  → lists re-render scoped to that tenant
```

## File Changes

### New files

| File | Purpose |
|------|---------|
| `frontend/src/api/tenants.ts` | Typed wrapper around `GET /api/tenants` for the switcher dropdown |
| `frontend/src/components/layout/TenantSwitcher.tsx` | SUPER_ADMIN-only dropdown rendered in `Header.tsx` |
| `frontend/src/components/layout/__tests__/TenantSwitcher.test.tsx` | Unit tests: role gating, selection → store update → invalidateQueries |

### Modified files

| File | Change |
|------|--------|
| `frontend/src/store/authStore.ts` | Add `activeTenantId: string \| null`, `setActiveTenantId(id)`. Persist under same sessionStorage key. Clear on `logout()`. Rehydration: if role !== SUPER_ADMIN, force `activeTenantId = null`. |
| `frontend/src/api/client.ts` | Request interceptor: read `activeTenantId` from auth store; if set AND user is SUPER_ADMIN, set `config.headers['X-Tenant-Id']`. |
| `frontend/src/components/layout/Header.tsx` | Mount `<TenantSwitcher />` to the left of NotificationCenter when `user.role === 'SUPER_ADMIN'`. |
| `frontend/src/types/index.ts` | Add `Tenant` interface (id, name, slug, plan...) if not already present. |

### Not touched

- Any backend files. The security boundary is already in place.
- TENANT_ADMIN / USER / STORE_MANAGER code paths.

## Implementation Phases

### Phase A — Store wiring (no UI yet)

1. Extend `AuthState` with `activeTenantId` and `setActiveTenantId`.
2. Update `partialize` to persist the new field.
3. Add rehydration guard: on store init, if `user.role !== 'SUPER_ADMIN'`, reset `activeTenantId = null`.
4. Unit test the store: set/get, role demotion reset, logout clear.

**Deliverable**: store tests green, no UI change visible.

### Phase B — API client injection

1. Import auth store into `api/client.ts`.
2. In request interceptor, read `state.activeTenantId` and `state.user?.role`.
3. Inject `X-Tenant-Id` only when both conditions hold.
4. Add unit test: intercept a fake request, verify header presence under each role × activeTenantId combo.

**Deliverable**: interceptor tests green. Because no UI yet sets
`activeTenantId`, runtime behaviour is unchanged.

### Phase C — API wrapper for tenants

1. Create `frontend/src/api/tenants.ts` exporting `tenantsApi.list()` that calls `GET /api/tenants`.
2. Add `Tenant` type to `types/index.ts`.

### Phase D — TenantSwitcher component

1. Build `TenantSwitcher.tsx`:
   - `useAuthStore` for `user`, `activeTenantId`, `setActiveTenantId`.
   - Early return `null` if `user.role !== 'SUPER_ADMIN'`.
   - `useQuery(['tenants'], tenantsApi.list, { staleTime: 5 * 60_000 })`.
   - Render a native `<select>` with options: `ALL` + tenant list.
   - On change: `setActiveTenantId(newValue)` then `queryClient.invalidateQueries()`.
   - Display the active tenant's name in the trigger (or "전체 업체").
   - Mobile: show a building icon + truncated label on narrow screens.
2. Tests:
   - Non-SUPER_ADMIN → component returns null.
   - SUPER_ADMIN + loaded tenants → all options render.
   - Changing selection → store updated + `invalidateQueries` called.

### Phase E — Mount in Header

1. Import `TenantSwitcher` in `Header.tsx`.
2. Place it to the left of the connection-status indicator (i.e., at
   the start of the right-side group) so the switcher is the most
   prominent control for admins.
3. Snapshot/visual test for the new layout.

### Phase F — Manual verification

Run through the Acceptance checklist in `acceptance.md` against a
local dev server with seeded multi-tenant data.

## Rollout / Risk

- **Reversibility**: trivial — the feature is purely additive client-side. Rolling back = remove the component import + interceptor line.
- **Blast radius**: zero backend impact. If the interceptor malfunctions (e.g., sends header with wrong role), the backend's `tenantContext` still safely routes — non-SUPER_ADMIN requests ignore the header.
- **Migration**: none. Existing SUPER_ADMIN sessions get `activeTenantId = null` (전체 업체) by default, preserving current behaviour until they actively select a tenant.

## Dependencies

None outside the frontend package (React Query and Zustand already in
use).
