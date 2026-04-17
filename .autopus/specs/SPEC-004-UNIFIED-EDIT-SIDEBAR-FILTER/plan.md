# SPEC-004 Implementation Plan

## File Changes

| File | Action | Lines |
|------|--------|-------|
| `src/utils/scheduleStatus.ts` | CREATE | ~35 |
| `src/components/schedules/EditScheduleModal.tsx` | CREATE | ~120 (tabbed modal wrapper) |
| `src/components/schedules/ScheduleSidebar.tsx` | MODIFY | 98 → ~180 (search + filter) |
| `src/pages/SchedulesPage.tsx` | MODIFY | swap inline edit modal → `<EditScheduleModal>` |
| `tests/utils/scheduleStatus.test.ts` | CREATE | ~90 |
| `tests/components/schedules/ScheduleSidebar.test.tsx` | CREATE | ~150 |

## Phases

### Phase A: Status utility
1. Create `scheduleStatus.ts` with `classifyStatus(schedule, today?)` returning `'active' | 'upcoming' | 'expired'`
2. Write unit tests

### Phase B: Sidebar search/filter
1. Add internal state (`query`, `filter`) to `ScheduleSidebar`
2. Compute filtered list via `useMemo`
3. Render search input + filter chips + count badge
4. Add status dot + device count to each card
5. Write component tests

### Phase C: Tabbed edit modal
1. Extract edit modal from `SchedulesPage` into `EditScheduleModal.tsx`
2. Add tab state (`'basic' | 'conditions'`)
3. Mount `ScheduleConditionEditor` in the conditions tab
4. Reset tab to 'basic' when modal opens

### Phase D: Wire + verify
1. Replace inline edit modal in `SchedulesPage` with `<EditScheduleModal>`
2. Run tsc + vitest + build
