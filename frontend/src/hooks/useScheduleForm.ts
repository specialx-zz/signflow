/**
 * Manages form state for schedule create / edit flows.
 * Separates form initialisation logic from SchedulesPage.
 */
import { useState } from 'react'
import { format } from 'date-fns'
import type { Schedule } from '@/types'
import type { ScheduleForm } from '@/components/schedules/ScheduleFormFields'
import { toDateStr } from '@/utils/date'

/** Returns a blank ScheduleForm pre-filled with sensible defaults. */
function makeEmptyForm(): ScheduleForm {
  return {
    name: '',
    type: 'CONTENT',
    playlistId: '',
    layoutId: '',
    startDate: format(new Date(), 'yyyy-MM-dd'),
    endDate: '',
    startTime: '00:00',
    endTime: '23:59',
    repeatType: 'NONE',
    repeatDays: [],
    deviceIds: []
  }
}

/**
 * Form state + helpers for the schedule modal.
 *
 * @returns form        - Current field values
 * @returns setForm     - Low-level state setter for controlled inputs
 * @returns sourceMode  - Whether the user is targeting a playlist or layout
 * @returns setSourceMode
 * @returns resetForm   - Resets everything back to empty defaults
 * @returns openEdit    - Populates the form from an existing Schedule record
 */
export function useScheduleForm() {
  const [form, setForm] = useState<ScheduleForm>(makeEmptyForm)
  const [sourceMode, setSourceMode] = useState<'playlist' | 'layout'>('playlist')

  /** Reset to empty state, e.g. when closing the modal. */
  const resetForm = () => {
    setForm(makeEmptyForm())
    setSourceMode('playlist')
  }

  /** Populate form from an existing schedule for the edit modal. */
  const openEdit = (schedule: Schedule) => {
    setSourceMode(schedule.layout ? 'layout' : 'playlist')
    setForm({
      name: schedule.name,
      type: schedule.type || 'CONTENT',
      playlistId: schedule.playlist?.id || '',
      layoutId: schedule.layout?.id || '',
      startDate: toDateStr(schedule.startDate),
      endDate: schedule.endDate ? toDateStr(schedule.endDate) : '',
      startTime: schedule.startTime || '00:00',
      endTime: schedule.endTime || '23:59',
      repeatType: schedule.repeatType || 'NONE',
      // repeatDays is stored as a comma-separated string on the model
      repeatDays: schedule.repeatDays ? schedule.repeatDays.split(',') : [],
      deviceIds:
        schedule.devices
          ?.map((sd) => sd.device?.id || (sd as unknown as { deviceId: string }).deviceId)
          .filter(Boolean) ?? []
    })
  }

  return { form, setForm, sourceMode, setSourceMode, resetForm, openEdit }
}
