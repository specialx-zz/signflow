import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  Film, Monitor, Calendar, HardDrive, Activity,
  TrendingUp, AlertTriangle, CheckCircle, XCircle
} from 'lucide-react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts'
import { statsApi } from '@/api/stats'
import { PageLoader } from '@/components/ui/LoadingSpinner'
import { format, parseISO } from 'date-fns'
import { ko } from 'date-fns/locale'
import { formatBytes } from '@/utils/formatBytes'

const COLORS = ['#10b981', '#ef4444', '#f59e0b']

export default function DashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: statsApi.getDashboard,
    refetchInterval: 30000
  })

  if (isLoading) return <PageLoader />

  const stats = data?.stats || {}
  const deviceStatus = data?.deviceStatus || {}
  const recentContent = data?.recentContent || []
  const playTrend = data?.playTrend || []

  const statCards = [
    {
      label: '전체 콘텐츠',
      value: stats.content || 0,
      icon: Film,
      color: 'bg-blue-500',
      bgColor: 'bg-blue-50',
      link: '/content'
    },
    {
      label: '등록 장치',
      value: stats.devices || 0,
      icon: Monitor,
      color: 'bg-purple-500',
      bgColor: 'bg-purple-50',
      link: '/devices',
      sub: `온라인: ${stats.onlineDevices || 0}`
    },
    {
      label: '활성 스케줄',
      value: stats.activeSchedules || 0,
      icon: Calendar,
      color: 'bg-green-500',
      bgColor: 'bg-green-50',
      link: '/schedules'
    },
    {
      label: '저장 용량',
      value: formatBytes(stats.storageUsed || 0),
      icon: HardDrive,
      color: 'bg-orange-500',
      bgColor: 'bg-orange-50',
    }
  ]

  const devicePieData = [
    { name: '온라인', value: deviceStatus.online || 0 },
    { name: '오프라인', value: deviceStatus.offline || 0 },
    { name: '경고', value: deviceStatus.warning || 0 }
  ].filter(d => d.value > 0)

  const contentTypeLabels: Record<string, string> = {
    IMAGE: '이미지', VIDEO: '비디오', AUDIO: '오디오', HTML: 'HTML', DOCUMENT: '문서'
  }

  return (
    <div className="space-y-6">
      {/* Page title */}
      <div>
        <h1 className="text-2xl font-bold text-gray-800">대시보드</h1>
        <p className="text-gray-500 text-sm mt-1">시스템 현황을 한눈에 확인하세요</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
        {statCards.map((card) => (
          <div key={card.label} className="card hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 mb-1">{card.label}</p>
                <p className="text-2xl font-bold text-gray-800">
                  {typeof card.value === 'number' ? card.value.toLocaleString() : card.value}
                </p>
                {card.sub && <p className="text-xs text-gray-400 mt-0.5">{card.sub}</p>}
              </div>
              <div className={`w-12 h-12 ${card.bgColor} rounded-xl flex items-center justify-center`}>
                <card.icon className={`w-6 h-6 ${card.color.replace('bg-', 'text-')}`} />
              </div>
            </div>
            {card.link && (
              <Link to={card.link} className="block mt-3 text-xs text-blue-600 hover:text-blue-700 font-medium">
                자세히 보기 →
              </Link>
            )}
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        {/* Play trend chart */}
        <div className="card xl:col-span-2">
          <div className="flex items-center gap-2 mb-5">
            <TrendingUp className="w-5 h-5 text-blue-600" />
            <h2 className="text-base font-semibold text-gray-800">재생 현황 (최근 7일)</h2>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={playTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey="date"
                tickFormatter={(v) => {
                  try { return format(parseISO(v), 'M/d') } catch { return v }
                }}
                tick={{ fontSize: 12 }}
              />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip
                labelFormatter={(v) => {
                  try { return format(parseISO(v), 'yyyy년 M월 d일', { locale: ko }) } catch { return v }
                }}
              />
              <Line
                type="monotone"
                dataKey="count"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={{ r: 4, fill: '#3b82f6' }}
                name="재생 수"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Device status */}
        <div className="card">
          <div className="flex items-center gap-2 mb-5">
            <Activity className="w-5 h-5 text-green-600" />
            <h2 className="text-base font-semibold text-gray-800">장치 상태</h2>
          </div>
          {devicePieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie
                  data={devicePieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {devicePieData.map((_, index) => (
                    <Cell key={index} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Legend formatter={(value) => <span className="text-xs">{value}</span>} />
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-40 flex items-center justify-center text-gray-400 text-sm">
              장치 데이터 없음
            </div>
          )}

          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <span className="text-gray-600">온라인</span>
              </div>
              <span className="font-semibold text-gray-800">{deviceStatus.online || 0}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <XCircle className="w-4 h-4 text-red-500" />
                <span className="text-gray-600">오프라인</span>
              </div>
              <span className="font-semibold text-gray-800">{deviceStatus.offline || 0}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-yellow-500" />
                <span className="text-gray-600">경고</span>
              </div>
              <span className="font-semibold text-gray-800">{deviceStatus.warning || 0}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Recent content */}
      <div className="card">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-gray-800">최근 업로드 콘텐츠</h2>
          <Link to="/content" className="text-sm text-blue-600 hover:text-blue-700 font-medium">
            전체 보기
          </Link>
        </div>
        {recentContent.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>이름</th>
                  <th>유형</th>
                  <th>크기</th>
                  <th>업로더</th>
                  <th>등록일</th>
                </tr>
              </thead>
              <tbody>
                {recentContent.map((content: { id: string; name: string; type: string; size: number; creator?: { username: string }; createdAt: string }) => (
                  <tr key={content.id}>
                    <td className="font-medium text-gray-800">{content.name}</td>
                    <td>
                      <span className="badge badge-info">{contentTypeLabels[content.type] || content.type}</span>
                    </td>
                    <td className="text-gray-500">{formatBytes(content.size)}</td>
                    <td className="text-gray-500">{content.creator?.username}</td>
                    <td className="text-gray-500 text-xs">
                      {format(new Date(content.createdAt), 'yyyy-MM-dd HH:mm')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-gray-400 text-sm text-center py-8">콘텐츠가 없습니다</p>
        )}
      </div>
    </div>
  )
}
