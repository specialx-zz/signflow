/**
 * Pure validation for the schedule creation / edit form.
 * Returns a map of field-key → error message; empty map means valid.
 */
import type { ScheduleForm } from '@/components/schedules/ScheduleFormFields'

/**
 * Validate all fields of a ScheduleForm.
 *
 * @param form - Current form values
 * @returns Record mapping error keys to Korean error messages.
 *          An empty object means the form is valid.
 */
export function validateScheduleForm(form: ScheduleForm): Record<string, string> {
  const errors: Record<string, string> = {}

  // Name is required
  if (!form.name.trim()) {
    errors.name = '스케줄 이름을 입력해주세요'
  }

  // Start date is required
  if (!form.startDate) {
    errors.startDate = '시작일을 선택해주세요'
  }

  // End date must not precede start date
  if (form.endDate && form.startDate && form.endDate < form.startDate) {
    errors.endDate = '종료일은 시작일 이후여야 합니다'
  }

  // On a single-day schedule, end time must be after start time
  if (
    form.startDate &&
    form.endDate &&
    form.startDate === form.endDate &&
    form.startTime &&
    form.endTime &&
    form.endTime <= form.startTime
  ) {
    errors.endTime = '종료 시간은 시작 시간 이후여야 합니다'
  }

  // At least one content source (playlist or layout) must be selected
  if (!form.playlistId && !form.layoutId) {
    errors.content = '플레이리스트 또는 레이아웃을 선택해주세요'
  }

  // At least one device must be assigned
  if (!form.deviceIds || form.deviceIds.length === 0) {
    errors.deviceIds = '최소 1개 장치를 선택해주세요'
  }

  // Weekly repeat requires at least one day selected
  if (form.repeatType === 'WEEKLY' && (!form.repeatDays || form.repeatDays.length === 0)) {
    errors.repeatDays = '반복할 요일을 선택해주세요'
  }

  return errors
}
