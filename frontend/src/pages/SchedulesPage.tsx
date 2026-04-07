import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import { Plus, Calendar, Pencil, Trash2, Send } from 'lucide-react'
import { scheduleApi } from '@/api/schedules'
import { playlistApi } from '@/api/playlists'
import { deviceApi } from '@/api/devices'
import { layoutApi } from '@/api/layouts'
import { Schedule } from '@/types'
import StatusBadge from '@/components/ui/StatusBadge'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import Modal from '@/components/ui/Modal'
import { PageLoader } from '@/components/ui/LoadingSpinner'
import { useAuthStore } from '@/store/authStore'
import toast from 'react-hot-toast'
import { format } from 'date-fns'

import ScheduleFormFields, { type ScheduleForm } from '@/components/schedules/ScheduleFormFields'
import ScheduleDetailModal from '@/components/schedules/ScheduleDetailModal'
import ScheduleConflictDialog, { type ConflictInfo } from '@/components/schedules/ScheduleConflictDialog'
import ContentPreviewOverlay from '@/components/schedules/ContentPreviewOverlay'
import type { ContentPreview } from '@/components/schedules/ContentThumb'

const SCHEDULE_COLORS: Record<string, string> = {
  ACTIVE: '#10b981',
  DRAFT: '#6b7280',
  PAUSED: '#f59e0b',
  CANCELLED: '#ef4444'
}

/** Extract YYYY-MM-DD from an ISO datetime string without timezone conversion */
function toDateStr(dateVal: string): string {
  if (!dateVal) return ''
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateVal)) return dateVal
  return dateVal.slice(0, 10)
}

const makeEmptyForm = (): ScheduleForm => ({
  name: '',
  type: 'CONTENT',
  playlistId: '',
  layoutId: '',
  startDate: format(new Date(), 'yyyy-MM-dd'),
  endDate: '',
  startTime: '00:00',
  endTime: '23:59',
  repeatType: 'NONE',
  deviceIds: []
})

export default function SchedulesPage() {
  const queryClient = useQueryClient()
  const { user } = useAuthStore()
  const canManage = ['SUPER_ADMIN', 'TENANT_ADMIN', 'STORE_MANAGER'].includes(user?.role || '')

  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Schedule | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Schedule | null>(null)
  const [selectedSchedule, setSelectedSchedule] = useState<Schedule | null>(null)
  const [previewContent, setPreviewContent] = useState<ContentPreview | null>(null)
  const [sourceMode, setSourceMode] = useState<'playlist' | 'layout'>('playlist')
  const [conflictInfo, setConflictInfo] = useState<ConflictInfo | null>(null)
  const [pendingDeployId, setPendingDeployId] = useState<string | null>(null)
  const [form, setForm] = useState<ScheduleForm>(makeEmptyForm)

  // ── Queries ──────────────────────────────────────────────────────────────
  const { data, isLoading } = useQuery({
    queryKey: ['schedules'],
    queryFn: () => scheduleApi.getAll({ limit: 100 })
  })

  const { data: playlistData } = useQuery({
    queryKey: ['playlists-select'],
    queryFn: () => playlistApi.getAll({ limit: 100 }),
    enabled: createModalOpen || !!editTarget || !!selectedSchedule
  })

  const { data: deviceData } = useQuery({
    queryKey: ['devices-select'],
    queryFn: () => deviceApi.getAll({ limit: 100 }),
    enabled: createModalOpen || !!editTarget
  })

  const { data: layoutData } = useQuery({
    queryKey: ['layouts-select'],
    queryFn: () => layoutApi.getAll({ limit: 100 }),
    enabled: createModalOpen || !!editTarget
  })

  // ── Mutations ─────────────────────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: scheduleApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedules'] })
      setCreateModalOpen(false)
      setSourceMode('playlist')
      setForm(makeEmptyForm())
      toast.success('스케줄이 생성되었습니다')
    },
    onError: () => toast.error('생성에 실패했습니다')
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      scheduleApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedules'] })
      setEditTarget(null)
      setSourceMode('playlist')
      setForm(makeEmptyForm())
      toast.success('스케줄이 수정되었습니다')
    },
    onError: () => toast.error('수정에 실패했습니다')
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => scheduleApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedules'] })
      setDeleteTarget(null)
      toast.success('스케줄이 삭제되었습니다')
    },
    onError: () => toast.error('스케줄 삭제에 실패했습니다')
  })

  const deployMutation = useMutation({
    mutationFn: ({ id, force }: { id: string; force?: boolean }) => scheduleApi.deploy(id, force),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedules'] })
      setSelectedSchedule(null)
      setPendingDeployId(null)
      setConflictInfo(null)
      toast.success('스케줄이 배포되었습니다')
    },
    onError: (error: any) => {
      const data = error?.response?.data
      if (data?.conflicts) {
        setConflictInfo({ message: data.message, conflicts: data.conflicts })
      } else {
        toast.error('배포에 실패했습니다')
      }
    }
  })

  // ── Handlers ──────────────────────────────────────────────────────────────
  const openEdit = (schedule: Schedule) => {
    setSelectedSchedule(null)
    setEditTarget(schedule)
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
      deviceIds: schedule.devices?.map((sd: any) => sd.device?.id || sd.deviceId).filter(Boolean) || []
    })
  }

  const handleDeploy = (id: string) => {
    setPendingDeployId(id)
    setConflictInfo(null)
    deployMutation.mutate({ id, force: false })
  }

  // ── Derived data ──────────────────────────────────────────────────────────
  const schedules: Schedule[] = data?.items || []
  const playlistItems = playlistData?.items?.map((p: any) => ({ id: p.id, name: p.name })) || []
  const layoutItems = layoutData?.items?.map((l: any) => ({ id: l.id, name: l.name, baseWidth: l.baseWidth, baseHeight: l.baseHeight })) || []
  const deviceItems = deviceData?.items?.map((d: any) => ({ id: d.id, name: d.name })) || []

  const calendarEvents = schedules.map(schedule => {
    const startStr = toDateStr(schedule.startDate)
    const endStr = toDateStr(schedule.endDate || schedule.startDate)
    const exclusiveEnd = (() => {
      try {
        const [y, m, d] = endStr.split('-').map(Number)
        const dt = new Date(y, m - 1, d + 1)
        return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
      } catch {
        return endStr
      }
    })()
    return {
      id: schedule.id,
      title: schedule.name,
      start: startStr,
      end: exclusiveEnd,
      color: SCHEDULE_COLORS[schedule.status] || '#6b7280',
      extendedProps: { schedule }
    }
  })

  if (isLoading) return <PageLoader />

  return (
    <div className="space-y-5">
      {/* ── 헤더 ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">스케줄 관리</h1>
          <p className="text-gray-500 text-sm mt-1">콘텐츠 재생 일정을 설정하고 장치에 배포하세요</p>
        </div>
        {canManage && (
          <button className="btn-primary" onClick={() => setCreateModalOpen(true)}>
            <Plus className="w-4 h-4" />
            스케줄 생성
          </button>
        )}
      </div>

      {/* ── 캘린더 + 목록 ──────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-5">
        <div className="card xl:col-span-3">
          <FullCalendar
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
            initialView="dayGridMonth"
            headerToolbar={{
              left: 'prev,next today',
              center: 'title',
              right: 'dayGridMonth,timeGridWeek,timeGridDay'
            }}
            events={calendarEvents}
            eventClick={(info) => setSelectedSchedule(info.event.extendedProps.schedule)}
            locale="ko"
            height={600}
            buttonText={{ today: '오늘', month: '월', week: '주', day: '일' }}
          />
        </div>

        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-700">스케줄 목록</h2>
          {schedules.length === 0 ? (
            <div className="card text-center py-8 text-gray-400 text-sm">
              <Calendar className="w-10 h-10 mx-auto mb-2 opacity-50" />
              <p>스케줄이 없습니다</p>
            </div>
          ) : (
            schedules.map(schedule => (
              <div
                key={schedule.id}
                className="card p-4 cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => setSelectedSchedule(schedule)}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <p className="text-sm font-medium text-gray-800 truncate flex-1">{schedule.name}</p>
                  <StatusBadge status={schedule.status} />
                </div>
                <p className="text-xs text-gray-500">
                  {toDateStr(schedule.startDate)}
                  {schedule.startTime && ` ${schedule.startTime}`}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  {schedule.layout?.name
                    ? `레이아웃: ${schedule.layout.name}`
                    : schedule.playlist?.name || '콘텐츠 없음'}
                </p>
                {canManage && (
                  <div className="flex gap-1 mt-3">
                    <button
                      className="flex-1 text-xs py-1 bg-gray-50 text-gray-600 hover:bg-gray-100 rounded transition-colors"
                      onClick={e => { e.stopPropagation(); openEdit(schedule) }}
                    >
                      <Pencil className="w-3 h-3 inline mr-1" />수정
                    </button>
                    {schedule.status !== 'ACTIVE' && (
                      <button
                        className="flex-1 text-xs py-1 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded transition-colors"
                        onClick={e => { e.stopPropagation(); handleDeploy(schedule.id) }}
                      >
                        배포
                      </button>
                    )}
                    <button
                      className="px-2 py-1 text-xs text-red-500 hover:bg-red-50 rounded transition-colors"
                      onClick={e => { e.stopPropagation(); setDeleteTarget(schedule) }}
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* ── 스케줄 상세 모달 ──────────────────────────────── */}
      <ScheduleDetailModal
        schedule={selectedSchedule}
        onClose={() => setSelectedSchedule(null)}
        onEdit={openEdit}
        onDelete={s => setDeleteTarget(s)}
        onDeploy={handleDeploy}
        deployIsPending={deployMutation.isPending}
        canManage={canManage}
        playlistItems={playlistItems}
        onContentClick={setPreviewContent}
      />

      {/* ── 스케줄 생성 모달 ──────────────────────────────── */}
      <Modal
        isOpen={createModalOpen}
        onClose={() => { setCreateModalOpen(false); setSourceMode('playlist'); setForm(makeEmptyForm()) }}
        title="스케줄 생성"
        size="lg"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setCreateModalOpen(false)}>취소</button>
            <button
              className="btn-primary"
              onClick={() => createMutation.mutate({
                ...form,
                playlistId: form.playlistId || undefined,
                layoutId: form.layoutId || undefined
              })}
              disabled={!form.name || createMutation.isPending}
            >
              {createMutation.isPending ? '생성 중...' : '생성'}
            </button>
          </>
        }
      >
        <ScheduleFormFields
          form={form}
          setForm={setForm}
          sourceMode={sourceMode}
          setSourceMode={setSourceMode}
          playlistItems={playlistItems}
          layoutItems={layoutItems}
          deviceItems={deviceItems}
          showPlaylistPreview
          onContentClick={setPreviewContent}
        />
      </Modal>

      {/* ── 스케줄 편집 모달 ──────────────────────────────── */}
      <Modal
        isOpen={!!editTarget}
        onClose={() => { setEditTarget(null); setSourceMode('playlist'); setForm(makeEmptyForm()) }}
        title={`스케줄 수정: ${editTarget?.name || ''}`}
        size="lg"
        footer={
          <>
            <button className="btn-secondary" onClick={() => { setEditTarget(null); setForm(makeEmptyForm()) }}>취소</button>
            <button
              className="btn-primary"
              onClick={() => editTarget && updateMutation.mutate({
                id: editTarget.id,
                data: {
                  ...form,
                  playlistId: form.playlistId || null,
                  layoutId: form.layoutId || null
                }
              })}
              disabled={!form.name || updateMutation.isPending}
            >
              {updateMutation.isPending ? '저장 중...' : '저장'}
            </button>
          </>
        }
      >
        <ScheduleFormFields
          form={form}
          setForm={setForm}
          sourceMode={sourceMode}
          setSourceMode={setSourceMode}
          playlistItems={playlistItems}
          layoutItems={layoutItems}
          deviceItems={deviceItems}
          onContentClick={setPreviewContent}
        />
      </Modal>

      {/* ── 시간대 충돌 경고 ──────────────────────────────── */}
      <ScheduleConflictDialog
        conflictInfo={conflictInfo}
        onCancel={() => { setConflictInfo(null); setPendingDeployId(null) }}
        onForceConfirm={() => pendingDeployId && deployMutation.mutate({ id: pendingDeployId, force: true })}
        isDeploying={deployMutation.isPending}
      />

      {/* ── 콘텐츠 전체화면 미리보기 ──────────────────────── */}
      <ContentPreviewOverlay
        content={previewContent}
        onClose={() => setPreviewContent(null)}
      />

      {/* ── 삭제 확인 다이얼로그 ──────────────────────────── */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        title="스케줄 삭제"
        message={`"${deleteTarget?.name}"을(를) 삭제하시겠습니까?`}
        confirmLabel="삭제"
        isLoading={deleteMutation.isPending}
      />
    </div>
  )
}
