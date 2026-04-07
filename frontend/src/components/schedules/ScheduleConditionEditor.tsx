/**
 * V4 Phase 14: 스케줄 조건 편집기
 * 스케줄에 태그 기반 조건부 플레이리스트 매칭 규칙 관리
 */
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2, Tag, ListVideo, ArrowRight, Zap, AlertCircle } from 'lucide-react'
import { tagPlaybackApi, ScheduleCondition, TagKeyValues, ResolveResult } from '@/api/tagPlayback'
import toast from 'react-hot-toast'

interface Props {
  scheduleId: string
  playlists: { id: string; name: string }[]
  readOnly?: boolean
}

export default function ScheduleConditionEditor({ scheduleId, playlists, readOnly }: Props) {
  const queryClient = useQueryClient()
  const [showAdd, setShowAdd] = useState(false)
  const [newCondition, setNewCondition] = useState({ tagKey: '', tagValue: '', playlistId: '', priority: 0 })
  const [resolveResult, setResolveResult] = useState<ResolveResult | null>(null)

  // Load conditions
  const { data: conditions = [] } = useQuery({
    queryKey: ['scheduleConditions', scheduleId],
    queryFn: () => tagPlaybackApi.listConditions(scheduleId)
  })

  // Load tag keys for autocomplete
  const { data: tagKeys = [] } = useQuery({
    queryKey: ['tagKeys'],
    queryFn: () => tagPlaybackApi.listTagKeys()
  })

  const addMutation = useMutation({
    mutationFn: (data: typeof newCondition) => tagPlaybackApi.addCondition(scheduleId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduleConditions', scheduleId] })
      setShowAdd(false)
      setNewCondition({ tagKey: '', tagValue: '', playlistId: '', priority: 0 })
      toast.success('조건이 추가되었습니다')
    }
  })

  const deleteMutation = useMutation({
    mutationFn: (conditionId: string) => tagPlaybackApi.deleteCondition(scheduleId, conditionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduleConditions', scheduleId] })
      toast.success('조건이 삭제되었습니다')
    }
  })

  const resolveMutation = useMutation({
    mutationFn: () => tagPlaybackApi.resolve(scheduleId),
    onSuccess: (data) => setResolveResult(data)
  })

  const tagKeysTyped = tagKeys as TagKeyValues[]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
          <Tag className="w-4 h-4" /> 조건부 재생 규칙
        </h3>
        <div className="flex gap-2">
          {conditions.length > 0 && (
            <button
              onClick={() => resolveMutation.mutate()}
              className="flex items-center gap-1 text-xs px-2.5 py-1 bg-green-100 text-green-700 rounded-lg hover:bg-green-200"
            >
              <Zap className="w-3 h-3" />
              매칭 테스트
            </button>
          )}
          {!readOnly && (
            <button
              onClick={() => setShowAdd(true)}
              className="flex items-center gap-1 text-xs px-2.5 py-1 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200"
            >
              <Plus className="w-3 h-3" /> 조건 추가
            </button>
          )}
        </div>
      </div>

      {/* Info */}
      {conditions.length === 0 && !showAdd && (
        <div className="flex items-start gap-2 p-3 bg-blue-50 rounded-lg text-xs text-blue-700">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">조건부 재생이란?</p>
            <p className="mt-1 text-blue-600">장치에 설정된 태그에 따라 다른 플레이리스트를 자동으로 재생합니다.</p>
            <p className="text-blue-600">예: "매장타입=카페"인 장치에는 카페메뉴 플레이리스트를 재생</p>
          </div>
        </div>
      )}

      {/* Condition list */}
      {conditions.length > 0 && (
        <div className="space-y-2">
          {(conditions as ScheduleCondition[]).map((condition, idx) => (
            <div key={condition.id} className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
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
              <span className="text-xs text-gray-300 ml-auto">우선순위: {condition.priority}</span>
              {!readOnly && (
                <button
                  onClick={() => deleteMutation.mutate(condition.id)}
                  className="p-1 text-gray-300 hover:text-red-500"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add form */}
      {showAdd && (
        <div className="p-4 bg-blue-50 rounded-lg space-y-3 border border-blue-200">
          <h4 className="text-xs font-semibold text-blue-800">새 조건 추가</h4>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-gray-600">태그 키</label>
              <input
                type="text"
                value={newCondition.tagKey}
                onChange={e => setNewCondition(prev => ({ ...prev, tagKey: e.target.value }))}
                className="w-full text-xs px-2 py-1.5 border rounded bg-white mt-1"
                placeholder="예: 매장타입"
                list="condition-tag-keys"
              />
              <datalist id="condition-tag-keys">
                {tagKeysTyped.map(tk => <option key={tk.key} value={tk.key} />)}
              </datalist>
            </div>
            <div>
              <label className="text-xs text-gray-600">태그 값</label>
              <input
                type="text"
                value={newCondition.tagValue}
                onChange={e => setNewCondition(prev => ({ ...prev, tagValue: e.target.value }))}
                className="w-full text-xs px-2 py-1.5 border rounded bg-white mt-1"
                placeholder="예: 카페"
                list={`condition-tag-values-${newCondition.tagKey}`}
              />
              <datalist id={`condition-tag-values-${newCondition.tagKey}`}>
                {tagKeysTyped.find(tk => tk.key === newCondition.tagKey)?.values.map(v => (
                  <option key={v} value={v} />
                ))}
              </datalist>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-gray-600">플레이리스트</label>
              <select
                value={newCondition.playlistId}
                onChange={e => setNewCondition(prev => ({ ...prev, playlistId: e.target.value }))}
                className="w-full text-xs px-2 py-1.5 border rounded bg-white mt-1"
              >
                <option value="">선택...</option>
                {playlists.map(pl => (
                  <option key={pl.id} value={pl.id}>{pl.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-600">우선순위 (높을수록 우선)</label>
              <input
                type="number"
                value={newCondition.priority}
                onChange={e => setNewCondition(prev => ({ ...prev, priority: Number(e.target.value) }))}
                className="w-full text-xs px-2 py-1.5 border rounded bg-white mt-1"
                min={0}
              />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowAdd(false)} className="btn-secondary text-xs px-3 py-1.5">취소</button>
            <button
              onClick={() => addMutation.mutate(newCondition)}
              disabled={!newCondition.tagKey || !newCondition.tagValue || !newCondition.playlistId}
              className="btn-primary text-xs px-3 py-1.5 disabled:opacity-50"
            >
              추가
            </button>
          </div>
        </div>
      )}

      {/* Resolve result */}
      {resolveResult && (
        <div className="p-4 bg-green-50 rounded-lg space-y-3 border border-green-200">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold text-green-800">
              매칭 결과 ({resolveResult.deviceCount}개 장치)
            </h4>
            <button onClick={() => setResolveResult(null)} className="text-xs text-green-600 hover:underline">닫기</button>
          </div>
          {resolveResult.results.length === 0 ? (
            <p className="text-xs text-green-600">배정된 장치가 없습니다</p>
          ) : (
            <div className="space-y-1.5">
              {resolveResult.results.map((r, idx) => (
                <div key={idx} className="flex items-center gap-2 text-xs bg-white rounded p-2">
                  <span className="font-medium text-gray-700">{r.device.name}</span>
                  {r.matchedCondition && (
                    <span className="text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                      {r.matchedCondition.tagKey}={r.matchedCondition.tagValue}
                    </span>
                  )}
                  <ArrowRight className="w-3 h-3 text-gray-400" />
                  {r.matchedPlaylist ? (
                    <span className={`px-1.5 py-0.5 rounded ${r.fallback ? 'bg-yellow-50 text-yellow-700' : 'bg-green-100 text-green-700'}`}>
                      {r.matchedPlaylist.name} {r.fallback && '(기본)'}
                    </span>
                  ) : (
                    <span className="text-red-500">미매칭</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
