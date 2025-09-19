#!/bin/bash

# Security Audit Script for MCP SaaS Platform
# This script performs comprehensive security checks on the production deployment

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
AUDIT_TYPE=${1:-full}
LOG_FILE="./logs/security-audit.log"
REPORT_FILE="./logs/security-audit-report-$(date +%Y%m%d_%H%M%S).txt"

# Create necessary directories
mkdir -p "$(dirname "$LOG_FILE")"

# Logging function
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "$LOG_FILE"
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1" | tee -a "$LOG_FILE"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1" | tee -a "$LOG_FILE"
}

# Initialize report
init_report() {
    cat > "$REPORT_FILE" << EOF
MCP SaaS Platform Security Audit Report
=======================================
Audit Date: $(date)
Audit Type: $AUDIT_TYPE
Auditor: Security Audit Script
Environment: Production

EXECUTIVE SUMMARY
================
This report contains the results of a comprehensive security audit of the MCP SaaS Platform.

FINDINGS SUMMARY
===============
Critical Issues: 0
High Issues: 0
Medium Issues: 0
Low Issues: 0
Informational: 0

DETAILED FINDINGS
================

EOF
}

# Add finding to report
add_finding() {
    local severity="$1"
    local title="$2"
    local description="$3"
    local recommendation="$4"
    
    cat >> "$REPORT_FILE" << EOF
[$severity] $title
----------------------------------------
Description: $description
Recommendation: $recommendation

EOF
}

# Check SSL/TLS configuration
check_ssl_tls() {
    log "Checking SSL/TLS configuration..."
    
    local domain="your-domain.com"
    local ssl_issues=0
    
    # Check if SSL certificate exists
    if [ ! -f "./nginx/ssl/$domain.crt" ]; then
        add_finding "HIGH" "Missing SSL Certificate" "SSL certificate not found for $domain" "Generate SSL certificate using ./scripts/generate-ssl-cert.sh"
        ((ssl_issues++))
    fi
    
    # Check if private key exists
    if [ ! -f "./nginx/ssl/$domain.key" ]; then
        add_finding "HIGH" "Missing SSL Private Key" "SSL private key not found for $domain" "Generate SSL private key using ./scripts/generate-ssl-cert.sh"
        ((ssl_issues++))
    fi
    
    # Check certificate validity
    if [ -f "./nginx/ssl/$domain.crt" ]; then
        local cert_expiry=$(openssl x509 -in "./nginx/ssl/$domain.crt" -noout -dates | grep "notAfter" | cut -d= -f2)
        local expiry_date=$(date -d "$cert_expiry" +%s)
        local current_date=$(date +%s)
        local days_until_expiry=$(( (expiry_date - current_date) / 86400 ))
        
        if [ $days_until_expiry -lt 30 ]; then
            add_finding "HIGH" "SSL Certificate Expiring Soon" "SSL certificate expires in $days_until_expiry days" "Renew SSL certificate before expiration"
            ((ssl_issues++))
        elif [ $days_until_expiry -lt 60 ]; then
            add_finding "MEDIUM" "SSL Certificate Expiring" "SSL certificate expires in $days_until_expiry days" "Plan SSL certificate renewal"
            ((ssl_issues++))
        fi
    fi
    
    if [ $ssl_issues -eq 0 ]; then
        success "SSL/TLS configuration is secure"
    else
        warning "Found $ssl_issues SSL/TLS issues"
    fi
}

# Check environment variables
check_environment_variables() {
    log "Checking environment variables..."
    
    local env_issues=0
    
    # Check for hardcoded secrets
    if grep -r "password.*=" . --include="*.js" --include="*.ts" --include="*.json" | grep -v "your_" | grep -v "example" | grep -v "test" | grep -v "localhost"; then
        add_finding "HIGH" "Hardcoded Passwords" "Hardcoded passwords found in source code" "Move all passwords to environment variables"
        ((env_issues++))
    fi
    
    # Check for placeholder values in production config
    if [ -f "env.production" ]; then
        if grep -q "your_" env.production || grep -q "example" env.production; then
            add_finding "HIGH" "Placeholder Values in Production Config" "Production configuration contains placeholder values" "Replace all placeholder values with actual production values"
            ((env_issues++))
        fi
    fi
    
    # Check for missing required environment variables
    local required_vars=("JWT_SECRET" "ENCRYPTION_KEY" "DATABASE_URL" "STRIPE_SECRET_KEY")
    for var in "${required_vars[@]}"; do
        if ! grep -q "^$var=" env.production; then
            add_finding "HIGH" "Missing Required Environment Variable" "Required environment variable $var is not set" "Add $var to production environment configuration"
            ((env_issues++))
        fi
    done
    
    if [ $env_issues -eq 0 ]; then
        success "Environment variables are properly configured"
    else
        warning "Found $env_issues environment variable issues"
    fi
}

# Check Docker security
check_docker_security() {
    log "Checking Docker security configuration..."
    
    local docker_issues=0
    
    # Check if running as root
    if grep -q "USER root" Dockerfile; then
        add_finding "MEDIUM" "Docker Running as Root" "Docker container is configured to run as root" "Use non-root user in Dockerfile"
        ((docker_issues++))
    fi
    
    # Check for exposed ports
    if grep -q "EXPOSE" Dockerfile; then
        add_finding "LOW" "Exposed Ports in Dockerfile" "Dockerfile exposes ports that might not be necessary" "Review and minimize exposed ports"
        ((docker_issues++))
    fi
    
    # Check for secrets in Dockerfile
    if grep -q "password\|secret\|key" Dockerfile -i; then
        add_finding "HIGH" "Secrets in Dockerfile" "Dockerfile contains potential secrets" "Remove all secrets from Dockerfile and use environment variables"
        ((docker_issues++))
    fi
    
    if [ $docker_issues -eq 0 ]; then
        success "Docker security configuration is secure"
    else
        warning "Found $docker_issues Docker security issues"
    fi
}

# Check database security
check_database_security() {
    log "Checking database security..."
    
    local db_issues=0
    
    # Check database connection string
    if [ -f "env.production" ]; then
        if grep -q "DATABASE_URL=" env.production; then
            local db_url=$(grep "DATABASE_URL=" env.production | cut -d= -f2-)
            if [[ "$db_url" == *"localhost"* ]] || [[ "$db_url" == *"127.0.0.1"* ]]; then
                add_finding "HIGH" "Database Using Localhost" "Database URL uses localhost in production" "Use proper database hostname in production"
                ((db_issues++))
            fi
        fi
    fi
    
    # Check for default database credentials
    if [ -f "docker-compose.production.yml" ]; then
        if grep -q "POSTGRES_PASSWORD.*mcp_password" docker-compose.production.yml; then
            add_finding "HIGH" "Default Database Password" "Database is using default password" "Change database password to a strong, unique password"
            ((db_issues++))
        fi
    fi
    
    if [ $db_issues -eq 0 ]; then
        success "Database security configuration is secure"
    else
        warning "Found $db_issues database security issues"
    fi
}

# Check API security
check_api_security() {
    log "Checking API security..."
    
    local api_issues=0
    
    # Check for rate limiting
    if ! grep -q "rateLimitMiddleware" src/server.ts; then
        add_finding "MEDIUM" "Missing Rate Limiting" "API does not have rate limiting configured" "Implement rate limiting middleware"
        ((api_issues++))
    fi
    
    # Check for CORS configuration
    if ! grep -q "corsMiddleware" src/server.ts; then
        add_finding "MEDIUM" "Missing CORS Configuration" "API does not have CORS configured" "Implement CORS middleware"
        ((api_issues++))
    fi
    
    # Check for security headers
    if ! grep -q "helmetMiddleware" src/server.ts; then
        add_finding "MEDIUM" "Missing Security Headers" "API does not have security headers configured" "Implement Helmet middleware for security headers"
        ((api_issues++))
    fi
    
    # Check for input validation
    if ! grep -q "zod\|joi\|express-validator" package.json; then
        add_finding "MEDIUM" "Missing Input Validation" "API does not have input validation library" "Implement input validation using Zod or similar"
        ((api_issues++))
    fi
    
    if [ $api_issues -eq 0 ]; then
        success "API security configuration is secure"
    else
        warning "Found $api_issues API security issues"
    fi
}

# Check file permissions
check_file_permissions() {
    log "Checking file permissions..."
    
    local perm_issues=0
    
    # Check for world-writable files
    local world_writable=$(find . -type f -perm -002 2>/dev/null | wc -l)
    if [ $world_writable -gt 0 ]; then
        add_finding "MEDIUM" "World-Writable Files" "Found $world_writable world-writable files" "Review and fix file permissions"
        ((perm_issues++))
    fi
    
    # Check for files with SUID/SGID bits
    local suid_files=$(find . -type f \( -perm -4000 -o -perm -2000 \) 2>/dev/null | wc -l)
    if [ $suid_files -gt 0 ]; then
        add_finding "HIGH" "SUID/SGID Files" "Found $suid_files files with SUID/SGID bits" "Review and remove unnecessary SUID/SGID bits"
        ((perm_issues++))
    fi
    
    # Check SSL certificate permissions
    if [ -f "./nginx/ssl/your-domain.com.key" ]; then
        local key_perms=$(stat -c "%a" "./nginx/ssl/your-domain.com.key")
        if [ "$key_perms" != "600" ]; then
            add_finding "HIGH" "Insecure SSL Key Permissions" "SSL private key has permissions $key_perms (should be 600)" "Set SSL private key permissions to 600"
            ((perm_issues++))
        fi
    fi
    
    if [ $perm_issues -eq 0 ]; then
        success "File permissions are secure"
    else
        warning "Found $perm_issues file permission issues"
    fi
}

# Check network security
check_network_security() {
    log "Checking network security..."
    
    local network_issues=0
    
    # Check for exposed ports in docker-compose
    if [ -f "docker-compose.production.yml" ]; then
        local exposed_ports=$(grep -c "ports:" docker-compose.production.yml)
        if [ $exposed_ports -gt 3 ]; then
            add_finding "LOW" "Multiple Exposed Ports" "Docker Compose exposes $exposed_ports services" "Review and minimize exposed ports"
            ((network_issues++))
        fi
    fi
    
    # Check for HTTP (non-HTTPS) configuration
    if [ -f "nginx/nginx.production.conf" ]; then
        if grep -q "listen 80" nginx/nginx.production.conf; then
            if ! grep -q "return 301 https" nginx/nginx.production.conf; then
                add_finding "MEDIUM" "HTTP Not Redirected to HTTPS" "HTTP traffic is not redirected to HTTPS" "Configure HTTP to HTTPS redirect"
                ((network_issues++))
            fi
        fi
    fi
    
    if [ $network_issues -eq 0 ]; then
        success "Network security configuration is secure"
    else
        warning "Found $network_issues network security issues"
    fi
}

# Check dependencies for vulnerabilities
check_dependencies() {
    log "Checking dependencies for vulnerabilities..."
    
    local dep_issues=0
    
    # Check for npm audit
    if [ -f "package.json" ]; then
        if npm audit --audit-level=moderate 2>/dev/null | grep -q "found"; then
            add_finding "MEDIUM" "Vulnerable Dependencies" "NPM audit found vulnerabilities in dependencies" "Run 'npm audit fix' to resolve vulnerabilities"
            ((dep_issues++))
        fi
    fi
    
    # Check for outdated dependencies
    if [ -f "package.json" ]; then
        local outdated=$(npm outdated 2>/dev/null | wc -l)
        if [ $outdated -gt 0 ]; then
            add_finding "LOW" "Outdated Dependencies" "Found $outdated outdated dependencies" "Update dependencies to latest versions"
            ((dep_issues++))
        fi
    fi
    
    if [ $dep_issues -eq 0 ]; then
        success "Dependencies are secure and up-to-date"
    else
        warning "Found $dep_issues dependency issues"
    fi
}

# Generate final report
generate_final_report() {
    log "Generating final security audit report..."
    
    # Count findings by severity
    local critical=$(grep -c "\[CRITICAL\]" "$REPORT_FILE" || true)
    local high=$(grep -c "\[HIGH\]" "$REPORT_FILE" || true)
    local medium=$(grep -c "\[MEDIUM\]" "$REPORT_FILE" || true)
    local low=$(grep -c "\[LOW\]" "$REPORT_FILE" || true)
    local info=$(grep -c "\[INFO\]" "$REPORT_FILE" || true)
    
    # Update summary in report
    sed -i "s/Critical Issues: 0/Critical Issues: $critical/" "$REPORT_FILE"
    sed -i "s/High Issues: 0/High Issues: $high/" "$REPORT_FILE"
    sed -i "s/Medium Issues: 0/Medium Issues: $medium/" "$REPORT_FILE"
    sed -i "s/Low Issues: 0/Low Issues: $low/" "$REPORT_FILE"
    sed -i "s/Informational: 0/Informational: $info/" "$REPORT_FILE"
    
    # Add recommendations section
    cat >> "$REPORT_FILE" << EOF

RECOMMENDATIONS
==============
1. Address all Critical and High severity issues immediately
2. Plan remediation for Medium severity issues within 30 days
3. Schedule Low severity issues for next maintenance window
4. Review and implement security best practices
5. Conduct regular security audits (monthly recommended)
6. Implement automated security scanning in CI/CD pipeline

NEXT STEPS
==========
1. Review this report with the development team
2. Prioritize issues based on business impact
3. Create remediation plan with timelines
4. Implement fixes and verify resolution
5. Schedule follow-up audit

EOF
    
    success "Security audit report generated: $REPORT_FILE"
    
    # Display summary
    echo ""
    echo "Security Audit Summary:"
    echo "======================"
    echo "Critical Issues: $critical"
    echo "High Issues: $high"
    echo "Medium Issues: $medium"
    echo "Low Issues: $low"
    echo "Informational: $info"
    echo ""
    echo "Full report: $REPORT_FILE"
}

# Main execution
main() {
    log "Starting security audit: $AUDIT_TYPE"
    
    init_report
    
    case "$AUDIT_TYPE" in
        "full")
            check_ssl_tls
            check_environment_variables
            check_docker_security
            check_database_security
            check_api_security
            check_file_permissions
            check_network_security
            check_dependencies
            ;;
        "ssl")
            check_ssl_tls
            ;;
        "env")
            check_environment_variables
            ;;
        "docker")
            check_docker_security
            ;;
        "database")
            check_database_security
            ;;
        "api")
            check_api_security
            ;;
        "permissions")
            check_file_permissions
            ;;
        "network")
            check_network_security
            ;;
        "dependencies")
            check_dependencies
            ;;
        *)
            echo "Usage: $0 {full|ssl|env|docker|database|api|permissions|network|dependencies}"
            echo ""
            echo "Audit Types:"
            echo "  full        - Complete security audit"
            echo "  ssl         - SSL/TLS configuration audit"
            echo "  env         - Environment variables audit"
            echo "  docker      - Docker security audit"
            echo "  database    - Database security audit"
            echo "  api         - API security audit"
            echo "  permissions - File permissions audit"
            echo "  network     - Network security audit"
            echo "  dependencies - Dependencies vulnerability audit"
            exit 1
            ;;
    esac
    
    generate_final_report
    
    success "Security audit completed successfully"
}

# Run main function with all arguments
main "$@"
