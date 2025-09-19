#!/bin/bash

# S3 Backup script for MCP SaaS Platform
# This script uploads database backups to AWS S3

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
BACKUP_TYPE=${1:-full}
S3_BUCKET=${S3_BUCKET}
AWS_REGION=${AWS_REGION:-us-east-1}
BACKUP_DIR=${BACKUP_DIR:-./backups}
RETENTION_DAYS=${RETENTION_DAYS:-30}
LOG_FILE="./logs/s3-backup.log"

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

# Check if AWS CLI is installed
check_aws_cli() {
    if ! command -v aws &> /dev/null; then
        error "AWS CLI is not installed or not in PATH"
    fi
    
    # Check AWS credentials
    if ! aws sts get-caller-identity &> /dev/null; then
        error "AWS credentials not configured or invalid"
    fi
    
    success "AWS CLI is properly configured"
}

# Check if S3 bucket exists and is accessible
check_s3_bucket() {
    if [ -z "$S3_BUCKET" ]; then
        error "S3_BUCKET environment variable is not set"
    fi
    
    if ! aws s3 ls "s3://$S3_BUCKET" &> /dev/null; then
        error "S3 bucket '$S3_BUCKET' does not exist or is not accessible"
    fi
    
    success "S3 bucket '$S3_BUCKET' is accessible"
}

# Create backup
create_backup() {
    local backup_file="$BACKUP_DIR/backup_$(date +%Y%m%d_%H%M%S).sql"
    
    log "Creating $BACKUP_TYPE backup: $backup_file"
    
    case "$BACKUP_TYPE" in
        "full")
            if pg_dump "$DATABASE_URL" \
                --verbose \
                --no-password \
                --format=custom \
                --compress=9 \
                --file="$backup_file"; then
                success "Full backup created: $backup_file"
            else
                error "Failed to create full backup"
            fi
            ;;
        "schema")
            if pg_dump "$DATABASE_URL" \
                --verbose \
                --no-password \
                --schema-only \
                --file="$backup_file"; then
                success "Schema backup created: $backup_file"
                gzip "$backup_file"
                backup_file="${backup_file}.gz"
            else
                error "Failed to create schema backup"
            fi
            ;;
        "data")
            if pg_dump "$DATABASE_URL" \
                --verbose \
                --no-password \
                --data-only \
                --file="$backup_file"; then
                success "Data backup created: $backup_file"
                gzip "$backup_file"
                backup_file="${backup_file}.gz"
            else
                error "Failed to create data backup"
            fi
            ;;
        *)
            error "Invalid backup type: $BACKUP_TYPE. Must be full, schema, or data"
            ;;
    esac
    
    echo "$backup_file"
}

# Upload backup to S3
upload_to_s3() {
    local backup_file="$1"
    local s3_key="backups/$(basename "$backup_file")"
    
    log "Uploading backup to S3: s3://$S3_BUCKET/$s3_key"
    
    if aws s3 cp "$backup_file" "s3://$S3_BUCKET/$s3_key" \
        --region "$AWS_REGION" \
        --storage-class STANDARD_IA \
        --metadata "backup-type=$BACKUP_TYPE,created=$(date -Iseconds)"; then
        success "Backup uploaded to S3: s3://$S3_BUCKET/$s3_key"
        
        # Get file size and ETag
        local file_size=$(stat -c%s "$backup_file")
        local etag=$(aws s3api head-object --bucket "$S3_BUCKET" --key "$s3_key" --query 'ETag' --output text)
        
        log "Backup details: Size=$file_size bytes, ETag=$etag"
    else
        error "Failed to upload backup to S3"
    fi
}

# Verify backup in S3
verify_s3_backup() {
    local backup_file="$1"
    local s3_key="backups/$(basename "$backup_file")"
    
    log "Verifying backup in S3: s3://$S3_BUCKET/$s3_key"
    
    # Check if file exists in S3
    if ! aws s3api head-object --bucket "$S3_BUCKET" --key "$s3_key" &> /dev/null; then
        error "Backup not found in S3: s3://$S3_BUCKET/$s3_key"
    fi
    
    # Compare file sizes
    local local_size=$(stat -c%s "$backup_file")
    local s3_size=$(aws s3api head-object --bucket "$S3_BUCKET" --key "$s3_key" --query 'ContentLength' --output text)
    
    if [ "$local_size" != "$s3_size" ]; then
        error "File size mismatch: Local=$local_size, S3=$s3_size"
    fi
    
    success "Backup verified in S3"
}

# Clean up old backups from S3
cleanup_old_s3_backups() {
    log "Cleaning up old backups from S3 (older than $RETENTION_DAYS days)..."
    
    local cutoff_date=$(date -d "$RETENTION_DAYS days ago" +%Y-%m-%d)
    local deleted_count=0
    
    # List old backups
    local old_backups=$(aws s3api list-objects-v2 \
        --bucket "$S3_BUCKET" \
        --prefix "backups/" \
        --query "Contents[?LastModified<='$cutoff_date'].Key" \
        --output text)
    
    if [ -n "$old_backups" ]; then
        for backup in $old_backups; do
            log "Deleting old backup: s3://$S3_BUCKET/$backup"
            if aws s3 rm "s3://$S3_BUCKET/$backup"; then
                ((deleted_count++))
            fi
        done
    fi
    
    if [ $deleted_count -gt 0 ]; then
        success "Cleaned up $deleted_count old backups from S3"
    else
        log "No old backups to clean up from S3"
    fi
}

# List backups in S3
list_s3_backups() {
    log "Listing backups in S3: s3://$S3_BUCKET/backups/"
    
    aws s3api list-objects-v2 \
        --bucket "$S3_BUCKET" \
        --prefix "backups/" \
        --query "Contents[].{Key:Key,Size:Size,LastModified:LastModified}" \
        --output table
}

# Restore backup from S3
restore_from_s3() {
    local backup_name="$1"
    local s3_key="backups/$backup_name"
    
    if [ -z "$backup_name" ]; then
        error "Backup name is required for restore"
    fi
    
    log "Restoring backup from S3: s3://$S3_BUCKET/$s3_key"
    
    # Download backup from S3
    local local_file="$BACKUP_DIR/restore_$backup_name"
    if aws s3 cp "s3://$S3_BUCKET/$s3_key" "$local_file"; then
        success "Backup downloaded from S3: $local_file"
    else
        error "Failed to download backup from S3"
    fi
    
    # Restore database
    log "Restoring database from backup..."
    if [[ "$backup_name" == *.gz ]]; then
        # Compressed backup
        if gunzip -c "$local_file" | psql "$DATABASE_URL"; then
            success "Database restored successfully from compressed backup"
        else
            error "Failed to restore from compressed backup"
        fi
    else
        # Uncompressed backup
        if psql "$DATABASE_URL" < "$local_file"; then
            success "Database restored successfully from backup"
        else
            error "Failed to restore from backup"
        fi
    fi
    
    # Clean up local file
    rm -f "$local_file"
}

# Get backup statistics
get_backup_stats() {
    log "Getting backup statistics from S3..."
    
    local total_size=$(aws s3api list-objects-v2 \
        --bucket "$S3_BUCKET" \
        --prefix "backups/" \
        --query "sum(Contents[].Size)" \
        --output text)
    
    local backup_count=$(aws s3api list-objects-v2 \
        --bucket "$S3_BUCKET" \
        --prefix "backups/" \
        --query "length(Contents[])" \
        --output text)
    
    echo "Backup Statistics:"
    echo "  Total backups: $backup_count"
    echo "  Total size: $(numfmt --to=iec $total_size)"
    echo "  S3 bucket: $S3_BUCKET"
    echo "  Region: $AWS_REGION"
    echo "  Retention: $RETENTION_DAYS days"
}

# Main execution
main() {
    local command="$1"
    local backup_name="$2"
    
    log "Starting S3 backup process"
    
    case "$command" in
        "backup")
            check_aws_cli
            check_s3_bucket
            backup_file=$(create_backup)
            upload_to_s3 "$backup_file"
            verify_s3_backup "$backup_file"
            cleanup_old_s3_backups
            ;;
        "list")
            check_aws_cli
            check_s3_bucket
            list_s3_backups
            ;;
        "restore")
            check_aws_cli
            check_s3_bucket
            restore_from_s3 "$backup_name"
            ;;
        "stats")
            check_aws_cli
            check_s3_bucket
            get_backup_stats
            ;;
        "cleanup")
            check_aws_cli
            check_s3_bucket
            cleanup_old_s3_backups
            ;;
        *)
            echo "Usage: $0 {backup|list|restore|stats|cleanup} [backup_name]"
            echo ""
            echo "Commands:"
            echo "  backup   - Create and upload backup to S3"
            echo "  list     - List all backups in S3"
            echo "  restore  - Restore database from S3 backup"
            echo "  stats    - Show backup statistics"
            echo "  cleanup  - Clean up old backups from S3"
            echo ""
            echo "Environment variables:"
            echo "  S3_BUCKET        - S3 bucket name"
            echo "  AWS_REGION       - AWS region (default: us-east-1)"
            echo "  DATABASE_URL     - Database connection string"
            echo "  BACKUP_DIR       - Local backup directory"
            echo "  RETENTION_DAYS   - Backup retention period"
            echo ""
            echo "Examples:"
            echo "  $0 backup"
            echo "  $0 list"
            echo "  $0 restore backup_20231201_120000.sql"
            echo "  $0 stats"
            exit 1
            ;;
    esac
    
    success "S3 backup process completed successfully"
}

# Run main function with all arguments
main "$@"
