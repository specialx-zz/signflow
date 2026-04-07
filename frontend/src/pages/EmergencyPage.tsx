import { useState, useEffect, useCallback } from 'react'
import {
  AlertTriangle, Plus, X, Send, Power, PowerOff,
  Clock, Trash2, Radio, Monitor, Warehouse, Smartphone, Check, ChevronDown, ChevronRight, Loader2
} from 'lucide-react'
import { emergencyApi, type EmergencyMessage, type CreateEmergencyRequest } from '@/api/emergency'
import { storeApi } from '@/api/stores'
import { deviceApi } from '@/api/devices'
import type { Store, Device } from '@/types'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import toast from 'react-hot-toast'

const TYPE_STYLES = {
  INFO: { bg: '#3B82F6', label: '정보', icon: '💡' },
  WARNING: { bg: '#F59E0B', label: '주의', icon: '⚠️' },
  DANGER: { bg: '#EF4444', label: '위험', icon: '🚨' },
  CUSTOM: { bg: '#8B5CF6', label: '사용자 지정', icon: '📢' },
}

const DISPLAY_MODES = [
  { value: 'OVERLAY', label: '오버레이', desc: '현재 콘텐츠 위에 표시' },
  { value: 'FULLSCREEN', label: '전체화면', desc: '콘텐츠를 대체하여 표시' },
  { value: 'TICKER', label: '티커', desc: '하단 자막 형태' },
]

const TARGET_TYPES = [
  { value: 'ALL', label: '전체 디바이스', icon: Monitor },
  { value: 'STORE', label: '특정 매장', icon: Warehouse },
  { value: 'DEVICE', label: '특정 디바이스', icon: Smartphone },
]

export default function EmergencyPage() {
  const [messages, setMessages] = useState<EmergencyMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [form, setForm] = useState<CreateEmergencyRequest>({
    title: '',
    message: '',
    type: 'WARNING',
    displayMode: 'OVERLAY',
    priority: 100,
    targetType: 'ALL',
    bgColor: '#EF4444',
    textColor: '#FFFFFF',
    fontSize: 48,
  })

  // Target selection state
  const [selectedTargetIds, setSelectedTargetIds] = useState<string[]>([])
  const [stores, setStores] = useState<Store[]>([])
  const [storesLoading, setStoresLoading] = useState(false)
  const [devices, setDevices] = useState<Device[]>([])
  const [devicesLoading, setDevicesLoading] = useState(false)
  const [selectedStoreForDevices, setSelectedStoreForDevices] = useState<string>('')

  // Store name lookup map for display in active messages
  const [storeNameMap, setStoreNameMap] = useState<Record<string, string>>({})
  const [deviceNameMap, setDeviceNameMap] = useState<Record<string, string>>({})

  const loadMessages = useCallback(async () => {
    try {
      setLoading(true)
      const data = await emergencyApi.getAll()
      setMessages(data)
    } catch (err) {
      toast.error('메시지 목록을 불러오지 못했습니다')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadMessages() }, [loadMessages])

  // Load stores for name mapping on mount
  useEffect(() => {
    storeApi.getAll().then((data: Store[]) => {
      const map: Record<string, string> = {}
      data.forEach(s => { map[s.id] = s.name })
      setStoreNameMap(map)
    }).catch(() => {})
  }, [])

  // Fetch stores when target type changes to STORE or DEVICE
  useEffect(() => {
    if (showForm && (form.targetType === 'STORE' || form.targetType === 'DEVICE')) {
      setStoresLoading(true)
      storeApi.getAll()
        .then((data: Store[]) => {
          setStores(data)
          const map: Record<string, string> = {}
          data.forEach(s => { map[s.id] = s.name })
          setStoreNameMap(prev => ({ ...prev, ...map }))
        })
        .catch(() => toast.error('데이터를 불러오지 못했습니다'))
        .finally(() => setStoresLoading(false))
    }
  }, [showForm, form.targetType])

  // Fetch devices when a store is selected in DEVICE mode
  useEffect(() => {
    if (form.targetType === 'DEVICE' && selectedStoreForDevices) {
      setDevicesLoading(true)
      deviceApi.getAll({ storeId: selectedStoreForDevices })
        .then((data: any) => {
          const items: Device[] = Array.isArray(data) ? data : (data.items ?? [])
          setDevices(items)
          const map: Record<string, string> = {}
          items.forEach((d: Device) => { map[d.id] = d.name })
          setDeviceNameMap(prev => ({ ...prev, ...map }))
        })
        .catch(() => toast.error('데이터를 불러오지 못했습니다'))
        .finally(() => setDevicesLoading(false))
    } else {
      setDevices([])
    }
  }, [form.targetType, selectedStoreForDevices])

  // Reset selection when target type changes
  useEffect(() => {
    setSelectedTargetIds([])
    setSelectedStoreForDevices('')
    setDevices([])
  }, [form.targetType])

  const toggleTargetId = (id: string) => {
    setSelectedTargetIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  const handleCreate = async () => {
    if (!form.title || !form.message) return
    if (form.targetType !== 'ALL' && selectedTargetIds.length === 0) return
    try {
      const payload: CreateEmergencyRequest = {
        ...form,
        targetIds: form.targetType === 'ALL' ? undefined : selectedTargetIds,
      }
      await emergencyApi.create(payload)
      setShowForm(false)
      setForm({ title: '', message: '', type: 'WARNING', displayMode: 'OVERLAY', priority: 100, targetType: 'ALL', bgColor: '#EF4444', textColor: '#FFFFFF', fontSize: 48 })
      setSelectedTargetIds([])
      setSelectedStoreForDevices('')
      loadMessages()
    } catch (err) {
      toast.error('긴급 메시지 전송에 실패했습니다')
    }
  }

  const handleDeactivate = async (id: string) => {
    try {
      await emergencyApi.deactivate(id)
      loadMessages()
    } catch (err) {
      toast.error('메시지 해제에 실패했습니다')
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await emergencyApi.delete(id)
      setDeleteTarget(null)
      loadMessages()
    } catch (err) {
      toast.error('메시지 삭제에 실패했습니다')
    }
  }

  const resolveTargetNames = (msg: EmergencyMessage): string => {
    if (msg.targetType === 'ALL') return '전체 디바이스'
    if (!msg.targetIds) return msg.targetType === 'STORE' ? '특정 매장' : '특정 디바이스'
    try {
      const ids: string[] = JSON.parse(msg.targetIds)
      const nameMap = msg.targetType === 'STORE' ? storeNameMap : deviceNameMap
      const names = ids.map(id => nameMap[id] || id)
      if (names.length <= 3) return names.join(', ')
      return `${names.slice(0, 3).join(', ')} 외 ${names.length - 3}개`
    } catch {
      return msg.targetType === 'STORE' ? '특정 매장' : '특정 디바이스'
    }
  }

  const activeMessages = messages.filter(m => m.isActive && (!m.expiresAt || new Date(m.expiresAt) > new Date()))
  const pastMessages = messages.filter(m => !m.isActive || (m.expiresAt && new Date(m.expiresAt) <= new Date()))

  const canSubmit = form.title && form.message && (form.targetType === 'ALL' || selectedTargetIds.length > 0)

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <AlertTriangle className="w-7 h-7 text-red-500" />
            긴급 메시지
          </h1>
          <p className="text-gray-500 mt-1">전체 디바이스 또는 특정 매장에 즉시 긴급 메시지를 전송합니다</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition shadow-sm"
        >
          <Plus className="w-4 h-4" />
          긴급 메시지 전송
        </button>
      </div>

      {/* Active Messages */}
      {activeMessages.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-semibold text-red-600 flex items-center gap-2">
            <Radio className="w-4 h-4 animate-pulse" /> 현재 활성 ({activeMessages.length})
          </h2>
          {activeMessages.map(msg => (
            <div
              key={msg.id}
              className="border-2 border-red-200 rounded-xl p-4 bg-red-50"
              style={{ borderLeftColor: msg.bgColor, borderLeftWidth: 6 }}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-lg">{TYPE_STYLES[msg.type]?.icon || '📢'}</span>
                    <span className="font-bold text-gray-900">{msg.title}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: msg.bgColor }}>
                      {TYPE_STYLES[msg.type]?.label}
                    </span>
                    <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                      {msg.displayMode === 'OVERLAY' ? '오버레이' : msg.displayMode === 'FULLSCREEN' ? '전체화면' : '티커'}
                    </span>
                  </div>
                  <p className="text-gray-700">{msg.message}</p>
                  <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      {msg.targetType === 'ALL' ? <Monitor className="w-3 h-3" /> : msg.targetType === 'STORE' ? <Warehouse className="w-3 h-3" /> : <Smartphone className="w-3 h-3" />}
                      {resolveTargetNames(msg)}
                    </span>
                    {msg.expiresAt && (
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        만료: {new Date(msg.expiresAt).toLocaleString('ko-KR')}
                      </span>
                    )}
                    <span>전송: {new Date(msg.createdAt).toLocaleString('ko-KR')}</span>
                  </div>
                </div>
                <button
                  onClick={() => handleDeactivate(msg.id)}
                  className="flex items-center gap-1 px-3 py-1.5 text-red-600 bg-white border border-red-200 rounded-lg hover:bg-red-50 text-sm"
                >
                  <PowerOff className="w-4 h-4" /> 해제
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Past Messages */}
      <div>
        <h2 className="font-semibold text-gray-700 mb-3">전송 이력</h2>
        {loading ? (
          <div className="text-center py-8 text-gray-400">로딩 중...</div>
        ) : pastMessages.length === 0 && activeMessages.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <AlertTriangle className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>긴급 메시지 이력이 없습니다</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border divide-y">
            {pastMessages.map(msg => (
              <div key={msg.id} className="p-4 flex items-center justify-between hover:bg-gray-50">
                <div className="flex items-center gap-3">
                  <span className="text-lg">{TYPE_STYLES[msg.type]?.icon || '📢'}</span>
                  <div>
                    <span className="font-medium text-gray-700">{msg.title}</span>
                    <span className="text-gray-400 ml-2 text-sm">{msg.message.substring(0, 60)}{msg.message.length > 60 ? '...' : ''}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-400">{new Date(msg.createdAt).toLocaleString('ko-KR')}</span>
                  <span className={`text-xs px-2 py-0.5 rounded ${msg.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {msg.isActive ? '활성' : '종료'}
                  </span>
                  <button onClick={() => setDeleteTarget(msg.id)} className="text-gray-400 hover:text-red-500">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && handleDelete(deleteTarget)}
        title="긴급 메시지 삭제"
        message="이 긴급 메시지를 삭제하시겠습니까?"
        confirmLabel="삭제"
      />

      {/* Create Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b">
              <h3 className="text-lg font-bold">긴급 메시지 전송</h3>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              {/* 유형 선택 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">메시지 유형</label>
                <div className="grid grid-cols-4 gap-2">
                  {Object.entries(TYPE_STYLES).map(([key, val]) => (
                    <button
                      key={key}
                      onClick={() => setForm(f => ({ ...f, type: key, bgColor: val.bg }))}
                      className={`p-2 rounded-lg border-2 text-center text-sm transition ${
                        form.type === key ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="text-xl mb-1">{val.icon}</div>
                      {val.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">제목 *</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2"
                  placeholder="긴급 공지 제목"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">메시지 내용 *</label>
                <textarea
                  value={form.message}
                  onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 h-24 resize-none"
                  placeholder="디바이스에 표시될 메시지"
                />
              </div>

              {/* 표시 방식 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">표시 방식</label>
                <div className="grid grid-cols-3 gap-2">
                  {DISPLAY_MODES.map(mode => (
                    <button
                      key={mode.value}
                      onClick={() => setForm(f => ({ ...f, displayMode: mode.value }))}
                      className={`p-2 rounded-lg border-2 text-center text-sm transition ${
                        form.displayMode === mode.value ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="font-medium">{mode.label}</div>
                      <div className="text-xs text-gray-500">{mode.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* 대상 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">전송 대상</label>
                <div className="flex gap-2">
                  {TARGET_TYPES.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setForm(f => ({ ...f, targetType: opt.value }))}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg border-2 text-sm transition ${
                        form.targetType === opt.value ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                      }`}
                    >
                      <opt.icon className="w-4 h-4" /> {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Store selection for STORE target type */}
              {form.targetType === 'STORE' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    매장 선택 {selectedTargetIds.length > 0 && (
                      <span className="text-blue-600 font-normal">({selectedTargetIds.length}개 선택됨)</span>
                    )}
                  </label>
                  {storesLoading ? (
                    <div className="flex items-center gap-2 text-gray-400 py-3 text-sm">
                      <Loader2 className="w-4 h-4 animate-spin" /> 매장 목록을 불러오는 중...
                    </div>
                  ) : stores.length === 0 ? (
                    <p className="text-sm text-gray-400 py-2">등록된 매장이 없습니다</p>
                  ) : (
                    <div className="border rounded-lg max-h-48 overflow-y-auto divide-y">
                      {stores.map(store => (
                        <label
                          key={store.id}
                          className="flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 cursor-pointer"
                        >
                          <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition ${
                            selectedTargetIds.includes(store.id)
                              ? 'bg-blue-500 border-blue-500'
                              : 'border-gray-300'
                          }`}>
                            {selectedTargetIds.includes(store.id) && (
                              <Check className="w-3 h-3 text-white" />
                            )}
                          </div>
                          <input
                            type="checkbox"
                            className="sr-only"
                            checked={selectedTargetIds.includes(store.id)}
                            onChange={() => toggleTargetId(store.id)}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-gray-800">{store.name}</div>
                            {store.address && (
                              <div className="text-xs text-gray-400 truncate">{store.address}</div>
                            )}
                          </div>
                          {store._count?.devices !== undefined && (
                            <span className="text-xs text-gray-400">{store._count.devices}대</span>
                          )}
                        </label>
                      ))}
                    </div>
                  )}
                  {stores.length > 0 && (
                    <div className="flex gap-2 mt-2">
                      <button
                        type="button"
                        onClick={() => setSelectedTargetIds(stores.map(s => s.id))}
                        className="text-xs text-blue-600 hover:text-blue-700"
                      >
                        전체 선택
                      </button>
                      <span className="text-xs text-gray-300">|</span>
                      <button
                        type="button"
                        onClick={() => setSelectedTargetIds([])}
                        className="text-xs text-gray-500 hover:text-gray-700"
                      >
                        선택 해제
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Device selection for DEVICE target type */}
              {form.targetType === 'DEVICE' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">매장 선택</label>
                  {storesLoading ? (
                    <div className="flex items-center gap-2 text-gray-400 py-3 text-sm">
                      <Loader2 className="w-4 h-4 animate-spin" /> 매장 목록을 불러오는 중...
                    </div>
                  ) : stores.length === 0 ? (
                    <p className="text-sm text-gray-400 py-2">등록된 매장이 없습니다</p>
                  ) : (
                    <select
                      value={selectedStoreForDevices}
                      onChange={e => {
                        setSelectedStoreForDevices(e.target.value)
                        setSelectedTargetIds([])
                      }}
                      className="w-full border rounded-lg px-3 py-2 text-sm"
                    >
                      <option value="">매장을 선택하세요</option>
                      {stores.map(store => (
                        <option key={store.id} value={store.id}>{store.name}</option>
                      ))}
                    </select>
                  )}

                  {selectedStoreForDevices && (
                    <div className="mt-3">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        디바이스 선택 {selectedTargetIds.length > 0 && (
                          <span className="text-blue-600 font-normal">({selectedTargetIds.length}개 선택됨)</span>
                        )}
                      </label>
                      {devicesLoading ? (
                        <div className="flex items-center gap-2 text-gray-400 py-3 text-sm">
                          <Loader2 className="w-4 h-4 animate-spin" /> 디바이스 목록을 불러오는 중...
                        </div>
                      ) : devices.length === 0 ? (
                        <p className="text-sm text-gray-400 py-2">이 매장에 등록된 디바이스가 없습니다</p>
                      ) : (
                        <div className="border rounded-lg max-h-48 overflow-y-auto divide-y">
                          {devices.map(device => (
                            <label
                              key={device.id}
                              className="flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 cursor-pointer"
                            >
                              <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition ${
                                selectedTargetIds.includes(device.id)
                                  ? 'bg-blue-500 border-blue-500'
                                  : 'border-gray-300'
                              }`}>
                                {selectedTargetIds.includes(device.id) && (
                                  <Check className="w-3 h-3 text-white" />
                                )}
                              </div>
                              <input
                                type="checkbox"
                                className="sr-only"
                                checked={selectedTargetIds.includes(device.id)}
                                onChange={() => toggleTargetId(device.id)}
                              />
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium text-gray-800">{device.name}</div>
                                <div className="text-xs text-gray-400">
                                  {device.deviceId}
                                  {device.status && (
                                    <span className={`ml-2 inline-block w-1.5 h-1.5 rounded-full ${
                                      device.status === 'ONLINE' ? 'bg-green-500' : device.status === 'OFFLINE' ? 'bg-gray-400' : 'bg-yellow-500'
                                    }`} />
                                  )}
                                </div>
                              </div>
                            </label>
                          ))}
                        </div>
                      )}
                      {devices.length > 0 && (
                        <div className="flex gap-2 mt-2">
                          <button
                            type="button"
                            onClick={() => setSelectedTargetIds(devices.map(d => d.id))}
                            className="text-xs text-blue-600 hover:text-blue-700"
                          >
                            전체 선택
                          </button>
                          <span className="text-xs text-gray-300">|</span>
                          <button
                            type="button"
                            onClick={() => setSelectedTargetIds([])}
                            className="text-xs text-gray-500 hover:text-gray-700"
                          >
                            선택 해제
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* 만료 시간 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">자동 만료 (선택)</label>
                <div className="flex gap-2">
                  {[
                    { label: '30분', mins: 30 },
                    { label: '1시간', mins: 60 },
                    { label: '3시간', mins: 180 },
                    { label: '24시간', mins: 1440 },
                    { label: '수동 해제', mins: 0 },
                  ].map(opt => (
                    <button
                      key={opt.label}
                      onClick={() => setForm(f => ({
                        ...f,
                        expiresAt: opt.mins ? new Date(Date.now() + opt.mins * 60000).toISOString() : undefined,
                      }))}
                      className="px-3 py-1.5 text-xs border rounded-lg hover:bg-gray-50"
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 미리보기 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">미리보기</label>
                <div
                  className="rounded-lg p-4 text-center"
                  style={{
                    backgroundColor: form.bgColor,
                    color: form.textColor,
                    fontSize: Math.min(form.fontSize || 48, 24),
                  }}
                >
                  <div className="font-bold mb-1">{form.title || '제목'}</div>
                  <div className="text-sm opacity-90">{form.message || '메시지 내용'}</div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 p-5 border-t">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 text-gray-600 hover:text-gray-800">
                취소
              </button>
              <button
                onClick={handleCreate}
                disabled={!canSubmit}
                className="flex items-center gap-2 px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send className="w-4 h-4" /> 즉시 전송
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
