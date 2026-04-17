/**
 * EditScheduleModal
 * Two-tab edit modal for schedules:
 *   - "기본 설정" tab: ScheduleFormFields (name, dates, devices, content source)
 *   - "조건부 재생" tab: ScheduleConditionEditor (tag-based playback conditions)
 *
 * Tab resets to 'basic' whenever the target schedule changes.
 */
import { useState, useEffect } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import Modal from '@/components/ui/Modal'
import ScheduleFormFields from './ScheduleFormFields'
import ScheduleConditionEditor from './ScheduleConditionEditor'
import type { Schedule } from '@/types'
import type { ScheduleForm } from './ScheduleFormFields'
import type { ContentPreview } from './ContentThumb'

interface PlaylistOption { id: string; name: string }
interface LayoutOption { id: string; name: string; baseWidth: number; baseHeight: number }
interface DeviceOption {
  id: string
  name: string
  store?: { id: string; name: string } | null
  status?: 'ONLINE' | 'OFFLINE' | 'WARNING'
}

interface EditScheduleModalProps {
  editTarget: Schedule | null
  form: ScheduleForm
  setForm: Dispatch<SetStateAction<ScheduleForm>>
  sourceMode: 'playlist' | 'layout'
  setSourceMode: Dispatch<SetStateAction<'playlist' | 'layout'>>
  playlistItems: PlaylistOption[]
  layoutItems: LayoutOption[]
  deviceItems: DeviceOption[]
  errors: Record<string, string>
  isValid: boolean
  isSaving: boolean
  onClose: () => void
  onSave: () => void
  onContentClick: (content: ContentPreview) => void
}

export default function EditScheduleModal({
  editTarget,
  form,
  setForm,
  sourceMode,
  setSourceMode,
  playlistItems,
  layoutItems,
  deviceItems,
  errors,
  isValid,
  isSaving,
  onClose,
  onSave,
  onContentClick,
}: EditScheduleModalProps) {
  const [tab, setTab] = useState<'basic' | 'conditions'>('basic')

  // Reset to basic tab whenever a different schedule is opened
  useEffect(() => { setTab('basic') }, [editTarget?.id])

  return (
    <Modal
      isOpen={!!editTarget}
      onClose={onClose}
      title={`스케줄 수정: ${editTarget?.name || ''}`}
      size="lg"
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>취소</button>
          <button
            className="btn-primary"
            onClick={onSave}
            disabled={!isValid || isSaving}
          >
            {isSaving ? '저장 중...' : '저장'}
          </button>
        </>
      }
    >
      {/* Tab header */}
      <div className="flex border-b border-gray-200 mb-4">
        <button
          type="button"
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            tab === 'basic'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
          onClick={() => setTab('basic')}
        >
          기본 설정
        </button>
        <button
          type="button"
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            tab === 'conditions'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
          onClick={() => setTab('conditions')}
        >
          조건부 재생
        </button>
      </div>

      {/* Tab content */}
      {tab === 'basic' && (
        <ScheduleFormFields
          form={form}
          setForm={setForm}
          sourceMode={sourceMode}
          setSourceMode={setSourceMode}
          playlistItems={playlistItems}
          layoutItems={layoutItems}
          deviceItems={deviceItems}
          showPlaylistPreview
          onContentClick={onContentClick}
          errors={errors}
        />
      )}
      {tab === 'conditions' && editTarget && (
        <ScheduleConditionEditor
          scheduleId={editTarget.id}
          playlists={playlistItems}
          deviceCount={editTarget.devices?.length ?? 0}
          defaultPlaylistId={editTarget.playlist?.id ?? null}
          defaultPlaylistName={editTarget.playlist?.name ?? null}
        />
      )}
    </Modal>
  )
}
