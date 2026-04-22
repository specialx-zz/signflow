/**
 * VueSign Phase W1: Canvas v2.0 TopBar
 *
 * 제거:
 *   - 미리보기 (플레이어에서 확인)
 *
 * 유지:
 *   - 제목 편집 + dirty 표시
 *   - Undo/Redo
 *   - 크기 프리셋 (가로/세로 FHD)
 *   - Zoom
 *   - 버전 히스토리 / 템플릿 저장
 *   - 저장 버튼
 */
import {
  ArrowLeft, Save, Undo2, Redo2, ZoomIn, ZoomOut,
  Monitor, Smartphone, History, BookmarkPlus,
} from 'lucide-react'
import { useCanvasStore } from '@/store/canvasStore'
import { useNavigate } from 'react-router-dom'

interface TopBarProps {
  onSave: () => void
  isSaving: boolean
  onToggleVersionHistory?: () => void
  onSaveAsTemplate?: () => void
}

export default function TopBar({ onSave, isSaving, onToggleVersionHistory, onSaveAsTemplate }: TopBarProps) {
  const navigate = useNavigate()
  const {
    contentName, setContentName, isDirty,
    undo, redo, canUndo, canRedo,
    zoom, setZoom,
    canvasData, setCanvasSize,
  } = useCanvasStore()

  const { width, height } = canvasData.canvas

  return (
    <div className="h-12 bg-white border-b border-gray-200 flex items-center px-3 gap-2 flex-shrink-0">
      <button
        onClick={() => navigate('/canvas')}
        className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg"
        title="목록으로"
      >
        <ArrowLeft className="w-5 h-5" />
      </button>

      <input
        type="text"
        value={contentName}
        onChange={e => setContentName(e.target.value)}
        className="text-sm font-semibold text-gray-800 bg-transparent border-none outline-none px-2 py-1 hover:bg-gray-50 rounded max-w-48"
      />
      {isDirty && <span className="text-xs text-orange-500">*</span>}

      <div className="h-5 w-px bg-gray-200 mx-1" />

      <button
        onClick={undo}
        disabled={!canUndo()}
        className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg disabled:opacity-30"
        title="실행취소 (Ctrl+Z)"
      >
        <Undo2 className="w-4 h-4" />
      </button>
      <button
        onClick={redo}
        disabled={!canRedo()}
        className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg disabled:opacity-30"
        title="다시실행 (Ctrl+Y)"
      >
        <Redo2 className="w-4 h-4" />
      </button>

      <div className="h-5 w-px bg-gray-200 mx-1" />

      <div className="flex items-center gap-1">
        <button
          onClick={() => setCanvasSize(1920, 1080)}
          className={`text-xs px-2 py-1 rounded ${width === 1920 && height === 1080 ? 'bg-blue-100 text-blue-700' : 'text-gray-500 hover:bg-gray-100'}`}
          title="가로 FHD"
        >
          <Monitor className="w-3.5 h-3.5 inline mr-1" />
          1920x1080
        </button>
        <button
          onClick={() => setCanvasSize(1080, 1920)}
          className={`text-xs px-2 py-1 rounded ${width === 1080 && height === 1920 ? 'bg-blue-100 text-blue-700' : 'text-gray-500 hover:bg-gray-100'}`}
          title="세로 FHD"
        >
          <Smartphone className="w-3.5 h-3.5 inline mr-1" />
          1080x1920
        </button>
      </div>

      <div className="flex-1" />

      <div className="flex items-center gap-1">
        <button onClick={() => setZoom(zoom - 0.1)} className="p-1 text-gray-400 hover:text-gray-600">
          <ZoomOut className="w-4 h-4" />
        </button>
        <span className="text-xs text-gray-500 w-12 text-center">{Math.round(zoom * 100)}%</span>
        <button onClick={() => setZoom(zoom + 0.1)} className="p-1 text-gray-400 hover:text-gray-600">
          <ZoomIn className="w-4 h-4" />
        </button>
      </div>

      <div className="h-5 w-px bg-gray-200 mx-1" />

      {onToggleVersionHistory && (
        <button
          onClick={onToggleVersionHistory}
          className="flex items-center gap-1 px-2 py-1.5 text-xs text-gray-500 hover:bg-gray-100 rounded-lg"
          title="버전 히스토리"
        >
          <History className="w-4 h-4" />
        </button>
      )}

      {onSaveAsTemplate && (
        <button
          onClick={onSaveAsTemplate}
          className="flex items-center gap-1 px-2 py-1.5 text-xs text-gray-500 hover:bg-gray-100 rounded-lg"
          title="템플릿으로 저장"
        >
          <BookmarkPlus className="w-4 h-4" />
        </button>
      )}

      <button
        onClick={onSave}
        disabled={isSaving}
        className="flex items-center gap-1.5 px-4 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
      >
        <Save className="w-4 h-4" />
        {isSaving ? '저장 중...' : '저장'}
      </button>
    </div>
  )
}
