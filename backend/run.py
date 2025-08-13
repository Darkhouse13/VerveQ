#!/usr/bin/env python3
"""
Runner script for VerveQ Platform API v3.0 (Future Phase)
Updated with configuration management system
"""

import uvicorn
from main import app
from config.settings import settings
from database.connection import init_db

if __name__ == "__main__":
    print("🚀 Starting VerveQ Platform API v3.0...")
    print(f"📱 Backend will be available at: http://localhost:{settings.port}")
    print(f"🌐 Network access available at: http://{settings.host}:{settings.port}")
    print(f"📚 API docs available at: http://localhost:{settings.port}/docs")
    print()
    print("🌟 Platform Features:")
    print("   🎯 ELO Rating System")
    print("   🏆 Global & Sport-Specific Leaderboards") 
    print("   ⚡ Friend Challenges & Social Features")
    print("   👤 User Profiles & Achievements")
    print("   📊 Advanced Analytics & Insights")
    print("   🏈 Multi-Sport Support (Football & Tennis)")
    print()
    print("🔧 Database: Initializing tables and default data...")
    
    # Initialize database
    init_db()
    
    print("✅ Database initialized successfully!")
    print("🔄 Make sure your React Native app points to this URL")
    print()
    
    print(f"🔗 Binding to network interface: {settings.host}:{settings.port}")
    print("🔄 Starting uvicorn server...")
    
    try:
        uvicorn.run(
            "main:app", 
            host=settings.host, 
            port=settings.port,
            reload=settings.debug,
            log_level=settings.log_level.lower(),
            access_log=True,
            workers=1
        )
    except Exception as e:
        print(f"❌ Failed to start server: {e}")
        print("💡 Check your .env file configuration or network settings")