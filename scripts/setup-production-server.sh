#!/bin/bash

# FileBridge Production Server Setup Script
# This script sets up a fresh Ubuntu server for FileBridge production deployment

set -e

# Configuration
SERVER_USER="filebridge"
APP_DIR="/opt/filebridge"
LOG_DIR="/var/log/filebridge"
BACKUP_DIR="/backups"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

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
    if [[ $EUID -ne 0 ]]; then
        error "This script must be run as root"
        exit 1
    fi
}

# Update system packages
update_system() {
    log "Updating system packages..."
    
    apt-get update
    apt-get upgrade -y
    
    # Install essential packages
    apt-get install -y \
        curl \
        wget \
        git \
        vim \
        htop \
        unzip \
        software-properties-common \
        apt-transport-https \
        ca-certificates \
        gnupg \
        lsb-release \
        ufw \
        fail2ban \
        logrotate \
        cron \
        mailutils
    
    success "System packages updated"
}

# Install Docker
install_docker() {
    log "Installing Docker..."
    
    # Remove old Docker installations
    apt-get remove -y docker docker-engine docker.io containerd runc || true
    
    # Add Docker's official GPG key
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
    
    # Add Docker repository
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
    
    # Install Docker
    apt-get update
    apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
    
    # Start and enable Docker
    systemctl start docker
    systemctl enable docker
    
    # Install Docker Compose
    curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    chmod +x /usr/local/bin/docker-compose
    
    success "Docker installed successfully"
}

# Install Node.js
install_nodejs() {
    log "Installing Node.js..."
    
    # Add NodeSource repository
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
    
    # Install Node.js
    apt-get install -y nodejs
    
    # Install global npm packages
    npm install -g pm2
    
    success "Node.js installed successfully"
}

# Install PostgreSQL client
install_postgresql_client() {
    log "Installing PostgreSQL client..."
    
    apt-get install -y postgresql-client
    
    success "PostgreSQL client installed"
}

# Create application user
create_user() {
    log "Creating application user..."
    
    # Create user if it doesn't exist
    if ! id "$SERVER_USER" &>/dev/null; then
        useradd -m -s /bin/bash "$SERVER_USER"
        usermod -aG docker "$SERVER_USER"
        usermod -aG sudo "$SERVER_USER"
        success "User $SERVER_USER created"
    else
        warning "User $SERVER_USER already exists"
    fi
    
    # Create application directories
    mkdir -p "$APP_DIR" "$LOG_DIR" "$BACKUP_DIR"
    chown -R "$SERVER_USER:$SERVER_USER" "$APP_DIR" "$LOG_DIR" "$BACKUP_DIR"
    
    success "Application directories created"
}

# Configure firewall
configure_firewall() {
    log "Configuring firewall..."
    
    # Reset UFW
    ufw --force reset
    
    # Default policies
    ufw default deny incoming
    ufw default allow outgoing
    
    # Allow SSH
    ufw allow ssh
    
    # Allow HTTP and HTTPS
    ufw allow 80/tcp
    ufw allow 443/tcp
    
    # Allow application port (if not behind reverse proxy)
    # ufw allow 3001/tcp
    
    # Enable firewall
    ufw --force enable
    
    success "Firewall configured"
}

# Configure fail2ban
configure_fail2ban() {
    log "Configuring fail2ban..."
    
    # Create jail.local
    cat > /etc/fail2ban/jail.local << EOF
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 3

[sshd]
enabled = true
port = ssh
logpath = /var/log/auth.log
maxretry = 3

[nginx-http-auth]
enabled = true
filter = nginx-http-auth
port = http,https
logpath = /var/log/nginx/error.log

[nginx-limit-req]
enabled = true
filter = nginx-limit-req
port = http,https
logpath = /var/log/nginx/error.log
maxretry = 10
EOF
    
    # Restart fail2ban
    systemctl restart fail2ban
    systemctl enable fail2ban
    
    success "Fail2ban configured"
}

# Configure log rotation
configure_log_rotation() {
    log "Configuring log rotation..."
    
    # Create logrotate configuration for application
    cat > /etc/logrotate.d/filebridge << EOF
$LOG_DIR/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 644 $SERVER_USER $SERVER_USER
    postrotate
        systemctl reload filebridge-api || true
    endscript
}

/var/log/nginx/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 644 www-data www-data
    postrotate
        systemctl reload nginx || true
    endscript
}
EOF
    
    success "Log rotation configured"
}

# Setup SSL certificates
setup_ssl() {
    log "Setting up SSL certificates..."
    
    # Install Certbot
    apt-get install -y certbot python3-certbot-nginx
    
    # Create SSL directory
    mkdir -p /etc/nginx/ssl
    
    success "SSL setup prepared (run certbot after DNS is configured)"
}

# Configure system monitoring
configure_monitoring() {
    log "Configuring system monitoring..."
    
    # Install monitoring tools
    apt-get install -y htop iotop nethogs
    
    # Create monitoring script
    cat > /usr/local/bin/system-monitor.sh << 'EOF'
#!/bin/bash

# System monitoring script
LOG_FILE="/var/log/system-monitor.log"
DATE=$(date '+%Y-%m-%d %H:%M:%S')

# Get system metrics
CPU_USAGE=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | awk -F'%' '{print $1}')
MEMORY_USAGE=$(free | grep Mem | awk '{printf("%.2f"), $3/$2 * 100.0}')
DISK_USAGE=$(df -h / | awk 'NR==2{print $5}' | sed 's/%//')
LOAD_AVERAGE=$(uptime | awk -F'load average:' '{print $2}')

# Log metrics
echo "$DATE - CPU: ${CPU_USAGE}%, Memory: ${MEMORY_USAGE}%, Disk: ${DISK_USAGE}%, Load: $LOAD_AVERAGE" >> $LOG_FILE

# Alert if thresholds exceeded
if (( $(echo "$CPU_USAGE > 80" | bc -l) )); then
    echo "$DATE - ALERT: High CPU usage: ${CPU_USAGE}%" >> $LOG_FILE
fi

if (( $(echo "$MEMORY_USAGE > 85" | bc -l) )); then
    echo "$DATE - ALERT: High memory usage: ${MEMORY_USAGE}%" >> $LOG_FILE
fi

if [ "$DISK_USAGE" -gt 90 ]; then
    echo "$DATE - ALERT: High disk usage: ${DISK_USAGE}%" >> $LOG_FILE
fi
EOF
    
    chmod +x /usr/local/bin/system-monitor.sh
    
    # Add to crontab
    (crontab -l 2>/dev/null; echo "*/5 * * * * /usr/local/bin/system-monitor.sh") | crontab -
    
    success "System monitoring configured"
}

# Setup automated backups
setup_backups() {
    log "Setting up automated backups..."
    
    # Create backup script
    cat > /usr/local/bin/backup-filebridge.sh << 'EOF'
#!/bin/bash

BACKUP_DIR="/backups"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/filebridge_backup_$DATE.tar.gz"

# Create backup
cd /opt/filebridge
tar -czf "$BACKUP_FILE" \
    --exclude='node_modules' \
    --exclude='.git' \
    --exclude='logs' \
    --exclude='uploads' \
    .

# Keep only last 7 days of backups
find "$BACKUP_DIR" -name "filebridge_backup_*.tar.gz" -mtime +7 -delete

echo "Backup completed: $BACKUP_FILE"
EOF
    
    chmod +x /usr/local/bin/backup-filebridge.sh
    
    # Add to crontab (daily at 2 AM)
    (crontab -l 2>/dev/null; echo "0 2 * * * /usr/local/bin/backup-filebridge.sh") | crontab -
    
    success "Automated backups configured"
}

# Configure systemd service
configure_systemd() {
    log "Configuring systemd service..."
    
    # Create systemd service file
    cat > /etc/systemd/system/filebridge-api.service << EOF
[Unit]
Description=FileBridge API Service
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=$APP_DIR
ExecStart=/usr/local/bin/docker-compose -f docker-compose.production.yml up -d
ExecStop=/usr/local/bin/docker-compose -f docker-compose.production.yml down
TimeoutStartSec=0
User=$SERVER_USER
Group=$SERVER_USER

[Install]
WantedBy=multi-user.target
EOF
    
    # Reload systemd and enable service
    systemctl daemon-reload
    systemctl enable filebridge-api
    
    success "Systemd service configured"
}

# Setup environment file template
setup_environment_template() {
    log "Setting up environment file template..."
    
    # Copy environment template
    if [[ -f "$APP_DIR/env.production" ]]; then
        cp "$APP_DIR/env.production" "$APP_DIR/.env.production.template"
    fi
    
    success "Environment template created"
}

# Final system optimization
optimize_system() {
    log "Optimizing system..."
    
    # Increase file limits
    cat >> /etc/security/limits.conf << EOF
* soft nofile 65536
* hard nofile 65536
* soft nproc 65536
* hard nproc 65536
EOF
    
    # Optimize kernel parameters
    cat >> /etc/sysctl.conf << EOF
# Network optimizations
net.core.rmem_max = 16777216
net.core.wmem_max = 16777216
net.ipv4.tcp_rmem = 4096 65536 16777216
net.ipv4.tcp_wmem = 4096 65536 16777216
net.core.netdev_max_backlog = 5000
net.ipv4.tcp_congestion_control = bbr

# File system optimizations
fs.file-max = 2097152
vm.swappiness = 10
EOF
    
    # Apply sysctl changes
    sysctl -p
    
    success "System optimized"
}

# Main setup function
main() {
    log "Starting FileBridge production server setup..."
    
    check_root
    update_system
    install_docker
    install_nodejs
    install_postgresql_client
    create_user
    configure_firewall
    configure_fail2ban
    configure_log_rotation
    setup_ssl
    configure_monitoring
    setup_backups
    configure_systemd
    setup_environment_template
    optimize_system
    
    success "Production server setup completed!"
    
    log "Next steps:"
    log "1. Clone your FileBridge repository to $APP_DIR"
    log "2. Copy and configure .env.production file"
    log "3. Run the deployment script: ./scripts/deploy-production.sh"
    log "4. Configure SSL certificates with: certbot --nginx"
    log "5. Set up DNS records to point to this server"
    
    log "Server is ready for FileBridge deployment!"
}

# Run main function
main "$@"
