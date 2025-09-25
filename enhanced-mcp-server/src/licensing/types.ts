export interface LicenseValidationRequest {
  licenseKey: string;
  machineId: string;
  features?: string[];
  version?: string;
}

export interface LicenseValidationResponse {
  success: boolean;
  isValid: boolean;
  tier: 'FREE' | 'PRO' | 'ENTERPRISE';
  features: string[];
  limits: {
    dailyCalls: number;
    maxMachines: number;
    concurrentSessions: number;
  };
  usage: {
    callsToday: number;
    machinesUsed: number;
    activeSessions: number;
  };
  subscription: {
    status: 'active' | 'expired' | 'cancelled' | 'grace_period';
    expiresAt?: string;
    renewsAt?: string;
    gracePeriodEnds?: string;
  };
  error?: string;
  code?: string;
}

export interface LicenseGenerationRequest {
  userId: string;
  tier: 'FREE' | 'PRO' | 'ENTERPRISE';
  subscriptionId?: string;
  expiresAt?: string;
  maxMachines?: number;
  customLimits?: {
    dailyCalls?: number;
    concurrentSessions?: number;
  };
}

export interface LicenseRecord {
  id: string;
  licenseKey: string;
  userId: string;
  tier: 'FREE' | 'PRO' | 'ENTERPRISE';
  status: 'active' | 'expired' | 'revoked' | 'suspended';
  subscriptionId?: string;
  createdAt: Date;
  expiresAt?: Date;
  revokedAt?: Date;
  maxMachines: number;
  customLimits?: {
    dailyCalls?: number;
    concurrentSessions?: number;
  };
}

export interface MachineRecord {
  id: string;
  licenseId: string;
  machineId: string;
  fingerprint: string;
  firstSeen: Date;
  lastSeen: Date;
  isActive: boolean;
  userAgent?: string;
  ipAddress?: string;
}

export interface UsageRecord {
  id: string;
  licenseId: string;
  machineId: string;
  date: string; // YYYY-MM-DD format
  callCount: number;
  features: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface SubscriptionWebhook {
  type: 'subscription.created' | 'subscription.updated' | 'subscription.cancelled' | 'subscription.renewed' | 'payment.failed';
  data: {
    subscriptionId: string;
    userId: string;
    status: string;
    planId: string;
    expiresAt?: string;
    cancelledAt?: string;
    gracePeriodEnds?: string;
  };
  timestamp: string;
  signature: string;
}

export interface LicenseTier {
  name: 'FREE' | 'PRO' | 'ENTERPRISE';
  features: string[];
  limits: {
    dailyCalls: number;
    maxMachines: number;
    concurrentSessions: number;
  };
  price?: {
    monthly: number;
    yearly: number;
  };
}

export interface SecurityConfig {
  jwtSecret: string;
  encryptionKey: string;
  webhookSecret: string;
  allowedOrigins: string[];
  rateLimits: {
    validation: number;
    generation: number;
    webhook: number;
  };
}

export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl?: boolean;
  poolSize?: number;
  connectionTimeout?: number;
}

export interface DodoPaymentsConfig {
  apiKey: string;
  apiSecret: string;
  webhookSecret: string;
  baseUrl: string;
  webhookEndpoint: string;
}

export interface MachineFingerprint {
  machineId: string;
  fingerprint: string;
  components: {
    platform: string;
    arch: string;
    machineId?: string;
    cpuModel?: string;
    totalMemory?: number;
    networkInterfaces?: string[];
    userAgent?: string;
    timestamp?: number;
    salt?: string;
  };
}