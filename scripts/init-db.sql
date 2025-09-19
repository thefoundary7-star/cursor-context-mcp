-- Database initialization script for MCP SaaS Platform
-- This script runs when the PostgreSQL container starts for the first time

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "btree_gin";

-- Create custom types if they don't exist
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
    CREATE TYPE analytics_event_type AS ENUM ('SERVER_START', 'SERVER_STOP', 'REQUEST_COUNT', 'ERROR_COUNT', 'FEATURE_USAGE', 'QUOTA_EXCEEDED', 'LICENSE_VALIDATION', 'HEARTBEAT');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE invoice_status AS ENUM ('DRAFT', 'OPEN', 'PAID', 'VOID', 'UNCOLLECTIBLE');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create indexes for better performance
-- These will be created by Prisma migrations, but we can add additional ones here

-- Create a function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create a function for soft delete
CREATE OR REPLACE FUNCTION soft_delete()
RETURNS TRIGGER AS $$
BEGIN
    NEW.deleted_at = CURRENT_TIMESTAMP;
    NEW.is_active = false;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create a function to generate license keys
CREATE OR REPLACE FUNCTION generate_license_key()
RETURNS TEXT AS $$
BEGIN
    RETURN 'MCP-' || upper(substring(md5(random()::text) from 1 for 8)) || '-' || 
           upper(substring(md5(random()::text) from 1 for 8)) || '-' || 
           upper(substring(md5(random()::text) from 1 for 8));
END;
$$ language 'plpgsql';

-- Create a function to validate email format
CREATE OR REPLACE FUNCTION is_valid_email(email TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$';
END;
$$ language 'plpgsql';

-- Create a function to get user statistics
CREATE OR REPLACE FUNCTION get_user_stats(user_id TEXT)
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'total_licenses', COUNT(l.id),
        'active_licenses', COUNT(CASE WHEN l.is_active THEN 1 END),
        'total_servers', COUNT(s.id),
        'active_servers', COUNT(CASE WHEN s.is_active THEN 1 END),
        'total_usage', COALESCE(SUM(u.count), 0),
        'last_activity', MAX(a.timestamp)
    ) INTO result
    FROM users u
    LEFT JOIN licenses l ON l.user_id = u.id
    LEFT JOIN servers s ON s.license_id = l.id
    LEFT JOIN usage u ON u.user_id = u.id
    LEFT JOIN analytics a ON a.user_id = u.id
    WHERE u.id = user_id;
    
    RETURN result;
END;
$$ language 'plpgsql';

-- Create a function to clean up old analytics data
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
$$ language 'plpgsql';

-- Create a function to get system health metrics
CREATE OR REPLACE FUNCTION get_system_health()
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'total_users', COUNT(*),
        'active_users', COUNT(CASE WHEN is_active THEN 1 END),
        'total_licenses', (SELECT COUNT(*) FROM licenses),
        'active_licenses', (SELECT COUNT(*) FROM licenses WHERE is_active),
        'total_servers', (SELECT COUNT(*) FROM servers),
        'active_servers', (SELECT COUNT(*) FROM servers WHERE is_active),
        'total_subscriptions', (SELECT COUNT(*) FROM subscriptions),
        'active_subscriptions', (SELECT COUNT(*) FROM subscriptions WHERE status = 'ACTIVE'),
        'database_size', pg_size_pretty(pg_database_size(current_database())),
        'last_updated', CURRENT_TIMESTAMP
    ) INTO result
    FROM users;
    
    RETURN result;
END;
$$ language 'plpgsql';

-- Create a scheduled job to clean up old data (requires pg_cron extension)
-- This will be set up in production with proper cron scheduling
-- SELECT cron.schedule('cleanup-analytics', '0 2 * * *', 'SELECT cleanup_old_analytics();');

-- Create a view for user dashboard data
CREATE OR REPLACE VIEW user_dashboard AS
SELECT 
    u.id,
    u.email,
    u.first_name,
    u.last_name,
    u.company,
    u.role,
    u.is_active,
    u.created_at,
    COUNT(DISTINCT l.id) as license_count,
    COUNT(DISTINCT s.id) as server_count,
    COUNT(DISTINCT sub.id) as subscription_count,
    MAX(a.timestamp) as last_activity,
    COALESCE(SUM(u2.count), 0) as total_usage
FROM users u
LEFT JOIN licenses l ON l.user_id = u.id
LEFT JOIN servers s ON s.license_id = l.id
LEFT JOIN subscriptions sub ON sub.user_id = u.id
LEFT JOIN analytics a ON a.user_id = u.id
LEFT JOIN usage u2 ON u2.user_id = u.id
GROUP BY u.id, u.email, u.first_name, u.last_name, u.company, u.role, u.is_active, u.created_at;

-- Create a view for license analytics
CREATE OR REPLACE VIEW license_analytics AS
SELECT 
    l.id,
    l.license_key,
    l.name,
    l.plan,
    l.is_active,
    l.created_at,
    u.email as user_email,
    COUNT(DISTINCT s.id) as server_count,
    COUNT(DISTINCT a.id) as event_count,
    MAX(a.timestamp) as last_event,
    COALESCE(SUM(u2.count), 0) as total_usage
FROM licenses l
LEFT JOIN users u ON u.id = l.user_id
LEFT JOIN servers s ON s.license_id = l.id
LEFT JOIN analytics a ON a.license_id = l.id
LEFT JOIN usage u2 ON u2.license_id = l.id
GROUP BY l.id, l.license_key, l.name, l.plan, l.is_active, l.created_at, u.email;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO mcp_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO mcp_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO mcp_user;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO mcp_user;

-- Create a backup user for automated backups
CREATE USER backup_user WITH PASSWORD 'backup_password';
GRANT CONNECT ON DATABASE mcp_saas TO backup_user;
GRANT USAGE ON SCHEMA public TO backup_user;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO backup_user;
