// Sidebar listing schedules with search, filter chips, status dots, and device count.
import { useState, useMemo } from 'react'
import { Calendar, Pencil, Trash2, Copy, Search } from 'lucide-react'
import { toDateStr } from '@/utils/date'
import { classifyStatus, STATUS_DOT_CLASS, STATUS_LABELS } from '@/utils/scheduleStatus'
import type { ScheduleRuntimeStatus } from '@/utils/scheduleStatus'
import type { Schedule } from '@/types'

interface ScheduleSidebarProps {
  schedules: Schedule[]
  canManage: boolean
  onSelect: (schedule: Schedule) => void
  onEdit: (schedule: Schedule) => void
  onDeploy: (id: string) => void
  onDelete: (schedule: Schedule) => void
  onDuplicate: (id: string) => void
}

// Filter option type including 'all'
type FilterOption = 'all' | ScheduleRuntimeStatus

const FILTER_OPTIONS: { value: FilterOption; label: string }[] = [
  { value: 'all', label: '전체' },
  { value: 'active', label: STATUS_LABELS.active },
  { value: 'upcoming', label: STATUS_LABELS.upcoming },
  { value: 'expired', label: STATUS_LABELS.expired },
]

export default function ScheduleSidebar({
  schedules,
  canManage,
  onSelect,
  onEdit,
  onDeploy,
  onDelete,
  onDuplicate,
}: ScheduleSidebarProps) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<FilterOption>('all')

  // Memoized filtered list based on search query and status filter
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return schedules.filter(s => {
      if (q && !s.name.toLowerCase().includes(q)) return false
      if (filter === 'all') return true
      return classifyStatus(s) === filter
    })
  }, [schedules, query, filter])

  const isFiltered = filtered.length !== schedules.length

  return (
    <div className="space-y-3">
      {/* Header with optional count badge */}
      <h2 className="text-sm font-semibold text-gray-700">
        스케줄 목록
        {isFiltered && (
          <span className="ml-1 text-gray-400 font-normal">
            ({filtered.length} / {schedules.length})
          </span>
        )}
      </h2>

      {/* Search input */}
      <div className="relative">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search..."
          className="w-full pl-7 pr-3 py-1.5 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-400"
        />
      </div>

      {/* Filter chip row */}
      <div className="flex gap-1 flex-wrap">
        {FILTER_OPTIONS.map(opt => (
          <button
            key={opt.value}
            onClick={() => setFilter(opt.value)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              filter === opt.value
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Schedule list or empty states */}
      {schedules.length === 0 ? (
        <div className="card text-center py-8 text-gray-400 text-sm">
          <Calendar className="w-10 h-10 mx-auto mb-2 opacity-50" />
          <p>스케줄이 없습니다</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="card text-center py-8 text-gray-400 text-sm">
          <Search className="w-10 h-10 mx-auto mb-2 opacity-50" />
          <p>검색 결과가 없습니다</p>
        </div>
      ) : (
        filtered.map(schedule => {
          const runtimeStatus = classifyStatus(schedule)
          const deviceCount = schedule.devices?.length ?? 0

          return (
            <div
              key={schedule.id}
              className="card p-4 cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => onSelect(schedule)}
            >
              {/* Name row with status dot */}
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-1.5 flex-1 min-w-0">
                  <span
                    className={`w-2 h-2 rounded-full flex-shrink-0 ${STATUS_DOT_CLASS[runtimeStatus]}`}
                    aria-label={STATUS_LABELS[runtimeStatus]}
                  />
                  <p className="text-sm font-medium text-gray-800 truncate">{schedule.name}</p>
                </div>
              </div>

              {/* Start date/time */}
              <p className="text-xs text-gray-500">
                <Calendar className="w-3 h-3 inline mr-1" />
                {toDateStr(schedule.startDate)}
                {schedule.startTime && ` ${schedule.startTime}`}
              </p>

              {/* Device count */}
              <p className="text-xs text-gray-400 mt-1">
                장치 {deviceCount}개
              </p>

              {/* Content source label */}
              <p className="text-xs text-gray-400 mt-1">
                {schedule.layout?.name
                  ? `레이아웃: ${schedule.layout.name}`
                  : schedule.playlist?.name
                    ? `플레이리스트: ${schedule.playlist.name}`
                    : '콘텐츠 없음'}
              </p>

              {/* Action buttons — only for users with manage permission */}
              {canManage && (
                <div className="flex gap-1 mt-3">
                  <button
                    className="flex-1 text-xs py-1 bg-gray-50 text-gray-600 hover:bg-gray-100 rounded transition-colors"
                    onClick={e => { e.stopPropagation(); onEdit(schedule) }}
                  >
                    <Pencil className="w-3 h-3 inline mr-1" />수정
                  </button>
                  {schedule.status !== 'ACTIVE' && (
                    <button
                      className="flex-1 text-xs py-1 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded transition-colors"
                      onClick={e => { e.stopPropagation(); onDeploy(schedule.id) }}
                    >
                      배포
                    </button>
                  )}
                  <button
                    className="px-2 py-1 text-xs text-gray-500 hover:bg-gray-100 rounded transition-colors"
                    onClick={e => { e.stopPropagation(); onDuplicate(schedule.id) }}
                    title="복제"
                  >
                    <Copy className="w-3 h-3" />
                  </button>
                  <button
                    className="px-2 py-1 text-xs text-red-500 hover:bg-red-50 rounded transition-colors"
                    onClick={e => { e.stopPropagation(); onDelete(schedule) }}
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>
          )
        })
      )}
    </div>
  )
}
