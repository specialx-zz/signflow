import { useQuery } from '@tanstack/react-query'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line
} from 'recharts'
import { TrendingUp, Monitor, Film, BarChart2 } from 'lucide-react'
import { statsApi } from '@/api/stats'
import { PageLoader } from '@/components/ui/LoadingSpinner'

const COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444']
const STATUS_COLORS: Record<string, string> = {
  ONLINE: '#10b981', OFFLINE: '#ef4444', WARNING: '#f59e0b'
}

const typeLabels: Record<string, string> = {
  IMAGE: '이미지', VIDEO: '비디오', AUDIO: '오디오', HTML: 'HTML', DOCUMENT: '문서'
}

export default function StatsPage() {
  const { data: dashData, isLoading: dashLoading } = useQuery({
    queryKey: ['stats-dashboard'],
    queryFn: statsApi.getDashboard
  })

  const { data: contentStats, isLoading: contentLoading } = useQuery({
    queryKey: ['stats-content'],
    queryFn: () => statsApi.getContent({ days: 30 })
  })

  const { data: deviceStats, isLoading: deviceLoading } = useQuery({
    queryKey: ['stats-devices'],
    queryFn: statsApi.getDevices
  })

  if (dashLoading || contentLoading || deviceLoading) return <PageLoader />

  const typeDistribution = contentStats?.typeDistribution?.map((d: { type: string; count: number }) => ({
    ...d,
    name: typeLabels[d.type] || d.type
  })) || []

  const topContent = contentStats?.topContent || []
  const playTrend = dashData?.playTrend || []

  const deviceStatusData = deviceStats ? [
    { name: '온라인', value: deviceStats.statusCounts.ONLINE || 0, color: STATUS_COLORS.ONLINE },
    { name: '오프라인', value: deviceStats.statusCounts.OFFLINE || 0, color: STATUS_COLORS.OFFLINE },
    { name: '경고', value: deviceStats.statusCounts.WARNING || 0, color: STATUS_COLORS.WARNING }
  ].filter(d => d.value > 0) : []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">통계</h1>
        <p className="text-gray-500 text-sm mt-1">콘텐츠 재생 및 장치 사용 통계</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
        {[
          {
            label: '총 재생 수 (30일)',
            value: (contentStats?.totalPlays || 0).toLocaleString(),
            icon: TrendingUp,
            color: 'text-blue-500 bg-blue-50'
          },
          {
            label: '활성 장치',
            value: `${deviceStats?.statusCounts?.ONLINE || 0} / ${deviceStats?.totalDevices || 0}`,
            icon: Monitor,
            color: 'text-green-500 bg-green-50'
          },
          {
            label: '콘텐츠 유형 수',
            value: typeDistribution.length,
            icon: Film,
            color: 'text-purple-500 bg-purple-50'
          },
          {
            label: '온라인 비율',
            value: `${deviceStats?.onlineRate || 0}%`,
            icon: BarChart2,
            color: 'text-orange-500 bg-orange-50'
          }
        ].map(card => (
          <div key={card.label} className="card">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${card.color}`}>
                <card.icon className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xl font-bold text-gray-800">{card.value}</div>
                <div className="text-xs text-gray-500">{card.label}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Play trend */}
        <div className="card">
          <div className="flex items-center gap-2 mb-5">
            <TrendingUp className="w-5 h-5 text-blue-500" />
            <h2 className="text-base font-semibold text-gray-800">재생 추이 (최근 7일)</h2>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={playTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey="date"
                tickFormatter={v => {
                  try {
                    const parts = v.split('-')
                    return `${parts[1]}/${parts[2]}`
                  } catch { return v }
                }}
                tick={{ fontSize: 11 }}
              />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Line type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4 }} name="재생 수" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Content type distribution */}
        <div className="card">
          <div className="flex items-center gap-2 mb-5">
            <Film className="w-5 h-5 text-purple-500" />
            <h2 className="text-base font-semibold text-gray-800">콘텐츠 유형 분포</h2>
          </div>
          {typeDistribution.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={typeDistribution}
                  cx="50%"
                  cy="50%"
                  outerRadius={90}
                  dataKey="count"
                  nameKey="name"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {typeDistribution.map((_: unknown, idx: number) => (
                    <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-60 flex items-center justify-center text-gray-400 text-sm">
              데이터 없음
            </div>
          )}
        </div>
      </div>

      {/* Charts row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Top content */}
        <div className="card">
          <div className="flex items-center gap-2 mb-5">
            <BarChart2 className="w-5 h-5 text-green-500" />
            <h2 className="text-base font-semibold text-gray-800">인기 콘텐츠 Top 10</h2>
          </div>
          {topContent.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={topContent} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={100}
                  tick={{ fontSize: 10 }}
                  tickFormatter={v => v.length > 12 ? v.substring(0, 12) + '...' : v}
                />
                <Tooltip />
                <Bar dataKey="playCount" fill="#3b82f6" name="재생 수" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-60 flex items-center justify-center text-gray-400 text-sm">
              데이터 없음
            </div>
          )}
        </div>

        {/* Device status */}
        <div className="card">
          <div className="flex items-center gap-2 mb-5">
            <Monitor className="w-5 h-5 text-orange-500" />
            <h2 className="text-base font-semibold text-gray-800">장치 상태 현황</h2>
          </div>
          {deviceStatusData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={deviceStatusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    {deviceStatusData.map((entry, idx) => (
                      <Cell key={idx} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>

              <div className="mt-4 space-y-2">
                {deviceStats?.devices?.slice(0, 5).map((device: { id: string; name: string; status: string; lastSeen: string }) => (
                  <div key={device.id} className="flex items-center justify-between text-sm">
                    <span className="text-gray-700 truncate flex-1">{device.name}</span>
                    <span className={`text-xs font-medium ml-2
                      ${device.status === 'ONLINE' ? 'text-green-600' :
                        device.status === 'WARNING' ? 'text-yellow-600' : 'text-red-500'}`}>
                      {device.status === 'ONLINE' ? '온라인' : device.status === 'WARNING' ? '경고' : '오프라인'}
                    </span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="h-60 flex items-center justify-center text-gray-400 text-sm">
              장치 없음
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
