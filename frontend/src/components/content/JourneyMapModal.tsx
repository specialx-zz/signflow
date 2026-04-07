/**
 * V4 Phase 13: 콘텐츠 저니맵 모달
 * 콘텐츠가 어떤 플레이리스트/채널/스케줄/장치에서 재생되는지 시각화
 */
import { useQuery } from '@tanstack/react-query'
import { X, Film, ListVideo, Calendar, Monitor, Radio, ArrowRight } from 'lucide-react'
import { channelApi, JourneyMap } from '@/api/channels'

interface Props {
  contentId: string
  contentName: string
  onClose: () => void
}

const nodeColors: Record<string, { bg: string; icon: string; IconComp: React.ElementType }> = {
  content: { bg: 'bg-blue-100', icon: 'text-blue-600', IconComp: Film },
  playlist: { bg: 'bg-purple-100', icon: 'text-purple-600', IconComp: ListVideo },
  schedule: { bg: 'bg-orange-100', icon: 'text-orange-600', IconComp: Calendar },
  channel: { bg: 'bg-green-100', icon: 'text-green-600', IconComp: Radio },
  device: { bg: 'bg-gray-100', icon: 'text-gray-600', IconComp: Monitor },
}

export default function JourneyMapModal({ contentId, contentName, onClose }: Props) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['journey', contentId],
    queryFn: () => channelApi.getJourney(contentId)
  })

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-xl w-full max-w-3xl mx-4 shadow-2xl max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-bold text-gray-800">콘텐츠 저니맵</h2>
            <p className="text-sm text-gray-500">{contentName}</p>
          </div>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {isLoading && <div className="text-center py-12 text-gray-400">로딩 중...</div>}
          {error && <div className="text-center py-12 text-red-400">저니맵 조회에 실패했습니다</div>}

          {data && (
            <div className="space-y-6">
              {/* Summary */}
              <div className="grid grid-cols-4 gap-3">
                <SummaryCard icon={ListVideo} label="플레이리스트" count={data.playlists.length} color="purple" />
                <SummaryCard icon={Radio} label="채널" count={data.channels.length} color="green" />
                <SummaryCard icon={Monitor} label="장치" count={data.totalDevices} color="gray" />
                <SummaryCard icon={Calendar} label="스케줄" count={data.graph.nodes.filter(n => n.type === 'schedule').length} color="orange" />
              </div>

              {/* Flow visualization */}
              {data.graph.nodes.length <= 1 ? (
                <div className="text-center py-8 bg-gray-50 rounded-xl">
                  <Film className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                  <p className="text-sm text-gray-400">이 콘텐츠는 아직 배포되지 않았습니다</p>
                  <p className="text-xs text-gray-300 mt-1">플레이리스트나 채널에 추가해보세요</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Group by path type */}
                  {data.playlists.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-600 mb-2">플레이리스트 경로</h3>
                      {renderPaths(data, 'playlist')}
                    </div>
                  )}
                  {data.channels.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-600 mb-2">채널 경로</h3>
                      {renderPaths(data, 'channel')}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function SummaryCard({ icon: Icon, label, count, color }: { icon: React.ElementType; label: string; count: number; color: string }) {
  const colorMap: Record<string, string> = {
    purple: 'bg-purple-50 text-purple-600',
    green: 'bg-green-50 text-green-600',
    gray: 'bg-gray-50 text-gray-600',
    orange: 'bg-orange-50 text-orange-600',
  }
  return (
    <div className={`rounded-xl p-3 ${colorMap[color]?.split(' ')[0] || 'bg-gray-50'}`}>
      <div className="flex items-center gap-2 mb-1">
        <Icon className={`w-4 h-4 ${colorMap[color]?.split(' ')[1] || 'text-gray-600'}`} />
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className="text-2xl font-bold">{count}</p>
    </div>
  )
}

function renderPaths(data: JourneyMap, pathType: 'playlist' | 'channel') {
  const { nodes, edges } = data.graph
  const targetType = pathType === 'playlist' ? 'playlist' : 'channel'
  const targetNodes = nodes.filter(n => n.type === targetType)

  return (
    <div className="space-y-2">
      {targetNodes.map(targetNode => {
        // Find devices connected through this path
        const connectedDeviceIds = new Set<string>()
        const middleNodes: typeof nodes = []

        if (pathType === 'playlist') {
          // playlist → schedules → devices
          const scheduleEdges = edges.filter(e => e.source === targetNode.id)
          for (const se of scheduleEdges) {
            const scheduleNode = nodes.find(n => n.id === se.target && n.type === 'schedule')
            if (scheduleNode) {
              middleNodes.push(scheduleNode)
              const deviceEdges = edges.filter(e => e.source === scheduleNode.id)
              for (const de of deviceEdges) connectedDeviceIds.add(de.target)
            }
          }
        } else {
          // channel → devices
          const deviceEdges = edges.filter(e => e.source === targetNode.id)
          for (const de of deviceEdges) connectedDeviceIds.add(de.target)
        }

        const connectedDevices = nodes.filter(n => connectedDeviceIds.has(n.id) && n.type === 'device')

        return (
          <div key={targetNode.id} className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg flex-wrap">
            <NodeBadge type={targetType} name={(targetNode.data as any).name} />
            {middleNodes.map(mn => (
              <span key={mn.id} className="contents">
                <ArrowRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
                <NodeBadge type="schedule" name={(mn.data as any).name} />
              </span>
            ))}
            {connectedDevices.length > 0 && (
              <>
                <ArrowRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
                <div className="flex items-center gap-1 flex-wrap">
                  {connectedDevices.slice(0, 5).map(d => (
                    <NodeBadge key={d.id} type="device" name={(d.data as any).name} />
                  ))}
                  {connectedDevices.length > 5 && (
                    <span className="text-xs text-gray-400">+{connectedDevices.length - 5}개</span>
                  )}
                </div>
              </>
            )}
          </div>
        )
      })}
    </div>
  )
}

function NodeBadge({ type, name }: { type: string; name: string }) {
  const config = nodeColors[type] || nodeColors.device
  const Icon = config.IconComp
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-full ${config.bg} ${config.icon}`}>
      <Icon className="w-3 h-3" />
      {name}
    </span>
  )
}
