import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Plus, ListVideo, Edit2, Trash2, Clock, Film, Eye, FileText } from 'lucide-react'
import { playlistApi } from '@/api/playlists'
import { Playlist } from '@/types'
import { PageLoader } from '@/components/ui/LoadingSpinner'
import StatusBadge from '@/components/ui/StatusBadge'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import EmptyState from '@/components/ui/EmptyState'
import Modal from '@/components/ui/Modal'
import ContentPreviewOverlay from '@/components/ui/ContentPreviewOverlay'
import Pagination from '@/components/ui/Pagination'
import { useAuthStore } from '@/store/authStore'
import toast from 'react-hot-toast'
import { format } from 'date-fns'

const playlistTypes = [
  { value: 'GENERAL', label: '일반' },
  { value: 'NESTED', label: '중첩' },
  { value: 'TAG', label: '태그' },
  { value: 'VIDEOWALL', label: '비디오월' },
  { value: 'SYNCHRONIZED', label: '동기화' },
  { value: 'AUDIENCE', label: '시청자지정' },
  { value: 'ADVERTISEMENT', label: '광고' }
]

const ITEMS_PER_PAGE = 20

const formatDuration = (seconds: number) => {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}분 ${s}초`
}

export default function PlaylistsPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user } = useAuthStore()
  const canEdit = user?.role !== 'VIEWER'
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Playlist | null>(null)
  const [newPlaylist, setNewPlaylist] = useState({ name: '', type: 'GENERAL', description: '' })
  const [previewPlaylist, setPreviewPlaylist] = useState<{ id: string; name: string } | null>(null)
  const [previewContent, setPreviewContent] = useState<{ id: string; name: string; type: string; url: string } | null>(null)
  const [page, setPage] = useState(1)

  const { data, isLoading } = useQuery({
    queryKey: ['playlists'],
    queryFn: () => playlistApi.getAll({ limit: 50 })
  })

  const { data: previewData, isLoading: previewLoading } = useQuery({
    queryKey: ['playlist-preview-modal', previewPlaylist?.id],
    queryFn: () => playlistApi.getById(previewPlaylist!.id),
    enabled: !!previewPlaylist?.id,
    staleTime: 30000,
  })

  const createMutation = useMutation({
    mutationFn: playlistApi.create,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['playlists'] })
      setCreateModalOpen(false)
      setNewPlaylist({ name: '', type: 'GENERAL', description: '' })
      toast.success('플레이리스트가 생성되었습니다')
      navigate(`/playlists/${data.id}`)
    },
    onError: () => toast.error('생성에 실패했습니다')
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => playlistApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['playlists'] })
      setDeleteTarget(null)
      toast.success('플레이리스트가 삭제되었습니다')
    },
    onError: () => toast.error('삭제에 실패했습니다')
  })

  const playlists: Playlist[] = data?.items || []
  const totalPages = Math.ceil(playlists.length / ITEMS_PER_PAGE)
  const paginatedPlaylists = useMemo(
    () => playlists.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE),
    [playlists, page]
  )

  if (isLoading) return <PageLoader />

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">플레이리스트</h1>
          <p className="text-gray-500 text-sm mt-1">콘텐츠를 구성하여 재생 목록을 만드세요</p>
        </div>
        {canEdit && (
          <button className="btn-primary" onClick={() => setCreateModalOpen(true)}>
            <Plus className="w-4 h-4" />
            플레이리스트 생성
          </button>
        )}
      </div>

      {playlists.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={ListVideo}
            title="플레이리스트가 없습니다"
            description="새 플레이리스트를 생성하여 콘텐츠를 구성하세요"
            action={
              canEdit ? (
                <button className="btn-primary" onClick={() => setCreateModalOpen(true)}>
                  <Plus className="w-4 h-4" /> 플레이리스트 생성
                </button>
              ) : undefined
            }
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {paginatedPlaylists.map(playlist => (
            <div
              key={playlist.id}
              className="card group hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => navigate(`/playlists/${playlist.id}`)}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
                  <ListVideo className="w-5 h-5 text-blue-600" />
                </div>
                <StatusBadge status={playlist.type} />
              </div>

              <h3 className="font-semibold text-gray-800 mb-1 truncate">{playlist.name}</h3>
              {playlist.description && (
                <p className="text-sm text-gray-500 mb-3 line-clamp-2">{playlist.description}</p>
              )}

              <div className="flex items-center gap-4 text-sm text-gray-500 mb-4">
                <div className="flex items-center gap-1.5">
                  <Film className="w-4 h-4" />
                  <span>{playlist._count?.items || 0}개 항목</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Clock className="w-4 h-4" />
                  <span>{formatDuration(playlist.duration)}</span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                <span className="text-xs text-gray-400">
                  {format(new Date(playlist.updatedAt), 'yyyy-MM-dd')} 수정
                </span>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    className="p-1.5 text-purple-600 hover:bg-purple-50 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => { e.stopPropagation(); setPreviewPlaylist({ id: playlist.id, name: playlist.name }) }}
                    title="미리보기"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  {canEdit && (
                    <button
                      className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg"
                      onClick={(e) => { e.stopPropagation(); navigate(`/playlists/${playlist.id}`) }}
                      title="편집"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                  )}
                  {canEdit && (
                    <button
                      className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg"
                      onClick={(e) => { e.stopPropagation(); setDeleteTarget(playlist) }}
                      title="삭제"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />

      {/* Create Modal */}
      <Modal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="플레이리스트 생성"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setCreateModalOpen(false)}>취소</button>
            <button
              className="btn-primary"
              onClick={() => createMutation.mutate(newPlaylist)}
              disabled={!newPlaylist.name || createMutation.isPending}
            >
              {createMutation.isPending ? '생성 중...' : '생성'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="label">플레이리스트 이름 *</label>
            <input
              type="text"
              value={newPlaylist.name}
              onChange={e => setNewPlaylist(p => ({ ...p, name: e.target.value }))}
              className="input"
              placeholder="플레이리스트 이름을 입력하세요"
            />
          </div>
          <div>
            <label className="label">유형</label>
            <select
              value={newPlaylist.type}
              onChange={e => setNewPlaylist(p => ({ ...p, type: e.target.value }))}
              className="select"
            >
              {playlistTypes.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">설명</label>
            <textarea
              value={newPlaylist.description}
              onChange={e => setNewPlaylist(p => ({ ...p, description: e.target.value }))}
              className="input"
              rows={3}
              placeholder="플레이리스트 설명 (선택사항)"
            />
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        title="플레이리스트 삭제"
        message={`"${deleteTarget?.name}"을(를) 삭제하시겠습니까?`}
        confirmLabel="삭제"
        isLoading={deleteMutation.isPending}
      />

      {/* Preview Modal */}
      <Modal
        isOpen={!!previewPlaylist}
        onClose={() => setPreviewPlaylist(null)}
        title={`미리보기 — ${previewPlaylist?.name}`}
        size="lg"
      >
        {previewLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full" />
          </div>
        ) : !previewData?.items?.length ? (
          <div className="text-center py-12 text-gray-400">
            <Film className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm">콘텐츠가 없습니다</p>
          </div>
        ) : (
          <div>
            <p className="text-sm text-gray-500 mb-4">
              {previewData.items.length}개 항목 · 총 {Math.floor(previewData.items.reduce((s: number, i: { duration: number }) => s + i.duration, 0) / 60)}분{' '}
              {previewData.items.reduce((s: number, i: { duration: number }) => s + i.duration, 0) % 60}초
            </p>
            <div className="grid grid-cols-3 gap-3 max-h-[60vh] overflow-y-auto">
              {previewData.items.map((item: { id: string; content: { id: string; name: string; type: string; url: string }; duration: number }, idx: number) => (
                <div
                  key={item.id}
                  className="cursor-pointer group"
                  onClick={() => setPreviewContent(item.content)}
                >
                  <div className="relative aspect-video bg-gray-100 rounded-lg overflow-hidden border border-gray-200 group-hover:border-blue-400 group-hover:shadow-md transition-all">
                    {item.content.type === 'IMAGE' ? (
                      <img src={item.content.url} alt={item.content.name} className="w-full h-full object-cover" />
                    ) : item.content.type === 'VIDEO' ? (
                      <video src={item.content.url} className="w-full h-full object-cover" muted preload="metadata" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400">
                        <FileText className="w-8 h-8" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                      <Eye className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" />
                    </div>
                    <div className="absolute top-1 left-1 w-5 h-5 bg-black/60 text-white text-[10px] rounded-full flex items-center justify-center font-bold">
                      {idx + 1}
                    </div>
                    <div className="absolute bottom-1 right-1 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded-full">
                      {item.duration}초
                    </div>
                  </div>
                  <p className="text-xs text-gray-600 mt-1.5 truncate">{item.content.name}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </Modal>

      <ContentPreviewOverlay content={previewContent} onClose={() => setPreviewContent(null)} />
    </div>
  )
}
