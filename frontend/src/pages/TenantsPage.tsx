import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Building2, Plus, Search, Users, Monitor, HardDrive,
  MapPin, Mail, Phone, Trash2, Pencil, ChevronRight
} from 'lucide-react'
import { tenantApi } from '@/api/tenants'
import { Tenant } from '@/types'
import { PageLoader } from '@/components/ui/LoadingSpinner'
import EmptyState from '@/components/ui/EmptyState'
import Modal from '@/components/ui/Modal'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import { useDebounce } from '@/hooks/useDebounce'
import toast from 'react-hot-toast'
import { format } from 'date-fns'

const planLabels: Record<string, { label: string; class: string }> = {
  starter: { label: 'Starter', class: 'bg-gray-100 text-gray-700' },
  business: { label: 'Business', class: 'bg-blue-100 text-blue-700' },
  enterprise: { label: 'Enterprise', class: 'bg-purple-100 text-purple-700' },
}

const statusLabels: Record<string, { label: string; class: string }> = {
  trial: { label: '체험판', class: 'bg-yellow-100 text-yellow-700' },
  active: { label: '활성', class: 'bg-green-100 text-green-700' },
  past_due: { label: '연체', class: 'bg-red-100 text-red-700' },
  suspended: { label: '정지', class: 'bg-gray-100 text-gray-600' },
}

function nameToSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[가-힣]+/g, (match) => {
      return match.split('').map((ch) => ch.charCodeAt(0).toString(36)).join('')
    })
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

const emptyForm = {
  name: '',
  slug: '',
  contactName: '',
  contactEmail: '',
  contactPhone: '',
  address: '',
}

export default function TenantsPage() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search)
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [form, setForm] = useState({ ...emptyForm })
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [editTarget, setEditTarget] = useState<Tenant | null>(null)
  const [editForm, setEditForm] = useState({ ...emptyForm })
  const [deleteTarget, setDeleteTarget] = useState<Tenant | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['tenants', { search: debouncedSearch }],
    queryFn: () => tenantApi.getAll({ search: debouncedSearch || undefined }),
  })

  const createMutation = useMutation({
    mutationFn: tenantApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenants'] })
      setCreateModalOpen(false)
      setForm({ ...emptyForm })
      toast.success('업체가 생성되었습니다')
    },
    onError: () => toast.error('업체 생성에 실패했습니다'),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Tenant> }) =>
      tenantApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenants'] })
      setEditTarget(null)
      toast.success('업체 정보가 수정되었습니다')
    },
    onError: () => toast.error('수정에 실패했습니다'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => tenantApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenants'] })
      setDeleteTarget(null)
      toast.success('업체가 삭제되었습니다')
    },
    onError: () => toast.error('삭제에 실패했습니다'),
  })

  const tenants: Tenant[] = data?.items || []
  const filteredTenants = tenants

  const handleNameChange = (value: string) => {
    setForm((f) => ({ ...f, name: value, slug: nameToSlug(value) }))
  }

  const openEditModal = (tenant: Tenant) => {
    setEditTarget(tenant)
    setEditForm({
      name: tenant.name,
      slug: tenant.slug,
      contactName: tenant.contactName || '',
      contactEmail: tenant.contactEmail || '',
      contactPhone: tenant.contactPhone || '',
      address: tenant.address || '',
    })
  }

  if (isLoading) return <PageLoader />

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">업체 관리</h1>
          <p className="text-gray-500 text-sm mt-1">
            전체 {filteredTenants.length}개 업체를 관리하세요
          </p>
        </div>
        <button className="btn-primary" onClick={() => setCreateModalOpen(true)}>
          <Plus className="w-4 h-4" />
          새 업체 추가
        </button>
      </div>

      {/* Search */}
      <div className="card p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="업체 검색..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input pl-9"
          />
        </div>
      </div>

      {/* Tenant Grid */}
      {filteredTenants.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={Building2}
            title="업체가 없습니다"
            description="새 업체를 추가하여 시작하세요"
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredTenants.map((tenant) => {
            const plan = planLabels[tenant.subscription?.plan || ''] || planLabels.starter
            const status = statusLabels[tenant.subscription?.status || ''] || statusLabels.trial
            const isExpanded = expandedId === tenant.id
            const counts = tenant._count || { users: 0, devices: 0, content: 0 }

            return (
              <div key={tenant.id} className="card p-0 overflow-hidden">
                {/* Card Header */}
                <div
                  className="p-5 cursor-pointer hover:bg-gray-50/50 transition-colors"
                  onClick={() => setExpandedId(isExpanded ? null : tenant.id)}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-xl flex items-center justify-center">
                        <Building2 className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-800">{tenant.name}</h3>
                        <p className="text-xs text-gray-400">{tenant.slug}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`badge ${plan.class}`}>{plan.label}</span>
                      <span className={`badge ${status.class}`}>{status.label}</span>
                      <ChevronRight
                        className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                      />
                    </div>
                  </div>

                  {/* Stats row */}
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <div className="flex items-center gap-1">
                      <Users className="w-3.5 h-3.5" />
                      <span>사용자 {counts.users}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Monitor className="w-3.5 h-3.5" />
                      <span>디바이스 {counts.devices}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <HardDrive className="w-3.5 h-3.5" />
                      <span>콘텐츠 {counts.content}</span>
                    </div>
                    <span className={`ml-auto badge ${tenant.isActive ? 'badge-success' : 'badge-danger'}`}>
                      {tenant.isActive ? '활성' : '비활성'}
                    </span>
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="border-t border-gray-100 p-5 bg-gray-50/30 space-y-3">
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      {tenant.contactEmail && (
                        <div className="flex items-center gap-2 text-gray-600">
                          <Mail className="w-4 h-4 text-gray-400" />
                          <span>{tenant.contactEmail}</span>
                        </div>
                      )}
                      {tenant.contactPhone && (
                        <div className="flex items-center gap-2 text-gray-600">
                          <Phone className="w-4 h-4 text-gray-400" />
                          <span>{tenant.contactPhone}</span>
                        </div>
                      )}
                      {tenant.address && (
                        <div className="flex items-center gap-2 text-gray-600 col-span-2">
                          <MapPin className="w-4 h-4 text-gray-400" />
                          <span>{tenant.address}</span>
                        </div>
                      )}
                    </div>
                    <div className="text-xs text-gray-400">
                      생성일: {format(new Date(tenant.createdAt), 'yyyy-MM-dd')}
                    </div>
                    <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                      <button
                        className="btn-ghost btn-sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          openEditModal(tenant)
                        }}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        편집
                      </button>
                      <button
                        className="btn-ghost btn-sm text-red-500 hover:bg-red-50"
                        onClick={(e) => {
                          e.stopPropagation()
                          setDeleteTarget(tenant)
                        }}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        삭제
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Create Modal */}
      <Modal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="새 업체 추가"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setCreateModalOpen(false)}>
              취소
            </button>
            <button
              className="btn-primary"
              onClick={() => createMutation.mutate(form)}
              disabled={!form.name || !form.slug || createMutation.isPending}
            >
              {createMutation.isPending ? '생성 중...' : '생성'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="label">업체명 *</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => handleNameChange(e.target.value)}
              className="input"
              placeholder="업체명을 입력하세요"
            />
          </div>
          <div>
            <label className="label">서브도메인 (slug) *</label>
            <input
              type="text"
              value={form.slug}
              onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
              className="input"
              placeholder="영문 소문자, 숫자, 하이픈만 사용"
            />
            <p className="text-xs text-gray-400 mt-1">업체명 입력 시 자동 생성됩니다</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">담당자명</label>
              <input
                type="text"
                value={form.contactName}
                onChange={(e) => setForm((f) => ({ ...f, contactName: e.target.value }))}
                className="input"
                placeholder="담당자명"
              />
            </div>
            <div>
              <label className="label">연락처 이메일</label>
              <input
                type="email"
                value={form.contactEmail}
                onChange={(e) => setForm((f) => ({ ...f, contactEmail: e.target.value }))}
                className="input"
                placeholder="이메일"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">전화번호</label>
              <input
                type="text"
                value={form.contactPhone}
                onChange={(e) => setForm((f) => ({ ...f, contactPhone: e.target.value }))}
                className="input"
                placeholder="전화번호"
              />
            </div>
            <div>
              <label className="label">주소</label>
              <input
                type="text"
                value={form.address}
                onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                className="input"
                placeholder="주소"
              />
            </div>
          </div>
        </div>
      </Modal>

      {/* Edit Modal */}
      {editTarget && (
        <Modal
          isOpen={!!editTarget}
          onClose={() => setEditTarget(null)}
          title="업체 편집"
          footer={
            <>
              <button className="btn-secondary" onClick={() => setEditTarget(null)}>
                취소
              </button>
              <button
                className="btn-primary"
                onClick={() =>
                  updateMutation.mutate({
                    id: editTarget.id,
                    data: {
                      name: editForm.name,
                      slug: editForm.slug,
                      contactName: editForm.contactName || undefined,
                      contactEmail: editForm.contactEmail || undefined,
                      contactPhone: editForm.contactPhone || undefined,
                      address: editForm.address || undefined,
                    },
                  })
                }
                disabled={!editForm.name || !editForm.slug || updateMutation.isPending}
              >
                {updateMutation.isPending ? '저장 중...' : '저장'}
              </button>
            </>
          }
        >
          <div className="space-y-4">
            <div>
              <label className="label">업체명 *</label>
              <input
                type="text"
                value={editForm.name}
                onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                className="input"
              />
            </div>
            <div>
              <label className="label">서브도메인 (slug) *</label>
              <input
                type="text"
                value={editForm.slug}
                onChange={(e) => setEditForm((f) => ({ ...f, slug: e.target.value }))}
                className="input"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">담당자명</label>
                <input
                  type="text"
                  value={editForm.contactName}
                  onChange={(e) => setEditForm((f) => ({ ...f, contactName: e.target.value }))}
                  className="input"
                />
              </div>
              <div>
                <label className="label">연락처 이메일</label>
                <input
                  type="email"
                  value={editForm.contactEmail}
                  onChange={(e) => setEditForm((f) => ({ ...f, contactEmail: e.target.value }))}
                  className="input"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">전화번호</label>
                <input
                  type="text"
                  value={editForm.contactPhone}
                  onChange={(e) => setEditForm((f) => ({ ...f, contactPhone: e.target.value }))}
                  className="input"
                />
              </div>
              <div>
                <label className="label">주소</label>
                <input
                  type="text"
                  value={editForm.address}
                  onChange={(e) => setEditForm((f) => ({ ...f, address: e.target.value }))}
                  className="input"
                />
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete Confirm */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        title="업체 삭제"
        message={`"${deleteTarget?.name}" 업체를 삭제하시겠습니까? 관련된 모든 데이터가 삭제됩니다.`}
        confirmLabel="삭제"
        isLoading={deleteMutation.isPending}
      />
    </div>
  )
}
