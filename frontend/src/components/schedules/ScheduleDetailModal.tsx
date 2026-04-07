/**
 * ScheduleDetailModal
 * Read-only detail view for a selected schedule, with playlist preview and condition editor.
 */
import { Send, Trash2, Pencil, Film, Tag } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import Modal from '@/components/ui/Modal'
import StatusBadge from '@/components/ui/StatusBadge'
import ScheduleConditionEditor from './ScheduleConditionEditor'
import ContentThumb, { type ContentPreview } from './ContentThumb'
import { playlistApi } from '@/api/playlists'
import type { Schedule } from '@/types'

interface PlaylistOption {
  id: string
  name: string
}

interface ScheduleDetailModalProps {
  schedule: Schedule | null
  onClose: () => void
  onEdit: (schedule: Schedule) => void
  onDelete: (schedule: Schedule) => void
  onDeploy: (id: string) => void
  deployIsPending: boolean
  canManage: boolean
  playlistItems: PlaylistOption[]
  onContentClick: (content: ContentPreview) => void
}

const REPEAT_LABELS: Record<string, string> = {
  NONE: '없음', DAILY: '매일', WEEKLY: '매주', MONTHLY: '매월'
}

/** Extract YYYY-MM-DD from an ISO datetime string without timezone conversion */
function toDateStr(dateVal: string): string {
  if (!dateVal) return ''
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateVal)) return dateVal
  return dateVal.slice(0, 10)
}

export default function ScheduleDetailModal({
  schedule,
  onClose,
  onEdit,
  onDelete,
  onDeploy,
  deployIsPending,
  canManage,
  playlistItems,
  onContentClick
}: ScheduleDetailModalProps) {
  const { data: selectedPlaylist } = useQuery({
    queryKey: ['playlist-preview', schedule?.playlist?.id],
    queryFn: () => playlistApi.getById(schedule!.playlist!.id),
    enabled: !!schedule?.playlist?.id
  })

  return (
    <Modal
      isOpen={!!schedule}
      onClose={onClose}
      title={schedule?.name ?? ''}
      size="lg"
      footer={
        canManage && schedule ? (
          <div className="flex gap-2 w-full">
            <button
              className="btn-danger"
              onClick={() => { onDelete(schedule); onClose() }}
            >
              <Trash2 className="w-4 h-4" /> 삭제
            </button>
            <button className="btn-secondary flex-1" onClick={() => onEdit(schedule)}>
              <Pencil className="w-4 h-4" /> 수정
            </button>
            {schedule.status !== 'ACTIVE' && (
              <button
                className="btn-primary flex-1"
                onClick={() => onDeploy(schedule.id)}
                disabled={deployIsPending}
              >
                <Send className="w-4 h-4" /> 배포
              </button>
            )}
          </div>
        ) : undefined
      }
    >
      {schedule && (
        <div className="space-y-4">
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-500">상태</dt>
              <dd><StatusBadge status={schedule.status} /></dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">유형</dt>
              <dd className="font-medium">{schedule.type}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">콘텐츠 소스</dt>
              <dd className="font-medium">
                {schedule.layout
                  ? `레이아웃: ${schedule.layout.name}`
                  : schedule.playlist?.name
                  ? `플레이리스트: ${schedule.playlist.name}`
                  : '-'}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">시작일</dt>
              <dd className="font-medium">{toDateStr(schedule.startDate)}</dd>
            </div>
            {schedule.endDate && (
              <div className="flex justify-between">
                <dt className="text-gray-500">종료일</dt>
                <dd className="font-medium">{toDateStr(schedule.endDate)}</dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt className="text-gray-500">재생 시간</dt>
              <dd className="font-medium">{schedule.startTime} - {schedule.endTime}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">반복</dt>
              <dd className="font-medium">
                {REPEAT_LABELS[schedule.repeatType] ?? schedule.repeatType}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">배포 장치</dt>
              <dd className="font-medium">{schedule.devices?.length ?? 0}개</dd>
            </div>
          </dl>

          {/* 플레이리스트 콘텐츠 미리보기 */}
          {schedule.playlist?.id && (
            <div className="bg-gradient-to-br from-gray-50 to-blue-50 border border-blue-100 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <Film className="w-4 h-4 text-blue-500" />
                <span className="text-sm font-semibold text-blue-800">콘텐츠 미리보기</span>
                {selectedPlaylist && (
                  <span className="text-xs text-blue-500 bg-blue-100 px-2 py-0.5 rounded-full">
                    {selectedPlaylist.items?.length ?? 0}개
                  </span>
                )}
              </div>
              {!selectedPlaylist ? (
                <div className="flex items-center gap-2 py-2">
                  <div className="animate-spin w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full" />
                  <span className="text-xs text-gray-400">불러오는 중...</span>
                </div>
              ) : selectedPlaylist.items?.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-2">콘텐츠가 없습니다</p>
              ) : (
                <div className="flex gap-3 overflow-x-auto pb-1">
                  {selectedPlaylist.items?.map((item: { id: string; content: ContentPreview; duration: number }, idx: number) => (
                    <ContentThumb
                      key={item.id}
                      content={item.content}
                      duration={item.duration}
                      index={idx}
                      onClick={() => onContentClick(item.content)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 조건부 재생 */}
          <div className="border border-purple-100 rounded-xl overflow-hidden">
            <div className="bg-gradient-to-r from-purple-50 to-indigo-50 px-4 py-3 flex items-center gap-2">
              <Tag className="w-4 h-4 text-purple-500" />
              <span className="text-sm font-semibold text-purple-800">조건부 재생</span>
              <span className="text-xs text-purple-500 bg-purple-100 px-2 py-0.5 rounded-full ml-auto">
                디바이스 태그 기반
              </span>
            </div>
            <div className="p-4">
              <ScheduleConditionEditor
                scheduleId={schedule.id}
                playlists={playlistItems}
                readOnly={!canManage}
              />
            </div>
          </div>
        </div>
      )}
    </Modal>
  )
}
