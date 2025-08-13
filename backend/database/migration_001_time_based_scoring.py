"""
Database migration script for time-based scoring feature
This script adds the new columns to existing tables:
- average_time_per_game to user_ratings table
- average_answer_time_seconds and details to game_sessions table
"""

import sqlite3
import os
from sqlalchemy import create_engine, text
from sqlalchemy.exc import OperationalError

def migrate_database():
    """Apply migration to add new columns for time-based scoring"""
    # Get database URL from environment or use default
    database_url = os.getenv("DATABASE_URL", "sqlite:///./verveq_platform.db")
    
    try:
        # Create engine
        engine = create_engine(database_url)
        
        # For SQLite, we need to use ALTER TABLE
        if database_url.startswith("sqlite"):
            print("Applying migration for SQLite database...")
            apply_sqlite_migration(engine)
        else:
            # For PostgreSQL, we can use ALTER TABLE directly
            print("Applying migration for PostgreSQL database...")
            apply_postgresql_migration(engine)
            
        print("✅ Migration completed successfully!")
        
    except Exception as e:
        print(f"❌ Migration failed: {e}")
        raise

def apply_sqlite_migration(engine):
    """Apply migration for SQLite database"""
    with engine.connect() as conn:
        # Add average_time_per_game column to user_ratings table
        try:
            conn.execute(text("ALTER TABLE user_ratings ADD COLUMN average_time_per_game FLOAT DEFAULT 0.0"))
            print("✅ Added average_time_per_game column to user_ratings table")
        except OperationalError as e:
            if "duplicate column name" in str(e).lower():
                print("⚠️  average_time_per_game column already exists in user_ratings table")
            else:
                raise
        
        # Add average_answer_time_seconds column to game_sessions table
        try:
            conn.execute(text("ALTER TABLE game_sessions ADD COLUMN average_answer_time_seconds FLOAT"))
            print("✅ Added average_answer_time_seconds column to game_sessions table")
        except OperationalError as e:
            if "duplicate column name" in str(e).lower():
                print("⚠️  average_answer_time_seconds column already exists in game_sessions table")
            else:
                raise
        
        # Add details column to game_sessions table
        try:
            conn.execute(text("ALTER TABLE game_sessions ADD COLUMN details JSON"))
            print("✅ Added details column to game_sessions table")
        except OperationalError as e:
            if "duplicate column name" in str(e).lower():
                print("⚠️  details column already exists in game_sessions table")
            else:
                raise
        
        conn.commit()

def apply_postgresql_migration(engine):
    """Apply migration for PostgreSQL database"""
    with engine.connect() as conn:
        # Add average_time_per_game column to user_ratings table
        try:
            conn.execute(text("ALTER TABLE user_ratings ADD COLUMN IF NOT EXISTS average_time_per_game FLOAT DEFAULT 0.0"))
            print("✅ Added average_time_per_game column to user_ratings table")
        except Exception as e:
            print(f"⚠️  Could not add average_time_per_game column: {e}")
        
        # Add average_answer_time_seconds column to game_sessions table
        try:
            conn.execute(text("ALTER TABLE game_sessions ADD COLUMN IF NOT EXISTS average_answer_time_seconds FLOAT"))
            print("✅ Added average_answer_time_seconds column to game_sessions table")
        except Exception as e:
            print(f"⚠️  Could not add average_answer_time_seconds column: {e}")
        
        # Add details column to game_sessions table
        try:
            conn.execute(text("ALTER TABLE game_sessions ADD COLUMN IF NOT EXISTS details JSONB"))
            print("✅ Added details column to game_sessions table")
        except Exception as e:
            print(f"⚠️  Could not add details column: {e}")
        
        conn.commit()

if __name__ == "__main__":
    migrate_database()