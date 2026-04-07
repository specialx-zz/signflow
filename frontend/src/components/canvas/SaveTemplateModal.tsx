/**
 * V4 Phase 12b: 현재 캔버스를 템플릿으로 저장하는 모달
 */
import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { canvasApi } from '@/api/canvas'
import { useCanvasStore } from '@/store/canvasStore'
import { X, Save } from 'lucide-react'
import toast from 'react-hot-toast'

interface Props {
  onClose: () => void
}

const CATEGORIES = [
  '공지사항', '프로모션', '메뉴보드', '안내', '교육',
  '엔터테인먼트', '대시보드', '기타'
]

export default function SaveTemplateModal({ onClose }: Props) {
  const { getCanvasData, contentName } = useCanvasStore()
  const [name, setName] = useState(contentName || '')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('기타')
  const [tags, setTags] = useState('')
  const [isPublic, setIsPublic] = useState(false)

  const saveMutation = useMutation({
    mutationFn: () => {
      const canvasJson = JSON.stringify(getCanvasData())
      return canvasApi.saveTemplate({
        name,
        description,
        category,
        tags,
        isPublic,
        canvasJson
      })
    },
    onSuccess: () => {
      toast.success('템플릿이 저장되었습니다')
      onClose()
    },
    onError: () => toast.error('템플릿 저장 실패')
  })

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-[420px] max-h-[80vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-800">템플릿으로 저장</h3>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Name */}
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">템플릿 이름</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="템플릿 이름을 입력하세요"
            />
          </div>

          {/* Description */}
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">설명</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none focus:ring-2 focus:ring-blue-500"
              rows={3}
              placeholder="선택사항"
            />
          </div>

          {/* Category */}
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">카테고리</label>
            <select
              value={category}
              onChange={e => setCategory(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
            >
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {/* Tags */}
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">태그</label>
            <input
              type="text"
              value={tags}
              onChange={e => setTags(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              placeholder="쉼표로 구분 (예: 매장, 카페, 음식)"
            />
          </div>

          {/* Public */}
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={isPublic}
              onChange={e => setIsPublic(e.target.checked)}
              className="rounded border-gray-300"
            />
            <span className="text-sm text-gray-700">다른 테넌트에도 공개</span>
          </label>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 p-4 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            취소
          </button>
          <button
            onClick={() => saveMutation.mutate()}
            disabled={!name.trim() || saveMutation.isPending}
            className="flex items-center gap-1.5 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saveMutation.isPending ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>
    </div>
  )
}
