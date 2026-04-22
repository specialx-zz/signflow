/**
 * ConditionResolveResult
 * Renders the per-device matching result returned by the resolve API.
 *
 * Shows aggregate counts at the top, then a per-device row with:
 *   - Device name + (optional) tag chips for context
 *   - Matched condition (if any)
 *   - Matched playlist (or "fallback" / "미매칭" badge)
 */
import { ArrowRight, X } from 'lucide-react'
import type { ResolveResult } from '@/api/tagPlayback'

interface Props {
  result: ResolveResult
  onClose: () => void
}

export default function ConditionResolveResult({ result, onClose }: Props) {
  const matched = result.results.filter(r => r.matchedCondition !== null).length
  const fallback = result.results.filter(r => r.fallback).length
  const unmatched = result.results.filter(r => !r.matchedPlaylist).length

  return (
    <div className="p-4 bg-green-50 rounded-lg space-y-3 border border-green-200">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-xs font-semibold text-green-800">매칭 결과</h4>
          <p className="text-xs text-green-700 mt-0.5">
            장치 <strong>{result.deviceCount}</strong>개 ·
            매칭 <strong className="text-green-700">{matched}</strong> ·
            fallback <strong className="text-yellow-700">{fallback}</strong>
            {unmatched > 0 && (
              <> · 미매칭 <strong className="text-red-600">{unmatched}</strong></>
            )}
          </p>
        </div>
        <button
          onClick={onClose}
          className="p-1 text-green-600 hover:text-green-800 hover:bg-green-100 rounded"
          aria-label="결과 닫기"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {result.results.length === 0 ? (
        <p className="text-xs text-green-600">배정된 장치가 없습니다</p>
      ) : (
        <div className="space-y-1.5 max-h-64 overflow-y-auto">
          {result.results.map((r, idx) => {
            const tagEntries = Object.entries(r.device.tags)
            return (
              <div key={idx} className="flex items-center gap-2 text-xs bg-white rounded p-2 flex-wrap">
                <span className="font-medium text-gray-700">{r.device.name}</span>

                {/* Show device tags as muted chips when no condition matched —
                    helps the user diagnose why */}
                {tagEntries.length === 0 ? (
                  <span className="text-gray-400 italic">태그 없음</span>
                ) : !r.matchedCondition && (
                  <span className="text-gray-500">
                    {tagEntries.map(([k, v]) => (
                      <span key={k} className="inline-block bg-gray-100 px-1.5 py-0.5 rounded mr-1">
                        {k}={v}
                      </span>
                    ))}
                  </span>
                )}

                {r.matchedCondition && (
                  <span className="text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                    {r.matchedCondition.tagKey}={r.matchedCondition.tagValue}
                  </span>
                )}
                <ArrowRight className="w-3 h-3 text-gray-400" />
                {r.matchedPlaylist ? (
                  <span className={`px-1.5 py-0.5 rounded ${r.fallback ? 'bg-yellow-50 text-yellow-700' : 'bg-green-100 text-green-700'}`}>
                    {r.matchedPlaylist.name} {r.fallback && '(기본)'}
                  </span>
                ) : (
                  <span className="text-red-600 bg-red-50 px-1.5 py-0.5 rounded">미매칭 — 재생 안 됨</span>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
