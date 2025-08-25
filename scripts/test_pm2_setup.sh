#!/bin/bash
# VerveQ Platform PM2 Setup Test Script
# Tests the PM2 configuration and deployment in development environment

set -e

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TEST_LOG="/tmp/verveq-pm2-test.log"
HEALTH_URL="http://localhost:8000/health"
BACKEND_PORT=8000

echo -e "${BLUE}🧪 VerveQ PM2 Setup Test${NC}"
echo -e "${BLUE}==========================${NC}"
echo -e "Project Root: ${YELLOW}$PROJECT_ROOT${NC}"
echo ""

# Function to log with timestamp
log() {
    local level=$1
    shift
    local message="$*"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$timestamp] $message" | tee -a "$TEST_LOG"
    
    case $level in
        "INFO")  echo -e "${BLUE}[$timestamp] $message${NC}" ;;
        "WARN")  echo -e "${YELLOW}[$timestamp] $message${NC}" ;;
        "ERROR") echo -e "${RED}[$timestamp] $message${NC}" ;;
        "SUCCESS") echo -e "${GREEN}[$timestamp] $message${NC}" ;;
    esac
}

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to wait for service
wait_for_service() {
    local url=$1
    local timeout=${2:-30}
    local interval=2
    local elapsed=0
    
    log "INFO" "Waiting for service at $url (timeout: ${timeout}s)"
    
    while [ $elapsed -lt $timeout ]; do
        if curl -s -f "$url" >/dev/null 2>&1; then
            log "SUCCESS" "Service is responding at $url"
            return 0
        fi
        
        sleep $interval
        elapsed=$((elapsed + interval))
        echo -n "."
    done
    
    echo ""
    log "ERROR" "Service did not respond within ${timeout}s"
    return 1
}

# Initialize test log
echo "VerveQ PM2 Setup Test - $(date)" > "$TEST_LOG"

cd "$PROJECT_ROOT"

# Test 1: Check prerequisites
log "INFO" "Test 1: Checking prerequisites..."

if ! command_exists pm2; then
    log "ERROR" "PM2 is not installed. Install with: npm install -g pm2"
    exit 1
fi

if ! command_exists python3; then
    log "ERROR" "Python 3 is not installed"
    exit 1
fi

if ! command_exists node; then
    log "ERROR" "Node.js is not installed"
    exit 1
fi

log "SUCCESS" "All prerequisites are installed"

# Test 2: Check project structure
log "INFO" "Test 2: Checking project structure..."

required_files=(
    "ecosystem.config.js"
    "backend/main.py"
    "backend/requirements.txt"
    "frontend/package.json"
    ".env"
)

for file in "${required_files[@]}"; do
    if [ ! -f "$file" ]; then
        log "ERROR" "Required file missing: $file"
        exit 1
    fi
done

log "SUCCESS" "Project structure is correct"

# Test 3: Check environment configuration
log "INFO" "Test 3: Checking environment configuration..."

if [ ! -f ".env" ]; then
    log "ERROR" ".env file not found"
    exit 1
fi

# Check if JWT secret is set
if grep -q "JWT_SECRET_KEY=.*[a-zA-Z0-9]" .env; then
    log "SUCCESS" "JWT secret key is configured"
else
    log "WARN" "JWT secret key not set in .env file"
fi

# Test 4: Install dependencies
log "INFO" "Test 4: Installing dependencies..."

# Backend dependencies
log "INFO" "Installing backend dependencies..."
cd backend
if [ ! -d "venv" ]; then
    python3 -m venv venv
fi

source venv/bin/activate
pip install -q -r requirements.txt
log "SUCCESS" "Backend dependencies installed"

# Frontend dependencies
log "INFO" "Installing frontend dependencies..."
cd ../frontend
if [ ! -d "node_modules" ]; then
    npm install --quiet
fi
log "SUCCESS" "Frontend dependencies installed"

cd ..

# Test 5: Validate PM2 ecosystem configuration
log "INFO" "Test 5: Validating PM2 ecosystem configuration..."

if pm2 ecosystem validate ecosystem.config.js >/dev/null 2>&1; then
    log "SUCCESS" "PM2 ecosystem configuration is valid"
else
    log "WARN" "PM2 ecosystem validation not supported (older PM2 version)"
fi

# Test 6: Stop any existing PM2 processes
log "INFO" "Test 6: Cleaning up existing PM2 processes..."
pm2 stop all >/dev/null 2>&1 || true
pm2 delete all >/dev/null 2>&1 || true
log "SUCCESS" "PM2 cleanup completed"

# Test 7: Start backend service with PM2
log "INFO" "Test 7: Starting backend service with PM2..."

# Create logs directory
mkdir -p logs

pm2 start ecosystem.config.js --only verveq-backend --env development

# Wait for backend to start
if wait_for_service "$HEALTH_URL" 30; then
    log "SUCCESS" "Backend service started successfully"
else
    log "ERROR" "Backend service failed to start"
    pm2 logs verveq-backend --lines 20
    exit 1
fi

# Test 8: Health check tests
log "INFO" "Test 8: Running health check tests..."

# Basic health check
if curl -s -f "$HEALTH_URL" >/dev/null; then
    log "SUCCESS" "Basic health check passed"
else
    log "ERROR" "Basic health check failed"
    exit 1
fi

# Detailed health check
if curl -s -f "${HEALTH_URL}/detailed" >/dev/null; then
    log "SUCCESS" "Detailed health check passed"
else
    log "WARN" "Detailed health check failed (may be due to missing dependencies)"
fi

# Readiness check
if curl -s -f "${HEALTH_URL}/ready" >/dev/null; then
    log "SUCCESS" "Readiness check passed"
else
    log "WARN" "Readiness check failed"
fi

# Test 9: API endpoint tests
log "INFO" "Test 9: Testing API endpoints..."

# Test root endpoint
if curl -s -f "http://localhost:$BACKEND_PORT/" >/dev/null; then
    log "SUCCESS" "Root API endpoint accessible"
else
    log "ERROR" "Root API endpoint failed"
fi

# Test docs endpoint
if curl -s -f "http://localhost:$BACKEND_PORT/docs" >/dev/null; then
    log "SUCCESS" "API documentation accessible"
else
    log "WARN" "API documentation not accessible"
fi

# Test 10: PM2 monitoring
log "INFO" "Test 10: Testing PM2 monitoring..."

# Check PM2 status
pm2_status=$(pm2 jlist 2>/dev/null)
if echo "$pm2_status" | grep -q "verveq-backend"; then
    log "SUCCESS" "Backend process visible in PM2"
else
    log "ERROR" "Backend process not found in PM2"
    exit 1
fi

# Check process health
if pm2 describe verveq-backend | grep -q "online"; then
    log "SUCCESS" "Backend process is online"
else
    log "ERROR" "Backend process is not online"
    exit 1
fi

# Test 11: Log file creation
log "INFO" "Test 11: Checking log files..."

if [ -f "logs/verveq-backend-out.log" ]; then
    log "SUCCESS" "Backend output log file created"
else
    log "WARN" "Backend output log file not found"
fi

# Test 12: Resource monitoring
log "INFO" "Test 12: Testing resource monitoring..."

# Get process stats
backend_pid=$(pm2 jlist | grep -A 20 verveq-backend | grep '"pid"' | head -1 | grep -o '[0-9]*')
if [ -n "$backend_pid" ]; then
    # Check if process is running
    if ps -p "$backend_pid" >/dev/null; then
        log "SUCCESS" "Backend process is running (PID: $backend_pid)"
        
        # Get memory usage
        memory_mb=$(ps -p "$backend_pid" -o rss= | awk '{print int($1/1024)}')
        log "INFO" "Backend memory usage: ${memory_mb}MB"
        
        if [ "$memory_mb" -gt 500 ]; then
            log "WARN" "Backend memory usage is high (${memory_mb}MB)"
        fi
    else
        log "ERROR" "Backend process not found"
    fi
fi

# Test 13: Restart test
log "INFO" "Test 13: Testing process restart..."

pm2 restart verveq-backend >/dev/null

# Wait for service to come back online
if wait_for_service "$HEALTH_URL" 15; then
    log "SUCCESS" "Backend restarted successfully"
else
    log "ERROR" "Backend failed to restart"
    exit 1
fi

# Final status check
log "INFO" "Final status check..."
echo ""
echo -e "${BLUE}PM2 Status:${NC}"
pm2 status

echo ""
echo -e "${BLUE}Health Check Response:${NC}"
curl -s "$HEALTH_URL" | python3 -m json.tool 2>/dev/null || curl -s "$HEALTH_URL"

echo ""
echo -e "${BLUE}Process Information:${NC}"
pm2 show verveq-backend | head -20

echo ""
log "SUCCESS" "All PM2 setup tests completed successfully!"

# Clean up (optional - comment out to keep running)
read -p "Stop PM2 processes? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    pm2 stop verveq-backend
    pm2 delete verveq-backend
    log "INFO" "PM2 processes stopped and deleted"
else
    log "INFO" "PM2 processes left running"
    echo ""
    echo -e "${YELLOW}Useful commands:${NC}"
    echo -e "  View logs: ${GREEN}pm2 logs verveq-backend${NC}"
    echo -e "  Monitor: ${GREEN}pm2 monit${NC}"
    echo -e "  Stop: ${GREEN}pm2 stop verveq-backend${NC}"
    echo -e "  Health check: ${GREEN}curl $HEALTH_URL${NC}"
fi

echo ""
echo -e "${GREEN}🎉 PM2 setup test completed successfully!${NC}"
echo -e "Test log: ${YELLOW}$TEST_LOG${NC}"