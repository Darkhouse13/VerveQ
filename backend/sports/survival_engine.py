"""
Survival mode engine for VerveQ sports quiz game.
Handles initial-based name matching with progressive difficulty.
"""

import random
from typing import Dict, List, Tuple, Optional, Set
from .sport_data import get_data_loader
from .utils import (
    get_player_initials, normalize_name, calculate_similarity,
    safe_random_choice, log_simple
)
from .survival_helpers import FameCalculator, PlayerInfoExtractor, PlayerSelector


class DifficultyLevel:
    """Difficulty level configuration"""
    
    def __init__(self, name: str, min_initials_length: int, max_initials_length: int,
                 famous_player_weight: float, allow_uncommon_players: bool):
        self.name = name
        self.min_initials_length = min_initials_length
        self.max_initials_length = max_initials_length
        self.famous_player_weight = famous_player_weight
        self.allow_uncommon_players = allow_uncommon_players


class SurvivalEngine:
    """Engine for survival mode name matching game"""
    
    def __init__(self):
        """Initialize survival engine"""
        self.data_loader = get_data_loader()
        self.used_initials: Set[str] = set()
        
        # Initialize helper components
        self.fame_calculator = FameCalculator()
        self.info_extractor = PlayerInfoExtractor()
        
        # Define difficulty progression
        self.difficulty_levels = {
            1: DifficultyLevel("Easy", 2, 2, 1.0, False),      # Round 1: 2-letter initials, famous only
            2: DifficultyLevel("Easy", 2, 2, 1.0, False),      # Round 2: 2-letter initials, famous only
            3: DifficultyLevel("Medium", 2, 3, 0.8, False),    # Round 3: 2-3 letters, mostly famous
            4: DifficultyLevel("Medium", 2, 3, 0.6, True),     # Round 4: 2-3 letters, some uncommon
            5: DifficultyLevel("Hard", 3, 3, 0.4, True),       # Round 5: 3 letters, more uncommon
            6: DifficultyLevel("Hard", 3, 4, 0.3, True),       # Round 6: 3-4 letters, mostly uncommon
            7: DifficultyLevel("Expert", 4, 4, 0.2, True),     # Round 7+: 4 letters, very uncommon
        }
    
    def generate_challenge(self, round_number: int, sport: str = "football") -> Optional[Dict]:
        """Generate a survival challenge for given round"""
        difficulty = self._get_difficulty_for_round(round_number)
        
        # Load survival data for sport
        survival_data = self.data_loader.get_survival_data(sport)
        if not survival_data:
            log_simple(f"No survival data found for {sport}", "ERROR")
            return None
        
        # Get players with fame scores
        player_candidates = PlayerSelector.get_player_candidates(
            survival_data, difficulty, sport, self.fame_calculator
        )
        
        if not player_candidates:
            log_simple(f"No suitable players found for round {round_number}", "ERROR")
            return None
        
        # Select player based on difficulty and fame
        selected_player = PlayerSelector.select_player_by_difficulty(player_candidates, difficulty)
        
        if not selected_player:
            return None
        
        player_name, fame_score = selected_player
        initials = get_player_initials(player_name)
        
        # Check if initials already used and find alternative if needed
        if initials in self.used_initials:
            for _ in range(5):
                alt_player = PlayerSelector.select_player_by_difficulty(player_candidates, difficulty)
                if alt_player:
                    alt_name, _ = alt_player
                    alt_initials = get_player_initials(alt_name)
                    if alt_initials not in self.used_initials:
                        player_name, fame_score = alt_name, _
                        initials = alt_initials
                        break
        
        # Mark initials as used
        self.used_initials.add(initials)
        
        # Get additional info for the player
        player_info = self.info_extractor.get_player_info(player_name, sport)
        
        return {
            "round": round_number,
            "initials": initials,
            "correct_answer": player_name,
            "difficulty": difficulty.name,
            "fame_score": fame_score,
            "sport": sport,
            "hints": player_info.get("hints", []),
            "category": player_info.get("category", "Unknown")
        }
    
    def validate_answer(self, challenge: Dict, user_answer: str) -> Dict[str, any]:
        """Validate user's answer against the challenge"""
        correct_name = challenge["correct_answer"]
        
        # Normalize both names for comparison
        norm_correct = normalize_name(correct_name)
        norm_answer = normalize_name(user_answer)
        
        # Calculate similarity
        similarity = calculate_similarity(norm_correct, norm_answer)
        
        # Determine if answer is correct (allow some flexibility)
        is_correct = similarity >= 0.8  # 80% similarity threshold
        is_close = 0.5 <= similarity < 0.8  # Close but not quite
        
        return {
            "is_correct": is_correct,
            "is_close": is_close,
            "similarity": similarity,
            "correct_answer": correct_name,
            "user_answer": user_answer
        }
    
    def get_hint(self, challenge: Dict) -> Optional[str]:
        """Get a hint for the current challenge"""
        hints = challenge.get("hints", [])
        if hints:
            return safe_random_choice(hints)
        return None
    
    def reset_game(self) -> None:
        """Reset the survival game state"""
        self.used_initials.clear()
        log_simple("Survival game reset")
    
    def get_stats(self) -> Dict[str, any]:
        """Get survival engine statistics"""
        return {
            "used_initials_count": len(self.used_initials),
            "difficulty_levels": len(self.difficulty_levels),
            "max_round_configured": max(self.difficulty_levels.keys())
        }
    
    def _get_difficulty_for_round(self, round_number: int) -> DifficultyLevel:
        """Get difficulty level for given round"""
        if round_number <= 7:
            return self.difficulty_levels[round_number]
        else:
            # Beyond round 7, use expert difficulty
            return self.difficulty_levels[7]


# Global survival engine instance
_survival_engine = None

def get_survival_engine() -> SurvivalEngine:
    """Get global survival engine instance"""
    global _survival_engine
    if _survival_engine is None:
        _survival_engine = SurvivalEngine()
    return _survival_engine