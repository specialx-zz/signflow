import { useState, useEffect, useCallback } from 'react'
import {
  Library, Upload, Download, Search, Trash2, Image, Film, Music, FileText,
  X, Filter, Plus
} from 'lucide-react'
import { sharedContentApi, type SharedContent } from '@/api/sharedContent'
import { useAuthStore } from '@/store/authStore'
import { useDebounce } from '@/hooks/useDebounce'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import toast from 'react-hot-toast'

const TYPE_ICONS: Record<string, React.ElementType> = {
  IMAGE: Image, VIDEO: Film, AUDIO: Music, DOCUMENT: FileText,
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function SharedContentPage() {
  const { user } = useAuthStore()
  const isSuperAdmin = user?.role === 'SUPER_ADMIN'
  const [items, setItems] = useState<SharedContent[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search)
  const [typeFilter, setTypeFilter] = useState('')
  const [showUpload, setShowUpload] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [importing, setImporting] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 })

  const loadItems = useCallback(async () => {
    try {
      setLoading(true)
      const result = await sharedContentApi.getAll({
        search: debouncedSearch || undefined,
        type: typeFilter || undefined,
        page: pagination.page,
        limit: 20,
      })
      setItems(result.items)
      setPagination(result.pagination)
    } catch (err) {
      toast.error('콘텐츠 목록을 불러오지 못했습니다')
    } finally {
      setLoading(false)
    }
  }, [debouncedSearch, typeFilter, pagination.page])

  useEffect(() => { loadItems() }, [loadItems])

  const handleUpload = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    if (!form.get('file')) return

    try {
      setUploading(true)
      await sharedContentApi.upload(form)
      setShowUpload(false)
      loadItems()
    } catch (err) {
      toast.error('업로드에 실패했습니다')
    } finally {
      setUploading(false)
    }
  }

  const handleImport = async (id: string) => {
    try {
      setImporting(id)
      await sharedContentApi.import(id)
      toast.success('내 콘텐츠 라이브러리에 추가되었습니다.')
    } catch (err) {
      toast.error('콘텐츠 가져오기에 실패했습니다.')
    } finally {
      setImporting(null)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await sharedContentApi.delete(id)
      setDeleteTarget(null)
      loadItems()
    } catch (err) {
      toast.error('콘텐츠 삭제에 실패했습니다')
    }
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Library className="w-7 h-7 text-purple-500" />
            공유 콘텐츠 라이브러리
          </h1>
          <p className="text-gray-500 mt-1">본사에서 제공하는 공통 콘텐츠를 내 라이브러리로 가져올 수 있습니다</p>
        </div>
        {isSuperAdmin && (
          <button
            onClick={() => setShowUpload(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition shadow-sm"
          >
            <Upload className="w-4 h-4" /> 콘텐츠 등록
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="이름, 태그로 검색..."
            className="w-full pl-10 pr-3 py-2 border rounded-lg"
          />
        </div>
        <div className="flex items-center gap-1 border rounded-lg p-1">
          {['', 'IMAGE', 'VIDEO', 'AUDIO'].map(t => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={`px-3 py-1.5 text-xs rounded-md transition ${
                typeFilter === t ? 'bg-purple-100 text-purple-700' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {t === '' ? '전체' : t === 'IMAGE' ? '이미지' : t === 'VIDEO' ? '영상' : '오디오'}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="text-center py-12 text-gray-400">로딩 중...</div>
      ) : items.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Library className="w-16 h-16 mx-auto mb-4 opacity-20" />
          <p className="text-lg">공유 콘텐츠가 없습니다</p>
          {isSuperAdmin && <p className="text-sm mt-1">상단의 "콘텐츠 등록"으로 추가하세요</p>}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {items.map(item => {
            const Icon = TYPE_ICONS[item.type] || FileText
            return (
              <div key={item.id} className="bg-white border rounded-xl overflow-hidden hover:shadow-lg transition group">
                {/* Thumbnail */}
                <div className="aspect-video bg-gray-100 relative flex items-center justify-center">
                  {item.thumbnailUrl || item.url ? (
                    item.type === 'IMAGE' || item.thumbnailUrl ? (
                      <img src={item.thumbnailUrl || item.url} alt={item.name} className="w-full h-full object-cover" />
                    ) : (
                      <Icon className="w-12 h-12 text-gray-300" />
                    )
                  ) : (
                    <Icon className="w-12 h-12 text-gray-300" />
                  )}
                  <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition">
                    <button
                      onClick={() => handleImport(item.id)}
                      disabled={importing === item.id}
                      className="p-1.5 bg-white rounded-lg shadow-sm hover:bg-purple-50 text-purple-600"
                      title="내 라이브러리에 추가"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                    {isSuperAdmin && (
                      <button
                        onClick={() => setDeleteTarget(item.id)}
                        className="p-1.5 bg-white rounded-lg shadow-sm hover:bg-red-50 text-red-500"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  <span className="absolute bottom-2 left-2 text-xs px-2 py-0.5 bg-black/60 text-white rounded">
                    {item.type}
                  </span>
                </div>
                {/* Info */}
                <div className="p-3">
                  <div className="font-medium text-sm text-gray-900 truncate">{item.name}</div>
                  <div className="text-xs text-gray-500 mt-1 flex items-center justify-between">
                    <span>{formatSize(item.size)}</span>
                    {item.category && <span className="bg-gray-100 px-1.5 py-0.5 rounded">{item.category}</span>}
                  </div>
                  {item.tags && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {item.tags.split(',').slice(0, 3).map((tag, i) => (
                        <span key={i} className="text-xs bg-purple-50 text-purple-600 px-1.5 py-0.5 rounded">{tag.trim()}</span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Pagination */}
      {pagination.pages > 1 && (
        <div className="flex justify-center gap-2">
          {Array.from({ length: pagination.pages }, (_, i) => (
            <button
              key={i}
              onClick={() => setPagination(p => ({ ...p, page: i + 1 }))}
              className={`w-8 h-8 rounded-lg text-sm ${
                pagination.page === i + 1 ? 'bg-purple-600 text-white' : 'text-gray-500 hover:bg-gray-100'
              }`}
            >
              {i + 1}
            </button>
          ))}
        </div>
      )}

      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && handleDelete(deleteTarget)}
        title="공유 콘텐츠 삭제"
        message="이 공유 콘텐츠를 삭제하시겠습니까?"
        confirmLabel="삭제"
      />

      {/* Upload Modal */}
      {showUpload && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between p-5 border-b">
              <h3 className="text-lg font-bold">공유 콘텐츠 등록</h3>
              <button onClick={() => setShowUpload(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleUpload} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">파일 *</label>
                <input type="file" name="file" required accept="image/*,video/*,audio/*"
                  className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">이름</label>
                <input type="text" name="name" className="w-full border rounded-lg px-3 py-2" placeholder="콘텐츠 이름" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">카테고리</label>
                <input type="text" name="category" className="w-full border rounded-lg px-3 py-2" placeholder="예: 프로모션, 공지" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">태그 (쉼표 구분)</label>
                <input type="text" name="tags" className="w-full border rounded-lg px-3 py-2" placeholder="여름, 세일, 신상품" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">설명</label>
                <textarea name="description" className="w-full border rounded-lg px-3 py-2 h-20 resize-none" placeholder="콘텐츠 설명" />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowUpload(false)} className="px-4 py-2 text-gray-600">취소</button>
                <button
                  type="submit"
                  disabled={uploading}
                  className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
                >
                  {uploading ? '업로드 중...' : '등록'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
