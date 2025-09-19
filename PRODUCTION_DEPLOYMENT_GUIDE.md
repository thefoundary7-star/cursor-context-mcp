# MCP SaaS Platform - Production Deployment Guide

This comprehensive guide covers the complete production deployment setup for the MCP SaaS Platform, including Docker configuration, database setup, monitoring, security, and maintenance procedures.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Infrastructure Setup](#infrastructure-setup)
3. [Environment Configuration](#environment-configuration)
4. [Database Setup](#database-setup)
5. [SSL/TLS Configuration](#ssltls-configuration)
6. [Docker Deployment](#docker-deployment)
7. [Monitoring & Logging](#monitoring--logging)
8. [Security Configuration](#security-configuration)
9. [CI/CD Pipeline](#cicd-pipeline)
10. [Backup & Recovery](#backup--recovery)
11. [Maintenance & Updates](#maintenance--updates)
12. [Troubleshooting](#troubleshooting)
13. [Performance Optimization](#performance-optimization)

## Prerequisites

### System Requirements

- **Operating System**: Ubuntu 20.04 LTS or later, CentOS 8+, or RHEL 8+
- **CPU**: 4+ cores (8+ recommended for production)
- **RAM**: 8GB minimum (16GB+ recommended)
- **Storage**: 100GB+ SSD storage
- **Network**: Stable internet connection with static IP

### Software Requirements

- Docker 20.10+
- Docker Compose 2.0+
- Node.js 18+ (for development)
- Git
- OpenSSL
- Certbot (for Let's Encrypt certificates)

### Domain & DNS

- Registered domain name
- DNS A records pointing to your server
- SSL certificate (Let's Encrypt recommended)

## Infrastructure Setup

### 1. Server Preparation

```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Install required packages
sudo apt install -y curl wget git nginx certbot python3-certbot-nginx

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

### 2. Firewall Configuration

```bash
# Configure UFW firewall
sudo ufw enable
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 22/tcp
```

### 3. Create Application User

```bash
# Create dedicated user for the application
sudo useradd -m -s /bin/bash mcpsaas
sudo usermod -aG docker mcpsaas
sudo su - mcpsaas
```

## Environment Configuration

### 1. Clone Repository

```bash
git clone https://github.com/your-org/mcp-saas-platform.git
cd mcp-saas-platform
```

### 2. Environment Variables

Copy the production environment template:

```bash
cp env.production .env
```

Edit `.env` with your production values:

```bash
# Application Configuration
NODE_ENV=production
PORT=3001
HOST=0.0.0.0

# Database Configuration
DATABASE_URL=postgresql://mcp_user:your_secure_password@postgres:5432/mcp_saas_production?schema=public
DATABASE_POOL_SIZE=20

# Redis Configuration
REDIS_URL=redis://:your_redis_password@redis:6379

# JWT Configuration
JWT_SECRET=your_super_secure_jwt_secret_key_here_minimum_32_characters
JWT_EXPIRES_IN=7d

# Encryption Configuration
ENCRYPTION_KEY=your_32_character_encryption_key_here

# Stripe Configuration
STRIPE_SECRET_KEY=sk_live_your_stripe_secret_key_here
STRIPE_PUBLISHABLE_KEY=pk_live_your_stripe_publishable_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_stripe_webhook_secret_here

# Email Configuration
SENDGRID_API_KEY=your_sendgrid_api_key_here
FROM_EMAIL=noreply@your-domain.com

# Security Configuration
SESSION_SECRET=your_session_secret_here
COOKIE_SECURE=true

# Backup Configuration
BACKUP_S3_BUCKET=your-backup-bucket
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
```

### 3. Validate Configuration

```bash
./scripts/validate-config.sh production
```

## Database Setup

### 1. PostgreSQL Configuration

Create optimized PostgreSQL configuration:

```bash
mkdir -p postgres
cat > postgres/postgresql.conf << EOF
# PostgreSQL configuration for production
listen_addresses = '*'
port = 5432
max_connections = 200
shared_buffers = 256MB
effective_cache_size = 1GB
maintenance_work_mem = 64MB
checkpoint_completion_target = 0.9
wal_buffers = 16MB
default_statistics_target = 100
random_page_cost = 1.1
effective_io_concurrency = 200
work_mem = 4MB
min_wal_size = 1GB
max_wal_size = 4GB
max_worker_processes = 8
max_parallel_workers_per_gather = 4
max_parallel_workers = 8
max_parallel_maintenance_workers = 4
EOF
```

### 2. Run Database Migrations

```bash
# Start database services
docker-compose -f docker-compose.production.yml up -d postgres redis

# Wait for database to be ready
sleep 30

# Run migrations
./scripts/db-migrate.sh migrate

# Seed database (optional)
./scripts/db-migrate.sh seed
```

## SSL/TLS Configuration

### 1. Generate SSL Certificate

For Let's Encrypt (recommended):

```bash
./scripts/generate-ssl-cert.sh your-domain.com admin@your-domain.com letsencrypt generate
```

For self-signed (development only):

```bash
./scripts/generate-ssl-cert.sh your-domain.com admin@your-domain.com self-signed generate
```

### 2. Verify SSL Configuration

```bash
./scripts/generate-ssl-cert.sh your-domain.com admin@your-domain.com letsencrypt verify
```

## Docker Deployment

### 1. Build and Deploy

```bash
# Build production images
docker-compose -f docker-compose.production.yml build

# Deploy all services
docker-compose -f docker-compose.production.yml up -d

# Check service status
docker-compose -f docker-compose.production.yml ps
```

### 2. Verify Deployment

```bash
# Check application health
curl -f https://your-domain.com/api/health

# Check logs
docker-compose -f docker-compose.production.yml logs -f
```

### 3. Scale Services (Optional)

```bash
# Scale API service
docker-compose -f docker-compose.production.yml up -d --scale api=3

# Scale frontend service
docker-compose -f docker-compose.production.yml up -d --scale frontend=2
```

## Monitoring & Logging

### 1. Access Monitoring Dashboards

- **Grafana**: https://monitoring.your-domain.com/grafana/
- **Prometheus**: https://monitoring.your-domain.com/prometheus/

Default Grafana credentials:
- Username: `admin`
- Password: `admin` (change on first login)

### 2. Log Management

```bash
# View application logs
docker-compose -f docker-compose.production.yml logs -f api

# View nginx logs
docker-compose -f docker-compose.production.yml logs -f nginx

# View database logs
docker-compose -f docker-compose.production.yml logs -f postgres
```

### 3. Set Up Alerts

Configure alerting rules in Prometheus for:
- High error rates
- High response times
- Low disk space
- High memory usage
- Database connection issues

## Security Configuration

### 1. Run Security Audit

```bash
# Full security audit
./scripts/security-audit.sh full

# Specific security checks
./scripts/security-audit.sh ssl
./scripts/security-audit.sh env
./scripts/security-audit.sh docker
```

### 2. Configure Firewall Rules

```bash
# Allow only necessary ports
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw deny 5432/tcp   # PostgreSQL (internal only)
sudo ufw deny 6379/tcp   # Redis (internal only)
```

### 3. Regular Security Updates

```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Update Docker images
docker-compose -f docker-compose.production.yml pull
docker-compose -f docker-compose.production.yml up -d
```

## CI/CD Pipeline

### 1. GitHub Actions Setup

The CI/CD pipeline is configured in `.github/workflows/ci-cd.yml` and includes:

- Automated testing
- Security scanning
- Docker image building
- Deployment to staging/production
- Database migrations
- Health checks

### 2. Environment Secrets

Configure the following secrets in GitHub:

- `DATABASE_URL`
- `JWT_SECRET`
- `STRIPE_SECRET_KEY`
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `SLACK_WEBHOOK` (for notifications)

### 3. Deployment Process

```bash
# Manual deployment
./scripts/deploy.sh production deploy latest

# Rollback deployment
./scripts/deploy.sh production rollback

# Check deployment status
./scripts/deploy.sh production status
```

## Backup & Recovery

### 1. Automated Backups

```bash
# Create full backup
./scripts/backup-db.sh full

# Upload to S3
./scripts/backup-s3.sh backup

# Schedule automated backups (crontab)
0 2 * * * /path/to/scripts/backup-s3.sh backup
```

### 2. Backup Verification

```bash
# List available backups
./scripts/backup-s3.sh list

# Verify backup integrity
./scripts/backup-s3.sh verify backup_20231201_120000.sql
```

### 3. Disaster Recovery

```bash
# Restore from backup
./scripts/backup-s3.sh restore backup_20231201_120000.sql

# Verify restoration
./scripts/db-migrate.sh status
```

## Maintenance & Updates

### 1. Regular Maintenance Tasks

```bash
# Weekly maintenance script
#!/bin/bash
./scripts/security-audit.sh full
./scripts/backup-s3.sh backup
docker system prune -f
docker image prune -f
```

### 2. Application Updates

```bash
# Pull latest changes
git pull origin main

# Update dependencies
npm update

# Rebuild and deploy
docker-compose -f docker-compose.production.yml build
docker-compose -f docker-compose.production.yml up -d
```

### 3. Database Maintenance

```bash
# Run database maintenance
./scripts/db-migrate.sh migrate

# Clean up old analytics data
psql $DATABASE_URL -c "SELECT cleanup_old_analytics();"
```

## Troubleshooting

### Common Issues

#### 1. Application Won't Start

```bash
# Check logs
docker-compose -f docker-compose.production.yml logs api

# Check configuration
./scripts/validate-config.sh production

# Restart services
docker-compose -f docker-compose.production.yml restart
```

#### 2. Database Connection Issues

```bash
# Check database status
docker-compose -f docker-compose.production.yml ps postgres

# Test connection
docker-compose -f docker-compose.production.yml exec postgres pg_isready

# Check database logs
docker-compose -f docker-compose.production.yml logs postgres
```

#### 3. SSL Certificate Issues

```bash
# Check certificate validity
openssl x509 -in nginx/ssl/your-domain.com.crt -text -noout

# Renew certificate
./scripts/generate-ssl-cert.sh your-domain.com admin@your-domain.com letsencrypt renew
```

#### 4. High Memory Usage

```bash
# Check memory usage
docker stats

# Restart services
docker-compose -f docker-compose.production.yml restart

# Scale services
docker-compose -f docker-compose.production.yml up -d --scale api=2
```

### Performance Issues

#### 1. Slow Database Queries

```bash
# Check slow queries
docker-compose -f docker-compose.production.yml exec postgres psql -c "SELECT * FROM pg_stat_statements ORDER BY total_time DESC LIMIT 10;"

# Analyze database
docker-compose -f docker-compose.production.yml exec postgres psql -c "ANALYZE;"
```

#### 2. High API Response Times

```bash
# Check API metrics
curl https://your-domain.com/api/health

# Check nginx logs
docker-compose -f docker-compose.production.yml logs nginx | grep "rt="

# Scale API services
docker-compose -f docker-compose.production.yml up -d --scale api=3
```

## Performance Optimization

### 1. Database Optimization

- Enable connection pooling
- Optimize queries with proper indexing
- Regular VACUUM and ANALYZE
- Monitor slow queries

### 2. Application Optimization

- Enable Redis caching
- Implement API rate limiting
- Use CDN for static assets
- Optimize Docker images

### 3. Infrastructure Optimization

- Use SSD storage
- Implement load balancing
- Configure auto-scaling
- Monitor resource usage

## Support & Documentation

### Additional Resources

- [API Documentation](./API_DOCUMENTATION.md)
- [Security Guide](./SECURITY_GUIDE.md)
- [Monitoring Guide](./MONITORING_GUIDE.md)
- [Backup Guide](./BACKUP_GUIDE.md)

### Getting Help

1. Check the troubleshooting section above
2. Review application logs
3. Run security and configuration audits
4. Contact the development team

### Emergency Contacts

- **On-call Engineer**: +1-XXX-XXX-XXXX
- **DevOps Team**: devops@your-domain.com
- **Security Team**: security@your-domain.com

---

**Last Updated**: December 2024
**Version**: 1.0.0
**Maintained by**: MCP SaaS Platform Team
