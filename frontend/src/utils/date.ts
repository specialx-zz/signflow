/**
 * Safe date utilities — guards against Invalid Date crashes.
 * Use these instead of calling new Date(field) or format(field) directly.
 */
import { format as dfFormat, isValid, parseISO } from 'date-fns'

/**
 * Extract YYYY-MM-DD from an ISO datetime string without timezone conversion.
 * Returns empty string for falsy input, slices the first 10 chars otherwise.
 */
export function toDateStr(dateVal: string): string {
  if (!dateVal) return ''
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateVal)) return dateVal
  return dateVal.slice(0, 10)
}

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
