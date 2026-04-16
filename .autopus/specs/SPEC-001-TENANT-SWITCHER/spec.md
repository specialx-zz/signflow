# SPEC-001: SUPER_ADMIN Tenant Switcher

- **Status**: draft
- **Created**: 2026-04-16
- **Owner**: VueSign core
- **Scope**: module-specific (signflow)
- **Related**: Phase 1 IDOR fixes (commit `3af1ea4`)

## Problem Statement

When a SUPER_ADMIN logs into VueSign, every resource list (schedules,
devices, playlists, users, ...) returns rows from ALL tenants
simultaneously. The backend behaviour is intentional — `tenantContext`
middleware treats "no `X-Tenant-Id` header" as "SUPER_ADMIN sees every
tenant" — but the frontend never sets that header AND exposes no UI to
switch contexts. The result is an unreadable, unsafe admin console:

1. **Readability**: a multi-tenant list looks like "모든 업체 스케줄이
   뒤섞여 보임". The admin cannot tell which row belongs to which
   tenant at a glance.
2. **Safety**: creating a schedule/device/user as SUPER_ADMIN assigns
   it to `req.user.tenantId` (the admin's own "default-tenant"), which
   is almost always wrong — the admin usually wants to provision the
   resource on a specific customer's tenant.
3. **Debuggability**: when a customer reports a bug, the admin has to
   visually filter noise from 40 other tenants instead of just
   scoping to the affected one.

TENANT_ADMIN and below are unaffected — `tenantContext` forces their
`tenantId` to their own row, so they never see cross-tenant data.

## Goals

- **G1**: Give SUPER_ADMIN a first-class tenant-switching control in
  the header. "전체 업체" (null) or a specific tenant, persisted
  across reloads.
- **G2**: When a tenant is selected, the frontend MUST inject
  `X-Tenant-Id: <id>` on every API request, and the backend
  middleware MUST be honoured without further changes.
- **G3**: Switching tenant MUST invalidate stale React Query caches so
  the new context loads cleanly (no ghost rows from the previous
  tenant).
- **G4**: Non-SUPER_ADMIN sessions MUST NOT render the switcher and
  MUST NOT send any `X-Tenant-Id` header (the backend would ignore it
  for TENANT_ADMIN anyway, but avoid the noise).

## Non-Goals

- Changing the backend's tenant resolution contract
  (`tenantContext` behaviour is fine).
- Multi-tenant write fan-out (creating one resource in N tenants at
  once). Out of scope.
- Impersonation / "login as user". This is a data-scope control only.
- SUPER_ADMIN provisioning: creating a new tenant remains on the
  existing `/tenants` admin pages.

## Requirements (EARS)

### Functional

- **R1**: WHEN a SUPER_ADMIN is authenticated, THE SYSTEM SHALL render
  a tenant selector in the application header.
- **R2**: WHEN a non-SUPER_ADMIN is authenticated, THE SYSTEM SHALL
  NOT render the tenant selector.
- **R3**: THE tenant selector SHALL present the options:
  `전체 업체 (ALL)` + one entry per tenant returned by `GET /api/tenants`.
- **R4**: WHEN the user selects a tenant, THE SYSTEM SHALL persist the
  selected `tenantId` in the auth store (sessionStorage, same scope
  as the auth token).
- **R5**: WHEN `activeTenantId` is set to a non-null value, THE
  axios request interceptor SHALL inject `X-Tenant-Id: <activeTenantId>`
  on every outgoing request.
- **R6**: WHEN `activeTenantId` is `null` (전체 업체), THE request
  interceptor SHALL NOT add the `X-Tenant-Id` header.
- **R7**: WHEN the active tenant changes, THE SYSTEM SHALL call
  `queryClient.invalidateQueries()` to drop all cached responses
  scoped to the previous tenant.
- **R8**: WHEN a SUPER_ADMIN logs out, THE SYSTEM SHALL clear
  `activeTenantId` from the auth store alongside the token.

### Non-Functional

- **N1**: The selector MUST render within 300 ms of header mount using
  the cached tenant list; tenant list fetch MUST use React Query with
  a 5-minute stale time (tenants rarely change).
- **N2**: The header layout MUST degrade gracefully on narrow screens
  (<768 px): the selector collapses to an icon + short label.
- **N3**: No additional requests MUST be made on tenant switch beyond
  the cache invalidation-driven refetches of the currently visible
  queries.

### Security

- **S1**: The frontend MUST NOT trust the client-side `activeTenantId`
  for authorization; it is purely a scope hint. The backend's
  `tenantContext` + `verifyTenantOwnership` remain the authoritative
  gate.
- **S2**: When a TENANT_ADMIN somehow ends up with a stored
  `activeTenantId` (e.g., role demoted between sessions), THE auth
  store rehydration SHALL discard it.

## Out-of-scope edge cases (acknowledged, deferred)

- Cross-tab synchronization of `activeTenantId` (sessionStorage is
  per-tab by design; switching in tab A does not propagate to tab B).
- Deep-linking a specific tenant via URL query parameter.
