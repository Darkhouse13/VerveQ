#!/bin/bash
# rollback_rebrand.sh
# Emergency rollback script for VerveQ → FootQuizz rebranding

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

echo "🔄 VerveQ → FootQuizz Rollback Script"
echo "====================================="

# Check if we're in a git repository
if [ ! -d ".git" ]; then
    error "Not in a git repository. Cannot perform git rollback."
    echo "Consider manual restoration from backup."
    exit 1
fi

# Check current branch
CURRENT_BRANCH=$(git branch --show-current)
log "Current branch: $CURRENT_BRANCH"

# Method selection
echo ""
echo "Select rollback method:"
echo "1. Git rollback (recommended if changes are committed)"
echo "2. Git reset (if changes are staged but not committed)"
echo "3. Restore from backup directory"
echo "4. Manual content rollback (VerveQ → FootQuizz)"
echo ""
read -p "Enter choice (1-4): " -n 1 -r
echo

case $REPLY in
    1)
        # Git rollback method
        log "Performing git rollback..."
        
        # Show recent commits
        echo "Recent commits:"
        git log --oneline -10
        echo ""
        
        # Find rebrand commit
        REBRAND_COMMIT=$(git log --oneline --grep="rebrand.*VerveQ" -1 | cut -d' ' -f1)
        
        if [ -n "$REBRAND_COMMIT" ]; then
            log "Found rebrand commit: $REBRAND_COMMIT"
            
            # Get the commit before rebrand
            PARENT_COMMIT=$(git rev-parse ${REBRAND_COMMIT}^)
            log "Parent commit: $PARENT_COMMIT"
            
            read -p "Rollback to commit $PARENT_COMMIT? (y/N): " -n 1 -r
            echo
            
            if [[ $REPLY =~ ^[Yy]$ ]]; then
                log "Rolling back to $PARENT_COMMIT..."
                git reset --hard $PARENT_COMMIT
                success "Git rollback completed"
            else
                warning "Rollback cancelled"
                exit 0
            fi
        else
            warning "No rebrand commit found. Showing recent commits:"
            git log --oneline -5
            echo ""
            read -p "Enter commit hash to rollback to: " COMMIT_HASH
            
            if [ -n "$COMMIT_HASH" ]; then
                log "Rolling back to $COMMIT_HASH..."
                git reset --hard $COMMIT_HASH
                success "Git rollback completed"
            else
                error "No commit hash provided"
                exit 1
            fi
        fi
        ;;
        
    2)
        # Git reset method
        log "Performing git reset..."
        
        # Check if there are staged changes
        if git diff --cached --quiet; then
            warning "No staged changes found"
        else
            log "Found staged changes. Resetting..."
            git reset HEAD .
            success "Staged changes reset"
        fi
        
        # Check if there are unstaged changes
        if git diff --quiet; then
            warning "No unstaged changes found"
        else
            log "Found unstaged changes. Checking out original files..."
            git checkout -- .
            success "Unstaged changes reverted"
        fi
        ;;
        
    3)
        # Backup restoration method
        log "Looking for backup directories..."
        
        BACKUP_DIRS=$(ls -d ../FootQuizz_backup_* 2>/dev/null | sort -r | head -5)
        
        if [ -z "$BACKUP_DIRS" ]; then
            error "No backup directories found"
            exit 1
        fi
        
        echo "Available backups:"
        echo "$BACKUP_DIRS" | nl
        echo ""
        read -p "Enter backup number to restore: " BACKUP_NUM
        
        SELECTED_BACKUP=$(echo "$BACKUP_DIRS" | sed -n "${BACKUP_NUM}p")
        
        if [ -n "$SELECTED_BACKUP" ]; then
            log "Restoring from: $SELECTED_BACKUP"
            
            # Create safety backup of current state
            SAFETY_BACKUP="../current_state_backup_$(date +%Y%m%d_%H%M%S)"
            cp -r . "$SAFETY_BACKUP"
            log "Created safety backup at: $SAFETY_BACKUP"
            
            # Restore from selected backup (excluding .git)
            log "Restoring files..."
            rsync -av --exclude='.git' "$SELECTED_BACKUP/" ./
            success "Backup restoration completed"
        else
            error "Invalid backup selection"
            exit 1
        fi
        ;;
        
    4)
        # Manual content rollback
        log "Performing manual content rollback (VerveQ → FootQuizz)..."
        
        warning "This will change VerveQ back to FootQuizz in all files"
        read -p "Are you sure? (y/N): " -n 1 -r
        echo
        
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            warning "Rollback cancelled"
            exit 0
        fi
        
        # Create safety backup
        SAFETY_BACKUP="../pre_rollback_backup_$(date +%Y%m%d_%H%M%S)"
        cp -r . "$SAFETY_BACKUP"
        log "Created safety backup at: $SAFETY_BACKUP"
        
        # Perform reverse replacement
        log "Executing reverse replacements..."
        
        find . -type f \( -name "*.html" -o -name "*.py" -o -name "*.js" -o -name "*.css" -o -name "*.json" -o -name "*.md" \) \
          -not -path "./.git/*" \
          -not -path "./node_modules/*" \
          -not -path "./*_backup_*/*" \
          -exec perl -pi.bak -e '
            s/VerveQ/FootQuizz/g;
            s/verveq/footquizz/g;
            s/VERVEQ/FOOTQUIZZ/g;
            s/Verveq/Footquizz/g;
            s/verve-q/foot-quizz/g;
            s/verve_q/foot_quizz/g;
            s/verveQ/footQuizz/g;
        ' {} \;
        
        # Clean up backup files
        find . -name "*.bak" -not -path "./.git/*" -delete
        
        success "Manual rollback completed"
        ;;
        
    *)
        error "Invalid choice"
        exit 1
        ;;
esac

# Verification after rollback
log "Verifying rollback..."

# Check for FootQuizz references (should exist after rollback)
FOOTQUIZZ_REFS=$(rg -i "footquizz" . --count 2>/dev/null | awk -F: '{sum += $2} END {print sum}' || echo "0")

# Check for VerveQ references (should be minimal after rollback)
VERVEQ_REFS=$(rg -i "verveq" . --count 2>/dev/null | awk -F: '{sum += $2} END {print sum}' || echo "0")

echo ""
echo "Verification Results:"
echo "  FootQuizz references: $FOOTQUIZZ_REFS"
echo "  VerveQ references: $VERVEQ_REFS"

if [ "$FOOTQUIZZ_REFS" -gt 0 ] && [ "$VERVEQ_REFS" -eq 0 ]; then
    success "Rollback appears successful"
elif [ "$FOOTQUIZZ_REFS" -gt 0 ] && [ "$VERVEQ_REFS" -gt 0 ]; then
    warning "Partial rollback detected - both names present"
    echo "FootQuizz files with remaining VerveQ:"
    rg -i "verveq" . -l 2>/dev/null | head -5
elif [ "$FOOTQUIZZ_REFS" -eq 0 ]; then
    error "Rollback may have failed - no FootQuizz references found"
else
    warning "Unexpected state after rollback"
fi

# Syntax check
log "Checking for syntax errors..."
PYTHON_ERRORS=0
for pyfile in $(find . -name "*.py" -not -path "./.git/*"); do
    if ! python3 -m py_compile "$pyfile" 2>/dev/null; then
        error "Python syntax error in: $pyfile"
        PYTHON_ERRORS=$((PYTHON_ERRORS + 1))
    fi
done

if [ $PYTHON_ERRORS -eq 0 ]; then
    success "No Python syntax errors found"
else
    warning "$PYTHON_ERRORS Python files have syntax errors"
fi

echo ""
echo "============================================"
echo "🔄 Rollback Operation Complete"
echo "============================================"
echo ""
echo "📋 Next Steps:"
echo "1. Test application functionality:"
echo "   python web_server.py"
echo "2. Verify UI in browser shows 'FootQuizz'"
echo "3. Run test suite if available:"
echo "   python -m pytest test_*.py"
echo "4. Check git status:"
echo "   git status"
echo ""

if [ "$PYTHON_ERRORS" -eq 0 ] && [ "$FOOTQUIZZ_REFS" -gt 0 ]; then
    echo "🎉 Rollback completed successfully!"
    echo "Application should be back to FootQuizz branding."
else
    echo "⚠️  Rollback completed with warnings."
    echo "Please manually verify the application state."
fi

echo ""
echo "🛡️  Safety backups created:"
if [ -n "$SAFETY_BACKUP" ]; then
    echo "   $SAFETY_BACKUP"
fi
echo ""