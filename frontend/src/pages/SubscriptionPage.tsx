import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  CreditCard, Monitor, Users, HardDrive, Building2,
  Check, AlertTriangle, Clock, ArrowUpCircle
} from 'lucide-react'
import { subscriptionApi, type CurrentSubscriptionResponse, type PlanInfo } from '@/api/subscriptions'
import { formatBytes } from '@/utils/formatBytes'

function formatWon(amount: number): string {
  return new Intl.NumberFormat('ko-KR').format(amount) + '원'
}

function UsageCard({
  icon: Icon, label, current, max, unit, percent, color
}: {
  icon: React.ElementType; label: string; current: number | string; max: number; unit: string; percent: number; color: string
}) {
  const barColor = percent >= 90 ? 'bg-red-500' : percent >= 70 ? 'bg-yellow-500' : color

  return (
    <div className="bg-white rounded-xl p-5 shadow-sm border">
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${color.replace('bg-', 'bg-').replace('-500', '-100')}`}>
          <Icon className={`w-5 h-5 ${color.replace('bg-', 'text-')}`} />
        </div>
        <div>
          <p className="text-sm text-gray-500">{label}</p>
          <p className="font-semibold text-gray-900">{current} <span className="text-gray-400 font-normal">/ {max} {unit}</span></p>
        </div>
      </div>
      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
        <div className={`h-full ${barColor} rounded-full transition-all duration-500`} style={{ width: `${Math.min(percent, 100)}%` }} />
      </div>
      <p className="text-xs text-gray-500 mt-1 text-right">{percent}% 사용</p>
    </div>
  )
}

const PLAN_COLORS: Record<string, string> = {
  starter: 'border-gray-300',
  business: 'border-blue-400 ring-2 ring-blue-100',
  enterprise: 'border-purple-400 ring-2 ring-purple-100',
}

export default function SubscriptionPage() {
  const queryClient = useQueryClient()
  const [showPlans, setShowPlans] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['subscription-current'],
    queryFn: () => subscriptionApi.getCurrent(),
  })

  const { data: plans = [] } = useQuery({
    queryKey: ['subscription-plans'],
    queryFn: () => subscriptionApi.getPlans(),
  })

  const upgradeMutation = useMutation({
    mutationFn: (planId: string) => subscriptionApi.upgrade(planId, 'monthly'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscription-current'] })
      setShowPlans(false)
    },
    onError: (err: any) => {
      alert(err.response?.data?.error || '플랜 변경에 실패했습니다.')
    },
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    )
  }

  if (!data) return <div className="p-6 text-gray-500">구독 정보를 불러올 수 없습니다.</div>

  const { subscription, plan, usage, status } = data
  const isTrialExpiringSoon = subscription.status === 'trial' && subscription.trialEndDate &&
    new Date(subscription.trialEndDate).getTime() - Date.now() < 3 * 24 * 60 * 60 * 1000

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">구독 관리</h1>
          <p className="text-sm text-gray-500 mt-1">현재 구독 플랜과 사용량을 확인합니다</p>
        </div>
        <button
          onClick={() => setShowPlans(!showPlans)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm transition-colors"
        >
          <ArrowUpCircle className="w-4 h-4" />
          플랜 변경
        </button>
      </div>

      {/* Warnings */}
      {status.warning && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-yellow-800">주의</p>
            <p className="text-sm text-yellow-700">{status.warning}</p>
          </div>
        </div>
      )}

      {isTrialExpiringSoon && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
          <Clock className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-blue-800">무료 체험이 곧 만료됩니다</p>
            <p className="text-sm text-blue-700">
              {subscription.trialEndDate && new Date(subscription.trialEndDate).toLocaleDateString('ko-KR')}에 만료됩니다.
              서비스를 계속 이용하려면 유료 플랜으로 업그레이드하세요.
            </p>
          </div>
        </div>
      )}

      {/* Current Plan */}
      <div className="bg-white rounded-xl p-6 shadow-sm border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
              <CreditCard className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">{plan.nameKo} 플랜</h2>
              <p className="text-sm text-gray-500">
                {subscription.billingCycle === 'yearly' ? '연간' : '월간'} 결제
                {subscription.status === 'trial' && ' (무료 체험)'}
              </p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-gray-900">{formatWon(plan.monthlyPrice)}</div>
            <div className="text-sm text-gray-500">/월</div>
          </div>
        </div>
        <div className="mt-4 pt-4 border-t flex items-center gap-6 text-sm text-gray-600">
          <span>
            상태: <span className={`font-medium ${subscription.status === 'active' ? 'text-green-600' : subscription.status === 'trial' ? 'text-blue-600' : 'text-red-600'}`}>
              {subscription.status === 'active' ? '활성' : subscription.status === 'trial' ? '체험중' : subscription.status}
            </span>
          </span>
          <span>시작일: {new Date(subscription.startDate).toLocaleDateString('ko-KR')}</span>
          {subscription.endDate && <span>만료일: {new Date(subscription.endDate).toLocaleDateString('ko-KR')}</span>}
          {subscription.trialEndDate && <span>체험 만료: {new Date(subscription.trialEndDate).toLocaleDateString('ko-KR')}</span>}
        </div>
      </div>

      {/* Usage Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <UsageCard
          icon={Monitor} label="디바이스"
          current={usage.devices.current} max={usage.devices.max} unit="대"
          percent={usage.devices.percent} color="bg-blue-500"
        />
        <UsageCard
          icon={Users} label="사용자"
          current={usage.users.current} max={usage.users.max} unit="명"
          percent={usage.users.percent} color="bg-green-500"
        />
        <UsageCard
          icon={Building2} label="매장"
          current={usage.stores.current} max={usage.stores.max} unit="개"
          percent={usage.stores.percent} color="bg-purple-500"
        />
        <UsageCard
          icon={HardDrive} label="스토리지"
          current={`${usage.storage.currentGB} GB`} max={usage.storage.maxGB} unit="GB"
          percent={usage.storage.percent} color="bg-amber-500"
        />
      </div>

      {/* Plan Selection */}
      {showPlans && (
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <div className="px-5 py-4 border-b">
            <h3 className="font-semibold text-gray-900">플랜 선택</h3>
            <p className="text-sm text-gray-500">업그레이드하면 즉시 적용됩니다</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-5">
            {plans.filter(p => p.id !== 'custom').map((p) => {
              const isCurrent = p.id === subscription.plan
              return (
                <div
                  key={p.id}
                  className={`border-2 rounded-xl p-5 transition-all ${
                    isCurrent ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-bold text-lg">{p.nameKo}</h4>
                    {isCurrent && (
                      <span className="px-2 py-0.5 bg-blue-600 text-white rounded-full text-xs">현재</span>
                    )}
                  </div>
                  <div className="text-2xl font-bold mb-4">
                    {formatWon(p.monthlyPrice)}
                    <span className="text-sm font-normal text-gray-500">/월</span>
                  </div>
                  <ul className="space-y-1.5 text-sm text-gray-600 mb-4">
                    <li className="flex items-center gap-2"><Check className="w-4 h-4 text-green-500" /> 디바이스 {p.maxDevices}대</li>
                    <li className="flex items-center gap-2"><Check className="w-4 h-4 text-green-500" /> 스토리지 {p.maxStorageGB}GB</li>
                    <li className="flex items-center gap-2"><Check className="w-4 h-4 text-green-500" /> 사용자 {p.maxUsers}명</li>
                    <li className="flex items-center gap-2"><Check className="w-4 h-4 text-green-500" /> 매장 {p.maxStores}개</li>
                  </ul>
                  {!isCurrent && (
                    <button
                      onClick={() => upgradeMutation.mutate(p.id)}
                      disabled={upgradeMutation.isPending}
                      className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium disabled:opacity-50 transition-colors"
                    >
                      {upgradeMutation.isPending ? '변경 중...' : p.monthlyPrice > plan.monthlyPrice ? '업그레이드' : '변경'}
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
