import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Plus, Edit2, Trash2, LayoutTemplate, Monitor } from 'lucide-react'
import { layoutApi } from '@/api/layouts'
import { PageLoader } from '@/components/ui/LoadingSpinner'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import Modal from '@/components/ui/Modal'
import { useAuthStore } from '@/store/authStore'
import toast from 'react-hot-toast'
import { format } from 'date-fns'

const RESOLUTION_PRESETS = [
  { label: 'FHD 가로 (1920×1080)', w: 1920, h: 1080 },
  { label: 'FHD 세로 (1080×1920)', w: 1080, h: 1920 },
  { label: '4K (3840×2160)', w: 3840, h: 2160 },
  { label: 'HD (1280×720)', w: 1280, h: 720 },
]

const ZONE_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#06b6d4', '#f97316', '#84cc16', '#ec4899', '#6366f1'
]

interface LayoutItem {
  id: string
  name: string
  description?: string
  baseWidth: number
  baseHeight: number
  createdAt: string
  updatedAt: string
  creator?: { username: string }
  _count?: { zones: number; schedules: number }
  zones?: Array<{ id: string; x: number; y: number; width: number; height: number; zIndex: number; bgColor?: string }>
}

function MiniPreview({ zones, width, height }: {
  zones: LayoutItem['zones']
  width: number
  height: number
}) {
  if (!zones || zones.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center text-gray-400">
        <LayoutTemplate className="w-8 h-8 opacity-30" />
      </div>
    )
  }

  const aspect = width / height
  const previewW = 200
  const previewH = Math.round(previewW / aspect)

  return (
    <div
      className="relative bg-gray-800 overflow-hidden mx-auto"
      style={{ width: previewW, height: previewH }}
    >
      {[...zones].sort((a, b) => a.zIndex - b.zIndex).map((zone, idx) => (
        <div
          key={zone.id}
          className="absolute"
          style={{
            left: `${zone.x}%`,
            top: `${zone.y}%`,
            width: `${zone.width}%`,
            height: `${zone.height}%`,
            zIndex: zone.zIndex,
            backgroundColor: (zone.bgColor || ZONE_COLORS[idx % ZONE_COLORS.length]) + '88',
            border: `1px solid ${zone.bgColor || ZONE_COLORS[idx % ZONE_COLORS.length]}`,
          }}
        />
      ))}
    </div>
  )
}

export default function LayoutsPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user } = useAuthStore()
  const canEdit = user?.role !== 'VIEWER'
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<LayoutItem | null>(null)
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [form, setForm] = useState({
    name: '',
    description: '',
    baseWidth: 1920,
    baseHeight: 1080,
  })

  const { data, isLoading } = useQuery({
    queryKey: ['layouts'],
    queryFn: () => layoutApi.getAll({ limit: 50 }),
  })

  // Fetch zones for hovered layout
  const { data: hoveredLayout } = useQuery({
    queryKey: ['layout', hoveredId],
    queryFn: () => layoutApi.getById(hoveredId!),
    enabled: !!hoveredId,
    staleTime: 30000,
  })

  const createMutation = useMutation({
    mutationFn: layoutApi.create,
    onSuccess: (created: LayoutItem) => {
      queryClient.invalidateQueries({ queryKey: ['layouts'] })
      setCreateModalOpen(false)
      setForm({ name: '', description: '', baseWidth: 1920, baseHeight: 1080 })
      toast.success('레이아웃이 생성되었습니다')
      navigate(`/layouts/${created.id}`)
    },
    onError: () => toast.error('생성에 실패했습니다'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => layoutApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['layouts'] })
      setDeleteTarget(null)
      toast.success('레이아웃이 삭제되었습니다')
    },
    onError: () => toast.error('삭제에 실패했습니다'),
  })

  const layouts: LayoutItem[] = data?.items || []

  if (isLoading) return <PageLoader />

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">레이아웃 관리</h1>
          <p className="text-gray-500 text-sm mt-1">멀티존 화면 레이아웃을 디자인하고 관리하세요</p>
        </div>
        {canEdit && (
          <button className="btn-primary" onClick={() => setCreateModalOpen(true)}>
            <Plus className="w-4 h-4" />
            레이아웃 생성
          </button>
        )}
      </div>

      {layouts.length === 0 ? (
        <div className="card text-center py-16">
          <LayoutTemplate className="w-16 h-16 text-gray-200 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-500 mb-2">레이아웃이 없습니다</h3>
          <p className="text-gray-400 text-sm mb-6">멀티존 레이아웃을 생성하여 화면을 분할해 보세요</p>
          {canEdit && (
            <button className="btn-primary mx-auto" onClick={() => setCreateModalOpen(true)}>
              <Plus className="w-4 h-4" /> 첫 레이아웃 만들기
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-5">
          {layouts.map(layout => (
            <div
              key={layout.id}
              className="card overflow-hidden hover:shadow-lg transition-shadow cursor-pointer group"
              onMouseEnter={() => setHoveredId(layout.id)}
              onMouseLeave={() => setHoveredId(null)}
              onClick={() => navigate(`/layouts/${layout.id}`)}
            >
              {/* Mini Preview */}
              <div className="bg-gray-900 p-4 h-36 flex items-center justify-center">
                {hoveredId === layout.id && hoveredLayout?.zones ? (
                  <MiniPreview
                    zones={hoveredLayout.zones}
                    width={layout.baseWidth}
                    height={layout.baseHeight}
                  />
                ) : (
                  <div className="flex flex-col items-center gap-2 text-gray-500">
                    <Monitor className="w-10 h-10 opacity-40" />
                    <span className="text-xs opacity-50">{layout.baseWidth}×{layout.baseHeight}</span>
                  </div>
                )}
              </div>

              {/* Card Body */}
              <div className="p-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="font-semibold text-gray-800 truncate flex-1">{layout.name}</h3>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full font-medium">
                      {layout._count?.zones || 0}존
                    </span>
                  </div>
                </div>

                <p className="text-xs text-gray-400 mb-1">
                  {layout.baseWidth}×{layout.baseHeight}
                </p>

                {layout.description && (
                  <p className="text-xs text-gray-500 truncate mb-2">{layout.description}</p>
                )}

                <p className="text-xs text-gray-400">
                  {format(new Date(layout.updatedAt), 'yyyy-MM-dd')} 수정
                </p>

                {canEdit && (
                  <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100">
                    <button
                      className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                      onClick={e => { e.stopPropagation(); navigate(`/layouts/${layout.id}`) }}
                    >
                      <Edit2 className="w-3.5 h-3.5" /> 편집
                    </button>
                    <button
                      className="px-3 py-1.5 text-xs text-red-500 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-100"
                      onClick={e => { e.stopPropagation(); setDeleteTarget(layout) }}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      <Modal
        isOpen={createModalOpen}
        onClose={() => { setCreateModalOpen(false) }}
        title="레이아웃 생성"
        size="md"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setCreateModalOpen(false)}>취소</button>
            <button
              className="btn-primary"
              onClick={() => createMutation.mutate({
                name: form.name,
                description: form.description,
                baseWidth: form.baseWidth,
                baseHeight: form.baseHeight,
              })}
              disabled={!form.name || createMutation.isPending}
            >
              {createMutation.isPending ? '생성 중...' : '생성 및 편집'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="label">레이아웃 이름 *</label>
            <input
              type="text"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="input"
              placeholder="레이아웃 이름"
              autoFocus
            />
          </div>

          <div>
            <label className="label">해상도 프리셋</label>
            <div className="grid grid-cols-2 gap-2">
              {RESOLUTION_PRESETS.map(preset => (
                <button
                  key={preset.label}
                  type="button"
                  className={`px-3 py-2 text-xs border rounded-lg transition-colors text-left
                    ${form.baseWidth === preset.w && form.baseHeight === preset.h
                      ? 'bg-blue-50 border-blue-400 text-blue-700 font-medium'
                      : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                  onClick={() => setForm(f => ({ ...f, baseWidth: preset.w, baseHeight: preset.h }))}
                >
                  {preset.label}
                </button>
              ))}
            </div>
            <div className="flex gap-2 mt-2">
              <div className="flex-1">
                <label className="text-xs text-gray-500 mb-1 block">너비</label>
                <input
                  type="number"
                  value={form.baseWidth}
                  onChange={e => setForm(f => ({ ...f, baseWidth: parseInt(e.target.value) || 1920 }))}
                  className="input text-sm"
                />
              </div>
              <div className="flex-1">
                <label className="text-xs text-gray-500 mb-1 block">높이</label>
                <input
                  type="number"
                  value={form.baseHeight}
                  onChange={e => setForm(f => ({ ...f, baseHeight: parseInt(e.target.value) || 1080 }))}
                  className="input text-sm"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="label">설명 (선택)</label>
            <input
              type="text"
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              className="input"
              placeholder="레이아웃 설명"
            />
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        title="레이아웃 삭제"
        message={`"${deleteTarget?.name}"을(를) 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`}
        confirmLabel="삭제"
        isLoading={deleteMutation.isPending}
      />
    </div>
  )
}
