import { z } from 'zod';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables based on NODE_ENV
const envFile = process.env.NODE_ENV === 'production' 
  ? '.env.production' 
  : process.env.NODE_ENV === 'staging' 
  ? '.env.staging' 
  : '.env.local';

dotenv.config({ path: path.resolve(process.cwd(), envFile) });

// Configuration schema validation
const configSchema = z.object({
  // Application
  nodeEnv: z.enum(['development', 'staging', 'production']).default('development'),
  port: z.coerce.number().default(3001),
  host: z.string().default('0.0.0.0'),
  
  // Database
  databaseUrl: z.string().url(),
  databasePoolSize: z.coerce.number().default(10),
  databasePoolTimeout: z.coerce.number().default(30000),
  databasePoolIdleTimeout: z.coerce.number().default(30000),
  
  // Redis
  redisUrl: z.string().url(),
  redisPassword: z.string().optional(),
  redisDb: z.coerce.number().default(0),
  
  // JWT
  jwtSecret: z.string().min(32),
  jwtExpiresIn: z.string().default('7d'),
  jwtRefreshExpiresIn: z.string().default('30d'),
  
  // Encryption
  encryptionKey: z.string().min(32),
  encryptionAlgorithm: z.string().default('aes-256-gcm'),
  
  // Stripe
  stripeSecretKey: z.string(),
  stripePublishableKey: z.string(),
  stripeWebhookSecret: z.string(),
  stripePriceIdBasic: z.string().optional(),
  stripePriceIdPro: z.string().optional(),
  stripePriceIdEnterprise: z.string().optional(),
  
  // API
  apiRateLimit: z.coerce.number().default(1000),
  apiRateWindow: z.coerce.number().default(900000),
  apiTimeout: z.coerce.number().default(30000),
  corsOrigin: z.string().default('http://localhost:3000'),
  
  // Email
  emailProvider: z.enum(['sendgrid', 'ses', 'smtp']).default('sendgrid'),
  sendgridApiKey: z.string().optional(),
  fromEmail: z.string().email(),
  fromName: z.string().default('MCP SaaS Platform'),
  
  // File Upload
  maxFileSize: z.coerce.number().default(10485760), // 10MB
  uploadDir: z.string().default('./uploads'),
  allowedFileTypes: z.string().default('image/jpeg,image/png,image/gif,application/pdf'),
  
  // Logging
  logLevel: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  logFormat: z.enum(['json', 'simple']).default('json'),
  logFile: z.string().default('./logs/app.log'),
  logMaxSize: z.string().default('10m'),
  logMaxFiles: z.coerce.number().default(5),
  
  // Monitoring
  enableMetrics: z.coerce.boolean().default(true),
  metricsPort: z.coerce.number().default(9090),
  prometheusEndpoint: z.string().default('/metrics'),
  
  // Security
  bcryptRounds: z.coerce.number().default(12),
  sessionSecret: z.string().min(32),
  cookieSecure: z.coerce.boolean().default(true),
  cookieHttpOnly: z.coerce.boolean().default(true),
  cookieSameSite: z.enum(['strict', 'lax', 'none']).default('strict'),
  
  // CDN
  cdnUrl: z.string().url().optional(),
  cdnEnabled: z.coerce.boolean().default(false),
  
  // Backup
  backupEnabled: z.coerce.boolean().default(true),
  backupSchedule: z.string().default('0 2 * * *'),
  backupRetentionDays: z.coerce.number().default(30),
  backupS3Bucket: z.string().optional(),
  awsAccessKeyId: z.string().optional(),
  awsSecretAccessKey: z.string().optional(),
  awsRegion: z.string().default('us-east-1'),
  
  // SSL/TLS
  sslCertPath: z.string().optional(),
  sslKeyPath: z.string().optional(),
  sslCaPath: z.string().optional(),
  
  // Health Check
  healthCheckInterval: z.coerce.number().default(30000),
  healthCheckTimeout: z.coerce.number().default(5000),
  
  // Feature Flags
  featureAnalytics: z.coerce.boolean().default(true),
  featureBilling: z.coerce.boolean().default(true),
  featureLicenses: z.coerce.boolean().default(true),
  featureApiKeys: z.coerce.boolean().default(true),
  featureWebhooks: z.coerce.boolean().default(true),
  
  // Performance
  enableCompression: z.coerce.boolean().default(true),
  enableCaching: z.coerce.boolean().default(true),
  cacheTtl: z.coerce.number().default(3600),
  maxConnections: z.coerce.number().default(1000),
  
  // Development
  debug: z.coerce.boolean().default(false),
  enableSwagger: z.coerce.boolean().default(false),
  enableGraphqlPlayground: z.coerce.boolean().default(false),
});

// Parse and validate configuration
const parseConfig = () => {
  try {
    const rawConfig = {
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
      stripeSecretKey: process.env.STRIPE_SECRET_KEY,
      stripePublishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
      stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
      stripePriceIdBasic: process.env.STRIPE_PRICE_ID_BASIC,
      stripePriceIdPro: process.env.STRIPE_PRICE_ID_PRO,
      stripePriceIdEnterprise: process.env.STRIPE_PRICE_ID_ENTERPRISE,
      apiRateLimit: process.env.API_RATE_LIMIT,
      apiRateWindow: process.env.API_RATE_WINDOW,
      apiTimeout: process.env.API_TIMEOUT,
      corsOrigin: process.env.CORS_ORIGIN,
      emailProvider: process.env.EMAIL_PROVIDER,
      sendgridApiKey: process.env.SENDGRID_API_KEY,
      fromEmail: process.env.FROM_EMAIL,
      fromName: process.env.FROM_NAME,
      maxFileSize: process.env.MAX_FILE_SIZE,
      uploadDir: process.env.UPLOAD_DIR,
      allowedFileTypes: process.env.ALLOWED_FILE_TYPES,
      logLevel: process.env.LOG_LEVEL,
      logFormat: process.env.LOG_FORMAT,
      logFile: process.env.LOG_FILE,
      logMaxSize: process.env.LOG_MAX_SIZE,
      logMaxFiles: process.env.LOG_MAX_FILES,
      enableMetrics: process.env.ENABLE_METRICS,
      metricsPort: process.env.METRICS_PORT,
      prometheusEndpoint: process.env.PROMETHEUS_ENDPOINT,
      bcryptRounds: process.env.BCRYPT_ROUNDS,
      sessionSecret: process.env.SESSION_SECRET,
      cookieSecure: process.env.COOKIE_SECURE,
      cookieHttpOnly: process.env.COOKIE_HTTP_ONLY,
      cookieSameSite: process.env.COOKIE_SAME_SITE,
      cdnUrl: process.env.CDN_URL,
      cdnEnabled: process.env.CDN_ENABLED,
      backupEnabled: process.env.BACKUP_ENABLED,
      backupSchedule: process.env.BACKUP_SCHEDULE,
      backupRetentionDays: process.env.BACKUP_RETENTION_DAYS,
      backupS3Bucket: process.env.BACKUP_S3_BUCKET,
      awsAccessKeyId: process.env.AWS_ACCESS_KEY_ID,
      awsSecretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      awsRegion: process.env.AWS_REGION,
      sslCertPath: process.env.SSL_CERT_PATH,
      sslKeyPath: process.env.SSL_KEY_PATH,
      sslCaPath: process.env.SSL_CA_PATH,
      healthCheckInterval: process.env.HEALTH_CHECK_INTERVAL,
      healthCheckTimeout: process.env.HEALTH_CHECK_TIMEOUT,
      featureAnalytics: process.env.FEATURE_ANALYTICS,
      featureBilling: process.env.FEATURE_BILLING,
      featureLicenses: process.env.FEATURE_LICENSES,
      featureApiKeys: process.env.FEATURE_API_KEYS,
      featureWebhooks: process.env.FEATURE_WEBHOOKS,
      enableCompression: process.env.ENABLE_COMPRESSION,
      enableCaching: process.env.ENABLE_CACHING,
      cacheTtl: process.env.CACHE_TTL,
      maxConnections: process.env.MAX_CONNECTIONS,
      debug: process.env.DEBUG,
      enableSwagger: process.env.ENABLE_SWAGGER,
      enableGraphqlPlayground: process.env.ENABLE_GRAPHQL_PLAYGROUND,
    };

    return configSchema.parse(rawConfig);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessages = error.errors.map(err => 
        `${err.path.join('.')}: ${err.message}`
      ).join('\n');
      
      throw new Error(`Configuration validation failed:\n${errorMessages}`);
    }
    throw error;
  }
};

// Export validated configuration
export const config = parseConfig();

// Export configuration types
export type Config = z.infer<typeof configSchema>;

// Helper functions
export const isDevelopment = () => config.nodeEnv === 'development';
export const isStaging = () => config.nodeEnv === 'staging';
export const isProduction = () => config.nodeEnv === 'production';

export const getDatabaseConfig = () => ({
  url: config.databaseUrl,
  poolSize: config.databasePoolSize,
  poolTimeout: config.databasePoolTimeout,
  poolIdleTimeout: config.databasePoolIdleTimeout,
});

export const getRedisConfig = () => ({
  url: config.redisUrl,
  password: config.redisPassword,
  db: config.redisDb,
});

export const getStripeConfig = () => ({
  secretKey: config.stripeSecretKey,
  publishableKey: config.stripePublishableKey,
  webhookSecret: config.stripeWebhookSecret,
  priceIds: {
    basic: config.stripePriceIdBasic,
    pro: config.stripePriceIdPro,
    enterprise: config.stripePriceIdEnterprise,
  },
});

export const getEmailConfig = () => ({
  provider: config.emailProvider,
  sendgridApiKey: config.sendgridApiKey,
  fromEmail: config.fromEmail,
  fromName: config.fromName,
});

export const getSecurityConfig = () => ({
  jwtSecret: config.jwtSecret,
  jwtExpiresIn: config.jwtExpiresIn,
  jwtRefreshExpiresIn: config.jwtRefreshExpiresIn,
  encryptionKey: config.encryptionKey,
  encryptionAlgorithm: config.encryptionAlgorithm,
  bcryptRounds: config.bcryptRounds,
  sessionSecret: config.sessionSecret,
  cookieSecure: config.cookieSecure,
  cookieHttpOnly: config.cookieHttpOnly,
  cookieSameSite: config.cookieSameSite,
});

export const getLoggingConfig = () => ({
  level: config.logLevel,
  format: config.logFormat,
  file: config.logFile,
  maxSize: config.logMaxSize,
  maxFiles: config.logMaxFiles,
});

export const getMonitoringConfig = () => ({
  enableMetrics: config.enableMetrics,
  metricsPort: config.metricsPort,
  prometheusEndpoint: config.prometheusEndpoint,
});

export const getBackupConfig = () => ({
  enabled: config.backupEnabled,
  schedule: config.backupSchedule,
  retentionDays: config.backupRetentionDays,
  s3Bucket: config.backupS3Bucket,
  awsAccessKeyId: config.awsAccessKeyId,
  awsSecretAccessKey: config.awsSecretAccessKey,
  awsRegion: config.awsRegion,
});

export const getFeatureFlags = () => ({
  analytics: config.featureAnalytics,
  billing: config.featureBilling,
  licenses: config.featureLicenses,
  apiKeys: config.featureApiKeys,
  webhooks: config.featureWebhooks,
});

export const getPerformanceConfig = () => ({
  enableCompression: config.enableCompression,
  enableCaching: config.enableCaching,
  cacheTtl: config.cacheTtl,
  maxConnections: config.maxConnections,
});

// Configuration validation on startup
if (isProduction()) {
  // Additional production-specific validations
  if (!config.sslCertPath || !config.sslKeyPath) {
    console.warn('Warning: SSL certificates not configured for production');
  }
  
  if (!config.backupS3Bucket) {
    console.warn('Warning: S3 backup bucket not configured');
  }
  
  if (config.debug) {
    console.warn('Warning: Debug mode is enabled in production');
  }
}

export default config;