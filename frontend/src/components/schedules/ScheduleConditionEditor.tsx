/**
 * ScheduleConditionEditor
 * Top-level UI for managing tag-based playback conditions on a schedule.
 *
 * Composition:
 *   - ConditionDiagnostics:   pre-flight state (devices, tag keys, fallback)
 *   - condition list:          existing conditions + delete
 *   - ConditionAddForm:        strict-input form for adding a condition
 *   - ConditionResolveResult:  per-device matching result
 *
 * The diagnostic resolve runs once on mount (and on conditions change) so the
 * user always sees what's actually happening — no need to click "test" first.
 */
import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2, Tag, ListVideo, ArrowRight, Zap, AlertTriangle, HelpCircle } from 'lucide-react'
import { tagPlaybackApi, ScheduleCondition, TagKeyValues } from '@/api/tagPlayback'
import toast from 'react-hot-toast'
import ConditionDiagnostics from './conditions/ConditionDiagnostics'
import ConditionAddForm from './conditions/ConditionAddForm'
import ConditionResolveResult from './conditions/ConditionResolveResult'

interface Props {
  scheduleId: string
  playlists: { id: string; name: string }[]
  readOnly?: boolean
  /** Total devices assigned to this schedule, for diagnostics. */
  deviceCount?: number
  /** Default playlist id — used to flag no-op conditions that duplicate the fallback. */
  defaultPlaylistId?: string | null
  /** Default playlist name for fallback visualization. */
  defaultPlaylistName?: string | null
}

export default function ScheduleConditionEditor({
  scheduleId,
  playlists,
  readOnly,
  deviceCount = 0,
  defaultPlaylistId,
  defaultPlaylistName
}: Props) {
  const queryClient = useQueryClient()
  const [showAdd, setShowAdd] = useState(false)
  const [showResolveDetail, setShowResolveDetail] = useState(false)

  const { data: conditions = [] } = useQuery({
    queryKey: ['scheduleConditions', scheduleId],
    queryFn: () => tagPlaybackApi.listConditions(scheduleId)
  })

  const { data: tagKeys = [] } = useQuery({
    queryKey: ['tagKeys'],
    queryFn: () => tagPlaybackApi.listTagKeys()
  })

  // Auto-resolve for diagnostics. Re-runs when conditions change so the
  // status line always reflects the latest config without manual clicks.
  const { data: diagnosticResult } = useQuery({
    queryKey: ['scheduleResolve', scheduleId, conditions.length],
    queryFn: () => tagPlaybackApi.resolve(scheduleId),
    enabled: deviceCount > 0
  })

  const addMutation = useMutation({
    mutationFn: (data: { tagKey: string; tagValue: string; playlistId: string; priority: number }) =>
      tagPlaybackApi.addCondition(scheduleId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduleConditions', scheduleId] })
      queryClient.invalidateQueries({ queryKey: ['scheduleResolve', scheduleId] })
      setShowAdd(false)
      toast.success('조건이 추가되었습니다')
    },
    onError: () => toast.error('조건 추가에 실패했습니다')
  })

  const deleteMutation = useMutation({
    mutationFn: (conditionId: string) => tagPlaybackApi.deleteCondition(scheduleId, conditionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduleConditions', scheduleId] })
      queryClient.invalidateQueries({ queryKey: ['scheduleResolve', scheduleId] })
      toast.success('조건이 삭제되었습니다')
    }
  })

  const tagKeysTyped = tagKeys as TagKeyValues[]
  const conditionsTyped = conditions as ScheduleCondition[]

  // Hide showAdd if upstream becomes empty (e.g. user navigated away from another schedule)
  useEffect(() => {
    if (deviceCount === 0 || tagKeysTyped.length === 0) setShowAdd(false)
  }, [deviceCount, tagKeysTyped.length])

  const canAdd = !readOnly && deviceCount > 0 && tagKeysTyped.length > 0

  return (
    <div className="space-y-3">
      {/* Inline help — one-sentence explainer. Always visible for first-time users. */}
      <details className="text-xs bg-blue-50/60 border border-blue-100 rounded-lg">
        <summary className="cursor-pointer px-3 py-2 font-medium text-blue-800 flex items-center gap-2 hover:bg-blue-50">
          <HelpCircle className="w-3.5 h-3.5" />
          조건부 재생이 뭔가요?
        </summary>
        <div className="px-3 pb-3 pt-1 text-blue-900/80 space-y-1.5 leading-relaxed">
          <p>
            <strong>하나의 스케줄</strong>을 여러 장치에 배포할 때, 장치에 붙인 태그에 따라 <strong>장치별로 다른 플레이리스트</strong>를 자동으로 재생시키는 기능입니다.
          </p>
          <p className="text-blue-800/80">
            예) 카페 장치엔 <code className="bg-white px-1 rounded">카페메뉴</code>, 식당 장치엔 <code className="bg-white px-1 rounded">식당메뉴</code>, 그 외엔 기본 플레이리스트.
          </p>
          <p className="text-blue-700/70">
            조건에 매칭되지 않는 장치는 스케줄의 <strong>기본 플레이리스트</strong>로 재생됩니다(=fallback).
          </p>
        </div>
      </details>

      {/* Pre-flight diagnostics — always visible, even with no conditions */}
      <ConditionDiagnostics
        deviceCount={deviceCount}
        tagKeyCount={tagKeysTyped.length}
        defaultPlaylistName={defaultPlaylistName}
        resolveResult={diagnosticResult}
      />

      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
          <Tag className="w-4 h-4" /> 조건부 재생 규칙 ({conditionsTyped.length})
        </h3>
        <div className="flex gap-2">
          {conditionsTyped.length > 0 && diagnosticResult && (
            <button
              onClick={() => setShowResolveDetail(true)}
              className="flex items-center gap-1 text-xs px-2.5 py-1 bg-green-100 text-green-700 rounded-lg hover:bg-green-200"
            >
              <Zap className="w-3 h-3" />
              상세 결과
            </button>
          )}
          {canAdd && !showAdd && (
            <button
              onClick={() => setShowAdd(true)}
              className="flex items-center gap-1 text-xs px-2.5 py-1 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200"
            >
              <Plus className="w-3 h-3" /> 조건 추가
            </button>
          )}
        </div>
      </div>

      {/* Condition list */}
      {conditionsTyped.length > 0 && (
        <div className="space-y-2">
          {conditionsTyped.map((condition, idx) => {
            // A condition whose playlist equals the schedule's default playlist
            // has no effect — the device would play the same thing via fallback.
            // Surface this clearly so the user doesn't mistake a no-op for progress.
            const isNoOp = !!defaultPlaylistId && condition.playlistId === defaultPlaylistId
            return (
              <div
                key={condition.id}
                className={`flex items-center gap-2 p-3 rounded-lg ${
                  isNoOp ? 'bg-amber-50 border border-amber-200' : 'bg-gray-50'
                }`}
              >
                <span className="text-xs text-gray-400 w-5 text-center">{idx + 1}</span>
                <span className="text-xs font-medium text-blue-700 bg-blue-100 px-2 py-0.5 rounded">
                  {condition.tagKey}
                </span>
                <span className="text-xs text-gray-500">=</span>
                <span className="text-xs font-medium text-green-700 bg-green-100 px-2 py-0.5 rounded">
                  {condition.tagValue}
                </span>
                <ArrowRight className="w-3.5 h-3.5 text-gray-400" />
                <span className="flex items-center gap-1 text-xs text-purple-700 bg-purple-100 px-2 py-0.5 rounded">
                  <ListVideo className="w-3 h-3" />
                  {condition.playlist?.name || condition.playlistId}
                </span>
                {isNoOp && (
                  <span
                    className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded border border-amber-200"
                    title="이 조건의 플레이리스트가 스케줄의 기본 플레이리스트와 동일해서, 이 조건이 있든 없든 결과가 같습니다."
                  >
                    <AlertTriangle className="w-3 h-3" />
                    효과 없음
                  </span>
                )}
                <span className="text-xs text-gray-400 ml-auto">우선순위 {condition.priority}</span>
                {!readOnly && (
                  <button
                    onClick={() => deleteMutation.mutate(condition.id)}
                    className="p-1 text-gray-300 hover:text-red-500"
                    aria-label="조건 삭제"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Add form — only mounts when user explicitly opens it */}
      {showAdd && canAdd && (
        <ConditionAddForm
          tagKeys={tagKeysTyped}
          playlists={playlists}
          existingConditions={conditionsTyped}
          isSubmitting={addMutation.isPending}
          onSubmit={(data) => addMutation.mutate(data)}
          onCancel={() => setShowAdd(false)}
        />
      )}

      {/* Detailed per-device matching result */}
      {showResolveDetail && diagnosticResult && (
        <ConditionResolveResult
          result={diagnosticResult}
          onClose={() => setShowResolveDetail(false)}
        />
      )}
    </div>
  )
}
