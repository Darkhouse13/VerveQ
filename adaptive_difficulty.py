import json
import time
from datetime import datetime
from user_performance_tracker import UserPerformanceTracker
from difficulty_prediction_model import DifficultyPredictor
from feature_extraction import FeatureExtractor

class AdaptiveDifficulty:
    def __init__(self, user_tracker: UserPerformanceTracker, config_path='difficulty_config.json',
                 model_path='difficulty_model.joblib'):
        self.user_tracker = user_tracker
        self.config = self._load_config(config_path)
        self.weights = self.config['weights']
        self.feature_extractor = FeatureExtractor()
        self.difficulty_predictor = DifficultyPredictor(feature_extractor=self.feature_extractor)
        try:
            self.difficulty_predictor.load_model(model_path)
            print(f"ML difficulty model loaded from {model_path}")
            self.ml_model_enabled = True
        except Exception as e:
            print(f"Could not load ML difficulty model from {model_path}: {e}. Falling back to rule-based system.")
            self.ml_model_enabled = False

    def _load_config(self, path):
        with open(path, 'r') as f:
            return json.load(f)

    def get_difficulty_factors(self, question_data):
        """
        Calculates the raw difficulty factors for a given question.
        Each factor is normalized to a value between 0 and 1.
        """
        # These are placeholder calculations.
        # In a real implementation, these would involve more complex logic,
        # potentially using data from a database or external APIs.
        
        # Player Obscurity: Assumes a 'popularity' score is available for the player.
        player_obscurity = 1 - question_data.get('player_popularity', 0.8)

        # Time Period Distance: Based on the year of the event.
        current_year = datetime.now().year
        event_year = question_data.get('year', current_year)
        time_distance = (current_year - event_year) / 50  # Normalize over a 50-year span
        time_period_distance = min(time_distance, 1.0)

        # Statistical Complexity: Based on the number of stats involved or their complexity.
        statistical_complexity = question_data.get('stats_complexity', 0.5)

        # Answer Ambiguity: How clear is the correct answer.
        answer_ambiguity = question_data.get('ambiguity', 0.2)

        # Historical Significance: Importance of the event/record.
        historical_significance = question_data.get('significance', 0.5)

        # User Familiarity: From the user performance tracker.
        user_familiarity = self.user_tracker.get_familiarity(question_data.get('category'))

        return {
            "player_obscurity": player_obscurity,
            "time_period_distance": time_period_distance,
            "statistical_complexity": statistical_complexity,
            "answer_ambiguity": answer_ambiguity,
            "historical_significance": historical_significance,
            "user_familiarity": user_familiarity
        }

    def calculate_question_difficulty(self, question_data):
        """
        Calculates the base difficulty of a question using either the ML model
        or the rule-based system, before user-specific adjustments.
        """
        if self.ml_model_enabled:
            try:
                # Prepare question_data for feature extraction
                # This assumes question_data directly contains the necessary keys
                # or can be mapped to the expected format by FeatureExtractor.
                # The FeatureExtractor expects keys like 'question_text', 'player_info', etc.
                # We need to ensure 'question_data' passed here matches that expectation.
                # For now, we'll assume question_data is already in the correct format.
                features = self.feature_extractor.extract_features(question_data).reshape(1, -1)
                predicted_difficulty = self.difficulty_predictor.predict_difficulty(features)[0]
                # Ensure difficulty is within a reasonable range, e.g., 0 to 1 or 1 to 5
                # Assuming the model predicts a score between 1 and 5, normalize to 0-1 if needed
                # For now, let's assume it predicts a value that can be directly used or scaled.
                # If model predicts 1-5, scale to 0-1: (predicted_difficulty - 1) / 4
                # Let's assume the model predicts a value that is already normalized or can be used as is.
                # For now, we'll just return the raw prediction, assuming it's in a 0-1 range or can be handled.
                # If the model predicts 1-5, we need to normalize it to 0-1 for consistency with existing code.
                # Let's assume the model predicts a value between 0 and 1 for now.
                base_difficulty = predicted_difficulty
                print(f"ML Model predicted difficulty: {base_difficulty:.4f}")
            except Exception as e:
                print(f"Error predicting difficulty with ML model: {e}. Falling back to rule-based system.")
                self.ml_model_enabled = False # Disable ML model if it fails
                # Fallback to rule-based system
                factors = self.get_difficulty_factors(question_data)
                base_difficulty = (
                    factors['player_obscurity'] * self.weights['player_obscurity'] +
                    factors['time_period_distance'] * self.weights['time_period_distance'] +
                    factors['statistical_complexity'] * self.weights['statistical_complexity'] +
                    factors['answer_ambiguity'] * self.weights['answer_ambiguity'] +
                    factors['historical_significance'] * self.weights['historical_significance']
                )
        else:
            # Existing rule-based system
            factors = self.get_difficulty_factors(question_data)
            base_difficulty = (
                factors['player_obscurity'] * self.weights['player_obscurity'] +
                factors['time_period_distance'] * self.weights['time_period_distance'] +
                factors['statistical_complexity'] * self.weights['statistical_complexity'] +
                factors['answer_ambiguity'] * self.weights['answer_ambiguity'] +
                factors['historical_significance'] * self.weights['historical_significance']
            )
        
        return min(max(base_difficulty, 0), 1)

    def adjust_difficulty_for_user(self, base_difficulty, question_data):
        """
        Adjusts the question difficulty based on user's familiarity and recent performance.
        """
        familiarity = self.user_tracker.get_familiarity(question_data.get('category'))
        
        # Adjust for familiarity: if user is familiar, reduce difficulty.
        adjusted_difficulty = base_difficulty * (1 - (familiarity * self.weights['user_familiarity']))
        
        return min(max(adjusted_difficulty, 0), 1)

    def suggest_next_difficulty(self):
        """
        Suggests a target difficulty for the next question based on recent performance.
        """
        recent_perf = self.user_tracker.get_recent_performance()
        
        # Simple proportional adjustment: if performance is high, increase difficulty target.
        # A more sophisticated approach could use a PID controller or similar logic.
        current_avg_difficulty = self._get_average_difficulty_of_recent_questions()

        # Move towards a target success rate (e.g., 75%)
        target_success_rate = 0.75
        adjustment = (recent_perf - target_success_rate) * self.config.get('adaptation_factor', 0.1)
        
        suggested_difficulty = current_avg_difficulty + adjustment
        
        return min(max(suggested_difficulty, 0.1), 0.9) # Keep within a reasonable range

    def _get_average_difficulty_of_recent_questions(self, last_n=10):
        recent_history = self.user_tracker.performance_data["history"][-last_n:]
        if not recent_history:
            return 0.5 # Default starting difficulty
        
        total_difficulty = sum(item['difficulty_score'] for item in recent_history)
        return total_difficulty / len(recent_history)

    def track_user_performance(self, question_id, category, difficulty_score, is_correct):
        """Wrapper to track user response."""
        self.user_tracker.track_response(question_id, category, difficulty_score, is_correct)

    def get_difficulty_level_name(self, score):
        for level, bounds in self.config['levels'].items():
            if bounds['min'] <= score < bounds['max']:
                return level
        if score >= self.config['levels']['advanced']['max']:
             return "advanced"
        return "beginner"
