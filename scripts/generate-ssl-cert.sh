#!/bin/bash

# SSL Certificate Generation Script for MCP SaaS Platform
# This script generates SSL certificates for production deployment

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
DOMAIN=${1:-"your-domain.com"}
EMAIL=${2:-"admin@your-domain.com"}
CERT_TYPE=${3:-"letsencrypt"}
CERT_DIR="./nginx/ssl"
LOG_FILE="./logs/ssl-generation.log"

# Create necessary directories
mkdir -p "$CERT_DIR"
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

# Check if required tools are installed
check_dependencies() {
    log "Checking dependencies..."
    
    case "$CERT_TYPE" in
        "letsencrypt")
            if ! command -v certbot &> /dev/null; then
                error "Certbot is not installed. Please install it first."
            fi
            ;;
        "self-signed")
            if ! command -v openssl &> /dev/null; then
                error "OpenSSL is not installed."
            fi
            ;;
        "custom")
            if ! command -v openssl &> /dev/null; then
                error "OpenSSL is not installed."
            fi
            ;;
    esac
    
    success "Dependencies check passed"
}

# Generate self-signed certificate
generate_self_signed() {
    log "Generating self-signed certificate for $DOMAIN..."
    
    local key_file="$CERT_DIR/$DOMAIN.key"
    local cert_file="$CERT_DIR/$DOMAIN.crt"
    local csr_file="$CERT_DIR/$DOMAIN.csr"
    
    # Generate private key
    openssl genrsa -out "$key_file" 2048
    
    # Generate certificate signing request
    openssl req -new -key "$key_file" -out "$csr_file" -subj "/C=US/ST=State/L=City/O=Organization/CN=$DOMAIN"
    
    # Generate self-signed certificate
    openssl x509 -req -days 365 -in "$csr_file" -signkey "$key_file" -out "$cert_file"
    
    # Set proper permissions
    chmod 600 "$key_file"
    chmod 644 "$cert_file"
    
    # Clean up CSR file
    rm -f "$csr_file"
    
    success "Self-signed certificate generated: $cert_file"
    warning "Self-signed certificates are not trusted by browsers and should only be used for development/testing"
}

# Generate Let's Encrypt certificate
generate_letsencrypt() {
    log "Generating Let's Encrypt certificate for $DOMAIN..."
    
    # Check if domain is accessible
    if ! nslookup "$DOMAIN" &> /dev/null; then
        error "Domain $DOMAIN is not accessible. Please ensure DNS is properly configured."
    fi
    
    # Generate certificate using certbot
    certbot certonly \
        --standalone \
        --non-interactive \
        --agree-tos \
        --email "$EMAIL" \
        --domains "$DOMAIN,www.$DOMAIN" \
        --cert-path "$CERT_DIR" \
        --key-path "$CERT_DIR" \
        --fullchain-path "$CERT_DIR" \
        --config-dir "$CERT_DIR" \
        --work-dir "$CERT_DIR/work" \
        --logs-dir "$CERT_DIR/logs"
    
    # Copy certificates to our directory
    cp "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" "$CERT_DIR/$DOMAIN.crt"
    cp "/etc/letsencrypt/live/$DOMAIN/privkey.pem" "$CERT_DIR/$DOMAIN.key"
    
    # Set proper permissions
    chmod 644 "$CERT_DIR/$DOMAIN.crt"
    chmod 600 "$CERT_DIR/$DOMAIN.key"
    
    success "Let's Encrypt certificate generated: $CERT_DIR/$DOMAIN.crt"
    log "Certificate will expire in 90 days. Set up auto-renewal with: certbot renew --dry-run"
}

# Generate custom certificate
generate_custom() {
    log "Generating custom certificate for $DOMAIN..."
    
    local key_file="$CERT_DIR/$DOMAIN.key"
    local cert_file="$CERT_DIR/$DOMAIN.crt"
    local config_file="$CERT_DIR/$DOMAIN.conf"
    
    # Create OpenSSL configuration file
    cat > "$config_file" << EOF
[req]
default_bits = 2048
prompt = no
default_md = sha256
distinguished_name = dn
req_extensions = v3_req

[dn]
C=US
ST=State
L=City
O=Organization
OU=IT Department
CN=$DOMAIN

[v3_req]
basicConstraints = CA:FALSE
keyUsage = nonRepudiation, digitalSignature, keyEncipherment
subjectAltName = @alt_names

[alt_names]
DNS.1 = $DOMAIN
DNS.2 = www.$DOMAIN
DNS.3 = api.$DOMAIN
DNS.4 = staging.$DOMAIN
EOF
    
    # Generate private key
    openssl genrsa -out "$key_file" 2048
    
    # Generate certificate signing request
    openssl req -new -key "$key_file" -out "$CERT_DIR/$DOMAIN.csr" -config "$config_file"
    
    # Generate certificate (self-signed for now)
    openssl x509 -req -days 365 -in "$CERT_DIR/$DOMAIN.csr" -signkey "$key_file" -out "$cert_file" -extensions v3_req -extfile "$config_file"
    
    # Set proper permissions
    chmod 600 "$key_file"
    chmod 644 "$cert_file"
    
    # Clean up
    rm -f "$CERT_DIR/$DOMAIN.csr"
    rm -f "$config_file"
    
    success "Custom certificate generated: $cert_file"
}

# Verify certificate
verify_certificate() {
    local cert_file="$CERT_DIR/$DOMAIN.crt"
    local key_file="$CERT_DIR/$DOMAIN.key"
    
    log "Verifying certificate..."
    
    # Check if files exist
    if [ ! -f "$cert_file" ] || [ ! -f "$key_file" ]; then
        error "Certificate files not found"
    fi
    
    # Verify certificate
    if openssl x509 -in "$cert_file" -text -noout &> /dev/null; then
        success "Certificate is valid"
    else
        error "Certificate is invalid"
    fi
    
    # Verify private key
    if openssl rsa -in "$key_file" -check -noout &> /dev/null; then
        success "Private key is valid"
    else
        error "Private key is invalid"
    fi
    
    # Check if certificate and key match
    local cert_md5=$(openssl x509 -noout -modulus -in "$cert_file" | openssl md5)
    local key_md5=$(openssl rsa -noout -modulus -in "$key_file" | openssl md5)
    
    if [ "$cert_md5" = "$key_md5" ]; then
        success "Certificate and private key match"
    else
        error "Certificate and private key do not match"
    fi
    
    # Display certificate information
    log "Certificate information:"
    openssl x509 -in "$cert_file" -text -noout | grep -E "(Subject:|Issuer:|Not Before:|Not After:|DNS:)"
}

# Setup auto-renewal for Let's Encrypt
setup_auto_renewal() {
    if [ "$CERT_TYPE" = "letsencrypt" ]; then
        log "Setting up auto-renewal for Let's Encrypt certificate..."
        
        # Create renewal script
        cat > "$CERT_DIR/renew.sh" << 'EOF'
#!/bin/bash
# Let's Encrypt certificate renewal script

DOMAIN="$1"
CERT_DIR="./nginx/ssl"

# Renew certificate
certbot renew --cert-name "$DOMAIN" --quiet

# Copy renewed certificates
cp "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" "$CERT_DIR/$DOMAIN.crt"
cp "/etc/letsencrypt/live/$DOMAIN/privkey.pem" "$CERT_DIR/$DOMAIN.key"

# Reload nginx
docker-compose exec nginx nginx -s reload

echo "Certificate renewed for $DOMAIN"
EOF
        
        chmod +x "$CERT_DIR/renew.sh"
        
        # Add to crontab (run twice daily)
        (crontab -l 2>/dev/null; echo "0 12,0 * * * $CERT_DIR/renew.sh $DOMAIN") | crontab -
        
        success "Auto-renewal setup completed"
        log "Certificate will be renewed automatically twice daily"
    fi
}

# Generate certificate chain
generate_certificate_chain() {
    log "Generating certificate chain..."
    
    local cert_file="$CERT_DIR/$DOMAIN.crt"
    local chain_file="$CERT_DIR/$DOMAIN-chain.crt"
    
    if [ ! -f "$cert_file" ]; then
        error "Certificate file not found: $cert_file"
    fi
    
    # For Let's Encrypt, the fullchain.pem already includes the chain
    if [ "$CERT_TYPE" = "letsencrypt" ]; then
        cp "$cert_file" "$chain_file"
    else
        # For other certificate types, we might need to download the intermediate certificates
        # This is a placeholder - implement based on your CA
        cp "$cert_file" "$chain_file"
    fi
    
    success "Certificate chain generated: $chain_file"
}

# Test SSL configuration
test_ssl_config() {
    log "Testing SSL configuration..."
    
    local cert_file="$CERT_DIR/$DOMAIN.crt"
    local key_file="$CERT_DIR/$DOMAIN.key"
    
    # Test with OpenSSL
    if openssl s_client -connect "$DOMAIN:443" -servername "$DOMAIN" < /dev/null 2>/dev/null | grep -q "Verify return code: 0"; then
        success "SSL connection test passed"
    else
        warning "SSL connection test failed (this is normal for self-signed certificates)"
    fi
    
    # Test certificate with OpenSSL
    if openssl verify -CAfile "$cert_file" "$cert_file" &> /dev/null; then
        success "Certificate verification passed"
    else
        warning "Certificate verification failed (this is normal for self-signed certificates)"
    fi
}

# Main execution
main() {
    local command="$1"
    
    log "Starting SSL certificate generation for domain: $DOMAIN"
    
    case "$command" in
        "generate")
            check_dependencies
            case "$CERT_TYPE" in
                "letsencrypt")
                    generate_letsencrypt
                    setup_auto_renewal
                    ;;
                "self-signed")
                    generate_self_signed
                    ;;
                "custom")
                    generate_custom
                    ;;
                *)
                    error "Invalid certificate type: $CERT_TYPE. Must be letsencrypt, self-signed, or custom"
                    ;;
            esac
            generate_certificate_chain
            verify_certificate
            test_ssl_config
            ;;
        "verify")
            verify_certificate
            ;;
        "test")
            test_ssl_config
            ;;
        "renew")
            if [ "$CERT_TYPE" = "letsencrypt" ]; then
                setup_auto_renewal
            else
                error "Auto-renewal is only available for Let's Encrypt certificates"
            fi
            ;;
        *)
            echo "Usage: $0 <domain> <email> <cert_type> <command>"
            echo ""
            echo "Arguments:"
            echo "  domain     - Domain name for the certificate"
            echo "  email      - Email address for Let's Encrypt"
            echo "  cert_type  - Certificate type: letsencrypt, self-signed, custom"
            echo "  command    - Command to execute: generate, verify, test, renew"
            echo ""
            echo "Examples:"
            echo "  $0 your-domain.com admin@your-domain.com letsencrypt generate"
            echo "  $0 your-domain.com admin@your-domain.com self-signed generate"
            echo "  $0 your-domain.com admin@your-domain.com letsencrypt verify"
            echo "  $0 your-domain.com admin@your-domain.com letsencrypt test"
            exit 1
            ;;
    esac
    
    success "SSL certificate process completed successfully"
    echo ""
    echo "Certificate files:"
    echo "  Certificate: $CERT_DIR/$DOMAIN.crt"
    echo "  Private Key: $CERT_DIR/$DOMAIN.key"
    echo "  Certificate Chain: $CERT_DIR/$DOMAIN-chain.crt"
    echo ""
    echo "Next steps:"
    echo "1. Update your nginx configuration to use these certificates"
    echo "2. Restart your nginx service"
    echo "3. Test your SSL configuration"
}

# Run main function with all arguments
main "$@"
