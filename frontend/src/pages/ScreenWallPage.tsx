/**
 * V4 Phase 15: 스크린 월 & 동기화 재생 관리 페이지
 * V5.2: 디바이스 배치 UI, 동기화 그룹 디바이스 선택 추가
 */
import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  LayoutGrid, Plus, Trash2, Edit2, Monitor, Settings, Wifi,
  Play, Pause, RefreshCw, Star, X, Check, Search
} from 'lucide-react'
import { screenWallApi, ScreenWall, SyncGroup } from '@/api/screenWall'
import apiClient from '@/api/client'
import { PageLoader } from '@/components/ui/LoadingSpinner'
import EmptyState from '@/components/ui/EmptyState'
import { useAuthStore } from '@/store/authStore'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import toast from 'react-hot-toast'

type Tab = 'walls' | 'sync'

export default function ScreenWallPage() {
  const queryClient = useQueryClient()
  const { user } = useAuthStore()
  const canManage = user && ['SUPER_ADMIN', 'TENANT_ADMIN', 'STORE_MANAGER'].includes(user.role)
  const [activeTab, setActiveTab] = useState<Tab>('walls')
  const [showWallForm, setShowWallForm] = useState(false)
  const [showSyncForm, setShowSyncForm] = useState(false)
  const [wallForm, setWallForm] = useState({ name: '', rows: 2, cols: 2, bezelH: 0, bezelV: 0, screenW: '', screenH: '' })
  const [syncForm, setSyncForm] = useState({ name: '', syncMode: 'LAN' })
  const [selectedWall, setSelectedWall] = useState<string | null>(null)
  const [confirmAction, setConfirmAction] = useState<{ type: string; id: string } | null>(null)
  // V5.2: 디바이스 배치 모달
  const [showPlaceModal, setShowPlaceModal] = useState(false)
  const [placeTarget, setPlaceTarget] = useState<{ row: number; col: number } | null>(null)
  const [deviceSearch, setDeviceSearch] = useState('')
  // V5.2: 동기화 그룹 디바이스
  const [syncDeviceIds, setSyncDeviceIds] = useState<string[]>([])
  const [syncMasterDeviceId, setSyncMasterDeviceId] = useState<string | null>(null)

  // Data
  const { data: walls = [], isLoading: wallsLoading } = useQuery({
    queryKey: ['screenWalls'],
    queryFn: () => screenWallApi.listWalls()
  })

  const { data: wallDetail } = useQuery({
    queryKey: ['screenWall', selectedWall],
    queryFn: () => screenWallApi.getWall(selectedWall!),
    enabled: !!selectedWall
  })

  const { data: syncGroups = [], isLoading: syncLoading } = useQuery({
    queryKey: ['syncGroups'],
    queryFn: () => screenWallApi.listSyncGroups()
  })

  // Mutations
  const createWallMutation = useMutation({
    mutationFn: () => screenWallApi.createWall({
      ...wallForm,
      screenW: wallForm.screenW ? parseFloat(wallForm.screenW) : undefined,
      screenH: wallForm.screenH ? parseFloat(wallForm.screenH) : undefined
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['screenWalls'] })
      setShowWallForm(false)
      setWallForm({ name: '', rows: 2, cols: 2, bezelH: 0, bezelV: 0, screenW: '', screenH: '' })
      toast.success('스크린 월이 생성되었습니다')
    },
    onError: () => toast.error('스크린 월 생성에 실패했습니다')
  })

  const deleteWallMutation = useMutation({
    mutationFn: (id: string) => screenWallApi.deleteWall(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['screenWalls'] })
      setSelectedWall(null)
      setConfirmAction(null)
      toast.success('스크린 월이 삭제되었습니다')
    },
    onError: () => toast.error('스크린 월 삭제에 실패했습니다')
  })

  const createSyncMutation = useMutation({
    mutationFn: () => screenWallApi.createSyncGroup(syncForm),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['syncGroups'] })
      setShowSyncForm(false)
      setSyncForm({ name: '', syncMode: 'LAN' })
      toast.success('동기화 그룹이 생성되었습니다')
    },
    onError: () => toast.error('동기화 그룹 생성에 실패했습니다')
  })

  const deleteSyncMutation = useMutation({
    mutationFn: (id: string) => screenWallApi.deleteSyncGroup(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['syncGroups'] })
      setConfirmAction(null)
      toast.success('동기화 그룹이 삭제되었습니다')
    },
    onError: () => toast.error('동기화 그룹 삭제에 실패했습니다')
  })

  // V5.2: 디바이스 배치 관련
  const { data: allDevices } = useQuery({
    queryKey: ['devices-for-wall'],
    queryFn: async () => {
      const res = await apiClient.get('/devices', { params: { limit: 200 } })
      return res.data.items || res.data || []
    },
    enabled: showPlaceModal || showSyncForm
  })

  const assignDeviceMutation = useMutation({
    mutationFn: ({ wallId, deviceId, row, col }: { wallId: string; deviceId: string; row: number; col: number }) =>
      screenWallApi.assignDevice(wallId, { deviceId, row, col }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['screenWall', selectedWall] })
      queryClient.invalidateQueries({ queryKey: ['screenWalls'] })
      setShowPlaceModal(false)
      setPlaceTarget(null)
      toast.success('디바이스가 배치되었습니다')
    },
    onError: () => toast.error('디바이스 배치에 실패했습니다')
  })

  const removeDeviceMutation = useMutation({
    mutationFn: ({ wallId, deviceId }: { wallId: string; deviceId: string }) =>
      screenWallApi.removeDevice(wallId, deviceId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['screenWall', selectedWall] })
      queryClient.invalidateQueries({ queryKey: ['screenWalls'] })
      toast.success('디바이스가 제거되었습니다')
    },
    onError: () => toast.error('디바이스 제거에 실패했습니다')
  })

  // V5.2: 동기화 그룹 디바이스 설정 포함 생성
  const createSyncWithDevicesMutation = useMutation({
    mutationFn: () => screenWallApi.createSyncGroup({
      ...syncForm,
      deviceIds: syncDeviceIds,
      masterDeviceId: syncMasterDeviceId
    } as any),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['syncGroups'] })
      setShowSyncForm(false)
      setSyncForm({ name: '', syncMode: 'LAN' })
      setSyncDeviceIds([])
      setSyncMasterDeviceId(null)
      toast.success('동기화 그룹이 생성되었습니다')
    },
    onError: () => toast.error('동기화 그룹 생성에 실패했습니다')
  })

  const filteredDevicesForWall = useMemo(() => {
    const devs: any[] = allDevices || []
    const placed = (wallDetail as ScreenWall)?.devices?.map(d => d.device.id) || []
    const available = devs.filter(d => !placed.includes(d.id))
    if (!deviceSearch) return available
    const q = deviceSearch.toLowerCase()
    return available.filter(d => d.name?.toLowerCase().includes(q) || d.deviceId?.toLowerCase().includes(q))
  }, [allDevices, deviceSearch, wallDetail])

  const openPlaceModal = (row: number, col: number) => {
    setPlaceTarget({ row, col })
    setDeviceSearch('')
    setShowPlaceModal(true)
  }

  const handlePlaceDevice = (deviceId: string) => {
    if (!selectedWall || !placeTarget) return
    assignDeviceMutation.mutate({ wallId: selectedWall, deviceId, row: placeTarget.row, col: placeTarget.col })
  }

  const handleRemoveDevice = (deviceId: string) => {
    if (!selectedWall) return
    setConfirmAction({ type: 'removeDevice', id: deviceId })
  }

  const isLoading = wallsLoading || syncLoading
  if (isLoading) return <PageLoader />

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-800">스크린 월 & 동기화</h1>
        <p className="text-gray-500 text-sm mt-1">멀티스크린 월 구성과 장치 간 동기화 재생을 관리합니다</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        <button
          onClick={() => setActiveTab('walls')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition ${activeTab === 'walls' ? 'bg-white shadow text-blue-700' : 'text-gray-500'}`}
        >
          <LayoutGrid className="w-4 h-4 inline mr-1.5" />
          스크린 월 ({(walls as ScreenWall[]).length})
        </button>
        <button
          onClick={() => setActiveTab('sync')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition ${activeTab === 'sync' ? 'bg-white shadow text-blue-700' : 'text-gray-500'}`}
        >
          <Wifi className="w-4 h-4 inline mr-1.5" />
          동기화 그룹 ({(syncGroups as SyncGroup[]).length})
        </button>
      </div>

      {/* Screen Walls Tab */}
      {activeTab === 'walls' && (
        <div className="space-y-4">
          {canManage && (
            <div className="flex justify-end">
              <button className="btn-primary" onClick={() => setShowWallForm(true)}>
                <Plus className="w-4 h-4" /> 새 스크린 월
              </button>
            </div>
          )}

          <div className="flex gap-5">
            {/* Wall list */}
            <div className={`${selectedWall ? 'w-1/2' : 'w-full'} space-y-3`}>
              {(walls as ScreenWall[]).length === 0 ? (
                <div className="card">
                  <EmptyState
                    icon={LayoutGrid}
                    title="스크린 월이 없습니다"
                    description="여러 디스플레이를 하나의 대형 화면으로 구성해보세요"
                  />
                </div>
              ) : (
                (walls as ScreenWall[]).map(wall => (
                  <div
                    key={wall.id}
                    onClick={() => setSelectedWall(wall.id)}
                    className={`card p-4 cursor-pointer hover:shadow-md transition ${selectedWall === wall.id ? 'ring-2 ring-blue-500' : ''}`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-semibold text-gray-800">{wall.name}</h3>
                        <p className="text-sm text-gray-500 mt-1">
                          {wall.cols}×{wall.rows} ({wall.cols * wall.rows}대) ·
                          총 해상도 {wall.cols * 1920}×{wall.rows * 1080}
                        </p>
                        {(wall.bezelH > 0 || wall.bezelV > 0) && (
                          <p className="text-xs text-orange-500 mt-1">
                            베젤 보정: H={wall.bezelH}mm V={wall.bezelV}mm
                          </p>
                        )}
                      </div>
                      {/* Visual grid preview */}
                      <div
                        className="grid gap-0.5 flex-shrink-0"
                        style={{ gridTemplateColumns: `repeat(${wall.cols}, 1fr)`, width: 60 }}
                      >
                        {Array.from({ length: wall.rows * wall.cols }).map((_, i) => {
                          const r = Math.floor(i / wall.cols)
                          const c = i % wall.cols
                          const hasDevice = wall.devices?.some(d => d.row === r && d.col === c)
                          return (
                            <div
                              key={i}
                              className={`aspect-video rounded-sm ${hasDevice ? 'bg-blue-400' : 'bg-gray-200'}`}
                            />
                          )
                        })}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-2 text-xs text-gray-400">
                      <Monitor className="w-3.5 h-3.5" />
                      {wall.devices?.length || 0} / {wall.rows * wall.cols} 배치됨
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Wall detail */}
            {selectedWall && wallDetail && (
              <div className="w-1/2">
                <div className="card p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-bold text-gray-800">{(wallDetail as ScreenWall).name}</h2>
                    {canManage && (
                      <button
                        onClick={() => setConfirmAction({ type: 'deleteWall', id: (wallDetail as ScreenWall).id })}
                        className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-gray-100"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {/* Grid visualization */}
                  <div className="bg-gray-900 rounded-xl p-4">
                    <div
                      className="grid gap-1 mx-auto"
                      style={{
                        gridTemplateColumns: `repeat(${(wallDetail as ScreenWall).cols}, 1fr)`,
                        maxWidth: 400
                      }}
                    >
                      {Array.from({ length: (wallDetail as ScreenWall).rows * (wallDetail as ScreenWall).cols }).map((_, i) => {
                        const r = Math.floor(i / (wallDetail as ScreenWall).cols)
                        const c = i % (wallDetail as ScreenWall).cols
                        const device = (wallDetail as ScreenWall).devices?.find(d => d.row === r && d.col === c)
                        return (
                          <div
                            key={i}
                            onClick={() => {
                              if (!canManage) return
                              if (device) {
                                handleRemoveDevice(device.device.id)
                              } else {
                                openPlaceModal(r, c)
                              }
                            }}
                            className={`aspect-video rounded flex items-center justify-center text-xs cursor-pointer transition-colors ${
                              device
                                ? device.device.status === 'ONLINE'
                                  ? 'bg-green-800 text-green-200 hover:bg-green-700'
                                  : 'bg-blue-900 text-blue-300 hover:bg-blue-800'
                                : 'bg-gray-700 text-gray-500 hover:bg-gray-600 hover:text-gray-300'
                            }`}
                            title={device ? `${device.device.name} (클릭하여 제거)` : `(${r},${c}) 클릭하여 디바이스 배치`}
                          >
                            {device ? (
                              <div className="text-center">
                                <Monitor className="w-4 h-4 mx-auto mb-0.5" />
                                <span className="text-[10px] leading-tight block">{device.device.name}</span>
                              </div>
                            ) : (
                              <div className="text-center">
                                <Plus className="w-3 h-3 mx-auto mb-0.5 opacity-50" />
                                <span className="text-[10px]">({r},{c})</span>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  {/* Info */}
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="bg-gray-50 rounded-lg p-3">
                      <span className="text-gray-500">해상도</span>
                      <p className="font-semibold text-gray-800 mt-1">
                        {(wallDetail as ScreenWall).totalResolution?.label || `${(wallDetail as ScreenWall).cols * 1920}×${(wallDetail as ScreenWall).rows * 1080}`}
                      </p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <span className="text-gray-500">배치</span>
                      <p className="font-semibold text-gray-800 mt-1">
                        {(wallDetail as ScreenWall).devices?.length || 0} / {(wallDetail as ScreenWall).rows * (wallDetail as ScreenWall).cols}대
                      </p>
                    </div>
                    {((wallDetail as ScreenWall).bezelH > 0 || (wallDetail as ScreenWall).bezelV > 0) && (
                      <div className="bg-orange-50 rounded-lg p-3 col-span-2">
                        <span className="text-orange-600">베젤 보정</span>
                        <p className="font-semibold text-orange-800 mt-1">
                          수평 {(wallDetail as ScreenWall).bezelH}mm · 수직 {(wallDetail as ScreenWall).bezelV}mm
                          {(wallDetail as ScreenWall).screenW && ` · 화면 ${(wallDetail as ScreenWall).screenW}×${(wallDetail as ScreenWall).screenH}mm`}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Sync Groups Tab */}
      {activeTab === 'sync' && (
        <div className="space-y-4">
          {canManage && (
            <div className="flex justify-end">
              <button className="btn-primary" onClick={() => setShowSyncForm(true)}>
                <Plus className="w-4 h-4" /> 새 동기화 그룹
              </button>
            </div>
          )}

          {(syncGroups as SyncGroup[]).length === 0 ? (
            <div className="card">
              <EmptyState
                icon={Wifi}
                title="동기화 그룹이 없습니다"
                description="여러 장치에서 콘텐츠를 동시에 재생하도록 설정해보세요"
              />
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {(syncGroups as SyncGroup[]).map(group => (
                <div key={group.id} className="card p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-gray-800">{group.name}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          group.syncMode === 'LAN' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                        }`}>
                          {group.syncMode}
                        </span>
                        <span className="text-xs text-gray-400">
                          드리프트 한계: ±{group.driftThreshold}ms
                        </span>
                      </div>
                    </div>
                    {canManage && (
                      <button
                        onClick={() => setConfirmAction({ type: 'deleteSync', id: group.id })}
                        className="p-1 text-gray-300 hover:text-red-500"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {/* Devices */}
                  <div className="space-y-1.5">
                    {group.devices?.length ? group.devices.map(gd => (
                      <div key={gd.id} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg text-xs">
                        <div className={`w-2 h-2 rounded-full ${gd.device.status === 'ONLINE' ? 'bg-green-500' : 'bg-gray-300'}`} />
                        <span className="font-medium text-gray-700">{gd.device.name}</span>
                        {gd.isMaster && (
                          <span className="flex items-center gap-0.5 text-yellow-600 bg-yellow-100 px-1.5 py-0.5 rounded-full">
                            <Star className="w-3 h-3" /> 마스터
                          </span>
                        )}
                      </div>
                    )) : (
                      <p className="text-xs text-gray-400 py-2 text-center">장치 없음</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <ConfirmDialog
        isOpen={!!confirmAction}
        onClose={() => setConfirmAction(null)}
        onConfirm={() => {
          if (!confirmAction) return
          if (confirmAction.type === 'deleteWall') deleteWallMutation.mutate(confirmAction.id)
          else if (confirmAction.type === 'deleteSync') deleteSyncMutation.mutate(confirmAction.id)
          else if (confirmAction.type === 'removeDevice' && selectedWall) removeDeviceMutation.mutate({ wallId: selectedWall, deviceId: confirmAction.id })
        }}
        title={confirmAction?.type === 'removeDevice' ? '디바이스 제거' : '삭제 확인'}
        message={confirmAction?.type === 'removeDevice' ? '이 위치에서 디바이스를 제거하시겠습니까?' : '삭제하시겠습니까?'}
        confirmLabel="삭제"
        isLoading={deleteWallMutation.isPending || deleteSyncMutation.isPending || removeDeviceMutation.isPending}
      />

      {/* Create Wall Modal */}
      {showWallForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowWallForm(false)}>
          <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4 shadow-2xl" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-gray-800 mb-4">새 스크린 월</h2>
            <form onSubmit={e => { e.preventDefault(); createWallMutation.mutate() }} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">이름 *</label>
                <input
                  type="text" value={wallForm.name}
                  onChange={e => setWallForm(f => ({ ...f, name: e.target.value }))}
                  className="input" placeholder="예: 로비 대형 스크린" required autoFocus
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">가로 (열) *</label>
                  <input
                    type="number" value={wallForm.cols} min={1} max={10}
                    onChange={e => setWallForm(f => ({ ...f, cols: Number(e.target.value) }))}
                    className="input"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">세로 (행) *</label>
                  <input
                    type="number" value={wallForm.rows} min={1} max={10}
                    onChange={e => setWallForm(f => ({ ...f, rows: Number(e.target.value) }))}
                    className="input"
                  />
                </div>
              </div>
              <div className="text-xs text-gray-500 bg-gray-50 p-2 rounded">
                총 {wallForm.cols * wallForm.rows}대 · {wallForm.cols * 1920}×{wallForm.rows * 1080} 해상도
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">수평 베젤 (mm)</label>
                  <input
                    type="number" value={wallForm.bezelH} min={0} step={0.1}
                    onChange={e => setWallForm(f => ({ ...f, bezelH: Number(e.target.value) }))}
                    className="input text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">수직 베젤 (mm)</label>
                  <input
                    type="number" value={wallForm.bezelV} min={0} step={0.1}
                    onChange={e => setWallForm(f => ({ ...f, bezelV: Number(e.target.value) }))}
                    className="input text-sm"
                  />
                </div>
              </div>
              <div className="flex gap-3 justify-end pt-2">
                <button type="button" onClick={() => setShowWallForm(false)} className="btn-secondary">취소</button>
                <button type="submit" className="btn-primary" disabled={createWallMutation.isPending}>생성</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Sync Group Modal */}
      {showSyncForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowSyncForm(false)}>
          <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4 shadow-2xl" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-gray-800 mb-4">새 동기화 그룹</h2>
            <form onSubmit={e => { e.preventDefault(); createSyncWithDevicesMutation.mutate() }} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">그룹 이름 *</label>
                <input
                  type="text" value={syncForm.name}
                  onChange={e => setSyncForm(f => ({ ...f, name: e.target.value }))}
                  className="input" placeholder="예: 1층 로비 동기화" required autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">동기화 모드</label>
                <select
                  value={syncForm.syncMode}
                  onChange={e => setSyncForm(f => ({ ...f, syncMode: e.target.value }))}
                  className="input"
                >
                  <option value="LAN">LAN (±50ms, 같은 네트워크)</option>
                  <option value="WAN">WAN (±500ms, 인터넷 경유)</option>
                </select>
              </div>
              <div className="text-xs text-blue-600 bg-blue-50 p-2 rounded">
                {syncForm.syncMode === 'LAN'
                  ? 'LAN 모드: 같은 네트워크의 장치들을 ±50ms 이내로 동기화합니다. 스크린 월에 권장됩니다.'
                  : 'WAN 모드: 인터넷 경유 시 ±500ms 수준으로 동기화됩니다. 정밀 동기화는 보장되지 않습니다.'}
              </div>

              {/* V5.2: 디바이스 선택 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">디바이스 선택</label>
                <div className="max-h-40 overflow-y-auto space-y-1 border rounded-lg p-2">
                  {(allDevices as any[] || []).length === 0 ? (
                    <p className="text-xs text-gray-400 text-center py-2">디바이스가 없습니다</p>
                  ) : (
                    (allDevices as any[] || []).map((device: any) => {
                      const isSelected = syncDeviceIds.includes(device.id)
                      const isMaster = syncMasterDeviceId === device.id
                      return (
                        <div key={device.id} className="flex items-center gap-2 p-1.5 rounded hover:bg-gray-50">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {
                              setSyncDeviceIds(prev =>
                                prev.includes(device.id) ? prev.filter(id => id !== device.id) : [...prev, device.id]
                              )
                              if (syncMasterDeviceId === device.id) setSyncMasterDeviceId(null)
                            }}
                            className="rounded border-gray-300"
                          />
                          <div className={`w-2 h-2 rounded-full ${device.status === 'ONLINE' ? 'bg-green-500' : 'bg-gray-300'}`} />
                          <span className="text-sm text-gray-700 flex-1">{device.name}</span>
                          {isSelected && (
                            <label className="flex items-center gap-1 text-xs">
                              <input
                                type="radio"
                                name="syncMaster"
                                checked={isMaster}
                                onChange={() => setSyncMasterDeviceId(device.id)}
                                className="border-gray-300"
                              />
                              <span className={isMaster ? 'text-yellow-600 font-medium' : 'text-gray-400'}>마스터</span>
                            </label>
                          )}
                        </div>
                      )
                    })
                  )}
                </div>
                {syncDeviceIds.length > 0 && (
                  <p className="text-xs text-gray-500 mt-1">{syncDeviceIds.length}대 선택됨</p>
                )}
              </div>

              <div className="flex gap-3 justify-end pt-2">
                <button type="button" onClick={() => setShowSyncForm(false)} className="btn-secondary">취소</button>
                <button type="submit" className="btn-primary" disabled={createSyncWithDevicesMutation.isPending}>생성</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* V5.2: 디바이스 배치 모달 */}
      {showPlaceModal && placeTarget && selectedWall && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowPlaceModal(false)}>
          <div className="bg-white rounded-xl p-6 w-full max-w-sm mx-4 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-800">
                디바이스 배치 ({placeTarget.row},{placeTarget.col})
              </h2>
              <button onClick={() => setShowPlaceModal(false)} className="p-1 text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="디바이스 검색..."
                value={deviceSearch}
                onChange={e => setDeviceSearch(e.target.value)}
                className="input pl-9 text-sm"
                autoFocus
              />
            </div>

            <div className="max-h-60 overflow-y-auto space-y-1">
              {filteredDevicesForWall.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-6">배치 가능한 디바이스가 없습니다</p>
              ) : (
                filteredDevicesForWall.map((device: any) => (
                  <div
                    key={device.id}
                    onClick={() => handlePlaceDevice(device.id)}
                    className="flex items-center gap-3 p-2.5 rounded-lg cursor-pointer bg-gray-50 hover:bg-blue-50 hover:border-blue-200 border border-transparent transition-colors"
                  >
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${device.status === 'ONLINE' ? 'bg-green-500' : 'bg-gray-300'}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-700 truncate">{device.name}</p>
                      <p className="text-xs text-gray-400 truncate">{device.deviceId?.slice(-8)}</p>
                    </div>
                    <Monitor className="w-4 h-4 text-gray-300" />
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
