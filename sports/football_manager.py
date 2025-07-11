"""
Football Manager - Handles football-specific data and question generation.
Extracts existing football logic from the main application.
"""

import json
import random
from typing import Dict, List, Any, Optional, Tuple
from pathlib import Path
try:
    from Levenshtein import distance as levenshtein_distance
except ImportError:
    # Fallback implementation if Levenshtein is not available
    def levenshtein_distance(s1, s2):
        if len(s1) < len(s2):
            return levenshtein_distance(s2, s1)
        if len(s2) == 0:
            return len(s1)
        previous_row = list(range(len(s2) + 1))
        for i, c1 in enumerate(s1):
            current_row = [i + 1]
            for j, c2 in enumerate(s2):
                insertions = previous_row[j + 1] + 1
                deletions = current_row[j] + 1
                substitutions = previous_row[j] + (c1 != c2)
                current_row.append(min(insertions, deletions, substitutions))
            previous_row = current_row
        return previous_row[-1]

from .base_sport_manager import BaseSportManager

# Import existing football modules
try:
    from ..Data import JSONDataHandler
    from ..SurvivalDataHandler import SurvivalDataHandler
except ImportError:
    # Fallback for standalone execution
    import sys
    sys.path.append('..')
    from Data import JSONDataHandler
    from SurvivalDataHandler import SurvivalDataHandler


class FootballManager(BaseSportManager):
    """
    Football-specific sport manager implementation.
    Handles football data, questions, and survival mode.
    """
    
    def __init__(self, sport_name: str = 'football', data_root: str = None, data_handler=None):
        """
        Initialize the Football Manager.
        
        Args:
            sport_name: Name of the sport (should be 'football')
            data_root: Root directory for football data
            data_handler: Data handler instance (PostgreSQL or JSON)
        """
        super().__init__(sport_name, data_root, data_handler)
        
        # Football-specific survival handler
        self.survival_handler = None
        self.initials_map = None
        
        # Football nation codes mapping
        self.nation_codes = {
            'ARG': 'Argentina', 'BRA': 'Brazil', 'FRA': 'France', 'ENG': 'England',
            'POR': 'Portugal', 'ESP': 'Spain', 'GER': 'Germany', 'ITA': 'Italy',
            'NED': 'Netherlands', 'BEL': 'Belgium', 'CRO': 'Croatia', 'URU': 'Uruguay',
            'DEN': 'Denmark', 'SWE': 'Sweden', 'NOR': 'Norway', 'POL': 'Poland',
            'CZE': 'Czech Republic', 'WAL': 'Wales', 'SCO': 'Scotland', 'NIR': 'Northern Ireland',
            'AUT': 'Austria', 'SUI': 'Switzerland', 'SRB': 'Serbia', 'HUN': 'Hungary',
            'BUL': 'Bulgaria', 'ROU': 'Romania', 'GRE': 'Greece', 'TUR': 'Turkey',
            'RUS': 'Russia', 'UKR': 'Ukraine', 'MAR': 'Morocco', 'EGY': 'Egypt',
            'NGA': 'Nigeria', 'CMR': 'Cameroon', 'GHA': 'Ghana', 'SEN': 'Senegal',
            'TRI': 'Trinidad and Tobago', 'LBR': 'Liberia', 'URS': 'Soviet Union',
            'TCH': 'Czechoslovakia', 'USA': 'United States', 'CIV': "Côte d'Ivoire",
            'ALG': 'Algeria', 'CHI': 'Chile', 'COL': 'Colombia', 'PAR': 'Paraguay',
            'KOR': 'South Korea', 'JPN': 'Japan', 'AUS': 'Australia', 'CAN': 'Canada',
            'MEX': 'Mexico', 'IRL': 'Republic of Ireland', 'COD': 'DR Congo'
        }
        
        # Football position mappings
        self.position_mappings = {
            'GK': 'Goalkeeper',
            'DF': 'Defender', 
            'MF': 'Midfielder',
            'FW': 'Forward',
            'FW,MF': 'Forward/Midfielder',
            'MF,FW': 'Midfielder/Forward',
            'DF,MF': 'Defender/Midfielder'
        }
    
    def initialize(self) -> bool:
        """
        Initialize football-specific data handlers.
        
        Returns:
            True if initialization successful, False otherwise
        """
        try:
            # Use injected data handler or create JSON fallback
            if not self.data_handler:
                # Fallback to JSON if no data handler provided
                data_path = self.data_root / "data" if self.data_root else "data"
                from ..Data import JSONDataHandler
                self.data_handler = JSONDataHandler(data_root=str(data_path))
            
            # Initialize survival data handler
            self.survival_handler = SurvivalDataHandler()
            
            # Load survival initials map
            initials_file = self.data_root / "survival_initials_map.json" if self.data_root else Path("survival_initials_map.json")
            if initials_file.exists():
                with open(initials_file, 'r', encoding='utf-8') as f:
                    self.initials_map = json.load(f)
            
            self._initialized = True
            return True
            
        except Exception as e:
            print(f"Error initializing football manager: {e}")
            return False
    
    def get_available_competitions(self) -> List[Dict[str, Any]]:
        """
        Get available football competitions.
        
        Returns:
            List of competition metadata
        """
        if not self._initialized or not self.data_handler:
            return []
        
        return self.data_handler.get_available_competitions()
    
    def get_quiz_data(self, competition_id: str) -> Optional[Dict[str, Any]]:
        """
        Get football quiz data for a competition.
        
        Args:
            competition_id: Competition identifier
            
        Returns:
            Competition data or None if not found
        """
        if not self._initialized or not self.data_handler:
            return None
        
        # Try to get award data first
        award_data = self.data_handler.get_award_data(competition_id)
        if award_data:
            return {
                'type': 'award',
                'data': award_data,
                'competition_id': competition_id
            }
        
        # Try to get stats data
        stat_names = self.data_handler.get_all_stat_names(competition_id)
        if stat_names:
            stats_data = {}
            for stat_name in stat_names:
                stats_data[stat_name] = self.data_handler.get_stats_data(competition_id, stat_name)
            
            return {
                'type': 'stats',
                'data': stats_data,
                'competition_id': competition_id
            }
        
        return None
    
    def get_survival_data(self) -> Dict[str, Any]:
        """
        Get football survival mode data.
        
        Returns:
            Dictionary containing survival data
        """
        if not self._initialized:
            return {'initials_map': {}, 'total_players': 0}
        
        if self.initials_map:
            return self.initials_map
        
        # Fallback to survival handler
        if self.survival_handler:
            try:
                self.survival_handler.ensure_loaded()
                return {
                    'initials_map': getattr(self.survival_handler, 'initials_map', {}),
                    'total_players': len(self.survival_handler.get_all_players()),
                    'unique_initials': len(getattr(self.survival_handler, 'initials_map', {}))
                }
            except Exception:
                pass
        
        return {'initials_map': {}, 'total_players': 0}
    
    def validate_survival_answer(self, answer: str, initials: str, 
                                max_mistakes: int = 2) -> Tuple[bool, Optional[str]]:
        """
        Validate football survival answer.
        
        Args:
            answer: Player answer
            initials: Target initials
            max_mistakes: Maximum allowed spelling mistakes
            
        Returns:
            Tuple of (is_valid, matched_player_name)
        """
        if not self._initialized:
            return False, None
        
        # Use survival handler if available
        if self.survival_handler:
            try:
                return self.survival_handler.validate_answer(answer, initials, max_mistakes)
            except Exception:
                pass
        
        # Fallback to initials map
        if not self.initials_map or 'initials_map' not in self.initials_map:
            return False, None
        
        initials = initials.upper()
        players_with_initials = self.initials_map['initials_map'].get(initials, [])
        
        if not players_with_initials:
            return False, None
        
        # Check for exact match first
        answer_clean = answer.strip().lower()
        for player in players_with_initials:
            if player.lower() == answer_clean:
                return True, player
        
        # Check for fuzzy matches within max_mistakes
        for player in players_with_initials:
            distance = levenshtein_distance(answer_clean, player.lower())
            if distance <= max_mistakes:
                return True, player
        
        return False, None
    
    def get_question_templates(self) -> List[Dict[str, Any]]:
        """
        Get football-specific question templates.
        
        Returns:
            List of question template definitions
        """
        return [
            {
                'type': 'award_winner',
                'description': 'Questions about award winners',
                'example': 'Who won the Ballon d\'Or in 2023?'
            },
            {
                'type': 'award_season',
                'description': 'Questions about when awards were won',
                'example': 'In which season did Messi win his first Ballon d\'Or?'
            },
            {
                'type': 'award_team',
                'description': 'Questions about teams when awards were won',
                'example': 'Which team was Ronaldinho playing for when he won the Ballon d\'Or?'
            },
            {
                'type': 'award_nationality',
                'description': 'Questions about player nationalities',
                'example': 'What nationality is Virgil van Dijk?'
            },
            {
                'type': 'award_position',
                'description': 'Questions about player positions',
                'example': 'What position does Kevin De Bruyne play?'
            },
            {
                'type': 'stat_leader',
                'description': 'Questions about statistical leaders',
                'example': 'Who led the Premier League in goals in 2023?'
            },
            {
                'type': 'stat_value',
                'description': 'Questions about specific statistics',
                'example': 'How many goals did Haaland score in his first Premier League season?'
            }
        ]
    
    def generate_questions(self, competition_id: str, question_type: str, 
                          num_questions: int = 10) -> List[Dict[str, Any]]:
        """
        Generate football-specific questions.
        
        Args:
            competition_id: Competition to generate from
            question_type: Type of questions to generate
            num_questions: Number of questions
            
        Returns:
            List of generated questions
        """
        if not self._initialized or not self.data_handler:
            return []
        
        # This would integrate with the existing QuizGenerator
        # For now, return empty list as the existing system handles this
        return []
    
    def get_player_suggestions(self, partial_name: str, limit: int = 10) -> List[str]:
        """
        Get football player name suggestions.
        
        Args:
            partial_name: Partial player name
            limit: Maximum suggestions
            
        Returns:
            List of suggested player names
        """
        if not self._initialized or not self.data_handler:
            return []
        
        # Get all players from data handler
        all_players = self.data_handler.get_all_players_across_competitions()
        
        # Filter by partial name
        partial_lower = partial_name.lower()
        suggestions = [
            player for player in all_players
            if partial_lower in player.lower()
        ]
        
        # Sort by relevance (starts with > contains)
        suggestions.sort(key=lambda x: (
            not x.lower().startswith(partial_lower),
            len(x),
            x.lower()
        ))
        
        return suggestions[:limit]
    
    def get_sport_icon(self) -> str:
        """Get football emoji icon."""
        return "⚽"
    
    def get_theme_colors(self) -> Dict[str, str]:
        """Get football theme colors."""
        return {
            'primary': '#2d5a3d',      # Field green
            'secondary': '#4a7c59',    # Grass accent
            'accent': '#ffffff',       # Field lines
            'background': '#1a2d1e',   # Dark field
            'text': '#ffffff'
        }
    
    def get_terminology(self) -> Dict[str, str]:
        """Get football-specific terminology."""
        return {
            'athlete': 'player',
            'athletes': 'players',
            'team': 'team',
            'teams': 'teams',
            'match': 'match',
            'matches': 'matches',
            'competition': 'league',
            'competitions': 'leagues',
            'championship': 'title',
            'championships': 'titles'
        }
    
    def convert_nation_code(self, code: str) -> str:
        """Convert 3-letter country code to full name."""
        return self.nation_codes.get(code, code)
    
    def convert_position(self, pos: str) -> str:
        """Convert position abbreviation to full name."""
        return self.position_mappings.get(pos, pos)
    
    def is_country_name(self, name: str) -> bool:
        """Check if a name is a country name."""
        return name in self.nation_codes.values()
    
    def get_main_team_from_squad(self, squad: str) -> Optional[str]:
        """Extract primary club from squad string."""
        if not squad:
            return None
        
        team_parts = squad.split(',')
        for part in reversed(team_parts):
            part = part.strip()
            if part and not self.is_country_name(part):
                return part
        
        return None