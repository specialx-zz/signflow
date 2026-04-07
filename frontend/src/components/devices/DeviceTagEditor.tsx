/**
 * V4 Phase 14: 장치 태그 편집기 컴포넌트
 * 장치 상세 페이지에서 사용. 키-값 쌍으로 태그 관리.
 */
import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, X, Tag, Save } from 'lucide-react'
import { tagPlaybackApi, TagKeyValues } from '@/api/tagPlayback'
import toast from 'react-hot-toast'

interface Props {
  deviceId: string
  readOnly?: boolean
}

export default function DeviceTagEditor({ deviceId, readOnly }: Props) {
  const queryClient = useQueryClient()
  const [tags, setTags] = useState<Record<string, string>>({})
  const [newKey, setNewKey] = useState('')
  const [newValue, setNewValue] = useState('')
  const [isDirty, setIsDirty] = useState(false)

  // Load current tags
  const { data } = useQuery({
    queryKey: ['deviceTags', deviceId],
    queryFn: () => tagPlaybackApi.getDeviceTags(deviceId)
  })

  // Load available tag keys for autocomplete
  const { data: tagKeys } = useQuery({
    queryKey: ['tagKeys'],
    queryFn: () => tagPlaybackApi.listTagKeys()
  })

  useEffect(() => {
    if (data?.tags) {
      setTags(data.tags)
      setIsDirty(false)
    }
  }, [data])

  const saveMutation = useMutation({
    mutationFn: () => tagPlaybackApi.setDeviceTags(deviceId, tags),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deviceTags', deviceId] })
      setIsDirty(false)
      toast.success('태그가 저장되었습니다')
    },
    onError: () => toast.error('태그 저장 실패')
  })

  const addTag = () => {
    if (!newKey.trim()) return
    setTags(prev => ({ ...prev, [newKey.trim()]: newValue.trim() }))
    setNewKey('')
    setNewValue('')
    setIsDirty(true)
  }

  const removeTag = (key: string) => {
    const next = { ...tags }
    delete next[key]
    setTags(next)
    setIsDirty(true)
  }

  const updateTagValue = (key: string, value: string) => {
    setTags(prev => ({ ...prev, [key]: value }))
    setIsDirty(true)
  }

  const tagEntries = Object.entries(tags)
  const suggestedKeys = (tagKeys as TagKeyValues[] || []).filter(
    tk => !tags[tk.key]
  )

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
          <Tag className="w-4 h-4" /> 장치 태그
        </h3>
        {isDirty && !readOnly && (
          <button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            className="flex items-center gap-1 text-xs px-2.5 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Save className="w-3 h-3" />
            {saveMutation.isPending ? '저장 중...' : '저장'}
          </button>
        )}
      </div>

      {/* Current tags */}
      {tagEntries.length > 0 ? (
        <div className="space-y-1.5">
          {tagEntries.map(([key, value]) => (
            <div key={key} className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2">
              <span className="text-xs font-medium text-blue-700 bg-blue-100 px-2 py-0.5 rounded">{key}</span>
              {readOnly ? (
                <span className="text-xs text-gray-600">{value}</span>
              ) : (
                <input
                  type="text"
                  value={value}
                  onChange={e => updateTagValue(key, e.target.value)}
                  className="flex-1 text-xs px-2 py-1 border rounded bg-white"
                />
              )}
              {!readOnly && (
                <button onClick={() => removeTag(key)} className="p-0.5 text-gray-300 hover:text-red-500">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-gray-400 py-2">태그가 없습니다</p>
      )}

      {/* Add new tag */}
      {!readOnly && (
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              value={newKey}
              onChange={e => setNewKey(e.target.value)}
              placeholder="키 (예: 매장타입)"
              className="w-full text-xs px-2 py-1.5 border rounded bg-white"
              list="tag-key-suggestions"
              onKeyDown={e => e.key === 'Enter' && addTag()}
            />
            <datalist id="tag-key-suggestions">
              {suggestedKeys.map(tk => (
                <option key={tk.key} value={tk.key} />
              ))}
            </datalist>
          </div>
          <input
            type="text"
            value={newValue}
            onChange={e => setNewValue(e.target.value)}
            placeholder="값 (예: 카페)"
            className="flex-1 text-xs px-2 py-1.5 border rounded bg-white"
            list={`tag-value-suggestions-${newKey}`}
            onKeyDown={e => e.key === 'Enter' && addTag()}
          />
          <datalist id={`tag-value-suggestions-${newKey}`}>
            {(tagKeys as TagKeyValues[] || [])
              .find(tk => tk.key === newKey)?.values
              .map(v => <option key={v} value={v} />)}
          </datalist>
          <button
            onClick={addTag}
            disabled={!newKey.trim()}
            className="p-1.5 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200 disabled:opacity-30"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  )
}
