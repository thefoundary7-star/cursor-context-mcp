import { Pool, PoolClient } from 'pg';
import type {
  LicenseRecord,
  MachineRecord,
  UsageRecord,
  DatabaseConfig
} from './types.js';

export class DatabaseManager {
  private pool: Pool;
  private isInitialized: boolean = false;

  constructor(config?: DatabaseConfig) {
    const dbConfig = config || this.getConfigFromEnv();

    this.pool = new Pool({
      host: dbConfig.host,
      port: dbConfig.port,
      database: dbConfig.database,
      user: dbConfig.username,
      password: dbConfig.password,
      ssl: dbConfig.ssl,
      max: dbConfig.poolSize || 20,
      connectionTimeoutMillis: dbConfig.connectionTimeout || 5000,
      idleTimeoutMillis: 30000,
      allowExitOnIdle: false
    });

    this.pool.on('error', (err) => {
      console.error('Database pool error:', err);
    });
  }

  private getConfigFromEnv(): DatabaseConfig {
    return {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'filebridge_licenses',
      username: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || '',
      ssl: process.env.DB_SSL === 'true',
      poolSize: parseInt(process.env.DB_POOL_SIZE || '20'),
      connectionTimeout: parseInt(process.env.DB_TIMEOUT || '5000')
    };
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      await this.createTables();
      await this.createIndexes();
      this.isInitialized = true;
      console.log('Database initialized successfully');
    } catch (error) {
      console.error('Database initialization failed:', error);
      throw error;
    }
  }

  private async createTables(): Promise<void> {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      // Users table (basic user info for license management)
      await client.query(`
        CREATE TABLE IF NOT EXISTS users (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          email VARCHAR(255) UNIQUE NOT NULL,
          name VARCHAR(255),
          subscription_id VARCHAR(255),
          subscription_status VARCHAR(50) DEFAULT 'free',
          subscription_expires_at TIMESTAMP,
          grace_period_ends TIMESTAMP,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // License keys table
      await client.query(`
        CREATE TABLE IF NOT EXISTS license_keys (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          license_key VARCHAR(255) UNIQUE NOT NULL,
          user_id UUID REFERENCES users(id) ON DELETE CASCADE,
          tier VARCHAR(20) NOT NULL CHECK (tier IN ('FREE', 'PRO', 'ENTERPRISE')),
          status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'revoked', 'suspended')),
          subscription_id VARCHAR(255),
          max_machines INTEGER NOT NULL DEFAULT 3,
          custom_limits JSONB,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          expires_at TIMESTAMP,
          revoked_at TIMESTAMP,
          revocation_reason TEXT
        )
      `);

      // Machine tracking table
      await client.query(`
        CREATE TABLE IF NOT EXISTS license_machines (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          license_id UUID REFERENCES license_keys(id) ON DELETE CASCADE,
          machine_id VARCHAR(255) NOT NULL,
          fingerprint VARCHAR(512) NOT NULL,
          first_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          is_active BOOLEAN DEFAULT true,
          user_agent TEXT,
          ip_address INET,
          metadata JSONB,
          UNIQUE(license_id, machine_id)
        )
      `);

      // Usage tracking table
      await client.query(`
        CREATE TABLE IF NOT EXISTS license_usage (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          license_id UUID REFERENCES license_keys(id) ON DELETE CASCADE,
          machine_id VARCHAR(255) NOT NULL,
          date DATE NOT NULL,
          call_count INTEGER DEFAULT 0,
          features JSONB DEFAULT '[]',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(license_id, machine_id, date)
        )
      `);

      // License validation cache table
      await client.query(`
        CREATE TABLE IF NOT EXISTS license_validation_cache (
          license_key VARCHAR(255) PRIMARY KEY,
          validation_result JSONB NOT NULL,
          cached_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          expires_at TIMESTAMP NOT NULL
        )
      `);

      // Webhook events table for audit trail
      await client.query(`
        CREATE TABLE IF NOT EXISTS webhook_events (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          event_type VARCHAR(100) NOT NULL,
          subscription_id VARCHAR(255),
          user_id UUID REFERENCES users(id),
          payload JSONB NOT NULL,
          processed BOOLEAN DEFAULT false,
          processed_at TIMESTAMP,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  private async createIndexes(): Promise<void> {
    const client = await this.pool.connect();

    try {
      // License keys indexes
      await client.query('CREATE INDEX IF NOT EXISTS idx_license_keys_user_id ON license_keys(user_id)');
      await client.query('CREATE INDEX IF NOT EXISTS idx_license_keys_status ON license_keys(status)');
      await client.query('CREATE INDEX IF NOT EXISTS idx_license_keys_expires_at ON license_keys(expires_at)');

      // Machine tracking indexes
      await client.query('CREATE INDEX IF NOT EXISTS idx_license_machines_license_id ON license_machines(license_id)');
      await client.query('CREATE INDEX IF NOT EXISTS idx_license_machines_machine_id ON license_machines(machine_id)');
      await client.query('CREATE INDEX IF NOT EXISTS idx_license_machines_last_seen ON license_machines(last_seen)');

      // Usage tracking indexes
      await client.query('CREATE INDEX IF NOT EXISTS idx_license_usage_license_id_date ON license_usage(license_id, date)');
      await client.query('CREATE INDEX IF NOT EXISTS idx_license_usage_date ON license_usage(date)');

      // Cache indexes
      await client.query('CREATE INDEX IF NOT EXISTS idx_license_validation_cache_expires_at ON license_validation_cache(expires_at)');

      // Webhook events indexes
      await client.query('CREATE INDEX IF NOT EXISTS idx_webhook_events_subscription_id ON webhook_events(subscription_id)');
      await client.query('CREATE INDEX IF NOT EXISTS idx_webhook_events_user_id ON webhook_events(user_id)');
      await client.query('CREATE INDEX IF NOT EXISTS idx_webhook_events_processed ON webhook_events(processed)');
    } finally {
      client.release();
    }
  }

  // License operations
  async createLicense(license: Omit<LicenseRecord, 'id' | 'createdAt'>): Promise<LicenseRecord> {
    const client = await this.pool.connect();

    try {
      const result = await client.query(`
        INSERT INTO license_keys (license_key, user_id, tier, status, subscription_id, max_machines, custom_limits, expires_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id, license_key, user_id, tier, status, subscription_id, max_machines, custom_limits, created_at, expires_at, revoked_at
      `, [
        license.licenseKey,
        license.userId,
        license.tier,
        license.status,
        license.subscriptionId,
        license.maxMachines,
        JSON.stringify(license.customLimits),
        license.expiresAt
      ]);

      return this.mapLicenseRow(result.rows[0]);
    } finally {
      client.release();
    }
  }

  async getLicenseByKey(licenseKey: string): Promise<LicenseRecord | null> {
    const client = await this.pool.connect();

    try {
      const result = await client.query(`
        SELECT id, license_key, user_id, tier, status, subscription_id, max_machines, custom_limits, created_at, expires_at, revoked_at
        FROM license_keys
        WHERE license_key = $1
      `, [licenseKey]);

      if (result.rows.length === 0) return null;
      return this.mapLicenseRow(result.rows[0]);
    } finally {
      client.release();
    }
  }

  async updateLicenseStatus(licenseKey: string, status: LicenseRecord['status'], reason?: string): Promise<void> {
    const client = await this.pool.connect();

    try {
      await client.query(`
        UPDATE license_keys
        SET status = $1, revoked_at = $2, revocation_reason = $3
        WHERE license_key = $4
      `, [status, status === 'revoked' ? new Date() : null, reason, licenseKey]);
    } finally {
      client.release();
    }
  }

  // Machine operations
  async registerMachine(licenseId: string, machineId: string, fingerprint: string, metadata?: any): Promise<MachineRecord> {
    const client = await this.pool.connect();

    try {
      const result = await client.query(`
        INSERT INTO license_machines (license_id, machine_id, fingerprint, user_agent, ip_address, metadata)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (license_id, machine_id)
        DO UPDATE SET
          last_seen = CURRENT_TIMESTAMP,
          fingerprint = $3,
          user_agent = $4,
          ip_address = $5,
          metadata = $6
        RETURNING id, license_id, machine_id, fingerprint, first_seen, last_seen, is_active, user_agent, ip_address
      `, [
        licenseId,
        machineId,
        fingerprint,
        metadata?.userAgent,
        metadata?.ipAddress,
        JSON.stringify(metadata)
      ]);

      return this.mapMachineRow(result.rows[0]);
    } finally {
      client.release();
    }
  }

  async getMachinesForLicense(licenseId: string): Promise<MachineRecord[]> {
    const client = await this.pool.connect();

    try {
      const result = await client.query(`
        SELECT id, license_id, machine_id, fingerprint, first_seen, last_seen, is_active, user_agent, ip_address
        FROM license_machines
        WHERE license_id = $1 AND is_active = true
      `, [licenseId]);

      return result.rows.map(row => this.mapMachineRow(row));
    } finally {
      client.release();
    }
  }

  // Usage operations
  async recordUsage(licenseId: string, machineId: string, features: string[]): Promise<void> {
    const client = await this.pool.connect();
    const today = new Date().toISOString().split('T')[0];

    try {
      await client.query(`
        INSERT INTO license_usage (license_id, machine_id, date, call_count, features)
        VALUES ($1, $2, $3, 1, $4)
        ON CONFLICT (license_id, machine_id, date)
        DO UPDATE SET
          call_count = license_usage.call_count + 1,
          features = $4,
          updated_at = CURRENT_TIMESTAMP
      `, [licenseId, machineId, today, JSON.stringify(features)]);
    } finally {
      client.release();
    }
  }

  async getDailyUsage(licenseId: string, date?: string): Promise<number> {
    const client = await this.pool.connect();
    const targetDate = date || new Date().toISOString().split('T')[0];

    try {
      const result = await client.query(`
        SELECT COALESCE(SUM(call_count), 0) as total_calls
        FROM license_usage
        WHERE license_id = $1 AND date = $2
      `, [licenseId, targetDate]);

      return parseInt(result.rows[0].total_calls);
    } finally {
      client.release();
    }
  }

  // Cache operations
  async getCachedValidation(licenseKey: string): Promise<any | null> {
    const client = await this.pool.connect();

    try {
      const result = await client.query(`
        SELECT validation_result
        FROM license_validation_cache
        WHERE license_key = $1 AND expires_at > CURRENT_TIMESTAMP
      `, [licenseKey]);

      if (result.rows.length === 0) return null;
      return result.rows[0].validation_result;
    } finally {
      client.release();
    }
  }

  async setCachedValidation(licenseKey: string, validationResult: any, ttlMinutes: number = 5): Promise<void> {
    const client = await this.pool.connect();
    const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);

    try {
      await client.query(`
        INSERT INTO license_validation_cache (license_key, validation_result, expires_at)
        VALUES ($1, $2, $3)
        ON CONFLICT (license_key)
        DO UPDATE SET
          validation_result = $2,
          cached_at = CURRENT_TIMESTAMP,
          expires_at = $3
      `, [licenseKey, JSON.stringify(validationResult), expiresAt]);
    } finally {
      client.release();
    }
  }

  async cleanupExpiredCache(): Promise<void> {
    const client = await this.pool.connect();

    try {
      await client.query(`
        DELETE FROM license_validation_cache
        WHERE expires_at < CURRENT_TIMESTAMP
      `);
    } finally {
      client.release();
    }
  }

  // User operations
  async createUser(email: string, name?: string): Promise<string> {
    const client = await this.pool.connect();

    try {
      const result = await client.query(`
        INSERT INTO users (email, name)
        VALUES ($1, $2)
        RETURNING id
      `, [email, name]);

      return result.rows[0].id;
    } finally {
      client.release();
    }
  }

  async getUserByEmail(email: string): Promise<any | null> {
    const client = await this.pool.connect();

    try {
      const result = await client.query(`
        SELECT id, email, name, subscription_id, subscription_status, subscription_expires_at, grace_period_ends
        FROM users
        WHERE email = $1
      `, [email]);

      if (result.rows.length === 0) return null;
      return result.rows[0];
    } finally {
      client.release();
    }
  }

  async updateUserSubscription(userId: string, subscriptionData: {
    subscriptionId?: string;
    status?: string;
    expiresAt?: Date;
    gracePeriodEnds?: Date;
  }): Promise<void> {
    const client = await this.pool.connect();

    try {
      await client.query(`
        UPDATE users
        SET subscription_id = $1, subscription_status = $2, subscription_expires_at = $3, grace_period_ends = $4, updated_at = CURRENT_TIMESTAMP
        WHERE id = $5
      `, [
        subscriptionData.subscriptionId,
        subscriptionData.status,
        subscriptionData.expiresAt,
        subscriptionData.gracePeriodEnds,
        userId
      ]);
    } finally {
      client.release();
    }
  }

  // Helper methods
  private mapLicenseRow(row: any): LicenseRecord {
    return {
      id: row.id,
      licenseKey: row.license_key,
      userId: row.user_id,
      tier: row.tier,
      status: row.status,
      subscriptionId: row.subscription_id,
      createdAt: row.created_at,
      expiresAt: row.expires_at,
      revokedAt: row.revoked_at,
      maxMachines: row.max_machines,
      customLimits: row.custom_limits ? JSON.parse(row.custom_limits) : undefined
    };
  }

  private mapMachineRow(row: any): MachineRecord {
    return {
      id: row.id,
      licenseId: row.license_id,
      machineId: row.machine_id,
      fingerprint: row.fingerprint,
      firstSeen: row.first_seen,
      lastSeen: row.last_seen,
      isActive: row.is_active,
      userAgent: row.user_agent,
      ipAddress: row.ip_address
    };
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}