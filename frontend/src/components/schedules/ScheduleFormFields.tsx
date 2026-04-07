/**
 * ScheduleFormFields
 * Shared form body used by both the Create and Edit schedule modals.
 */
import type { Dispatch, SetStateAction } from 'react'
import PlaylistPreview from './PlaylistPreview'
import type { ContentPreview } from './ContentThumb'

export interface ScheduleForm {
  name: string
  type: string
  playlistId: string
  layoutId: string
  startDate: string
  endDate: string
  startTime: string
  endTime: string
  repeatType: string
  deviceIds: string[]
}

interface PlaylistOption {
  id: string
  name: string
}

interface LayoutOption {
  id: string
  name: string
  baseWidth: number
  baseHeight: number
}

interface DeviceOption {
  id: string
  name: string
}

interface ScheduleFormFieldsProps {
  form: ScheduleForm
  setForm: Dispatch<SetStateAction<ScheduleForm>>
  sourceMode: 'playlist' | 'layout'
  setSourceMode: Dispatch<SetStateAction<'playlist' | 'layout'>>
  playlistItems?: PlaylistOption[]
  layoutItems?: LayoutOption[]
  deviceItems?: DeviceOption[]
  /** When true, shows a PlaylistPreview below the playlist select (used in Create modal) */
  showPlaylistPreview?: boolean
  onContentClick: (content: ContentPreview) => void
}

export default function ScheduleFormFields({
  form,
  setForm,
  sourceMode,
  setSourceMode,
  playlistItems = [],
  layoutItems = [],
  deviceItems = [],
  showPlaylistPreview = false,
  onContentClick
}: ScheduleFormFieldsProps) {
  return (
    <div className="grid grid-cols-2 gap-4">
      {/* 스케줄 이름 */}
      <div className="col-span-2">
        <label className="label">스케줄 이름 *</label>
        <input
          type="text"
          value={form.name}
          onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
          className="input"
          placeholder="스케줄 이름"
        />
      </div>

      {/* 유형 */}
      <div>
        <label className="label">유형</label>
        <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} className="select">
          <option value="CONTENT">콘텐츠</option>
          <option value="MESSAGE">메시지</option>
          <option value="EVENT">이벤트</option>
        </select>
      </div>

      {/* 콘텐츠 소스 탭 */}
      <div className="col-span-2">
        <label className="label">콘텐츠 소스</label>
        <div className="flex rounded-lg border border-gray-200 overflow-hidden">
          <button
            type="button"
            className={`flex-1 py-2 text-sm font-medium transition-colors ${
              sourceMode === 'playlist' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
            }`}
            onClick={() => { setSourceMode('playlist'); setForm(f => ({ ...f, layoutId: '' })) }}
          >
            플레이리스트
          </button>
          <button
            type="button"
            className={`flex-1 py-2 text-sm font-medium transition-colors ${
              sourceMode === 'layout' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
            }`}
            onClick={() => { setSourceMode('layout'); setForm(f => ({ ...f, playlistId: '' })) }}
          >
            레이아웃 (멀티존)
          </button>
        </div>
      </div>

      {/* Playlist or Layout select */}
      {sourceMode === 'playlist' ? (
        <>
          <div className={showPlaylistPreview ? undefined : 'col-span-2'}>
            <label className="label">플레이리스트</label>
            <select
              value={form.playlistId}
              onChange={e => setForm(f => ({ ...f, playlistId: e.target.value }))}
              className="select"
            >
              <option value="">선택 안함</option>
              {playlistItems.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          {showPlaylistPreview && form.playlistId && (
            <PlaylistPreview
              playlistId={form.playlistId}
              onContentClick={onContentClick}
            />
          )}
        </>
      ) : (
        <div className="col-span-2">
          <label className="label">레이아웃 선택</label>
          <select
            value={form.layoutId}
            onChange={e => setForm(f => ({ ...f, layoutId: e.target.value }))}
            className="select"
          >
            <option value="">레이아웃 선택</option>
            {layoutItems.map(l => (
              <option key={l.id} value={l.id}>{l.name} ({l.baseWidth}×{l.baseHeight})</option>
            ))}
          </select>
        </div>
      )}

      {/* 날짜 */}
      <div>
        <label className="label">시작일 *</label>
        <input type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} className="input" />
      </div>
      <div>
        <label className="label">종료일</label>
        <input type="date" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} className="input" />
      </div>

      {/* 시간 */}
      <div>
        <label className="label">시작 시간</label>
        <input type="time" value={form.startTime} onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))} className="input" />
      </div>
      <div>
        <label className="label">종료 시간</label>
        <input type="time" value={form.endTime} onChange={e => setForm(f => ({ ...f, endTime: e.target.value }))} className="input" />
      </div>

      {/* 반복 */}
      <div>
        <label className="label">반복</label>
        <select value={form.repeatType} onChange={e => setForm(f => ({ ...f, repeatType: e.target.value }))} className="select">
          <option value="NONE">반복 없음</option>
          <option value="DAILY">매일</option>
          <option value="WEEKLY">매주</option>
          <option value="MONTHLY">매월</option>
        </select>
      </div>

      {/* 장치 선택 */}
      <div>
        <label className="label">장치 선택</label>
        <select
          multiple
          value={form.deviceIds}
          onChange={e => setForm(f => ({ ...f, deviceIds: Array.from(e.target.selectedOptions, o => o.value) }))}
          className="select h-24"
        >
          {deviceItems.map(d => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>
        <p className="text-xs text-gray-400 mt-1">Ctrl+클릭으로 여러 장치 선택</p>
      </div>
    </div>
  )
}
