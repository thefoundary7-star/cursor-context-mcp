-- FileBridge Production Database Migration Script
-- This script migrates from SQLite to PostgreSQL for production

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "btree_gin";

-- Create custom types
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('USER', 'ADMIN', 'SUPER_ADMIN');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE subscription_plan AS ENUM ('FREE', 'BASIC', 'PRO', 'ENTERPRISE');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE subscription_status AS ENUM ('ACTIVE', 'CANCELED', 'INCOMPLETE', 'INCOMPLETE_EXPIRED', 'PAST_DUE', 'TRIALING', 'UNPAID');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE license_plan AS ENUM ('FREE', 'BASIC', 'PRO', 'ENTERPRISE');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE analytics_event_type AS ENUM ('SERVER_START', 'SERVER_STOP', 'REQUEST_COUNT', 'ERROR_COUNT', 'FEATURE_USAGE', 'QUOTA_EXCEEDED', 'LICENSE_VALIDATION', 'HEARTBEAT', 'EMAIL_DELIVERY', 'SYSTEM_ALERT', 'SYSTEM_METRICS');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE invoice_status AS ENUM ('DRAFT', 'OPEN', 'PAID', 'VOID', 'UNCOLLECTIBLE');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create users table
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY DEFAULT 'cuid()',
    email TEXT UNIQUE NOT NULL,
    password TEXT,
    name TEXT,
    first_name TEXT,
    last_name TEXT,
    company TEXT,
    role TEXT DEFAULT 'USER',
    is_active BOOLEAN DEFAULT true,
    email_verified TIMESTAMP,
    trial_ends_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create subscriptions table
CREATE TABLE IF NOT EXISTS subscriptions (
    id TEXT PRIMARY KEY DEFAULT 'cuid()',
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    dodo_subscription_id TEXT UNIQUE NOT NULL,
    dodo_customer_id TEXT NOT NULL,
    dodo_product_id TEXT NOT NULL,
    tier TEXT NOT NULL,
    status TEXT NOT NULL,
    license_key TEXT UNIQUE,
    current_period_start TIMESTAMP NOT NULL,
    current_period_end TIMESTAMP NOT NULL,
    trial_end TIMESTAMP,
    canceled_at TIMESTAMP,
    cancellation_reason TEXT,
    last_payment_at TIMESTAMP,
    metadata TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create payments table
CREATE TABLE IF NOT EXISTS payments (
    id TEXT PRIMARY KEY DEFAULT 'cuid()',
    dodo_payment_id TEXT UNIQUE NOT NULL,
    subscription_id TEXT REFERENCES subscriptions(dodo_subscription_id) ON DELETE SET NULL,
    user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    amount INTEGER NOT NULL,
    currency TEXT DEFAULT 'USD',
    status TEXT NOT NULL,
    failure_reason TEXT,
    paid_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create checkout_sessions table
CREATE TABLE IF NOT EXISTS checkout_sessions (
    id TEXT PRIMARY KEY DEFAULT 'cuid()',
    dodo_session_id TEXT UNIQUE NOT NULL,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    customer_email TEXT NOT NULL,
    plan TEXT NOT NULL,
    amount INTEGER NOT NULL,
    currency TEXT DEFAULT 'USD',
    payment_status TEXT DEFAULT 'pending',
    subscription_id TEXT,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create licenses table
CREATE TABLE IF NOT EXISTS licenses (
    id TEXT PRIMARY KEY DEFAULT 'cuid()',
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    license_key TEXT UNIQUE NOT NULL,
    name TEXT,
    description TEXT,
    tier TEXT NOT NULL,
    max_servers INTEGER DEFAULT 1,
    is_active BOOLEAN DEFAULT true,
    expires_at TIMESTAMP,
    subscription_id TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create servers table
CREATE TABLE IF NOT EXISTS servers (
    id TEXT PRIMARY KEY DEFAULT 'cuid()',
    license_id TEXT NOT NULL REFERENCES licenses(id) ON DELETE CASCADE,
    server_id TEXT UNIQUE NOT NULL,
    name TEXT,
    version TEXT,
    last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create analytics table
CREATE TABLE IF NOT EXISTS analytics (
    id TEXT PRIMARY KEY DEFAULT 'cuid()',
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    license_id TEXT REFERENCES licenses(id) ON DELETE SET NULL,
    server_id TEXT REFERENCES servers(id) ON DELETE SET NULL,
    event_type TEXT NOT NULL,
    event_data TEXT,
    metadata TEXT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create api_keys table
CREATE TABLE IF NOT EXISTS api_keys (
    id TEXT PRIMARY KEY DEFAULT 'cuid()',
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    key_hash TEXT UNIQUE NOT NULL,
    permissions TEXT,
    last_used TIMESTAMP,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create usage table
CREATE TABLE IF NOT EXISTS usage (
    id TEXT PRIMARY KEY DEFAULT 'cuid()',
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    license_id TEXT REFERENCES licenses(id) ON DELETE SET NULL,
    server_id TEXT REFERENCES servers(id) ON DELETE SET NULL,
    operation_type TEXT NOT NULL,
    count INTEGER DEFAULT 1,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    metadata TEXT,
    billing_period TIMESTAMP NOT NULL
);

-- Create daily_usage table
CREATE TABLE IF NOT EXISTS daily_usage (
    id TEXT PRIMARY KEY DEFAULT 'cuid()',
    license_id TEXT NOT NULL REFERENCES licenses(id) ON DELETE CASCADE,
    date TIMESTAMP NOT NULL,
    call_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(license_id, date)
);

-- Create webhook_events table
CREATE TABLE IF NOT EXISTS webhook_events (
    id TEXT PRIMARY KEY DEFAULT 'cuid()',
    dodo_event_id TEXT UNIQUE NOT NULL,
    event_type TEXT NOT NULL,
    processed BOOLEAN DEFAULT false,
    attempts INTEGER DEFAULT 0,
    data TEXT NOT NULL,
    error TEXT,
    processed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create sync_logs table
CREATE TABLE IF NOT EXISTS sync_logs (
    id TEXT PRIMARY KEY DEFAULT 'cuid()',
    type TEXT NOT NULL,
    status TEXT NOT NULL,
    details TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_dodo_subscription_id ON subscriptions(dodo_subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_subscription_id ON payments(subscription_id);
CREATE INDEX IF NOT EXISTS idx_licenses_user_id ON licenses(user_id);
CREATE INDEX IF NOT EXISTS idx_licenses_license_key ON licenses(license_key);
CREATE INDEX IF NOT EXISTS idx_licenses_subscription_id ON licenses(subscription_id);
CREATE INDEX IF NOT EXISTS idx_servers_license_id ON servers(license_id);
CREATE INDEX IF NOT EXISTS idx_servers_server_id ON servers(server_id);
CREATE INDEX IF NOT EXISTS idx_analytics_user_id ON analytics(user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_event_type ON analytics(event_type);
CREATE INDEX IF NOT EXISTS idx_analytics_timestamp ON analytics(timestamp);
CREATE INDEX IF NOT EXISTS idx_usage_license_id_timestamp ON usage(license_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_daily_usage_license_id_date ON daily_usage(license_id, date);
CREATE INDEX IF NOT EXISTS idx_webhook_events_dodo_event_id ON webhook_events(dodo_event_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_processed ON webhook_events(processed);

-- Create functions for automatic timestamp updates
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for automatic timestamp updates
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_subscriptions_updated_at ON subscriptions;
CREATE TRIGGER update_subscriptions_updated_at
    BEFORE UPDATE ON subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_payments_updated_at ON payments;
CREATE TRIGGER update_payments_updated_at
    BEFORE UPDATE ON payments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_checkout_sessions_updated_at ON checkout_sessions;
CREATE TRIGGER update_checkout_sessions_updated_at
    BEFORE UPDATE ON checkout_sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_licenses_updated_at ON licenses;
CREATE TRIGGER update_licenses_updated_at
    BEFORE UPDATE ON licenses
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_servers_updated_at ON servers;
CREATE TRIGGER update_servers_updated_at
    BEFORE UPDATE ON servers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_api_keys_updated_at ON api_keys;
CREATE TRIGGER update_api_keys_updated_at
    BEFORE UPDATE ON api_keys
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_daily_usage_updated_at ON daily_usage;
CREATE TRIGGER update_daily_usage_updated_at
    BEFORE UPDATE ON daily_usage
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Create function for soft delete
CREATE OR REPLACE FUNCTION soft_delete()
RETURNS TRIGGER AS $$
BEGIN
    NEW.is_active = false;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create views for common queries
CREATE OR REPLACE VIEW active_subscriptions AS
SELECT 
    s.*,
    u.email,
    u.name as user_name,
    u.company
FROM subscriptions s
JOIN users u ON s.user_id = u.id
WHERE s.status = 'active' AND u.is_active = true;

CREATE OR REPLACE VIEW user_license_summary AS
SELECT 
    u.id as user_id,
    u.email,
    u.name,
    u.company,
    COUNT(l.id) as total_licenses,
    COUNT(CASE WHEN l.is_active = true THEN 1 END) as active_licenses,
    MAX(l.created_at) as last_license_created
FROM users u
LEFT JOIN licenses l ON u.id = l.user_id
GROUP BY u.id, u.email, u.name, u.company;

CREATE OR REPLACE VIEW subscription_analytics AS
SELECT 
    s.tier,
    s.status,
    COUNT(*) as count,
    AVG(EXTRACT(EPOCH FROM (s.current_period_end - s.current_period_start))/86400) as avg_period_days,
    SUM(p.amount) as total_revenue
FROM subscriptions s
LEFT JOIN payments p ON s.dodo_subscription_id = p.subscription_id AND p.status = 'succeeded'
GROUP BY s.tier, s.status;

-- Create function to clean up old analytics data
CREATE OR REPLACE FUNCTION cleanup_old_analytics()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM analytics 
    WHERE timestamp < CURRENT_TIMESTAMP - INTERVAL '90 days';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Create function to get user statistics
CREATE OR REPLACE FUNCTION get_user_stats()
RETURNS TABLE (
    total_users BIGINT,
    active_users BIGINT,
    total_subscriptions BIGINT,
    active_subscriptions BIGINT,
    total_licenses BIGINT,
    active_licenses BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        (SELECT COUNT(*) FROM users) as total_users,
        (SELECT COUNT(*) FROM users WHERE is_active = true) as active_users,
        (SELECT COUNT(*) FROM subscriptions) as total_subscriptions,
        (SELECT COUNT(*) FROM subscriptions WHERE status = 'active') as active_subscriptions,
        (SELECT COUNT(*) FROM licenses) as total_licenses,
        (SELECT COUNT(*) FROM licenses WHERE is_active = true) as active_licenses;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO filebridge_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO filebridge_user;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO filebridge_user;

-- Insert initial system user for monitoring
INSERT INTO users (id, email, name, role, is_active, email_verified, created_at, updated_at)
VALUES ('system', 'system@filebridge.com', 'System User', 'SUPER_ADMIN', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (id) DO NOTHING;

-- Create initial analytics entry
INSERT INTO analytics (user_id, event_type, event_data, timestamp)
VALUES ('system', 'SYSTEM_METRICS', '{"message": "Database migration completed", "version": "1.0.0"}', CURRENT_TIMESTAMP);

-- Update table statistics
ANALYZE;

COMMIT;
