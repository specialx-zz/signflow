/**
 * Converts a Schedule array into FullCalendar EventInput objects.
 * Memoised so the calendar only re-renders when the underlying data changes.
 */
import { useMemo } from 'react'
import type { Schedule } from '@/types'
import { toDateStr } from '@/utils/date'

/** Maps schedule status values to display colours. */
const SCHEDULE_COLORS: Record<string, string> = {
  ACTIVE: '#10b981',
  DRAFT: '#6b7280',
  PAUSED: '#f59e0b',
  CANCELLED: '#ef4444'
}

/**
 * Compute the day after `dateStr` (YYYY-MM-DD) as an exclusive end date
 * required by FullCalendar's all-day event model.
 */
function exclusiveEndDate(dateStr: string): string {
  try {
    const [y, m, d] = dateStr.split('-').map(Number)
    const dt = new Date(y, m - 1, d + 1)
    return [
      dt.getFullYear(),
      String(dt.getMonth() + 1).padStart(2, '0'),
      String(dt.getDate()).padStart(2, '0')
    ].join('-')
  } catch {
    return dateStr
  }
}

/**
 * Transform raw schedules into FullCalendar event objects.
 * End date is incremented by one day because FullCalendar treats `end` as exclusive.
 */
export function useCalendarEvents(schedules: Schedule[]) {
  return useMemo(
    () =>
      schedules.map((schedule) => {
        const startStr = toDateStr(schedule.startDate)
        const endStr = toDateStr(schedule.endDate || schedule.startDate)
        return {
          id: schedule.id,
          title: schedule.name,
          start: startStr,
          end: exclusiveEndDate(endStr),
          color: SCHEDULE_COLORS[schedule.status] ?? '#6b7280',
          extendedProps: { schedule }
        }
      }),
    [schedules]
  )
}
