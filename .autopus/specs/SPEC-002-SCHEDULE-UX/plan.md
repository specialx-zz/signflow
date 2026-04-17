# SPEC-002 Implementation Plan

## Architecture

```
SchedulesPage.tsx (~180 lines)        ← composition root
├── hooks/useScheduleMutations.ts     ← 4 mutations + handlers
├── hooks/useScheduleForm.ts          ← form state + sourceMode + openEdit
├── hooks/useCalendarEvents.ts        ← useMemo calendar event derivation
├── ScheduleSidebar.tsx               ← sidebar list component
├── ScheduleFormFields.tsx            ← + validation errors display + DayOfWeekPicker
├── DayOfWeekPicker.tsx               ← WEEKLY day selection toggle
├── utils/scheduleValidation.ts       ← pure validateScheduleForm()
└── utils/date.ts                     ← shared toDateStr()
```

## File Changes

| File | Action | Lines (est.) |
|------|--------|-------------|
| `src/utils/date.ts` | CREATE | ~10 |
| `src/utils/scheduleValidation.ts` | CREATE | ~45 |
| `src/components/schedules/DayOfWeekPicker.tsx` | CREATE | ~50 |
| `src/hooks/useScheduleMutations.ts` | CREATE | ~80 |
| `src/hooks/useScheduleForm.ts` | CREATE | ~60 |
| `src/hooks/useCalendarEvents.ts` | CREATE | ~35 |
| `src/components/schedules/ScheduleSidebar.tsx` | CREATE | ~75 |
| `src/pages/SchedulesPage.tsx` | REWRITE | 408→~180 |
| `src/components/schedules/ScheduleFormFields.tsx` | MODIFY | 200→~220 |
| `src/components/schedules/ScheduleDetailModal.tsx` | MODIFY | import toDateStr from utils |

## Implementation Phases

### Phase A: Shared Utilities (R4, R8, R11)
1. Create `src/utils/date.ts` with `toDateStr`
2. Create `src/utils/scheduleValidation.ts` with `validateScheduleForm`
3. Update imports in ScheduleDetailModal

### Phase B: DayOfWeekPicker (R9, R10)
1. Create `DayOfWeekPicker.tsx` component
2. Add `repeatDays` to `ScheduleForm` interface
3. Wire into ScheduleFormFields conditionally on WEEKLY

### Phase C: Hook Extraction (R1, R2, R3)
1. Create `useScheduleMutations` hook
2. Create `useScheduleForm` hook
3. Create `useCalendarEvents` hook

### Phase D: Component Extraction (R4, R5)
1. Create `ScheduleSidebar` component
2. Rewrite `SchedulesPage.tsx` as composition root

### Phase E: Validation Integration (R6, R7, R12)
1. Wire validation into form submit handlers
2. Display inline errors in ScheduleFormFields
3. Enable PlaylistPreview in edit modal

### Phase F: Verification
1. Run existing tests
2. Verify all files under 300 lines
3. Manual smoke test checklist
