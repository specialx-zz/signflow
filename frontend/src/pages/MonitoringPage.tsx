import { useState, useEffect, useRef, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Monitor, RefreshCw, Wifi, WifiOff, Camera, Clock, AlertCircle, CheckCircle2 } from 'lucide-react'
import { deviceApi } from '@/api/devices'
import { formatDistanceToNow } from 'date-fns'
import { safeFormat } from '@/utils/date'
import { ko } from 'date-fns/locale'
import toast from 'react-hot-toast'
import apiClient from '@/api/client'
import { useSocket } from '@/hooks/useSocket'

interface ScreenshotInfo {
  url: string | null
  timestamp: number | null
}

interface DeviceScreenshot {
  deviceId: string
  screenshot: ScreenshotInfo
  loading: boolean
}

export default function MonitoringPage() {
  const [screenshots, setScreenshots] = useState<Record<string, DeviceScreenshot>>({})
  const [selectedDevice, setSelectedDevice] = useState<string | null>(null)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [refreshInterval, setRefreshInterval] = useState(60)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const { socket } = useSocket()

  const { data: devicesData, isLoading } = useQuery({
    queryKey: ['devices-monitoring'],
    queryFn: () => deviceApi.getAll({ limit: 100 }),
    refetchInterval: 30000,
  })

  const devices = devicesData?.items ?? devicesData ?? []

  // Fetch latest screenshot for a device
  const fetchScreenshot = useCallback(async (device: { id: string; deviceId: string; name: string }) => {
    setScreenshots(prev => ({
      ...prev,
      [device.id]: { ...prev[device.id], deviceId: device.deviceId, loading: true },
    }))
    try {
      const res = await apiClient.get(`/devices/${device.id}/latest-screenshot`)
      setScreenshots(prev => ({
        ...prev,
        [device.id]: {
          deviceId: device.deviceId,
          screenshot: res.data,
          loading: false,
        },
      }))
    } catch {
      setScreenshots(prev => ({
        ...prev,
        [device.id]: {
          deviceId: device.deviceId,
          screenshot: { url: null, timestamp: null },
          loading: false,
        },
      }))
    }
  }, [])

  // Request live screenshot from device
  const requestScreenshot = useCallback(async (device: { id: string; deviceId: string; name: string }) => {
    if (!socket) {
      toast.error('소켓 연결이 없습니다')
      return
    }
    toast.loading(`${device.name} 스크린샷 요청 중...`, { id: `ss-${device.id}` })
    socket.emit('remote:screenshot', { deviceId: device.deviceId })

    // Wait 3 seconds then refresh
    setTimeout(async () => {
      try {
        await fetchScreenshot(device)
        toast.success(`${device.name} 스크린샷 업데이트`, { id: `ss-${device.id}` })
      } catch {
        toast.error(`${device.name} 스크린샷 요청 실패`, { id: `ss-${device.id}` })
      }
    }, 3000)
  }, [socket, fetchScreenshot])

  // Fetch all screenshots on mount and when devices load
  useEffect(() => {
    if (!devices.length) return
    devices.forEach((d: any) => fetchScreenshot(d))
  }, [devices, fetchScreenshot])

  // Auto-refresh
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    if (!autoRefresh || !devices.length) return
    intervalRef.current = setInterval(() => {
      devices.forEach((d: any) => fetchScreenshot(d))
    }, refreshInterval * 1000)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [autoRefresh, refreshInterval, devices.length, fetchScreenshot])

  // Listen for real-time screenshot updates via Socket.IO
  useEffect(() => {
    if (!socket) return
    const handler = (data: { deviceId: string; url?: string; timestamp?: number }) => {
      // Find device by deviceId
      const device = devices.find((d: any) => d.deviceId === data.deviceId)
      if (device) {
        setTimeout(() => fetchScreenshot(device), 1000)
      }
    }
    socket.on('device:screenshot', handler)
    return () => { socket.off('device:screenshot', handler) }
  }, [socket, devices, fetchScreenshot])

  const onlineDevices = devices.filter((d: any) => d.status === 'ONLINE')
  const offlineDevices = devices.filter((d: any) => d.status !== 'ONLINE')

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">모니터링</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            전체 {devices.length}대 · 온라인 {onlineDevices.length}대 · 오프라인 {offlineDevices.length}대
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Auto-refresh toggle */}
          <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2">
            <label className="text-sm text-gray-600">자동갱신</label>
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`w-10 h-5 rounded-full transition-colors relative ${autoRefresh ? 'bg-blue-600' : 'bg-gray-300'}`}
            >
              <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${autoRefresh ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </button>
            {autoRefresh && (
              <select
                value={refreshInterval}
                onChange={e => setRefreshInterval(Number(e.target.value))}
                className="text-sm border-none outline-none bg-transparent text-gray-600"
              >
                <option value={30}>30초</option>
                <option value={60}>1분</option>
                <option value={120}>2분</option>
                <option value={300}>5분</option>
              </select>
            )}
          </div>
          <button
            className="btn-primary"
            onClick={() => devices.forEach((d: any) => fetchScreenshot(d))}
          >
            <RefreshCw className="w-4 h-4" />
            전체 새로고침
          </button>
        </div>
      </div>

      {/* Device grid */}
      {devices.length === 0 ? (
        <div className="card text-center py-16">
          <Monitor className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">등록된 장치가 없습니다</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {devices.map((device: any) => {
            const ss = screenshots[device.id]
            const isOnline = device.status === 'ONLINE'
            const isSelected = selectedDevice === device.id

            return (
              <div
                key={device.id}
                className={`card p-0 overflow-hidden cursor-pointer transition-all hover:shadow-lg ${isSelected ? 'ring-2 ring-blue-500' : ''}`}
                onClick={() => setSelectedDevice(isSelected ? null : device.id)}
              >
                {/* Screenshot area */}
                <div className="relative bg-black aspect-video">
                  {ss?.loading ? (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="animate-spin w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full" />
                    </div>
                  ) : ss?.screenshot?.url ? (
                    <img
                      src={ss.screenshot.url!}
                      alt={device.name}
                      className="w-full h-full object-cover"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                    />
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                      <Monitor className="w-8 h-8 text-gray-600" />
                      <p className="text-xs text-gray-500">스크린샷 없음</p>
                    </div>
                  )}

                  {/* Status badge */}
                  <div className={`absolute top-2 left-2 flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                    isOnline ? 'bg-green-500/90 text-white' : 'bg-gray-700/90 text-gray-300'
                  }`}>
                    {isOnline ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                    {isOnline ? 'ONLINE' : device.status}
                  </div>

                  {/* Screenshot time */}
                  {ss?.screenshot?.timestamp && (
                    <div className="absolute bottom-2 right-2 flex items-center gap-1 bg-black/60 text-white text-xs px-2 py-0.5 rounded-full">
                      <Clock className="w-3 h-3" />
                      {formatDistanceToNow(new Date(ss.screenshot.timestamp), { addSuffix: true, locale: ko })}
                    </div>
                  )}

                  {/* Screenshot button overlay */}
                  <button
                    className="absolute top-2 right-2 p-1.5 bg-black/60 hover:bg-black/80 text-white rounded-lg transition-colors"
                    onClick={(e) => { e.stopPropagation(); requestScreenshot(device) }}
                    title="즉시 캡처 요청"
                  >
                    <Camera className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Device info */}
                <div className="p-3">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-gray-800 text-sm truncate">{device.name}</p>
                    {isOnline ? (
                      <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5 truncate">{device.ipAddress || device.deviceId}</p>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Full-screen modal when device selected */}
      {selectedDevice && (() => {
        const device = devices.find((d: any) => d.id === selectedDevice)
        const ss = screenshots[selectedDevice]
        if (!device) return null
        return (
          <div
            className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
            onClick={() => setSelectedDevice(null)}
          >
            <div
              className="bg-white rounded-2xl overflow-hidden max-w-4xl w-full shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-4 border-b">
                <div>
                  <h3 className="font-bold text-gray-800">{device.name}</h3>
                  <p className="text-sm text-gray-500">
                    {ss?.screenshot?.timestamp
                      ? `캡처: ${safeFormat(new Date(ss.screenshot.timestamp), 'yyyy-MM-dd HH:mm:ss')}`
                      : '스크린샷 없음'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    className="btn-primary text-sm"
                    onClick={() => requestScreenshot(device)}
                  >
                    <Camera className="w-4 h-4" />
                    즉시 캡처
                  </button>
                  <button
                    className="p-2 hover:bg-gray-100 rounded-lg text-gray-600"
                    onClick={() => setSelectedDevice(null)}
                  >✕</button>
                </div>
              </div>
              <div className="bg-black aspect-video relative">
                {ss?.screenshot?.url ? (
                  <img
                    src={ss.screenshot.url!}
                    alt={device.name}
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                    <Monitor className="w-16 h-16 text-gray-600" />
                    <p className="text-gray-400">스크린샷이 없습니다</p>
                    <button
                      className="btn-primary mt-2"
                      onClick={() => requestScreenshot(device)}
                    >
                      <Camera className="w-4 h-4" />
                      첫 스크린샷 요청
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
