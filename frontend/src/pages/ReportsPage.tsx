import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { BarChart3, Monitor, FileText, TrendingUp, Activity, AlertCircle, CheckCircle } from 'lucide-react'
import { reportApi } from '@/api/reports'

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState<'daily' | 'devices' | 'content'>('daily')

  const { data: dailyData, isLoading: dailyLoading } = useQuery({
    queryKey: ['reports', 'daily'],
    queryFn: async () => {
      const [daily, weekly] = await Promise.all([
        reportApi.getDailyReport(),
        reportApi.getWeeklyTrend(),
      ])
      return {
        summary: daily.data.summary,
        trend: weekly.data.trend || [],
      }
    },
    enabled: activeTab === 'daily',
  })

  const { data: deviceReport, isLoading: deviceLoading } = useQuery({
    queryKey: ['reports', 'devices'],
    queryFn: () => reportApi.getDeviceUptime().then(r => r.data),
    enabled: activeTab === 'devices',
  })

  const { data: contentReport = [], isLoading: contentLoading } = useQuery({
    queryKey: ['reports', 'content'],
    queryFn: () => reportApi.getContentPerformance().then(r => r.data.content || []),
    enabled: activeTab === 'content',
  })

  const loading =
    (activeTab === 'daily' && dailyLoading) ||
    (activeTab === 'devices' && deviceLoading) ||
    (activeTab === 'content' && contentLoading)

  const dailyReport = dailyData?.summary ?? null
  const weeklyTrend = dailyData?.trend ?? []

  const tabs = [
    { key: 'daily', label: '일간 리포트', icon: BarChart3 },
    { key: 'devices', label: '장치 가동률', icon: Monitor },
    { key: 'content', label: '콘텐츠 성과', icon: FileText },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <BarChart3 className="w-7 h-7 text-indigo-500" />
          리포트 &amp; 분석
        </h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg w-fit">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? 'bg-white dark:bg-gray-700 text-indigo-700 dark:text-indigo-300 shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-500">로딩중...</div>
      ) : (
        <>
          {/* Daily Report */}
          {activeTab === 'daily' && dailyReport && (
            <div className="space-y-6">
              {/* KPI Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { label: '총 콘텐츠', value: dailyReport.totalContent, icon: FileText, color: 'blue' },
                  { label: '활성 장치', value: `${dailyReport.activeDevices}/${dailyReport.totalDevices}`, icon: Monitor, color: 'green' },
                  { label: '장치 가동률', value: `${dailyReport.deviceUptime}%`, icon: Activity, color: 'purple' },
                  { label: '오늘 재생', value: dailyReport.totalPlays, icon: TrendingUp, color: 'orange' },
                ].map((kpi, i) => (
                  <div key={i} className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-lg bg-${kpi.color}-100 dark:bg-${kpi.color}-900/30 flex items-center justify-center`}>
                        <kpi.icon className={`w-5 h-5 text-${kpi.color}-600 dark:text-${kpi.color}-400`} />
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{kpi.label}</p>
                        <p className="text-xl font-bold text-gray-900 dark:text-white">{kpi.value}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Weekly Trend */}
              <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-4">주간 트렌드</h3>
                <div className="flex items-end gap-2 h-40">
                  {weeklyTrend.map((day: any, i: number) => {
                    const maxPlays = Math.max(...weeklyTrend.map((d: any) => d.plays), 1)
                    const height = Math.max((day.plays / maxPlays) * 100, 4)
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center gap-1">
                        <span className="text-xs text-gray-500">{day.plays}</span>
                        <div
                          className="w-full bg-indigo-500 dark:bg-indigo-400 rounded-t"
                          style={{ height: `${height}%` }}
                        />
                        <span className="text-xs text-gray-500 dark:text-gray-400">{day.label}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Device Report */}
          {activeTab === 'devices' && deviceReport && (
            <div className="space-y-4">
              {/* Summary */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
                  <p className="text-xs text-gray-500 dark:text-gray-400">전체 장치</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{deviceReport.summary?.total || 0}</p>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
                  <p className="text-xs text-gray-500 dark:text-gray-400">정상</p>
                  <p className="text-2xl font-bold text-green-600">{deviceReport.summary?.healthy || 0}</p>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
                  <p className="text-xs text-gray-500 dark:text-gray-400">이상</p>
                  <p className="text-2xl font-bold text-red-600">{deviceReport.summary?.unhealthy || 0}</p>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
                  <p className="text-xs text-gray-500 dark:text-gray-400">가동률</p>
                  <p className="text-2xl font-bold text-indigo-600">{deviceReport.summary?.uptimePercent || 0}%</p>
                </div>
              </div>

              {/* Device table */}
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">장치명</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">매장</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">상태</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">마지막 접속</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {(deviceReport.devices || []).map((d: any) => (
                      <tr key={d.id}>
                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">{d.name}</td>
                        <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">{d.store}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
                            d.isHealthy ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                          }`}>
                            {d.isHealthy ? <CheckCircle className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                            {d.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                          {d.lastSeen ? new Date(d.lastSeen).toLocaleString('ko-KR') : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Content Report */}
          {activeTab === 'content' && (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">#</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">콘텐츠명</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">유형</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">재생 횟수</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">총 재생시간</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {contentReport.map((c: any, i: number) => (
                    <tr key={c.id}>
                      <td className="px-4 py-3 text-sm text-gray-500">{i + 1}</td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">{c.name}</td>
                      <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">{c.type}</td>
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-white font-medium">{c.playCount}</td>
                      <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                        {Math.round(c.totalDuration / 60)}분
                      </td>
                    </tr>
                  ))}
                  {contentReport.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                        재생 데이터가 없습니다
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}
