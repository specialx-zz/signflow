/**
 * ConditionDiagnostics
 * Shows the current state of tag-based condition matching at a glance:
 *   - How many devices are assigned to the schedule
 *   - How many devices have tags
 *   - How many would match a condition vs. fall back vs. play nothing
 *   - Which playlist serves as the fallback
 *
 * The user no longer has to mentally simulate "will my devices match?"
 * before configuring conditions.
 */
import { Link } from 'react-router-dom'
import { AlertTriangle, Info, CheckCircle2, XCircle, ExternalLink } from 'lucide-react'
import type { ResolveResult } from '@/api/tagPlayback'

interface Props {
  /** Total devices assigned to this schedule (from Schedule.devices.length). */
  deviceCount: number
  /** Number of distinct tag keys registered across all devices. */
  tagKeyCount: number
  /** Default playlist name (Schedule.playlist?.name) — used as fallback for unmatched devices. */
  defaultPlaylistName?: string | null
  /** Live matching result. When undefined, only static guards are shown. */
  resolveResult?: ResolveResult | null
}

export default function ConditionDiagnostics({
  deviceCount,
  tagKeyCount,
  defaultPlaylistName,
  resolveResult
}: Props) {
  // Derived counts from resolve result
  const taggedDeviceCount = resolveResult?.results.filter(r => Object.keys(r.device.tags).length > 0).length ?? 0
  const matchedCount = resolveResult?.results.filter(r => r.matchedCondition !== null).length ?? 0
  const fallbackCount = resolveResult?.results.filter(r => r.fallback).length ?? 0
  const unmatchedCount = resolveResult?.results.filter(r => !r.matchedPlaylist).length ?? 0

  // Hard blocker: no devices assigned
  if (deviceCount === 0) {
    return (
      <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
        <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-semibold">스케줄에 배정된 장치가 없습니다</p>
          <p className="text-amber-700">
            조건부 재생은 장치가 1개 이상 배정되어야 작동합니다. 스케줄을 먼저 수정해 장치를 배정해주세요.
          </p>
        </div>
      </div>
    )
  }

  // Hard blocker: no tag keys exist anywhere
  if (tagKeyCount === 0) {
    return (
      <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
        <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
        <div className="space-y-1.5">
          <p className="font-semibold">등록된 장치 태그가 없습니다</p>
          <p className="text-amber-700">
            조건부 재생을 사용하려면 먼저 <strong>"태그 기반 조건 재생"</strong> 페이지에서 각 장치에 태그(예: <code className="bg-white px-1 rounded">매장타입=카페</code>)를 등록해야 합니다.
          </p>
          <Link
            to="/tag-playback"
            className="inline-flex items-center gap-1 text-amber-900 font-medium hover:underline"
          >
            태그 관리 페이지로 이동 <ExternalLink className="w-3 h-3" />
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {/* Device & matching status row */}
      <div className="flex items-center gap-2 flex-wrap text-xs p-3 bg-gray-50 border border-gray-200 rounded-lg">
        <Info className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />
        <span className="text-gray-700">
          배정 장치 <strong className="text-gray-900">{deviceCount}</strong>개
        </span>
        {resolveResult && (
          <>
            <span className="text-gray-300">·</span>
            <span className="text-gray-700">
              태그 보유 <strong className="text-gray-900">{taggedDeviceCount}</strong>개
            </span>
            <span className="text-gray-300">·</span>
            <span className="inline-flex items-center gap-1 text-green-700">
              <CheckCircle2 className="w-3 h-3" />
              매칭 <strong>{matchedCount}</strong>
            </span>
            <span className="text-gray-300">·</span>
            <span className="inline-flex items-center gap-1 text-yellow-700">
              fallback <strong>{fallbackCount}</strong>
            </span>
            {unmatchedCount > 0 && (
              <>
                <span className="text-gray-300">·</span>
                <span className="inline-flex items-center gap-1 text-red-600">
                  <XCircle className="w-3 h-3" />
                  미매칭 <strong>{unmatchedCount}</strong>
                </span>
              </>
            )}
          </>
        )}
      </div>

      {/* Fallback visualization — make implicit behaviour explicit */}
      {defaultPlaylistName ? (
        <div className="flex items-start gap-2 p-2.5 bg-blue-50 border border-blue-100 rounded-lg text-xs text-blue-800">
          <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <p>
            조건에 매칭되지 않는 장치는 기본 플레이리스트{' '}
            <span className="font-semibold bg-white px-1.5 py-0.5 rounded border border-blue-200">
              {defaultPlaylistName}
            </span>
            {' '}로 재생됩니다.
          </p>
        </div>
      ) : (
        unmatchedCount > 0 && (
          <div className="flex items-start gap-2 p-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            <p>
              스케줄에 기본 플레이리스트가 없고, 매칭되지 않는 장치는 <strong>아무것도 재생하지 않습니다</strong>.
              스케줄 수정에서 기본 플레이리스트를 지정하세요.
            </p>
          </div>
        )
      )}
    </div>
  )
}
