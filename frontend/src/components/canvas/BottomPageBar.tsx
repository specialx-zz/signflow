/**
 * 캔버스 에디터 하단 페이지 바 — 페이지 탭 + 재생시간
 */
import { Plus, Copy, Trash2 } from 'lucide-react'
import { useCanvasStore } from '@/store/canvasStore'

export default function BottomPageBar() {
  const {
    canvasData, currentPageIndex, setCurrentPage,
    addPage, deletePage, duplicatePage, updatePageDuration
  } = useCanvasStore()

  const pages = canvasData.pages

  return (
    <div className="h-14 bg-white border-t border-gray-200 flex items-center px-3 gap-2 flex-shrink-0 overflow-x-auto">
      {pages.map((page, index) => (
        <div
          key={page.id}
          onClick={() => setCurrentPage(index)}
          className={`group flex items-center gap-2 px-3 py-1.5 rounded-lg cursor-pointer transition-colors min-w-fit ${
            currentPageIndex === index
              ? 'bg-blue-100 border border-blue-300 text-blue-700'
              : 'bg-gray-50 border border-gray-200 text-gray-600 hover:bg-gray-100'
          }`}
        >
          <span className="text-xs font-medium whitespace-nowrap">{page.name}</span>
          <input
            type="number"
            value={page.duration}
            onChange={e => updatePageDuration(index, Number(e.target.value))}
            onClick={e => e.stopPropagation()}
            className="w-10 text-xs text-center py-0.5 border rounded bg-white"
            min={1}
            max={3600}
          />
          <span className="text-xs text-gray-400">초</span>

          {/* Actions on hover */}
          <div className="hidden group-hover:flex items-center gap-0.5 ml-1">
            <button
              onClick={e => { e.stopPropagation(); duplicatePage(index) }}
              className="p-0.5 text-gray-400 hover:text-blue-500 rounded"
              title="복제"
            >
              <Copy className="w-3 h-3" />
            </button>
            {pages.length > 1 && (
              <button
                onClick={e => { e.stopPropagation(); deletePage(index) }}
                className="p-0.5 text-gray-400 hover:text-red-500 rounded"
                title="삭제"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      ))}

      {/* Add page */}
      <button
        onClick={addPage}
        className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-dashed border-gray-300 text-gray-400 hover:text-blue-500 hover:border-blue-300 transition-colors"
      >
        <Plus className="w-3.5 h-3.5" />
        <span className="text-xs">추가</span>
      </button>

      <div className="flex-1" />

      <span className="text-xs text-gray-400">
        {pages.length}개 페이지 · 총 {pages.reduce((sum, p) => sum + p.duration, 0)}초
      </span>
    </div>
  )
}
