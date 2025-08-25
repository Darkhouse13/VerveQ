#!/bin/bash
# VerveQ Platform Monitoring Script
# Comprehensive health monitoring with alerting

set -e

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
BACKEND_HOST="localhost"
BACKEND_PORT="8000"
FRONTEND_HOST="localhost" 
FRONTEND_PORT="3000"
HEALTH_TIMEOUT=10
LOG_FILE="/var/log/verveq/monitoring.log"
ALERT_LOG="/var/log/verveq/alerts.log"
CONFIG_FILE="/etc/verveq/monitoring.conf"

# Default thresholds (can be overridden in config file)
CPU_THRESHOLD=80
MEMORY_THRESHOLD=85
DISK_THRESHOLD=90
RESPONSE_TIME_THRESHOLD=5000  # milliseconds

# Load configuration if exists
if [ -f "$CONFIG_FILE" ]; then
    source "$CONFIG_FILE"
fi

# Function to log with timestamp
log() {
    local level=$1
    shift
    local message="$*"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$timestamp] [$level] $message" | tee -a "$LOG_FILE"
    
    # Also echo to stdout with colors
    case $level in
        "INFO")  echo -e "${BLUE}[$timestamp] [INFO] $message${NC}" ;;
        "WARN")  echo -e "${YELLOW}[$timestamp] [WARN] $message${NC}" ;;
        "ERROR") echo -e "${RED}[$timestamp] [ERROR] $message${NC}" ;;
        "SUCCESS") echo -e "${GREEN}[$timestamp] [SUCCESS] $message${NC}" ;;
    esac
}

# Function to send alert
send_alert() {
    local alert_type=$1
    local message=$2
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    echo "[$timestamp] ALERT [$alert_type]: $message" >> "$ALERT_LOG"
    log "ERROR" "ALERT [$alert_type]: $message"
    
    # Add your alerting mechanism here
    # Examples:
    
    # Email alert (requires mailutils)
    # echo "$message" | mail -s "VerveQ Alert: $alert_type" admin@verveq.com
    
    # Slack webhook (requires curl)
    # curl -X POST -H 'Content-type: application/json' \
    #   --data "{\"text\":\"VerveQ Alert [$alert_type]: $message\"}" \
    #   "$SLACK_WEBHOOK_URL"
    
    # Discord webhook (requires curl)
    # curl -X POST -H 'Content-type: application/json' \
    #   --data "{\"content\":\"VerveQ Alert [$alert_type]: $message\"}" \
    #   "$DISCORD_WEBHOOK_URL"
    
    # PagerDuty (requires curl and PD integration key)
    # curl -X POST -H 'Content-type: application/json' \
    #   -H "Authorization: Token token=$PAGERDUTY_TOKEN" \
    #   --data "{\"routing_key\":\"$PD_INTEGRATION_KEY\",\"event_action\":\"trigger\",\"payload\":{\"summary\":\"$message\",\"severity\":\"error\"}}" \
    #   "https://events.pagerduty.com/v2/enqueue"
}

# Function to check HTTP endpoint
check_endpoint() {
    local name=$1
    local url=$2
    local expected_status=${3:-200}
    
    log "INFO" "Checking $name endpoint: $url"
    
    # Use curl with timeout and get both status and response time
    local start_time=$(date +%s%3N)
    local response=$(curl -s -w "HTTPSTATUS:%{http_code}\nTIME:%{time_total}" \
        --connect-timeout $HEALTH_TIMEOUT \
        --max-time $HEALTH_TIMEOUT \
        "$url" || echo "HTTPSTATUS:000\nTIME:999")
    local end_time=$(date +%s%3N)
    
    local http_status=$(echo "$response" | grep "HTTPSTATUS:" | cut -d: -f2)
    local response_time=$(echo "$response" | grep "TIME:" | cut -d: -f2)
    local response_time_ms=$(echo "$response_time * 1000" | bc -l | cut -d. -f1)
    
    if [ "$http_status" = "$expected_status" ]; then
        log "SUCCESS" "$name is healthy (${http_status}, ${response_time_ms}ms)"
        
        # Check if response time is acceptable
        if [ "$response_time_ms" -gt "$RESPONSE_TIME_THRESHOLD" ]; then
            send_alert "SLOW_RESPONSE" "$name response time is ${response_time_ms}ms (threshold: ${RESPONSE_TIME_THRESHOLD}ms)"
        fi
        
        return 0
    else
        log "ERROR" "$name is unhealthy (Status: $http_status, Response time: ${response_time_ms}ms)"
        send_alert "SERVICE_DOWN" "$name returned status $http_status instead of $expected_status"
        return 1
    fi
}

# Function to check PM2 processes
check_pm2_processes() {
    log "INFO" "Checking PM2 processes..."
    
    if ! command -v pm2 >/dev/null 2>&1; then
        log "ERROR" "PM2 not found"
        send_alert "PM2_MISSING" "PM2 is not installed or not in PATH"
        return 1
    fi
    
    # Get PM2 status in JSON format
    local pm2_status=$(pm2 jlist 2>/dev/null)
    
    if [ -z "$pm2_status" ] || [ "$pm2_status" = "[]" ]; then
        log "ERROR" "No PM2 processes running"
        send_alert "NO_PROCESSES" "No PM2 processes are running"
        return 1
    fi
    
    # Check specific processes
    local processes=("verveq-backend" "verveq-frontend-web" "verveq-expo-dev")
    local healthy_processes=0
    
    for process in "${processes[@]}"; do
        local status=$(echo "$pm2_status" | jq -r ".[] | select(.name==\"$process\") | .pm2_env.status" 2>/dev/null)
        
        if [ "$status" = "online" ]; then
            log "SUCCESS" "PM2 process $process is online"
            ((healthy_processes++))
        elif [ "$status" = "stopped" ] && [[ "$process" != *"expo-dev"* ]]; then
            # Expo dev is optional in production
            log "ERROR" "PM2 process $process is stopped"
            send_alert "PROCESS_STOPPED" "PM2 process $process is not running"
        elif [ -n "$status" ]; then
            log "WARN" "PM2 process $process status: $status"
        else
            log "INFO" "PM2 process $process not found (may be optional)"
        fi
    done
    
    return $((healthy_processes > 0 ? 0 : 1))
}

# Function to check system resources
check_system_resources() {
    log "INFO" "Checking system resources..."
    
    # CPU usage
    local cpu_usage=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | sed 's/%us,//')
    cpu_usage=$(echo "$cpu_usage" | cut -d'%' -f1)
    
    if (( $(echo "$cpu_usage > $CPU_THRESHOLD" | bc -l) )); then
        send_alert "HIGH_CPU" "CPU usage is ${cpu_usage}% (threshold: ${CPU_THRESHOLD}%)"
    else
        log "SUCCESS" "CPU usage: ${cpu_usage}%"
    fi
    
    # Memory usage
    local memory_info=$(free | grep Mem)
    local total_mem=$(echo $memory_info | awk '{print $2}')
    local used_mem=$(echo $memory_info | awk '{print $3}')
    local memory_usage=$(echo "scale=2; $used_mem * 100 / $total_mem" | bc)
    
    if (( $(echo "$memory_usage > $MEMORY_THRESHOLD" | bc -l) )); then
        send_alert "HIGH_MEMORY" "Memory usage is ${memory_usage}% (threshold: ${MEMORY_THRESHOLD}%)"
    else
        log "SUCCESS" "Memory usage: ${memory_usage}%"
    fi
    
    # Disk usage
    local disk_usage=$(df / | tail -1 | awk '{print $5}' | sed 's/%//')
    
    if [ "$disk_usage" -gt "$DISK_THRESHOLD" ]; then
        send_alert "HIGH_DISK" "Disk usage is ${disk_usage}% (threshold: ${DISK_THRESHOLD}%)"
    else
        log "SUCCESS" "Disk usage: ${disk_usage}%"
    fi
    
    # Load average
    local load_avg=$(uptime | awk -F'load average:' '{print $2}' | awk '{print $1}' | sed 's/,//')
    local cpu_cores=$(nproc)
    local load_threshold=$(echo "$cpu_cores * 2" | bc)
    
    if (( $(echo "$load_avg > $load_threshold" | bc -l) )); then
        send_alert "HIGH_LOAD" "Load average is $load_avg (threshold: $load_threshold for $cpu_cores cores)"
    else
        log "SUCCESS" "Load average: $load_avg"
    fi
}

# Function to check database connectivity
check_database() {
    log "INFO" "Checking database connectivity..."
    
    # Try to connect via health endpoint which tests database
    if check_endpoint "Database (via API)" "http://$BACKEND_HOST:$BACKEND_PORT/health/detailed"; then
        return 0
    else
        # Direct database check if API is down
        local db_url=$(grep DATABASE_URL /var/www/verveq/.env.production 2>/dev/null | cut -d= -f2)
        
        if [ -n "$db_url" ] && [[ "$db_url" == postgresql* ]]; then
            # PostgreSQL check
            if command -v psql >/dev/null 2>&1; then
                if psql "$db_url" -c "SELECT 1;" >/dev/null 2>&1; then
                    log "SUCCESS" "Database direct connection successful"
                    return 0
                else
                    log "ERROR" "Database direct connection failed"
                    send_alert "DATABASE_DOWN" "Direct database connection failed"
                    return 1
                fi
            fi
        else
            # SQLite check
            local sqlite_path="/var/www/verveq/backend/verveq_platform.db"
            if [ -f "$sqlite_path" ]; then
                if sqlite3 "$sqlite_path" "SELECT 1;" >/dev/null 2>&1; then
                    log "SUCCESS" "SQLite database accessible"
                    return 0
                else
                    log "ERROR" "SQLite database check failed"
                    send_alert "DATABASE_ERROR" "SQLite database is not accessible"
                    return 1
                fi
            fi
        fi
        
        return 1
    fi
}

# Function to check log files for errors
check_logs_for_errors() {
    log "INFO" "Checking recent log entries for critical errors..."
    
    local log_dirs=("/var/log/verveq" "/var/www/verveq/logs")
    local error_count=0
    local critical_patterns=("CRITICAL" "FATAL" "Exception" "Error:" "Failed to" "Connection refused")
    
    for log_dir in "${log_dirs[@]}"; do
        if [ -d "$log_dir" ]; then
            for pattern in "${critical_patterns[@]}"; do
                # Check last 100 lines of all log files
                local matches=$(find "$log_dir" -name "*.log" -type f -exec tail -n 100 {} \; 2>/dev/null | grep -i "$pattern" | wc -l)
                if [ "$matches" -gt 0 ]; then
                    ((error_count += matches))
                fi
            done
        fi
    done
    
    if [ "$error_count" -gt 10 ]; then
        send_alert "HIGH_ERROR_RATE" "Found $error_count critical log entries in recent logs"
    elif [ "$error_count" -gt 0 ]; then
        log "WARN" "Found $error_count error entries in recent logs"
    else
        log "SUCCESS" "No critical errors found in recent logs"
    fi
}

# Function to generate monitoring report
generate_report() {
    local report_file="/tmp/verveq-monitoring-report-$(date +%Y%m%d-%H%M%S).txt"
    
    echo "VerveQ Platform Monitoring Report" > "$report_file"
    echo "Generated: $(date)" >> "$report_file"
    echo "=================================" >> "$report_file"
    echo "" >> "$report_file"
    
    # System information
    echo "System Information:" >> "$report_file"
    echo "- Hostname: $(hostname)" >> "$report_file"
    echo "- Uptime: $(uptime)" >> "$report_file"
    echo "- Load: $(cat /proc/loadavg)" >> "$report_file"
    echo "" >> "$report_file"
    
    # PM2 status
    echo "PM2 Status:" >> "$report_file"
    pm2 status >> "$report_file" 2>&1 || echo "PM2 not available" >> "$report_file"
    echo "" >> "$report_file"
    
    # Recent alerts
    echo "Recent Alerts (last 24 hours):" >> "$report_file"
    if [ -f "$ALERT_LOG" ]; then
        grep "$(date +%Y-%m-%d)" "$ALERT_LOG" | tail -10 >> "$report_file"
    else
        echo "No alerts file found" >> "$report_file"
    fi
    
    echo "$report_file"
}

# Main monitoring function
main() {
    local mode=${1:-"check"}
    local exit_code=0
    
    case $mode in
        "check")
            log "INFO" "Starting VerveQ platform health check..."
            
            # Create log directory if it doesn't exist
            mkdir -p "$(dirname "$LOG_FILE")"
            mkdir -p "$(dirname "$ALERT_LOG")"
            
            # Run all checks
            check_system_resources || ((exit_code++))
            check_pm2_processes || ((exit_code++))
            check_endpoint "Backend API" "http://$BACKEND_HOST:$BACKEND_PORT/health" || ((exit_code++))
            check_database || ((exit_code++))
            check_logs_for_errors
            
            # Optional frontend check (only in production)
            if pm2 list | grep -q "verveq-frontend-web.*online"; then
                check_endpoint "Frontend Web" "http://$FRONTEND_HOST:$FRONTEND_PORT" || ((exit_code++))
            fi
            
            if [ $exit_code -eq 0 ]; then
                log "SUCCESS" "All health checks passed!"
            else
                log "ERROR" "Health check completed with $exit_code issues"
            fi
            ;;
            
        "report")
            local report_file=$(generate_report)
            log "INFO" "Monitoring report generated: $report_file"
            cat "$report_file"
            ;;
            
        "alerts")
            log "INFO" "Checking recent alerts..."
            if [ -f "$ALERT_LOG" ]; then
                tail -20 "$ALERT_LOG"
            else
                log "INFO" "No alerts file found"
            fi
            ;;
            
        *)
            echo "Usage: $0 {check|report|alerts}"
            echo "  check  - Run health checks (default)"
            echo "  report - Generate monitoring report"
            echo "  alerts - Show recent alerts"
            exit 1
            ;;
    esac
    
    exit $exit_code
}

# Install required dependencies if not present
if ! command -v bc >/dev/null 2>&1; then
    log "WARN" "Installing bc for calculations..."
    apt-get update && apt-get install -y bc
fi

if ! command -v jq >/dev/null 2>&1; then
    log "WARN" "Installing jq for JSON parsing..."
    apt-get update && apt-get install -y jq
fi

# Run main function with all arguments
main "$@"