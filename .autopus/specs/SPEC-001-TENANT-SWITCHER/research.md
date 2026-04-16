# SPEC-001 — Research & Design Notes

## Current state of tenant resolution (verified)

### Backend — `backend/src/middleware/tenant.js:15-48`

```js
const tenantContext = (req, res, next) => {
  if (!req.user) return res.status(401)...;

  if (req.user.role === 'SUPER_ADMIN') {
    const headerTenantId = req.headers['x-tenant-id'];
    req.tenantId = headerTenantId || null;   // null = see all tenants
  } else {
    req.tenantId = req.user.tenantId;        // forced, header ignored
  }
  ...
};
```

Key insight: the header is honoured ONLY for SUPER_ADMIN. For every
other role the backend forcibly overrides `req.tenantId` from the
authenticated user's own row. This means the frontend can safely send
`X-Tenant-Id` without worrying about privilege escalation — the
middleware is the single source of truth.

`verifyTenantOwnership` (line 76-81) returns `true` whenever
`SUPER_ADMIN && !req.tenantId`, which is how "전체 업체" mode lets the
admin touch any resource.

### Backend — `backend/src/routes/tenants.js`

`GET /api/tenants` already exists and is guarded by `superAdminOnly`
middleware. No new endpoint needed.

### Frontend — `frontend/src/api/client.ts:11-17`

Only interceptor today:
```js
apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})
```

No `X-Tenant-Id` injection anywhere in the codebase. This is the gap.

### Frontend — `frontend/src/store/authStore.ts:7-32`

Uses Zustand with `persist` + `sessionStorage` (for XSS safety). The
store already exposes `setAuth`, `logout`, `updateUser`. Adding
`activeTenantId` is a minor extension that fits the existing shape.

### Frontend — `frontend/src/components/layout/Header.tsx`

The header has a clear right-hand "controls" region (connection
status, theme, notifications, user menu). Inserting the switcher at
the LEFT edge of that group — before connection status — gives it
prime real estate without disrupting the existing flow.

## Design decisions

### D1: Selector placement in header (not sidebar)

**Alternatives considered**:
- Sidebar section header → too out of the way, easy to miss.
- Floating global banner → obtrusive, steals vertical space.
- Header dropdown → matches admin-console conventions (GitHub org
  switcher, Vercel team switcher, Auth0 tenant switcher).

**Chosen**: header dropdown. Consistent with familiar patterns.

### D2: Native `<select>` vs custom dropdown

**Alternatives**:
- Custom headless dropdown → better styling, keyboard support.
- Native `<select>` → trivial a11y, smaller bundle.

**Chosen**: native `<select>` for v1. The list is short (usually
<50 tenants), and the project doesn't depend on a headless UI library
yet. Can upgrade to combobox search later if tenant counts grow.

### D3: React Query cache invalidation strategy

**Alternatives**:
- `queryClient.clear()` → nukes everything including auth-related
  caches; overkill.
- Per-query invalidation → fragile; every new query would have to
  opt-in to the tenant dependency.
- `queryClient.invalidateQueries()` without a filter → marks every
  query stale; React Query refetches only the currently-mounted ones.

**Chosen**: `invalidateQueries()` with no filter. Simple,
well-understood, matches the "everything is tenant-scoped" mental
model.

### D4: SessionStorage vs localStorage for `activeTenantId`

**Chosen**: sessionStorage (same as the auth token). Rationale:
- Tied to tab lifetime, so closing the browser resets to "전체 업체".
- Matches the security posture of the token — both cleared on logout
  or tab close.
- Avoids the surprise of "I opened a new tab and it's still scoped to
  tenant-X".

### D5: Rehydration safety for role demotion

If an admin's role is changed in the backend while a persisted
`activeTenantId` sits in the browser, the old value could linger
after the next login if we naively rehydrate. Mitigation: inside the
`persist.onRehydrateStorage` hook (or a `useEffect` in the app root),
reset `activeTenantId` to null when `user.role !== 'SUPER_ADMIN'`.

This is defence-in-depth; the backend would ignore the header anyway
for non-SUPER_ADMIN, but the UI would render stale.

## Open questions (resolved)

- **Q**: Should the switcher be visible before the tenants list has
  loaded? → **A**: Yes, render a skeleton "로딩 중..." option so the
  header height doesn't pop.
- **Q**: Include tenant plan/status in the dropdown? → **A**: Not for
  v1. Name-only keeps the width manageable.
- **Q**: Persist the tenant name alongside the ID to avoid an empty
  label during initial load? → **A**: No — React Query has a 5-minute
  staleTime, so the list will be warm on every subsequent load within
  a session. The first login shows a spinner for a fraction of a
  second, which is acceptable.

## References

- `backend/src/middleware/tenant.js` — `tenantContext`, `verifyTenantOwnership`
- `backend/src/routes/tenants.js` — `GET /api/tenants` endpoint
- `frontend/src/store/authStore.ts` — existing Zustand store shape
- `frontend/src/api/client.ts:11-17` — existing request interceptor
- `frontend/src/components/layout/Header.tsx:109-148` — right-side controls
- Phase 1 IDOR commit `3af1ea4` — security boundary that makes this
  switcher safe to ship (backend verifies every resource touch)
