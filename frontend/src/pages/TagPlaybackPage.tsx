/**
 * V4 Phase 14: 태그 기반 조건 재생 관리 페이지
 * 태그 현황 대시보드 + 장치별 태그 관리
 */
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Tag, Monitor, Search, ChevronRight } from 'lucide-react'
import { tagPlaybackApi, TagKeyValues } from '@/api/tagPlayback'
import { PageLoader } from '@/components/ui/LoadingSpinner'
import EmptyState from '@/components/ui/EmptyState'
import DeviceTagEditor from '@/components/devices/DeviceTagEditor'
import apiClient from '@/api/client'

interface DeviceSimple {
  id: string
  name: string
  deviceId: string
  status: string
  location?: string
  tags?: string
}

export default function TagPlaybackPage() {
  const [selectedDevice, setSelectedDevice] = useState<string | null>(null)
  const [filterKey, setFilterKey] = useState('')
  const [filterValue, setFilterValue] = useState('')

  // All tag keys
  const { data: tagKeys = [], isLoading: keysLoading } = useQuery({
    queryKey: ['tagKeys'],
    queryFn: () => tagPlaybackApi.listTagKeys()
  })

  // Devices list (simple)
  const { data: devicesData, isLoading: devicesLoading } = useQuery({
    queryKey: ['devices-simple'],
    queryFn: async () => {
      const res = await apiClient.get('/devices', { params: { limit: 200 } })
      return res.data
    }
  })

  const devices: DeviceSimple[] = devicesData?.items || devicesData || []
  const typedTagKeys = tagKeys as TagKeyValues[]

  // Filter devices by tag
  const filteredDevices = devices.filter(d => {
    if (!filterKey) return true
    if (!d.tags) return false
    try {
      const tags = JSON.parse(d.tags)
      if (filterValue) return String(tags[filterKey]) === filterValue
      return tags[filterKey] !== undefined
    } catch { return false }
  })

  if (keysLoading || devicesLoading) return <PageLoader />

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-800">태그 기반 조건 재생</h1>
        <p className="text-gray-500 text-sm mt-1">장치 태그를 관리하고, 스케줄에서 태그 조건부 재생을 설정합니다</p>
      </div>

      {/* Tag overview */}
      <div className="card p-4">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">태그 현황</h2>
        {typedTagKeys.length === 0 ? (
          <p className="text-xs text-gray-400">아직 등록된 태그가 없습니다. 장치에 태그를 추가해보세요.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {typedTagKeys.map(tk => (
              <div key={tk.key} className="bg-gray-50 rounded-lg p-3">
                <span className="text-xs font-semibold text-blue-700 bg-blue-100 px-2 py-0.5 rounded">{tk.key}</span>
                <div className="flex flex-wrap gap-1 mt-2">
                  {tk.values.map(v => (
                    <button
                      key={v}
                      onClick={() => { setFilterKey(tk.key); setFilterValue(v) }}
                      className={`text-xs px-2 py-0.5 rounded-full transition-colors ${
                        filterKey === tk.key && filterValue === v
                          ? 'bg-blue-600 text-white'
                          : 'bg-white border border-gray-200 text-gray-600 hover:border-blue-300'
                      }`}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {filterKey && (
          <div className="mt-3 flex items-center gap-2">
            <span className="text-xs text-gray-500">필터:</span>
            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
              {filterKey}{filterValue ? ` = ${filterValue}` : ''}
            </span>
            <button
              onClick={() => { setFilterKey(''); setFilterValue('') }}
              className="text-xs text-red-500 hover:underline"
            >
              초기화
            </button>
            <span className="text-xs text-gray-400 ml-2">{filteredDevices.length}개 장치</span>
          </div>
        )}
      </div>

      {/* Device list + Tag editor */}
      <div className="flex gap-5">
        <div className={`${selectedDevice ? 'w-1/2' : 'w-full'} space-y-2`}>
          <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <Monitor className="w-4 h-4" />
            장치 목록 ({filteredDevices.length})
          </h2>

          {filteredDevices.length === 0 ? (
            <div className="card p-8">
              <EmptyState
                icon={Tag}
                title="장치가 없습니다"
                description={filterKey ? '해당 태그를 가진 장치가 없습니다' : '등록된 장치가 없습니다'}
              />
            </div>
          ) : (
            filteredDevices.map(device => {
              let parsedTags: Record<string, string> = {}
              try { parsedTags = device.tags ? JSON.parse(device.tags) : {} } catch {}
              const tagCount = Object.keys(parsedTags).length

              return (
                <div
                  key={device.id}
                  onClick={() => setSelectedDevice(device.id)}
                  className={`card p-3 cursor-pointer hover:shadow-md transition-all ${
                    selectedDevice === device.id ? 'ring-2 ring-blue-500' : ''
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${device.status === 'ONLINE' ? 'bg-green-500' : 'bg-gray-300'}`} />
                      <div>
                        <p className="text-sm font-medium text-gray-800">{device.name}</p>
                        <p className="text-xs text-gray-400">{device.deviceId} {device.location ? `· ${device.location}` : ''}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {tagCount > 0 ? (
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {Object.entries(parsedTags).slice(0, 3).map(([k, v]) => (
                            <span key={k} className="text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">
                              {k}:{v}
                            </span>
                          ))}
                          {tagCount > 3 && <span className="text-xs text-gray-400">+{tagCount - 3}</span>}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-300">태그 없음</span>
                      )}
                      <ChevronRight className="w-4 h-4 text-gray-300" />
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Tag editor panel */}
        {selectedDevice && (
          <div className="w-1/2">
            <div className="card p-4">
              <DeviceTagEditor deviceId={selectedDevice} />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
