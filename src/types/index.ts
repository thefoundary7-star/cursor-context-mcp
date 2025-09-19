export interface User {
  id: string
  email: string
  firstName: string
  lastName: string
  avatar?: string
  createdAt: string
  updatedAt: string
}

export interface Subscription {
  id: string
  status: 'active' | 'canceled' | 'past_due' | 'unpaid' | 'trialing'
  currentPeriodStart: string
  currentPeriodEnd: string
  cancelAtPeriodEnd: boolean
  plan: {
    id: string
    name: string
    price: number
    interval: 'month' | 'year'
    features: string[]
  }
  usage: {
    requests: number
    requestsLimit: number
    devices: number
    devicesLimit: number
  }
}

export interface Invoice {
  id: string
  number: string
  amount: number
  currency: string
  status: 'paid' | 'open' | 'void' | 'uncollectible'
  createdAt: string
  paidAt?: string
  downloadUrl: string
}

export interface PaymentMethod {
  id: string
  type: 'card'
  card: {
    brand: string
    last4: string
    expMonth: number
    expYear: number
  }
  isDefault: boolean
}

export interface License {
  id: string
  name: string
  key: string
  deviceLimit: number
  isActive: boolean
  createdAt: string
  updatedAt: string
  devices: Device[]
}

export interface Device {
  id: string
  name: string
  deviceId: string
  lastSeen: string
  isActive: boolean
  location?: string
  userAgent?: string
}

export interface UsageStats {
  totalRequests: number
  totalDevices: number
  requestsThisMonth: number
  devicesThisMonth: number
  quotaUsage: {
    requests: number
    devices: number
  }
  quotaLimits: {
    requests: number
    devices: number
  }
}

export interface UsageHistory {
  date: string
  requests: number
  devices: number
}

export interface DownloadFile {
  id: string
  name: string
  description: string
  version: string
  size: number
  downloadUrl: string
  createdAt: string
  isLatest: boolean
}

export interface ApiResponse<T> {
  data: T
  message?: string
  success: boolean
}

export interface PaginatedResponse<T> {
  data: T[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export interface ErrorResponse {
  message: string
  code?: string
  details?: any
}

export type Theme = 'light' | 'dark' | 'system'

export interface AppSettings {
  theme: Theme
  notifications: {
    email: boolean
    push: boolean
    billing: boolean
    usage: boolean
  }
  preferences: {
    timezone: string
    dateFormat: string
    currency: string
  }
}