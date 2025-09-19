# MCP SaaS Platform - Quick Deployment Guide

This guide provides a quick start for deploying the MCP SaaS Platform to production.

## 🚀 Quick Start

### 1. Prerequisites

- Docker & Docker Compose installed
- Domain name configured
- SSL certificate (Let's Encrypt recommended)

### 2. Clone and Configure

```bash
# Clone repository
git clone https://github.com/your-org/mcp-saas-platform.git
cd mcp-saas-platform

# Copy environment configuration
cp env.production .env

# Edit configuration with your values
nano .env
```

### 3. Deploy

```bash
# Validate configuration
./scripts/validate-config.sh production

# Generate SSL certificate
./scripts/generate-ssl-cert.sh your-domain.com admin@your-domain.com letsencrypt generate

# Deploy application
./scripts/deploy.sh production deploy latest

# Verify deployment
curl -f https://your-domain.com/api/health
```

## 📋 Configuration Checklist

### Required Environment Variables

- [ ] `DATABASE_URL` - PostgreSQL connection string
- [ ] `JWT_SECRET` - 32+ character secret key
- [ ] `ENCRYPTION_KEY` - 32+ character encryption key
- [ ] `STRIPE_SECRET_KEY` - Stripe secret key
- [ ] `STRIPE_PUBLISHABLE_KEY` - Stripe publishable key
- [ ] `STRIPE_WEBHOOK_SECRET` - Stripe webhook secret
- [ ] `SENDGRID_API_KEY` - SendGrid API key
- [ ] `SESSION_SECRET` - Session secret key

### Security Checklist

- [ ] SSL certificate installed and valid
- [ ] Environment variables configured (no placeholders)
- [ ] Database password changed from default
- [ ] Firewall configured (ports 80, 443 only)
- [ ] Security audit passed

### Monitoring Checklist

- [ ] Prometheus metrics enabled
- [ ] Grafana dashboard accessible
- [ ] Log aggregation configured
- [ ] Health checks passing
- [ ] Backup system configured

## 🛠️ Available Scripts

### Deployment Scripts

```bash
# Deploy to production
./scripts/deploy.sh production deploy latest

# Rollback deployment
./scripts/deploy.sh production rollback

# Check deployment status
./scripts/deploy.sh production status

# View logs
./scripts/deploy.sh production logs api
```

### Database Scripts

```bash
# Run migrations
./scripts/db-migrate.sh migrate

# Create backup
./scripts/backup-db.sh full

# Restore from backup
./scripts/backup-db.sh restore backup_file.sql
```

### Security Scripts

```bash
# Run security audit
./scripts/security-audit.sh full

# Generate SSL certificate
./scripts/generate-ssl-cert.sh domain.com email@domain.com letsencrypt generate

# Validate configuration
./scripts/validate-config.sh production
```

### Monitoring Scripts

```bash
# Check system health
curl https://your-domain.com/api/health

# View application metrics
curl https://your-domain.com/metrics

# Access Grafana dashboard
open https://monitoring.your-domain.com/grafana/
```

## 🔧 Common Commands

### Docker Management

```bash
# Start all services
docker-compose -f docker-compose.production.yml up -d

# Stop all services
docker-compose -f docker-compose.production.yml down

# View logs
docker-compose -f docker-compose.production.yml logs -f

# Scale services
docker-compose -f docker-compose.production.yml up -d --scale api=3
```

### Database Management

```bash
# Connect to database
docker-compose -f docker-compose.production.yml exec postgres psql -U mcp_user -d mcp_saas_production

# Run migrations
docker-compose -f docker-compose.production.yml exec api npx prisma migrate deploy

# Seed database
docker-compose -f docker-compose.production.yml exec api npx prisma db seed
```

### Log Management

```bash
# View application logs
docker-compose -f docker-compose.production.yml logs -f api

# View nginx logs
docker-compose -f docker-compose.production.yml logs -f nginx

# View database logs
docker-compose -f docker-compose.production.yml logs -f postgres
```

## 🚨 Troubleshooting

### Application Issues

```bash
# Check service status
docker-compose -f docker-compose.production.yml ps

# Restart services
docker-compose -f docker-compose.production.yml restart

# Check configuration
./scripts/validate-config.sh production
```

### Database Issues

```bash
# Check database connection
docker-compose -f docker-compose.production.yml exec postgres pg_isready

# Check database logs
docker-compose -f docker-compose.production.yml logs postgres

# Run database health check
docker-compose -f docker-compose.production.yml exec api npx prisma db pull
```

### SSL Issues

```bash
# Check certificate validity
openssl x509 -in nginx/ssl/your-domain.com.crt -text -noout

# Renew certificate
./scripts/generate-ssl-cert.sh your-domain.com admin@your-domain.com letsencrypt renew

# Test SSL connection
openssl s_client -connect your-domain.com:443 -servername your-domain.com
```

## 📊 Monitoring

### Health Checks

- **Application**: `https://your-domain.com/api/health`
- **Database**: `https://your-domain.com/api/health/detailed`
- **Metrics**: `https://your-domain.com/metrics`

### Dashboards

- **Grafana**: `https://monitoring.your-domain.com/grafana/`
- **Prometheus**: `https://monitoring.your-domain.com/prometheus/`

### Alerts

Configure alerts for:
- High error rates (>5%)
- High response times (>2s)
- Low disk space (<10%)
- High memory usage (>90%)
- Database connection failures

## 🔒 Security

### Regular Security Tasks

```bash
# Weekly security audit
./scripts/security-audit.sh full

# Update dependencies
npm audit fix

# Update Docker images
docker-compose -f docker-compose.production.yml pull

# Check SSL certificate expiry
./scripts/generate-ssl-cert.sh your-domain.com admin@your-domain.com letsencrypt verify
```

### Security Best Practices

- Use strong passwords (32+ characters)
- Enable 2FA for all accounts
- Regular security updates
- Monitor access logs
- Implement rate limiting
- Use HTTPS everywhere
- Regular backups

## 📈 Performance

### Optimization Tips

- Enable Redis caching
- Use CDN for static assets
- Optimize database queries
- Implement connection pooling
- Monitor resource usage
- Scale services as needed

### Scaling

```bash
# Scale API service
docker-compose -f docker-compose.production.yml up -d --scale api=3

# Scale frontend service
docker-compose -f docker-compose.production.yml up -d --scale frontend=2

# Scale database (requires external database)
# Update DATABASE_URL in .env
```

## 📞 Support

### Getting Help

1. Check this guide first
2. Review application logs
3. Run diagnostic scripts
4. Contact support team

### Emergency Procedures

1. **Service Down**: Check logs and restart services
2. **Database Issues**: Restore from backup
3. **SSL Issues**: Renew certificate
4. **Security Breach**: Follow incident response plan

### Contact Information

- **Technical Support**: support@your-domain.com
- **Emergency Hotline**: +1-XXX-XXX-XXXX
- **Documentation**: https://docs.your-domain.com

---

**Quick Reference**: Keep this guide handy for common deployment tasks and troubleshooting steps.
