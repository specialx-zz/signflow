import { useState, useRef, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Upload, Search, Grid, List, Trash2, Edit2, Filter,
  FolderOpen, Plus,
  Clock, Calendar, Ban, CheckCircle, AlertTriangle, Power, PowerOff,
  Timer, Eye
} from 'lucide-react'
import { contentApi } from '@/api/content'
import { Content, PublishStatus, LifecycleStats } from '@/types'
import { PageLoader } from '@/components/ui/LoadingSpinner'
import StatusBadge from '@/components/ui/StatusBadge'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import EmptyState from '@/components/ui/EmptyState'
import Modal from '@/components/ui/Modal'
import { useAuthStore } from '@/store/authStore'
import { useDebounce } from '@/hooks/useDebounce'
import toast from 'react-hot-toast'
import { format, differenceInDays, isPast, isFuture } from 'date-fns'
import { ko } from 'date-fns/locale'
import { formatBytes } from '@/utils/formatBytes'
import { typeIcons, typeColors, defaultTypeIcon, defaultTypeColor } from '@/utils/contentTypes'

// 게시 상태 배지 컴포넌트
function PublishStatusBadge({ status, expiresAt }: { status?: PublishStatus; expiresAt?: string | null }) {
  const now = new Date()

  // 만료 임박 체크
  if (status === 'published' && expiresAt) {
    const expDate = new Date(expiresAt)
    const daysLeft = differenceInDays(expDate, now)
    if (daysLeft <= 1) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
          <AlertTriangle className="w-3 h-3" />
          D-{daysLeft <= 0 ? '0' : daysLeft}
        </span>
      )
    }
    if (daysLeft <= 3) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700">
          <Timer className="w-3 h-3" />
          D-{daysLeft}
        </span>
      )
    }
    if (daysLeft <= 7) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">
          <Clock className="w-3 h-3" />
          D-{daysLeft}
        </span>
      )
    }
  }

  const badges: Record<string, { icon: React.ElementType; label: string; className: string }> = {
    published: { icon: CheckCircle, label: '게시됨', className: 'bg-green-100 text-green-700' },
    scheduled: { icon: Clock, label: '예약됨', className: 'bg-blue-100 text-blue-700' },
    expired: { icon: Ban, label: '만료됨', className: 'bg-gray-100 text-gray-500' },
    disabled: { icon: PowerOff, label: '비활성화', className: 'bg-red-100 text-red-600' },
  }

  const badge = badges[status || 'published']
  if (!badge) return null
  const Icon = badge.icon

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${badge.className}`}>
      <Icon className="w-3 h-3" />
      {badge.label}
    </span>
  )
}

// 생애주기 통계 카드
function LifecycleStatsBar({ stats }: { stats: LifecycleStats }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3">
      <div className="card p-3 text-center">
        <div className="text-2xl font-bold text-green-600">{stats.published}</div>
        <div className="text-xs text-gray-500 mt-1">게시됨</div>
      </div>
      <div className="card p-3 text-center">
        <div className="text-2xl font-bold text-blue-600">{stats.scheduled}</div>
        <div className="text-xs text-gray-500 mt-1">예약됨</div>
      </div>
      <div className="card p-3 text-center">
        <div className="text-2xl font-bold text-gray-400">{stats.expired}</div>
        <div className="text-xs text-gray-500 mt-1">만료됨</div>
      </div>
      <div className="card p-3 text-center">
        <div className="text-2xl font-bold text-red-500">{stats.disabled}</div>
        <div className="text-xs text-gray-500 mt-1">비활성화</div>
      </div>
      {stats.expiring.d7 > 0 && (
        <div className="card p-3 text-center border-orange-200 bg-orange-50">
          <div className="text-2xl font-bold text-orange-600">{stats.expiring.d7}</div>
          <div className="text-xs text-orange-600 mt-1">7일 내 만료</div>
        </div>
      )}
    </div>
  )
}

export default function ContentPage() {
  const queryClient = useQueryClient()
  const { user } = useAuthStore()
  const canEdit = user?.role !== 'VIEWER'
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search)
  const [typeFilter, setTypeFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [uploadModalOpen, setUploadModalOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Content | null>(null)
  const [editTarget, setEditTarget] = useState<Content | null>(null)
  const [page, setPage] = useState(1)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Upload form state
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadName, setUploadName] = useState('')
  const [uploadTags, setUploadTags] = useState('')
  const [uploadStartAt, setUploadStartAt] = useState('')
  const [uploadExpiresAt, setUploadExpiresAt] = useState('')

  // Edit lifecycle state
  const [editStartAt, setEditStartAt] = useState('')
  const [editExpiresAt, setEditExpiresAt] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['content', { page, search: debouncedSearch, type: typeFilter, publishStatus: statusFilter || undefined }],
    queryFn: () => contentApi.getAll({
      page, limit: 20, search: debouncedSearch,
      type: typeFilter || undefined,
      publishStatus: statusFilter || undefined
    })
  })

  const { data: categories } = useQuery({
    queryKey: ['content-categories'],
    queryFn: contentApi.getCategories
  })

  // V4 Phase 11: 생애주기 통계
  const { data: lifecycleStats } = useQuery<LifecycleStats>({
    queryKey: ['content-lifecycle-stats'],
    queryFn: contentApi.getLifecycleStats
  })

  const uploadMutation = useMutation({
    mutationFn: (formData: FormData) => contentApi.upload(formData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['content'] })
      queryClient.invalidateQueries({ queryKey: ['content-lifecycle-stats'] })
      setUploadModalOpen(false)
      resetUploadForm()
      toast.success('콘텐츠가 업로드되었습니다')
    },
    onError: () => toast.error('업로드에 실패했습니다')
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => contentApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['content'] })
      queryClient.invalidateQueries({ queryKey: ['content-lifecycle-stats'] })
      setDeleteTarget(null)
      toast.success('콘텐츠가 삭제되었습니다')
    },
    onError: () => toast.error('삭제에 실패했습니다')
  })

  // V4 Phase 11: 수동 비활성화/활성화
  const disableMutation = useMutation({
    mutationFn: (id: string) => contentApi.disable(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['content'] })
      queryClient.invalidateQueries({ queryKey: ['content-lifecycle-stats'] })
      toast.success('콘텐츠가 비활성화되었습니다')
    },
    onError: () => toast.error('비활성화에 실패했습니다')
  })

  const enableMutation = useMutation({
    mutationFn: (id: string) => contentApi.enable(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['content'] })
      queryClient.invalidateQueries({ queryKey: ['content-lifecycle-stats'] })
      toast.success('콘텐츠가 활성화되었습니다')
    },
    onError: () => toast.error('활성화에 실패했습니다')
  })

  // V4 Phase 11: 생애주기 편집 저장
  const updateLifecycleMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      contentApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['content'] })
      queryClient.invalidateQueries({ queryKey: ['content-lifecycle-stats'] })
      setEditTarget(null)
      toast.success('생애주기가 업데이트되었습니다')
    },
    onError: () => toast.error('업데이트에 실패했습니다')
  })

  const resetUploadForm = () => {
    setUploadFile(null)
    setUploadName('')
    setUploadTags('')
    setUploadStartAt('')
    setUploadExpiresAt('')
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setUploadFile(file)
      setUploadName(file.name.replace(/\.[^/.]+$/, ''))
    }
  }

  const handleUpload = () => {
    if (!uploadFile) return
    const formData = new FormData()
    formData.append('file', uploadFile)
    formData.append('name', uploadName || uploadFile.name)
    if (uploadTags) formData.append('tags', uploadTags)
    if (uploadStartAt) formData.append('startAt', uploadStartAt)
    if (uploadExpiresAt) formData.append('expiresAt', uploadExpiresAt)
    uploadMutation.mutate(formData)
  }

  const handleEditLifecycle = () => {
    if (!editTarget) return
    updateLifecycleMutation.mutate({
      id: editTarget.id,
      data: {
        startAt: editStartAt || null,
        expiresAt: editExpiresAt || null
      }
    })
  }

  const openEditModal = (content: Content) => {
    setEditTarget(content)
    setEditStartAt(content.startAt ? content.startAt.slice(0, 16) : '')
    setEditExpiresAt(content.expiresAt ? content.expiresAt.slice(0, 16) : '')
  }

  const contents: Content[] = data?.items || []
  const pagination = data?.pagination

  if (isLoading) return <PageLoader />

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">콘텐츠 관리</h1>
          <p className="text-gray-500 text-sm mt-1">이미지, 비디오, 오디오 등 콘텐츠를 관리합니다</p>
        </div>
        {canEdit && (
          <button
            className="btn-primary"
            onClick={() => setUploadModalOpen(true)}
          >
            <Upload className="w-4 h-4" />
            콘텐츠 업로드
          </button>
        )}
      </div>

      {/* V4 Phase 11: 생애주기 통계 바 */}
      {lifecycleStats && <LifecycleStatsBar stats={lifecycleStats} />}

      {/* Toolbar */}
      <div className="card p-4">
        <div className="flex flex-wrap gap-3 items-center">
          {/* Search */}
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="콘텐츠 검색..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="input pl-9"
            />
          </div>

          {/* Type filter */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <select
              value={typeFilter}
              onChange={e => { setTypeFilter(e.target.value); setPage(1) }}
              className="select w-36"
            >
              <option value="">전체 유형</option>
              <option value="IMAGE">이미지</option>
              <option value="VIDEO">비디오</option>
              <option value="AUDIO">오디오</option>
              <option value="HTML">HTML</option>
              <option value="DOCUMENT">문서</option>
            </select>
          </div>

          {/* V4 Phase 11: 상태 필터 */}
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-400" />
            <select
              value={statusFilter}
              onChange={e => { setStatusFilter(e.target.value); setPage(1) }}
              className="select w-36"
            >
              <option value="">게시됨</option>
              <option value="all">전체 상태</option>
              <option value="published">게시됨</option>
              <option value="scheduled">예약됨</option>
              <option value="expired">만료됨</option>
              <option value="disabled">비활성화</option>
            </select>
          </div>

          {/* View toggle */}
          <div className="flex border border-gray-200 rounded-lg overflow-hidden">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 ${viewMode === 'grid' ? 'bg-blue-50 text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
            >
              <Grid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 ${viewMode === 'list' ? 'bg-blue-50 text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      {contents.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={FolderOpen}
            title="콘텐츠가 없습니다"
            description={statusFilter ? `"${statusFilter}" 상태의 콘텐츠가 없습니다` : '첫 번째 콘텐츠를 업로드해보세요'}
            action={
              canEdit && !statusFilter ? (
                <button className="btn-primary" onClick={() => setUploadModalOpen(true)}>
                  <Upload className="w-4 h-4" /> 콘텐츠 업로드
                </button>
              ) : undefined
            }
          />
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {contents.map(content => {
            const Icon = typeIcons[content.type] || defaultTypeIcon
            const colorClass = typeColors[content.type] || defaultTypeColor
            const isDisabledOrExpired = content.publishStatus === 'disabled' || content.publishStatus === 'expired'
            return (
              <div
                key={content.id}
                className={`card p-4 group hover:shadow-md transition-shadow cursor-pointer ${isDisabledOrExpired ? 'opacity-60' : ''}`}
              >
                <div className={`w-full aspect-square rounded-lg flex items-center justify-center mb-3 ${colorClass}`}>
                  {content.type === 'IMAGE' && content.url ? (
                    <img
                      src={content.url}
                      alt={content.name}
                      className="w-full h-full object-cover rounded-lg"
                      onError={e => { (e.target as HTMLElement).style.display = 'none' }}
                    />
                  ) : (
                    <Icon className="w-12 h-12" />
                  )}
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-gray-800 truncate">{content.name}</p>
                  <div className="flex items-center justify-between">
                    <PublishStatusBadge status={content.publishStatus} expiresAt={content.expiresAt} />
                    <span className="text-xs text-gray-400">{formatBytes(content.size)}</span>
                  </div>
                  {/* 생애주기 정보 표시 */}
                  {content.startAt && (
                    <p className="text-xs text-blue-500 truncate">
                      시작: {format(new Date(content.startAt), 'MM/dd HH:mm')}
                    </p>
                  )}
                  {content.expiresAt && (
                    <p className="text-xs text-orange-500 truncate">
                      만료: {format(new Date(content.expiresAt), 'MM/dd HH:mm')}
                    </p>
                  )}
                </div>
                {canEdit && (
                  <div className="flex gap-1 mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      className="flex-1 text-xs py-1.5 bg-gray-50 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                      onClick={() => openEditModal(content)}
                      title="생애주기 편집"
                    >
                      <Calendar className="w-3 h-3 inline mr-1" />
                      일정
                    </button>
                    {content.publishStatus === 'published' ? (
                      <button
                        className="flex-1 text-xs py-1.5 bg-orange-50 text-orange-600 hover:bg-orange-100 rounded-lg transition-colors"
                        onClick={() => disableMutation.mutate(content.id)}
                        title="비활성화"
                      >
                        <PowerOff className="w-3 h-3 inline mr-1" />
                        중지
                      </button>
                    ) : content.publishStatus === 'disabled' || content.publishStatus === 'expired' ? (
                      <button
                        className="flex-1 text-xs py-1.5 bg-green-50 text-green-600 hover:bg-green-100 rounded-lg transition-colors"
                        onClick={() => enableMutation.mutate(content.id)}
                        title="활성화"
                      >
                        <Power className="w-3 h-3 inline mr-1" />
                        게시
                      </button>
                    ) : null}
                    <button
                      className="flex-1 text-xs py-1.5 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                      onClick={() => setDeleteTarget(content)}
                    >
                      삭제
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <table className="table">
            <thead>
              <tr>
                <th>이름</th>
                <th>유형</th>
                <th>상태</th>
                <th>크기</th>
                <th>시작일</th>
                <th>만료일</th>
                <th>등록일</th>
                {canEdit && <th>작업</th>}
              </tr>
            </thead>
            <tbody>
              {contents.map(content => {
                const Icon = typeIcons[content.type] || defaultTypeIcon
                const colorClass = typeColors[content.type] || defaultTypeColor
                const isDisabledOrExpired = content.publishStatus === 'disabled' || content.publishStatus === 'expired'
                return (
                  <tr key={content.id} className={isDisabledOrExpired ? 'opacity-60' : ''}>
                    <td>
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${colorClass}`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <span className="font-medium text-gray-800">{content.name}</span>
                      </div>
                    </td>
                    <td><StatusBadge status={content.type} /></td>
                    <td>
                      <PublishStatusBadge status={content.publishStatus} expiresAt={content.expiresAt} />
                    </td>
                    <td className="text-gray-500">{formatBytes(content.size)}</td>
                    <td className="text-gray-500 text-xs">
                      {content.startAt ? format(new Date(content.startAt), 'yyyy-MM-dd HH:mm') : '-'}
                    </td>
                    <td className="text-gray-500 text-xs">
                      {content.expiresAt ? format(new Date(content.expiresAt), 'yyyy-MM-dd HH:mm') : '-'}
                    </td>
                    <td className="text-gray-500 text-xs">
                      {format(new Date(content.createdAt), 'yyyy-MM-dd')}
                    </td>
                    {canEdit && (
                      <td>
                        <div className="flex items-center gap-1">
                          <button
                            className="btn-ghost btn-sm p-1.5"
                            title="생애주기 편집"
                            onClick={() => openEditModal(content)}
                          >
                            <Calendar className="w-4 h-4" />
                          </button>
                          {content.publishStatus === 'published' ? (
                            <button
                              className="p-1.5 text-orange-500 hover:bg-orange-50 rounded-lg transition-colors"
                              onClick={() => disableMutation.mutate(content.id)}
                              title="비활성화"
                            >
                              <PowerOff className="w-4 h-4" />
                            </button>
                          ) : (content.publishStatus === 'disabled' || content.publishStatus === 'expired') ? (
                            <button
                              className="p-1.5 text-green-500 hover:bg-green-50 rounded-lg transition-colors"
                              onClick={() => enableMutation.mutate(content.id)}
                              title="활성화"
                            >
                              <Power className="w-4 h-4" />
                            </button>
                          ) : null}
                          <button
                            className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            onClick={() => setDeleteTarget(content)}
                            title="삭제"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
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
          <span className="text-sm text-gray-600">
            {page} / {pagination.pages} 페이지
          </span>
          <button
            className="btn-secondary btn-sm"
            onClick={() => setPage(p => Math.min(pagination.pages, p + 1))}
            disabled={page === pagination.pages}
          >
            다음
          </button>
        </div>
      )}

      {/* Upload Modal — V4 Phase 11: 생애주기 필드 추가 */}
      <Modal
        isOpen={uploadModalOpen}
        onClose={() => { setUploadModalOpen(false); resetUploadForm() }}
        title="콘텐츠 업로드"
        footer={
          <>
            <button className="btn-secondary" onClick={() => { setUploadModalOpen(false); resetUploadForm() }}>
              취소
            </button>
            <button
              className="btn-primary"
              onClick={handleUpload}
              disabled={!uploadFile || uploadMutation.isPending}
            >
              {uploadMutation.isPending ? '업로드 중...' : '업로드'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          {/* Drop zone */}
          <div
            className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="w-10 h-10 text-gray-400 mx-auto mb-3" />
            {uploadFile ? (
              <div>
                <p className="font-medium text-gray-800">{uploadFile.name}</p>
                <p className="text-sm text-gray-500">{formatBytes(uploadFile.size)}</p>
              </div>
            ) : (
              <div>
                <p className="text-gray-600 font-medium">파일을 클릭하여 선택</p>
                <p className="text-sm text-gray-400 mt-1">이미지, 비디오, 오디오, HTML, 문서 지원</p>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept="image/*,video/*,audio/*,.pdf,.html,.zip"
              onChange={handleFileSelect}
            />
          </div>

          <div>
            <label className="label">콘텐츠 이름</label>
            <input
              type="text"
              value={uploadName}
              onChange={e => setUploadName(e.target.value)}
              className="input"
              placeholder="콘텐츠 이름"
            />
          </div>

          <div>
            <label className="label">태그</label>
            <input
              type="text"
              value={uploadTags}
              onChange={e => setUploadTags(e.target.value)}
              className="input"
              placeholder="태그 (쉼표로 구분)"
            />
          </div>

          {/* V4 Phase 11: 생애주기 설정 */}
          <div className="border-t pt-4">
            <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              콘텐츠 생애주기 (선택)
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label text-xs">게시 시작일 (엠바고)</label>
                <input
                  type="datetime-local"
                  value={uploadStartAt}
                  onChange={e => setUploadStartAt(e.target.value)}
                  className="input text-sm"
                />
                <p className="text-xs text-gray-400 mt-1">설정 시 해당 시각까지 비공개</p>
              </div>
              <div>
                <label className="label text-xs">만료일 (라이프스팬)</label>
                <input
                  type="datetime-local"
                  value={uploadExpiresAt}
                  onChange={e => setUploadExpiresAt(e.target.value)}
                  className="input text-sm"
                />
                <p className="text-xs text-gray-400 mt-1">설정 시 자동 비활성화</p>
              </div>
            </div>
          </div>
        </div>
      </Modal>

      {/* V4 Phase 11: 생애주기 편집 모달 */}
      <Modal
        isOpen={!!editTarget}
        onClose={() => setEditTarget(null)}
        title={`생애주기 편집 — ${editTarget?.name || ''}`}
        footer={
          <>
            <button className="btn-secondary" onClick={() => setEditTarget(null)}>
              취소
            </button>
            <button
              className="btn-primary"
              onClick={handleEditLifecycle}
              disabled={updateLifecycleMutation.isPending}
            >
              {updateLifecycleMutation.isPending ? '저장 중...' : '저장'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          {editTarget && (
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <PublishStatusBadge status={editTarget.publishStatus} expiresAt={editTarget.expiresAt} />
              <span className="text-sm text-gray-600">
                현재 상태: <strong>{editTarget.publishStatus || 'published'}</strong>
              </span>
            </div>
          )}
          <div>
            <label className="label">게시 시작일 (엠바고)</label>
            <input
              type="datetime-local"
              value={editStartAt}
              onChange={e => setEditStartAt(e.target.value)}
              className="input"
            />
            <p className="text-xs text-gray-400 mt-1">
              비워두면 즉시 게시. 미래 시각 설정 시 해당 시각까지 예약 상태.
            </p>
          </div>
          <div>
            <label className="label">만료일 (라이프스팬)</label>
            <input
              type="datetime-local"
              value={editExpiresAt}
              onChange={e => setEditExpiresAt(e.target.value)}
              className="input"
            />
            <p className="text-xs text-gray-400 mt-1">
              비워두면 무기한. 설정 시 해당 시각에 자동 만료.
            </p>
          </div>
        </div>
      </Modal>

      {/* Delete Confirm */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        title="콘텐츠 삭제"
        message={`"${deleteTarget?.name}"을(를) 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`}
        confirmLabel="삭제"
        isLoading={deleteMutation.isPending}
      />
    </div>
  )
}
