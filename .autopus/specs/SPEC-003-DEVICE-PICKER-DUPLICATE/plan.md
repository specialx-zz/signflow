# SPEC-003 Implementation Plan

## File Changes

| File | Action | Lines (est.) |
|------|--------|-------------|
| `backend/src/controllers/scheduleController.js` | MODIFY | +40 (duplicate handler) |
| `backend/src/routes/schedules.js` | MODIFY | +1 route |
| `backend/tests/unit/controllers/scheduleController.duplicate.test.js` | CREATE | ~120 |
| `frontend/src/api/schedules.ts` | MODIFY | +4 (duplicate method) |
| `frontend/src/components/schedules/DevicePicker.tsx` | CREATE | ~180 |
| `frontend/src/components/schedules/ScheduleFormFields.tsx` | MODIFY | swap device select |
| `frontend/src/components/schedules/ScheduleSidebar.tsx` | MODIFY | +복제 button |
| `frontend/src/components/schedules/ScheduleDetailModal.tsx` | MODIFY | +복제 button |
| `frontend/src/pages/SchedulesPage.tsx` | MODIFY | +duplicate handler |
| `frontend/src/hooks/useScheduleMutations.ts` | MODIFY | +duplicate mutation |
| `frontend/tests/components/schedules/DevicePicker.test.tsx` | CREATE | ~150 |

## Implementation Phases

### Phase A: Backend Duplicate Endpoint
1. Add `duplicateSchedule` controller in `scheduleController.js`
2. Register route in `schedules.js`
3. Write integration test covering ownership + copy

### Phase B: Frontend API Client
1. Add `duplicate` method to `scheduleApi`
2. Add `duplicateMutation` to `useScheduleMutations`

### Phase C: DevicePicker Component
1. Create `DevicePicker.tsx` with search, groups, chips, count badge
2. Write component tests
3. Replace native select in `ScheduleFormFields.tsx`

### Phase D: Duplicate UI
1. Add 복제 button to sidebar (icon)
2. Add 복제 button to detail modal (text)
3. Wire handler in SchedulesPage

### Phase E: Verification
1. TypeScript + Vitest + Jest all pass
2. All files under 300 lines

## Architecture Notes

The DevicePicker internally tracks UI state (search query, which store headers are collapsed) but exposes only `selectedIds` via onChange. This keeps it drop-in compatible with the current form pattern.

The duplicate endpoint uses a simple two-step flow (create schedule, batch insert devices) rather than Prisma transactions because the scheduleController already follows this pattern for create.
