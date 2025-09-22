# FileBridge Production Deployment Guide

This guide provides comprehensive instructions for deploying FileBridge to production with all the implemented enhancements.

## 🚀 Quick Start

### Prerequisites

- Ubuntu 20.04+ server with root access
- Domain name configured with DNS
- SSL certificate (Let's Encrypt recommended)
- SMTP service (SendGrid, AWS SES, or similar)
- Dodo Payments API credentials

### 1. Server Setup

```bash
# Download and run the server setup script
curl -fsSL https://raw.githubusercontent.com/your-repo/filebridge/main/scripts/setup-production-server.sh | bash
```

### 2. Application Deployment

```bash
# Clone the repository
git clone https://github.com/your-repo/filebridge.git /opt/filebridge
cd /opt/filebridge

# Configure environment
cp env.production .env.production
# Edit .env.production with your production values

# Deploy the application
./scripts/deploy-production.sh
```

## 📋 Detailed Setup Instructions

### Environment Configuration

Copy `env.production` to `.env.production` and configure the following:

#### Required Variables

```bash
# Database (PostgreSQL)
DATABASE_URL=postgresql://filebridge_user:your_password@localhost:5432/filebridge_production

# JWT Security
JWT_SECRET=your_super_secure_jwt_secret_minimum_64_characters_long

# Dodo Payments
DODO_API_KEY=your_production_dodo_api_key
DODO_WEBHOOK_SECRET=your_production_dodo_webhook_secret
DODO_PRO_PRODUCT_ID=your_production_pro_product_id
DODO_ENTERPRISE_PRODUCT_ID=your_production_enterprise_product_id

# Email Service
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=your_sendgrid_api_key
FROM_EMAIL=noreply@yourdomain.com
SUPPORT_EMAIL=support@yourdomain.com

# Application URLs
NEXT_PUBLIC_APP_URL=https://app.yourdomain.com
NEXT_PUBLIC_API_URL=https://api.yourdomain.com
```

#### Optional Variables

```bash
# Monitoring
SENTRY_DSN=your_sentry_dsn_for_error_tracking

# Backup
BACKUP_S3_BUCKET=your-backup-bucket
BACKUP_S3_REGION=us-east-1

# Feature Flags
FEATURE_EMAIL_NOTIFICATIONS=true
FEATURE_ANALYTICS=true
```

### Database Setup

The production deployment automatically:

1. **Creates PostgreSQL database** with optimized configuration
2. **Runs migrations** to set up all tables and indexes
3. **Creates system user** for monitoring and analytics
4. **Sets up database functions** for automatic timestamp updates
5. **Creates performance indexes** for optimal query performance

### Email System Configuration

The production email system includes:

- **SMTP Configuration**: Supports SendGrid, AWS SES, and custom SMTP
- **Email Templates**: Professional HTML templates for all subscription events
- **Delivery Tracking**: Monitors email delivery success/failure rates
- **Retry Logic**: Automatic retry for failed email deliveries
- **Rate Limiting**: Prevents email spam and abuse

#### Email Templates Included

- ✅ **License Delivery**: Welcome email with license key and setup instructions
- ⚠️ **Payment Failed**: Alert with retry instructions
- 📧 **Welcome Email**: Account setup and onboarding
- 🚫 **Subscription Cancelled**: Cancellation confirmation with reactivation option

### User Management System

The production system replaces all 'system' placeholders with:

- **Automatic User Creation**: Users created from webhook data
- **Subscription Linking**: Proper user-subscription relationships
- **License Management**: User-specific license generation and tracking
- **Email Notifications**: Personalized emails for all events

### Monitoring and Alerting

#### Health Checks

- **Database Connectivity**: PostgreSQL connection and query performance
- **Email Service**: SMTP configuration and delivery testing
- **Webhook Processing**: Success/failure rates and processing times
- **System Resources**: CPU, memory, and disk usage monitoring
- **License Generation**: Success rates and generation times

#### Alerting System

- **Email Alerts**: Sent to configured support email
- **Sentry Integration**: Error tracking and performance monitoring
- **Threshold Monitoring**: Configurable alerts for system metrics
- **Dashboard**: Real-time monitoring at `/api/monitoring/dashboard`

#### Health Check Endpoints

- `GET /api/health` - Basic health check
- `POST /api/health` - Detailed health check with all services
- `GET /api/monitoring/dashboard` - Monitoring dashboard data

### Security Features

#### Rate Limiting

- **General API**: 1000 requests per 15 minutes
- **Authentication**: 5 attempts per 15 minutes
- **Webhooks**: 100 webhooks per minute
- **File Uploads**: 50 uploads per hour
- **Email Sending**: 10 emails per hour per IP

#### Security Headers

- **CORS Protection**: Configured for production domains
- **Rate Limiting**: Redis-based distributed rate limiting
- **Input Validation**: Comprehensive request validation
- **Error Handling**: Secure error responses without sensitive data

### Production Configuration

#### Database Optimization

- **Connection Pooling**: 20 max connections with proper timeouts
- **Query Optimization**: Indexes on all frequently queried columns
- **Automatic Cleanup**: Old analytics data cleanup functions
- **Performance Monitoring**: Query performance tracking

#### Logging and Monitoring

- **Structured Logging**: JSON format for production
- **Log Rotation**: Automatic log rotation and cleanup
- **Error Tracking**: Sentry integration for error monitoring
- **Performance Metrics**: System resource monitoring

## 🔧 Deployment Commands

### Full Deployment

```bash
# Complete production deployment
./scripts/deploy-production.sh
```

### Individual Operations

```bash
# Health check
./scripts/deploy-production.sh health

# Create backup
./scripts/deploy-production.sh backup

# Rollback deployment
./scripts/deploy-production.sh rollback
```

### Manual Operations

```bash
# Start services
docker-compose -f docker-compose.production.yml up -d

# Stop services
docker-compose -f docker-compose.production.yml down

# View logs
docker-compose -f docker-compose.production.yml logs -f

# Database backup
docker-compose exec backup /scripts/backup-db.sh

# Run migrations
npx prisma migrate deploy
```

## 📊 Monitoring Dashboard

Access the monitoring dashboard at:
- **URL**: `https://api.yourdomain.com/api/monitoring/dashboard`
- **Health Check**: `https://api.yourdomain.com/api/health`

### Dashboard Features

- **Service Status**: Real-time health of all services
- **System Metrics**: CPU, memory, disk usage
- **Recent Alerts**: Last 24 hours of system alerts
- **Performance Summary**: Overall system health status

## 🚨 Troubleshooting

### Common Issues

#### Database Connection Issues

```bash
# Check database status
docker-compose exec db pg_isready -U filebridge_user

# View database logs
docker-compose logs db

# Reset database connection
docker-compose restart db
```

#### Email Delivery Issues

```bash
# Test email configuration
curl -X POST https://api.yourdomain.com/api/test-email \
  -H "Content-Type: application/json" \
  -d '{"to": "test@example.com", "subject": "Test", "message": "Test email"}'

# Check email service logs
docker-compose logs app | grep -i email
```

#### Webhook Processing Issues

```bash
# Check webhook processing
curl https://api.yourdomain.com/api/health

# View webhook logs
docker-compose logs app | grep -i webhook

# Check webhook events in database
docker-compose exec db psql -U filebridge_user -d filebridge_production -c "SELECT * FROM webhook_events ORDER BY created_at DESC LIMIT 10;"
```

### Performance Optimization

#### Database Performance

```sql
-- Check slow queries
SELECT query, mean_time, calls 
FROM pg_stat_statements 
ORDER BY mean_time DESC 
LIMIT 10;

-- Check table sizes
SELECT schemaname, tablename, pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

#### System Resources

```bash
# Check system resources
htop
iotop
df -h

# Check Docker resource usage
docker stats
```

## 🔄 Backup and Recovery

### Automated Backups

- **Daily Backups**: Automatic database backups at 2 AM
- **7-Day Retention**: Keeps last 7 days of backups
- **S3 Integration**: Optional S3 backup storage

### Manual Backup

```bash
# Create manual backup
./scripts/deploy-production.sh backup

# Restore from backup
docker-compose exec db psql -U filebridge_user -d filebridge_production < /backups/backup_YYYYMMDD_HHMMSS/database.sql
```

## 📈 Scaling Considerations

### Horizontal Scaling

- **Load Balancer**: Use nginx or cloud load balancer
- **Database**: Consider read replicas for high traffic
- **Redis**: Use Redis Cluster for distributed caching
- **File Storage**: Use S3 or similar for file uploads

### Vertical Scaling

- **Database**: Increase memory and CPU for PostgreSQL
- **Application**: Scale Docker containers based on load
- **Monitoring**: Increase monitoring frequency for high-traffic periods

## 🛡️ Security Best Practices

### Production Security Checklist

- ✅ **Firewall**: UFW configured with minimal open ports
- ✅ **SSL/TLS**: Let's Encrypt certificates configured
- ✅ **Rate Limiting**: Comprehensive rate limiting implemented
- ✅ **Input Validation**: All inputs validated and sanitized
- ✅ **Error Handling**: Secure error responses
- ✅ **Monitoring**: Comprehensive monitoring and alerting
- ✅ **Backups**: Automated backup system
- ✅ **Updates**: Regular security updates

### Security Monitoring

- **Failed Login Attempts**: Monitored and rate limited
- **Suspicious Activity**: Alerted via email and Sentry
- **System Intrusions**: Fail2ban protection
- **Resource Abuse**: Rate limiting and monitoring

## 📞 Support

### Getting Help

- **Documentation**: Check this guide and inline code comments
- **Logs**: Review application and system logs
- **Monitoring**: Use the monitoring dashboard
- **Health Checks**: Regular health check endpoints

### Emergency Procedures

1. **Service Down**: Check health endpoints and restart services
2. **Database Issues**: Restore from latest backup
3. **Email Issues**: Check SMTP configuration and credentials
4. **Webhook Issues**: Review webhook processing logs

---

## 🎉 Production Ready!

Your FileBridge application is now production-ready with:

- ✅ **Email Integration**: Professional email templates and delivery
- ✅ **User Management**: Complete user account system
- ✅ **Production Configuration**: Optimized for performance and security
- ✅ **Monitoring**: Comprehensive health checks and alerting
- ✅ **Deployment**: Automated deployment and rollback scripts
- ✅ **Security**: Rate limiting, validation, and error handling
- ✅ **Backup**: Automated backup and recovery system

The system is designed for reliability, scalability, and maintainability in a production environment.