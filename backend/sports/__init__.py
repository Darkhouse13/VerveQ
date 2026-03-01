"""
Sports module for VerveQ multi-sport support - Simplified Architecture
CLAUDE.md compliant - focused and maintainable
"""

from .base import SportDataFactory, SportQuestionGenerator
from .simple_fallback import SimpleFallbackGenerator  # Simple fallback
from .tennis import TennisQuestionGenerator
from .basketball import BasketballQuestionGenerator
from .survival_engine import get_survival_engine
from .sport_data import get_data_loader

# Global variables for lazy initialization
_initialized = False
_db_available = None

def _check_db_availability():
    """Check if database is available (lazy evaluation)"""
    global _db_available
    if _db_available is None:
        try:
            from .simple_adapter import SimpleFootballAdapter
            from pathlib import Path
            # Check if database exists
            db_paths = [
                "/mnt/c/Users/hamza/OneDrive/Python_Scripts/VerveQ/data_cleaning/football_comprehensive.db",
                "data_cleaning/football_comprehensive.db",
                "../data_cleaning/football_comprehensive.db"
            ]
            _db_available = any(Path(p).exists() for p in db_paths)
        except ImportError:
            _db_available = False
    return _db_available

def _initialize_sports():
    """Lazy initialization of sports generators"""
    global _initialized
    if _initialized:
        return
    
    try:
        # Check database availability
        db_available = _check_db_availability()
        
        # Register in SportDataFactory (for routes)
        if db_available:
            from .simple_adapter import SimpleFootballAdapter
            SportDataFactory.register_sport("football", SimpleFootballAdapter)
        else:
            SportDataFactory.register_sport("football", SimpleFallbackGenerator)

        SportDataFactory.register_sport("tennis", TennisQuestionGenerator)
        SportDataFactory.register_sport("basketball", BasketballQuestionGenerator)
        
        _initialized = True
    except Exception as e:
        print(f"⚠️ Sports initialization error: {e}")
        # Fallback registration
        SportDataFactory.register_sport("football", SimpleFallbackGenerator)
        SportDataFactory.register_sport("tennis", TennisQuestionGenerator)
        SportDataFactory.register_sport("basketball", BasketballQuestionGenerator)
        _initialized = True

__all__ = [
    'SportDataFactory',
    'SportQuestionGenerator', 
    'SimpleFallbackGenerator',
    'TennisQuestionGenerator',
    'BasketballQuestionGenerator',
    'get_survival_engine',
    'get_data_loader'
]