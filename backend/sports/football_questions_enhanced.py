"""
Enhanced football question generators - Combines all new categories
"""

import sqlite3
import random
import logging
from typing import Dict, Any, Optional
from .football_transfer_questions import FootballTransferQuestions
from .football_manager_questions import FootballManagerQuestions
from .football_player_questions import FootballPlayerQuestions


class FootballQuestionGeneratorsEnhanced(FootballTransferQuestions, FootballManagerQuestions, FootballPlayerQuestions):
    """Enhanced question generation methods combining all new categories"""
    
    def __init__(self, conn: Optional[sqlite3.Connection], sport_name: str = "football"):
        # Initialize all parent classes
        FootballTransferQuestions.__init__(self, conn, sport_name)
        FootballManagerQuestions.__init__(self, conn, sport_name)
        FootballPlayerQuestions.__init__(self, conn, sport_name)
        
        self.conn = conn
        self.sport_name = sport_name
        self.logger = logging.getLogger(__name__)
    
    def fallback_question(self) -> Dict[str, Any]:
        """Fallback to general football questions"""
        questions = [
            {
                "question": "Which country won the 2018 FIFA World Cup?",
                "options": ["France", "Croatia", "Belgium", "England"],
                "correct_answer": "France",
                "explanation": "France defeated Croatia 4-2 in the final.",
                "category": "world_cup",
                "difficulty": "beginner"
            },
            {
                "question": "Who holds the record for most goals in a single World Cup tournament?",
                "options": ["Just Fontaine", "Gerd Müller", "Ronaldo", "Miroslav Klose"],
                "correct_answer": "Just Fontaine",
                "explanation": "Just Fontaine scored 13 goals in the 1958 World Cup.",
                "category": "world_cup",
                "difficulty": "advanced"
            },
            {
                "question": "Which club has won the most UEFA Champions League titles?",
                "options": ["Real Madrid", "AC Milan", "Liverpool", "Bayern Munich"],
                "correct_answer": "Real Madrid",
                "explanation": "Real Madrid has won 14 Champions League titles.",
                "category": "champions_league",
                "difficulty": "intermediate"
            }
        ]
        
        selected = random.choice(questions)
        selected.update({
            "source": "fallback",
            "sport": self.sport_name
        })
        return selected