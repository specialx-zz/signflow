// Utility for classifying a schedule's runtime state based on status and date window.
import { toDateStr } from '@/utils/date'
import type { Schedule } from '@/types'

export type ScheduleRuntimeStatus = 'active' | 'upcoming' | 'expired'

/**
 * Classify a schedule's runtime state based on status + date window.
 *
 * Rules:
 * - 'expired' if endDate is set AND endDate < today
 * - 'active' if status === 'ACTIVE' AND today is within [startDate, endDate||infinity]
 * - 'upcoming' otherwise (DRAFT, PAUSED, or future startDate)
 */
export function classifyStatus(
  schedule: Schedule,
  today: Date = new Date()
): ScheduleRuntimeStatus {
  // Normalize today to YYYY-MM-DD for lexicographic comparison
  const todayStr = toDateStr(today.toISOString())
  const startStr = schedule.startDate ? toDateStr(schedule.startDate) : ''
  const endStr = schedule.endDate ? toDateStr(schedule.endDate) : ''

  // Expired: endDate exists and is strictly before today
  if (endStr && endStr < todayStr) {
    return 'expired'
  }

  // Active: status is ACTIVE, startDate <= today, and (no endDate OR endDate >= today)
  if (
    schedule.status === 'ACTIVE' &&
    startStr <= todayStr &&
    (!endStr || endStr >= todayStr)
  ) {
    return 'active'
  }

  // Default: upcoming (DRAFT, PAUSED, future startDate, etc.)
  return 'upcoming'
}

/** Korean label for each runtime status. */
export const STATUS_LABELS: Record<ScheduleRuntimeStatus, string> = {
  active: '활성',
  upcoming: '예정',
  expired: '만료',
}

/** Tailwind color class for the status dot. */
export const STATUS_DOT_CLASS: Record<ScheduleRuntimeStatus, string> = {
  active: 'bg-green-500',
  upcoming: 'bg-blue-500',
  expired: 'bg-gray-400',
}
