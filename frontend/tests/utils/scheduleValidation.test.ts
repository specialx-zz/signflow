import { describe, it, expect } from 'vitest'
import { validateScheduleForm } from '@/utils/scheduleValidation'
import type { ScheduleForm } from '@/components/schedules/ScheduleFormFields'

/** Build a fully-valid base form; individual tests override specific fields. */
const validForm = (): ScheduleForm => ({
  name: 'Test Schedule',
  type: 'CONTENT',
  playlistId: 'pl-1',
  layoutId: '',
  startDate: '2026-04-16',
  endDate: '2026-04-20',
  startTime: '09:00',
  endTime: '18:00',
  repeatType: 'NONE',
  repeatDays: [],
  deviceIds: ['dev-1'],
})

describe('validateScheduleForm', () => {
  // ── Name ──────────────────────────────────────────────────────────────
  it('returns empty errors for a fully valid form', () => {
    const errors = validateScheduleForm(validForm())
    expect(errors).toEqual({})
  })

  it('sets errors.name when name is empty', () => {
    const errors = validateScheduleForm({ ...validForm(), name: '' })
    expect(errors.name).toBeTruthy()
  })

  it('sets errors.name when name is only whitespace', () => {
    const errors = validateScheduleForm({ ...validForm(), name: '   ' })
    expect(errors.name).toBeTruthy()
  })

  it('does not set errors.name when name has a non-empty value', () => {
    const errors = validateScheduleForm({ ...validForm(), name: 'My Schedule' })
    expect(errors.name).toBeUndefined()
  })

  // ── Start date ────────────────────────────────────────────────────────
  it('sets errors.startDate when startDate is empty', () => {
    const errors = validateScheduleForm({ ...validForm(), startDate: '' })
    expect(errors.startDate).toBeTruthy()
  })

  it('does not set errors.startDate when startDate is provided', () => {
    const errors = validateScheduleForm(validForm())
    expect(errors.startDate).toBeUndefined()
  })

  // ── End date ──────────────────────────────────────────────────────────
  it('sets errors.endDate when endDate is before startDate', () => {
    const errors = validateScheduleForm({
      ...validForm(),
      startDate: '2026-04-20',
      endDate: '2026-04-15',
    })
    expect(errors.endDate).toBeTruthy()
  })

  it('does not set errors.endDate when endDate equals startDate', () => {
    const errors = validateScheduleForm({
      ...validForm(),
      startDate: '2026-04-16',
      endDate: '2026-04-16',
      startTime: '08:00',
      endTime: '09:00',
    })
    expect(errors.endDate).toBeUndefined()
  })

  it('does not set errors.endDate when endDate is after startDate', () => {
    const errors = validateScheduleForm(validForm())
    expect(errors.endDate).toBeUndefined()
  })

  // ── End time (same-day schedule) ──────────────────────────────────────
  it('sets errors.endTime when same-day schedule has endTime <= startTime', () => {
    const errors = validateScheduleForm({
      ...validForm(),
      startDate: '2026-04-16',
      endDate: '2026-04-16',
      startTime: '10:00',
      endTime: '10:00', // equal — not strictly after
    })
    expect(errors.endTime).toBeTruthy()
  })

  it('sets errors.endTime when same-day schedule has endTime before startTime', () => {
    const errors = validateScheduleForm({
      ...validForm(),
      startDate: '2026-04-16',
      endDate: '2026-04-16',
      startTime: '14:00',
      endTime: '09:00',
    })
    expect(errors.endTime).toBeTruthy()
  })

  it('does not set errors.endTime when same-day schedule has endTime after startTime', () => {
    const errors = validateScheduleForm({
      ...validForm(),
      startDate: '2026-04-16',
      endDate: '2026-04-16',
      startTime: '09:00',
      endTime: '18:00',
    })
    expect(errors.endTime).toBeUndefined()
  })

  it('does not set errors.endTime when dates differ even if endTime <= startTime', () => {
    // Time comparison only applies to same-day schedules
    const errors = validateScheduleForm({
      ...validForm(),
      startDate: '2026-04-16',
      endDate: '2026-04-17',
      startTime: '18:00',
      endTime: '09:00',
    })
    expect(errors.endTime).toBeUndefined()
  })

  // ── Content source ────────────────────────────────────────────────────
  it('sets errors.content when both playlistId and layoutId are empty', () => {
    const errors = validateScheduleForm({
      ...validForm(),
      playlistId: '',
      layoutId: '',
    })
    expect(errors.content).toBeTruthy()
  })

  it('does not set errors.content when playlistId is provided', () => {
    const errors = validateScheduleForm({ ...validForm(), playlistId: 'pl-1', layoutId: '' })
    expect(errors.content).toBeUndefined()
  })

  it('does not set errors.content when layoutId is provided', () => {
    const errors = validateScheduleForm({ ...validForm(), playlistId: '', layoutId: 'ly-1' })
    expect(errors.content).toBeUndefined()
  })

  // ── Device selection ──────────────────────────────────────────────────
  it('sets errors.deviceIds when deviceIds array is empty', () => {
    const errors = validateScheduleForm({ ...validForm(), deviceIds: [] })
    expect(errors.deviceIds).toBeTruthy()
  })

  it('does not set errors.deviceIds when at least one device is selected', () => {
    const errors = validateScheduleForm({ ...validForm(), deviceIds: ['dev-1'] })
    expect(errors.deviceIds).toBeUndefined()
  })

  // ── Weekly repeat days ────────────────────────────────────────────────
  it('sets errors.repeatDays for WEEKLY repeatType with no days selected', () => {
    const errors = validateScheduleForm({
      ...validForm(),
      repeatType: 'WEEKLY',
      repeatDays: [],
    })
    expect(errors.repeatDays).toBeTruthy()
  })

  it('does not set errors.repeatDays for WEEKLY repeatType with days selected', () => {
    const errors = validateScheduleForm({
      ...validForm(),
      repeatType: 'WEEKLY',
      repeatDays: ['1', '3'],
    })
    expect(errors.repeatDays).toBeUndefined()
  })

  it('does not set errors.repeatDays for DAILY repeatType with no days selected', () => {
    const errors = validateScheduleForm({
      ...validForm(),
      repeatType: 'DAILY',
      repeatDays: [],
    })
    expect(errors.repeatDays).toBeUndefined()
  })

  it('does not set errors.repeatDays for NONE repeatType with no days selected', () => {
    const errors = validateScheduleForm({
      ...validForm(),
      repeatType: 'NONE',
      repeatDays: [],
    })
    expect(errors.repeatDays).toBeUndefined()
  })
})
