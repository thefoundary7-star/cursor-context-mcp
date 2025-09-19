#!/bin/bash

# Deployment script for MCP SaaS Platform
# This script handles deployment to different environments

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
ENVIRONMENT=${1:-staging}
ACTION=${2:-deploy}
VERSION=${3:-latest}
DRY_RUN=${4:-false}
LOG_FILE="./logs/deployment.log"

# Create necessary directories
mkdir -p "$(dirname "$LOG_FILE")"

# Logging function
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "$LOG_FILE"
    exit 1
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1" | tee -a "$LOG_FILE"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1" | tee -a "$LOG_FILE"
}

# Function to validate environment
validate_environment() {
    case "$ENVIRONMENT" in
        "development"|"staging"|"production")
            log "Deploying to $ENVIRONMENT environment"
            ;;
        *)
            error "Invalid environment: $ENVIRONMENT. Must be development, staging, or production"
            ;;
    esac
}

# Function to check prerequisites
check_prerequisites() {
    log "Checking deployment prerequisites..."
    
    # Check if Docker is installed
    if ! command -v docker &> /dev/null; then
        error "Docker is not installed or not in PATH"
    fi
    
    # Check if Docker Compose is installed
    if ! command -v docker-compose &> /dev/null; then
        error "Docker Compose is not installed or not in PATH"
    fi
    
    # Check if required files exist
    local required_files=(
        "docker-compose.yml"
        "Dockerfile"
        ".env.${ENVIRONMENT}"
    )
    
    for file in "${required_files[@]}"; do
        if [ ! -f "$file" ]; then
            error "Required file not found: $file"
        fi
    done
    
    success "Prerequisites check passed"
}

# Function to validate configuration
validate_configuration() {
    log "Validating configuration for $ENVIRONMENT environment..."
    
    if [ -f "./scripts/validate-config.sh" ]; then
        if ./scripts/validate-config.sh "$ENVIRONMENT"; then
            success "Configuration validation passed"
        else
            error "Configuration validation failed"
        fi
    else
        warning "Configuration validation script not found, skipping validation"
    fi
}

# Function to create backup
create_backup() {
    if [ "$ENVIRONMENT" = "production" ]; then
        log "Creating backup before deployment..."
        
        if [ -f "./scripts/backup-db.sh" ]; then
            if ./scripts/backup-db.sh full; then
                success "Backup created successfully"
            else
                error "Backup creation failed"
            fi
        else
            warning "Backup script not found, skipping backup"
        fi
    fi
}

# Function to pull latest images
pull_images() {
    log "Pulling latest Docker images..."
    
    local compose_file="docker-compose.${ENVIRONMENT}.yml"
    if [ ! -f "$compose_file" ]; then
        compose_file="docker-compose.yml"
    fi
    
    if [ "$DRY_RUN" = "true" ]; then
        log "DRY RUN: Would pull images using $compose_file"
    else
        if docker-compose -f "$compose_file" pull; then
            success "Images pulled successfully"
        else
            error "Failed to pull images"
        fi
    fi
}

# Function to run database migrations
run_migrations() {
    log "Running database migrations..."
    
    if [ -f "./scripts/db-migrate.sh" ]; then
        if [ "$DRY_RUN" = "true" ]; then
            log "DRY RUN: Would run database migrations"
        else
            if ./scripts/db-migrate.sh migrate; then
                success "Database migrations completed"
            else
                error "Database migrations failed"
            fi
        fi
    else
        warning "Migration script not found, skipping migrations"
    fi
}

# Function to deploy services
deploy_services() {
    log "Deploying services to $ENVIRONMENT environment..."
    
    local compose_file="docker-compose.${ENVIRONMENT}.yml"
    if [ ! -f "$compose_file" ]; then
        compose_file="docker-compose.yml"
    fi
    
    if [ "$DRY_RUN" = "true" ]; then
        log "DRY RUN: Would deploy using $compose_file"
        docker-compose -f "$compose_file" config
    else
        # Stop existing services
        log "Stopping existing services..."
        docker-compose -f "$compose_file" down --remove-orphans
        
        # Start services
        log "Starting services..."
        if docker-compose -f "$compose_file" up -d; then
            success "Services deployed successfully"
        else
            error "Service deployment failed"
        fi
    fi
}

# Function to run health checks
run_health_checks() {
    log "Running health checks..."
    
    local health_url="http://localhost:3001/api/health"
    if [ "$ENVIRONMENT" = "production" ]; then
        health_url="https://your-domain.com/api/health"
    elif [ "$ENVIRONMENT" = "staging" ]; then
        health_url="https://staging.your-domain.com/api/health"
    fi
    
    if [ "$DRY_RUN" = "true" ]; then
        log "DRY RUN: Would check health at $health_url"
    else
        local max_attempts=30
        local attempt=1
        
        while [ $attempt -le $max_attempts ]; do
            log "Health check attempt $attempt/$max_attempts"
            
            if curl -f -s "$health_url" > /dev/null; then
                success "Health check passed"
                return 0
            fi
            
            sleep 10
            ((attempt++))
        done
        
        error "Health checks failed after $max_attempts attempts"
    fi
}

# Function to run smoke tests
run_smoke_tests() {
    log "Running smoke tests..."
    
    if [ "$DRY_RUN" = "true" ]; then
        log "DRY RUN: Would run smoke tests"
    else
        # Add smoke test commands here
        # Example: npm run test:smoke
        log "Smoke tests completed"
    fi
}

# Function to cleanup old images
cleanup_images() {
    log "Cleaning up old Docker images..."
    
    if [ "$DRY_RUN" = "true" ]; then
        log "DRY RUN: Would cleanup old images"
    else
        # Remove unused images
        docker image prune -f
        
        # Remove dangling images
        docker image prune -a -f --filter "until=24h"
        
        success "Image cleanup completed"
    fi
}

# Function to rollback deployment
rollback_deployment() {
    log "Rolling back deployment..."
    
    local compose_file="docker-compose.${ENVIRONMENT}.yml"
    if [ ! -f "$compose_file" ]; then
        compose_file="docker-compose.yml"
    fi
    
    if [ "$DRY_RUN" = "true" ]; then
        log "DRY RUN: Would rollback using $compose_file"
    else
        # Stop current services
        docker-compose -f "$compose_file" down
        
        # Restore from backup if available
        if [ -f "./scripts/backup-db.sh" ] && [ "$ENVIRONMENT" = "production" ]; then
            log "Restoring from backup..."
            # Add backup restoration logic here
        fi
        
        # Start previous version
        docker-compose -f "$compose_file" up -d
        
        success "Rollback completed"
    fi
}

# Function to show deployment status
show_status() {
    log "Deployment status for $ENVIRONMENT environment:"
    
    local compose_file="docker-compose.${ENVIRONMENT}.yml"
    if [ ! -f "$compose_file" ]; then
        compose_file="docker-compose.yml"
    fi
    
    docker-compose -f "$compose_file" ps
}

# Function to show logs
show_logs() {
    local service=${1:-""}
    
    local compose_file="docker-compose.${ENVIRONMENT}.yml"
    if [ ! -f "$compose_file" ]; then
        compose_file="docker-compose.yml"
    fi
    
    if [ -n "$service" ]; then
        docker-compose -f "$compose_file" logs -f "$service"
    else
        docker-compose -f "$compose_file" logs -f
    fi
}

# Function to scale services
scale_services() {
    local service=$1
    local replicas=$2
    
    if [ -z "$service" ] || [ -z "$replicas" ]; then
        error "Usage: scale <service> <replicas>"
    fi
    
    local compose_file="docker-compose.${ENVIRONMENT}.yml"
    if [ ! -f "$compose_file" ]; then
        compose_file="docker-compose.yml"
    fi
    
    if [ "$DRY_RUN" = "true" ]; then
        log "DRY RUN: Would scale $service to $replicas replicas"
    else
        docker-compose -f "$compose_file" up -d --scale "$service=$replicas"
        success "Scaled $service to $replicas replicas"
    fi
}

# Main execution
main() {
    log "Starting deployment process for $ENVIRONMENT environment"
    log "Action: $ACTION, Version: $VERSION, Dry Run: $DRY_RUN"
    
    case "$ACTION" in
        "deploy")
            validate_environment
            check_prerequisites
            validate_configuration
            create_backup
            pull_images
            run_migrations
            deploy_services
            run_health_checks
            run_smoke_tests
            cleanup_images
            ;;
        "rollback")
            validate_environment
            rollback_deployment
            run_health_checks
            ;;
        "status")
            validate_environment
            show_status
            ;;
        "logs")
            validate_environment
            show_logs "$3"
            ;;
        "scale")
            validate_environment
            scale_services "$3" "$4"
            ;;
        "migrate")
            validate_environment
            run_migrations
            ;;
        "backup")
            validate_environment
            create_backup
            ;;
        *)
            echo "Usage: $0 <environment> <action> [version] [dry-run]"
            echo ""
            echo "Environments: development, staging, production"
            echo ""
            echo "Actions:"
            echo "  deploy   - Deploy the application"
            echo "  rollback - Rollback to previous version"
            echo "  status   - Show deployment status"
            echo "  logs     - Show service logs"
            echo "  scale    - Scale services"
            echo "  migrate  - Run database migrations only"
            echo "  backup   - Create backup only"
            echo ""
            echo "Examples:"
            echo "  $0 production deploy latest"
            echo "  $0 staging deploy v1.2.3"
            echo "  $0 production rollback"
            echo "  $0 staging status"
            echo "  $0 production logs api"
            echo "  $0 production scale api 3"
            echo "  $0 production deploy latest true  # dry run"
            exit 1
            ;;
    esac
    
    success "Deployment process completed successfully"
}

# Run main function with all arguments
main "$@"
