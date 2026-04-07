// V2 Multi-tenant types
export type UserRole = 'SUPER_ADMIN' | 'TENANT_ADMIN' | 'STORE_MANAGER' | 'USER' | 'VIEWER'

export interface Tenant {
  id: string
  name: string
  slug: string
  logo?: string
  brandColor?: string
  contactName?: string
  contactEmail?: string
  contactPhone?: string
  address?: string
  timezone: string
  isActive: boolean
  subscription?: Subscription
  _count?: { users: number; devices: number; content: number }
  createdAt: string
  updatedAt: string
}

export interface Store {
  id: string
  tenantId: string
  name: string
  address?: string
  phone?: string
  managerId?: string
  isActive: boolean
  _count?: { devices: number }
  createdAt: string
  updatedAt: string
}

export interface Subscription {
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

export interface User {
  id: string
  username: string
  email: string
  role: UserRole | 'ADMIN'
  tenantId?: string
  tenantName?: string
  storeId?: string
  isActive: boolean
  lastLogin?: string
  createdAt: string
}

export interface ContentCategory {
  id: string
  name: string
  parentId?: string
  children?: ContentCategory[]
  _count?: { contents: number }
}

export type PublishStatus = 'published' | 'scheduled' | 'expired' | 'disabled'

export interface Content {
  id: string
  name: string
  type: 'IMAGE' | 'VIDEO' | 'AUDIO' | 'HTML' | 'DOCUMENT'
  mimeType?: string
  size: number
  duration?: number
  width?: number
  height?: number
  thumbnail?: string
  filePath: string
  url?: string
  storageType?: 'local' | 'r2'
  categoryId?: string
  category?: ContentCategory
  creator?: { id: string; username: string }
  createdBy: string
  isActive: boolean
  tags?: string
  // V4 Phase 11: 콘텐츠 생애주기
  startAt?: string | null
  expiresAt?: string | null
  publishStatus?: PublishStatus
  createdAt: string
  updatedAt: string
}

export interface LifecycleStats {
  published: number
  scheduled: number
  expired: number
  disabled: number
  total: number
  expiring: {
    d1: number
    d3: number
    d7: number
  }
}

export interface ContentDeploymentItem {
  id: string
  deviceId: string
  contentId: string
  scheduleId?: string
  status: 'PENDING' | 'DOWNLOADING' | 'COMPLETED' | 'FAILED'
  progress: number
  fileSize: number
  downloadedAt?: string
  errorMessage?: string
  updatedAt: string
}

export interface DeploymentStatus {
  summary: {
    total: number
    completed: number
    failed: number
    downloading: number
    pending: number
  }
  items: ContentDeploymentItem[]
}

export interface PlaylistItem {
  id: string
  playlistId: string
  contentId: string
  content: Content
  order: number
  duration: number
  settings?: string
}

export interface Playlist {
  id: string
  name: string
  type: 'GENERAL' | 'NESTED' | 'TAG' | 'VIDEOWALL' | 'SYNCHRONIZED' | 'AUDIENCE' | 'ADVERTISEMENT'
  description?: string
  thumbnail?: string
  duration: number
  isActive: boolean
  createdBy: string
  creator?: { id: string; username: string }
  items: PlaylistItem[]
  _count?: { items: number }
  settings?: string
  createdAt: string
  updatedAt: string
}

export interface ScheduleDevice {
  id: string
  scheduleId: string
  deviceId: string
  device: Device
  status: 'PENDING' | 'DEPLOYED' | 'FAILED'
  deployedAt?: string
}

export interface LayoutSummary {
  id: string
  name: string
  baseWidth: number
  baseHeight: number
  _count?: { zones: number }
}

export interface Schedule {
  id: string
  name: string
  type: 'CONTENT' | 'MESSAGE' | 'EVENT'
  playlistId?: string
  playlist?: Playlist
  layoutId?: string
  layout?: LayoutSummary
  startDate: string
  endDate?: string
  startTime?: string
  endTime?: string
  repeatType: 'NONE' | 'DAILY' | 'WEEKLY' | 'MONTHLY'
  repeatDays?: string
  isActive: boolean
  status: 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'CANCELLED'
  createdBy: string
  creator?: { id: string; username: string }
  devices: ScheduleDevice[]
  settings?: string
  createdAt: string
  updatedAt: string
}

export interface DeviceGroup {
  id: string
  name: string
  description?: string
  _count?: { devices: number }
  createdAt: string
}

export interface Device {
  id: string
  name: string
  deviceId: string
  groupId?: string
  group?: DeviceGroup
  storeId?: string
  store?: { id: string; name: string }
  status: 'ONLINE' | 'OFFLINE' | 'WARNING'
  ipAddress?: string
  macAddress?: string
  model?: string
  firmware?: string
  resolution?: string
  orientation: 'LANDSCAPE' | 'PORTRAIT'
  timezone: string
  volume: number
  brightness: number
  isActive: boolean
  lastSeen?: string
  location?: string
  settings?: string
  schedules?: ScheduleDevice[]
  createdAt: string
  updatedAt: string
}

export interface DeviceRegistrationToken {
  id: string
  tenantId: string
  storeId?: string
  code: string
  name?: string
  expiresAt: string
  isUsed: boolean
  usedBy?: string
  createdAt: string
}

export interface Statistics {
  id: string
  deviceId?: string
  contentId?: string
  type: string
  value: number
  date: string
  metadata?: string
}

export interface DashboardStats {
  stats: {
    content: number
    devices: number
    activeSchedules: number
    onlineDevices: number
    storageUsed: number
  }
  deviceStatus: {
    online: number
    offline: number
    warning: number
  }
  recentContent: Content[]
  playTrend: { date: string; count: number }[]
}

export interface Pagination {
  page: number
  limit: number
  total: number
  pages: number
}

export interface PaginatedResponse<T> {
  items: T[]
  pagination: Pagination
}
