#!/bin/bash

# FileBridge Production Deployment Script
# This script handles the complete production deployment process

set -e  # Exit on any error

# Configuration
APP_NAME="filebridge"
PRODUCTION_ENV=".env.production"
BACKUP_DIR="/backups"
LOG_DIR="/var/log/filebridge"
DEPLOY_DIR="/opt/filebridge"
SERVICE_NAME="filebridge-api"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Check if running as root
check_root() {
    if [[ $EUID -eq 0 ]]; then
        error "This script should not be run as root for security reasons"
        exit 1
    fi
}

# Check prerequisites
check_prerequisites() {
    log "Checking prerequisites..."
    
    # Check if required commands exist
    local required_commands=("docker" "docker-compose" "git" "node" "npm" "psql")
    for cmd in "${required_commands[@]}"; do
        if ! command -v "$cmd" &> /dev/null; then
            error "Required command '$cmd' not found"
            exit 1
        fi
    done
    
    # Check if production environment file exists
    if [[ ! -f "$PRODUCTION_ENV" ]]; then
        error "Production environment file '$PRODUCTION_ENV' not found"
        error "Please copy env.production to .env.production and configure it"
        exit 1
    fi
    
    # Check if Docker is running
    if ! docker info &> /dev/null; then
        error "Docker is not running"
        exit 1
    fi
    
    success "Prerequisites check passed"
}

# Backup current deployment
backup_current() {
    log "Creating backup of current deployment..."
    
    local backup_timestamp=$(date +'%Y%m%d_%H%M%S')
    local backup_path="$BACKUP_DIR/backup_$backup_timestamp"
    
    mkdir -p "$backup_path"
    
    # Backup database
    if docker-compose ps db | grep -q "Up"; then
        log "Backing up database..."
        docker-compose exec -T db pg_dump -U filebridge_user filebridge_production > "$backup_path/database.sql"
        success "Database backup created: $backup_path/database.sql"
    fi
    
    # Backup application files
    if [[ -d "$DEPLOY_DIR" ]]; then
        log "Backing up application files..."
        cp -r "$DEPLOY_DIR" "$backup_path/app"
        success "Application backup created: $backup_path/app"
    fi
    
    # Backup environment files
    if [[ -f "$PRODUCTION_ENV" ]]; then
        cp "$PRODUCTION_ENV" "$backup_path/"
        success "Environment backup created: $backup_path/$PRODUCTION_ENV"
    fi
    
    # Keep only last 5 backups
    ls -t "$BACKUP_DIR"/backup_* | tail -n +6 | xargs -r rm -rf
    
    success "Backup completed: $backup_path"
}

# Pull latest code
pull_latest_code() {
    log "Pulling latest code from repository..."
    
    git fetch origin
    git checkout main
    git pull origin main
    
    # Get commit hash for tracking
    local commit_hash=$(git rev-parse HEAD)
    local commit_message=$(git log -1 --pretty=format:"%s")
    
    log "Deployed commit: $commit_hash"
    log "Commit message: $commit_message"
    
    success "Code updated successfully"
}

# Install dependencies
install_dependencies() {
    log "Installing dependencies..."
    
    # Install Node.js dependencies
    npm ci --production
    
    # Install Python dependencies if needed
    if [[ -f "requirements.txt" ]]; then
        pip install -r requirements.txt
    fi
    
    success "Dependencies installed"
}

# Build application
build_application() {
    log "Building application..."
    
    # Build Next.js application
    npm run build
    
    # Build Docker images
    docker-compose -f docker-compose.production.yml build
    
    success "Application built successfully"
}

# Run database migrations
run_migrations() {
    log "Running database migrations..."
    
    # Wait for database to be ready
    log "Waiting for database to be ready..."
    timeout 60 bash -c 'until docker-compose exec -T db pg_isready -U filebridge_user; do sleep 2; done'
    
    # Run Prisma migrations
    npx prisma migrate deploy
    
    # Generate Prisma client
    npx prisma generate
    
    success "Database migrations completed"
}

# Validate configuration
validate_configuration() {
    log "Validating production configuration..."
    
    # Check environment variables
    source "$PRODUCTION_ENV"
    
    local required_vars=(
        "DATABASE_URL"
        "JWT_SECRET"
        "DODO_API_KEY"
        "DODO_WEBHOOK_SECRET"
        "SMTP_HOST"
        "SMTP_USER"
        "SMTP_PASS"
    )
    
    for var in "${required_vars[@]}"; do
        if [[ -z "${!var}" ]]; then
            error "Required environment variable '$var' is not set"
            exit 1
        fi
    done
    
    # Validate database connection
    if ! docker-compose exec -T db psql -U filebridge_user -d filebridge_production -c "SELECT 1;" &> /dev/null; then
        error "Database connection validation failed"
        exit 1
    fi
    
    # Validate email configuration
    if ! nc -z "$SMTP_HOST" "$SMTP_PORT" 2>/dev/null; then
        warning "Cannot connect to SMTP server $SMTP_HOST:$SMTP_PORT"
    fi
    
    success "Configuration validation passed"
}

# Deploy application
deploy_application() {
    log "Deploying application..."
    
    # Stop existing services
    log "Stopping existing services..."
    docker-compose -f docker-compose.production.yml down
    
    # Start services
    log "Starting services..."
    docker-compose -f docker-compose.production.yml up -d
    
    # Wait for services to be ready
    log "Waiting for services to be ready..."
    sleep 30
    
    # Check if services are running
    if ! docker-compose -f docker-compose.production.yml ps | grep -q "Up"; then
        error "Services failed to start"
        docker-compose -f docker-compose.production.yml logs
        exit 1
    fi
    
    success "Application deployed successfully"
}

# Run health checks
run_health_checks() {
    log "Running health checks..."
    
    local max_attempts=30
    local attempt=1
    
    while [[ $attempt -le $max_attempts ]]; do
        log "Health check attempt $attempt/$max_attempts"
        
        if curl -f -s "http://localhost:3001/api/health" > /dev/null; then
            success "Health check passed"
            return 0
        fi
        
        sleep 10
        ((attempt++))
    done
    
    error "Health checks failed after $max_attempts attempts"
    return 1
}

# Setup monitoring
setup_monitoring() {
    log "Setting up monitoring..."
    
    # Create log directories
    mkdir -p "$LOG_DIR"
    
    # Setup log rotation
    cat > /etc/logrotate.d/filebridge << EOF
$LOG_DIR/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 644 filebridge filebridge
    postrotate
        docker-compose -f $DEPLOY_DIR/docker-compose.production.yml restart app
    endscript
}
EOF
    
    # Setup systemd service if not exists
    if [[ ! -f "/etc/systemd/system/$SERVICE_NAME.service" ]]; then
        cat > "/etc/systemd/system/$SERVICE_NAME.service" << EOF
[Unit]
Description=FileBridge API Service
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=$DEPLOY_DIR
ExecStart=/usr/bin/docker-compose -f docker-compose.production.yml up -d
ExecStop=/usr/bin/docker-compose -f docker-compose.production.yml down
TimeoutStartSec=0

[Install]
WantedBy=multi-user.target
EOF
        
        systemctl daemon-reload
        systemctl enable "$SERVICE_NAME"
    fi
    
    success "Monitoring setup completed"
}

# Send deployment notification
send_notification() {
    local status=$1
    local message=$2
    
    log "Sending deployment notification..."
    
    # Send email notification if configured
    if [[ -n "$DEPLOYMENT_NOTIFICATION_EMAIL" ]]; then
        local subject="FileBridge Deployment $status"
        local body="Deployment $status: $message\nTimestamp: $(date)\nCommit: $(git rev-parse HEAD)"
        
        echo -e "$body" | mail -s "$subject" "$DEPLOYMENT_NOTIFICATION_EMAIL" || true
    fi
    
    # Send webhook notification if configured
    if [[ -n "$DEPLOYMENT_WEBHOOK_URL" ]]; then
        curl -X POST "$DEPLOYMENT_WEBHOOK_URL" \
             -H "Content-Type: application/json" \
             -d "{\"status\":\"$status\",\"message\":\"$message\",\"timestamp\":\"$(date -Iseconds)\"}" || true
    fi
}

# Rollback function
rollback() {
    error "Deployment failed, initiating rollback..."
    
    # Get latest backup
    local latest_backup=$(ls -t "$BACKUP_DIR"/backup_* | head -n 1)
    
    if [[ -z "$latest_backup" ]]; then
        error "No backup found for rollback"
        exit 1
    fi
    
    log "Rolling back to: $latest_backup"
    
    # Stop current services
    docker-compose -f docker-compose.production.yml down
    
    # Restore application files
    if [[ -d "$latest_backup/app" ]]; then
        rm -rf "$DEPLOY_DIR"
        cp -r "$latest_backup/app" "$DEPLOY_DIR"
    fi
    
    # Restore environment
    if [[ -f "$latest_backup/$PRODUCTION_ENV" ]]; then
        cp "$latest_backup/$PRODUCTION_ENV" "$PRODUCTION_ENV"
    fi
    
    # Restore database
    if [[ -f "$latest_backup/database.sql" ]]; then
        docker-compose -f docker-compose.production.yml up -d db
        sleep 10
        docker-compose exec -T db psql -U filebridge_user -d filebridge_production < "$latest_backup/database.sql"
    fi
    
    # Start services
    docker-compose -f docker-compose.production.yml up -d
    
    success "Rollback completed"
    send_notification "ROLLBACK" "Deployment rolled back to $latest_backup"
}

# Main deployment function
main() {
    log "Starting FileBridge production deployment..."
    
    # Set up error handling
    trap 'rollback' ERR
    
    # Run deployment steps
    check_root
    check_prerequisites
    backup_current
    pull_latest_code
    install_dependencies
    build_application
    run_migrations
    validate_configuration
    deploy_application
    run_health_checks
    setup_monitoring
    
    # Clear error trap
    trap - ERR
    
    success "Production deployment completed successfully!"
    send_notification "SUCCESS" "Deployment completed successfully"
    
    # Display deployment info
    log "Deployment Information:"
    log "  - Application URL: https://app.filebridge.com"
    log "  - API URL: https://api.filebridge.com"
    log "  - Health Check: https://api.filebridge.com/api/health"
    log "  - Monitoring: https://api.filebridge.com/api/monitoring/dashboard"
    log "  - Commit: $(git rev-parse HEAD)"
    log "  - Timestamp: $(date)"
}

# Handle command line arguments
case "${1:-}" in
    "rollback")
        rollback
        ;;
    "health")
        run_health_checks
        ;;
    "backup")
        backup_current
        ;;
    *)
        main
        ;;
esac
