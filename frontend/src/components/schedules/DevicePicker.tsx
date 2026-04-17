/**
 * DevicePicker — replaces native <select multiple> with a searchable,
 * grouped, chip-based multi-select for device assignment on schedules.
 */
import { useMemo, useState } from 'react'
import { Search, X } from 'lucide-react'

export interface DeviceOption {
  id: string
  name: string
  store?: { id: string; name: string } | null
  status?: 'ONLINE' | 'OFFLINE' | 'WARNING'
}

interface DevicePickerProps {
  devices: DeviceOption[]
  selectedIds: string[]
  onChange: (ids: string[]) => void
  error?: string
}

/** Status indicator dot colors */
const STATUS_CLASS: Record<string, string> = {
  ONLINE: 'bg-green-500',
  OFFLINE: 'bg-gray-300',
  WARNING: 'bg-amber-400',
}

function StatusDot({ status }: { status?: string }) {
  const cls = status ? (STATUS_CLASS[status] ?? 'bg-gray-300') : 'bg-gray-300'
  return <span className={`inline-block w-2 h-2 rounded-full ${cls}`} />
}

export default function DevicePicker({ devices, selectedIds, onChange, error }: DevicePickerProps) {
  const [query, setQuery] = useState('')

  // O(1) membership check for selected ids
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds])

  // Filtered + grouped devices
  const groups = useMemo(() => {
    const q = query.toLowerCase()
    const filtered = q ? devices.filter(d => d.name.toLowerCase().includes(q)) : devices
    const map = new Map<string, { storeName: string; devices: DeviceOption[] }>()
    filtered.forEach(d => {
      const key = d.store?.id ?? '__none__'
      const storeName = d.store?.name ?? '기타'
      if (!map.has(key)) map.set(key, { storeName, devices: [] })
      map.get(key)!.devices.push(d)
    })
    return Array.from(map.values())
  }, [devices, query])

  // All filtered device ids (flat)
  const filteredIds = useMemo(
    () => groups.flatMap(g => g.devices.map(d => d.id)),
    [groups]
  )

  const allFilteredSelected =
    filteredIds.length > 0 && filteredIds.every(id => selectedSet.has(id))

  const selectedDevices = useMemo(
    () => devices.filter(d => selectedSet.has(d.id)),
    [devices, selectedSet]
  )

  // Toggle a single device
  const toggleDevice = (id: string) => {
    if (selectedSet.has(id)) {
      onChange(selectedIds.filter(s => s !== id))
    } else {
      onChange([...selectedIds, id])
    }
  }

  // Toggle all filtered devices
  const toggleAll = () => {
    if (allFilteredSelected) {
      onChange(selectedIds.filter(id => !filteredIds.includes(id)))
    } else {
      const added = filteredIds.filter(id => !selectedSet.has(id))
      onChange([...selectedIds, ...added])
    }
  }

  // Toggle all devices within a store group
  const toggleStore = (storeDeviceIds: string[]) => {
    const allSelected = storeDeviceIds.every(id => selectedSet.has(id))
    if (allSelected) {
      onChange(selectedIds.filter(id => !storeDeviceIds.includes(id)))
    } else {
      const added = storeDeviceIds.filter(id => !selectedSet.has(id))
      onChange([...selectedIds, ...added])
    }
  }

  return (
    <div className="rounded-lg border border-gray-200 overflow-hidden">
      {/* Header: search + counters */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100 bg-gray-50">
        <Search className="w-4 h-4 text-gray-400 shrink-0" />
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="장치 검색..."
          className="flex-1 text-sm bg-transparent outline-none placeholder-gray-400"
        />
        <span className="text-xs text-gray-500 whitespace-nowrap">
          {selectedIds.length}/{filteredIds.length} 선택
        </span>
        <button
          type="button"
          onClick={toggleAll}
          className="text-xs text-blue-600 hover:text-blue-800 whitespace-nowrap"
        >
          {allFilteredSelected ? '전체 해제' : '전체 선택'}
        </button>
      </div>

      {/* Selected chips */}
      {selectedDevices.length > 0 && (
        <div className="flex flex-wrap gap-1 px-3 py-2 border-b border-gray-100">
          {selectedDevices.map(d => (
            <span
              key={d.id}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-700"
            >
              {d.name}
              <button
                type="button"
                aria-label={`${d.name} 제거`}
                onClick={() => toggleDevice(d.id)}
                className="hover:text-blue-900"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Scrollable device list grouped by store */}
      <div className="max-h-64 overflow-y-auto">
        {groups.map(group => {
          const storeIds = group.devices.map(d => d.id)
          const selectedCount = storeIds.filter(id => selectedSet.has(id)).length
          return (
            <div key={group.storeName}>
              {/* Store group header */}
              <button
                type="button"
                onClick={() => toggleStore(storeIds)}
                className="w-full flex items-center justify-between px-3 py-1.5 bg-gray-50 hover:bg-gray-100 text-sm font-medium text-gray-700 text-left"
              >
                <span>▸ {group.storeName}</span>
                <span className="text-xs text-gray-400">
                  ({selectedCount}/{group.devices.length})
                </span>
              </button>
              {/* Device rows */}
              {group.devices.map(device => (
                <label
                  key={device.id}
                  className="flex items-center gap-3 px-4 py-1.5 hover:bg-gray-50 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedSet.has(device.id)}
                    onChange={() => toggleDevice(device.id)}
                    className="accent-blue-600"
                  />
                  <span className="flex-1 text-sm text-gray-700">{device.name}</span>
                  <StatusDot status={device.status} />
                </label>
              ))}
            </div>
          )
        })}
        {groups.length === 0 && (
          <p className="px-3 py-4 text-sm text-gray-400 text-center">검색 결과 없음</p>
        )}
      </div>

      {/* Error message */}
      {error && <p className="px-3 py-1.5 text-xs text-red-500 border-t border-gray-100">{error}</p>}
    </div>
  )
}
