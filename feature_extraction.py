import numpy as np
from typing import Dict, Any, List
import re
from datetime import datetime


class FeatureExtractor:
    """
    Extracts features from quiz questions for difficulty prediction.
    """
    
    def __init__(self):
        self.current_year = datetime.now().year
        
        # Define feature extraction parameters
        self.stat_keywords = {
            'goals', 'assists', 'appearances', 'clean_sheets', 
            'yellow_cards', 'red_cards', 'pass_accuracy', 
            'shots_on_target', 'defensive_actions', 'expected_goals',
            'progressive_passes', 'key_passes'
        }
        
        self.complexity_indicators = {
            'compare', 'between', 'highest', 'lowest', 'total',
            'average', 'percentage', 'ratio', 'combined'
        }
    
    def extract_features(self, question: Dict[str, Any]) -> np.ndarray:
        """
        Extracts features from a single question.
        
        Args:
            question: Dictionary containing question data
            
        Returns:
            np.ndarray: Feature vector
        """
        features = []
        
        # 1. Player popularity/obscurity (0-1, higher = more obscure)
        player_obscurity = 1 - question.get('player_popularity', 0.5)
        features.append(player_obscurity)
        
        # 2. Time period distance (0-1, higher = older)
        year = question.get('year', self.current_year)
        time_distance = min((self.current_year - year) / 50, 1.0)
        features.append(time_distance)
        
        # 3. Statistical complexity (0-1, higher = more complex)
        stats_complexity = question.get('stats_complexity', 0.5)
        features.append(stats_complexity)
        
        # 4. Answer ambiguity (0-1, higher = more ambiguous)
        answer_ambiguity = question.get('ambiguity', 0.3)
        features.append(answer_ambiguity)
        
        # 5. Historical significance (0-1, higher = more significant)
        historical_significance = question.get('significance', 0.5)
        features.append(historical_significance)
        
        # 6. Question text length (normalized)
        question_text = question.get('question_text', '')
        text_length = min(len(question_text.split()) / 50, 1.0)
        features.append(text_length)
        
        # 7. Number of statistical terms mentioned
        stat_count = 0
        if question_text:
            text_lower = question_text.lower()
            stat_count = sum(1 for stat in self.stat_keywords if stat in text_lower)
        stat_density = min(stat_count / 5, 1.0)
        features.append(stat_density)
        
        # 8. Complexity indicators in question
        complexity_count = 0
        if question_text:
            text_lower = question_text.lower()
            complexity_count = sum(1 for indicator in self.complexity_indicators 
                                 if indicator in text_lower)
        complexity_score = min(complexity_count / 3, 1.0)
        features.append(complexity_score)
        
        # 9. Category difficulty (if available)
        category = question.get('category', '')
        category_difficulty = self._get_category_difficulty(category)
        features.append(category_difficulty)
        
        # 10. Answer format complexity
        answer_format = question.get('answer_format', 'simple')
        format_complexity = self._get_format_complexity(answer_format)
        features.append(format_complexity)
        
        return np.array(features, dtype=np.float32)
    
    def extract_features_batch(self, questions: List[Dict[str, Any]]) -> np.ndarray:
        """
        Extracts features from a batch of questions.
        
        Args:
            questions: List of question dictionaries
            
        Returns:
            np.ndarray: Feature matrix (n_samples, n_features)
        """
        feature_matrix = []
        for question in questions:
            features = self.extract_features(question)
            feature_matrix.append(features)
        
        return np.array(feature_matrix, dtype=np.float32)
    
    def _get_category_difficulty(self, category: str) -> float:
        """
        Returns difficulty score based on category.
        """
        category_scores = {
            'statistics': 0.7,
            'historical': 0.6,
            'records': 0.5,
            'general': 0.4,
            'current': 0.3,
            'trivia': 0.4
        }
        
        category_lower = category.lower()
        for cat, score in category_scores.items():
            if cat in category_lower:
                return score
        return 0.5  # Default
    
    def _get_format_complexity(self, answer_format: str) -> float:
        """
        Returns complexity score based on answer format.
        """
        format_scores = {
            'multiple_choice': 0.3,
            'true_false': 0.2,
            'numeric': 0.5,
            'open_ended': 0.8,
            'ranking': 0.7,
            'matching': 0.6
        }
        
        format_lower = answer_format.lower()
        return format_scores.get(format_lower, 0.5)
    
    def get_feature_names(self) -> List[str]:
        """
        Returns the names of all features for interpretability.
        """
        return [
            'player_obscurity',
            'time_period_distance',
            'statistical_complexity',
            'answer_ambiguity',
            'historical_significance',
            'question_text_length',
            'statistical_term_density',
            'complexity_indicators',
            'category_difficulty',
            'answer_format_complexity'
        ]