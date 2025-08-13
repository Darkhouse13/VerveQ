"""
Quiz generator coordination for VerveQ sports quiz game.
Simple, focused coordinator that ensures quality questions with no duplicates.
"""

import random
from typing import Dict, List, Any, Optional, Set
from .sport_data import get_data_loader, League, DataType
from .utils import (
    validate_question, create_question_dict, safe_random_choice,
    deduplicate_preserving_order, log_simple
)


class QuizCoordinator:
    """Coordinates quiz question generation across sports"""
    
    def __init__(self):
        """Initialize quiz coordinator"""
        self.data_loader = get_data_loader()
        self.used_questions: Set[str] = set()  # Track used questions to prevent duplicates
        self.generators = {}  # Sport-specific generators
        
    def register_generator(self, sport: str, generator) -> None:
        """Register a sport-specific generator"""
        self.generators[sport] = generator
        log_simple(f"Registered generator for {sport}")
    
    def generate_question(self, sport: str = None, session_id: str = None) -> Optional[Dict[str, Any]]:
        """Generate a quiz question for specified sport or random sport
        
        Args:
            sport: Sport name or None for random
            session_id: Optional session ID for tracking used questions
        """
        if sport is None:
            # Choose random sport from available generators
            sport = safe_random_choice(list(self.generators.keys()))
        
        if sport not in self.generators:
            log_simple(f"No generator found for sport: {sport}", "ERROR")
            return None
        
        generator = self.generators[sport]
        
        # Get session manager if session_id provided
        session_manager = None
        if session_id:
            from services.quiz_session import get_quiz_session_manager
            session_manager = get_quiz_session_manager()
        
        # Try to generate a unique question (max 10 attempts)
        for attempt in range(10):
            try:
                question = generator.get_quiz_question()
                
                if not question:
                    continue
                
                # Validate question format
                if not validate_question(question):
                    log_simple(f"Invalid question format from {sport} generator", "WARNING")
                    continue
                
                # Check for duplicates
                question_key = self._create_question_key(question)
                
                # Check session-based tracking if available
                if session_manager and session_id:
                    if session_manager.is_question_used(session_id, question_key):
                        continue
                else:
                    # Fall back to instance-based tracking
                    if question_key in self.used_questions:
                        continue
                
                # Mark as used
                if session_manager and session_id:
                    session_manager.add_question(session_id, question_key)
                else:
                    self.used_questions.add(question_key)
                
                log_simple(f"Generated {sport} question: {question.get('category', 'Unknown')}")
                return question
                
            except Exception as e:
                log_simple(f"Error generating {sport} question (attempt {attempt + 1}): {e}", "ERROR")
                continue
        
        log_simple(f"Failed to generate unique question for {sport} after 10 attempts", "ERROR")
        return None
    
    def generate_questions_batch(self, count: int, sport: str = None) -> List[Dict[str, Any]]:
        """Generate a batch of unique questions"""
        questions = []
        
        for i in range(count):
            question = self.generate_question(sport)
            if question:
                questions.append(question)
            else:
                log_simple(f"Could not generate question {i + 1} of {count}")
                break
        
        return questions
    
    def reset_used_questions(self) -> None:
        """Reset the used questions tracker"""
        self.used_questions.clear()
        log_simple("Reset used questions tracker")
    
    def get_available_sports(self) -> List[str]:
        """Get list of available sports"""
        return list(self.generators.keys())
    
    def get_stats(self) -> Dict[str, Any]:
        """Get coordinator statistics"""
        return {
            "available_sports": self.get_available_sports(),
            "used_questions_count": len(self.used_questions),
            "generators_registered": len(self.generators)
        }
    
    def _create_question_key(self, question: Dict[str, Any]) -> str:
        """Create unique key for question to detect duplicates"""
        # Use question text and correct answer to create unique key
        question_text = question.get("question", "")
        correct_answer = question.get("correct_answer", "")
        return f"{question_text}|{correct_answer}".lower().strip()


class BaseQuestionGenerator:
    """Base class for sport-specific question generators"""
    
    def __init__(self, sport_name: str):
        """Initialize generator for specific sport"""
        self.sport_name = sport_name
        self.data_loader = get_data_loader()
    
    def get_quiz_question(self) -> Dict[str, Any]:
        """Generate a quiz question - to be implemented by subclasses"""
        raise NotImplementedError("Subclasses must implement get_quiz_question")
    
    def get_survival_data(self) -> Dict[str, List[str]]:
        """Get survival mode data - to be implemented by subclasses"""
        return self.data_loader.get_survival_data(self.sport_name)
    
    def get_sport_theme(self) -> Dict[str, str]:
        """Get sport theme - to be implemented by subclasses"""
        return {
            "primary_color": "#1a237e",
            "secondary_color": "#4caf50", 
            "accent_color": "#ff9800",
            "background_color": "#f5f5f5",
            "text_color": "#333333",
            "icon": "⚽",
            "display_name": self.sport_name.title()
        }


class FootballQuestionTypes:
    """Football-specific question type helpers"""
    
    @staticmethod
    def get_available_types(league_data: Dict[DataType, List[Any]]) -> List[str]:
        """Get available question types based on data"""
        types = []
        
        if DataType.AWARD_HISTORICAL in league_data and league_data[DataType.AWARD_HISTORICAL]:
            types.extend(["award_winner", "award_year", "award_nationality"])
        
        if DataType.SEASON_STATS_PLAYER in league_data and league_data[DataType.SEASON_STATS_PLAYER]:
            types.extend(["stat_leader", "player_team"])
        
        if DataType.SEASON_STATS_TEAM in league_data and league_data[DataType.SEASON_STATS_TEAM]:
            types.extend(["team_stat_best", "team_comparison"])
        
        if DataType.TOP_SCORERS in league_data and league_data[DataType.TOP_SCORERS]:
            types.append("top_scorer")
        
        return types
    
    @staticmethod
    def select_question_type(available_types: List[str]) -> str:
        """Select question type with simple weighting"""
        if not available_types:
            return "award_winner"  # fallback
        
        # Simple weights for different question types
        weights = {
            "award_winner": 3,
            "award_year": 2,
            "award_nationality": 2,
            "stat_leader": 3,
            "player_team": 2,
            "team_stat_best": 2,
            "team_comparison": 1,
            "top_scorer": 2
        }
        
        # Create weighted list
        weighted_types = []
        for qtype in available_types:
            weight = weights.get(qtype, 1)
            weighted_types.extend([qtype] * weight)
        
        return safe_random_choice(weighted_types) or available_types[0]


class CategoryGenerator:
    """Simple category generation for questions"""
    
    @staticmethod
    def generate_category(league: League, question_type: str, sport: str = "football") -> str:
        """Generate category name for question"""
        from .utils import get_league_display_name
        
        league_name = get_league_display_name(league.value)
        
        # Question type display names
        type_names = {
            "award_winner": "Awards",
            "award_year": "Award History", 
            "award_nationality": "Player Nationalities",
            "stat_leader": "Player Stats",
            "player_team": "Teams",
            "team_stat_best": "Team Performance",
            "team_comparison": "Team Comparisons",
            "top_scorer": "Top Scorers"
        }
        
        type_name = type_names.get(question_type, question_type.title())
        
        # Global/international awards get special treatment
        if league == League.GLOBAL:
            return f"International {type_name}"
        elif league == League.AFRICAN:
            return f"African Football {type_name}"
        else:
            return f"{league_name} {type_name}"


# Global quiz coordinator instance
_quiz_coordinator = None

def get_quiz_coordinator() -> QuizCoordinator:
    """Get global quiz coordinator instance"""
    global _quiz_coordinator
    if _quiz_coordinator is None:
        _quiz_coordinator = QuizCoordinator()
    return _quiz_coordinator