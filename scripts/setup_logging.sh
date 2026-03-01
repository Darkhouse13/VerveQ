#!/bin/bash
# VerveQ Platform Logging Setup Script
# Sets up proper logging directories and permissions

set -e

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Configuration
LOG_BASE_DIR="/var/log/verveq"
PROJECT_LOG_DIR="/var/www/verveq/logs"
VERVEQ_USER="verveq"
VERVEQ_GROUP="verveq"

echo -e "${YELLOW}🗂️  Setting up VerveQ logging infrastructure...${NC}"

# Function to log with timestamp
log() {
    echo -e "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

# Check if running as root
if [[ $EUID -ne 0 ]]; then
   echo -e "${RED}This script must be run as root for system log setup${NC}"
   exit 1
fi

# Create verveq user if it doesn't exist
if ! id "$VERVEQ_USER" &>/dev/null; then
    log "${YELLOW}Creating verveq user...${NC}"
    useradd -r -s /bin/bash -d /var/www/verveq -m "$VERVEQ_USER"
    log "${GREEN}✓ verveq user created${NC}"
else
    log "${GREEN}✓ verveq user already exists${NC}"
fi

# Create log directories
log "${YELLOW}Creating log directories...${NC}"

# System log directory
mkdir -p "$LOG_BASE_DIR"
chown "$VERVEQ_USER:$VERVEQ_GROUP" "$LOG_BASE_DIR"
chmod 755 "$LOG_BASE_DIR"

# Project log directory
mkdir -p "$PROJECT_LOG_DIR"
chown "$VERVEQ_USER:$VERVEQ_GROUP" "$PROJECT_LOG_DIR"
chmod 755 "$PROJECT_LOG_DIR"

# Create specific log directories
for dir in backup deploy health monitoring; do
    mkdir -p "$LOG_BASE_DIR/$dir"
    chown "$VERVEQ_USER:$VERVEQ_GROUP" "$LOG_BASE_DIR/$dir"
    chmod 755 "$LOG_BASE_DIR/$dir"
done

log "${GREEN}✓ Log directories created${NC}"

# Set up logrotate configuration
log "${YELLOW}Setting up log rotation...${NC}"

if [ -f "/var/www/verveq/logrotate/verveq" ]; then
    cp "/var/www/verveq/logrotate/verveq" "/etc/logrotate.d/verveq"
    chmod 644 "/etc/logrotate.d/verveq"
    log "${GREEN}✓ Logrotate configuration installed${NC}"
else
    log "${RED}Warning: Logrotate configuration file not found${NC}"
fi

# Test logrotate configuration
if logrotate -d /etc/logrotate.d/verveq > /dev/null 2>&1; then
    log "${GREEN}✓ Logrotate configuration is valid${NC}"
else
    log "${RED}Warning: Logrotate configuration has issues${NC}"
fi

# Set up rsyslog configuration for VerveQ
log "${YELLOW}Setting up rsyslog configuration...${NC}"

cat > /etc/rsyslog.d/30-verveq.conf << 'EOF'
# VerveQ Platform logging configuration

# PM2 logs
:programname, isequal, "verveq-backend" /var/log/verveq/backend.log
:programname, isequal, "verveq-frontend" /var/log/verveq/frontend.log
:programname, isequal, "verveq-expo-dev" /var/log/verveq/expo-dev.log

# Stop processing after matching VerveQ logs
:programname, isequal, "verveq-backend" stop
:programname, isequal, "verveq-frontend" stop
:programname, isequal, "verveq-expo-dev" stop

# High priority messages to separate log
*.err;*.warn;*.crit /var/log/verveq/errors.log

# Custom facility for VerveQ application logs
local0.*    /var/log/verveq/application.log
EOF

# Restart rsyslog to apply configuration
systemctl restart rsyslog
log "${GREEN}✓ Rsyslog configuration applied${NC}"

# Create log monitoring script
log "${YELLOW}Creating log monitoring script...${NC}"

cat > /usr/local/bin/verveq-log-monitor << 'EOF'
#!/bin/bash
# VerveQ Log Monitoring Script
# Checks for critical errors and sends alerts

LOGS_DIR="/var/log/verveq"
ERROR_LOG="$LOGS_DIR/errors.log"
ALERT_FILE="/tmp/verveq-alert-sent"
LOCKFILE="/tmp/verveq-log-monitor.lock"

# Prevent multiple instances
if [ -f "$LOCKFILE" ]; then
    exit 0
fi
touch "$LOCKFILE"
trap 'rm -f "$LOCKFILE"' EXIT

# Check for critical errors in the last 5 minutes
if [ -f "$ERROR_LOG" ]; then
    # Look for critical patterns
    CRITICAL_ERRORS=$(tail -n 100 "$ERROR_LOG" | grep -E "(CRITICAL|FATAL|Database.*failed|Connection.*refused)" | wc -l)
    
    if [ "$CRITICAL_ERRORS" -gt 0 ]; then
        # Check if alert was already sent in the last hour
        if [ ! -f "$ALERT_FILE" ] || [ $(($(date +%s) - $(stat -c %Y "$ALERT_FILE"))) -gt 3600 ]; then
            # Send alert (customize this section for your alerting system)
            echo "[$(date)] ALERT: $CRITICAL_ERRORS critical errors detected in VerveQ logs" >> "$LOGS_DIR/alerts.log"
            
            # Example: Send email alert (uncomment and configure)
            # echo "Critical errors detected in VerveQ platform" | mail -s "VerveQ Alert" admin@verveq.com
            
            # Example: Send to Slack (uncomment and configure)
            # curl -X POST -H 'Content-type: application/json' --data '{"text":"VerveQ Critical Alert: '"$CRITICAL_ERRORS"' errors detected"}' YOUR_SLACK_WEBHOOK_URL
            
            touch "$ALERT_FILE"
        fi
    fi
fi

# Clean up old alert markers
find /tmp -name "verveq-alert-*" -mtime +1 -delete 2>/dev/null || true
EOF

chmod +x /usr/local/bin/verveq-log-monitor
log "${GREEN}✓ Log monitoring script created${NC}"

# Set up cron job for log monitoring
log "${YELLOW}Setting up log monitoring cron job...${NC}"

cat > /etc/cron.d/verveq-log-monitor << 'EOF'
# VerveQ Log Monitoring - runs every 5 minutes
*/5 * * * * root /usr/local/bin/verveq-log-monitor
EOF

log "${GREEN}✓ Log monitoring cron job installed${NC}"

# Set up disk usage monitoring for logs
log "${YELLOW}Setting up disk usage monitoring...${NC}"

cat > /usr/local/bin/verveq-disk-monitor << 'EOF'
#!/bin/bash
# VerveQ Disk Usage Monitor
# Alerts when log directories are getting full

LOG_DIRS="/var/log/verveq /var/www/verveq/logs"
THRESHOLD=80  # Alert when 80% full

for dir in $LOG_DIRS; do
    if [ -d "$dir" ]; then
        usage=$(df "$dir" | tail -1 | awk '{print $5}' | sed 's/%//')
        if [ "$usage" -gt "$THRESHOLD" ]; then
            echo "[$(date)] WARNING: Log directory $dir is ${usage}% full" >> /var/log/verveq/disk-alerts.log
            
            # Clean up old log files if needed
            find "$dir" -name "*.log.*" -mtime +7 -delete 2>/dev/null || true
            find "$dir" -name "*.gz" -mtime +30 -delete 2>/dev/null || true
        fi
    fi
done
EOF

chmod +x /usr/local/bin/verveq-disk-monitor

cat > /etc/cron.d/verveq-disk-monitor << 'EOF'
# VerveQ Disk Usage Monitor - runs every hour
0 * * * * root /usr/local/bin/verveq-disk-monitor
EOF

log "${GREEN}✓ Disk usage monitoring installed${NC}"

# Create log analysis script
log "${YELLOW}Creating log analysis script...${NC}"

cat > /usr/local/bin/verveq-log-analyze << 'EOF'
#!/bin/bash
# VerveQ Log Analysis Script
# Provides log summaries and statistics

LOGS_DIR="/var/log/verveq"
PROJECT_LOGS_DIR="/var/www/verveq/logs"

echo "VerveQ Log Analysis Report - $(date)"
echo "================================================"

# PM2 logs analysis
if [ -d "$PROJECT_LOGS_DIR" ]; then
    echo ""
    echo "PM2 Logs Summary:"
    echo "-----------------"
    for log in "$PROJECT_LOGS_DIR"/*.log; do
        if [ -f "$log" ]; then
            echo "$(basename "$log"): $(wc -l < "$log") lines, $(stat -c%s "$log" | numfmt --to=iec) size"
        fi
    done
fi

# System logs analysis
if [ -d "$LOGS_DIR" ]; then
    echo ""
    echo "System Logs Summary:"
    echo "--------------------"
    for log in "$LOGS_DIR"/*.log; do
        if [ -f "$log" ]; then
            echo "$(basename "$log"): $(wc -l < "$log") lines, $(stat -c%s "$log" | numfmt --to=iec) size"
        fi
    done
    
    # Error count in the last 24 hours
    if [ -f "$LOGS_DIR/errors.log" ]; then
        echo ""
        echo "Errors in last 24 hours:"
        echo "------------------------"
        today=$(date +%Y-%m-%d)
        yesterday=$(date -d "yesterday" +%Y-%m-%d)
        grep -E "($today|$yesterday)" "$LOGS_DIR/errors.log" | wc -l || echo "0"
    fi
fi

# Disk usage for log directories
echo ""
echo "Log Directory Disk Usage:"
echo "-------------------------"
for dir in "$LOGS_DIR" "$PROJECT_LOGS_DIR"; do
    if [ -d "$dir" ]; then
        echo "$dir: $(du -sh "$dir" | cut -f1)"
    fi
done
EOF

chmod +x /usr/local/bin/verveq-log-analyze
log "${GREEN}✓ Log analysis script created${NC}"

# Set ownership and permissions
chown -R "$VERVEQ_USER:$VERVEQ_GROUP" "$LOG_BASE_DIR"
chown -R "$VERVEQ_USER:$VERVEQ_GROUP" "$PROJECT_LOG_DIR"

echo ""
log "${GREEN}🎉 Logging infrastructure setup completed!${NC}"
echo ""
echo -e "${YELLOW}Available log management commands:${NC}"
echo -e "  Log analysis: ${GREEN}/usr/local/bin/verveq-log-analyze${NC}"
echo -e "  Manual log rotation: ${GREEN}logrotate -f /etc/logrotate.d/verveq${NC}"
echo -e "  View logs: ${GREEN}tail -f $PROJECT_LOG_DIR/*.log${NC}"
echo -e "  Check disk usage: ${GREEN}df -h $LOG_BASE_DIR${NC}"
echo ""
echo -e "${YELLOW}Log directories created:${NC}"
echo -e "  System logs: ${GREEN}$LOG_BASE_DIR${NC}"
echo -e "  Application logs: ${GREEN}$PROJECT_LOG_DIR${NC}"