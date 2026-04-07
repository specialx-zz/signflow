/**
 * V4 Phase 12b: 캔버스 에디터 메인 페이지
 * 버전 히스토리 + 템플릿 저장 통합
 */
import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { canvasApi } from '@/api/canvas'
import { useCanvasStore } from '@/store/canvasStore'
import TopBar from '@/components/canvas/TopBar'
import LeftPanel from '@/components/canvas/LeftPanel'
import RightPanel from '@/components/canvas/RightPanel'
import BottomPageBar from '@/components/canvas/BottomPageBar'
import CanvasStage from '@/components/canvas/CanvasStage'
import VersionHistoryPanel from '@/components/canvas/VersionHistoryPanel'
import SaveTemplateModal from '@/components/canvas/SaveTemplateModal'
import toast from 'react-hot-toast'

export default function CanvasEditorPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [previewOpen, setPreviewOpen] = useState(false)
  const [versionPanelOpen, setVersionPanelOpen] = useState(false)
  const [templateModalOpen, setTemplateModalOpen] = useState(false)

  const {
    initCanvas, contentId, setContentId, contentName,
    getCanvasData, markClean, isDirty
  } = useCanvasStore()

  // 기존 캔버스 로드
  const { data: existingCanvas, isLoading } = useQuery({
    queryKey: ['canvas', id],
    queryFn: () => canvasApi.get(id!),
    enabled: !!id
  })

  useEffect(() => {
    if (id && existingCanvas) {
      initCanvas(existingCanvas.canvasData, existingCanvas.id, existingCanvas.name)
    } else if (!id) {
      initCanvas()
    }
  }, [id, existingCanvas])

  // 저장 mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      const canvasJson = getCanvasData()
      if (contentId) {
        return canvasApi.update(contentId, { name: contentName, canvasJson })
      } else {
        return canvasApi.save({ name: contentName, canvasJson })
      }
    },
    onSuccess: (data) => {
      if (!contentId && data.id) {
        setContentId(data.id)
        navigate(`/canvas/editor/${data.id}`, { replace: true })
      }
      markClean()
      toast.success('저장되었습니다')
    },
    onError: () => toast.error('저장에 실패했습니다')
  })

  // 키보드 단축키
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        useCanvasStore.getState().undo()
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault()
        useCanvasStore.getState().redo()
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        saveMutation.mutate()
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const store = useCanvasStore.getState()
        if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') return
        if (store.selectedElementId) {
          store.deleteElement(store.selectedElementId)
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // 페이지 떠나기 전 확인
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [isDirty])

  if (id && isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-100">
        <div className="text-gray-500">캔버스 로딩 중...</div>
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col bg-gray-100 overflow-hidden">
      <TopBar
        onSave={() => saveMutation.mutate()}
        onPreview={() => setPreviewOpen(!previewOpen)}
        isSaving={saveMutation.isPending}
        onToggleVersionHistory={() => {
          if (contentId) {
            setVersionPanelOpen(!versionPanelOpen)
          } else {
            toast.error('먼저 캔버스를 저장해주세요')
          }
        }}
        onSaveAsTemplate={() => setTemplateModalOpen(true)}
      />
      <div className="flex flex-1 overflow-hidden">
        <LeftPanel />
        <CanvasStage />
        <RightPanel />
      </div>
      <BottomPageBar />

      {/* Version History Panel */}
      {versionPanelOpen && contentId && (
        <VersionHistoryPanel
          contentId={contentId}
          onClose={() => setVersionPanelOpen(false)}
        />
      )}

      {/* Save as Template Modal */}
      {templateModalOpen && (
        <SaveTemplateModal onClose={() => setTemplateModalOpen(false)} />
      )}
    </div>
  )
}
