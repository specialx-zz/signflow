# SPEC-001 — Acceptance Criteria

## Automated test scenarios

### AT-1: authStore persistence + rehydration guard

```
GIVEN a SUPER_ADMIN session with activeTenantId = 'tenant-A' persisted
WHEN  the store rehydrates AND user.role === 'SUPER_ADMIN'
THEN  activeTenantId remains 'tenant-A'

GIVEN the persisted user's role is demoted to 'TENANT_ADMIN'
WHEN  the store rehydrates
THEN  activeTenantId is reset to null
```

### AT-2: API client header injection

```
GIVEN role = SUPER_ADMIN and activeTenantId = 'tenant-A'
WHEN  any request is sent through apiClient
THEN  request headers include 'X-Tenant-Id: tenant-A'

GIVEN role = SUPER_ADMIN and activeTenantId = null
WHEN  any request is sent
THEN  no 'X-Tenant-Id' header is present

GIVEN role = TENANT_ADMIN and activeTenantId somehow = 'tenant-A'
WHEN  any request is sent
THEN  no 'X-Tenant-Id' header is present (safety belt)
```

### AT-3: TenantSwitcher role gating

```
GIVEN a TENANT_ADMIN session
WHEN  <TenantSwitcher /> is rendered
THEN  the component returns null (no DOM output)

GIVEN a SUPER_ADMIN session with tenants [A, B, C]
WHEN  <TenantSwitcher /> renders
THEN  4 options are visible: 전체 업체, A, B, C
```

### AT-4: Selection side effects

```
GIVEN a SUPER_ADMIN selecting 'tenant-B' from the switcher
WHEN  the change event fires
THEN  authStore.activeTenantId === 'tenant-B'
AND   queryClient.invalidateQueries() was called exactly once
```

## Manual verification checklist

Run against a local dev server with at least 2 seeded tenants and
resources in each.

- [ ] **M1**: Log in as SUPER_ADMIN → header shows the switcher with "전체 업체" selected by default.
- [ ] **M2**: Navigate to `/schedules` → all tenants' schedules visible.
- [ ] **M3**: Select "A 업체" in the switcher → list refetches and shows only A's schedules.
- [ ] **M4**: Reload the page → switcher still shows "A 업체" selected, list still scoped to A.
- [ ] **M5**: Create a new schedule while "A 업체" is active → the new schedule is assigned to tenant-A (verify via DB or via switching to "전체 업체" and seeing it with an A label).
- [ ] **M6**: Switch back to "전체 업체" → all schedules re-appear including the one just created.
- [ ] **M7**: Log out → session cleared. Log in as TENANT_ADMIN → switcher NOT visible in header. `/schedules` shows only that admin's tenant's schedules (unchanged baseline).
- [ ] **M8**: In DevTools Network tab while SUPER_ADMIN + "A 업체" is active, confirm every `/api/*` request has `X-Tenant-Id: <A's id>` header.
- [ ] **M9**: Switch to "전체 업체" → confirm `X-Tenant-Id` header is absent on subsequent requests.

## Negative / regression checks

- [ ] **M10**: Phase 1 regression — attempt the old `?tenantId=` playlist bypass (manually via curl). Still returns 403. (Already covered by unit tests, re-verify at integration level.)
- [ ] **M11**: TENANT_ADMIN manually injects `X-Tenant-Id: other-tenant` via DevTools → backend ignores, returns their own tenant's data. (Already guaranteed by `tenantContext` middleware.)
- [ ] **M12**: SUPER_ADMIN switches tenants rapidly 5× in 2 seconds → UI remains responsive, no stale data flash.

## Performance checks

- [ ] **P1**: First header render after login completes in under 300 ms (switcher is present but tenants may still be loading; shows a spinner state).
- [ ] **P2**: Tenants list is cached for 5 minutes; second switch does NOT trigger a new `GET /api/tenants` call (verified in Network tab).
- [ ] **P3**: Switching tenant triggers at most N+1 requests where N = number of active queries on the current page (1 for each refetch + 0 for the switcher since cache is fresh).

## Definition of Done

All of:
- Automated tests (AT-1 … AT-4) pass in CI.
- Manual checklist M1–M9 executed and checked on a dev server.
- Regression checks M10–M12 verified.
- No new ESLint warnings introduced in modified files.
- `git diff --stat` shows changes confined to the files listed in `plan.md → File Changes`.
