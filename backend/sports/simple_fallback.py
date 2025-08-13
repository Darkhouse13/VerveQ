"""
Simple Football Fallback Generator
CLAUDE.md compliant fallback for when database is unavailable
"""

import random
from typing import Dict, Any, List
from .fallback_questions import FallbackQuestions


class SimpleFallbackGenerator:
    """Simple fallback generator using basic football questions"""
    
    def __init__(self, sport_name: str = "football"):
        self.sport_name = sport_name
    
    def get_quiz_question(self) -> Dict[str, Any]:
        """Get a random fallback question"""
        try:
            question_data = FallbackQuestions.get_fallback_question()
            return {
                "question": question_data["question"],
                "options": question_data["options"],
                "correct_answer": question_data["correct_answer"],
                "explanation": question_data.get("explanation", ""),
                "category": question_data.get("category", "football_basics"),
                "difficulty": question_data.get("difficulty", "beginner"),
                "source": "fallback",
                "sport": self.sport_name
            }
        except:
            return self._basic_fallback()
    
    def _basic_fallback(self) -> Dict[str, Any]:
        """Ultimate fallback question"""
        return {
            "question": "How many players are on a football team?",
            "options": ["9", "10", "11", "12"],
            "correct_answer": "11",
            "explanation": "A football team has 11 players on the field.",
            "category": "football_basics",
            "difficulty": "beginner",
            "source": "basic_fallback",
            "sport": self.sport_name
        }
    
    def get_survival_data(self) -> Dict[str, List[str]]:
        """Get survival initials mapping for football"""
        return {
            "CR": ["Cristiano Ronaldo"],
            "LM": ["Lionel Messi"],
            "NJ": ["Neymar Jr"],
            "KM": ["Kylian Mbappé"],
            "MO": ["Mohamed Salah"],
            "RB": ["Robert Lewandowski"]
        }
    
    def get_sport_theme(self) -> Dict[str, str]:
        """Get theme colors and styling for football"""
        return {
            "primary": "#2E7D32",
            "secondary": "#66BB6A", 
            "accent": "#FDD835",
            "background": "#F1F8E9"
        }