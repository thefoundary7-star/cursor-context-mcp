# Deployment Guide

This guide covers deploying the MCP Server SaaS Backend to various platforms and environments.

## Prerequisites

- Node.js 18+ installed
- PostgreSQL 12+ database
- Redis (optional, for caching)
- Stripe account configured
- Domain name (for production)

## Environment Setup

### 1. Environment Variables

Create a `.env` file with the following variables:

```env
# Database
DATABASE_URL="postgresql://username:password@host:port/database"

# JWT Configuration
JWT_SECRET="your-super-secret-jwt-key-here"
JWT_REFRESH_SECRET="your-super-secret-refresh-key-here"
JWT_EXPIRES_IN="15m"
JWT_REFRESH_EXPIRES_IN="7d"

# Stripe Configuration
STRIPE_SECRET_KEY="sk_live_..."
STRIPE_PUBLISHABLE_KEY="pk_live_..."
STRIPE_WEBHOOK_SECRET="whsec_..."

# Server Configuration
PORT=3000
NODE_ENV="production"
API_BASE_URL="https://yourdomain.com"

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# CORS
CORS_ORIGIN="https://yourdomain.com,https://app.yourdomain.com"

# Logging
LOG_LEVEL="info"
LOG_FILE="logs/app.log"

# Security
BCRYPT_ROUNDS=12
SESSION_SECRET="your-session-secret-here"

# Analytics
ANALYTICS_RETENTION_DAYS=90
QUOTA_CHECK_INTERVAL_MINUTES=5

# Redis (Optional)
REDIS_URL="redis://localhost:6379"
```

### 2. Database Setup

#### PostgreSQL Setup

1. **Install PostgreSQL**
   ```bash
   # Ubuntu/Debian
   sudo apt-get install postgresql postgresql-contrib
   
   # macOS
   brew install postgresql
   
   # Windows
   # Download from https://www.postgresql.org/download/windows/
   ```

2. **Create Database**
   ```sql
   CREATE DATABASE mcp_saas_db;
   CREATE USER mcp_user WITH PASSWORD 'secure_password';
   GRANT ALL PRIVILEGES ON DATABASE mcp_saas_db TO mcp_user;
   ```

3. **Run Migrations**
   ```bash
   npm run db:generate
   npm run db:push
   npm run db:seed
   ```

#### Redis Setup (Optional)

1. **Install Redis**
   ```bash
   # Ubuntu/Debian
   sudo apt-get install redis-server
   
   # macOS
   brew install redis
   
   # Windows
   # Download from https://github.com/microsoftarchive/redis/releases
   ```

2. **Start Redis**
   ```bash
   redis-server
   ```

### 3. Stripe Configuration

1. **Create Stripe Account**
   - Sign up at https://stripe.com
   - Complete account verification

2. **Create Products and Prices**
   ```bash
   # Create products and prices in Stripe Dashboard
   # Or use Stripe CLI
   stripe products create --name "MCP SaaS Basic" --description "Basic plan"
   stripe prices create --product prod_xxx --unit-amount 2900 --currency usd --recurring interval=month
   ```

3. **Configure Webhooks**
   - Add webhook endpoint: `https://yourdomain.com/api/webhooks/stripe`
   - Select events: `customer.subscription.*`, `invoice.*`
   - Copy webhook secret to `STRIPE_WEBHOOK_SECRET`

## Deployment Options

### 1. Docker Deployment

#### Dockerfile
```dockerfile
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build application
RUN npm run build

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# Change ownership
RUN chown -R nodejs:nodejs /app
USER nodejs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

# Start application
CMD ["npm", "start"]
```

#### Docker Compose
```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://mcp_user:password@db:5432/mcp_saas_db
      - REDIS_URL=redis://redis:6379
    depends_on:
      - db
      - redis
    restart: unless-stopped

  db:
    image: postgres:15
    environment:
      - POSTGRES_DB=mcp_saas_db
      - POSTGRES_USER=mcp_user
      - POSTGRES_PASSWORD=secure_password
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    restart: unless-stopped

volumes:
  postgres_data:
```

#### Deploy with Docker
```bash
# Build and run
docker-compose up -d

# View logs
docker-compose logs -f app

# Scale application
docker-compose up -d --scale app=3
```

### 2. Kubernetes Deployment

#### Namespace
```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: mcp-saas
```

#### ConfigMap
```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: mcp-saas-config
  namespace: mcp-saas
data:
  NODE_ENV: "production"
  PORT: "3000"
  LOG_LEVEL: "info"
```

#### Secret
```yaml
apiVersion: v1
kind: Secret
metadata:
  name: mcp-saas-secrets
  namespace: mcp-saas
type: Opaque
data:
  DATABASE_URL: <base64-encoded-database-url>
  JWT_SECRET: <base64-encoded-jwt-secret>
  STRIPE_SECRET_KEY: <base64-encoded-stripe-secret>
```

#### Deployment
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: mcp-saas-backend
  namespace: mcp-saas
spec:
  replicas: 3
  selector:
    matchLabels:
      app: mcp-saas-backend
  template:
    metadata:
      labels:
        app: mcp-saas-backend
    spec:
      containers:
      - name: app
        image: your-registry/mcp-saas-backend:latest
        ports:
        - containerPort: 3000
        env:
        - name: NODE_ENV
          valueFrom:
            configMapKeyRef:
              name: mcp-saas-config
              key: NODE_ENV
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: mcp-saas-secrets
              key: DATABASE_URL
        livenessProbe:
          httpGet:
            path: /api/health/live
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /api/health/ready
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
```

#### Service
```yaml
apiVersion: v1
kind: Service
metadata:
  name: mcp-saas-backend-service
  namespace: mcp-saas
spec:
  selector:
    app: mcp-saas-backend
  ports:
  - protocol: TCP
    port: 80
    targetPort: 3000
  type: ClusterIP
```

#### Ingress
```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: mcp-saas-backend-ingress
  namespace: mcp-saas
  annotations:
    kubernetes.io/ingress.class: nginx
    cert-manager.io/cluster-issuer: letsencrypt-prod
spec:
  tls:
  - hosts:
    - api.yourdomain.com
    secretName: mcp-saas-tls
  rules:
  - host: api.yourdomain.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: mcp-saas-backend-service
            port:
              number: 80
```

### 3. Cloud Platform Deployment

#### AWS ECS

1. **Create ECS Cluster**
   ```bash
   aws ecs create-cluster --cluster-name mcp-saas
   ```

2. **Create Task Definition**
   ```json
   {
     "family": "mcp-saas-backend",
     "networkMode": "awsvpc",
     "requiresCompatibilities": ["FARGATE"],
     "cpu": "512",
     "memory": "1024",
     "executionRoleArn": "arn:aws:iam::account:role/ecsTaskExecutionRole",
     "containerDefinitions": [
       {
         "name": "mcp-saas-backend",
         "image": "your-account.dkr.ecr.region.amazonaws.com/mcp-saas-backend:latest",
         "portMappings": [
           {
             "containerPort": 3000,
             "protocol": "tcp"
           }
         ],
         "environment": [
           {
             "name": "NODE_ENV",
             "value": "production"
           }
         ],
         "secrets": [
           {
             "name": "DATABASE_URL",
             "valueFrom": "arn:aws:secretsmanager:region:account:secret:mcp-saas/database-url"
           }
         ],
         "logConfiguration": {
           "logDriver": "awslogs",
           "options": {
             "awslogs-group": "/ecs/mcp-saas-backend",
             "awslogs-region": "us-east-1",
             "awslogs-stream-prefix": "ecs"
           }
         }
       }
     ]
   }
   ```

3. **Create Service**
   ```bash
   aws ecs create-service \
     --cluster mcp-saas \
     --service-name mcp-saas-backend \
     --task-definition mcp-saas-backend:1 \
     --desired-count 3 \
     --launch-type FARGATE \
     --network-configuration "awsvpcConfiguration={subnets=[subnet-12345],securityGroups=[sg-12345],assignPublicIp=ENABLED}"
   ```

#### Google Cloud Run

1. **Build and Deploy**
   ```bash
   # Build container
   gcloud builds submit --tag gcr.io/PROJECT-ID/mcp-saas-backend
   
   # Deploy to Cloud Run
   gcloud run deploy mcp-saas-backend \
     --image gcr.io/PROJECT-ID/mcp-saas-backend \
     --platform managed \
     --region us-central1 \
     --allow-unauthenticated \
     --set-env-vars NODE_ENV=production \
     --set-secrets DATABASE_URL=database-url:latest
   ```

#### Heroku

1. **Create Heroku App**
   ```bash
   heroku create mcp-saas-backend
   ```

2. **Set Environment Variables**
   ```bash
   heroku config:set NODE_ENV=production
   heroku config:set DATABASE_URL=postgresql://...
   heroku config:set JWT_SECRET=your-secret
   ```

3. **Deploy**
   ```bash
   git push heroku main
   ```

4. **Run Migrations**
   ```bash
   heroku run npm run db:push
   heroku run npm run db:seed
   ```

### 4. Traditional VPS Deployment

#### Using PM2

1. **Install PM2**
   ```bash
   npm install -g pm2
   ```

2. **Create PM2 Configuration**
   ```json
   {
     "apps": [
       {
         "name": "mcp-saas-backend",
         "script": "dist/server.js",
         "instances": "max",
         "exec_mode": "cluster",
         "env": {
           "NODE_ENV": "production",
           "PORT": 3000
         },
         "env_production": {
           "NODE_ENV": "production",
           "PORT": 3000
         },
         "log_file": "logs/combined.log",
         "out_file": "logs/out.log",
         "error_file": "logs/error.log",
         "log_date_format": "YYYY-MM-DD HH:mm:ss Z"
       }
     ]
   }
   ```

3. **Deploy**
   ```bash
   # Build application
   npm run build
   
   # Start with PM2
   pm2 start ecosystem.config.js --env production
   
   # Save PM2 configuration
   pm2 save
   pm2 startup
   ```

#### Using Nginx

1. **Install Nginx**
   ```bash
   sudo apt-get install nginx
   ```

2. **Configure Nginx**
   ```nginx
   server {
       listen 80;
       server_name api.yourdomain.com;
       
       location / {
           proxy_pass http://localhost:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```

3. **Enable SSL with Let's Encrypt**
   ```bash
   sudo apt-get install certbot python3-certbot-nginx
   sudo certbot --nginx -d api.yourdomain.com
   ```

## Monitoring and Logging

### 1. Application Monitoring

#### Health Checks
- Basic health: `GET /api/health`
- Readiness: `GET /api/health/ready`
- Liveness: `GET /api/health/live`

#### Logging
- Application logs: `logs/app.log`
- Error logs: `logs/error.log`
- Combined logs: `logs/combined.log`

### 2. Database Monitoring

#### PostgreSQL Monitoring
```sql
-- Check active connections
SELECT count(*) FROM pg_stat_activity;

-- Check database size
SELECT pg_size_pretty(pg_database_size('mcp_saas_db'));

-- Check slow queries
SELECT query, mean_time, calls 
FROM pg_stat_statements 
ORDER BY mean_time DESC 
LIMIT 10;
```

### 3. Performance Monitoring

#### Key Metrics
- Response time
- Request rate
- Error rate
- Database connection pool
- Memory usage
- CPU usage

#### Tools
- **Prometheus + Grafana** for metrics
- **ELK Stack** for log aggregation
- **New Relic** or **DataDog** for APM

## Security Considerations

### 1. Network Security
- Use HTTPS in production
- Configure firewall rules
- Use VPC for cloud deployments
- Implement rate limiting

### 2. Application Security
- Keep dependencies updated
- Use security headers
- Validate all inputs
- Implement proper authentication

### 3. Database Security
- Use connection pooling
- Encrypt data at rest
- Regular backups
- Access control

## Backup and Recovery

### 1. Database Backups
```bash
# Create backup
pg_dump mcp_saas_db > backup_$(date +%Y%m%d_%H%M%S).sql

# Restore backup
psql mcp_saas_db < backup_20240101_120000.sql
```

### 2. Automated Backups
```bash
#!/bin/bash
# backup.sh
DATE=$(date +%Y%m%d_%H%M%S)
pg_dump mcp_saas_db | gzip > /backups/backup_$DATE.sql.gz
find /backups -name "backup_*.sql.gz" -mtime +7 -delete
```

### 3. Disaster Recovery
- Regular database backups
- Application code in version control
- Environment configuration documented
- Recovery procedures tested

## Scaling Considerations

### 1. Horizontal Scaling
- Load balancer configuration
- Session management
- Database connection pooling
- Stateless application design

### 2. Vertical Scaling
- Monitor resource usage
- Optimize database queries
- Implement caching
- Use CDN for static assets

### 3. Database Scaling
- Read replicas for read-heavy workloads
- Connection pooling
- Query optimization
- Index optimization

## Troubleshooting

### Common Issues

1. **Database Connection Issues**
   - Check connection string
   - Verify database is running
   - Check firewall rules

2. **Memory Issues**
   - Monitor memory usage
   - Implement garbage collection
   - Use connection pooling

3. **Performance Issues**
   - Check database queries
   - Monitor response times
   - Implement caching

### Debug Commands
```bash
# Check application status
pm2 status

# View logs
pm2 logs mcp-saas-backend

# Monitor resources
htop
iostat -x 1

# Check database connections
psql -c "SELECT * FROM pg_stat_activity;"
```

## Maintenance

### Regular Tasks
- Update dependencies
- Monitor logs
- Check disk space
- Review security updates
- Test backups
- Monitor performance metrics

### Updates
1. Test in staging environment
2. Create database backup
3. Deploy new version
4. Run migrations
5. Verify functionality
6. Monitor for issues
