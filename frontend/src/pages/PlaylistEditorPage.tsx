import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  DndContext, DragEndEvent, closestCenter, useSensor, useSensors, PointerSensor
} from '@dnd-kit/core'
import {
  SortableContext, verticalListSortingStrategy, useSortable, arrayMove
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  ArrowLeft, GripVertical, Trash2, Clock, Plus, Film, Save, Eye, Check, Sparkles, ChevronDown
} from 'lucide-react'
import { playlistApi } from '@/api/playlists'
import { contentApi } from '@/api/content'
import { PlaylistItem, Content } from '@/types'
import { PageLoader } from '@/components/ui/LoadingSpinner'
import Modal from '@/components/ui/Modal'
import StatusBadge from '@/components/ui/StatusBadge'
import ContentPreviewOverlay from '@/components/ui/ContentPreviewOverlay'
import toast from 'react-hot-toast'

import { typeIcons, typeColors, defaultTypeIcon, defaultTypeColor } from '@/utils/contentTypes'

// ─── Transition types ────────────────────────────────────────────────────────
const TRANSITION_OPTIONS = [
  { value: 'none',        label: '없음',        emoji: '✂️' },
  { value: 'fade',        label: '페이드',      emoji: '🌫️' },
  { value: 'slide-left',  label: '슬라이드 ←',  emoji: '⬅️' },
  { value: 'slide-right', label: '슬라이드 →',  emoji: '➡️' },
  { value: 'slide-up',    label: '슬라이드 ↑',  emoji: '⬆️' },
  { value: 'zoom-in',     label: '줌 인',       emoji: '🔍' },
  { value: 'blur',        label: '블러',        emoji: '💫' },
] as const

function getTransitionLabel(value: string) {
  return TRANSITION_OPTIONS.find(o => o.value === value) ?? TRANSITION_OPTIONS[1]
}

function parseItemTransition(item: PlaylistItem): string {
  if (!item.settings) return 'fade'
  try { return (JSON.parse(item.settings) as { transition?: string }).transition ?? 'fade' } catch { return 'fade' }
}

// Between-items transition picker badge
function TransitionBadge({
  item,
  onUpdate,
  isLoop = false,
}: {
  item: PlaylistItem
  onUpdate: (itemId: string, transition: string) => void
  isLoop?: boolean   // true when this is the last→first wrap-around badge
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const current = parseItemTransition(item)
  const opt = getTransitionLabel(current)

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div className="flex items-center justify-center py-1" ref={ref}>
      {/* Connecting line + badge layout */}
      <div className="flex items-center gap-2 w-full px-4">
        <div className={`flex-1 border-t border-dashed ${isLoop ? 'border-violet-300' : 'border-gray-200'}`} />

        <div className="relative flex-shrink-0">
          <button
            onClick={() => setOpen(v => !v)}
            className={`flex items-center gap-1.5 px-3 py-1 text-xs rounded-full border border-dashed
              bg-white shadow-sm transition-colors
              ${isLoop
                ? 'border-violet-300 text-violet-500 hover:border-violet-500 hover:bg-violet-50 hover:text-violet-700'
                : 'border-gray-300 text-gray-500 hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50'
              }`}
            title={isLoop ? '반복 시 전환 효과 (마지막 → 처음)' : '전환 효과 선택'}
          >
            {isLoop ? (
              <svg className="w-3 h-3" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M2 8a6 6 0 1 0 6-6" strokeLinecap="round"/>
                <path d="M5 2L2 5l3 3" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            ) : (
              <Sparkles className="w-3 h-3" />
            )}
            <span>{opt.emoji} {opt.label}</span>
            <ChevronDown className="w-3 h-3" />
          </button>

          {open && (
            <div className="absolute left-1/2 -translate-x-1/2 top-7 z-50 w-44 bg-white rounded-xl shadow-lg border border-gray-100 py-1">
              {isLoop && (
                <p className="px-3 py-1 text-[10px] text-gray-400 border-b border-gray-100 mb-1">
                  ↺ 마지막 → 처음 반복 전환
                </p>
              )}
              {TRANSITION_OPTIONS.map(o => (
                <button
                  key={o.value}
                  onClick={() => { onUpdate(item.id, o.value); setOpen(false) }}
                  className={`w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 hover:bg-indigo-50 transition-colors
                    ${o.value === current ? 'text-indigo-600 font-semibold bg-indigo-50' : 'text-gray-700'}`}
                >
                  <span>{o.emoji}</span>
                  <span>{o.label}</span>
                  {o.value === current && <Check className="w-3 h-3 ml-auto" />}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className={`flex-1 border-t border-dashed ${isLoop ? 'border-violet-300' : 'border-gray-200'}`} />
      </div>
    </div>
  )
}

function SortableItem({
  item, onRemove, onDurationChange, onPreview, onTransitionChange, nextItem, isLoop
}: {
  item: PlaylistItem
  onRemove: (id: string) => void
  onDurationChange: (id: string, duration: number) => void
  onPreview: (content: Content) => void
  onTransitionChange: (itemId: string, transition: string) => void
  nextItem?: PlaylistItem  // the item after this one — badge controls its transition
  isLoop?: boolean         // true when nextItem is the first item (wrap-around)
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }
  const Icon = typeIcons[item.content.type] || defaultTypeIcon
  const colorClass = typeColors[item.content.type] || defaultTypeColor
  const isTemp = item.id.startsWith('temp-')

  return (
    <div ref={setNodeRef} style={style}>
      <div
        className={`flex items-center gap-3 p-3 bg-white border rounded-lg transition-all
          ${isTemp ? 'border-blue-300 bg-blue-50/30 animate-pulse' : 'border-gray-200 hover:border-blue-300 hover:shadow-sm'}`}
      >
        <button {...attributes} {...listeners} className="cursor-grab text-gray-300 hover:text-gray-500 flex-shrink-0">
          <GripVertical className="w-5 h-5" />
        </button>

        {/* Thumbnail */}
        <div className="w-20 h-14 rounded-lg overflow-hidden flex-shrink-0 bg-gray-100">
          {item.content.type === 'IMAGE' ? (
            <img src={item.content.url} className="w-full h-full object-cover" alt={item.content.name} />
          ) : item.content.type === 'VIDEO' ? (
            <video src={item.content.url} className="w-full h-full object-cover" muted preload="metadata" />
          ) : (
            <div className={`w-full h-full flex items-center justify-center ${colorClass}`}>
              <Icon className="w-6 h-6" />
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-800 truncate">{item.content.name}</p>
          <StatusBadge status={item.content.type} className="mt-0.5" />
        </div>

        {/* Eye preview button */}
        <button
          className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors flex-shrink-0"
          onClick={() => onPreview(item.content)}
          title="미리보기"
        >
          <Eye className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-1 flex-shrink-0">
          <Clock className="w-4 h-4 text-gray-400" />
          <input
            type="number"
            value={item.duration}
            onChange={e => onDurationChange(item.id, parseInt(e.target.value) || 5)}
            className="w-16 text-center border border-gray-200 rounded px-2 py-1 text-sm"
            min={1}
            max={3600}
            disabled={isTemp}
          />
          <span className="text-xs text-gray-400">초</span>
        </div>
        <button
          className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0"
          onClick={() => onRemove(item.id)}
          disabled={isTemp}
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Transition badge between this item and the next — controls nextItem's enter transition */}
      {nextItem && !isTemp && !nextItem.id.startsWith('temp-') && (
        <TransitionBadge item={nextItem} onUpdate={onTransitionChange} isLoop={isLoop} />
      )}
    </div>
  )
}

export default function PlaylistEditorPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [addContentOpen, setAddContentOpen] = useState(false)
  const [localItems, setLocalItems] = useState<PlaylistItem[] | null>(null)
  const [hasChanges, setHasChanges] = useState(false)
  const [previewContent, setPreviewContent] = useState<Content | null>(null)
  const [contentSearch, setContentSearch] = useState('')
  const [contentTypeFilter, setContentTypeFilter] = useState<string>('ALL')
  const [addingContentId, setAddingContentId] = useState<string | null>(null)
  const isDraggingRef = useRef(false)

  const sensors = useSensors(useSensor(PointerSensor))

  const { data: playlist, isLoading } = useQuery({
    queryKey: ['playlist', id],
    queryFn: () => playlistApi.getById(id!),
    enabled: !!id
  })

  // 서버 데이터 변경 시 localItems 동기화 (드래그 중이 아닐 때만)
  useEffect(() => {
    if (playlist && !isDraggingRef.current && !hasChanges) {
      setLocalItems(playlist.items)
    }
  }, [playlist, hasChanges])

  const { data: contentData } = useQuery({
    queryKey: ['content-all'],
    queryFn: () => contentApi.getAll({ limit: 100 }),
    enabled: addContentOpen
  })

  // Filter logic
  const filteredContent = (contentData?.items ?? []).filter((c: Content) => {
    const matchSearch = c.name.toLowerCase().includes(contentSearch.toLowerCase())
    const matchType = contentTypeFilter === 'ALL' ||
      (contentTypeFilter === 'IMAGE' && c.type === 'IMAGE') ||
      (contentTypeFilter === 'VIDEO' && c.type === 'VIDEO') ||
      (contentTypeFilter === 'OTHER' && !['IMAGE', 'VIDEO'].includes(c.type))
    return matchSearch && matchType
  })

  // 콘텐츠 추가 - 즉시 낙관적 업데이트
  const addItemMutation = useMutation({
    mutationFn: ({ contentId, duration }: { contentId: string; duration: number }) =>
      playlistApi.addItem(id!, { contentId, duration }),

    onMutate: async ({ contentId, duration }) => {
      setAddingContentId(contentId)
      // 모달 즉시 닫기
      setAddContentOpen(false)

      // localItems에 임시 항목 즉시 추가 (서버 응답 기다리지 않음)
      const content = contentData?.items?.find((c: Content) => c.id === contentId)
      if (!content) return

      const tempItem: PlaylistItem = {
        id: `temp-${Date.now()}`,
        contentId,
        content,
        duration,
        order: (localItems?.length ?? 0),
        playlistId: id!,
      }
      setLocalItems(prev => [...(prev ?? []), tempItem])
    },

    onSuccess: () => {
      setAddingContentId(null)
      // 서버 최신 데이터로 동기화 (temp 항목을 실제 항목으로 교체)
      queryClient.invalidateQueries({ queryKey: ['playlist', id] })
      toast.success('콘텐츠가 추가되었습니다')
    },

    onError: () => {
      setAddingContentId(null)
      // 실패 시 롤백 - 서버 데이터로 복원
      queryClient.invalidateQueries({ queryKey: ['playlist', id] })
      toast.error('추가에 실패했습니다')
    }
  })

  // 항목 제거 - 즉시 낙관적 업데이트
  const removeItemMutation = useMutation({
    mutationFn: (itemId: string) => playlistApi.removeItem(id!, itemId),

    onMutate: (itemId) => {
      // 즉시 목록에서 제거
      setLocalItems(prev => prev ? prev.filter(i => i.id !== itemId) : null)
    },

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['playlist', id] })
      toast.success('항목이 제거되었습니다')
    },

    onError: () => {
      // 실패 시 서버 데이터로 복원
      queryClient.invalidateQueries({ queryKey: ['playlist', id] })
      toast.error('제거에 실패했습니다')
    }
  })

  const reorderMutation = useMutation({
    mutationFn: (items: { id: string; order: number }[]) =>
      playlistApi.reorderItems(id!, items),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['playlist', id] })
      setHasChanges(false)
      isDraggingRef.current = false
      toast.success('순서가 저장되었습니다')
    },
    onError: () => {
      toast.error('순서 저장에 실패했습니다')
      setHasChanges(false)
      isDraggingRef.current = false
    }
  })

  const updateItemMutation = useMutation({
    mutationFn: ({ itemId, duration, settings }: { itemId: string; duration?: number; settings?: Record<string, unknown> }) =>
      playlistApi.updateItem(id!, itemId, { ...(duration !== undefined && { duration }), ...(settings && { settings }) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['playlist', id] })
    }
  })

  const handleDragStart = () => {
    isDraggingRef.current = true
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id || !localItems) {
      isDraggingRef.current = false
      return
    }

    const oldIndex = localItems.findIndex(i => i.id === active.id)
    const newIndex = localItems.findIndex(i => i.id === over.id)
    const newItems = arrayMove(localItems, oldIndex, newIndex)
    setLocalItems(newItems)
    setHasChanges(true)
    isDraggingRef.current = true
  }

  const handleSaveOrder = () => {
    if (!localItems) return
    reorderMutation.mutate(localItems.map((item, idx) => ({ id: item.id, order: idx })))
  }

  const handleRemove = (itemId: string) => {
    if (itemId.startsWith('temp-')) return // 임시 항목은 제거 불가
    removeItemMutation.mutate(itemId)
  }

  const handleDurationChange = (itemId: string, duration: number) => {
    if (itemId.startsWith('temp-')) return
    setLocalItems(prev => prev ? prev.map(i => i.id === itemId ? { ...i, duration } : i) : null)
    updateItemMutation.mutate({ itemId, duration })
  }

  const handleTransitionChange = (itemId: string, transition: string) => {
    if (itemId.startsWith('temp-')) return
    // Optimistically update local state
    setLocalItems(prev => prev ? prev.map(i => {
      if (i.id !== itemId) return i
      let current: Record<string, unknown> = {}
      try { if (i.settings) current = JSON.parse(i.settings) } catch { /* ignore */ }
      return { ...i, settings: JSON.stringify({ ...current, transition }) }
    }) : null)
    updateItemMutation.mutate({ itemId, settings: { transition } })
  }

  if (isLoading) return <PageLoader />
  if (!playlist) return <div>플레이리스트를 찾을 수 없습니다</div>

  const items = localItems ?? playlist.items ?? []
  const totalDuration = items.reduce((sum: number, item: PlaylistItem) => sum + item.duration, 0)

  const typeFilterTabs = [
    { value: 'ALL', label: '전체' },
    { value: 'IMAGE', label: '이미지' },
    { value: 'VIDEO', label: '영상' },
    { value: 'OTHER', label: '기타' },
  ]

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button className="btn-ghost p-2" onClick={() => navigate('/playlists')}>
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-800">{playlist.name}</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {items.length}개 항목 · 총 {Math.floor(totalDuration / 60)}분 {totalDuration % 60}초
          </p>
        </div>
        <div className="flex gap-2">
          {hasChanges && (
            <button
              className="btn-primary"
              onClick={handleSaveOrder}
              disabled={reorderMutation.isPending}
            >
              <Save className="w-4 h-4" />
              {reorderMutation.isPending ? '저장 중...' : '순서 저장'}
            </button>
          )}
          <button className="btn-primary" onClick={() => setAddContentOpen(true)}>
            <Plus className="w-4 h-4" />
            콘텐츠 추가
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Playlist items */}
        <div className="lg:col-span-2 space-y-3">
          <div className="card">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">재생 목록 (드래그하여 순서 변경)</h2>
            {items.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <Film className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p className="text-sm">콘텐츠를 추가하세요</p>
              </div>
            ) : (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
                <SortableContext items={items.map((i: PlaylistItem) => i.id)} strategy={verticalListSortingStrategy}>
                  <div className="space-y-2">
                    {items.map((item: PlaylistItem, idx: number) => {
                      const isLast = idx === items.length - 1
                      // For last item, show wrap-around badge pointing to first item (only when 2+ items)
                      const nextItemForBadge = isLast
                        ? (items.length >= 2 ? items[0] : undefined)
                        : items[idx + 1]
                      return (
                        <SortableItem
                          key={item.id}
                          item={item}
                          onRemove={handleRemove}
                          onDurationChange={handleDurationChange}
                          onPreview={setPreviewContent}
                          onTransitionChange={handleTransitionChange}
                          nextItem={nextItemForBadge}
                          isLoop={isLast}
                        />
                      )
                    })}
                  </div>
                </SortableContext>
              </DndContext>
            )}
          </div>
        </div>

        {/* Playlist info */}
        <div className="space-y-4">
          <div className="card">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">플레이리스트 정보</h2>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-500">유형</dt>
                <dd><StatusBadge status={playlist.type} /></dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">항목 수</dt>
                <dd className="font-medium">{items.filter((i: PlaylistItem) => !i.id.startsWith('temp-')).length}개</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">총 재생시간</dt>
                <dd className="font-medium">{Math.floor(totalDuration / 60)}분 {totalDuration % 60}초</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">작성자</dt>
                <dd className="font-medium">{playlist.creator?.username}</dd>
              </div>
            </dl>
          </div>

          <div className="card">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">항목 통계</h2>
            <div className="space-y-2">
              {['IMAGE', 'VIDEO', 'AUDIO', 'HTML', 'DOCUMENT', 'CANVAS'].map(type => {
                const count = items.filter((i: PlaylistItem) => i.content.type === type).length
                if (count === 0) return null
                return (
                  <div key={type} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <StatusBadge status={type} />
                    </div>
                    <span className="text-gray-600 font-medium">{count}개</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Add Content Modal */}
      <Modal
        isOpen={addContentOpen}
        onClose={() => {
          setAddContentOpen(false)
          setContentSearch('')
          setContentTypeFilter('ALL')
        }}
        title="콘텐츠 추가"
        size="lg"
      >
        <div className="space-y-4">
          {/* Search input */}
          <input
            type="text"
            value={contentSearch}
            onChange={e => setContentSearch(e.target.value)}
            placeholder="콘텐츠 이름으로 검색..."
            className="input"
          />

          {/* Type filter tabs */}
          <div className="flex gap-1">
            {typeFilterTabs.map(tab => (
              <button
                key={tab.value}
                onClick={() => setContentTypeFilter(tab.value)}
                className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                  contentTypeFilter === tab.value
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Content grid */}
          <div className="grid grid-cols-2 gap-3 max-h-96 overflow-y-auto">
            {filteredContent.map((content: Content) => {
              const Icon = typeIcons[content.type] || defaultTypeIcon
              const colorClass = typeColors[content.type] || defaultTypeColor
              const isAlreadyAdded = items.some((i: PlaylistItem) => i.contentId === content.id)
              const isThisAdding = addingContentId === content.id

              return (
                <div
                  key={content.id}
                  className={`relative border rounded-lg overflow-hidden transition-colors
                    ${isAlreadyAdded || isThisAdding
                      ? 'opacity-60 cursor-not-allowed'
                      : 'cursor-pointer hover:border-blue-300 hover:shadow-sm'}`}
                >
                  {/* Thumbnail */}
                  <div className="relative aspect-video bg-gray-100 group">
                    {content.type === 'IMAGE' ? (
                      <img src={content.url} alt={content.name} className="w-full h-full object-cover" />
                    ) : content.type === 'VIDEO' ? (
                      <video src={content.url} className="w-full h-full object-cover" muted preload="metadata" />
                    ) : (
                      <div className={`w-full h-full flex items-center justify-center ${colorClass}`}>
                        <Icon className="w-10 h-10" />
                      </div>
                    )}

                    {/* Already added overlay */}
                    {isAlreadyAdded && (
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                        <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                          <Check className="w-5 h-5 text-white" />
                        </div>
                      </div>
                    )}

                    {/* This item being added overlay */}
                    {isThisAdding && (
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                        <div className="animate-spin w-6 h-6 border-2 border-white border-t-transparent rounded-full" />
                      </div>
                    )}

                    {/* Hover overlay with action buttons */}
                    {!isAlreadyAdded && !isThisAdding && (
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                        <button
                          className="p-2 bg-white/20 hover:bg-white/40 text-white rounded-full transition-colors"
                          onClick={e => { e.stopPropagation(); setPreviewContent(content) }}
                          title="미리보기"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          className="p-2 bg-blue-500/80 hover:bg-blue-600 text-white rounded-full transition-colors"
                          onClick={e => { e.stopPropagation(); addItemMutation.mutate({ contentId: content.id, duration: 10 }) }}
                          title="추가"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Name and badge */}
                  <div className="p-2">
                    <p className="text-xs font-medium text-gray-800 truncate">{content.name}</p>
                    <StatusBadge status={content.type} className="mt-0.5" />
                  </div>
                </div>
              )
            })}
            {filteredContent.length === 0 && (
              <div className="col-span-2 text-center py-8 text-gray-400 text-sm">
                {contentData?.items?.length ? '검색 결과가 없습니다' : '업로드된 콘텐츠가 없습니다'}
              </div>
            )}
          </div>
        </div>
      </Modal>

      {/* Full-screen content preview */}
      <ContentPreviewOverlay content={previewContent} onClose={() => setPreviewContent(null)} />
    </div>
  )
}
