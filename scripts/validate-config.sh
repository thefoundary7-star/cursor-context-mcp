#!/bin/bash

# Configuration validation script for MCP SaaS Platform
# This script validates environment configuration before deployment

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
ENVIRONMENT=${1:-development}
CONFIG_FILE=".env.${ENVIRONMENT}"
LOG_FILE="./logs/config-validation.log"

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

# Function to check if config file exists
check_config_file() {
    if [ ! -f "$CONFIG_FILE" ]; then
        error "Configuration file not found: $CONFIG_FILE"
    fi
    success "Configuration file found: $CONFIG_FILE"
}

# Function to validate required environment variables
validate_required_vars() {
    log "Validating required environment variables..."
    
    local required_vars=(
        "NODE_ENV"
        "PORT"
        "DATABASE_URL"
        "JWT_SECRET"
        "ENCRYPTION_KEY"
        "STRIPE_SECRET_KEY"
        "STRIPE_PUBLISHABLE_KEY"
        "STRIPE_WEBHOOK_SECRET"
        "SESSION_SECRET"
    )
    
    local missing_vars=()
    
    for var in "${required_vars[@]}"; do
        if ! grep -q "^${var}=" "$CONFIG_FILE" || grep -q "^${var}=$" "$CONFIG_FILE" || grep -q "^${var}=your_" "$CONFIG_FILE"; then
            missing_vars+=("$var")
        fi
    done
    
    if [ ${#missing_vars[@]} -gt 0 ]; then
        error "Missing or invalid required variables: ${missing_vars[*]}"
    fi
    
    success "All required environment variables are set"
}

# Function to validate JWT secret strength
validate_jwt_secret() {
    log "Validating JWT secret strength..."
    
    local jwt_secret=$(grep "^JWT_SECRET=" "$CONFIG_FILE" | cut -d'=' -f2-)
    
    if [ ${#jwt_secret} -lt 32 ]; then
        error "JWT_SECRET must be at least 32 characters long"
    fi
    
    if [[ "$jwt_secret" == *"your_"* ]] || [[ "$jwt_secret" == *"example"* ]] || [[ "$jwt_secret" == *"test"* ]]; then
        error "JWT_SECRET appears to be a placeholder value"
    fi
    
    success "JWT secret is properly configured"
}

# Function to validate encryption key
validate_encryption_key() {
    log "Validating encryption key..."
    
    local encryption_key=$(grep "^ENCRYPTION_KEY=" "$CONFIG_FILE" | cut -d'=' -f2-)
    
    if [ ${#encryption_key} -lt 32 ]; then
        error "ENCRYPTION_KEY must be at least 32 characters long"
    fi
    
    if [[ "$encryption_key" == *"your_"* ]] || [[ "$encryption_key" == *"example"* ]] || [[ "$encryption_key" == *"test"* ]]; then
        error "ENCRYPTION_KEY appears to be a placeholder value"
    fi
    
    success "Encryption key is properly configured"
}

# Function to validate database URL
validate_database_url() {
    log "Validating database URL..."
    
    local db_url=$(grep "^DATABASE_URL=" "$CONFIG_FILE" | cut -d'=' -f2-)
    
    if [[ ! "$db_url" =~ ^postgresql:// ]]; then
        error "DATABASE_URL must be a valid PostgreSQL connection string"
    fi
    
    if [[ "$db_url" == *"your_"* ]] || [[ "$db_url" == *"example"* ]] || [[ "$db_url" == *"localhost"* ]]; then
        if [ "$ENVIRONMENT" = "production" ]; then
            error "DATABASE_URL appears to be a placeholder or localhost in production"
        else
            warning "DATABASE_URL is using localhost (acceptable for non-production)"
        fi
    fi
    
    success "Database URL is properly configured"
}

# Function to validate Stripe configuration
validate_stripe_config() {
    log "Validating Stripe configuration..."
    
    local stripe_secret=$(grep "^STRIPE_SECRET_KEY=" "$CONFIG_FILE" | cut -d'=' -f2-)
    local stripe_publishable=$(grep "^STRIPE_PUBLISHABLE_KEY=" "$CONFIG_FILE" | cut -d'=' -f2-)
    local stripe_webhook=$(grep "^STRIPE_WEBHOOK_SECRET=" "$CONFIG_FILE" | cut -d'=' -f2-)
    
    if [[ "$stripe_secret" == *"your_"* ]] || [[ "$stripe_secret" == *"example"* ]]; then
        error "STRIPE_SECRET_KEY appears to be a placeholder value"
    fi
    
    if [[ "$stripe_publishable" == *"your_"* ]] || [[ "$stripe_publishable" == *"example"* ]]; then
        error "STRIPE_PUBLISHABLE_KEY appears to be a placeholder value"
    fi
    
    if [[ "$stripe_webhook" == *"your_"* ]] || [[ "$stripe_webhook" == *"example"* ]]; then
        error "STRIPE_WEBHOOK_SECRET appears to be a placeholder value"
    fi
    
    # Check if using test keys in production
    if [ "$ENVIRONMENT" = "production" ]; then
        if [[ "$stripe_secret" == *"sk_test_"* ]]; then
            error "Using Stripe test key in production environment"
        fi
        if [[ "$stripe_publishable" == *"pk_test_"* ]]; then
            error "Using Stripe test publishable key in production environment"
        fi
    fi
    
    success "Stripe configuration is properly set up"
}

# Function to validate email configuration
validate_email_config() {
    log "Validating email configuration..."
    
    local from_email=$(grep "^FROM_EMAIL=" "$CONFIG_FILE" | cut -d'=' -f2-)
    local email_provider=$(grep "^EMAIL_PROVIDER=" "$CONFIG_FILE" | cut -d'=' -f2-)
    
    if [[ ! "$from_email" =~ ^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$ ]]; then
        error "FROM_EMAIL is not a valid email address"
    fi
    
    if [[ "$from_email" == *"your_"* ]] || [[ "$from_email" == *"example"* ]]; then
        error "FROM_EMAIL appears to be a placeholder value"
    fi
    
    if [ "$email_provider" = "sendgrid" ]; then
        local sendgrid_key=$(grep "^SENDGRID_API_KEY=" "$CONFIG_FILE" | cut -d'=' -f2-)
        if [[ "$sendgrid_key" == *"your_"* ]] || [[ "$sendgrid_key" == *"example"* ]]; then
            error "SENDGRID_API_KEY appears to be a placeholder value"
        fi
    fi
    
    success "Email configuration is properly set up"
}

# Function to validate SSL configuration for production
validate_ssl_config() {
    if [ "$ENVIRONMENT" = "production" ]; then
        log "Validating SSL configuration for production..."
        
        local ssl_cert=$(grep "^SSL_CERT_PATH=" "$CONFIG_FILE" | cut -d'=' -f2-)
        local ssl_key=$(grep "^SSL_KEY_PATH=" "$CONFIG_FILE" | cut -d'=' -f2-)
        
        if [ -z "$ssl_cert" ] || [ -z "$ssl_key" ]; then
            warning "SSL certificate paths not configured"
        else
            if [ ! -f "$ssl_cert" ]; then
                warning "SSL certificate file not found: $ssl_cert"
            fi
            if [ ! -f "$ssl_key" ]; then
                warning "SSL key file not found: $ssl_key"
            fi
        fi
        
        success "SSL configuration validation completed"
    fi
}

# Function to validate backup configuration
validate_backup_config() {
    log "Validating backup configuration..."
    
    local backup_enabled=$(grep "^BACKUP_ENABLED=" "$CONFIG_FILE" | cut -d'=' -f2-)
    local backup_s3_bucket=$(grep "^BACKUP_S3_BUCKET=" "$CONFIG_FILE" | cut -d'=' -f2-)
    
    if [ "$backup_enabled" = "true" ]; then
        if [[ "$backup_s3_bucket" == *"your_"* ]] || [[ "$backup_s3_bucket" == *"example"* ]]; then
            warning "BACKUP_S3_BUCKET appears to be a placeholder value"
        fi
        
        local aws_access_key=$(grep "^AWS_ACCESS_KEY_ID=" "$CONFIG_FILE" | cut -d'=' -f2-)
        local aws_secret_key=$(grep "^AWS_SECRET_ACCESS_KEY=" "$CONFIG_FILE" | cut -d'=' -f2-)
        
        if [[ "$aws_access_key" == *"your_"* ]] || [[ "$aws_secret_key" == *"your_"* ]]; then
            warning "AWS credentials appear to be placeholder values"
        fi
    fi
    
    success "Backup configuration validation completed"
}

# Function to validate CORS configuration
validate_cors_config() {
    log "Validating CORS configuration..."
    
    local cors_origin=$(grep "^CORS_ORIGIN=" "$CONFIG_FILE" | cut -d'=' -f2-)
    
    if [ "$ENVIRONMENT" = "production" ]; then
        if [[ "$cors_origin" == *"localhost"* ]] || [[ "$cors_origin" == *"127.0.0.1"* ]]; then
            warning "CORS_ORIGIN contains localhost in production environment"
        fi
        
        if [[ "$cors_origin" == *"your-domain"* ]] || [[ "$cors_origin" == *"example"* ]]; then
            error "CORS_ORIGIN appears to be a placeholder value in production"
        fi
    fi
    
    success "CORS configuration is properly set up"
}

# Function to validate security settings
validate_security_settings() {
    log "Validating security settings..."
    
    local debug_mode=$(grep "^DEBUG=" "$CONFIG_FILE" | cut -d'=' -f2-)
    local cookie_secure=$(grep "^COOKIE_SECURE=" "$CONFIG_FILE" | cut -d'=' -f2-)
    
    if [ "$ENVIRONMENT" = "production" ]; then
        if [ "$debug_mode" = "true" ]; then
            error "DEBUG mode is enabled in production environment"
        fi
        
        if [ "$cookie_secure" != "true" ]; then
            warning "COOKIE_SECURE is not enabled in production environment"
        fi
    fi
    
    success "Security settings validation completed"
}

# Function to generate configuration report
generate_report() {
    log "Generating configuration validation report..."
    
    local report_file="./logs/config-validation-report-$(date +%Y%m%d_%H%M%S).txt"
    
    {
        echo "MCP SaaS Platform Configuration Validation Report"
        echo "=================================================="
        echo "Environment: $ENVIRONMENT"
        echo "Config File: $CONFIG_FILE"
        echo "Validation Date: $(date)"
        echo ""
        echo "Configuration Summary:"
        echo "---------------------"
        
        # Count configured vs placeholder values
        local total_vars=$(grep -c "^[A-Z_]*=" "$CONFIG_FILE" || true)
        local placeholder_vars=$(grep -c "your_\|example" "$CONFIG_FILE" || true)
        local configured_vars=$((total_vars - placeholder_vars))
        
        echo "Total Variables: $total_vars"
        echo "Configured Variables: $configured_vars"
        echo "Placeholder Variables: $placeholder_vars"
        echo "Configuration Percentage: $((configured_vars * 100 / total_vars))%"
        echo ""
        
        if [ "$ENVIRONMENT" = "production" ]; then
            echo "Production Readiness Checklist:"
            echo "-------------------------------"
            echo "✓ JWT Secret: $([ ${#jwt_secret} -ge 32 ] && echo "Strong" || echo "Weak")"
            echo "✓ Encryption Key: $([ ${#encryption_key} -ge 32 ] && echo "Strong" || echo "Weak")"
            echo "✓ Database URL: $([ "$db_url" != *"localhost"* ] && echo "Production Ready" || echo "Development")"
            echo "✓ Stripe Keys: $([ "$stripe_secret" != *"sk_test_"* ] && echo "Live Keys" || echo "Test Keys")"
            echo "✓ SSL Configuration: $([ -n "$ssl_cert" ] && echo "Configured" || echo "Not Configured")"
            echo "✓ Backup Configuration: $([ "$backup_enabled" = "true" ] && echo "Enabled" || echo "Disabled")"
            echo "✓ Debug Mode: $([ "$debug_mode" != "true" ] && echo "Disabled" || echo "Enabled")"
        fi
        
    } > "$report_file"
    
    success "Configuration validation report generated: $report_file"
}

# Main execution
main() {
    log "Starting configuration validation for environment: $ENVIRONMENT"
    
    check_config_file
    validate_required_vars
    validate_jwt_secret
    validate_encryption_key
    validate_database_url
    validate_stripe_config
    validate_email_config
    validate_ssl_config
    validate_backup_config
    validate_cors_config
    validate_security_settings
    generate_report
    
    success "Configuration validation completed successfully for $ENVIRONMENT environment"
    echo ""
    echo "🎉 Configuration is ready for deployment!"
    echo ""
    echo "Next steps:"
    echo "1. Review the validation report in ./logs/"
    echo "2. Fix any warnings or errors"
    echo "3. Run deployment scripts"
}

# Run main function with all arguments
main "$@"
