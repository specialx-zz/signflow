import { describe, it, expect } from 'vitest'
import { classifyStatus } from '@/utils/scheduleStatus'
import type { Schedule } from '@/types'

// Fixed reference date for deterministic tests: 2026-06-15
const TODAY = new Date('2026-06-15')

/** Build a minimal valid Schedule; individual tests override specific fields. */
const mk = (over: Partial<Schedule>): Schedule =>
  ({
    id: 'x',
    name: 'x',
    type: 'CONTENT',
    startDate: '2026-06-01',
    endDate: '2026-06-30',
    repeatType: 'NONE',
    status: 'DRAFT',
    isActive: true,
    createdBy: 'u1',
    devices: [],
    createdAt: '',
    updatedAt: '',
    ...over,
  }) as Schedule

describe('classifyStatus', () => {
  it('returns active when status=ACTIVE and today is within range', () => {
    const s = mk({ status: 'ACTIVE', startDate: '2026-06-01', endDate: '2026-06-30' })
    expect(classifyStatus(s, TODAY)).toBe('active')
  })

  it('returns active when status=ACTIVE, no endDate, and today >= startDate', () => {
    const s = mk({ status: 'ACTIVE', startDate: '2026-06-01', endDate: undefined })
    expect(classifyStatus(s, TODAY)).toBe('active')
  })

  it('returns upcoming when status=DRAFT even if today is in range', () => {
    const s = mk({ status: 'DRAFT', startDate: '2026-06-01', endDate: '2026-06-30' })
    expect(classifyStatus(s, TODAY)).toBe('upcoming')
  })

  it('returns upcoming when startDate is in the future', () => {
    const s = mk({ status: 'ACTIVE', startDate: '2026-07-01', endDate: '2026-07-31' })
    expect(classifyStatus(s, TODAY)).toBe('upcoming')
  })

  it('returns upcoming when status=PAUSED', () => {
    const s = mk({ status: 'PAUSED', startDate: '2026-06-01', endDate: '2026-06-30' })
    expect(classifyStatus(s, TODAY)).toBe('upcoming')
  })

  it('returns expired when endDate is in the past', () => {
    const s = mk({ status: 'DRAFT', startDate: '2026-05-01', endDate: '2026-06-10' })
    expect(classifyStatus(s, TODAY)).toBe('expired')
  })

  it('expired takes precedence over active status (ACTIVE schedule with past endDate)', () => {
    const s = mk({ status: 'ACTIVE', startDate: '2026-05-01', endDate: '2026-06-10' })
    expect(classifyStatus(s, TODAY)).toBe('expired')
  })

  it('uses current date by default (smoke test — does not throw)', () => {
    const s = mk({ status: 'ACTIVE', startDate: '2020-01-01', endDate: undefined })
    expect(['active', 'upcoming', 'expired']).toContain(classifyStatus(s))
  })
})
