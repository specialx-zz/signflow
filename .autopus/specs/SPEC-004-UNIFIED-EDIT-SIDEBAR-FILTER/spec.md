# SPEC-004: Unified Edit Modal + Sidebar Filter/Search

## Status: APPROVED
## Module: signflow/frontend
## Related: BS-001-SCHEDULE-UX (Ideas I4, I5)

## Problem Statement

Two UX improvements to finish the Phase C tier of BS-001:

1. **I4 — Fragmented edit workflow**: `ScheduleConditionEditor` is only accessible from the detail modal. Editing conditions requires save → close edit → open detail → edit conditions — a 3-step detour. The playlist preview and conditions belong in the edit flow.

2. **I5 — Flat sidebar**: No search, no filter, no status indication. For tenants with 20+ schedules, finding a specific one requires scrolling the entire list. Users cannot see at a glance which schedules are currently active vs upcoming vs expired.

## Goals

- **G1**: Convert the edit modal into a tabbed layout (기본 설정 / 조건부 재생) with the condition editor embedded
- **G2**: Add client-side search input to the sidebar (filters by schedule name)
- **G3**: Add filter chips for status (전체 / 활성 / 예정 / 만료)
- **G4**: Add status dot + device count + source label to each sidebar card
- **G5**: Show "N / M 표시" indicator when filtering

## Non-Goals

- Server-side filter/pagination (separate SPEC)
- Advanced filters like creator/store/date-range
- Condition editor in create modal (requires scheduleId which doesn't exist yet)

---

## Requirements (EARS format)

### Unified Edit Modal

**R1**: The edit modal SHALL render a tab header with two tabs: "기본 설정" (basic settings) and "조건부 재생" (conditions).

**R2**: WHEN the "기본 설정" tab is active, the system SHALL show the existing `ScheduleFormFields` component.

**R3**: WHEN the "조건부 재생" tab is active, the system SHALL show the `ScheduleConditionEditor` mounted with `scheduleId = editTarget.id` and `playlists = playlistItems`.

**R4**: The tab state SHALL reset to "기본 설정" each time the edit modal opens.

**R5**: The condition editor tab SHALL pass `defaultPlaylistId` and `defaultPlaylistName` from the editTarget so no-op condition warnings work.

### Schedule Status Classification

**R6**: The system SHALL classify each schedule into one of three runtime categories based on `status` and dates:
  - **active**: status === 'ACTIVE' AND today is within [startDate, endDate]
  - **upcoming**: status === 'DRAFT' OR startDate > today
  - **expired**: endDate exists AND endDate < today

**R7**: The system SHALL render a status dot colored accordingly (green/blue/gray) on each sidebar card.

### Sidebar Search/Filter

**R8**: The sidebar SHALL render a search input filtering schedules by `name` (case-insensitive, client-side).

**R9**: The sidebar SHALL render 4 filter chips: 전체, 활성, 예정, 만료. Clicking sets the active filter; only matching schedules are shown.

**R10**: WHEN filters are applied, the sidebar heading SHALL show "스케줄 목록 (N / M)" where N is filtered count and M is total.

**R11**: WHEN the filtered result is empty but the full list is not, the empty state SHALL show: "검색 결과가 없습니다" instead of "스케줄이 없습니다".

**R12**: Each sidebar card SHALL display the device count: "장치 N개".

## Non-Functional

- **N1**: Sidebar filter/search uses `useMemo` for performance
- **N2**: Status classification is a pure function in `src/utils/scheduleStatus.ts`
- **N3**: ScheduleSidebar must remain under 200 lines (add search/filter as internal state)
