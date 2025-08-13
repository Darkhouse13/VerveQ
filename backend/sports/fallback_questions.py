"""
Fallback questions for football quiz when data generation fails.
Provides variety to avoid repetition of the same fallback question.
"""

import random
from typing import Dict, Any, List
from .utils import create_question_dict, shuffle_options


class FallbackQuestions:
    """Pool of general football questions for fallback scenarios"""
    
    # Pool of general football knowledge questions
    FALLBACK_POOL = [
        {
            "question": "Which sport is known as 'The Beautiful Game'?",
            "correct": "Football",
            "wrong": ["Basketball", "Tennis", "Golf"],
            "category": "General Football"
        },
        {
            "question": "How many players are on a football team on the field?",
            "correct": "11",
            "wrong": ["10", "12", "9"],
            "category": "Football Rules"
        },
        {
            "question": "What is the maximum number of substitutions allowed in a regular football match?",
            "correct": "3",
            "wrong": ["5", "2", "4"],
            "category": "Football Rules"
        },
        {
            "question": "How long is a regular football match (excluding extra time)?",
            "correct": "90 minutes",
            "wrong": ["80 minutes", "100 minutes", "120 minutes"],
            "category": "Football Rules"
        },
        {
            "question": "Which country has won the most FIFA World Cups?",
            "correct": "Brazil",
            "wrong": ["Germany", "Argentina", "Italy"],
            "category": "World Cup History"
        },
        {
            "question": "What color card results in a player being sent off?",
            "correct": "Red",
            "wrong": ["Yellow", "Blue", "Green"],
            "category": "Football Rules"
        },
        {
            "question": "Which position is responsible for preventing goals?",
            "correct": "Goalkeeper",
            "wrong": ["Striker", "Midfielder", "Defender"],
            "category": "Football Positions"
        },
        {
            "question": "What shape is a football field?",
            "correct": "Rectangle",
            "wrong": ["Square", "Circle", "Oval"],
            "category": "Football Basics"
        },
        {
            "question": "How many halves are in a football match?",
            "correct": "2",
            "wrong": ["3", "4", "1"],
            "category": "Football Rules"
        },
        {
            "question": "What is awarded when the ball goes out of bounds on the sideline?",
            "correct": "Throw-in",
            "wrong": ["Corner kick", "Goal kick", "Penalty"],
            "category": "Football Rules"
        },
        {
            "question": "Which tournament is considered the most prestigious in European club football?",
            "correct": "UEFA Champions League",
            "wrong": ["Europa League", "Conference League", "Super Cup"],
            "category": "Football Tournaments"
        },
        {
            "question": "What is the term for scoring three goals in one match?",
            "correct": "Hat-trick",
            "wrong": ["Triple", "Trilogy", "Treble"],
            "category": "Football Terms"
        },
        {
            "question": "Which line do players need to cross to score a goal?",
            "correct": "Goal line",
            "wrong": ["Penalty line", "Halfway line", "Touchline"],
            "category": "Football Rules"
        },
        {
            "question": "What is the minimum number of players a team needs to continue a match?",
            "correct": "7",
            "wrong": ["8", "9", "6"],
            "category": "Football Rules"
        },
        {
            "question": "Which official runs along the sideline with a flag?",
            "correct": "Linesman/Assistant Referee",
            "wrong": ["Referee", "Fourth Official", "VAR Official"],
            "category": "Football Officials"
        }
    ]
    
    # Track recently used fallbacks to avoid immediate repetition
    _recent_fallbacks: List[int] = []
    _max_recent = 5
    
    @classmethod
    def get_fallback_question(cls) -> Dict[str, Any]:
        """Get a fallback question, avoiding recent ones"""
        # Get indices of questions not recently used
        available_indices = [
            i for i in range(len(cls.FALLBACK_POOL))
            if i not in cls._recent_fallbacks
        ]
        
        # If all have been used recently, reset
        if not available_indices:
            cls._recent_fallbacks = []
            available_indices = list(range(len(cls.FALLBACK_POOL)))
        
        # Select a random question
        selected_index = random.choice(available_indices)
        fallback = cls.FALLBACK_POOL[selected_index]
        
        # Track this selection
        cls._recent_fallbacks.append(selected_index)
        if len(cls._recent_fallbacks) > cls._max_recent:
            cls._recent_fallbacks.pop(0)
        
        # Create question dict
        options = shuffle_options(fallback["correct"], fallback["wrong"])
        return create_question_dict(
            fallback["question"],
            options,
            fallback["correct"],
            fallback["category"]
        )
    
    @classmethod
    def reset_recent_history(cls):
        """Reset the recent fallback history"""
        cls._recent_fallbacks = []