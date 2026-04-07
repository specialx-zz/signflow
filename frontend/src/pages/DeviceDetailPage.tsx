import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft, Monitor, Power, VolumeX, Volume2, RefreshCw,
  Wifi, WifiOff, Settings, Tv2, ChevronLeft, ChevronRight,
  ChevronUp, ChevronDown, Circle, Square, SkipForward, SkipBack,
  Sun, RotateCcw, Pencil, Save, X
} from 'lucide-react'
import { deviceApi } from '@/api/devices'
import { storeApi } from '@/api/stores'
import { PageLoader } from '@/components/ui/LoadingSpinner'
import StatusBadge from '@/components/ui/StatusBadge'
import toast from 'react-hot-toast'
import { format } from 'date-fns'

export default function DeviceDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [volume, setVolume] = useState<number | null>(null)
  const [brightness, setBrightness] = useState<number | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [editForm, setEditForm] = useState({
    name: '', ipAddress: '', model: '', location: '',
    resolution: '', groupId: '', storeId: ''
  })

  const { data: device, isLoading } = useQuery({
    queryKey: ['device', id],
    queryFn: () => deviceApi.getById(id!),
    enabled: !!id,
    refetchInterval: 30000
  })

  const { data: groupsData } = useQuery({
    queryKey: ['device-groups'],
    queryFn: deviceApi.getGroups
  })

  const { data: storesData } = useQuery({
    queryKey: ['stores'],
    queryFn: storeApi.getAll
  })

  // Initialize from device data
  useEffect(() => {
    if (device) {
      if (volume === null) setVolume(device.volume)
      if (brightness === null) setBrightness(device.brightness)
    }
  }, [device?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const controlMutation = useMutation({
    mutationFn: ({ command, params }: { command: string; params?: Record<string, unknown> }) =>
      deviceApi.control(id!, command, params),
    onSuccess: (_, vars) => {
      toast.success(`명령 전송: ${vars.command}`)
      queryClient.invalidateQueries({ queryKey: ['device', id] })
    },
    onError: () => toast.error('명령 전송에 실패했습니다')
  })

  const updateMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => deviceApi.update(id!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['device', id] })
      setIsEditing(false)
      toast.success('장치 정보가 수정되었습니다')
    },
    onError: () => toast.error('수정에 실패했습니다')
  })

  if (isLoading) return <PageLoader />
  if (!device) return <div>장치를 찾을 수 없습니다</div>

  const currentVolume = volume ?? device.volume
  const currentBrightness = brightness ?? device.brightness

  const sendCommand = (command: string, params?: Record<string, unknown>) => {
    controlMutation.mutate({ command, params })
  }

  const startEdit = () => {
    setEditForm({
      name: device.name || '',
      ipAddress: device.ipAddress || '',
      model: device.model || '',
      location: device.location || '',
      resolution: device.resolution || '1920x1080',
      groupId: device.groupId || '',
      storeId: device.storeId || '',
    })
    setIsEditing(true)
  }

  const saveEdit = () => {
    updateMutation.mutate({
      name: editForm.name || undefined,
      ipAddress: editForm.ipAddress || undefined,
      model: editForm.model || undefined,
      location: editForm.location || undefined,
      resolution: editForm.resolution || undefined,
      groupId: editForm.groupId || null,
      storeId: editForm.storeId || null,
    })
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button className="btn-ghost p-2" onClick={() => navigate('/devices')}>
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-800">{device.name}</h1>
            <StatusBadge status={device.status} />
            {device.store && (
              <span className="text-xs px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full">
                {device.store.name}
              </span>
            )}
          </div>
          <p className="text-gray-500 text-sm mt-0.5">{device.deviceId} · {device.ipAddress}</p>
        </div>
        <button
          className="btn-secondary"
          onClick={() => queryClient.invalidateQueries({ queryKey: ['device', id] })}
        >
          <RefreshCw className="w-4 h-4" />
          새로고침
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Device info + Edit */}
        <div className="space-y-4">
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-gray-700">장치 정보</h2>
              {!isEditing ? (
                <button className="btn-ghost btn-sm" onClick={startEdit}>
                  <Pencil className="w-3.5 h-3.5" /> 편집
                </button>
              ) : (
                <div className="flex gap-1">
                  <button
                    className="btn-ghost btn-sm text-green-600"
                    onClick={saveEdit}
                    disabled={updateMutation.isPending}
                  >
                    <Save className="w-3.5 h-3.5" /> {updateMutation.isPending ? '저장 중...' : '저장'}
                  </button>
                  <button className="btn-ghost btn-sm text-gray-400" onClick={() => setIsEditing(false)}>
                    <X className="w-3.5 h-3.5" /> 취소
                  </button>
                </div>
              )}
            </div>

            {isEditing ? (
              <div className="space-y-3">
                <div>
                  <label className="label">장치 이름</label>
                  <input type="text" value={editForm.name}
                    onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                    className="input" />
                </div>
                <div>
                  <label className="label">IP 주소</label>
                  <input type="text" value={editForm.ipAddress}
                    onChange={e => setEditForm(f => ({ ...f, ipAddress: e.target.value }))}
                    className="input" placeholder="192.168.1.100" />
                </div>
                <div>
                  <label className="label">모델</label>
                  <input type="text" value={editForm.model}
                    onChange={e => setEditForm(f => ({ ...f, model: e.target.value }))}
                    className="input" placeholder="Samsung QM55R" />
                </div>
                <div>
                  <label className="label">해상도</label>
                  <select value={editForm.resolution}
                    onChange={e => setEditForm(f => ({ ...f, resolution: e.target.value }))}
                    className="select">
                    <option value="1920x1080">1920x1080 (FHD)</option>
                    <option value="3840x2160">3840x2160 (4K)</option>
                    <option value="1280x720">1280x720 (HD)</option>
                  </select>
                </div>
                <div>
                  <label className="label">매장</label>
                  <select value={editForm.storeId}
                    onChange={e => setEditForm(f => ({ ...f, storeId: e.target.value }))}
                    className="select">
                    <option value="">미배정</option>
                    {(storesData as { id: string; name: string }[] | undefined)?.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">그룹</label>
                  <select value={editForm.groupId}
                    onChange={e => setEditForm(f => ({ ...f, groupId: e.target.value }))}
                    className="select">
                    <option value="">그룹 없음</option>
                    {groupsData?.map((g: { id: string; name: string }) => (
                      <option key={g.id} value={g.id}>{g.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">위치</label>
                  <input type="text" value={editForm.location}
                    onChange={e => setEditForm(f => ({ ...f, location: e.target.value }))}
                    className="input" placeholder="설치 위치" />
                </div>
              </div>
            ) : (
              <dl className="space-y-3 text-sm">
                {[
                  { label: '모델', value: device.model },
                  { label: 'IP 주소', value: device.ipAddress },
                  { label: 'MAC 주소', value: device.macAddress },
                  { label: '해상도', value: device.resolution },
                  { label: '방향', value: device.orientation === 'LANDSCAPE' ? '가로' : '세로' },
                  { label: '매장', value: device.store?.name || '미배정' },
                  { label: '그룹', value: device.group?.name },
                  { label: '위치', value: device.location },
                  { label: '펌웨어', value: device.firmware },
                  { label: '시간대', value: device.timezone },
                ].map(item => item.value && (
                  <div key={item.label} className="flex justify-between">
                    <dt className="text-gray-500">{item.label}</dt>
                    <dd className="font-medium text-gray-800 text-right max-w-32 truncate">{item.value}</dd>
                  </div>
                ))}
                {device.lastSeen && (
                  <div className="flex justify-between">
                    <dt className="text-gray-500">최근 접속</dt>
                    <dd className="font-medium text-gray-800">
                      {format(new Date(device.lastSeen), 'yyyy-MM-dd HH:mm')}
                    </dd>
                  </div>
                )}
              </dl>
            )}
          </div>

          {/* Schedules */}
          {device.schedules && device.schedules.length > 0 && (
            <div className="card">
              <h2 className="text-sm font-semibold text-gray-700 mb-4">적용된 스케줄</h2>
              <div className="space-y-2">
                {device.schedules.map((sd: { id: string; schedule: { id: string; name: string; status: string } }) => (
                  <div key={sd.id} className="flex items-center justify-between text-sm">
                    <span className="text-gray-700 truncate">{sd.schedule.name}</span>
                    <StatusBadge status={sd.schedule.status} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Quick controls */}
        <div className="space-y-4">
          <div className="card">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">빠른 제어</h2>

            {/* Power */}
            <div className="flex gap-2 mb-4">
              <button
                className="flex-1 flex items-center justify-center gap-2 py-3 bg-red-50 text-red-600 hover:bg-red-100 rounded-xl transition-colors font-medium"
                onClick={() => sendCommand('POWER_OFF')}
              >
                <Power className="w-5 h-5" />
                전원 끄기
              </button>
              <button
                className="flex-1 flex items-center justify-center gap-2 py-3 bg-green-50 text-green-600 hover:bg-green-100 rounded-xl transition-colors font-medium"
                onClick={() => sendCommand('POWER_ON')}
              >
                <Power className="w-5 h-5" />
                전원 켜기
              </button>
            </div>

            {/* Volume */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  {currentVolume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                  <span>음량</span>
                </div>
                <span className="text-sm font-medium">{currentVolume}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={currentVolume}
                onChange={e => setVolume(parseInt(e.target.value))}
                onMouseUp={(e) => sendCommand('VOLUME_SET', { value: parseInt((e.target as HTMLInputElement).value) })}
                onTouchEnd={(e) => sendCommand('VOLUME_SET', { value: parseInt((e.target as HTMLInputElement).value) })}
                className="w-full accent-blue-600"
              />
            </div>

            {/* Brightness */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Sun className="w-4 h-4" />
                  <span>밝기</span>
                </div>
                <span className="text-sm font-medium">{currentBrightness}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={currentBrightness}
                onChange={e => setBrightness(parseInt(e.target.value))}
                onMouseUp={(e) => sendCommand('BRIGHTNESS', { value: parseInt((e.target as HTMLInputElement).value) })}
                onTouchEnd={(e) => sendCommand('BRIGHTNESS', { value: parseInt((e.target as HTMLInputElement).value) })}
                className="w-full accent-blue-600"
              />
            </div>

            {/* Other controls */}
            <div className="grid grid-cols-2 gap-2">
              <button
                className="flex items-center justify-center gap-2 py-2.5 border border-gray-200 text-gray-600 hover:bg-gray-50 rounded-xl text-sm transition-colors"
                onClick={() => sendCommand('RESTART')}
              >
                <RotateCcw className="w-4 h-4" />
                재시작
              </button>
              <button
                className="flex items-center justify-center gap-2 py-2.5 border border-gray-200 text-gray-600 hover:bg-gray-50 rounded-xl text-sm transition-colors"
                onClick={() => sendCommand('MUTE')}
              >
                <VolumeX className="w-4 h-4" />
                음소거
              </button>

              <button
                className="flex items-center justify-center gap-2 py-2.5 border border-gray-200 text-gray-600 hover:bg-gray-50 rounded-xl text-sm transition-colors"
                onClick={() => sendCommand('REFRESH')}
              >
                <RefreshCw className="w-4 h-4" />
                새로고침
              </button>
            </div>
          </div>
        </div>

        {/* Virtual Remote */}
        <div className="card">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">가상 리모컨</h2>
          <div className="flex flex-col items-center gap-3">
            {/* Power row */}
            <div className="flex gap-3">
              <button
                className="w-14 h-14 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center shadow-md transition-colors"
                onClick={() => sendCommand('POWER_TOGGLE')}
              >
                <Power className="w-6 h-6" />
              </button>
            </div>

            {/* D-pad */}
            <div className="grid grid-cols-3 gap-1.5 mt-2">
              <div />
              <button
                className="w-12 h-12 bg-gray-700 hover:bg-gray-800 text-white rounded-xl flex items-center justify-center shadow-md transition-colors"
                onClick={() => sendCommand('KEY_UP')}
              >
                <ChevronUp className="w-6 h-6" />
              </button>
              <div />
              <button
                className="w-12 h-12 bg-gray-700 hover:bg-gray-800 text-white rounded-xl flex items-center justify-center shadow-md transition-colors"
                onClick={() => sendCommand('KEY_LEFT')}
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              <button
                className="w-12 h-12 bg-blue-600 hover:bg-blue-700 text-white rounded-xl flex items-center justify-center shadow-md transition-colors font-bold text-sm"
                onClick={() => sendCommand('KEY_OK')}
              >
                OK
              </button>
              <button
                className="w-12 h-12 bg-gray-700 hover:bg-gray-800 text-white rounded-xl flex items-center justify-center shadow-md transition-colors"
                onClick={() => sendCommand('KEY_RIGHT')}
              >
                <ChevronRight className="w-6 h-6" />
              </button>
              <div />
              <button
                className="w-12 h-12 bg-gray-700 hover:bg-gray-800 text-white rounded-xl flex items-center justify-center shadow-md transition-colors"
                onClick={() => sendCommand('KEY_DOWN')}
              >
                <ChevronDown className="w-6 h-6" />
              </button>
              <div />
            </div>

            {/* Media controls */}
            <div className="flex gap-3 mt-2">
              <button
                className="w-12 h-12 bg-gray-700 hover:bg-gray-800 text-white rounded-xl flex items-center justify-center shadow-md transition-colors"
                onClick={() => sendCommand('PREV')}
              >
                <SkipBack className="w-5 h-5" />
              </button>
              <button
                className="w-12 h-12 bg-gray-700 hover:bg-gray-800 text-white rounded-xl flex items-center justify-center shadow-md transition-colors"
                onClick={() => sendCommand('PLAY')}
              >
                <Circle className="w-5 h-5" />
              </button>
              <button
                className="w-12 h-12 bg-gray-700 hover:bg-gray-800 text-white rounded-xl flex items-center justify-center shadow-md transition-colors"
                onClick={() => sendCommand('PAUSE')}
              >
                <Square className="w-5 h-5" />
              </button>
              <button
                className="w-12 h-12 bg-gray-700 hover:bg-gray-800 text-white rounded-xl flex items-center justify-center shadow-md transition-colors"
                onClick={() => sendCommand('NEXT')}
              >
                <SkipForward className="w-5 h-5" />
              </button>
            </div>

            {/* Volume/Channel controls */}
            <div className="flex gap-6 mt-2">
              <div className="flex flex-col items-center gap-1">
                <button
                  className="w-10 h-10 bg-gray-700 hover:bg-gray-800 text-white rounded-xl flex items-center justify-center shadow-md text-xs font-bold transition-colors"
                  onClick={() => sendCommand('VOLUME_UP')}
                >
                  VOL+
                </button>
                <button
                  className="w-10 h-10 bg-gray-700 hover:bg-gray-800 text-white rounded-xl flex items-center justify-center shadow-md text-xs font-bold transition-colors"
                  onClick={() => sendCommand('VOLUME_DOWN')}
                >
                  VOL-
                </button>
              </div>
              <div className="flex flex-col items-center gap-1">
                <button
                  className="w-10 h-10 bg-gray-700 hover:bg-gray-800 text-white rounded-xl flex items-center justify-center shadow-md text-xs font-bold transition-colors"
                  onClick={() => sendCommand('CH_UP')}
                >
                  CH+
                </button>
                <button
                  className="w-10 h-10 bg-gray-700 hover:bg-gray-800 text-white rounded-xl flex items-center justify-center shadow-md text-xs font-bold transition-colors"
                  onClick={() => sendCommand('CH_DOWN')}
                >
                  CH-
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
