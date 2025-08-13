#!/bin/bash
# VerveQ Test Runner Script

set -e

echo "🧪 VerveQ Platform Test Suite Runner"
echo "===================================="

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Default values
RUN_BACKEND=true
RUN_FRONTEND=true
RUN_COVERAGE=false
RUN_LINT=false

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --backend-only)
            RUN_FRONTEND=false
            shift
            ;;
        --frontend-only)
            RUN_BACKEND=false
            shift
            ;;
        --coverage)
            RUN_COVERAGE=true
            shift
            ;;
        --lint)
            RUN_LINT=true
            shift
            ;;
        --help)
            echo "Usage: $0 [options]"
            echo "Options:"
            echo "  --backend-only    Run only backend tests"
            echo "  --frontend-only   Run only frontend tests"
            echo "  --coverage        Generate coverage reports"
            echo "  --lint            Run linting checks"
            echo "  --help            Show this help message"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Run backend tests
if [ "$RUN_BACKEND" = true ]; then
    echo -e "\n${YELLOW}Running Backend Tests...${NC}"
    echo "------------------------"
    
    if ! command_exists pytest; then
        echo -e "${RED}Error: pytest not found. Please install backend dependencies:${NC}"
        echo "cd backend && pip install -r requirements-dev.txt"
        exit 1
    fi
    
    cd backend
    
    if [ "$RUN_LINT" = true ]; then
        echo -e "\n${YELLOW}Running Python linting...${NC}"
        flake8 . --count --select=E9,F63,F7,F82 --show-source --statistics || true
        echo -e "${GREEN}✓ Linting complete${NC}"
    fi
    
    if [ "$RUN_COVERAGE" = true ]; then
        python -m pytest ../tests/backend/ -v --cov=. --cov-report=html --cov-report=term
        echo -e "\n${GREEN}✓ Backend coverage report generated in: backend/htmlcov/index.html${NC}"
    else
        python -m pytest ../tests/backend/ -v
    fi
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Backend tests passed!${NC}"
    else
        echo -e "${RED}✗ Backend tests failed${NC}"
        exit 1
    fi
    
    cd ..
fi

# Run frontend tests
if [ "$RUN_FRONTEND" = true ]; then
    echo -e "\n${YELLOW}Running Frontend Tests...${NC}"
    echo "-------------------------"
    
    if ! command_exists npm; then
        echo -e "${RED}Error: npm not found. Please install Node.js${NC}"
        exit 1
    fi
    
    cd frontend
    
    # Check if node_modules exists
    if [ ! -d "node_modules" ]; then
        echo -e "${YELLOW}Installing frontend dependencies...${NC}"
        npm install
    fi
    
    if [ "$RUN_COVERAGE" = true ]; then
        npm run test:coverage
        echo -e "\n${GREEN}✓ Frontend coverage report generated in: coverage/lcov-report/index.html${NC}"
    else
        npm test -- --watchAll=false
    fi
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Frontend tests passed!${NC}"
    else
        echo -e "${RED}✗ Frontend tests failed${NC}"
        exit 1
    fi
    
    cd ..
fi

# Summary
echo -e "\n${GREEN}===================================="
echo -e "✅ All tests completed successfully!"
echo -e "====================================${NC}"

if [ "$RUN_COVERAGE" = true ]; then
    echo -e "\nCoverage Reports:"
    [ "$RUN_BACKEND" = true ] && echo "- Backend: backend/htmlcov/index.html"
    [ "$RUN_FRONTEND" = true ] && echo "- Frontend: frontend/coverage/lcov-report/index.html"
fi

echo -e "\nFor more options, run: $0 --help"