/**
 * ConditionAddForm
 * Strict-input form for adding a new schedule condition.
 *
 * Design principle: it must be IMPOSSIBLE to enter an invalid condition.
 *   - Tag key: <select> bound to existing keys only (no free text)
 *   - Tag value: <select> bound to that key's existing values only
 *   - Duplicate (key, value) combinations are blocked at submit
 *   - Priority defaults to max(existing) + 10 to avoid silent ordering bugs
 *
 * The user gets clear feedback when the form is unsubmittable and why.
 */
import { useEffect, useMemo, useState } from 'react'
import { AlertCircle } from 'lucide-react'
import type { TagKeyValues, ScheduleCondition } from '@/api/tagPlayback'

interface Props {
  tagKeys: TagKeyValues[]
  playlists: { id: string; name: string }[]
  existingConditions: ScheduleCondition[]
  isSubmitting: boolean
  onSubmit: (data: { tagKey: string; tagValue: string; playlistId: string; priority: number }) => void
  onCancel: () => void
}

export default function ConditionAddForm({
  tagKeys,
  playlists,
  existingConditions,
  isSubmitting,
  onSubmit,
  onCancel
}: Props) {
  // Compute next safe priority (highest existing + 10) so a new condition
  // never silently loses ordering to existing ones.
  const nextPriority = useMemo(() => {
    if (existingConditions.length === 0) return 10
    return Math.max(...existingConditions.map(c => c.priority)) + 10
  }, [existingConditions])

  const [tagKey, setTagKey] = useState('')
  const [tagValue, setTagValue] = useState('')
  const [playlistId, setPlaylistId] = useState('')
  const [priority, setPriority] = useState(nextPriority)

  // Reset value when key changes — values are key-scoped
  useEffect(() => {
    setTagValue('')
  }, [tagKey])

  // Keep priority in sync when conditions list changes
  useEffect(() => {
    setPriority(nextPriority)
  }, [nextPriority])

  const availableValues = tagKeys.find(tk => tk.key === tagKey)?.values ?? []

  // Duplicate detection — same (key, value) already configured?
  const isDuplicate = !!tagKey && !!tagValue && existingConditions.some(
    c => c.tagKey === tagKey && c.tagValue === tagValue
  )

  const canSubmit = !!tagKey && !!tagValue && !!playlistId && !isDuplicate && !isSubmitting

  const handleSubmit = () => {
    if (!canSubmit) return
    onSubmit({ tagKey, tagValue, playlistId, priority })
  }

  return (
    <div className="p-4 bg-blue-50 rounded-lg space-y-3 border border-blue-200">
      <h4 className="text-xs font-semibold text-blue-800">새 조건 추가</h4>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-gray-600">
            태그 키 <span className="text-red-500">*</span>
          </label>
          <select
            value={tagKey}
            onChange={e => setTagKey(e.target.value)}
            className="w-full text-xs px-2 py-1.5 border rounded bg-white mt-1"
          >
            <option value="">선택...</option>
            {tagKeys.map(tk => (
              <option key={tk.key} value={tk.key}>{tk.key}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-600">
            태그 값 <span className="text-red-500">*</span>
          </label>
          <select
            value={tagValue}
            onChange={e => setTagValue(e.target.value)}
            disabled={!tagKey}
            className="w-full text-xs px-2 py-1.5 border rounded bg-white mt-1 disabled:bg-gray-100 disabled:cursor-not-allowed"
          >
            <option value="">{tagKey ? '선택...' : '키를 먼저 선택'}</option>
            {availableValues.map(v => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-gray-600">
            플레이리스트 <span className="text-red-500">*</span>
          </label>
          <select
            value={playlistId}
            onChange={e => setPlaylistId(e.target.value)}
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
            value={priority}
            onChange={e => setPriority(Number(e.target.value))}
            className="w-full text-xs px-2 py-1.5 border rounded bg-white mt-1"
            min={0}
          />
        </div>
      </div>

      {/* Inline validation feedback */}
      {isDuplicate && (
        <div className="flex items-start gap-1.5 text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <span>
            <strong>{tagKey}={tagValue}</strong> 조건이 이미 등록되어 있습니다. 기존 조건을 삭제하거나 다른 값을 선택해주세요.
          </span>
        </div>
      )}

      {tagKeys.length > 0 && tagKey && availableValues.length === 0 && (
        <p className="text-xs text-gray-500">
          이 키({tagKey})를 사용하는 장치가 없습니다. 장치 페이지에서 값을 먼저 등록하세요.
        </p>
      )}

      <div className="flex gap-2 justify-end">
        <button onClick={onCancel} className="btn-secondary text-xs px-3 py-1.5">취소</button>
        <button
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="btn-primary text-xs px-3 py-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          추가
        </button>
      </div>
    </div>
  )
}
