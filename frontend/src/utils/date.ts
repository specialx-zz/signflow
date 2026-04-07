/**
 * Safe date utilities — guards against Invalid Date crashes.
 * Use these instead of calling new Date(field) or format(field) directly.
 */
import { format as dfFormat, isValid, parseISO } from 'date-fns'

/**
 * Parse a value to a valid Date, or return null if invalid.
 */
export function safeDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null
  const d = value instanceof Date ? value : parseISO(String(value))
  return isValid(d) ? d : null
}

/**
 * Format a date value using date-fns format.
 * Returns fallback string (default '-') if the date is invalid.
 */
export function safeFormat(
  value: string | Date | null | undefined,
  fmt: string,
  fallback = '-'
): string {
  const d = safeDate(value)
  if (!d) return fallback
  try {
    return dfFormat(d, fmt)
  } catch {
    return fallback
  }
}
