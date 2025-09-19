#!/bin/bash

# Database backup script for MCP SaaS Platform
# This script creates automated backups of the PostgreSQL database

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
DATABASE_URL=${DATABASE_URL}
BACKUP_DIR=${BACKUP_DIR:-./backups}
RETENTION_DAYS=${RETENTION_DAYS:-30}
LOG_FILE="./logs/backup.log"

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

# Function to create full backup
create_full_backup() {
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_file="$BACKUP_DIR/full_backup_$timestamp.sql"
    
    log "Creating full database backup: $backup_file"
    
    if pg_dump "$DATABASE_URL" \
        --verbose \
        --no-password \
        --format=custom \
        --compress=9 \
        --file="$backup_file"; then
        success "Full backup created successfully: $backup_file"
        echo "$backup_file" > "$BACKUP_DIR/latest_full_backup.txt"
    else
        error "Failed to create full backup"
    fi
}

# Function to create schema-only backup
create_schema_backup() {
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_file="$BACKUP_DIR/schema_backup_$timestamp.sql"
    
    log "Creating schema-only backup: $backup_file"
    
    if pg_dump "$DATABASE_URL" \
        --verbose \
        --no-password \
        --schema-only \
        --file="$backup_file"; then
        success "Schema backup created successfully: $backup_file"
        gzip "$backup_file"
        success "Schema backup compressed: ${backup_file}.gz"
    else
        error "Failed to create schema backup"
    fi
}

# Function to create data-only backup
create_data_backup() {
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_file="$BACKUP_DIR/data_backup_$timestamp.sql"
    
    log "Creating data-only backup: $backup_file"
    
    if pg_dump "$DATABASE_URL" \
        --verbose \
        --no-password \
        --data-only \
        --file="$backup_file"; then
        success "Data backup created successfully: $backup_file"
        gzip "$backup_file"
        success "Data backup compressed: ${backup_file}.gz"
    else
        error "Failed to create data backup"
    fi
}

# Function to create incremental backup (using WAL files)
create_incremental_backup() {
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_file="$BACKUP_DIR/incremental_backup_$timestamp"
    
    log "Creating incremental backup: $backup_file"
    
    # This requires WAL archiving to be enabled
    if pg_basebackup -D "$backup_file" -Ft -z -P; then
        success "Incremental backup created successfully: $backup_file"
    else
        warning "Incremental backup failed (WAL archiving may not be enabled)"
    fi
}

# Function to clean up old backups
cleanup_old_backups() {
    log "Cleaning up backups older than $RETENTION_DAYS days..."
    
    local deleted_count=0
    
    # Find and delete old backup files
    while IFS= read -r -d '' file; do
        rm "$file"
        ((deleted_count++))
        log "Deleted old backup: $(basename "$file")"
    done < <(find "$BACKUP_DIR" -name "*.sql" -o -name "*.gz" -o -name "*.tar" -mtime +$RETENTION_DAYS -print0)
    
    if [ $deleted_count -gt 0 ]; then
        success "Cleaned up $deleted_count old backup files"
    else
        log "No old backup files to clean up"
    fi
}

# Function to verify backup integrity
verify_backup() {
    local backup_file="$1"
    
    if [ -z "$backup_file" ]; then
        error "Backup file path is required for verification"
    fi
    
    log "Verifying backup integrity: $backup_file"
    
    if [[ "$backup_file" == *.gz ]]; then
        # Compressed backup
        if gunzip -t "$backup_file" 2>/dev/null; then
            success "Compressed backup is valid: $backup_file"
        else
            error "Compressed backup is corrupted: $backup_file"
        fi
    elif [[ "$backup_file" == *.sql ]]; then
        # SQL backup
        if pg_restore --list "$backup_file" > /dev/null 2>&1; then
            success "SQL backup is valid: $backup_file"
        else
            error "SQL backup is corrupted: $backup_file"
        fi
    else
        warning "Unknown backup format, skipping verification: $backup_file"
    fi
}

# Function to restore from backup
restore_backup() {
    local backup_file="$1"
    local target_db="$2"
    
    if [ -z "$backup_file" ]; then
        error "Backup file path is required for restore"
    fi
    
    if [ -z "$target_db" ]; then
        target_db="$DATABASE_URL"
    fi
    
    log "Restoring database from backup: $backup_file"
    warning "This will overwrite the existing database!"
    
    # Confirm restore operation
    read -p "Are you sure you want to restore from this backup? (yes/no): " confirm
    if [ "$confirm" != "yes" ]; then
        log "Restore operation cancelled"
        exit 0
    fi
    
    if [[ "$backup_file" == *.gz ]]; then
        # Compressed backup
        if gunzip -c "$backup_file" | psql "$target_db"; then
            success "Database restored successfully from compressed backup"
        else
            error "Failed to restore from compressed backup"
        fi
    elif [[ "$backup_file" == *.sql ]]; then
        # SQL backup
        if psql "$target_db" < "$backup_file"; then
            success "Database restored successfully from SQL backup"
        else
            error "Failed to restore from SQL backup"
        fi
    else
        error "Unsupported backup format: $backup_file"
    fi
}

# Function to list available backups
list_backups() {
    log "Available backups in $BACKUP_DIR:"
    
    if [ -d "$BACKUP_DIR" ]; then
        ls -la "$BACKUP_DIR" | grep -E '\.(sql|gz|tar)$' | while read -r line; do
            echo "  $line"
        done
        
        local backup_count=$(find "$BACKUP_DIR" -name "*.sql" -o -name "*.gz" -o -name "*.tar" | wc -l)
        log "Total backups: $backup_count"
    else
        warning "Backup directory does not exist: $BACKUP_DIR"
    fi
}

# Function to get backup statistics
backup_stats() {
    log "Backup statistics:"
    
    if [ -d "$BACKUP_DIR" ]; then
        local total_size=$(du -sh "$BACKUP_DIR" | cut -f1)
        local backup_count=$(find "$BACKUP_DIR" -name "*.sql" -o -name "*.gz" -o -name "*.tar" | wc -l)
        
        echo "  Total backups: $backup_count"
        echo "  Total size: $total_size"
        echo "  Backup directory: $BACKUP_DIR"
        echo "  Retention period: $RETENTION_DAYS days"
    else
        warning "Backup directory does not exist: $BACKUP_DIR"
    fi
}

# Main execution
main() {
    local command="$1"
    local backup_file="$2"
    local target_db="$3"
    
    log "Starting database backup process"
    
    case "$command" in
        "full")
            create_full_backup
            cleanup_old_backups
            ;;
        "schema")
            create_schema_backup
            cleanup_old_backups
            ;;
        "data")
            create_data_backup
            cleanup_old_backups
            ;;
        "incremental")
            create_incremental_backup
            cleanup_old_backups
            ;;
        "verify")
            verify_backup "$backup_file"
            ;;
        "restore")
            restore_backup "$backup_file" "$target_db"
            ;;
        "list")
            list_backups
            ;;
        "stats")
            backup_stats
            ;;
        "cleanup")
            cleanup_old_backups
            ;;
        *)
            echo "Usage: $0 {full|schema|data|incremental|verify|restore|list|stats|cleanup} [backup_file] [target_db]"
            echo ""
            echo "Commands:"
            echo "  full        - Create full database backup"
            echo "  schema      - Create schema-only backup"
            echo "  data        - Create data-only backup"
            echo "  incremental - Create incremental backup (requires WAL archiving)"
            echo "  verify      - Verify backup integrity"
            echo "  restore     - Restore database from backup"
            echo "  list        - List available backups"
            echo "  stats       - Show backup statistics"
            echo "  cleanup     - Clean up old backups"
            echo ""
            echo "Environment variables:"
            echo "  DATABASE_URL   - Database connection string"
            echo "  BACKUP_DIR     - Backup directory (default: ./backups)"
            echo "  RETENTION_DAYS - Backup retention period (default: 30)"
            exit 1
            ;;
    esac
    
    success "Database backup process completed successfully"
}

# Run main function with all arguments
main "$@"
