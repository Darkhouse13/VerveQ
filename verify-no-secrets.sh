#!/bin/bash
# VerveQ Security Verification Script
# Verify no sensitive files are tracked in git and .gitignore is properly configured

set -e

echo "🔍 VerveQ Security Check: Verifying no secrets in repository..."
echo "================================================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Track if we found any issues
ISSUES_FOUND=0

# Function to report error
report_error() {
    echo -e "${RED}❌ ERROR: $1${NC}"
    ISSUES_FOUND=$((ISSUES_FOUND + 1))
}

# Function to report warning
report_warning() {
    echo -e "${YELLOW}⚠️  WARNING: $1${NC}"
}

# Function to report success
report_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

echo "1. Checking for sensitive .env files tracked in git..."

# Check for any .env files in git (excluding .example files)
TRACKED_ENV_FILES=$(git ls-files | grep -E "\.env" | grep -v "\.example$" || true)

if [ ! -z "$TRACKED_ENV_FILES" ]; then
    report_error "Found .env files tracked in git:"
    echo "$TRACKED_ENV_FILES" | while read -r file; do
        echo "   - $file"
    done
    echo "   Remove with: git rm --cached <filename>"
    echo ""
else
    report_success "No sensitive .env files found in git tracking"
fi

echo ""
echo "2. Checking .gitignore for required patterns..."

# Check for key environment file patterns
KEY_PATTERNS=(
    "\.env"
    "\.env\.\*"
    "\*\.env"
    "\.env\.production"
)

PATTERN_NAMES=(
    ".env (basic)"
    ".env.* (wildcards)"
    "*.env (prefix wildcards)"
    ".env.production (specific)"
)

MISSING_PATTERNS=""
for i in "${!KEY_PATTERNS[@]}"; do
    pattern="${KEY_PATTERNS[$i]}"
    name="${PATTERN_NAMES[$i]}"
    
    if ! grep -q "$pattern" .gitignore; then
        if [ -z "$MISSING_PATTERNS" ]; then
            MISSING_PATTERNS="$name"
        else
            MISSING_PATTERNS="$MISSING_PATTERNS, $name"
        fi
    fi
done

if [ ! -z "$MISSING_PATTERNS" ]; then
    report_error "Missing .gitignore patterns: $MISSING_PATTERNS"
    echo "   Add these patterns to .gitignore to prevent accidental commits"
    echo ""
else
    report_success ".gitignore properly configured with env patterns"
fi

echo ""
echo "3. Checking for common sensitive file patterns..."

# Check for other potentially sensitive files
SENSITIVE_PATTERNS=(
    "id_rsa$"
    "id_dsa$"
    "id_ecdsa$"
    "id_ed25519$"
    "\.pem$"
    "\.p12$"
    "\.key$"
    "\.keystore$"
    "config\.json$"
    "credentials\.json$"
    "service-account.*\.json$"
)

SENSITIVE_FILES=""
for pattern in "${SENSITIVE_PATTERNS[@]}"; do
    found_files=$(git ls-files | grep -E "$pattern" || true)
    if [ ! -z "$found_files" ]; then
        if [ -z "$SENSITIVE_FILES" ]; then
            SENSITIVE_FILES="$found_files"
        else
            SENSITIVE_FILES="$SENSITIVE_FILES"$'\n'"$found_files"
        fi
    fi
done

if [ ! -z "$SENSITIVE_FILES" ]; then
    report_warning "Found potentially sensitive files tracked in git:"
    echo "$SENSITIVE_FILES" | while read -r file; do
        echo "   - $file"
    done
    echo "   Review these files to ensure they don't contain secrets"
    echo ""
else
    report_success "No obviously sensitive files found in git tracking"
fi

echo ""
echo "4. Checking for .env.example template files..."

# Check that we have example files for guidance
if [ -f ".env.example" ] || [ -f ".env.production.example" ]; then
    report_success "Environment template files found"
else
    report_warning "No .env.example or .env.production.example found"
    echo "   Consider adding template files for easier configuration"
fi

echo ""
echo "================================================================"

# Final report
if [ $ISSUES_FOUND -eq 0 ]; then
    echo -e "${GREEN}🎉 Security check passed! No sensitive files found in repository.${NC}"
    echo ""
    echo "Repository is secure for version control."
    exit 0
else
    echo -e "${RED}🚨 Security check failed! Found $ISSUES_FOUND issue(s).${NC}"
    echo ""
    echo "Please fix the issues above before committing to prevent leaking secrets."
    exit 1
fi