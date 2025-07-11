#!/bin/bash
# rebrand_to_verveq.sh
# Automated FootQuizz → VerveQ rebranding script

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

success() {
    echo -e "${GREEN}✅ $1${NC}"
}

warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check if we're in a git repository
if [ ! -d ".git" ]; then
    error "Not in a git repository. Please run from project root."
    exit 1
fi

# Check for required tools
for tool in rg perl find; do
    if ! command -v $tool &> /dev/null; then
        error "$tool is required but not installed."
        exit 1
    fi
done

echo "🚀 Starting FootQuizz → VerveQ rebranding..."
echo "=================================================="

# 1. Create backup
log "Creating backup..."
BACKUP_DIR="../FootQuizz_backup_$(date +%Y%m%d_%H%M%S)"
cp -r . "$BACKUP_DIR"
success "Backup created at $BACKUP_DIR"

# 2. Check current references
log "Analyzing current FootQuizz references..."
REFERENCE_COUNT=$(rg -i "footquizz" . --count | awk -F: '{sum += $2} END {print sum}')
echo "Found $REFERENCE_COUNT total references to FootQuizz"

echo "Files with FootQuizz references:"
rg -i "footquizz" . --count | head -20

# 3. Create git branch
log "Creating feature branch..."
BRANCH_NAME="feature/rebrand-verveq-$(date +%Y%m%d-%H%M%S)"
git checkout -b "$BRANCH_NAME"
success "Created branch: $BRANCH_NAME"

# 4. Execute replacement
log "Executing content replacements..."

# Define file patterns to update
FILE_PATTERNS=(
    "*.html"
    "*.py" 
    "*.js"
    "*.css"
    "*.json"
    "*.md"
    "*.txt"
)

# Build find command with all patterns
FIND_CMD="find . -type f \("
for i in "${!FILE_PATTERNS[@]}"; do
    if [ $i -eq 0 ]; then
        FIND_CMD="$FIND_CMD -name \"${FILE_PATTERNS[$i]}\""
    else
        FIND_CMD="$FIND_CMD -o -name \"${FILE_PATTERNS[$i]}\""
    fi
done
FIND_CMD="$FIND_CMD \) -not -path \"./.git/*\" -not -path \"./node_modules/*\" -not -path \"./*_backup_*/*\""

# Execute the replacement
eval $FIND_CMD -exec perl -pi.bak -e '
    s/FootQuizz/VerveQ/g;
    s/footquizz/verveq/g;
    s/FOOTQUIZZ/VERVEQ/g;
    s/Footquizz/Verveq/g;
    s/foot-quizz/verve-q/g;
    s/foot_quizz/verve_q/g;
    s/footQuizz/verveQ/g;
' {} \;

success "Content replacement completed"

# 5. Handle special cases that need manual attention
log "Checking for special cases..."

# Check for image references that might need updating
if rg -i "footquizz.*\.(png|jpg|jpeg|gif|ico|svg)" . > /dev/null 2>&1; then
    warning "Found image references that may need manual updating:"
    rg -i "footquizz.*\.(png|jpg|jpeg|gif|ico|svg)" .
fi

# Check for URL references that might need updating
if rg -i "footquizz\.com|footquizz\.org|footquizz\.net" . > /dev/null 2>&1; then
    warning "Found domain references that may need manual updating:"
    rg -i "footquizz\.com|footquizz\.org|footquizz\.net" .
fi

# 6. Rename files/directories if any exist
log "Checking for files/directories to rename..."
FILES_TO_RENAME=$(find . -iname "*footquizz*" -not -path "./.git/*" -not -path "./*_backup_*/*" 2>/dev/null || true)

if [ -n "$FILES_TO_RENAME" ]; then
    log "Found files/directories to rename:"
    echo "$FILES_TO_RENAME"
    
    while IFS= read -r file; do
        if [ -n "$file" ]; then
            newname=$(echo "$file" | sed 's/footquizz/verveq/gi')
            if [ "$file" != "$newname" ]; then
                log "Renaming: $file → $newname"
                git mv "$file" "$newname"
            fi
        fi
    done <<< "$FILES_TO_RENAME"
    success "File/directory renaming completed"
else
    success "No files/directories need renaming"
fi

# 7. Clean up backup files
log "Cleaning up temporary files..."
find . -name "*.bak" -not -path "./.git/*" -delete
success "Cleanup completed"

# 8. Verify changes
log "Verifying changes..."

# Check for remaining FootQuizz references
REMAINING_REFS=$(rg -i "footquizz" . --count 2>/dev/null | awk -F: '{sum += $2} END {print sum}' || echo "0")

if [ "$REMAINING_REFS" -eq 0 ]; then
    success "No FootQuizz references found - rebranding complete!"
else
    warning "Found $REMAINING_REFS remaining FootQuizz references:"
    rg -i "footquizz" . -n --color=always | head -20
    echo "These may need manual review."
fi

# 9. Check for syntax errors
log "Checking for syntax errors..."

# Check Python files
PYTHON_FILES=$(find . -name "*.py" -not -path "./.git/*" -not -path "./*_backup_*/*")
PYTHON_ERRORS=0

for pyfile in $PYTHON_FILES; do
    if ! python3 -m py_compile "$pyfile" 2>/dev/null; then
        error "Syntax error in: $pyfile"
        PYTHON_ERRORS=$((PYTHON_ERRORS + 1))
    fi
done

if [ $PYTHON_ERRORS -eq 0 ]; then
    success "No Python syntax errors found"
else
    warning "$PYTHON_ERRORS Python files have syntax errors"
fi

# Check JSON files
JSON_FILES=$(find . -name "*.json" -not -path "./.git/*" -not -path "./*_backup_*/*")
JSON_ERRORS=0

for jsonfile in $JSON_FILES; do
    if ! python3 -c "import json; json.load(open('$jsonfile'))" 2>/dev/null; then
        error "JSON syntax error in: $jsonfile"
        JSON_ERRORS=$((JSON_ERRORS + 1))
    fi
done

if [ $JSON_ERRORS -eq 0 ]; then
    success "No JSON syntax errors found"
else
    warning "$JSON_ERRORS JSON files have syntax errors"
fi

# 10. Stage changes for commit
log "Staging changes..."
git add .

# Show summary of changes
log "Summary of changes:"
git diff --cached --stat

# 11. Provide next steps
echo ""
echo "=================================================="
echo "🎉 FootQuizz → VerveQ rebranding completed!"
echo "=================================================="
echo ""
echo "📊 Summary:"
echo "  - Original references: $REFERENCE_COUNT"
echo "  - Remaining references: $REMAINING_REFS"
echo "  - Python syntax errors: $PYTHON_ERRORS"
echo "  - JSON syntax errors: $JSON_ERRORS"
echo "  - Branch: $BRANCH_NAME"
echo "  - Backup: $BACKUP_DIR"
echo ""
echo "📋 Next steps:"
echo "  1. Review changes: git diff --cached"
echo "  2. Test functionality: python web_server.py"
echo "  3. Run test suite: python -m pytest test_*.py -v"
echo "  4. Manual UI testing in browser"
echo "  5. Commit changes: git commit -m 'feat: rebrand from FootQuizz to VerveQ'"
echo "  6. Push branch: git push origin $BRANCH_NAME"
echo "  7. Create pull request for review"
echo ""
echo "🚨 If issues arise:"
echo "  - Rollback: git checkout main && git branch -D $BRANCH_NAME"
echo "  - Restore backup: cp -r $BACKUP_DIR/* ."
echo ""

# Optional: Ask if user wants to commit immediately
read -p "Do you want to commit the changes now? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    log "Committing changes..."
    git commit -m "feat: rebrand from FootQuizz to VerveQ

- Update all UI text and navigation from FootQuizz to VerveQ
- Update API documentation and server messages
- Update localStorage keys and service worker cache names
- Update all documentation and markdown files
- Update Python code comments and docstrings
- Maintain all existing functionality

References updated: $REFERENCE_COUNT → $REMAINING_REFS remaining"
    
    success "Changes committed to branch: $BRANCH_NAME"
    echo "Ready to push: git push origin $BRANCH_NAME"
else
    log "Changes staged but not committed. Review and commit when ready."
fi

echo "🎊 Rebranding script completed successfully!"