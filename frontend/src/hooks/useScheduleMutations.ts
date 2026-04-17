/**
 * Encapsulates all schedule-related React Query mutations so SchedulesPage
 * does not need to declare them inline.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { scheduleApi } from '@/api/schedules'
import type { Schedule } from '@/types'
import toast from 'react-hot-toast'

interface ConflictInfo {
  message: string
  conflicts: { scheduleName: string; deviceName: string; timeRange: string }[]
}

export interface MutationCallbacks {
  onCreateSuccess: () => void
  onUpdateSuccess: () => void
  onDeleteSuccess: () => void
  onDeploySuccess: () => void
  /** Called with the new schedule after a successful duplicate. */
  onDuplicateSuccess: (newSchedule: Schedule) => void
  /** Called when the server responds with a 409 deploy conflict. */
  onDeployConflict: (info: ConflictInfo) => void
}

/**
 * Returns create, update, delete, and deploy mutations wired to the
 * 'schedules' query cache and the provided UI callbacks.
 */
export function useScheduleMutations(callbacks: MutationCallbacks) {
  const queryClient = useQueryClient()

  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => scheduleApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedules'] })
      callbacks.onCreateSuccess()
      toast.success('스케줄이 생성되었습니다')
    },
    onError: () => toast.error('생성에 실패했습니다')
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      scheduleApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedules'] })
      callbacks.onUpdateSuccess()
      toast.success('스케줄이 수정되었습니다')
    },
    onError: () => toast.error('수정에 실패했습니다')
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => scheduleApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedules'] })
      callbacks.onDeleteSuccess()
      toast.success('스케줄이 삭제되었습니다')
    },
    onError: () => toast.error('삭제에 실패했습니다')
  })

  const deployMutation = useMutation({
    mutationFn: ({ id, force }: { id: string; force?: boolean }) =>
      scheduleApi.deploy(id, force),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedules'] })
      callbacks.onDeploySuccess()
      toast.success('배포가 시작되었습니다')
    },
    onError: (error: unknown) => {
      // Detect conflict responses — backend returns conflicts array in body
      const axiosError = error as {
        response?: { data?: { message?: string; conflicts?: ConflictInfo['conflicts'] } }
      }
      const data = axiosError?.response?.data
      if (data?.conflicts) {
        callbacks.onDeployConflict({
          message: data.message ?? '스케줄 충돌이 발생했습니다',
          conflicts: data.conflicts,
        })
      } else {
        toast.error('배포에 실패했습니다')
      }
    }
  })

  const duplicateMutation = useMutation({
    mutationFn: (id: string) => scheduleApi.duplicate(id) as Promise<Schedule>,
    onSuccess: (newSchedule: Schedule) => {
      queryClient.invalidateQueries({ queryKey: ['schedules'] })
      callbacks.onDuplicateSuccess(newSchedule)
      toast.success('스케줄이 복제되었습니다')
    },
    onError: () => toast.error('복제에 실패했습니다')
  })

  return { createMutation, updateMutation, deleteMutation, deployMutation, duplicateMutation }
}
