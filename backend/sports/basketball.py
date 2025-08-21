import os
import random
from typing import List, Dict, Any
from .base import SportQuestionGenerator, SportDataFactory

class BasketballQuestionGenerator(SportQuestionGenerator):
    """Basketball/NBA-specific question generator for survival mode"""
    
    def __init__(self, sport_name: str):
        super().__init__(sport_name)
        
    def get_quiz_question(self) -> Dict[str, Any]:
        """Generate a random basketball quiz question - not implemented as we use database"""
        raise NotImplementedError("Basketball questions are served from database, not generated dynamically")
    
    def get_survival_data(self) -> Dict[str, List[str]]:
        """Get NBA survival initials mapping"""
        # Use absolute path from project root
        project_root = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
        survival_path = os.path.join(project_root, "data", "survival_data", "nba_survival_data.json")
        
        try:
            data = self.load_json_file(survival_path)
            
            # NBA survival data is already in the correct format (direct mapping)
            if isinstance(data, dict):
                return data
            return {}
        except Exception:
            return {}
    
    def get_sport_theme(self) -> Dict[str, str]:
        """Get basketball theme colors and styling"""
        return {
            "primary_color": "#ff6900",      # Basketball orange
            "secondary_color": "#4a90e2",    # Court blue
            "accent_color": "#ffffff",       # White
            "background_color": "#fff5f0",   # Light orange background
            "text_color": "#2c3e50",         # Dark text
            "icon": "🏀",
            "display_name": "Basketball"
        }

# Register the basketball sport
SportDataFactory.register_sport("basketball", BasketballQuestionGenerator)