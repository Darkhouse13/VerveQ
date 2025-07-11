"""
Tennis Manager - Handles tennis-specific data and question generation.
Processes ATP tennis data and generates tennis-themed questions.
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
from collections import defaultdict

from .base_sport_manager import BaseSportManager


class TennisManager(BaseSportManager):
    """
    Tennis-specific sport manager implementation.
    Handles tennis data, questions, and survival mode.
    """
    
    def __init__(self, sport_name: str = 'tennis', data_root: str = None, data_handler=None):
        """
        Initialize the Tennis Manager.
        
        Args:
            sport_name: Name of the sport (should be 'tennis')
            data_root: Root directory for tennis data
            data_handler: Data handler instance (PostgreSQL or JSON)
        """
        super().__init__(sport_name, data_root, data_handler)
        
        # Tennis-specific data
        self.awards_data = []
        self.stats_data = []
        self.tournaments_data = {}
        self.initials_map = None
        
        # Tennis-specific mappings
        self.surface_types = {
            'Hard': 'Hard Court',
            'Clay': 'Clay Court', 
            'Grass': 'Grass Court',
            'Carpet': 'Carpet Court'
        }
        
        self.tournament_levels = {
            'G': 'Grand Slam',
            'M': 'Masters 1000',
            'A': 'ATP Tour',
            'F': 'ATP Finals'
        }
        
        self.grand_slams = {
            'Australian Open': {'surface': 'Hard', 'month': 'January'},
            'French Open': {'surface': 'Clay', 'month': 'June'},
            'Wimbledon': {'surface': 'Grass', 'month': 'July'},
            'US Open': {'surface': 'Hard', 'month': 'September'}
        }
    
    def initialize(self) -> bool:
        """
        Initialize tennis-specific data.
        
        Returns:
            True if initialization successful, False otherwise
        """
        try:
            # Try to use data handler first if available
            if self.data_handler and hasattr(self.data_handler, 'get_tennis_data'):
                # Use data handler for tennis data (PostgreSQL case)
                try:
                    tennis_data = self.data_handler.get_tennis_data()
                    self.awards_data = tennis_data.get('awards', [])
                    self.stats_data = tennis_data.get('stats', [])
                    self.tournaments_data = tennis_data.get('tournaments', {})
                except Exception as e:
                    print(f"Warning: Failed to load tennis data from data handler: {e}")
                    # Fall back to direct file loading
                    self._load_tennis_files()
            else:
                # Fall back to direct file loading (JSON case or no data handler)
                self._load_tennis_files()
            
            # Load tennis survival initials map
            initials_file = self.data_root / "survival_initials_map_tennis.json" if self.data_root else Path("survival_initials_map_tennis.json")
            if initials_file.exists():
                with open(initials_file, 'r', encoding='utf-8') as f:
                    self.initials_map = json.load(f)
            
            self._initialized = True
            return True
            
        except Exception as e:
            print(f"Error initializing tennis manager: {e}")
            return False
    
    def _load_tennis_files(self):
        """
        Load tennis data directly from JSON files.
        Used as fallback when data handler doesn't support tennis data.
        """
        # Load tennis processed data
        processed_dir = self.data_root / "processed_tennis" if self.data_root else Path("processed_tennis")
        
        # Load awards data
        awards_file = processed_dir / "tennis_awards.json"
        if awards_file.exists():
            with open(awards_file, 'r', encoding='utf-8') as f:
                self.awards_data = json.load(f)
        
        # Load statistics data
        stats_file = processed_dir / "tennis_stats.json"
        if stats_file.exists():
            with open(stats_file, 'r', encoding='utf-8') as f:
                self.stats_data = json.load(f)
        
        # Load tournaments data
        tournaments_file = processed_dir / "tennis_tournaments.json"
        if tournaments_file.exists():
            with open(tournaments_file, 'r', encoding='utf-8') as f:
                self.tournaments_data = json.load(f)
    
    def get_available_competitions(self) -> List[Dict[str, Any]]:
        """
        Get available tennis competitions.
        
        Returns:
            List of competition metadata
        """
        if not self._initialized:
            return []
        
        competitions = []
        
        # Add Grand Slam competitions
        if self.awards_data:
            grand_slam_records = [record for record in self.awards_data if 'Grand Slam' in record.get('Tournament_level', '')]
            if grand_slam_records:
                competitions.append({
                    'competition_id': 'tennis_grand_slams',
                    'competition_name': 'Grand Slam Champions',
                    'data_type': 'award',
                    'total_records': len(grand_slam_records),
                    'sport': 'tennis'
                })
        
        # Add Masters competitions
        if self.awards_data:
            masters_records = [record for record in self.awards_data if 'Masters' in record.get('Tournament_level', '')]
            if masters_records:
                competitions.append({
                    'competition_id': 'tennis_masters',
                    'competition_name': 'Masters 1000 Champions',
                    'data_type': 'award',
                    'total_records': len(masters_records),
                    'sport': 'tennis'
                })
        
        # Add player statistics
        if self.stats_data:
            competitions.append({
                'competition_id': 'tennis_career_stats',
                'competition_name': 'ATP Career Statistics',
                'data_type': 'stats',
                'total_records': len(self.stats_data),
                'sport': 'tennis'
            })
        
        return competitions
    
    def get_quiz_data(self, competition_id: str) -> Optional[Dict[str, Any]]:
        """
        Get tennis quiz data for a competition.
        
        Args:
            competition_id: Competition identifier
            
        Returns:
            Competition data or None if not found
        """
        if not self._initialized:
            return None
        
        if competition_id == 'tennis_grand_slams':
            grand_slam_records = [record for record in self.awards_data if 'Grand Slam' in record.get('Tournament_level', '')]
            return {
                'type': 'award',
                'data': grand_slam_records,
                'competition_id': competition_id
            }
        
        elif competition_id == 'tennis_masters':
            masters_records = [record for record in self.awards_data if 'Masters' in record.get('Tournament_level', '')]
            return {
                'type': 'award',
                'data': masters_records,
                'competition_id': competition_id
            }
        
        elif competition_id == 'tennis_career_stats':
            return {
                'type': 'stats',
                'data': self.stats_data,
                'competition_id': competition_id
            }
        
        return None
    
    def get_survival_data(self) -> Dict[str, Any]:
        """
        Get tennis survival mode data.
        
        Returns:
            Dictionary containing survival data
        """
        if not self._initialized or not self.initials_map:
            return {'initials_map': {}, 'total_players': 0}
        
        return self.initials_map
    
    def validate_survival_answer(self, answer: str, initials: str, 
                                max_mistakes: int = 2) -> Tuple[bool, Optional[str]]:
        """
        Validate tennis survival answer.
        
        Args:
            answer: Player answer
            initials: Target initials
            max_mistakes: Maximum allowed spelling mistakes
            
        Returns:
            Tuple of (is_valid, matched_player_name)
        """
        if not self._initialized or not self.initials_map or 'initials_map' not in self.initials_map:
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
        Get tennis-specific question templates.
        
        Returns:
            List of question template definitions
        """
        return [
            {
                'type': 'tournament_champion',
                'description': 'Questions about tournament champions',
                'example': 'Who won Wimbledon in 2023?'
            },
            {
                'type': 'grand_slam_count',
                'description': 'Questions about Grand Slam titles',
                'example': 'How many Grand Slam titles does Rafael Nadal have?'
            },
            {
                'type': 'surface_specialist',
                'description': 'Questions about surface expertise',
                'example': 'On which surface has Novak Djokovic won the most titles?'
            },
            {
                'type': 'head_to_head',
                'description': 'Questions about player rivalries',
                'example': 'Who leads the Federer-Nadal head-to-head record?'
            },
            {
                'type': 'career_achievements',
                'description': 'Questions about career milestones',
                'example': 'Who was the youngest player to reach #1 in ATP rankings?'
            },
            {
                'type': 'nationality',
                'description': 'Questions about player nationalities',
                'example': 'What nationality is Carlos Alcaraz?'
            },
            {
                'type': 'ranking_achievements',
                'description': 'Questions about ATP rankings',
                'example': 'Who finished as year-end #1 in 2022?'
            }
        ]
    
    def generate_questions(self, competition_id: str, question_type: str, 
                          num_questions: int = 10) -> List[Dict[str, Any]]:
        """
        Generate tennis-specific questions.
        
        Args:
            competition_id: Competition to generate from
            question_type: Type of questions to generate
            num_questions: Number of questions
            
        Returns:
            List of generated questions
        """
        if not self._initialized:
            return []
        
        questions = []
        data = self.get_quiz_data(competition_id)
        
        if not data:
            return []
        
        # Generate questions based on type and available data
        if question_type == 'tournament_champion' and data['type'] == 'award':
            questions.extend(self._generate_tournament_champion_questions(data['data'], num_questions))
        
        elif question_type == 'grand_slam_count' and data['type'] == 'stats':
            questions.extend(self._generate_grand_slam_count_questions(data['data'], num_questions))
        
        elif question_type == 'surface_specialist' and data['type'] == 'stats':
            questions.extend(self._generate_surface_questions(data['data'], num_questions))
        
        elif question_type == 'nationality' and data['type'] == 'award':
            questions.extend(self._generate_nationality_questions(data['data'], num_questions))
        
        return questions[:num_questions]
    
    def _generate_tournament_champion_questions(self, award_data: List[Dict], num_questions: int) -> List[Dict[str, Any]]:
        """Generate tournament champion questions."""
        questions = []
        
        for _ in range(min(num_questions, len(award_data))):
            record = random.choice(award_data)
            
            # Extract tournament name from award
            award_name = record.get('Award', '')
            if 'Champion' in award_name:
                tournament = award_name.replace(' Champion', '')
            else:
                continue
            
            question_text = f"Who won the {tournament} in {record['Season']}?"
            correct_answer = record['Player']
            
            # Generate distractors from other champions
            distractors = [
                other['Player'] for other in award_data 
                if other['Player'] != correct_answer and other.get('Season') == record['Season']
            ]
            
            if len(distractors) >= 2:
                questions.append({
                    'type': 'tournament_champion',
                    'question': question_text,
                    'answer': correct_answer,
                    'options': [correct_answer] + random.sample(distractors, min(3, len(distractors))),
                    'difficulty_score': 0.6,
                    'category': 'tennis_tournament'
                })
        
        return questions
    
    def _generate_grand_slam_count_questions(self, stats_data: List[Dict], num_questions: int) -> List[Dict[str, Any]]:
        """Generate Grand Slam count questions."""
        questions = []
        
        # Find players with Grand Slam titles
        gs_players = [player for player in stats_data if player.get('grand_slam_titles', 0) > 0]
        
        for _ in range(min(num_questions, len(gs_players))):
            player = random.choice(gs_players)
            
            question_text = f"How many Grand Slam titles does {player['player_name']} have?"
            correct_answer = str(player['grand_slam_titles'])
            
            # Generate plausible distractors
            distractors = []
            base_count = player['grand_slam_titles']
            for offset in [-2, -1, 1, 2]:
                if base_count + offset >= 0:
                    distractors.append(str(base_count + offset))
            
            if len(distractors) >= 2:
                questions.append({
                    'type': 'grand_slam_count',
                    'question': question_text,
                    'answer': correct_answer,
                    'options': [correct_answer] + distractors[:3],
                    'difficulty_score': 0.7,
                    'category': 'tennis_statistics'
                })
        
        return questions
    
    def _generate_surface_questions(self, stats_data: List[Dict], num_questions: int) -> List[Dict[str, Any]]:
        """Generate surface specialist questions."""
        questions = []
        
        for _ in range(min(num_questions, len(stats_data))):
            player = random.choice(stats_data)
            
            if 'best_surface' in player:
                question_text = f"On which surface has {player['player_name']} been most successful?"
                correct_answer = self.surface_types.get(player['best_surface'], player['best_surface'])
                
                # Other surfaces as distractors
                distractors = [surface for surface in self.surface_types.values() if surface != correct_answer]
                
                if len(distractors) >= 2:
                    questions.append({
                        'type': 'surface_specialist',
                        'question': question_text,
                        'answer': correct_answer,
                        'options': [correct_answer] + distractors[:3],
                        'difficulty_score': 0.5,
                        'category': 'tennis_surface'
                    })
        
        return questions
    
    def _generate_nationality_questions(self, award_data: List[Dict], num_questions: int) -> List[Dict[str, Any]]:
        """Generate nationality questions."""
        questions = []
        
        # Get unique players with nationality info
        players_with_nations = {record['Player']: record['Nation'] for record in award_data if record.get('Nation')}
        
        for _ in range(min(num_questions, len(players_with_nations))):
            player, nation = random.choice(list(players_with_nations.items()))
            
            question_text = f"What nationality is {player}?"
            correct_answer = self._get_country_name(nation)
            
            # Other nationalities as distractors
            other_nations = set(players_with_nations.values()) - {nation}
            distractors = [self._get_country_name(n) for n in random.sample(list(other_nations), min(3, len(other_nations)))]
            
            if len(distractors) >= 2:
                questions.append({
                    'type': 'nationality',
                    'question': question_text,
                    'answer': correct_answer,
                    'options': [correct_answer] + distractors,
                    'difficulty_score': 0.4,
                    'category': 'tennis_nationality'
                })
        
        return questions
    
    def get_player_suggestions(self, partial_name: str, limit: int = 10) -> List[str]:
        """
        Get tennis player name suggestions.
        
        Args:
            partial_name: Partial player name
            limit: Maximum suggestions
            
        Returns:
            List of suggested player names
        """
        if not self._initialized:
            return []
        
        all_players = set()
        
        # Collect players from all data sources
        if self.awards_data:
            all_players.update(record['Player'] for record in self.awards_data if record.get('Player'))
        
        if self.stats_data:
            all_players.update(record['player_name'] for record in self.stats_data if record.get('player_name'))
        
        if self.initials_map and 'initials_map' in self.initials_map:
            for players_list in self.initials_map['initials_map'].values():
                all_players.update(players_list)
        
        # Filter by partial name
        partial_lower = partial_name.lower()
        suggestions = [
            player for player in all_players
            if partial_lower in player.lower()
        ]
        
        # Sort by relevance
        suggestions.sort(key=lambda x: (
            not x.lower().startswith(partial_lower),
            len(x),
            x.lower()
        ))
        
        return suggestions[:limit]
    
    def get_sport_icon(self) -> str:
        """Get tennis emoji icon."""
        return "🎾"
    
    def get_theme_colors(self) -> Dict[str, str]:
        """Get tennis theme colors."""
        return {
            'primary': '#2d5a87',      # Court blue
            'secondary': '#e67e22',    # Clay orange
            'accent': '#27ae60',       # Grass green
            'background': '#1a252f',   # Dark court
            'text': '#ffffff'
        }
    
    def get_terminology(self) -> Dict[str, str]:
        """Get tennis-specific terminology."""
        return {
            'athlete': 'player',
            'athletes': 'players',
            'team': 'player',  # Tennis is individual
            'teams': 'players',
            'match': 'match',
            'matches': 'matches',
            'competition': 'tournament',
            'competitions': 'tournaments',
            'championship': 'title',
            'championships': 'titles'
        }
    
    def _get_country_name(self, country_code: str) -> str:
        """Convert country code to full name."""
        # Common tennis country codes
        country_mapping = {
            'SUI': 'Switzerland',
            'ESP': 'Spain', 
            'SRB': 'Serbia',
            'RUS': 'Russia',
            'GER': 'Germany',
            'AUT': 'Austria',
            'FRA': 'France',
            'GBR': 'Great Britain',
            'USA': 'United States',
            'ARG': 'Argentina',
            'BRA': 'Brazil',
            'CAN': 'Canada',
            'AUS': 'Australia',
            'JPN': 'Japan',
            'ITA': 'Italy',
            'BEL': 'Belgium',
            'NED': 'Netherlands',
            'POL': 'Poland',
            'CRO': 'Croatia',
            'CZE': 'Czech Republic'
        }
        
        return country_mapping.get(country_code, country_code)