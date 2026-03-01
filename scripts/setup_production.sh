#!/bin/bash
# VerveQ Production Setup Script
# This script sets up the production environment

set -e

echo "🚀 VerveQ Production Setup"
echo "=========================="

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

echo -e "\n${YELLOW}1. Checking system requirements...${NC}"

# Check Python
if ! command_exists python3; then
    echo -e "${RED}Error: Python 3 is not installed${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Python 3 found: $(python3 --version)${NC}"

# Check PostgreSQL
if ! command_exists psql; then
    echo -e "${RED}Error: PostgreSQL is not installed${NC}"
    echo "Install PostgreSQL: sudo apt-get install postgresql postgresql-contrib"
    exit 1
fi
echo -e "${GREEN}✓ PostgreSQL found: $(psql --version)${NC}"

# Check Node.js
if ! command_exists node; then
    echo -e "${RED}Error: Node.js is not installed${NC}"
    echo "Install Node.js: https://nodejs.org/"
    exit 1
fi
echo -e "${GREEN}✓ Node.js found: $(node --version)${NC}"

echo -e "\n${YELLOW}2. Setting up production environment file...${NC}"

if [ ! -f ".env.production" ]; then
    echo -e "${RED}Error: .env.production file not found${NC}"
    exit 1
fi

# Generate a new JWT secret key for production
JWT_SECRET=$(python3 -c "import secrets; print(secrets.token_urlsafe(32))")
echo -e "${GREEN}✓ Generated new JWT secret key${NC}"

# Ask user for database credentials
echo -e "\n${YELLOW}3. Database configuration${NC}"
read -p "Enter PostgreSQL username (default: verveq_user): " DB_USER
DB_USER=${DB_USER:-verveq_user}

read -s -p "Enter PostgreSQL password: " DB_PASS
echo

read -p "Enter PostgreSQL host (default: localhost): " DB_HOST
DB_HOST=${DB_HOST:-localhost}

read -p "Enter PostgreSQL port (default: 5432): " DB_PORT
DB_PORT=${DB_PORT:-5432}

read -p "Enter database name (default: verveq_prod): " DB_NAME
DB_NAME=${DB_NAME:-verveq_prod}

DATABASE_URL="postgresql://${DB_USER}:${DB_PASS}@${DB_HOST}:${DB_PORT}/${DB_NAME}"

# Ask user for domain configuration
echo -e "\n${YELLOW}4. Domain configuration${NC}"
read -p "Enter your production domain (e.g., verveq.com): " DOMAIN

if [ -z "$DOMAIN" ]; then
    echo -e "${RED}Error: Domain is required for production${NC}"
    exit 1
fi

CORS_ORIGINS="https://${DOMAIN},https://www.${DOMAIN},https://api.${DOMAIN}"
API_URL="https://api.${DOMAIN}"

echo -e "\n${YELLOW}5. Creating production environment file...${NC}"

# Create production .env file
cat > .env.production << EOF
# VerveQ Platform Production Environment Configuration
ENVIRONMENT=production
HOST=0.0.0.0
PORT=8000
DEBUG=false
LOG_LEVEL=INFO

# Database Configuration
DATABASE_URL=${DATABASE_URL}

# Security Configuration
JWT_SECRET_KEY=${JWT_SECRET}
JWT_ALGORITHM=HS256
JWT_EXPIRE_MINUTES=10080

# CORS Configuration
CORS_ORIGINS=${CORS_ORIGINS}
CORS_ALLOW_CREDENTIALS=true

# Cache Configuration
CACHE_ENABLED=true
REDIS_URL=redis://localhost:6379/0
CACHE_TTL=3600

# API Configuration
API_TITLE=VerveQ Platform API
API_VERSION=3.0.0
API_DESCRIPTION=Competitive Sports Gaming Platform API

# Rate Limiting
RATE_LIMIT_ENABLED=true
RATE_LIMIT_REQUESTS_PER_MINUTE=120

# Frontend Configuration
REACT_APP_API_URL=${API_URL}
EOF

echo -e "${GREEN}✓ Production environment file created${NC}"

echo -e "\n${YELLOW}6. Installing backend dependencies...${NC}"
cd backend
pip3 install -r requirements.txt
echo -e "${GREEN}✓ Backend dependencies installed${NC}"

echo -e "\n${YELLOW}7. Running database migrations...${NC}"
if [ -f "database/migration_001_time_based_scoring.py" ]; then
    python3 database/migration_001_time_based_scoring.py
    echo -e "${GREEN}✓ Time-based scoring migration completed${NC}"
fi

if [ -f "database/migration_002_quiz_questions.py" ]; then
    python3 database/migration_002_quiz_questions.py
    echo -e "${GREEN}✓ Quiz questions migration completed${NC}"
fi

cd ..

echo -e "\n${YELLOW}8. Installing frontend dependencies...${NC}"
cd frontend
npm install
echo -e "${GREEN}✓ Frontend dependencies installed${NC}"
cd ..

echo -e "\n${YELLOW}9. Testing configuration...${NC}"
cd backend
python3 -c "
from config.settings import settings
settings.print_config_summary()
print('✅ Configuration validation passed!')
" || {
    echo -e "${RED}✗ Configuration validation failed${NC}"
    exit 1
}
cd ..

echo -e "\n${GREEN}===================================="
echo -e "✅ Production setup completed!"
echo -e "====================================${NC}"

echo -e "\n${YELLOW}Next steps:${NC}"
echo "1. Set up SSL/TLS certificates"
echo "2. Configure nginx reverse proxy"
echo "3. Set up Redis server"
echo "4. Set up monitoring and logging"
echo "5. Test the application in staging"
echo "6. Deploy to production server"

echo -e "\n${YELLOW}Important files created:${NC}"
echo "- .env.production (production environment variables)"
echo "- setup_postgres.sql (database setup script)"

echo -e "\n${YELLOW}To start the production server:${NC}"
echo "cd backend && python3 -m uvicorn main:app --host 0.0.0.0 --port 8000 --env-file ../.env.production"

echo -e "\n${YELLOW}Security reminders:${NC}"
echo "- Keep .env.production file secure and never commit it to git"
echo "- Use HTTPS for all production URLs"
echo "- Set up proper firewall rules"
echo "- Enable database backups"
echo "- Set up monitoring and alerting"