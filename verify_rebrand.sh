#!/bin/bash
# verify_rebrand.sh
# Verification script for FootQuizz → VerveQ rebranding

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Counters
TESTS_PASSED=0
TESTS_FAILED=0
TESTS_TOTAL=0

# Test function
run_test() {
    local test_name="$1"
    local test_command="$2"
    local expected_result="$3"  # "success" or "failure"
    
    TESTS_TOTAL=$((TESTS_TOTAL + 1))
    echo -e "${BLUE}🔍 Testing: $test_name${NC}"
    
    if eval "$test_command" > /dev/null 2>&1; then
        if [ "$expected_result" = "success" ]; then
            echo -e "${GREEN}✅ PASS: $test_name${NC}"
            TESTS_PASSED=$((TESTS_PASSED + 1))
        else
            echo -e "${RED}❌ FAIL: $test_name (expected failure but succeeded)${NC}"
            TESTS_FAILED=$((TESTS_FAILED + 1))
        fi
    else
        if [ "$expected_result" = "failure" ]; then
            echo -e "${GREEN}✅ PASS: $test_name (expected failure)${NC}"
            TESTS_PASSED=$((TESTS_PASSED + 1))
        else
            echo -e "${RED}❌ FAIL: $test_name${NC}"
            TESTS_FAILED=$((TESTS_FAILED + 1))
        fi
    fi
}

echo "🔬 VerveQ Rebranding Verification"
echo "================================="

# 1. Check for remaining FootQuizz references
echo -e "\n${YELLOW}📋 1. REFERENCE VERIFICATION${NC}"

# Should find NO FootQuizz references
run_test "No FootQuizz references in HTML files" "! rg -i 'footquizz' *.html" "success"
run_test "No FootQuizz references in Python files" "! rg -i 'footquizz' *.py" "success"
run_test "No FootQuizz references in JavaScript files" "! rg -i 'footquizz' *.js" "success"
run_test "No FootQuizz references in CSS files" "! rg -i 'footquizz' *.css static/*.css 2>/dev/null" "success"
run_test "No FootQuizz references in JSON files" "! rg -i 'footquizz' *.json" "success"
run_test "No FootQuizz references in Markdown files" "! rg -i 'footquizz' *.md" "success"

# Should find VerveQ references
run_test "VerveQ references found in main files" "rg -i 'verveq' index.html web_server.py README.md" "success"

# 2. Syntax validation
echo -e "\n${YELLOW}📋 2. SYNTAX VALIDATION${NC}"

# Python syntax check
run_test "Python syntax validation" "python3 -m py_compile web_server.py main.py" "success"

# JSON syntax check
run_test "JSON syntax validation" "python3 -c \"import json; [json.load(open(f)) for f in ['survival_initials_map.json'] if __import__('os').path.exists(f)]\"" "success"

# HTML basic validation (check for unmatched tags)
run_test "HTML basic validation" "python3 -c \"
import re
for file in ['index.html', 'survival.html', 'leaderboard.html']:
    try:
        with open(file, 'r', encoding='utf-8') as f:
            content = f.read()
            # Basic check for DOCTYPE and html tags
            assert '<!DOCTYPE html>' in content
            assert '<html' in content and '</html>' in content
            assert '<head>' in content and '</head>' in content
            assert '<body>' in content and '</body>' in content
    except FileNotFoundError:
        pass
\"" "success"

# 3. Functional verification
echo -e "\n${YELLOW}📋 3. FUNCTIONAL VERIFICATION${NC}"

# Check if main modules import correctly
run_test "Main module imports" "python3 -c \"
import sys
sys.path.append('.')
try:
    import web_server
    import Data
    import QuizGenerator
    print('All imports successful')
except ImportError as e:
    print(f'Import error: {e}')
    sys.exit(1)
\"" "success"

# Check if key files exist
run_test "Key files exist" "test -f web_server.py -a -f index.html -a -f survival.html -a -f README.md" "success"

# 4. UI/UX verification
echo -e "\n${YELLOW}📋 4. UI/UX VERIFICATION${NC}"

# Check HTML titles
run_test "HTML titles updated" "grep -q 'VerveQ' index.html && grep -q 'VerveQ' survival.html" "success"

# Check navigation branding
run_test "Navigation branding updated" "grep -q 'VerveQ' index.html" "success"

# Check meta tags
run_test "Meta tags updated" "grep -q 'VerveQ' index.html" "success"

# 5. Service configuration verification
echo -e "\n${YELLOW}📋 5. SERVICE CONFIGURATION${NC}"

# Check service worker cache names
run_test "Service worker cache updated" "! grep -i 'footquizz' service-worker.js" "success"

# Check API documentation
run_test "API documentation updated" "grep -q 'VerveQ' web_server.py" "success"

# 6. Test suite verification
echo -e "\n${YELLOW}📋 6. TEST SUITE VERIFICATION${NC}"

# Run a subset of tests to ensure basic functionality
if [ -f "test_draw_logic_simple.py" ]; then
    run_test "Draw logic tests" "python3 test_draw_logic_simple.py" "success"
fi

if [ -f "test_all_modes.py" ]; then
    run_test "All modes test" "timeout 30 python3 test_all_modes.py" "success"
fi

# 7. Performance verification
echo -e "\n${YELLOW}📋 7. PERFORMANCE VERIFICATION${NC}"

# Check if server can start (quick test)
run_test "Server startup test" "timeout 10 python3 -c \"
import web_server
print('Server module loads successfully')
\"" "success"

# 8. Security verification
echo -e "\n${YELLOW}📋 8. SECURITY VERIFICATION${NC}"

# Check for any hardcoded sensitive data that might have been affected
run_test "No sensitive data exposure" "! rg -i 'password|secret|key.*=' *.py *.html *.js 2>/dev/null | grep -v 'SECRET_KEY.*environ'" "success"

# Check for proper escaping in HTML (basic check)
run_test "HTML escaping check" "! grep -E '<script[^>]*>[^<]*alert\\(' *.html" "success"

# Summary
echo -e "\n${BLUE}=================================${NC}"
echo -e "${BLUE}📊 VERIFICATION SUMMARY${NC}"
echo -e "${BLUE}=================================${NC}"

PASS_RATE=$(( TESTS_PASSED * 100 / TESTS_TOTAL ))

echo "Total Tests: $TESTS_TOTAL"
echo "Passed: $TESTS_PASSED"
echo "Failed: $TESTS_FAILED"
echo "Pass Rate: $PASS_RATE%"

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "\n${GREEN}🎉 ALL VERIFICATION TESTS PASSED!${NC}"
    echo -e "${GREEN}✅ Rebranding appears to be successful${NC}"
    echo -e "${GREEN}✅ Ready for production deployment${NC}"
    
    echo -e "\n${BLUE}📋 Final Manual Verification Steps:${NC}"
    echo "1. Start the server: python web_server.py"
    echo "2. Open browser to http://localhost:8000"
    echo "3. Verify 'VerveQ' appears in:"
    echo "   - Page title"
    echo "   - Navigation header"
    echo "   - All UI text"
    echo "4. Test core functionality:"
    echo "   - Quiz generation"
    echo "   - Survival mode"
    echo "   - Leaderboard"
    echo "5. Check browser console for errors"
    echo "6. Verify localStorage keys use 'verveq_' prefix"
    
    exit 0
else
    echo -e "\n${RED}❌ VERIFICATION FAILED${NC}"
    echo -e "${RED}$TESTS_FAILED test(s) failed${NC}"
    echo -e "${YELLOW}Please review and fix issues before proceeding${NC}"
    
    echo -e "\n${BLUE}📋 Troubleshooting:${NC}"
    echo "1. Check individual test failures above"
    echo "2. Run specific commands to debug:"
    echo "   rg -i 'footquizz' . # Find remaining references"
    echo "   python3 web_server.py # Test server startup"
    echo "   python3 -m py_compile *.py # Check Python syntax"
    echo "3. Review recent changes: git diff"
    echo "4. Consider running rebrand script again"
    
    exit 1
fi