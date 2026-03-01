from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
import os
from .models import Base

# Environment detection
ENVIRONMENT = os.getenv("ENVIRONMENT", "development").lower()

# In production, require explicit DATABASE_URL (no SQLite fallback)
if ENVIRONMENT == "production" and not os.getenv("DATABASE_URL"):
    raise RuntimeError("DATABASE_URL environment variable is required in production")

# Database configuration - default to SQLite for easy development
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./verveq_platform.db")

# For development, always use SQLite unless PostgreSQL explicitly set
if not os.getenv("DATABASE_URL") and os.getenv("ENVIRONMENT") != "production":
    DATABASE_URL = "sqlite:///./verveq_platform.db"
    print("📊 Using SQLite database for development: verveq_platform.db")

# Test PostgreSQL connection if specified
if DATABASE_URL.startswith("postgresql"):
    try:
        # Try to import psycopg2 
        import psycopg2
        # Test connection
        test_engine = create_engine(DATABASE_URL)
        test_engine.connect().close()
        print("✅ PostgreSQL connection successful")
    except ImportError:
        print("⚠️  psycopg2 not installed. Install with: pip install psycopg2-binary")
        print("⚠️  Falling back to SQLite for development")
        DATABASE_URL = "sqlite:///./verveq_platform.db"
    except Exception as e:
        print(f"⚠️  PostgreSQL connection failed: {e}")
        print("⚠️  Falling back to SQLite for development")
        DATABASE_URL = "sqlite:///./verveq_platform.db"

# Prevent SQLite fallback in production
if ENVIRONMENT == "production" and DATABASE_URL.startswith("sqlite"):
    raise RuntimeError("SQLite fallback is not allowed in production. Please configure a PostgreSQL DATABASE_URL.")

# Create engine
if DATABASE_URL.startswith("sqlite"):
    engine = create_engine(
        DATABASE_URL,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
else:
    engine = create_engine(DATABASE_URL, pool_pre_ping=True)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def create_tables():
    """Create all database tables"""
    Base.metadata.create_all(bind=engine)

def get_db():
    """Dependency to get database session"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def init_db():
    """Initialize database with default data"""
    create_tables()
    
    # Add default achievements
    db = SessionLocal()
    try:
        from .models import Achievement
        
        # Check if achievements already exist
        if db.query(Achievement).count() > 0:
            return
        
        default_achievements = [
            {
                "id": "first_quiz",
                "name": "Quiz Novice",
                "description": "Complete your first quiz",
                "category": "milestone",
                "icon": "🎯",
                "points": 10,
                "requirements": {"games_played": 1, "mode": "quiz"}
            },
            {
                "id": "first_survival",
                "name": "Survivor",
                "description": "Complete your first survival game",
                "category": "milestone", 
                "icon": "⚡",
                "points": 10,
                "requirements": {"games_played": 1, "mode": "survival"}
            },
            {
                "id": "quiz_master",
                "name": "Quiz Master",
                "description": "Score 100% on a quiz",
                "category": "score",
                "icon": "🏆",
                "points": 50,
                "requirements": {"accuracy": 100, "mode": "quiz"}
            },
            {
                "id": "survival_legend",
                "name": "Survival Legend", 
                "description": "Score 15+ in survival mode",
                "category": "score",
                "icon": "👑",
                "points": 100,
                "requirements": {"score": 15, "mode": "survival"}
            },
            {
                "id": "multi_sport_athlete",
                "name": "Multi-Sport Athlete",
                "description": "Play games in 2 different sports",
                "category": "milestone",
                "icon": "🌟",
                "points": 25,
                "requirements": {"sports_count": 2}
            },
            {
                "id": "dedicated_player",
                "name": "Dedicated Player",
                "description": "Play 50 total games",
                "category": "milestone",
                "icon": "💪",
                "points": 75,
                "requirements": {"total_games": 50}
            },
            {
                "id": "elo_champion",
                "name": "ELO Champion",
                "description": "Reach 1500 ELO rating",
                "category": "rating",
                "icon": "⭐",
                "points": 200,
                "requirements": {"elo_rating": 1500}
            }
        ]
        
        for achievement_data in default_achievements:
            achievement = Achievement(**achievement_data)
            db.add(achievement)
        
        db.commit()
        print("✅ Default achievements created")
        
    except Exception as e:
        print(f"❌ Error initializing database: {e}")
        db.rollback()
    finally:
        db.close()
