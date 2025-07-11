"""
Base Sport Manager - Abstract base class for all sport-specific implementations.
Defines the interface that all sport managers must implement.
"""

from abc import ABC, abstractmethod
from typing import Dict, List, Any, Optional, Tuple
from pathlib import Path


class BaseSportManager(ABC):
    """
    Abstract base class for sport-specific managers.
    Each sport (football, tennis, basketball) implements this interface.
    """
    
    def __init__(self, sport_name: str, data_root: str = None, data_handler=None):
        """
        Initialize the sport manager.
        
        Args:
            sport_name: Name of the sport (e.g., 'football', 'tennis')
            data_root: Root directory for sport-specific data
            data_handler: Data handler instance (PostgreSQL or JSON)
        """
        self.sport_name = sport_name
        self.data_root = Path(data_root) if data_root else Path('.')
        self.data_handler = data_handler
        self._initialized = False
    
    @abstractmethod
    def initialize(self) -> bool:
        """
        Initialize sport-specific data and resources.
        
        Returns:
            True if initialization successful, False otherwise
        """
        pass
    
    @abstractmethod
    def get_available_competitions(self) -> List[Dict[str, Any]]:
        """
        Get list of available competitions/datasets for this sport.
        
        Returns:
            List of competition dictionaries with metadata
        """
        pass
    
    @abstractmethod
    def get_quiz_data(self, competition_id: str) -> Optional[Dict[str, Any]]:
        """
        Get quiz data for a specific competition.
        
        Args:
            competition_id: Identifier for the competition
            
        Returns:
            Competition data or None if not found
        """
        pass
    
    @abstractmethod
    def get_survival_data(self) -> Dict[str, Any]:
        """
        Get survival mode data (player initials map, etc.).
        
        Returns:
            Dictionary containing survival mode data
        """
        pass
    
    @abstractmethod
    def validate_survival_answer(self, answer: str, initials: str, 
                                max_mistakes: int = 2) -> Tuple[bool, Optional[str]]:
        """
        Validate a survival mode answer.
        
        Args:
            answer: Player answer
            initials: Target initials
            max_mistakes: Maximum allowed spelling mistakes
            
        Returns:
            Tuple of (is_valid, matched_player_name)
        """
        pass
    
    @abstractmethod
    def get_question_templates(self) -> List[Dict[str, Any]]:
        """
        Get sport-specific question templates.
        
        Returns:
            List of question template definitions
        """
        pass
    
    @abstractmethod
    def generate_questions(self, competition_id: str, question_type: str, 
                          num_questions: int = 10) -> List[Dict[str, Any]]:
        """
        Generate sport-specific questions.
        
        Args:
            competition_id: Competition to generate questions from
            question_type: Type of questions to generate
            num_questions: Number of questions to generate
            
        Returns:
            List of generated questions
        """
        pass
    
    @abstractmethod
    def get_player_suggestions(self, partial_name: str, limit: int = 10) -> List[str]:
        """
        Get player name suggestions for autocomplete.
        
        Args:
            partial_name: Partial player name
            limit: Maximum number of suggestions
            
        Returns:
            List of suggested player names
        """
        pass
    
    # Common utility methods that can be shared across sports
    
    def is_initialized(self) -> bool:
        """Check if the sport manager is initialized."""
        return self._initialized
    
    def get_sport_name(self) -> str:
        """Get the name of this sport."""
        return self.sport_name
    
    def get_sport_config(self) -> Dict[str, Any]:
        """
        Get sport-specific configuration.
        
        Returns:
            Configuration dictionary for this sport
        """
        return {
            'name': self.sport_name,
            'display_name': self.sport_name.title(),
            'icon': self.get_sport_icon(),
            'theme_colors': self.get_theme_colors(),
            'terminology': self.get_terminology()
        }
    
    @abstractmethod
    def get_sport_icon(self) -> str:
        """Get the emoji icon for this sport."""
        pass
    
    @abstractmethod
    def get_theme_colors(self) -> Dict[str, str]:
        """Get theme colors for this sport."""
        pass
    
    @abstractmethod
    def get_terminology(self) -> Dict[str, str]:
        """Get sport-specific terminology mappings."""
        pass
    
    def format_competition_name(self, competition_id: str) -> str:
        """
        Format competition ID into a display name.
        
        Args:
            competition_id: Raw competition identifier
            
        Returns:
            Formatted display name
        """
        # Default implementation - sports can override
        return competition_id.replace('_', ' ').title()
    
    def calculate_sport_difficulty(self, question_data: Dict[str, Any]) -> float:
        """
        Calculate sport-specific difficulty score.
        
        Args:
            question_data: Question data dictionary
            
        Returns:
            Difficulty score between 0.0 and 1.0
        """
        # Default implementation - sports should override with specific logic
        return 0.5
    
    def validate_question_quality(self, question: Dict[str, Any]) -> Dict[str, Any]:
        """
        Validate the quality of a generated question.
        
        Args:
            question: Question dictionary
            
        Returns:
            Validation result with score and recommendations
        """
        # Default implementation - sports can override
        return {
            'is_valid': True,
            'quality_score': 0.7,
            'issues': [],
            'recommendations': []
        }