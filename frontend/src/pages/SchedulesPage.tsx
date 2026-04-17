/**
 * SchedulesPage — composition root for schedule management.
 * Delegates queries, mutations, form state, and calendar events to hooks.
 */
import { useState, useMemo } from 'react'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import { Plus } from 'lucide-react'
import type { Schedule } from '@/types'
import Modal from '@/components/ui/Modal'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import { PageLoader } from '@/components/ui/LoadingSpinner'
import { useAuthStore } from '@/store/authStore'
import ScheduleFormFields from '@/components/schedules/ScheduleFormFields'
import EditScheduleModal from '@/components/schedules/EditScheduleModal'
import ScheduleDetailModal from '@/components/schedules/ScheduleDetailModal'
import ScheduleConflictDialog, { type ConflictInfo } from '@/components/schedules/ScheduleConflictDialog'
import ContentPreviewOverlay from '@/components/schedules/ContentPreviewOverlay'
import ScheduleSidebar from '@/components/schedules/ScheduleSidebar'
import type { ContentPreview } from '@/components/schedules/ContentThumb'
import { useScheduleForm } from '@/hooks/useScheduleForm'
import { useScheduleMutations } from '@/hooks/useScheduleMutations'
import { useScheduleQueries } from '@/hooks/useScheduleQueries'
import { useCalendarEvents } from '@/hooks/useCalendarEvents'
import { validateScheduleForm } from '@/utils/scheduleValidation'

export default function SchedulesPage() {
  const { user } = useAuthStore()
  const canManage = ['SUPER_ADMIN', 'TENANT_ADMIN', 'STORE_MANAGER'].includes(user?.role || '')

  // Modal state
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Schedule | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Schedule | null>(null)
  const [selectedSchedule, setSelectedSchedule] = useState<Schedule | null>(null)
  const [previewContent, setPreviewContent] = useState<ContentPreview | null>(null)
  const [conflictInfo, setConflictInfo] = useState<ConflictInfo | null>(null)
  const [pendingDeployId, setPendingDeployId] = useState<string | null>(null)

  // Form, queries, validation, mutations
  const { form, setForm, sourceMode, setSourceMode, resetForm, openEdit: populateForm } = useScheduleForm()
  const errors = useMemo(() => validateScheduleForm(form), [form])
  const isValid = Object.keys(errors).length === 0

  const { schedules, playlistItems, layoutItems, deviceItems, isLoading } = useScheduleQueries({
    modalOpen: createModalOpen || !!editTarget,
    detailOpen: !!selectedSchedule,
  })
  const calendarEvents = useCalendarEvents(schedules)

  const { createMutation, updateMutation, deleteMutation, deployMutation, duplicateMutation } = useScheduleMutations({
    onCreateSuccess: () => { setCreateModalOpen(false); resetForm() },
    onUpdateSuccess: () => { setEditTarget(null); resetForm() },
    onDeleteSuccess: () => setDeleteTarget(null),
    onDeploySuccess: () => { setSelectedSchedule(null); setPendingDeployId(null); setConflictInfo(null) },
    onDuplicateSuccess: (newSchedule) => {
      setSelectedSchedule(null)
      setEditTarget(newSchedule)
      populateForm(newSchedule)
    },
    onDeployConflict: setConflictInfo,
  })

  const handleEdit = (s: Schedule) => { setSelectedSchedule(null); setEditTarget(s); populateForm(s) }
  const handleDeploy = (id: string) => { setPendingDeployId(id); setConflictInfo(null); deployMutation.mutate({ id, force: false }) }
  const handleDuplicate = (id: string) => duplicateMutation.mutate(id)
  const buildPayload = () => ({
    ...form,
    playlistId: form.playlistId || undefined,
    layoutId: form.layoutId || undefined,
    repeatDays: form.repeatDays.length > 0 ? form.repeatDays.join(',') : undefined,
  })

  if (isLoading) return <PageLoader />

  const formProps = {
    form, setForm, sourceMode, setSourceMode,
    playlistItems, layoutItems, deviceItems,
    showPlaylistPreview: true, onContentClick: setPreviewContent, errors,
  } as const

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">스케줄 관리</h1>
          <p className="text-gray-500 text-sm mt-1">콘텐츠 재생 일정을 설정하고 장치에 배포하세요</p>
        </div>
        {canManage && (
          <button className="btn-primary" onClick={() => setCreateModalOpen(true)}>
            <Plus className="w-4 h-4" /> 스케줄 생성
          </button>
        )}
      </div>

      {/* Calendar + Sidebar */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-5">
        <div className="card xl:col-span-3">
          <FullCalendar
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
            initialView="dayGridMonth"
            headerToolbar={{ left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek,timeGridDay' }}
            events={calendarEvents}
            eventClick={(info) => setSelectedSchedule(info.event.extendedProps.schedule)}
            locale="ko"
            height={600}
            buttonText={{ today: '오늘', month: '월', week: '주', day: '일' }}
          />
        </div>
        <ScheduleSidebar
          schedules={schedules} canManage={canManage}
          onSelect={setSelectedSchedule} onEdit={handleEdit}
          onDeploy={handleDeploy} onDelete={setDeleteTarget}
          onDuplicate={handleDuplicate}
        />
      </div>

      {/* Detail modal */}
      <ScheduleDetailModal
        schedule={selectedSchedule} onClose={() => setSelectedSchedule(null)}
        onEdit={handleEdit} onDelete={setDeleteTarget} onDeploy={handleDeploy}
        onDuplicate={handleDuplicate}
        deployIsPending={deployMutation.isPending} canManage={canManage}
        playlistItems={playlistItems} onContentClick={setPreviewContent}
      />

      {/* Create modal */}
      <Modal
        isOpen={createModalOpen}
        onClose={() => { setCreateModalOpen(false); resetForm() }}
        title="스케줄 생성" size="lg"
        footer={<>
          <button className="btn-secondary" onClick={() => setCreateModalOpen(false)}>취소</button>
          <button className="btn-primary" onClick={() => createMutation.mutate(buildPayload())}
            disabled={!isValid || createMutation.isPending}>
            {createMutation.isPending ? '생성 중...' : '생성'}
          </button>
        </>}
      >
        <ScheduleFormFields {...formProps} />
      </Modal>

      {/* Edit modal — tabbed (basic settings + conditional playback) */}
      <EditScheduleModal
        editTarget={editTarget}
        form={form} setForm={setForm}
        sourceMode={sourceMode} setSourceMode={setSourceMode}
        playlistItems={playlistItems} layoutItems={layoutItems} deviceItems={deviceItems}
        errors={errors} isValid={isValid} isSaving={updateMutation.isPending}
        onClose={() => { setEditTarget(null); resetForm() }}
        onSave={() => editTarget && updateMutation.mutate({
          id: editTarget.id,
          data: { ...buildPayload(), playlistId: form.playlistId || null, layoutId: form.layoutId || null },
        })}
        onContentClick={setPreviewContent}
      />

      {/* Conflict dialog */}
      <ScheduleConflictDialog
        conflictInfo={conflictInfo}
        onCancel={() => { setConflictInfo(null); setPendingDeployId(null) }}
        onForceConfirm={() => pendingDeployId && deployMutation.mutate({ id: pendingDeployId, force: true })}
        isDeploying={deployMutation.isPending}
      />

      <ContentPreviewOverlay content={previewContent} onClose={() => setPreviewContent(null)} />

      <ConfirmDialog
        isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        title="스케줄 삭제" message={`"${deleteTarget?.name}"을(를) 삭제하시겠습니까?`}
        confirmLabel="삭제" isLoading={deleteMutation.isPending}
      />
    </div>
  )
}
