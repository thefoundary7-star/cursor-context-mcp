import { z } from 'zod'
import dotenv from 'dotenv'
import path from 'path'

// Load production environment variables
const envFile = process.env.NODE_ENV === 'production' ? '.env.production' : '.env.local'
dotenv.config({ path: path.resolve(process.cwd(), envFile) })

// Production configuration schema with strict validation
const productionConfigSchema = z.object({
  // Application
  nodeEnv: z.enum(['development', 'staging', 'production']).default('production'),
  port: z.coerce.number().default(3001),
  host: z.string().default('0.0.0.0'),
  
  // Database (PostgreSQL for production)
  databaseUrl: z.string().url().refine(
    (url) => url.startsWith('postgresql://'),
    'Production database must use PostgreSQL'
  ),
  databasePoolSize: z.coerce.number().min(5).max(50).default(20),
  databasePoolTimeout: z.coerce.number().default(30000),
  databasePoolIdleTimeout: z.coerce.number().default(30000),
  
  // Redis
  redisUrl: z.string().url(),
  redisPassword: z.string().min(1),
  redisDb: z.coerce.number().default(0),
  
  // JWT (stricter requirements for production)
  jwtSecret: z.string().min(64, 'Production JWT secret must be at least 64 characters'),
  jwtExpiresIn: z.string().default('7d'),
  jwtRefreshExpiresIn: z.string().default('30d'),
  
  // Encryption
  encryptionKey: z.string().min(32, 'Encryption key must be at least 32 characters'),
  encryptionAlgorithm: z.string().default('aes-256-gcm'),
  
  // Dodo Payments
  dodoApiKey: z.string().min(1),
  dodoWebhookSecret: z.string().min(32),
  dodoProProductId: z.string().min(1),
  dodoEnterpriseProductId: z.string().min(1),
  
  // API Configuration
  apiRateLimit: z.coerce.number().min(100).max(10000).default(1000),
  apiRateWindow: z.coerce.number().default(900000),
  apiTimeout: z.coerce.number().default(30000),
  corsOrigin: z.string().url(),
  
  // Email (required for production)
  smtpHost: z.string().min(1),
  smtpPort: z.coerce.number().min(1).max(65535),
  smtpSecure: z.coerce.boolean(),
  smtpUser: z.string().min(1),
  smtpPass: z.string().min(1),
  fromEmail: z.string().email(),
  fromName: z.string().min(1),
  supportEmail: z.string().email(),
  
  // File Upload
  maxFileSize: z.coerce.number().default(10485760),
  uploadDir: z.string().default('/app/uploads'),
  allowedFileTypes: z.string().default('image/jpeg,image/png,image/gif,application/pdf'),
  
  // Logging
  logLevel: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  logFormat: z.enum(['json', 'simple']).default('json'),
  logFile: z.string().default('/app/logs/app.log'),
  logMaxSize: z.string().default('10m'),
  logMaxFiles: z.coerce.number().default(5),
  
  // Security
  securityHeadersEnabled: z.coerce.boolean().default(true),
  rateLimitEnabled: z.coerce.boolean().default(true),
  rateLimitWindowMs: z.coerce.number().default(900000),
  rateLimitMaxRequests: z.coerce.number().default(100),
  
  // Monitoring
  sentryDsn: z.string().url().optional(),
  sentryEnvironment: z.string().default('production'),
  healthCheckEnabled: z.coerce.boolean().default(true),
  healthCheckInterval: z.coerce.number().default(30000),
  
  // External URLs
  downloadUrl: z.string().url(),
  loginUrl: z.string().url(),
  supportUrl: z.string().url(),
  
  // Feature Flags
  featureEmailNotifications: z.coerce.boolean().default(true),
  featureAnalytics: z.coerce.boolean().default(true),
  featureUserRegistration: z.coerce.boolean().default(true),
  featureWebhookProcessing: z.coerce.boolean().default(true),
  
  // Backup
  backupEnabled: z.coerce.boolean().default(true),
  backupSchedule: z.string().default('0 2 * * *'),
  backupRetentionDays: z.coerce.number().default(30),
  backupS3Bucket: z.string().optional(),
  backupS3Region: z.string().optional(),
  
  // Performance
  dbPoolMin: z.coerce.number().default(5),
  dbPoolMax: z.coerce.number().default(20),
  dbPoolAcquireTimeout: z.coerce.number().default(60000),
  dbPoolIdleTimeout: z.coerce.number().default(10000),
  cacheTtl: z.coerce.number().default(3600),
  cacheMaxSize: z.coerce.number().default(1000),
  
  // Compliance
  gdprEnabled: z.coerce.boolean().default(true),
  dataRetentionDays: z.coerce.number().default(2555),
  privacyPolicyUrl: z.string().url(),
  termsOfServiceUrl: z.string().url(),
  
  // Development overrides (should be false in production)
  debug: z.coerce.boolean().default(false),
  verboseLogging: z.coerce.boolean().default(false),
  mockPayments: z.coerce.boolean().default(false),
  skipEmailVerification: z.coerce.boolean().default(false),
})

// Validate and parse configuration
const parseConfig = () => {
  try {
    const config = productionConfigSchema.parse({
      nodeEnv: process.env.NODE_ENV,
      port: process.env.PORT,
      host: process.env.HOST,
      databaseUrl: process.env.DATABASE_URL,
      databasePoolSize: process.env.DATABASE_POOL_SIZE,
      databasePoolTimeout: process.env.DATABASE_POOL_TIMEOUT,
      databasePoolIdleTimeout: process.env.DATABASE_POOL_IDLE_TIMEOUT,
      redisUrl: process.env.REDIS_URL,
      redisPassword: process.env.REDIS_PASSWORD,
      redisDb: process.env.REDIS_DB,
      jwtSecret: process.env.JWT_SECRET,
      jwtExpiresIn: process.env.JWT_EXPIRES_IN,
      jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN,
      encryptionKey: process.env.ENCRYPTION_KEY,
      encryptionAlgorithm: process.env.ENCRYPTION_ALGORITHM,
      dodoApiKey: process.env.DODO_API_KEY,
      dodoWebhookSecret: process.env.DODO_WEBHOOK_SECRET,
      dodoProProductId: process.env.DODO_PRO_PRODUCT_ID,
      dodoEnterpriseProductId: process.env.DODO_ENTERPRISE_PRODUCT_ID,
      apiRateLimit: process.env.API_RATE_LIMIT,
      apiRateWindow: process.env.API_RATE_WINDOW,
      apiTimeout: process.env.API_TIMEOUT,
      corsOrigin: process.env.CORS_ORIGIN,
      smtpHost: process.env.SMTP_HOST,
      smtpPort: process.env.SMTP_PORT,
      smtpSecure: process.env.SMTP_SECURE,
      smtpUser: process.env.SMTP_USER,
      smtpPass: process.env.SMTP_PASS,
      fromEmail: process.env.FROM_EMAIL,
      fromName: process.env.FROM_NAME,
      supportEmail: process.env.SUPPORT_EMAIL,
      maxFileSize: process.env.MAX_FILE_SIZE,
      uploadDir: process.env.UPLOAD_DIR,
      allowedFileTypes: process.env.ALLOWED_FILE_TYPES,
      logLevel: process.env.LOG_LEVEL,
      logFormat: process.env.LOG_FORMAT,
      logFile: process.env.LOG_FILE,
      logMaxSize: process.env.LOG_MAX_SIZE,
      logMaxFiles: process.env.LOG_MAX_FILES,
      securityHeadersEnabled: process.env.SECURITY_HEADERS_ENABLED,
      rateLimitEnabled: process.env.RATE_LIMIT_ENABLED,
      rateLimitWindowMs: process.env.RATE_LIMIT_WINDOW_MS,
      rateLimitMaxRequests: process.env.RATE_LIMIT_MAX_REQUESTS,
      sentryDsn: process.env.SENTRY_DSN,
      sentryEnvironment: process.env.SENTRY_ENVIRONMENT,
      healthCheckEnabled: process.env.HEALTH_CHECK_ENABLED,
      healthCheckInterval: process.env.HEALTH_CHECK_INTERVAL,
      downloadUrl: process.env.DOWNLOAD_URL,
      loginUrl: process.env.LOGIN_URL,
      supportUrl: process.env.SUPPORT_URL,
      featureEmailNotifications: process.env.FEATURE_EMAIL_NOTIFICATIONS,
      featureAnalytics: process.env.FEATURE_ANALYTICS,
      featureUserRegistration: process.env.FEATURE_USER_REGISTRATION,
      featureWebhookProcessing: process.env.FEATURE_WEBHOOK_PROCESSING,
      backupEnabled: process.env.BACKUP_ENABLED,
      backupSchedule: process.env.BACKUP_SCHEDULE,
      backupRetentionDays: process.env.BACKUP_RETENTION_DAYS,
      backupS3Bucket: process.env.BACKUP_S3_BUCKET,
      backupS3Region: process.env.BACKUP_S3_REGION,
      dbPoolMin: process.env.DB_POOL_MIN,
      dbPoolMax: process.env.DB_POOL_MAX,
      dbPoolAcquireTimeout: process.env.DB_POOL_ACQUIRE_TIMEOUT,
      dbPoolIdleTimeout: process.env.DB_POOL_IDLE_TIMEOUT,
      cacheTtl: process.env.CACHE_TTL,
      cacheMaxSize: process.env.CACHE_MAX_SIZE,
      gdprEnabled: process.env.GDPR_ENABLED,
      dataRetentionDays: process.env.DATA_RETENTION_DAYS,
      privacyPolicyUrl: process.env.PRIVACY_POLICY_URL,
      termsOfServiceUrl: process.env.TERMS_OF_SERVICE_URL,
      debug: process.env.DEBUG,
      verboseLogging: process.env.VERBOSE_LOGGING,
      mockPayments: process.env.MOCK_PAYMENTS,
      skipEmailVerification: process.env.SKIP_EMAIL_VERIFICATION,
    })

    return config
  } catch (error) {
    console.error('❌ Production configuration validation failed:')
    if (error instanceof z.ZodError) {
      error.errors.forEach((err) => {
        console.error(`  - ${err.path.join('.')}: ${err.message}`)
      })
    }
    throw new Error('Invalid production configuration')
  }
}

export const productionConfig = parseConfig()

// Type-safe configuration export
export type ProductionConfig = z.infer<typeof productionConfigSchema>

// Configuration validation helper
export const validateProductionConfig = (): boolean => {
  try {
    parseConfig()
    return true
  } catch {
    return false
  }
}

// Environment-specific configuration checks
export const validateProductionEnvironment = (): {
  isValid: boolean
  warnings: string[]
  errors: string[]
} => {
  const warnings: string[] = []
  const errors: string[] = []

  // Check for development settings in production
  if (process.env.NODE_ENV === 'production') {
    if (process.env.DEBUG === 'true') {
      errors.push('DEBUG should be false in production')
    }
    if (process.env.VERBOSE_LOGGING === 'true') {
      warnings.push('VERBOSE_LOGGING should be false in production')
    }
    if (process.env.MOCK_PAYMENTS === 'true') {
      errors.push('MOCK_PAYMENTS should be false in production')
    }
    if (process.env.SKIP_EMAIL_VERIFICATION === 'true') {
      warnings.push('SKIP_EMAIL_VERIFICATION should be false in production')
    }
  }

  // Check for missing critical production settings
  if (!process.env.SENTRY_DSN) {
    warnings.push('SENTRY_DSN not configured - error tracking disabled')
  }
  if (!process.env.BACKUP_S3_BUCKET) {
    warnings.push('BACKUP_S3_BUCKET not configured - automated backups disabled')
  }

  // Check database URL format
  if (process.env.DATABASE_URL && !process.env.DATABASE_URL.startsWith('postgresql://')) {
    errors.push('Production database must use PostgreSQL')
  }

  // Check JWT secret strength
  if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 64) {
    errors.push('JWT_SECRET must be at least 64 characters in production')
  }

  return {
    isValid: errors.length === 0,
    warnings,
    errors
  }
}
