/**
 * V4 Phase 12b: 콘텐츠 버전 히스토리 패널
 */
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { versionApi, ContentVersion } from '@/api/fonts'
import { useCanvasStore } from '@/store/canvasStore'
import { History, RotateCcw, MessageSquare, X } from 'lucide-react'
import toast from 'react-hot-toast'

interface Props {
  contentId: string
  onClose: () => void
}

export default function VersionHistoryPanel({ contentId, onClose }: Props) {
  const queryClient = useQueryClient()
  const { getCanvasData, initCanvas, contentName } = useCanvasStore()

  const { data: versions = [], isLoading } = useQuery({
    queryKey: ['versions', contentId],
    queryFn: () => versionApi.list(contentId),
    enabled: !!contentId
  })

  // 버전 저장
  const saveMutation = useMutation({
    mutationFn: async (comment: string) => {
      const canvasJson = JSON.stringify(getCanvasData())
      return versionApi.create(contentId, { canvasJson, comment })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['versions', contentId] })
      toast.success('버전이 저장되었습니다')
      setComment('')
    },
    onError: () => toast.error('버전 저장 실패')
  })

  // 버전 복원
  const restoreMutation = useMutation({
    mutationFn: (versionId: string) => versionApi.restore(versionId),
    onSuccess: async (_, versionId) => {
      // 복원된 버전의 데이터 로드
      const version = await versionApi.get(versionId)
      if (version.canvasData) {
        initCanvas(version.canvasData as any, contentId, contentName)
        toast.success(`v${version.version}으로 복원되었습니다`)
      }
      queryClient.invalidateQueries({ queryKey: ['versions', contentId] })
    },
    onError: () => toast.error('버전 복원 실패')
  })

  const [comment, setComment] = useState('')

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr)
    return d.toLocaleDateString('ko-KR', {
      month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    })
  }

  return (
    <div className="fixed right-0 top-12 bottom-0 w-72 bg-white border-l border-gray-200 shadow-lg z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-gray-500" />
          <h3 className="text-sm font-semibold text-gray-700">버전 히스토리</h3>
        </div>
        <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Save new version */}
      <div className="p-3 border-b border-gray-100">
        <div className="flex gap-2">
          <input
            type="text"
            value={comment}
            onChange={e => setComment(e.target.value)}
            placeholder="버전 메모 (선택)"
            className="flex-1 text-xs px-2 py-1.5 border rounded bg-gray-50"
          />
          <button
            onClick={() => saveMutation.mutate(comment)}
            disabled={saveMutation.isPending}
            className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap"
          >
            {saveMutation.isPending ? '저장...' : '버전 저장'}
          </button>
        </div>
      </div>

      {/* Version list */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="p-4 text-center text-xs text-gray-400">로딩 중...</div>
        ) : versions.length === 0 ? (
          <div className="p-4 text-center text-xs text-gray-400">
            저장된 버전이 없습니다.<br />
            '버전 저장' 버튼을 클릭하여<br />
            현재 상태를 기록하세요.
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {versions.map((v: ContentVersion) => (
              <div key={v.id} className="p-3 hover:bg-gray-50 group">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-blue-600">v{v.version}</span>
                  <span className="text-xs text-gray-400">{formatDate(v.createdAt)}</span>
                </div>
                {v.comment && (
                  <div className="flex items-start gap-1 mb-2">
                    <MessageSquare className="w-3 h-3 text-gray-400 mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-gray-600">{v.comment}</p>
                  </div>
                )}
                <button
                  onClick={() => {
                    if (confirm(`v${v.version}으로 복원하시겠습니까?\n현재 상태는 자동으로 백업됩니다.`)) {
                      restoreMutation.mutate(v.id)
                    }
                  }}
                  className="opacity-0 group-hover:opacity-100 flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 transition-opacity"
                >
                  <RotateCcw className="w-3 h-3" />
                  이 버전으로 복원
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
