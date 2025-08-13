"""
Simple Football Adapter - Direct database integration
"""

import sqlite3
import random
import logging
from typing import Dict, Any, List
from pathlib import Path
from .football_questions import FootballQuestionGenerators


class SimpleFootballAdapter:
    """Direct football quiz adapter using the comprehensive database"""
    
    def __init__(self, sport_name: str = "football"):
        self.sport_name = sport_name
        self.logger = logging.getLogger(__name__)
        self.db_path = self._find_database()
        self.conn = None
        if self.db_path:
            self.conn = sqlite3.connect(self.db_path)
            self.logger.info(f"Connected to database: {self.db_path}")
        
        # Initialize data loader for survival data
        from .sport_data import SimpleDataLoader
        self.data_loader = SimpleDataLoader()
        
        # Initialize question generators
        self.question_generators = FootballQuestionGenerators(self.conn, self.sport_name)
    
    def _find_database(self) -> str:
        """Find the football database"""
        paths = [
            "/mnt/c/Users/hamza/OneDrive/Python_Scripts/VerveQ/data_cleaning/football_comprehensive.db",
            "data_cleaning/football_comprehensive.db",
            "../data_cleaning/football_comprehensive.db"
        ]
        for path in paths:
            if Path(path).exists():
                return path
        self.logger.error("Football database not found")
        return None
    
    def get_quiz_question(self) -> Dict[str, Any]:
        """Generate a random quiz question from the database"""
        if not self.conn:
            return self.question_generators.fallback_question()
        
        # Choose random question type
        question_types = [
            # Existing methods
            self.question_generators.high_scoring_match_question,
            self.question_generators.stadium_attendance_question,
            self.question_generators.player_goals_question,
            self.question_generators.high_stakes_match_question,
            self.question_generators.late_goal_question,
            self.question_generators.player_hat_trick_question,
            self.question_generators.team_biggest_win_question,
            # New Transfer Market methods
            self.question_generators.transfer_record_signing_question,
            self.question_generators.transfer_profit_question,
            self.question_generators.market_value_fluctuation_question,
            # New Managerial methods
            self.question_generators.manager_head_to_head_question,
            self.question_generators.giant_killing_question,
            self.question_generators.formation_tactics_question,
            # New Player Deep Dive methods
            self.question_generators.playmaker_assist_question,
            self.question_generators.super_sub_question,
            self.question_generators.team_captain_question
        ]
        
        # Try up to 3 times to generate a question
        for _ in range(3):
            try:
                generator = random.choice(question_types)
                question = generator()
                if question:
                    return question
            except Exception as e:
                self.logger.debug(f"Question generation attempt failed: {e}")
        
        return self.question_generators.fallback_question()
    
    def get_survival_data(self) -> Dict[str, List[str]]:
        """Get survival initials mapping for football from JSON data"""
        try:
            # Use the data loader to get actual survival data
            return self.data_loader.get_survival_data(self.sport_name)
        except Exception as e:
            self.logger.error(f"Failed to load survival data: {e}")
            # Return empty dict on error to avoid crashes
            return {}
    
    def get_sport_theme(self) -> Dict[str, str]:
        """Get theme colors and styling for football"""
        return {
            "primary": "#2E7D32",
            "secondary": "#66BB6A",
            "accent": "#FDD835",
            "background": "#F1F8E9"
        }