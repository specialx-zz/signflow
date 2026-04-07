import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Store, Plus, Search, MapPin, Phone, Monitor, Trash2, Pencil,
  ChevronDown, ChevronUp, LinkIcon, Unlink, Key, Copy, Clock
} from 'lucide-react'
import { storeApi } from '@/api/stores'
import { deviceApi } from '@/api/devices'
import { Store as StoreType, Device, DeviceRegistrationToken } from '@/types'
import { PageLoader } from '@/components/ui/LoadingSpinner'
import EmptyState from '@/components/ui/EmptyState'
import Modal from '@/components/ui/Modal'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import { useDebounce } from '@/hooks/useDebounce'
import toast from 'react-hot-toast'
import { format } from 'date-fns'

const emptyForm = { name: '', address: '', phone: '' }

export default function StoresPage() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search)
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [form, setForm] = useState({ ...emptyForm })
  const [editTarget, setEditTarget] = useState<StoreType | null>(null)
  const [editForm, setEditForm] = useState({ ...emptyForm })
  const [deleteTarget, setDeleteTarget] = useState<StoreType | null>(null)
  const [expandedStoreId, setExpandedStoreId] = useState<string | null>(null)
  const [assignModalStore, setAssignModalStore] = useState<StoreType | null>(null)
  const [tokenModalStore, setTokenModalStore] = useState<StoreType | null>(null)
  const [tokenName, setTokenName] = useState('')
  const [tokenExpiry, setTokenExpiry] = useState(48)

  const { data, isLoading } = useQuery({
    queryKey: ['stores'],
    queryFn: () => storeApi.getAll(),
  })

  // Get all devices for assignment (unassigned only)
  const { data: allDevicesData } = useQuery({
    queryKey: ['devices', { limit: 200 }],
    queryFn: () => deviceApi.getAll({ limit: 200 }),
  })

  // Get tokens
  const { data: tokensData } = useQuery({
    queryKey: ['device-tokens'],
    queryFn: () => deviceApi.getTokens(),
  })

  // Get devices for expanded store
  const { data: storeDevicesData } = useQuery({
    queryKey: ['store-devices', expandedStoreId],
    queryFn: () => storeApi.getDevices(expandedStoreId!),
    enabled: !!expandedStoreId,
  })

  const createMutation = useMutation({
    mutationFn: storeApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stores'] })
      setCreateModalOpen(false)
      setForm({ ...emptyForm })
      toast.success('매장이 생성되었습니다')
    },
    onError: () => toast.error('매장 생성에 실패했습니다'),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<StoreType> }) =>
      storeApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stores'] })
      setEditTarget(null)
      toast.success('매장 정보가 수정되었습니다')
    },
    onError: () => toast.error('수정에 실패했습니다'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => storeApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stores'] })
      setDeleteTarget(null)
      toast.success('매장이 삭제되었습니다')
    },
    onError: () => toast.error('삭제에 실패했습니다'),
  })

  const assignMutation = useMutation({
    mutationFn: ({ storeId, deviceId }: { storeId: string; deviceId: string }) =>
      storeApi.assignDevice(storeId, deviceId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stores'] })
      queryClient.invalidateQueries({ queryKey: ['store-devices'] })
      queryClient.invalidateQueries({ queryKey: ['devices'] })
      toast.success('장치가 매장에 배정되었습니다')
    },
    onError: () => toast.error('장치 배정에 실패했습니다'),
  })

  const removeMutation = useMutation({
    mutationFn: ({ storeId, deviceId }: { storeId: string; deviceId: string }) =>
      storeApi.removeDevice(storeId, deviceId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stores'] })
      queryClient.invalidateQueries({ queryKey: ['store-devices'] })
      queryClient.invalidateQueries({ queryKey: ['devices'] })
      toast.success('장치 배정이 해제되었습니다')
    },
    onError: () => toast.error('장치 해제에 실패했습니다'),
  })

  const createTokenMutation = useMutation({
    mutationFn: (data: { name?: string; storeId?: string; expiresInHours?: number }) =>
      deviceApi.createToken(data),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['device-tokens'] })
      toast.success(`등록 코드: ${result.code}`)
      setTokenName('')
    },
    onError: () => toast.error('토큰 생성에 실패했습니다'),
  })

  const deleteTokenMutation = useMutation({
    mutationFn: (code: string) => deviceApi.deleteToken(code),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['device-tokens'] })
      toast.success('토큰이 삭제되었습니다')
    },
  })

  const allStores: StoreType[] = Array.isArray(data) ? data : []
  const stores = debouncedSearch
    ? allStores.filter((s) => s.name.toLowerCase().includes(debouncedSearch.toLowerCase()))
    : allStores

  // unassigned devices
  const allDevices: Device[] = allDevicesData?.items || []
  const unassignedDevices = allDevices.filter(d => !d.storeId)
  const storeDevices: Device[] = Array.isArray(storeDevicesData) ? storeDevicesData : []

  // tokens for the selected store
  const tokens: DeviceRegistrationToken[] = Array.isArray(tokensData) ? tokensData : []
  const storeTokens = tokenModalStore
    ? tokens.filter(t => t.storeId === tokenModalStore.id)
    : []

  const openEditModal = (store: StoreType) => {
    setEditTarget(store)
    setEditForm({
      name: store.name,
      address: store.address || '',
      phone: store.phone || '',
    })
  }

  const toggleExpand = (storeId: string) => {
    setExpandedStoreId(prev => prev === storeId ? null : storeId)
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast.success('복사되었습니다')
  }

  if (isLoading) return <PageLoader />

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">매장 관리</h1>
          <p className="text-gray-500 text-sm mt-1">
            전체 {stores.length}개 매장 · 장치 배정 및 등록코드 관리
          </p>
        </div>
        <button className="btn-primary" onClick={() => setCreateModalOpen(true)}>
          <Plus className="w-4 h-4" />
          새 매장 추가
        </button>
      </div>

      {/* Search */}
      <div className="card p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="매장 검색..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input pl-9"
          />
        </div>
      </div>

      {/* Store list */}
      {stores.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={Store}
            title="매장이 없습니다"
            description="새 매장을 추가하여 시작하세요"
          />
        </div>
      ) : (
        <div className="space-y-3">
          {stores.map((store) => {
            const deviceCount = store._count?.devices ?? 0
            const isExpanded = expandedStoreId === store.id

            return (
              <div key={store.id} className="card overflow-hidden">
                {/* Store header row */}
                <div className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-emerald-100 to-teal-100 rounded-xl flex items-center justify-center">
                        <Store className="w-5 h-5 text-emerald-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-800">{store.name}</h3>
                        <p className="text-xs text-gray-400">
                          {format(new Date(store.createdAt), 'yyyy-MM-dd')} 등록
                        </p>
                      </div>
                    </div>
                    <span className={`badge ${store.isActive ? 'badge-success' : 'badge-danger'}`}>
                      {store.isActive ? '활성' : '비활성'}
                    </span>
                  </div>

                  <div className="flex items-center gap-4 text-sm text-gray-600 mb-3">
                    {store.address && (
                      <div className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-gray-400" />
                        <span className="truncate max-w-48">{store.address}</span>
                      </div>
                    )}
                    {store.phone && (
                      <div className="flex items-center gap-1.5">
                        <Phone className="w-3.5 h-3.5 text-gray-400" />
                        <span>{store.phone}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-1.5">
                      <Monitor className="w-3.5 h-3.5 text-gray-400" />
                      <span>장치 {deviceCount}대</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
                    <button className="btn-ghost btn-sm" onClick={() => toggleExpand(store.id)}>
                      {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      장치 관리
                    </button>
                    <button className="btn-ghost btn-sm" onClick={() => setAssignModalStore(store)}>
                      <LinkIcon className="w-3.5 h-3.5" />
                      장치 배정
                    </button>
                    <button className="btn-ghost btn-sm" onClick={() => setTokenModalStore(store)}>
                      <Key className="w-3.5 h-3.5" />
                      등록코드
                    </button>
                    <div className="flex-1" />
                    <button className="btn-ghost btn-sm" onClick={() => openEditModal(store)}>
                      <Pencil className="w-3.5 h-3.5" /> 편집
                    </button>
                    <button
                      className="btn-ghost btn-sm text-red-500 hover:bg-red-50"
                      onClick={() => setDeleteTarget(store)}
                    >
                      <Trash2 className="w-3.5 h-3.5" /> 삭제
                    </button>
                  </div>
                </div>

                {/* Expanded device list */}
                {isExpanded && (
                  <div className="border-t border-gray-100 bg-gray-50 px-5 py-4">
                    <h4 className="text-xs font-semibold text-gray-500 uppercase mb-3">
                      배정된 장치 ({storeDevices.length}대)
                    </h4>
                    {storeDevices.length === 0 ? (
                      <p className="text-sm text-gray-400 py-2">배정된 장치가 없습니다. '장치 배정' 버튼으로 장치를 추가하세요.</p>
                    ) : (
                      <div className="space-y-2">
                        {storeDevices.map(device => (
                          <div key={device.id} className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-gray-100">
                            <div className="flex items-center gap-3">
                              <div className={`w-2.5 h-2.5 rounded-full ${device.status === 'ONLINE' ? 'bg-green-500' : 'bg-gray-300'}`} />
                              <div>
                                <span className="text-sm font-medium text-gray-700">{device.name}</span>
                                <span className="text-xs text-gray-400 ml-2">{device.deviceId}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-gray-400">{device.ipAddress || '-'}</span>
                              <button
                                className="btn-ghost btn-sm text-red-400 hover:text-red-600"
                                onClick={() => removeMutation.mutate({ storeId: store.id, deviceId: device.id })}
                              >
                                <Unlink className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Assign Device Modal */}
      {assignModalStore && (
        <Modal
          isOpen={!!assignModalStore}
          onClose={() => setAssignModalStore(null)}
          title={`${assignModalStore.name} — 장치 배정`}
          size="md"
        >
          <div className="space-y-3">
            <p className="text-sm text-gray-500 mb-3">
              미배정 장치를 이 매장에 배정합니다. ({unassignedDevices.length}대 가용)
            </p>
            {unassignedDevices.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">미배정 장치가 없습니다.</p>
            ) : (
              <div className="max-h-64 overflow-y-auto space-y-2">
                {unassignedDevices.map(device => (
                  <div key={device.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                    <div className="flex items-center gap-3">
                      <div className={`w-2.5 h-2.5 rounded-full ${device.status === 'ONLINE' ? 'bg-green-500' : 'bg-gray-300'}`} />
                      <div>
                        <span className="text-sm font-medium text-gray-700">{device.name}</span>
                        <span className="text-xs text-gray-400 ml-2">{device.deviceId}</span>
                      </div>
                    </div>
                    <button
                      className="btn-primary btn-sm"
                      onClick={() => assignMutation.mutate({ storeId: assignModalStore.id, deviceId: device.id })}
                      disabled={assignMutation.isPending}
                    >
                      <LinkIcon className="w-3 h-3" /> 배정
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Token Management Modal */}
      {tokenModalStore && (
        <Modal
          isOpen={!!tokenModalStore}
          onClose={() => setTokenModalStore(null)}
          title={`${tokenModalStore.name} — 등록코드 관리`}
          size="md"
        >
          <div className="space-y-4">
            <div className="bg-blue-50 rounded-lg p-3 text-sm text-blue-700">
              등록코드를 생성하면 현장에서 플레이어가 코드를 입력하여 이 매장에 자동 배정됩니다.
            </div>

            {/* Create token */}
            <div className="flex gap-2">
              <input
                type="text"
                value={tokenName}
                onChange={e => setTokenName(e.target.value)}
                className="input flex-1"
                placeholder="장치 이름 (선택)"
              />
              <select
                value={tokenExpiry}
                onChange={e => setTokenExpiry(parseInt(e.target.value))}
                className="select w-32"
              >
                <option value={24}>24시간</option>
                <option value={48}>48시간</option>
                <option value={168}>7일</option>
                <option value={720}>30일</option>
              </select>
              <button
                className="btn-primary"
                onClick={() => createTokenMutation.mutate({
                  name: tokenName || undefined,
                  storeId: tokenModalStore.id,
                  expiresInHours: tokenExpiry,
                })}
                disabled={createTokenMutation.isPending}
              >
                <Key className="w-4 h-4" />
                생성
              </button>
            </div>

            {/* Token list */}
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-gray-500 uppercase">생성된 코드</h4>
              {storeTokens.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">이 매장의 등록코드가 없습니다.</p>
              ) : (
                storeTokens.map(token => (
                  <div key={token.id} className={`flex items-center justify-between rounded-lg px-3 py-2 border ${token.isUsed ? 'bg-gray-50 border-gray-200' : 'bg-green-50 border-green-200'}`}>
                    <div className="flex items-center gap-3">
                      <span className={`font-mono font-bold text-lg tracking-wider ${token.isUsed ? 'text-gray-400' : 'text-green-700'}`}>
                        {token.code}
                      </span>
                      {token.name && <span className="text-xs text-gray-500">{token.name}</span>}
                    </div>
                    <div className="flex items-center gap-2">
                      {token.isUsed ? (
                        <span className="text-xs text-gray-400">사용됨</span>
                      ) : (
                        <>
                          <span className="text-xs text-gray-400 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {format(new Date(token.expiresAt), 'MM/dd HH:mm')}
                          </span>
                          <button
                            className="btn-ghost btn-sm"
                            onClick={() => copyToClipboard(token.code)}
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                        </>
                      )}
                      <button
                        className="btn-ghost btn-sm text-red-400"
                        onClick={() => deleteTokenMutation.mutate(token.code)}
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </Modal>
      )}

      {/* Create Modal */}
      <Modal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="새 매장 추가"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setCreateModalOpen(false)}>
              취소
            </button>
            <button
              className="btn-primary"
              onClick={() => createMutation.mutate(form)}
              disabled={!form.name || createMutation.isPending}
            >
              {createMutation.isPending ? '생성 중...' : '생성'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="label">매장명 *</label>
            <input type="text" value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="input" placeholder="매장명을 입력하세요" />
          </div>
          <div>
            <label className="label">주소</label>
            <input type="text" value={form.address}
              onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
              className="input" placeholder="주소" />
          </div>
          <div>
            <label className="label">전화번호</label>
            <input type="text" value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              className="input" placeholder="전화번호" />
          </div>
        </div>
      </Modal>

      {/* Edit Modal */}
      {editTarget && (
        <Modal
          isOpen={!!editTarget}
          onClose={() => setEditTarget(null)}
          title="매장 편집"
          footer={
            <>
              <button className="btn-secondary" onClick={() => setEditTarget(null)}>취소</button>
              <button
                className="btn-primary"
                onClick={() => updateMutation.mutate({
                  id: editTarget.id,
                  data: {
                    name: editForm.name,
                    address: editForm.address || undefined,
                    phone: editForm.phone || undefined,
                  },
                })}
                disabled={!editForm.name || updateMutation.isPending}
              >
                {updateMutation.isPending ? '저장 중...' : '저장'}
              </button>
            </>
          }
        >
          <div className="space-y-4">
            <div>
              <label className="label">매장명 *</label>
              <input type="text" value={editForm.name}
                onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                className="input" />
            </div>
            <div>
              <label className="label">주소</label>
              <input type="text" value={editForm.address}
                onChange={(e) => setEditForm((f) => ({ ...f, address: e.target.value }))}
                className="input" />
            </div>
            <div>
              <label className="label">전화번호</label>
              <input type="text" value={editForm.phone}
                onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))}
                className="input" />
            </div>
          </div>
        </Modal>
      )}

      {/* Delete Confirm */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        title="매장 삭제"
        message={`"${deleteTarget?.name}" 매장을 삭제하시겠습니까?`}
        confirmLabel="삭제"
        isLoading={deleteMutation.isPending}
      />
    </div>
  )
}
