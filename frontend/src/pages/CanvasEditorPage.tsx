/**
 * VueSign Phase W1: Canvas v2.0 Editor Page
 *
 * 제거된 기능:
 *   - BottomPageBar (페이지 개념 제거)
 *   - 미리보기 모달 (현 단계에서는 저장 후 플레이어에서 확인)
 *
 * 유지된 기능:
 *   - 저장/업데이트
 *   - 단축키 (Ctrl+S/Ctrl+Z/Ctrl+Y/Delete)
 *   - 버전 히스토리 패널
 *   - 템플릿으로 저장 모달
 */
import { useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { canvasApi } from '@/api/canvas'
import { weatherApi } from '@/api/weather'
import { useCanvasStore } from '@/store/canvasStore'
import TopBar from '@/components/canvas/TopBar'
import LeftPanel from '@/components/canvas/LeftPanel'
import RightPanel from '@/components/canvas/RightPanel'
import CanvasStage from '@/components/canvas/CanvasStage'
import VersionHistoryPanel from '@/components/canvas/VersionHistoryPanel'
import SaveTemplateModal from '@/components/canvas/SaveTemplateModal'
import toast from 'react-hot-toast'

export default function CanvasEditorPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [versionPanelOpen, setVersionPanelOpen] = useState(false)
  const [templateModalOpen, setTemplateModalOpen] = useState(false)

  const {
    initCanvas, contentId, setContentId, contentName,
    getCanvasData, markClean, isDirty, fillMissingWidgetLocations,
  } = useCanvasStore()

  // 기존 캔버스 로드
  const { data: existingCanvas, isLoading } = useQuery({
    queryKey: ['canvas', id],
    queryFn: () => canvasApi.get(id!),
    enabled: !!id,
  })

  // 위젯 기본 위치(첫 번째 WeatherLocation) 프리페치
  const { data: locationsData } = useQuery({
    queryKey: ['weather.locations'],
    queryFn: () => weatherApi.listLocations(),
    staleTime: 60 * 60 * 1000,
  })

  useEffect(() => {
    if (id && existingCanvas) {
      initCanvas(existingCanvas.canvasData, existingCanvas.id, existingCanvas.name)
    } else if (!id) {
      initCanvas()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, existingCanvas])

  // 기존 캔버스의 locationId 누락 위젯에 자동으로 기본 위치 채워주기.
  // 캔버스가 로드되고 위치 목록이 준비되면 한 번만 실행.
  useEffect(() => {
    const defaultLocationId = locationsData?.locations?.[0]?.id
    if (!defaultLocationId) return
    // initCanvas 가 끝난 직후 실행되어야 하므로 microtask 로 지연
    const patched = fillMissingWidgetLocations(defaultLocationId)
    if (patched > 0) {
      toast.success(`${patched}개 위젯에 기본 위치를 자동 설정했습니다. 저장하면 반영됩니다.`)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existingCanvas, locationsData])

  // 저장
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
    onError: () => toast.error('저장에 실패했습니다'),
  })

  // 단축키
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
        const tag = (e.target as HTMLElement).tagName
        if (tag === 'INPUT' || tag === 'TEXTAREA') return
        const store = useCanvasStore.getState()
        if (store.selectedElementId) {
          store.deleteElement(store.selectedElementId)
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 떠나기 전 확인
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

      {versionPanelOpen && contentId && (
        <VersionHistoryPanel
          contentId={contentId}
          onClose={() => setVersionPanelOpen(false)}
        />
      )}

      {templateModalOpen && (
        <SaveTemplateModal onClose={() => setTemplateModalOpen(false)} />
      )}
    </div>
  )
}
