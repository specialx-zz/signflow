/**
 * ScheduleConflictDialog
 * Warning overlay shown when a schedule deployment has time-range conflicts.
 */
import { AlertTriangle } from 'lucide-react'

export interface ConflictInfo {
  message: string
  conflicts: { scheduleName: string; deviceName: string; timeRange: string }[]
}

interface ScheduleConflictDialogProps {
  conflictInfo: ConflictInfo | null
  onCancel: () => void
  onForceConfirm: () => void
  isDeploying: boolean
}

export default function ScheduleConflictDialog({
  conflictInfo,
  onCancel,
  onForceConfirm,
  isDeploying
}: ScheduleConflictDialogProps) {
  if (!conflictInfo) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-md w-full mx-4">
        <div className="flex items-start gap-3 mb-4">
          <div className="flex-shrink-0 w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-gray-800 mb-1">시간대 중복 경고</h3>
            <p className="text-sm text-gray-600">{conflictInfo.message}</p>
          </div>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 space-y-1">
          {conflictInfo.conflicts.map((c, i) => (
            <div key={i} className="text-xs text-amber-800">
              ⚠ <strong>{c.scheduleName}</strong> — {c.deviceName} ({c.timeRange})
            </div>
          ))}
        </div>

        <p className="text-sm text-gray-500 mb-4">
          같은 시간대에 배포하면 어떤 스케줄이 재생될지 예측하기 어렵습니다. 그래도 강제 배포하시겠습니까?
        </p>

        <div className="flex gap-2">
          <button className="btn-secondary flex-1" onClick={onCancel}>취소</button>
          <button
            className="btn-primary flex-1 bg-amber-500 hover:bg-amber-600"
            onClick={onForceConfirm}
            disabled={isDeploying}
          >
            {isDeploying ? '배포 중...' : '강제 배포'}
          </button>
        </div>
      </div>
    </div>
  )
}
