import api from './client'

export interface PlanInfo {
  id: string
  name: string
  nameKo: string
  maxDevices: number
  maxStorageGB: number
  maxUsers: number
  maxStores: number
  features: string[]
  monthlyPrice: number
  yearlyPrice: number
  auditLogDays: number
  price: { total: number; monthly: number }
}

export interface UsageInfo {
  devices: { current: number; max: number; percent: number }
  users: { current: number; max: number; percent: number }
  stores: { current: number; max: number; percent: number }
  storage: { currentGB: number; currentBytes: number; maxGB: number; percent: number }
}

export interface SubscriptionData {
  id: string
  tenantId: string
  plan: string
  billingCycle: string
  status: string
  maxDevices: number
  maxStorageGB: number
  maxUsers: number
  maxStores: number
  startDate: string
  endDate?: string
  trialEndDate?: string
}

export interface CurrentSubscriptionResponse {
  subscription: SubscriptionData
  plan: PlanInfo
  usage: UsageInfo
  status: {
    isValid: boolean
    reason: string | null
    warning: string | null
  }
}

export interface SubscriptionOverview {
  summary: {
    totalTenants: number
    byPlan: Record<string, number>
    byStatus: Record<string, number>
    totalDevices: number
    totalUsers: number
    totalStores: number
    estimatedMRR: number
  }
  items: {
    tenantId: string
    tenantName: string
    tenantSlug: string
    isActive: boolean
    plan: string
    status: string
    billingCycle: string
    usage: { devices: number; users: number; stores: number }
    limits: { maxDevices: number; maxUsers: number; maxStores: number; maxStorageGB: number }
    startDate: string
    endDate?: string
    trialEndDate?: string
  }[]
}

export const subscriptionApi = {
  getPlans: () =>
    api.get<PlanInfo[]>('/subscriptions/plans').then(r => r.data),

  getCurrent: () =>
    api.get<CurrentSubscriptionResponse>('/subscriptions/current').then(r => r.data),

  upgrade: (plan: string, billingCycle: string = 'monthly') =>
    api.put('/subscriptions/upgrade', { plan, billingCycle }).then(r => r.data),

  // SUPER_ADMIN
  getOverview: () =>
    api.get<SubscriptionOverview>('/subscriptions/overview').then(r => r.data),

  updateSubscription: (tenantId: string, data: Partial<SubscriptionData>) =>
    api.put(`/subscriptions/${tenantId}`, data).then(r => r.data),
}
