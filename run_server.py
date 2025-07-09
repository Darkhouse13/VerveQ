#!/usr/bin/env python3
"""
Universal FootQuizz Server Launcher
Tries different server options in order of preference
"""

import os
import sys
import subprocess
import importlib.util

def check_module(module_name):
    """Check if a module is available"""
    spec = importlib.util.find_spec(module_name)
    return spec is not None

def run_fastapi_server():
    """Try to run FastAPI server"""
    print("🚀 Starting FastAPI server...")
    try:
        # Prefer the new unified FastAPI server (web_server.py) which exposes
        # both quiz and survival mode endpoints on port 8008. Fallback to the
        # older main.py implementation if uvicorn is missing.
        if check_module('uvicorn'):
            # Method 1: Launch via uvicorn
            os.system('python -m uvicorn web_server:app --host 0.0.0.0 --port 8008 --reload')
        else:
            # Method 2: Run the script directly (blocking)
            subprocess.run([sys.executable, 'web_server.py'])
    except Exception as e:
        print(f"FastAPI server failed: {e}")
        return False
    return True

def run_simple_server():
    """Fallback to simple HTTP server"""
    print("🔄 Falling back to simple HTTP server...")
    try:
        subprocess.run([sys.executable, 'simple_server.py'])
        return True
    except Exception as e:
        print(f"Simple server failed: {e}")
        return False

def main():
    print("🏆 FootQuizz Universal Server Launcher")
    print("=" * 40)
    
    # Ensure we're in the right directory
    if not os.path.exists('Data.py'):
        if os.path.exists('FootQuizz/Data.py'):
            os.chdir('FootQuizz')
            print("📁 Changed to FootQuizz directory")
        else:
            print("❌ Error: Cannot find FootQuizz files")
            print("💡 Make sure you're running this from the correct directory")
            return
    
    # Check required files
    required_files = ['Data.py', 'QuizGenerator.py', 'web_server.py']
    missing_files = [f for f in required_files if not os.path.exists(f)]
    
    if missing_files:
        print(f"❌ Missing files: {missing_files}")
        return
    
    print("✅ All required files found")
    
    # Test data loading first
    print("\n📊 Testing data loading...")
    try:
        from Data import JSONDataHandler
        data_handler = JSONDataHandler()
        competitions = data_handler.get_available_competitions()
        print(f"✅ Successfully loaded {len(competitions)} competitions")
    except Exception as e:
        print(f"❌ Data loading failed: {e}")
        print("💡 Check your data directory and JSON files")
        return
    
    # Try servers in order of preference
    print("\n🌐 Starting server...")
    
    if not run_fastapi_server():
        if not run_simple_server():
            print("\n❌ All servers failed!")
            print("Check TROUBLESHOOTING.md for help")

if __name__ == "__main__":
    main() 