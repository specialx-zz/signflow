/**
 * V4 Phase 13: 채널 관리 페이지
 * V5.2: 디바이스 할당 UI 추가
 */
import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Radio, Plus, Search, Trash2, Edit2, Monitor, Film,
  Star, ChevronRight, Settings, X, Check
} from 'lucide-react'
import { channelApi, Channel } from '@/api/channels'
import { PageLoader } from '@/components/ui/LoadingSpinner'
import EmptyState from '@/components/ui/EmptyState'
import { useAuthStore } from '@/store/authStore'
import { useDebounce } from '@/hooks/useDebounce'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import apiClient from '@/api/client'
import toast from 'react-hot-toast'
import { format } from 'date-fns'

export default function ChannelsPage() {
  const queryClient = useQueryClient()
  const { user } = useAuthStore()
  const canEdit = user && user.role !== 'VIEWER'
  const canManage = user && ['SUPER_ADMIN', 'TENANT_ADMIN', 'STORE_MANAGER'].includes(user.role)

  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search)
  const [showForm, setShowForm] = useState(false)
  const [editingChannel, setEditingChannel] = useState<Channel | null>(null)
  const [selectedChannel, setSelectedChannel] = useState<string | null>(null)
  const [formData, setFormData] = useState({ name: '', description: '', isDefault: false })
  const [deleteChannelTarget, setDeleteChannelTarget] = useState<string | null>(null)
  const [showDeviceModal, setShowDeviceModal] = useState(false)
  const [deviceSearch, setDeviceSearch] = useState('')
  const [selectedDeviceIds, setSelectedDeviceIds] = useState<string[]>([])

  // List
  const { data, isLoading } = useQuery({
    queryKey: ['channels', { search: debouncedSearch }],
    queryFn: () => channelApi.list({ search: debouncedSearch || undefined })
  })

  // Detail
  const { data: channelDetail } = useQuery({
    queryKey: ['channel', selectedChannel],
    queryFn: () => channelApi.get(selectedChannel!),
    enabled: !!selectedChannel
  })

  // Mutations
  const createMutation = useMutation({
    mutationFn: (data: { name: string; description?: string; isDefault?: boolean }) =>
      channelApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['channels'] })
      setShowForm(false)
      setFormData({ name: '', description: '', isDefault: false })
      toast.success('채널이 생성되었습니다')
    },
    onError: () => toast.error('채널 생성에 실패했습니다')
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Partial<Channel>) =>
      channelApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['channels'] })
      queryClient.invalidateQueries({ queryKey: ['channel'] })
      setEditingChannel(null)
      setShowForm(false)
      toast.success('채널이 수정되었습니다')
    },
    onError: () => toast.error('채널 수정에 실패했습니다')
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => channelApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['channels'] })
      if (selectedChannel) setSelectedChannel(null)
      setDeleteChannelTarget(null)
      toast.success('채널이 삭제되었습니다')
    },
    onError: () => toast.error('채널 삭제에 실패했습니다')
  })

  const removeContentMutation = useMutation({
    mutationFn: ({ channelId, itemId }: { channelId: string; itemId: string }) =>
      channelApi.removeContent(channelId, itemId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['channel'] })
      toast.success('콘텐츠가 제거되었습니다')
    },
    onError: () => toast.error('콘텐츠 제거에 실패했습니다')
  })

  const assignDevicesMutation = useMutation({
    mutationFn: ({ channelId, deviceIds }: { channelId: string; deviceIds: string[] }) =>
      channelApi.assignDevices(channelId, deviceIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['channel'] })
      queryClient.invalidateQueries({ queryKey: ['channels'] })
      setShowDeviceModal(false)
      toast.success('디바이스가 할당되었습니다')
    },
    onError: () => toast.error('디바이스 할당에 실패했습니다')
  })

  // Fetch all devices for assignment modal
  const { data: allDevices } = useQuery({
    queryKey: ['devices-for-channel'],
    queryFn: async () => {
      const res = await apiClient.get('/devices', { params: { limit: 200 } })
      return res.data.items || res.data || []
    },
    enabled: showDeviceModal
  })

  const items: Channel[] = data?.items || []

  // Filtered devices for modal
  const filteredDevices = useMemo(() => {
    const devs: any[] = allDevices || []
    if (!deviceSearch) return devs
    const q = deviceSearch.toLowerCase()
    return devs.filter((d: any) =>
      d.name?.toLowerCase().includes(q) || d.deviceId?.toLowerCase().includes(q) || d.location?.toLowerCase().includes(q)
    )
  }, [allDevices, deviceSearch])

  const openDeviceModal = () => {
    // Pre-select currently assigned devices
    const currentIds = channelDetail?.devices?.map((d: any) => d.device.id) || []
    setSelectedDeviceIds(currentIds)
    setDeviceSearch('')
    setShowDeviceModal(true)
  }

  const toggleDevice = (deviceId: string) => {
    setSelectedDeviceIds(prev =>
      prev.includes(deviceId) ? prev.filter(id => id !== deviceId) : [...prev, deviceId]
    )
  }

  const handleAssignDevices = () => {
    if (!selectedChannel) return
    assignDevicesMutation.mutate({ channelId: selectedChannel, deviceIds: selectedDeviceIds })
  }

  const openCreate = () => {
    setEditingChannel(null)
    setFormData({ name: '', description: '', isDefault: false })
    setShowForm(true)
  }

  const openEdit = (channel: Channel) => {
    setEditingChannel(channel)
    setFormData({ name: channel.name, description: channel.description || '', isDefault: channel.isDefault })
    setShowForm(true)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name.trim()) return
    if (editingChannel) {
      updateMutation.mutate({ id: editingChannel.id, ...formData })
    } else {
      createMutation.mutate(formData)
    }
  }

  if (isLoading) return <PageLoader />

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">채널</h1>
          <p className="text-gray-500 text-sm mt-1">장치에 콘텐츠를 실시간 배포하는 방송 채널을 관리합니다</p>
        </div>
        {canEdit && (
          <button className="btn-primary" onClick={openCreate}>
            <Plus className="w-4 h-4" /> 새 채널
          </button>
        )}
      </div>

      {/* Search */}
      <div className="card p-4">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="채널 검색..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="input pl-9"
          />
        </div>
      </div>

      <div className="flex gap-5">
        {/* Channel List */}
        <div className={`${selectedChannel ? 'w-1/2' : 'w-full'} space-y-3`}>
          {items.length === 0 ? (
            <div className="card">
              <EmptyState
                icon={Radio}
                title="채널이 없습니다"
                description="채널을 만들어 장치에 콘텐츠를 실시간으로 배포하세요"
                action={canEdit ? <button className="btn-primary" onClick={openCreate}><Plus className="w-4 h-4" /> 새 채널</button> : undefined}
              />
            </div>
          ) : (
            items.map(channel => (
              <div
                key={channel.id}
                onClick={() => setSelectedChannel(channel.id)}
                className={`card p-4 cursor-pointer hover:shadow-md transition-all ${
                  selectedChannel === channel.id ? 'ring-2 ring-blue-500' : ''
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      channel.isDefault ? 'bg-yellow-100' : channel.isActive ? 'bg-blue-100' : 'bg-gray-100'
                    }`}>
                      <Radio className={`w-5 h-5 ${
                        channel.isDefault ? 'text-yellow-600' : channel.isActive ? 'text-blue-600' : 'text-gray-400'
                      }`} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-gray-800">{channel.name}</h3>
                        {channel.isDefault && (
                          <span className="flex items-center gap-1 text-xs px-1.5 py-0.5 bg-yellow-100 text-yellow-700 rounded-full">
                            <Star className="w-3 h-3" /> 기본
                          </span>
                        )}
                        {!channel.isActive && (
                          <span className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded-full">비활성</span>
                        )}
                      </div>
                      {channel.description && (
                        <p className="text-sm text-gray-500 mt-0.5">{channel.description}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-gray-400">
                    <span className="flex items-center gap-1"><Film className="w-3.5 h-3.5" /> {channel._count?.contents || 0}</span>
                    <span className="flex items-center gap-1"><Monitor className="w-3.5 h-3.5" /> {channel._count?.devices || 0}</span>
                    <ChevronRight className="w-4 h-4" />
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Channel Detail */}
        {selectedChannel && channelDetail && (
          <div className="w-1/2 space-y-4">
            <div className="card p-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-gray-800">{channelDetail.name}</h2>
                <div className="flex gap-1">
                  {canEdit && (
                    <button onClick={() => openEdit(channelDetail)} className="p-1.5 text-gray-400 hover:text-blue-500 rounded-lg hover:bg-gray-100">
                      <Edit2 className="w-4 h-4" />
                    </button>
                  )}
                  {canManage && (
                    <button
                      onClick={() => setDeleteChannelTarget(channelDetail.id)}
                      className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-gray-100"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Contents */}
              <div className="mb-4">
                <h3 className="text-sm font-semibold text-gray-600 mb-2 flex items-center gap-2">
                  <Film className="w-4 h-4" /> 콘텐츠 ({channelDetail.contents?.length || 0})
                </h3>
                {channelDetail.contents?.length ? (
                  <div className="space-y-2">
                    {channelDetail.contents.map((item, idx) => (
                      <div key={item.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-gray-400 w-5 text-center">{idx + 1}</span>
                          <div className="w-10 h-7 bg-gray-200 rounded overflow-hidden flex-shrink-0">
                            {item.content.thumbnail ? (
                              <img src={item.content.thumbnail} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <Film className="w-3 h-3 text-gray-400" />
                              </div>
                            )}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-700">{item.content.name}</p>
                            <p className="text-xs text-gray-400">{item.content.type} {item.duration ? `· ${item.duration}초` : ''}</p>
                          </div>
                        </div>
                        {canEdit && (
                          <button
                            onClick={() => removeContentMutation.mutate({ channelId: channelDetail.id, itemId: item.id })}
                            className="p-1 text-gray-300 hover:text-red-500"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 py-3 text-center bg-gray-50 rounded-lg">콘텐츠가 없습니다</p>
                )}
              </div>

              {/* Devices */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold text-gray-600 flex items-center gap-2">
                    <Monitor className="w-4 h-4" /> 배정된 장치 ({channelDetail.devices?.length || 0})
                  </h3>
                  {canManage && (
                    <button
                      onClick={openDeviceModal}
                      className="text-xs px-2 py-1 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 flex items-center gap-1"
                    >
                      <Settings className="w-3 h-3" /> 디바이스 관리
                    </button>
                  )}
                </div>
                {channelDetail.devices?.length ? (
                  <div className="space-y-2">
                    {channelDetail.devices.map(item => (
                      <div key={item.deviceId} className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg">
                        <div className={`w-2 h-2 rounded-full ${item.device.status === 'ONLINE' ? 'bg-green-500' : 'bg-gray-300'}`} />
                        <div>
                          <p className="text-sm font-medium text-gray-700">{item.device.name}</p>
                          <p className="text-xs text-gray-400">{item.device.deviceId} {item.device.location ? `· ${item.device.location}` : ''}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 py-3 text-center bg-gray-50 rounded-lg">배정된 장치가 없습니다</p>
                )}
              </div>

              <div className="mt-3 text-xs text-gray-400">
                생성: {channelDetail.creator?.username} · {format(new Date(channelDetail.createdAt), 'yyyy-MM-dd HH:mm')}
              </div>
            </div>
          </div>
        )}
      </div>

      <ConfirmDialog
        isOpen={!!deleteChannelTarget}
        onClose={() => setDeleteChannelTarget(null)}
        onConfirm={() => deleteChannelTarget && deleteMutation.mutate(deleteChannelTarget)}
        title="채널 삭제"
        message="이 채널을 삭제하시겠습니까?"
        confirmLabel="삭제"
        isLoading={deleteMutation.isPending}
      />

      {/* Create/Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4 shadow-2xl" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-gray-800 mb-4">
              {editingChannel ? '채널 수정' : '새 채널 만들기'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">채널 이름 *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className="input"
                  placeholder="예: 1층 로비"
                  autoFocus
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">설명</label>
                <textarea
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  className="input"
                  rows={2}
                  placeholder="채널에 대한 설명"
                />
              </div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.isDefault}
                  onChange={e => setFormData({ ...formData, isDefault: e.target.checked })}
                  className="rounded border-gray-300"
                />
                <span className="text-sm text-gray-700">기본 채널로 설정 (스케줄 없을 때 재생)</span>
              </label>
              <div className="flex gap-3 justify-end pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">취소</button>
                <button type="submit" className="btn-primary" disabled={createMutation.isPending || updateMutation.isPending}>
                  {editingChannel ? '수정' : '생성'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Device Assignment Modal */}
      {showDeviceModal && selectedChannel && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowDeviceModal(false)}>
          <div className="bg-white rounded-xl p-6 w-full max-w-lg mx-4 shadow-2xl max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-800">디바이스 할당 관리</h2>
              <button onClick={() => setShowDeviceModal(false)} className="p-1 text-gray-400 hover:text-gray-600">
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

            <div className="text-xs text-gray-500 mb-2">
              {selectedDeviceIds.length}대 선택됨
            </div>

            <div className="flex-1 overflow-y-auto space-y-1 min-h-0 max-h-[400px]">
              {filteredDevices.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8">디바이스가 없습니다</p>
              ) : (
                filteredDevices.map((device: any) => {
                  const isSelected = selectedDeviceIds.includes(device.id)
                  return (
                    <div
                      key={device.id}
                      onClick={() => toggleDevice(device.id)}
                      className={`flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-colors ${
                        isSelected ? 'bg-blue-50 border border-blue-200' : 'bg-gray-50 hover:bg-gray-100 border border-transparent'
                      }`}
                    >
                      <div className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 ${
                        isSelected ? 'bg-blue-500' : 'border-2 border-gray-300'
                      }`}>
                        {isSelected && <Check className="w-3 h-3 text-white" />}
                      </div>
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                        device.status === 'ONLINE' ? 'bg-green-500' : 'bg-gray-300'
                      }`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-700 truncate">{device.name}</p>
                        <p className="text-xs text-gray-400 truncate">
                          {device.deviceId?.slice(-8)} {device.location ? `· ${device.location}` : ''}
                        </p>
                      </div>
                      <span className={`text-xs px-1.5 py-0.5 rounded ${
                        device.status === 'ONLINE' ? 'text-green-600 bg-green-50' : 'text-gray-400 bg-gray-100'
                      }`}>
                        {device.status === 'ONLINE' ? 'ON' : 'OFF'}
                      </span>
                    </div>
                  )
                })
              )}
            </div>

            <div className="flex gap-3 justify-end pt-4 mt-3 border-t">
              <button onClick={() => setShowDeviceModal(false)} className="btn-secondary">취소</button>
              <button
                onClick={handleAssignDevices}
                disabled={assignDevicesMutation.isPending}
                className="btn-primary"
              >
                {assignDevicesMutation.isPending ? '저장 중...' : `저장 (${selectedDeviceIds.length}대)`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
