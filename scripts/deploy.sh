#!/bin/bash
# VerveQ Platform PM2 Deployment Script
# Automated deployment with health checks and rollback capability

set -e

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_NAME="verveq"
PROJECT_PATH="/var/www/verveq"
BACKUP_PATH="/var/backups/verveq"
LOG_PATH="/var/log/verveq"
ENVIRONMENT=${1:-development}
MAX_HEALTH_RETRIES=30
HEALTH_CHECK_INTERVAL=2

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo -e "${BLUE}🚀 VerveQ Platform PM2 Deployment${NC}"
echo -e "${BLUE}===================================${NC}"
echo -e "Environment: ${YELLOW}$ENVIRONMENT${NC}"
echo -e "Project Path: ${YELLOW}$PROJECT_ROOT${NC}"
echo ""

# Function to log with timestamp
log() {
    echo -e "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to check service health
check_health() {
    local service_name=$1
    local health_url=$2
    local retries=0
    
    log "${YELLOW}Checking health of $service_name...${NC}"
    
    while [ $retries -lt $MAX_HEALTH_RETRIES ]; do
        if curl -s -f "$health_url" > /dev/null 2>&1; then
            log "${GREEN}✓ $service_name is healthy${NC}"
            return 0
        fi
        
        retries=$((retries + 1))
        log "Health check attempt $retries/$MAX_HEALTH_RETRIES for $service_name..."
        sleep $HEALTH_CHECK_INTERVAL
    done
    
    log "${RED}✗ $service_name health check failed after $MAX_HEALTH_RETRIES attempts${NC}"
    return 1
}

# Function to create backup
create_backup() {
    log "${YELLOW}Creating backup...${NC}"
    
    if [ -d "$PROJECT_PATH" ]; then
        local backup_name="verveq-backup-$(date +%Y%m%d-%H%M%S)"
        local backup_full_path="$BACKUP_PATH/$backup_name"
        
        mkdir -p "$BACKUP_PATH"
        cp -r "$PROJECT_PATH" "$backup_full_path"
        
        # Keep only last 5 backups
        cd "$BACKUP_PATH"
        ls -t | tail -n +6 | xargs -I {} rm -rf {}
        
        log "${GREEN}✓ Backup created: $backup_full_path${NC}"
        echo "$backup_full_path" > /tmp/verveq-last-backup
    fi
}

# Function to rollback
rollback() {
    log "${RED}🔄 Initiating rollback...${NC}"
    
    if [ -f /tmp/verveq-last-backup ]; then
        local backup_path=$(cat /tmp/verveq-last-backup)
        if [ -d "$backup_path" ]; then
            rm -rf "$PROJECT_PATH"
            cp -r "$backup_path" "$PROJECT_PATH"
            
            # Restart services
            pm2 reload ecosystem.config.js --env $ENVIRONMENT
            
            log "${GREEN}✓ Rollback completed${NC}"
            return 0
        fi
    fi
    
    log "${RED}✗ Rollback failed - no valid backup found${NC}"
    return 1
}

# Trap to handle failures
trap 'echo -e "${RED}Deployment failed. Initiating rollback...${NC}"; rollback' ERR

# Check prerequisites
log "${YELLOW}Checking prerequisites...${NC}"

# Check PM2
if ! command_exists pm2; then
    log "${RED}Error: PM2 is not installed${NC}"
    echo "Install PM2: npm install -g pm2"
    exit 1
fi

# Check Python
if ! command_exists python3; then
    log "${RED}Error: Python 3 is not installed${NC}"
    exit 1
fi

# Check Node.js
if ! command_exists node; then
    log "${RED}Error: Node.js is not installed${NC}"
    exit 1
fi

log "${GREEN}✓ Prerequisites check passed${NC}"

# Create necessary directories
log "${YELLOW}Setting up directories...${NC}"
mkdir -p "$LOG_PATH"
mkdir -p "$PROJECT_ROOT/logs"

# Create backup before deployment
create_backup

# Stop existing PM2 processes
log "${YELLOW}Stopping existing services...${NC}"
pm2 stop ecosystem.config.js 2>/dev/null || log "No existing PM2 processes to stop"

# Install/update backend dependencies
log "${YELLOW}Installing backend dependencies...${NC}"
cd "$PROJECT_ROOT/backend"

# Create virtual environment if it doesn't exist
if [ ! -d "venv" ]; then
    python3 -m venv venv
    log "${GREEN}✓ Virtual environment created${NC}"
fi

# Activate virtual environment and install dependencies
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt

if [ "$ENVIRONMENT" = "development" ]; then
    pip install -r requirements-dev.txt
fi

log "${GREEN}✓ Backend dependencies installed${NC}"

# Install/update frontend dependencies
log "${YELLOW}Installing frontend dependencies...${NC}"
cd "$PROJECT_ROOT/frontend"
npm ci --only=production

if [ "$ENVIRONMENT" != "production" ]; then
    npm ci
fi

log "${GREEN}✓ Frontend dependencies installed${NC}"

# Run database migrations
log "${YELLOW}Running database migrations...${NC}"
cd "$PROJECT_ROOT/backend"
source venv/bin/activate

# Check if migration scripts exist and run them
for migration in database/migration_*.py; do
    if [ -f "$migration" ]; then
        log "Running migration: $migration"
        python3 "$migration"
    fi
done

log "${GREEN}✓ Database migrations completed${NC}"

# Run tests in staging/production
if [ "$ENVIRONMENT" != "development" ]; then
    log "${YELLOW}Running tests...${NC}"
    cd "$PROJECT_ROOT"
    ./run_tests.sh --backend-only
    log "${GREEN}✓ Tests passed${NC}"
fi

# Build frontend for production
if [ "$ENVIRONMENT" = "production" ]; then
    log "${YELLOW}Building frontend for production...${NC}"
    cd "$PROJECT_ROOT/frontend"
    npm run build
    log "${GREEN}✓ Frontend build completed${NC}"
fi

# Start services with PM2
log "${YELLOW}Starting services with PM2...${NC}"
cd "$PROJECT_ROOT"

# Start services based on environment
if [ "$ENVIRONMENT" = "development" ]; then
    # Development: start backend and expo dev server
    pm2 start ecosystem.config.js --only verveq-backend --env development
    pm2 start ecosystem.config.js --only verveq-expo-dev --env development
else
    # Production/Staging: start backend and web frontend
    pm2 start ecosystem.config.js --only verveq-backend --env $ENVIRONMENT
    pm2 start ecosystem.config.js --only verveq-frontend-web --env $ENVIRONMENT
fi

log "${GREEN}✓ PM2 services started${NC}"

# Wait for services to fully start
log "${YELLOW}Waiting for services to initialize...${NC}"
sleep 10

# Health checks
log "${YELLOW}Performing health checks...${NC}"

# Backend health check
BACKEND_PORT=$(pm2 show verveq-backend | grep -oE 'PORT.*[0-9]+' | grep -oE '[0-9]+' || echo "8000")
if ! check_health "Backend API" "http://localhost:$BACKEND_PORT/health"; then
    log "${RED}✗ Backend health check failed${NC}"
    exit 1
fi

# Frontend health check (only for production)
if [ "$ENVIRONMENT" = "production" ]; then
    if ! check_health "Frontend" "http://localhost:3000"; then
        log "${RED}✗ Frontend health check failed${NC}"
        exit 1
    fi
fi

# Save PM2 configuration
pm2 save

# Setup PM2 startup script (if not already done)
if ! pm2 startup | grep -q "already"; then
    log "${YELLOW}Setting up PM2 startup script...${NC}"
    pm2 startup systemd -u $USER --hp $HOME
fi

# Display status
log "${GREEN}Deployment completed successfully!${NC}"
echo ""
echo -e "${BLUE}Service Status:${NC}"
pm2 status

echo ""
echo -e "${BLUE}Health Check URLs:${NC}"
echo -e "Backend API: ${YELLOW}http://localhost:$BACKEND_PORT/health${NC}"
echo -e "API Docs: ${YELLOW}http://localhost:$BACKEND_PORT/docs${NC}"

if [ "$ENVIRONMENT" = "production" ]; then
    echo -e "Frontend: ${YELLOW}http://localhost:3000${NC}"
fi

echo ""
echo -e "${BLUE}Useful Commands:${NC}"
echo -e "View logs: ${YELLOW}pm2 logs${NC}"
echo -e "Monitor services: ${YELLOW}pm2 monit${NC}"
echo -e "Restart services: ${YELLOW}pm2 reload ecosystem.config.js --env $ENVIRONMENT${NC}"
echo -e "Stop services: ${YELLOW}pm2 stop ecosystem.config.js${NC}"

# Clean up trap
trap - ERR

log "${GREEN}🎉 Deployment successful!${NC}"