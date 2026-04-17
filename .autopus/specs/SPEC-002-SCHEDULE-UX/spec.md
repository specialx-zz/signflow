# SPEC-002: Schedule Management UX — Page Decomposition + Form Validation

## Status: APPROVED
## Module: signflow/frontend
## Related: BS-001-SCHEDULE-UX

---

## Problem Statement

`SchedulesPage.tsx` at 408 lines violates the project's mandatory 300-line file size limit. All modal state, mutations, queries, calendar event derivation, and sidebar rendering are packed into a single component. Additionally, the schedule form lacks client-side validation — users can create schedules with impossible date ranges, zero devices, and WEEKLY repeats without day selection.

## Goals

- **G1**: Decompose `SchedulesPage.tsx` to under 200 lines (hard limit: 300)
- **G2**: Add comprehensive form validation with inline error feedback
- **G3**: Add WEEKLY day-of-week picker (closes functional gap in `repeatDays`)
- **G4**: Extract `toDateStr` into shared utility (eliminate duplication)
- **G5**: Enable PlaylistPreview in edit modal (already built, just not wired)

## Non-Goals

- Device picker replacement (separate SPEC)
- Pagination / infinite scroll (separate SPEC)
- Sidebar search/filter (separate SPEC)
- Condition editor in edit modal (separate SPEC)

---

## Requirements (EARS format)

### Decomposition

**R1**: The system SHALL extract schedule mutations into a `useScheduleMutations` custom hook that encapsulates create/update/delete/deploy mutations with their success/error handlers.

**R2**: The system SHALL extract form state management into a `useScheduleForm` custom hook owning `form`, `setForm`, `sourceMode`, `setSourceMode`, `makeEmptyForm`, and `openEdit`.

**R3**: The system SHALL extract calendar event derivation into a `useCalendarEvents(schedules)` hook using `useMemo`.

**R4**: The system SHALL extract the sidebar schedule list into a `ScheduleSidebar` component.

**R5**: After decomposition, `SchedulesPage.tsx` SHALL NOT exceed 200 lines. No extracted file SHALL exceed 300 lines.

### Validation

**R6**: WHEN a user submits a schedule form, the system SHALL validate:
  - `name` is non-empty
  - `startDate` is set
  - `endDate` (when set) is >= `startDate`
  - When `startDate === endDate`, `endTime` > `startTime`
  - At least one device is selected
  - At least one content source (playlistId or layoutId) is selected
  - When `repeatType === 'WEEKLY'`, at least one day is selected

**R7**: WHEN validation fails, the system SHALL display inline field-level error messages and disable the submit button.

**R8**: The system SHALL implement validation as a pure function `validateScheduleForm(form): Record<string, string>` in a dedicated utility file.

### Day-of-Week Picker

**R9**: WHEN `repeatType === 'WEEKLY'`, the system SHALL render a row of 7 toggle buttons (Mon-Sun) for day selection.

**R10**: The system SHALL store selected days as a comma-separated string in `repeatDays` (e.g., `"1,3,5"` for Mon/Wed/Fri), compatible with the backend schema.

### Shared Utility

**R11**: The `toDateStr` function SHALL be extracted to `src/utils/date.ts` and imported by both `SchedulesPage` and `ScheduleDetailModal`.

### Playlist Preview

**R12**: The edit modal SHALL show `PlaylistPreview` when a playlist is selected, matching the create modal behavior.

---

## Security

- **S1**: No new API endpoints. All changes are frontend-only.
- **S2**: Validation is client-side enhancement only — backend validation remains the authoritative guard.

## Performance

- **N1**: `useCalendarEvents` uses `useMemo` to avoid re-computing on every render.
- **N2**: Validation runs synchronously on form state change — no API calls.
