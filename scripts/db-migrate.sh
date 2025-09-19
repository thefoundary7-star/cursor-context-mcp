#!/bin/bash

# Database migration script for MCP SaaS Platform
# This script handles database migrations in different environments

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
ENVIRONMENT=${1:-development}
DATABASE_URL=${DATABASE_URL}
BACKUP_DIR="./backups"
LOG_FILE="./logs/migration.log"

# Create necessary directories
mkdir -p "$BACKUP_DIR"
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

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    error "DATABASE_URL environment variable is not set"
fi

# Function to backup database
backup_database() {
    local backup_file="$BACKUP_DIR/backup_$(date +%Y%m%d_%H%M%S).sql"
    log "Creating database backup: $backup_file"
    
    if pg_dump "$DATABASE_URL" > "$backup_file"; then
        success "Database backup created successfully: $backup_file"
        # Compress backup
        gzip "$backup_file"
        success "Backup compressed: ${backup_file}.gz"
    else
        error "Failed to create database backup"
    fi
}

# Function to check database connection
check_connection() {
    log "Checking database connection..."
    if pg_isready -d "$DATABASE_URL" > /dev/null 2>&1; then
        success "Database connection successful"
    else
        error "Cannot connect to database"
    fi
}

# Function to run migrations
run_migrations() {
    log "Running Prisma migrations..."
    
    # Generate Prisma client
    log "Generating Prisma client..."
    if npx prisma generate; then
        success "Prisma client generated successfully"
    else
        error "Failed to generate Prisma client"
    fi
    
    # Run migrations
    log "Applying database migrations..."
    if npx prisma migrate deploy; then
        success "Database migrations applied successfully"
    else
        error "Failed to apply database migrations"
    fi
    
    # Verify migration status
    log "Verifying migration status..."
    npx prisma migrate status
}

# Function to seed database
seed_database() {
    if [ "$ENVIRONMENT" = "development" ] || [ "$ENVIRONMENT" = "staging" ]; then
        log "Seeding database with initial data..."
        if npx prisma db seed; then
            success "Database seeded successfully"
        else
            warning "Database seeding failed or not configured"
        fi
    else
        log "Skipping database seeding in production environment"
    fi
}

# Function to validate database schema
validate_schema() {
    log "Validating database schema..."
    if npx prisma validate; then
        success "Database schema is valid"
    else
        error "Database schema validation failed"
    fi
}

# Function to reset database (development only)
reset_database() {
    if [ "$ENVIRONMENT" = "development" ]; then
        warning "Resetting database (development only)..."
        if npx prisma migrate reset --force; then
            success "Database reset successfully"
        else
            error "Failed to reset database"
        fi
    else
        error "Database reset is only allowed in development environment"
    fi
}

# Function to show migration status
show_status() {
    log "Current migration status:"
    npx prisma migrate status
}

# Function to create migration
create_migration() {
    local migration_name="$1"
    if [ -z "$migration_name" ]; then
        error "Migration name is required"
    fi
    
    log "Creating new migration: $migration_name"
    if npx prisma migrate dev --name "$migration_name"; then
        success "Migration created successfully: $migration_name"
    else
        error "Failed to create migration: $migration_name"
    fi
}

# Main execution
main() {
    local command="$1"
    
    log "Starting database migration process for environment: $ENVIRONMENT"
    
    case "$command" in
        "backup")
            check_connection
            backup_database
            ;;
        "migrate")
            check_connection
            if [ "$ENVIRONMENT" = "production" ]; then
                backup_database
            fi
            run_migrations
            validate_schema
            ;;
        "seed")
            check_connection
            seed_database
            ;;
        "reset")
            reset_database
            seed_database
            ;;
        "status")
            check_connection
            show_status
            ;;
        "create")
            create_migration "$2"
            ;;
        "full")
            check_connection
            if [ "$ENVIRONMENT" = "production" ]; then
                backup_database
            fi
            run_migrations
            validate_schema
            seed_database
            show_status
            ;;
        *)
            echo "Usage: $0 {backup|migrate|seed|reset|status|create|full} [migration_name]"
            echo ""
            echo "Commands:"
            echo "  backup   - Create a database backup"
            echo "  migrate  - Run database migrations"
            echo "  seed     - Seed database with initial data"
            echo "  reset    - Reset database (development only)"
            echo "  status   - Show migration status"
            echo "  create   - Create a new migration"
            echo "  full     - Run full migration process"
            echo ""
            echo "Environment variables:"
            echo "  DATABASE_URL - Database connection string"
            echo "  ENVIRONMENT  - Environment (development/staging/production)"
            exit 1
            ;;
    esac
    
    success "Database migration process completed successfully"
}

# Run main function with all arguments
main "$@"
