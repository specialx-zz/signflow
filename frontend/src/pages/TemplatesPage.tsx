import { useState, useEffect } from 'react'
import { Search, Star, Download, Upload, Filter, Grid, List, ShoppingBag } from 'lucide-react'
import { templateApi, type ContentTemplate } from '@/api/templates'
import { useAuthStore } from '@/store/authStore'
import { useDebounce } from '@/hooks/useDebounce'
import Modal from '@/components/ui/Modal'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import toast from 'react-hot-toast'

const CATEGORIES = ['전체', '프로모션', '메뉴판', '공지사항', '웰컴', '이벤트', '소셜미디어', '일반']

export default function TemplatesPage() {
  const { user } = useAuthStore()
  const [templates, setTemplates] = useState<ContentTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search)
  const [category, setCategory] = useState('전체')
  const [sort, setSort] = useState('latest')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [showUpload, setShowUpload] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState<ContentTemplate | null>(null)
  const [uploading, setUploading] = useState(false)
  const [total, setTotal] = useState(0)
  const [useTarget, setUseTarget] = useState<ContentTemplate | null>(null)

  useEffect(() => {
    fetchTemplates()
  }, [debouncedSearch, category, sort])

  const fetchTemplates = async () => {
    setLoading(true)
    try {
      const params: any = { sort, limit: 50 }
      if (debouncedSearch) params.search = debouncedSearch
      if (category !== '전체') params.category = category
      const { data } = await templateApi.getAll(params)
      setTemplates(data.templates || [])
      setTotal(data.total || 0)
    } catch (e) {
      console.error(e)
    }
    setLoading(false)
  }

  const handleUse = async (template: ContentTemplate) => {
    try {
      await templateApi.use(template.id)
      setUseTarget(null)
      toast.success('내 콘텐츠에 추가되었습니다!')
      fetchTemplates()
    } catch (e: any) {
      toast.error(e.response?.data?.error || '오류가 발생했습니다')
    }
  }

  const handleUpload = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setUploading(true)
    try {
      const form = e.currentTarget
      const formData = new FormData(form)
      await templateApi.upload(formData)
      setShowUpload(false)
      fetchTemplates()
    } catch (e: any) {
      toast.error(e.response?.data?.error || '업로드 실패')
    }
    setUploading(false)
  }

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star key={i} className={`w-3 h-3 ${i < Math.round(rating) ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300 dark:text-gray-600'}`} />
    ))
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <ShoppingBag className="w-7 h-7 text-purple-500" />
            템플릿 마켓
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {total}개의 템플릿 사용 가능
          </p>
        </div>
        {user?.role === 'SUPER_ADMIN' && (
          <button
            onClick={() => setShowUpload(true)}
            className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700"
          >
            <Upload className="w-4 h-4" />
            템플릿 등록
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="템플릿 검색..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>

          {/* Sort */}
          <select
            value={sort}
            onChange={e => setSort(e.target.value)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value="latest">최신순</option>
            <option value="popular">인기순</option>
            <option value="rating">평점순</option>
          </select>

          {/* View toggle */}
          <div className="flex border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 ${viewMode === 'grid' ? 'bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300' : 'bg-white dark:bg-gray-700'}`}
            >
              <Grid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 ${viewMode === 'list' ? 'bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300' : 'bg-white dark:bg-gray-700'}`}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Category pills */}
        <div className="flex flex-wrap gap-2 mt-3">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`px-3 py-1 rounded-full text-sm transition-colors ${
                category === cat
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Template Grid */}
      {loading ? (
        <div className="text-center py-12 text-gray-500">로딩중...</div>
      ) : templates.length === 0 ? (
        <div className="text-center py-12">
          <ShoppingBag className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
          <p className="text-gray-500 dark:text-gray-400">템플릿이 없습니다</p>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {templates.map(t => (
            <div
              key={t.id}
              className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-md transition-shadow group"
            >
              {/* Thumbnail */}
              <div className="aspect-video bg-gray-100 dark:bg-gray-700 relative overflow-hidden">
                {t.thumbnailUrl ? (
                  <img src={t.thumbnailUrl} alt={t.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-400">
                    <ShoppingBag className="w-10 h-10" />
                  </div>
                )}
                {t.isPremium && (
                  <span className="absolute top-2 right-2 bg-yellow-500 text-white text-xs px-2 py-0.5 rounded-full font-semibold">
                    Premium
                  </span>
                )}
                {/* Hover overlay */}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <button
                    onClick={() => setUseTarget(t)}
                    className="bg-white text-purple-700 px-4 py-2 rounded-lg font-medium hover:bg-purple-50 transition-colors"
                  >
                    <Download className="w-4 h-4 inline mr-1" />
                    사용하기
                  </button>
                </div>
              </div>

              {/* Info */}
              <div className="p-3">
                <h3 className="font-semibold text-gray-900 dark:text-white text-sm truncate">{t.name}</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 truncate">{t.description || t.category}</p>
                <div className="flex items-center justify-between mt-2">
                  <div className="flex items-center gap-1">
                    {renderStars(t.rating)}
                    <span className="text-xs text-gray-500 ml-1">({t.reviewCount})</span>
                  </div>
                  <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                    <Download className="w-3 h-3" />
                    {t.downloads}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* List View */
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 divide-y divide-gray-200 dark:divide-gray-700">
          {templates.map(t => (
            <div key={t.id} className="flex items-center gap-4 p-4 hover:bg-gray-50 dark:hover:bg-gray-750">
              <div className="w-20 h-14 bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden flex-shrink-0">
                {t.thumbnailUrl ? (
                  <img src={t.thumbnailUrl} alt={t.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-400">
                    <ShoppingBag className="w-6 h-6" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-gray-900 dark:text-white">{t.name}</h3>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-xs bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 px-2 py-0.5 rounded">{t.category}</span>
                  <div className="flex items-center gap-1">{renderStars(t.rating)}</div>
                  <span className="text-xs text-gray-500">{t.downloads} 다운로드</span>
                </div>
              </div>
              <button
                onClick={() => setUseTarget(t)}
                className="flex-shrink-0 bg-purple-600 text-white px-3 py-1.5 rounded-lg text-sm hover:bg-purple-700"
              >
                사용하기
              </button>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        isOpen={!!useTarget}
        onClose={() => setUseTarget(null)}
        onConfirm={() => useTarget && handleUse(useTarget)}
        title="템플릿 사용"
        message={`"${useTarget?.name}" 템플릿을 내 콘텐츠로 가져올까요?`}
        confirmLabel="가져오기"
        variant="info"
      />

      {/* Upload Modal */}
      <Modal isOpen={showUpload} onClose={() => setShowUpload(false)} title="템플릿 등록">
        <form onSubmit={handleUpload} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">파일 *</label>
            <input type="file" name="file" required className="w-full" accept="image/*,video/*" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">이름 *</label>
            <input type="text" name="name" required className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">설명</label>
            <textarea name="description" rows={2} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">카테고리</label>
              <select name="category" className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700">
                {CATEGORIES.filter(c => c !== '전체').map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">태그</label>
              <input type="text" name="tags" placeholder="콤마로 구분" className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" name="isPremium" value="true" id="isPremium" />
            <label htmlFor="isPremium" className="text-sm text-gray-700 dark:text-gray-300">프리미엄 템플릿</label>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setShowUpload(false)} className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">
              취소
            </button>
            <button type="submit" disabled={uploading} className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50">
              {uploading ? '등록 중...' : '등록'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
