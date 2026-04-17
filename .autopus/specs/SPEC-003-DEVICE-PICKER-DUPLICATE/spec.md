# SPEC-003: Device Picker + Schedule Duplication

## Status: APPROVED
## Module: signflow/frontend + signflow/backend
## Related: BS-001-SCHEDULE-UX (Ideas I2, I7)

---

## Problem Statement

Two distinct but complementary UX issues in schedule management:

1. **Device selection uses native `<select multiple>`** requiring Ctrl+click — unanimously rated 5/5 impact across all 3 perspectives (UX / Frontend / PM) in BS-001. Users cannot search, cannot see selection count, accidentally deselect devices.

2. **No schedule duplication** — "same schedule as last week but different dates" requires manual re-creation of all fields, content, and device assignments. This is the most common schedule creation pattern for retail signage.

## Goals

- **G1**: Replace native multi-select with a searchable, checkbox-based device picker showing selection count and store grouping
- **G2**: Add `POST /schedules/:id/duplicate` endpoint that deep-copies a schedule (clearing ID, status, dates) and returns the new DRAFT schedule
- **G3**: Add "복제" action to sidebar and detail modal; open the duplicated schedule in edit mode

## Non-Goals

- Pagination/infinite scroll for the device list (separate SPEC)
- Bulk device operations (assign to groups at once) — covered by simple "select all" toggle
- Automatic date offset logic (user adjusts dates in edit modal after duplication)

---

## Requirements (EARS format)

### Device Picker

**R1**: The system SHALL replace the native `<select multiple>` in `ScheduleFormFields.tsx` with a new `DevicePicker` component.

**R2**: WHEN the picker is rendered, the system SHALL display:
  - A search input filtering devices by name (case-insensitive)
  - A "전체 선택 / 전체 해제" toggle
  - A scrollable checkbox list grouping devices by store name
  - Selected devices rendered as dismissible chips above the list
  - A count badge: "N/M 선택" always visible

**R3**: WHEN a store heading is clicked, the system SHALL toggle selection of all devices in that store.

**R4**: The component SHALL accept props: `{ devices, selectedIds, onChange, error? }` where `devices` includes optional `store?: { id, name }` fields.

**R5**: WHEN devices have no store assigned, the system SHALL group them under "기타" (Other).

**R6**: The component SHALL emit `onChange(newSelectedIds)` on every mutation.

### Schedule Duplication (Backend)

**R7**: The system SHALL expose `POST /schedules/:id/duplicate` as a STORE_MANAGER+ authorized route.

**R8**: WHEN duplicating, the system SHALL:
  - Verify tenant ownership of the source schedule
  - Create a new schedule with: new ID, name = `"{original} (복사본)"`, status = `DRAFT`, all other fields copied
  - Copy all `scheduleDevice` assignments with new IDs and `PENDING` status
  - Return the new schedule with full include tree

**R9**: The system SHALL NOT copy: `id`, `status` (always DRAFT), `createdAt`, `updatedAt`.

**R10**: The `createdBy` field SHALL be set to `req.user.id` of the duplicating user.

### Schedule Duplication (Frontend)

**R11**: The system SHALL add `scheduleApi.duplicate(id)` calling the new endpoint.

**R12**: The system SHALL add a "복제" button in `ScheduleSidebar` (icon-only) and `ScheduleDetailModal` (text button in footer).

**R13**: WHEN duplication succeeds, the system SHALL open the duplicated schedule in edit mode and show a toast: "스케줄이 복제되었습니다".

**R14**: The duplication button SHALL be visible only when `canManage === true`.

---

## Security

- **S1**: Tenant ownership verified on both GET source and POST create paths
- **S2**: Authorization middleware enforces STORE_MANAGER role
- **S3**: `createdBy` taken from authenticated user, not client payload

## Performance

- **N1**: Device picker groups computation memoized with `useMemo`
- **N2**: Search input debounced via React state (no backend calls)
- **N3**: Duplication uses single transaction-like flow (create schedule, then batch insert devices)
