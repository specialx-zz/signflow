/**
 * V4 Phase 12a: 캔버스 콘텐츠 목록 페이지
 */
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, Paintbrush, Clock } from 'lucide-react'
import { canvasApi, CanvasContentItem } from '@/api/canvas'
import { PageLoader } from '@/components/ui/LoadingSpinner'
import EmptyState from '@/components/ui/EmptyState'
import { useAuthStore } from '@/store/authStore'
import { useDebounce } from '@/hooks/useDebounce'
import { format } from 'date-fns'

export default function CanvasListPage() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const canEdit = user?.role !== 'VIEWER'
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search)
  const [page, setPage] = useState(1)

  const { data, isLoading } = useQuery({
    queryKey: ['canvases', { page, search: debouncedSearch }],
    queryFn: () => canvasApi.list({ page, limit: 20, search: debouncedSearch || undefined })
  })

  const items: CanvasContentItem[] = data?.items || []
  const pagination = data?.pagination

  if (isLoading) return <PageLoader />

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">캔버스 에디터</h1>
          <p className="text-gray-500 text-sm mt-1">드래그앤드롭으로 디지털 사이니지 콘텐츠를 제작합니다</p>
        </div>
        {canEdit && (
          <button
            className="btn-primary"
            onClick={() => navigate('/canvas/editor')}
          >
            <Plus className="w-4 h-4" />
            새 캔버스
          </button>
        )}
      </div>

      {/* Search */}
      <div className="card p-4">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="캔버스 검색..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="input pl-9"
          />
        </div>
      </div>

      {/* Content */}
      {items.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={Paintbrush}
            title="캔버스가 없습니다"
            description="새 캔버스를 만들어 디지털 사이니지 콘텐츠를 제작해보세요"
            action={
              canEdit ? (
                <button className="btn-primary" onClick={() => navigate('/canvas/editor')}>
                  <Plus className="w-4 h-4" /> 새 캔버스 만들기
                </button>
              ) : undefined
            }
          />
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {items.map(item => (
            <div
              key={item.id}
              onClick={() => navigate(`/canvas/editor/${item.id}`)}
              className="card p-4 group hover:shadow-md transition-shadow cursor-pointer"
            >
              <div className="w-full aspect-video rounded-lg bg-gray-900 flex items-center justify-center mb-3 overflow-hidden">
                {item.thumbnail ? (
                  <img src={item.thumbnail} alt={item.name} className="w-full h-full object-cover" />
                ) : (
                  <Paintbrush className="w-10 h-10 text-gray-600" />
                )}
              </div>
              <p className="text-sm font-medium text-gray-800 truncate">{item.name}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-gray-400">
                  {item.width}×{item.height}
                </span>
                <span className="text-xs text-gray-300">·</span>
                <span className="text-xs text-gray-400 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {format(new Date(item.updatedAt), 'MM/dd HH:mm')}
                </span>
              </div>
              {item.creator && (
                <p className="text-xs text-gray-400 mt-1">{item.creator.username}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {pagination && pagination.pages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            className="btn-secondary btn-sm"
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            이전
          </button>
          <span className="text-sm text-gray-600">{page} / {pagination.pages}</span>
          <button
            className="btn-secondary btn-sm"
            onClick={() => setPage(p => Math.min(pagination.pages, p + 1))}
            disabled={page === pagination.pages}
          >
            다음
          </button>
        </div>
      )}
    </div>
  )
}
