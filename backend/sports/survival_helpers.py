"""
Helper functions for survival mode engine.
Contains fame calculation and player info extraction logic.
"""

from typing import Dict, List, Any, Optional
from .sport_data import get_data_loader
from .utils import normalize_name, safe_random_choice, get_country_name


class FameCalculator:
    """Calculate player fame scores based on achievements"""
    
    def __init__(self):
        """Initialize fame calculator"""
        self.data_loader = get_data_loader()
        
        # Fame scoring weights
        self.fame_indicators = {
            "ballon_d_or": 10,
            "recent_award": 8,
            "multiple_awards": 6,
            "single_award": 4,
            "current_stats": 3,
            "historical_only": 1
        }
    
    def calculate_fame_score(self, player_name: str, sport: str) -> int:
        """Calculate fame score for a player based on their achievements"""
        if sport != "football":
            return 3  # Default score for non-football sports
        
        # Load all football data to assess fame
        all_data = self.data_loader.get_all_football_data()
        
        fame_score = 0
        award_count = 0
        has_recent_award = False
        has_global_award = False
        has_current_stats = False
        
        # Check awards across all leagues
        for league, league_data in all_data.items():
            for data_type, data_list in league_data.items():
                if "AWARD" in str(data_type):
                    for item in data_list:
                        if hasattr(item, 'winner_name') and normalize_name(item.winner_name) == normalize_name(player_name):
                            award_count += 1
                            if item.year >= 2015:  # Recent award
                                has_recent_award = True
                            if "global" in str(league).lower() or "ballon" in item.award_name.lower():
                                has_global_award = True
                
                # Check current stats
                elif "STATS_PLAYER" in str(data_type):
                    for item in data_list:
                        if hasattr(item, 'player_name') and normalize_name(item.player_name) == normalize_name(player_name):
                            has_current_stats = True
        
        # Calculate fame score
        if has_global_award:
            fame_score += self.fame_indicators["ballon_d_or"]
        elif award_count > 1:
            fame_score += self.fame_indicators["multiple_awards"]
        elif award_count == 1:
            if has_recent_award:
                fame_score += self.fame_indicators["recent_award"]
            else:
                fame_score += self.fame_indicators["single_award"]
        
        if has_current_stats:
            fame_score += self.fame_indicators["current_stats"]
        elif award_count == 0:
            fame_score += self.fame_indicators["historical_only"]
        
        return max(1, fame_score)  # Minimum score of 1


class PlayerInfoExtractor:
    """Extract player information for hints"""
    
    def __init__(self):
        """Initialize player info extractor"""
        self.data_loader = get_data_loader()
    
    def get_player_info(self, player_name: str, sport: str) -> Dict[str, Any]:
        """Get additional info about player for hints"""
        if sport != "football":
            return {"hints": [f"This is a {sport} player"], "category": sport.title()}
        
        hints = []
        category = "Football"
        
        # Try to get info from loaded data
        all_data = self.data_loader.get_all_football_data()
        
        for league, league_data in all_data.items():
            for data_type, data_list in league_data.items():
                for item in data_list:
                    item_name = ""
                    if hasattr(item, 'winner_name'):
                        item_name = item.winner_name
                    elif hasattr(item, 'player_name'):
                        item_name = item.player_name
                    elif hasattr(item, 'name'):
                        item_name = item.name
                    
                    if normalize_name(item_name) == normalize_name(player_name):
                        # Add hints based on what we know
                        if hasattr(item, 'nationality') and item.nationality:
                            country = get_country_name(item.nationality)
                            hints.append(f"From {country}")
                        
                        if hasattr(item, 'team') and item.team:
                            hints.append(f"Played for {item.team}")
                        
                        if hasattr(item, 'position') and item.position:
                            hints.append(f"Position: {item.position}")
                        
                        if hasattr(item, 'award_name'):
                            hints.append(f"Won {item.award_name}")
                            category = "Award Winner"
                        
                        if hasattr(item, 'year') and item.year:
                            if item.year >= 2020:
                                hints.append("Active in recent years")
                            elif item.year >= 2000:
                                hints.append("Active in 2000s-2010s")
                            else:
                                hints.append("Played before 2000")
        
        # Remove duplicates while preserving order
        seen = set()
        unique_hints = []
        for hint in hints:
            if hint not in seen:
                seen.add(hint)
                unique_hints.append(hint)
        
        return {
            "hints": unique_hints[:3],  # Limit to 3 hints
            "category": category
        }


class PlayerSelector:
    """Handle player selection based on difficulty"""
    
    @staticmethod
    def select_player_by_difficulty(candidates: List[tuple], difficulty) -> Optional[tuple]:
        """Select player based on difficulty settings and fame weighting"""
        if not candidates:
            return None
        
        # Create weighted list based on fame and difficulty
        weighted_candidates = []
        
        for player_name, fame_score in candidates:
            # Apply difficulty weighting
            if difficulty.famous_player_weight >= 0.8:  # Easy: prefer famous players
                weight = fame_score
            elif difficulty.famous_player_weight >= 0.5:  # Medium: balanced
                weight = max(1, fame_score // 2)
            else:  # Hard: prefer less famous players
                weight = max(1, 10 - fame_score)
            
            # Add to weighted list
            weighted_candidates.extend([(player_name, fame_score)] * weight)
        
        return safe_random_choice(weighted_candidates)
    
    @staticmethod
    def get_player_candidates(survival_data: Dict, difficulty, sport: str, fame_calculator: FameCalculator) -> List[tuple]:
        """Get player candidates with fame scores based on difficulty"""
        candidates = []
        
        # Get all players from survival data
        for initials, players in survival_data.items():
            # Filter by initials length based on difficulty
            if not (difficulty.min_initials_length <= len(initials) <= difficulty.max_initials_length):
                continue
            
            for player in players:
                if not player:
                    continue
                
                # Calculate fame score
                fame_score = fame_calculator.calculate_fame_score(player, sport)
                
                # Filter by fame based on difficulty
                if not difficulty.allow_uncommon_players and fame_score < 3:
                    continue
                
                candidates.append((player, fame_score))
        
        return candidates