"""
Sports module for VerveQ multi-sport support - Simplified Architecture
CLAUDE.md compliant - focused and maintainable
"""

from .base import SportDataFactory, SportQuestionGenerator
from .simple_fallback import SimpleFallbackGenerator  # Simple fallback
from .tennis import TennisQuestionGenerator
from .quiz_generator import get_quiz_coordinator
from .survival_engine import get_survival_engine
from .sport_data import get_data_loader

# Import simple adapter (CLAUDE.md compliant - under 300 lines)
try:
    from .simple_adapter import SimpleFootballAdapter
    from pathlib import Path
    # Check if database exists
    db_paths = [
        "/mnt/c/Users/hamza/OneDrive/Python_Scripts/VerveQ/data_cleaning/football_comprehensive.db",
        "data_cleaning/football_comprehensive.db",
        "../data_cleaning/football_comprehensive.db"
    ]
    DB_AVAILABLE = any(Path(p).exists() for p in db_paths)
    print("✅ Simple adapter imported successfully")
except ImportError as e:
    DB_AVAILABLE = False
    print(f"❌ Simple adapter import failed: {e}")

# Create generator instances with database preference
if DB_AVAILABLE:
    # Use simple database adapter
    print("🔧 Initializing Simple Football Adapter...")
    football_generator = SimpleFootballAdapter()
    print("🚀 Database-powered Football Quiz System activated")
else:
    # Fallback to simple generator
    print("🔧 Initializing Simple Fallback Generator...")
    print("   Reason: Database not found")
    football_generator = SimpleFallbackGenerator()
    print("🔄 Using simple fallback Football Quiz System")

tennis_generator = TennisQuestionGenerator("tennis")

# Register in QuizCoordinator
_coordinator = get_quiz_coordinator()
_coordinator.register_generator("football", football_generator)
_coordinator.register_generator("tennis", tennis_generator)

# Register in SportDataFactory (for routes)
if DB_AVAILABLE:
    SportDataFactory.register_sport("football", SimpleFootballAdapter)
else:
    SportDataFactory.register_sport("football", SimpleFallbackGenerator)

SportDataFactory.register_sport("tennis", TennisQuestionGenerator)

__all__ = [
    'SportDataFactory',
    'SportQuestionGenerator', 
    'SimpleFallbackGenerator',
    'TennisQuestionGenerator',
    'get_quiz_coordinator',
    'get_survival_engine',
    'get_data_loader'
]