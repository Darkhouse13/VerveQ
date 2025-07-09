"""
Enhanced Difficulty Calculator
Provides content-based difficulty scoring for quiz questions
"""

import re
import json
from typing import Dict, List, Any, Optional
from datetime import datetime
from pathlib import Path

class EnhancedDifficultyCalculator:
    """
    Calculates question difficulty based on actual content analysis
    rather than just question type categorization.
    """
    
    def __init__(self, data_handler=None):
        self.data_handler = data_handler
        self.current_year = datetime.now().year
        
        # Load player popularity data (if available)
        self.player_popularity = self._load_player_popularity()
        
        # Define era difficulty multipliers
        self.era_difficulty = {
            'modern': (2015, self.current_year, 0.1),    # Very recent
            'recent': (2005, 2014, 0.3),                 # Recent memory
            'golden': (1990, 2004, 0.5),                 # Golden era
            'classic': (1970, 1989, 0.7),                # Classic era
            'vintage': (1950, 1969, 0.9),                # Vintage era
            'ancient': (1900, 1949, 1.0)                 # Ancient era
        }
        
        # Statistical complexity ratings
        self.stat_complexity = {
            'goals': 0.2, 'assists': 0.3, 'appearances': 0.3,
            'clean_sheets': 0.4, 'yellow_cards': 0.5, 'red_cards': 0.5,
            'pass_accuracy': 0.6, 'shots_on_target': 0.6,
            'defensive_actions': 0.7, 'expected_goals': 0.8,
            'progressive_passes': 0.9, 'key_passes_per_game': 0.9
        }
        
    def _load_player_popularity(self) -> Dict[str, float]:
        """Load player popularity scores from various sources"""
        popularity = {}
        
        # High popularity players (well-known globally)
        famous_players = [
            'Lionel Messi', 'Cristiano Ronaldo', 'Neymar', 'Kylian Mbappé',
            'Erling Haaland', 'Kevin De Bruyne', 'Mohamed Salah', 'Virgil van Dijk',
            'Karim Benzema', 'Luka Modrić', 'Robert Lewandowski', 'Sadio Mané',
            'Pelé', 'Diego Maradona', 'Johan Cruyff', 'Zinedine Zidane',
            'Ronaldinho', 'Kaká', 'Thierry Henry', 'David Beckham'
        ]
        
        # Medium popularity players
        medium_players = [
            'Sergio Ramos', 'Gerard Piqué', 'Toni Kroos', 'Casemiro',
            'N\'Golo Kanté', 'Paul Pogba', 'Antoine Griezmann', 'Luis Suárez',
            'Eden Hazard', 'Harry Kane', 'Son Heung-min', 'Raheem Sterling'
        ]
        
        # Assign popularity scores
        for player in famous_players:
            popularity[player] = 0.9  # High popularity (low difficulty multiplier)
        
        for player in medium_players:
            popularity[player] = 0.6  # Medium popularity
            
        return popularity
    
    def calculate_content_difficulty(self, question_data: Dict[str, Any]) -> float:
        """
        Calculate difficulty based on question content analysis
        Returns a score from 0.0 (easiest) to 1.0 (hardest)
        """
        factors = {}
        
        # Extract key information from question
        player_name = self._extract_player_name(question_data)
        time_period = self._extract_time_period(question_data)
        stat_type = self._extract_statistic_type(question_data)
        question_text = question_data.get('question', '')
        options = question_data.get('options', [])
        
        # Calculate individual difficulty factors
        factors['player_obscurity'] = self._calculate_player_obscurity(player_name)
        factors['time_period_difficulty'] = self._calculate_time_period_difficulty(time_period)
        factors['stat_complexity'] = self._calculate_stat_complexity(stat_type)
        factors['answer_ambiguity'] = self._calculate_answer_ambiguity(options, question_text)
        factors['domain_specificity'] = self._calculate_domain_specificity(question_text)
        
        # Weighted combination of factors
        weights = {
            'player_obscurity': 0.30,      # Most important factor
            'time_period_difficulty': 0.25, # When it happened
            'stat_complexity': 0.20,        # How complex the statistic is
            'answer_ambiguity': 0.15,       # How obvious the answer is
            'domain_specificity': 0.10     # How niche the knowledge is
        }
        
        difficulty_score = sum(
            factors[factor] * weight 
            for factor, weight in weights.items()
        )
        
        # Ensure score is between 0 and 1
        return max(0.0, min(1.0, difficulty_score))
    
    def _extract_player_name(self, question_data: Dict[str, Any]) -> Optional[str]:
        """Extract player name from question data"""
        # Check different possible fields
        for field in ['answer', 'correct_answer', 'player', 'Player']:
            if field in question_data:
                return question_data[field]
        
        # Try to extract from question text
        question_text = question_data.get('question', '')
        if question_text:
            # Look for common patterns like "Which player..." or mentions of specific names
            pass  # Could implement NLP-based name extraction here
            
        return None
    
    def _extract_time_period(self, question_data: Dict[str, Any]) -> Optional[int]:
        """Extract year/season from question data"""
        # Check for season or year fields
        for field in ['season', 'Season', 'year', 'Year']:
            if field in question_data:
                value = question_data[field]
                if isinstance(value, str):
                    # Extract year from season format like "2020-2021"
                    year_match = re.search(r'\b(19|20)\d{2}\b', value)
                    if year_match:
                        return int(year_match.group())
                elif isinstance(value, int):
                    return value
        
        # Try to extract from question text
        question_text = question_data.get('question', '')
        year_match = re.search(r'\b(19|20)\d{2}\b', question_text)
        if year_match:
            return int(year_match.group())
            
        return None
    
    def _extract_statistic_type(self, question_data: Dict[str, Any]) -> Optional[str]:
        """Extract type of statistic from question"""
        question_text = question_data.get('question', '').lower()
        
        # Map keywords to stat types
        stat_keywords = {
            'goals': ['goal', 'scored', 'top scorer'],
            'assists': ['assist', 'provided'],
            'appearances': ['appearance', 'match', 'game'],
            'clean_sheets': ['clean sheet', 'shutout'],
            'cards': ['yellow card', 'red card', 'booking'],
            'pass_accuracy': ['pass accuracy', 'passing'],
            'shots': ['shot', 'shooting'],
            'saves': ['save', 'goalkeeper'],
        }
        
        for stat_type, keywords in stat_keywords.items():
            if any(keyword in question_text for keyword in keywords):
                return stat_type
                
        return 'general'
    
    def _calculate_player_obscurity(self, player_name: Optional[str]) -> float:
        """Calculate difficulty based on player popularity/obscurity"""
        if not player_name:
            return 0.5  # Default medium difficulty
        
        # Check if player is in our popularity database
        popularity = self.player_popularity.get(player_name, 0.3)  # Default low popularity
        
        # Convert popularity to difficulty (inverse relationship)
        return 1.0 - popularity
    
    def _calculate_time_period_difficulty(self, year: Optional[int]) -> float:
        """Calculate difficulty based on how far back in time"""
        if not year:
            return 0.5  # Default medium difficulty
        
        # Find which era the year belongs to
        for era_name, (start_year, end_year, difficulty) in self.era_difficulty.items():
            if start_year <= year <= end_year:
                return difficulty
        
        # If year is before our defined eras, it's very difficult
        return 1.0
    
    def _calculate_stat_complexity(self, stat_type: Optional[str]) -> float:
        """Calculate difficulty based on statistic complexity"""
        if not stat_type:
            return 0.4  # Default medium-low difficulty
        
        return self.stat_complexity.get(stat_type, 0.5)
    
    def _calculate_answer_ambiguity(self, options: List[str], question_text: str) -> float:
        """Calculate how ambiguous/obvious the answer is"""
        if not options or len(options) < 2:
            return 0.5  # Default if no options
        
        # More options generally means more difficulty
        option_difficulty = min(0.3, len(options) * 0.05)
        
        # Check if options are similar (more difficult)
        similarity_bonus = 0.0
        if len(options) >= 3:
            # Simple similarity check based on string length similarity
            avg_length = sum(len(opt) for opt in options) / len(options)
            length_variance = sum(abs(len(opt) - avg_length) for opt in options) / len(options)
            
            if length_variance < 3:  # Similar length options
                similarity_bonus = 0.2
        
        return option_difficulty + similarity_bonus
    
    def _calculate_domain_specificity(self, question_text: str) -> float:
        """Calculate how niche/specific the football knowledge required is"""
        question_lower = question_text.lower()
        
        # Technical football terms increase difficulty
        technical_terms = [
            'offside', 'var', 'penalty shootout', 'extra time',
            'aggregate', 'away goals', 'fair play', 'golden boot',
            'ballon d\'or', 'fifa', 'uefa', 'champions league',
            'europa league', 'premier league', 'la liga',
            'serie a', 'bundesliga', 'ligue 1'
        ]
        
        niche_terms = [
            'coefficient', 'seeding', 'qualifying round',
            'playoff', 'relegation', 'promotion', 'transfer window',
            'loan deal', 'free agent', 'buyout clause'
        ]
        
        technical_count = sum(1 for term in technical_terms if term in question_lower)
        niche_count = sum(1 for term in niche_terms if term in question_lower)
        
        # Base difficulty from technical terms
        difficulty = technical_count * 0.1 + niche_count * 0.2
        
        return min(1.0, difficulty)
    
    def categorize_difficulty(self, difficulty_score: float) -> str:
        """Convert numerical difficulty score to category"""
        if difficulty_score < 0.35:
            return 'casual'
        elif difficulty_score > 0.65:
            return 'diehard'
        else:
            return 'medium'
    
    def get_difficulty_explanation(self, question_data: Dict[str, Any]) -> Dict[str, Any]:
        """Provide detailed explanation of why a question has its difficulty rating"""
        player_name = self._extract_player_name(question_data)
        time_period = self._extract_time_period(question_data)
        difficulty_score = self.calculate_content_difficulty(question_data)
        category = self.categorize_difficulty(difficulty_score)
        
        explanation = {
            'overall_score': difficulty_score,
            'category': category,
            'factors': {
                'player': {
                    'name': player_name,
                    'popularity': self.player_popularity.get(player_name, 0.3),
                    'contribution': 'High' if player_name and self.player_popularity.get(player_name, 0.3) < 0.4 else 'Low'
                },
                'time_period': {
                    'year': time_period,
                    'era': self._get_era_name(time_period),
                    'contribution': 'High' if time_period and time_period < 1990 else 'Low'
                }
            },
            'recommendation': self._get_difficulty_recommendation(difficulty_score)
        }
        
        return explanation
    
    def _get_era_name(self, year: Optional[int]) -> str:
        """Get the era name for a given year"""
        if not year:
            return 'Unknown'
        
        for era_name, (start_year, end_year, _) in self.era_difficulty.items():
            if start_year <= year <= end_year:
                return era_name.title()
        
        return 'Ancient'
    
    def _get_difficulty_recommendation(self, score: float) -> str:
        """Get recommendation for difficulty adjustment"""
        if score < 0.2:
            return "Consider for casual mode - very accessible"
        elif score < 0.35:
            return "Good for casual mode"
        elif score < 0.65:
            return "Suitable for both modes or adaptive difficulty"
        elif score < 0.8:
            return "Good for diehard mode"
        else:
            return "Consider for diehard mode - very challenging"


if __name__ == "__main__":
    # Test the enhanced difficulty calculator
    calculator = EnhancedDifficultyCalculator()
    
    # Test cases
    test_questions = [
        {
            "question": "Who won the Ballon d'Or in 2023?",
            "answer": "Lionel Messi",
            "Season": "2023",
            "options": ["Lionel Messi", "Erling Haaland", "Kylian Mbappé", "Kevin De Bruyne"]
        },
        {
            "question": "Who won the first ever Ballon d'Or in 1956?",
            "answer": "Stanley Matthews",
            "Season": "1956",
            "options": ["Stanley Matthews", "Alfredo Di Stéfano", "Raymond Kopa", "Just Fontaine"]
        },
        {
            "question": "Which team did Cristiano Ronaldo play for when he won his first Ballon d'Or?",
            "answer": "Manchester United",
            "Season": "2008",
            "options": ["Manchester United", "Real Madrid", "Juventus", "Sporting CP"]
        }
    ]
    
    print("=== Enhanced Difficulty Calculator Test ===\n")
    
    for i, question in enumerate(test_questions, 1):
        print(f"Question {i}: {question['question']}")
        
        difficulty_score = calculator.calculate_content_difficulty(question)
        category = calculator.categorize_difficulty(difficulty_score)
        explanation = calculator.get_difficulty_explanation(question)
        
        print(f"Difficulty Score: {difficulty_score:.3f}")
        print(f"Category: {category}")
        print(f"Player: {explanation['factors']['player']['name']}")
        print(f"Era: {explanation['factors']['time_period']['era']}")
        print(f"Recommendation: {explanation['recommendation']}")
        print("-" * 50)