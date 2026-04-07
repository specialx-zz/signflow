import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  CreditCard, TrendingUp, Users, Monitor, HardDrive, Building2,
  ChevronDown, ChevronUp, Check, AlertTriangle, Clock, XCircle
} from 'lucide-react'
import { subscriptionApi, type SubscriptionOverview, type PlanInfo } from '@/api/subscriptions'

const STATUS_BADGE: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  active: { label: '활성', color: 'bg-green-100 text-green-700', icon: Check },
  trial: { label: '체험중', color: 'bg-blue-100 text-blue-700', icon: Clock },
  past_due: { label: '연체', color: 'bg-yellow-100 text-yellow-700', icon: AlertTriangle },
  cancelled: { label: '취소', color: 'bg-red-100 text-red-700', icon: XCircle },
  suspended: { label: '정지', color: 'bg-gray-100 text-gray-700', icon: XCircle },
}

const PLAN_COLORS: Record<string, string> = {
  starter: 'bg-gray-100 text-gray-700',
  business: 'bg-blue-100 text-blue-700',
  enterprise: 'bg-purple-100 text-purple-700',
  custom: 'bg-amber-100 text-amber-700',
}

function formatWon(amount: number): string {
  return new Intl.NumberFormat('ko-KR').format(amount) + '원'
}

function UsageBar({ current, max, label }: { current: number; max: number; label: string }) {
  const percent = max > 0 ? Math.min(Math.round((current / max) * 100), 100) : 0
  const barColor = percent >= 90 ? 'bg-red-500' : percent >= 70 ? 'bg-yellow-500' : 'bg-blue-500'

  return (
    <div className="text-sm">
      <div className="flex justify-between mb-1">
        <span className="text-gray-600">{label}</span>
        <span className="font-medium">{current} / {max}</span>
      </div>
      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
        <div className={`h-full ${barColor} rounded-full transition-all`} style={{ width: `${percent}%` }} />
      </div>
    </div>
  )
}

export default function BillingPage() {
  const queryClient = useQueryClient()
  const [expandedTenant, setExpandedTenant] = useState<string | null>(null)
  const [editingTenant, setEditingTenant] = useState<string | null>(null)
  const [editPlan, setEditPlan] = useState('')
  const [editStatus, setEditStatus] = useState('')

  const { data: overview, isLoading: overviewLoading } = useQuery({
    queryKey: ['billing-overview'],
    queryFn: () => subscriptionApi.getOverview(),
  })

  const { data: plans = [] } = useQuery({
    queryKey: ['subscription-plans'],
    queryFn: () => subscriptionApi.getPlans(),
  })

  const updateMutation = useMutation({
    mutationFn: ({ tenantId, data }: { tenantId: string; data: { plan?: string; status?: string } }) =>
      subscriptionApi.updateSubscription(tenantId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['billing-overview'] })
      setEditingTenant(null)
    },
  })

  function handleUpdateSubscription(tenantId: string) {
    updateMutation.mutate({
      tenantId,
      data: {
        plan: editPlan || undefined,
        status: editStatus || undefined,
      },
    })
  }

  if (overviewLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    )
  }

  if (!overview) return <div className="p-6 text-gray-500">데이터를 불러올 수 없습니다.</div>

  const { summary, items } = overview

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">구독 / 과금 관리</h1>
          <p className="text-sm text-gray-500 mt-1">전체 업체의 구독 현황 및 매출을 관리합니다</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-5 shadow-sm border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">예상 월매출 (MRR)</p>
              <p className="text-xl font-bold text-gray-900">{formatWon(summary.estimatedMRR)}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-5 shadow-sm border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Building2 className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">총 업체</p>
              <p className="text-xl font-bold text-gray-900">{summary.totalTenants}개</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-5 shadow-sm border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <Monitor className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">총 디바이스</p>
              <p className="text-xl font-bold text-gray-900">{summary.totalDevices}대</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-5 shadow-sm border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
              <Users className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">총 사용자</p>
              <p className="text-xl font-bold text-gray-900">{summary.totalUsers}명</p>
            </div>
          </div>
        </div>
      </div>

      {/* Plan Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl p-5 shadow-sm border">
          <h3 className="font-semibold text-gray-900 mb-3">플랜별 분포</h3>
          <div className="space-y-2">
            {Object.entries(summary.byPlan).map(([plan, count]) => (
              <div key={plan} className="flex items-center justify-between">
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${PLAN_COLORS[plan] || 'bg-gray-100 text-gray-700'}`}>
                  {plan.charAt(0).toUpperCase() + plan.slice(1)}
                </span>
                <span className="font-medium text-gray-900">{count}개</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl p-5 shadow-sm border">
          <h3 className="font-semibold text-gray-900 mb-3">상태별 분포</h3>
          <div className="space-y-2">
            {Object.entries(summary.byStatus).map(([status, count]) => {
              const badge = STATUS_BADGE[status] || { label: status, color: 'bg-gray-100 text-gray-700', icon: Clock }
              const Icon = badge.icon
              return (
                <div key={status} className="flex items-center justify-between">
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium inline-flex items-center gap-1 ${badge.color}`}>
                    <Icon className="w-3 h-3" />
                    {badge.label}
                  </span>
                  <span className="font-medium text-gray-900">{count}개</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Tenant Subscriptions Table */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div className="px-5 py-4 border-b">
          <h3 className="font-semibold text-gray-900">업체별 구독 현황</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 text-sm text-gray-600">
              <tr>
                <th className="text-left px-5 py-3 font-medium">업체</th>
                <th className="text-left px-5 py-3 font-medium">플랜</th>
                <th className="text-left px-5 py-3 font-medium">상태</th>
                <th className="text-center px-5 py-3 font-medium">디바이스</th>
                <th className="text-center px-5 py-3 font-medium">사용자</th>
                <th className="text-center px-5 py-3 font-medium">매장</th>
                <th className="text-left px-5 py-3 font-medium">만료일</th>
                <th className="text-center px-5 py-3 font-medium">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((item) => {
                const statusBadge = STATUS_BADGE[item.status] || STATUS_BADGE.active
                const StatusIcon = statusBadge.icon
                const isExpanded = expandedTenant === item.tenantId
                const isEditing = editingTenant === item.tenantId

                return (
                  <tr key={item.tenantId} className="hover:bg-gray-50">
                    <td className="px-5 py-3">
                      <div className="font-medium text-gray-900">{item.tenantName}</div>
                      <div className="text-xs text-gray-500">{item.tenantSlug}</div>
                    </td>
                    <td className="px-5 py-3">
                      {isEditing ? (
                        <select
                          className="text-xs border rounded px-2 py-1"
                          value={editPlan}
                          onChange={(e) => setEditPlan(e.target.value)}
                        >
                          <option value="">변경없음</option>
                          {plans.map(p => (
                            <option key={p.id} value={p.id}>{p.nameKo}</option>
                          ))}
                        </select>
                      ) : (
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${PLAN_COLORS[item.plan] || ''}`}>
                          {item.plan}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      {isEditing ? (
                        <select
                          className="text-xs border rounded px-2 py-1"
                          value={editStatus}
                          onChange={(e) => setEditStatus(e.target.value)}
                        >
                          <option value="">변경없음</option>
                          <option value="active">활성</option>
                          <option value="trial">체험</option>
                          <option value="suspended">정지</option>
                          <option value="cancelled">취소</option>
                        </select>
                      ) : (
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium inline-flex items-center gap-1 ${statusBadge.color}`}>
                          <StatusIcon className="w-3 h-3" />
                          {statusBadge.label}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-center text-sm">
                      <span className={item.usage.devices >= item.limits.maxDevices ? 'text-red-600 font-medium' : ''}>
                        {item.usage.devices}
                      </span>
                      <span className="text-gray-400">/{item.limits.maxDevices}</span>
                    </td>
                    <td className="px-5 py-3 text-center text-sm">
                      <span className={item.usage.users >= item.limits.maxUsers ? 'text-red-600 font-medium' : ''}>
                        {item.usage.users}
                      </span>
                      <span className="text-gray-400">/{item.limits.maxUsers}</span>
                    </td>
                    <td className="px-5 py-3 text-center text-sm">
                      {item.usage.stores}<span className="text-gray-400">/{item.limits.maxStores}</span>
                    </td>
                    <td className="px-5 py-3 text-sm text-gray-600">
                      {item.trialEndDate
                        ? <span className="text-blue-600">체험: {new Date(item.trialEndDate).toLocaleDateString('ko-KR')}</span>
                        : item.endDate
                          ? new Date(item.endDate).toLocaleDateString('ko-KR')
                          : '-'
                      }
                    </td>
                    <td className="px-5 py-3 text-center">
                      {isEditing ? (
                        <div className="flex gap-1 justify-center">
                          <button
                            onClick={() => handleUpdateSubscription(item.tenantId)}
                            className="px-2 py-1 bg-blue-600 text-white rounded text-xs"
                          >
                            저장
                          </button>
                          <button
                            onClick={() => setEditingTenant(null)}
                            className="px-2 py-1 bg-gray-200 text-gray-700 rounded text-xs"
                          >
                            취소
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            setEditingTenant(item.tenantId)
                            setEditPlan(item.plan)
                            setEditStatus(item.status)
                          }}
                          className="px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded text-xs"
                        >
                          수정
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Plans Reference */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div className="px-5 py-4 border-b">
          <h3 className="font-semibold text-gray-900">플랜 요금표</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-5">
          {plans.filter(p => p.id !== 'custom').map((plan) => (
            <div key={plan.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-bold text-lg">{plan.nameKo}</h4>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${PLAN_COLORS[plan.id]}`}>
                  {plan.name}
                </span>
              </div>
              <div className="text-2xl font-bold text-gray-900 mb-4">
                {formatWon(plan.monthlyPrice)}
                <span className="text-sm font-normal text-gray-500">/월</span>
              </div>
              <div className="space-y-2 text-sm text-gray-600">
                <div className="flex justify-between">
                  <span>디바이스</span>
                  <span className="font-medium">최대 {plan.maxDevices}대</span>
                </div>
                <div className="flex justify-between">
                  <span>스토리지</span>
                  <span className="font-medium">{plan.maxStorageGB} GB</span>
                </div>
                <div className="flex justify-between">
                  <span>사용자</span>
                  <span className="font-medium">{plan.maxUsers}명</span>
                </div>
                <div className="flex justify-between">
                  <span>매장</span>
                  <span className="font-medium">{plan.maxStores}개</span>
                </div>
                <div className="flex justify-between">
                  <span>감사로그</span>
                  <span className="font-medium">{plan.auditLogDays}일</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
