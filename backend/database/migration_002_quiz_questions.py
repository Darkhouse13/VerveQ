#!/usr/bin/env python3
"""
Migration 002: Add QuizQuestion table for prepopulated questions
Creates the quiz_questions table with indexes for performance
"""

import sys
import os

# Add backend directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database.connection import engine, DATABASE_URL
from database.models import Base, QuizQuestion
from sqlalchemy import text

def run_migration():
    """Run the migration to create quiz_questions table"""
    print("🔄 Running Migration 002: Creating quiz_questions table...")
    
    try:
        print(f"📊 Using database: {DATABASE_URL}")
        
        # Create the QuizQuestion table and indexes
        QuizQuestion.__table__.create(engine, checkfirst=True)
        
        print("✅ Migration 002 completed successfully!")
        print("📝 Created table: quiz_questions")
        print("📝 Created indexes:")
        print("   - ix_quiz_questions_bucket (sport, difficulty, bucket)")
        print("   - ix_quiz_questions_checksum (checksum)")
        print("   - ix_quiz_questions_sport_difficulty (sport, difficulty)")
        
        # Verify table exists
        with engine.connect() as conn:
            result = conn.execute(text(
                "SELECT name FROM sqlite_master WHERE type='table' AND name='quiz_questions'"
                if "sqlite" in DATABASE_URL 
                else "SELECT tablename FROM pg_tables WHERE tablename='quiz_questions'"
            ))
            
            if result.fetchone():
                print("✅ Table verification successful")
            else:
                print("❌ Table verification failed")
                return False
                
    except Exception as e:
        print(f"❌ Migration 002 failed: {e}")
        return False
    
    return True

def rollback_migration():
    """Rollback migration by dropping the table"""
    print("🔄 Rolling back Migration 002...")
    
    try:
        QuizQuestion.__table__.drop(engine, checkfirst=True)
        print("✅ Migration 002 rollback completed!")
        
    except Exception as e:
        print(f"❌ Migration 002 rollback failed: {e}")
        return False
    
    return True

if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "rollback":
        rollback_migration()
    else:
        run_migration()