import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  Monitor, Plus, Search, Trash2, Wifi, WifiOff, AlertTriangle,
  Settings, Eye, FolderOpen
} from 'lucide-react'
import { deviceApi } from '@/api/devices'
import { storeApi } from '@/api/stores'
import { Device } from '@/types'
import { PageLoader } from '@/components/ui/LoadingSpinner'
import StatusBadge from '@/components/ui/StatusBadge'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import EmptyState from '@/components/ui/EmptyState'
import Modal from '@/components/ui/Modal'
import Pagination from '@/components/ui/Pagination'
import { useAuthStore } from '@/store/authStore'
import { useDebounce } from '@/hooks/useDebounce'
import toast from 'react-hot-toast'
import { safeFormat } from '@/utils/date'

const statusIcons: Record<string, React.ElementType> = {
  ONLINE: Wifi,
  OFFLINE: WifiOff,
  WARNING: AlertTriangle
}

const ITEMS_PER_PAGE = 20

const statusColors: Record<string, string> = {
  ONLINE: 'text-green-500',
  OFFLINE: 'text-gray-400',
  WARNING: 'text-yellow-500'
}

export default function DevicesPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user } = useAuthStore()
  const canManage = ['SUPER_ADMIN', 'TENANT_ADMIN', 'STORE_MANAGER'].includes(user?.role || '')
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search)
  const [statusFilter, setStatusFilter] = useState('')
  const [storeFilter, setStoreFilter] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<Device | null>(null)
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [page, setPage] = useState(1)
  const [form, setForm] = useState({
    name: '', deviceId: '', ipAddress: '', macAddress: '',
    model: '', resolution: '1920x1080', location: '', groupId: '', storeId: ''
  })

  const { data, isLoading } = useQuery({
    queryKey: ['devices', { search: debouncedSearch, status: statusFilter, storeId: storeFilter }],
    queryFn: () => deviceApi.getAll({ search: debouncedSearch, status: statusFilter || undefined, storeId: storeFilter || undefined })
  })

  const { data: groupsData } = useQuery({
    queryKey: ['device-groups'],
    queryFn: deviceApi.getGroups
  })

  const { data: storesData } = useQuery({
    queryKey: ['stores'],
    queryFn: storeApi.getAll
  })

  const createMutation = useMutation({
    mutationFn: (data: typeof form) =>
      deviceApi.create({
        ...data,
        groupId: data.groupId || undefined,
        storeId: data.storeId || undefined,
        ipAddress: data.ipAddress || undefined,
        macAddress: data.macAddress || undefined,
        model: data.model || undefined,
        location: data.location || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['devices'] })
      setAddModalOpen(false)
      setForm({ name: '', deviceId: '', ipAddress: '', macAddress: '', model: '', resolution: '1920x1080', location: '', groupId: '', storeId: '' })
      toast.success('장치가 등록되었습니다')
    },
    onError: () => toast.error('등록에 실패했습니다')
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deviceApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['devices'] })
      setDeleteTarget(null)
      toast.success('장치가 삭제되었습니다')
    },
    onError: () => toast.error('장치 삭제에 실패했습니다')
  })

  const devices: Device[] = data?.items || []
  const totalPages = Math.ceil(devices.length / ITEMS_PER_PAGE)
  const paginatedDevices = useMemo(
    () => devices.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE),
    [devices, page]
  )

  if (isLoading) return <PageLoader />

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">장치 관리</h1>
          <p className="text-gray-500 text-sm mt-1">연결된 디스플레이 장치를 관리하세요</p>
        </div>
        {canManage && (
          <button className="btn-primary" onClick={() => setAddModalOpen(true)}>
            <Plus className="w-4 h-4" />
            장치 등록
          </button>
        )}
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: '전체', value: devices.length, color: 'text-gray-700', bg: 'bg-gray-50' },
          { label: '온라인', value: devices.filter(d => d.status === 'ONLINE').length, color: 'text-green-700', bg: 'bg-green-50' },
          { label: '오프라인', value: devices.filter(d => d.status === 'OFFLINE').length, color: 'text-red-700', bg: 'bg-red-50' }
        ].map(s => (
          <div key={s.label} className={`card p-4 ${s.bg}`}>
            <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-sm text-gray-500">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="card p-4">
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="장치 이름, ID, IP 검색..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1) }}
              className="input pl-9"
            />
          </div>
          <select
            value={statusFilter}
            onChange={e => { setStatusFilter(e.target.value); setPage(1) }}
            className="select w-36"
          >
            <option value="">전체 상태</option>
            <option value="ONLINE">온라인</option>
            <option value="OFFLINE">오프라인</option>
            <option value="WARNING">경고</option>
          </select>
          <select
            value={storeFilter}
            onChange={e => { setStoreFilter(e.target.value); setPage(1) }}
            className="select w-40"
          >
            <option value="">전체 매장</option>
            {(storesData as { id: string; name: string }[] | undefined)?.map((s: { id: string; name: string }) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Device grid */}
      {devices.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={Monitor}
            title="등록된 장치가 없습니다"
            description="새 장치를 등록하여 시작하세요"
            action={
              canManage ? (
                <button className="btn-primary" onClick={() => setAddModalOpen(true)}>
                  <Plus className="w-4 h-4" /> 장치 등록
                </button>
              ) : undefined
            }
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {paginatedDevices.map(device => {
            const StatusIcon = statusIcons[device.status] || WifiOff
            const statusColor = statusColors[device.status] || 'text-gray-400'
            return (
              <div key={device.id} className="card group hover:shadow-md transition-shadow">
                {/* Status indicator */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full
                      ${device.status === 'ONLINE' ? 'bg-green-500 animate-pulse' :
                        device.status === 'WARNING' ? 'bg-yellow-500' : 'bg-gray-300'}`} />
                    <StatusBadge status={device.status} />
                  </div>
                  <StatusIcon className={`w-5 h-5 ${statusColor}`} />
                </div>

                {/* Monitor icon */}
                <div className="flex justify-center mb-3">
                  <div className={`w-16 h-16 rounded-xl flex items-center justify-center
                    ${device.status === 'ONLINE' ? 'bg-blue-50' : 'bg-gray-100'}`}>
                    <Monitor className={`w-8 h-8 ${device.status === 'ONLINE' ? 'text-blue-500' : 'text-gray-400'}`} />
                  </div>
                </div>

                <div className="text-center mb-3">
                  <h3 className="font-semibold text-gray-800 truncate">{device.name}</h3>
                  <p className="text-xs text-gray-500 mt-0.5">{device.deviceId}</p>
                  <div className="mt-1">
                    {device.store ? (
                      <span className="inline-block text-xs px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full">
                        {device.store.name}
                      </span>
                    ) : (
                      <span className="inline-block text-xs px-2 py-0.5 bg-gray-100 text-gray-400 rounded-full">
                        미배정
                      </span>
                    )}
                  </div>
                </div>

                <div className="space-y-1.5 text-xs text-gray-500 mb-4">
                  <div className="flex justify-between">
                    <span>IP</span>
                    <span className="font-medium text-gray-700">{device.ipAddress || '-'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>모델</span>
                    <span className="font-medium text-gray-700 truncate max-w-24">{device.model || '-'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>해상도</span>
                    <span className="font-medium text-gray-700">{device.resolution || '-'}</span>
                  </div>
                  {device.lastSeen && (
                    <div className="flex justify-between">
                      <span>최근 접속</span>
                      <span className="font-medium text-gray-700">
                        {safeFormat(device.lastSeen, 'MM/dd HH:mm')}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex gap-1 pt-3 border-t border-gray-100">
                  <button
                    className="flex-1 flex items-center justify-center gap-1 text-xs py-2 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                    onClick={() => navigate(`/devices/${device.id}`)}
                  >
                    <Eye className="w-3.5 h-3.5" />
                    상세
                  </button>
                  {canManage && (
                    <button
                      className="flex-1 flex items-center justify-center gap-1 text-xs py-2 bg-gray-50 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                      onClick={() => navigate(`/devices/${device.id}`)}
                    >
                      <Settings className="w-3.5 h-3.5" />
                      설정
                    </button>
                  )}
                  {canManage && (
                    <button
                      className="px-3 text-xs py-2 bg-red-50 text-red-500 hover:bg-red-100 rounded-lg transition-colors"
                      onClick={() => setDeleteTarget(device)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />

      {/* Add Device Modal */}
      <Modal
        isOpen={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        title="장치 등록"
        size="lg"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setAddModalOpen(false)}>취소</button>
            <button
              className="btn-primary"
              onClick={() => createMutation.mutate(form as typeof form)}
              disabled={!form.name || !form.deviceId || createMutation.isPending}
            >
              {createMutation.isPending ? '등록 중...' : '등록'}
            </button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">장치 이름 *</label>
            <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="input" placeholder="장치 이름" />
          </div>
          <div>
            <label className="label">장치 ID *</label>
            <input type="text" value={form.deviceId} onChange={e => setForm(f => ({ ...f, deviceId: e.target.value }))} className="input" placeholder="DEV-001" />
          </div>
          <div>
            <label className="label">IP 주소</label>
            <input type="text" value={form.ipAddress} onChange={e => setForm(f => ({ ...f, ipAddress: e.target.value }))} className="input" placeholder="192.168.1.100" />
          </div>
          <div>
            <label className="label">MAC 주소</label>
            <input type="text" value={form.macAddress} onChange={e => setForm(f => ({ ...f, macAddress: e.target.value }))} className="input" placeholder="AA:BB:CC:DD:EE:FF" />
          </div>
          <div>
            <label className="label">모델</label>
            <input type="text" value={form.model} onChange={e => setForm(f => ({ ...f, model: e.target.value }))} className="input" placeholder="Samsung QM55R" />
          </div>
          <div>
            <label className="label">해상도</label>
            <select value={form.resolution} onChange={e => setForm(f => ({ ...f, resolution: e.target.value }))} className="select">
              <option value="1920x1080">1920x1080 (FHD)</option>
              <option value="3840x2160">3840x2160 (4K)</option>
              <option value="1280x720">1280x720 (HD)</option>
            </select>
          </div>
          <div>
            <label className="label">그룹</label>
            <select value={form.groupId} onChange={e => setForm(f => ({ ...f, groupId: e.target.value }))} className="select">
              <option value="">그룹 없음</option>
              {groupsData?.map((g: { id: string; name: string }) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">매장</label>
            <select value={form.storeId} onChange={e => setForm(f => ({ ...f, storeId: e.target.value }))} className="select">
              <option value="">매장 없음</option>
              {(storesData as { id: string; name: string }[] | undefined)?.map((s: { id: string; name: string }) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">위치</label>
            <input type="text" value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} className="input" placeholder="설치 위치" />
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        title="장치 삭제"
        message={`"${deleteTarget?.name}"을(를) 삭제하시겠습니까?`}
        confirmLabel="삭제"
        isLoading={deleteMutation.isPending}
      />
    </div>
  )
}
