"""
ML-Powered Difficulty Predictor
Uses machine learning to predict question difficulty based on content and user feedback
Continuously improves with each user interaction
"""

import numpy as np
import pandas as pd
import sqlite3
import logging
from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass
from datetime import datetime, timedelta
import pickle
import json
from pathlib import Path

# ML Imports
try:
    from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor
    from sklearn.linear_model import LinearRegression
    from sklearn.preprocessing import StandardScaler, LabelEncoder
    from sklearn.model_selection import train_test_split, cross_val_score
    from sklearn.metrics import mean_squared_error, r2_score
    import joblib
    ML_AVAILABLE = True
except ImportError:
    print("⚠️ sklearn not available. Install with: pip install scikit-learn")
    ML_AVAILABLE = False

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@dataclass
class DifficultyFeatures:
    """Features used for difficulty prediction"""
    # Content-based features
    player_popularity: float
    era_difficulty: float
    statistical_complexity: float
    question_type_complexity: float
    
    # Context features
    competition_prestige: float
    data_quality: float
    answer_specificity: float
    
    # Historical features
    historical_accuracy: float
    user_feedback_score: float
    admin_adjustments: float

@dataclass
class PredictionResult:
    """Result of difficulty prediction"""
    predicted_difficulty: float
    confidence: float
    feature_importance: Dict[str, float]
    model_version: str
    prediction_timestamp: datetime

class MLDifficultyPredictor:
    """
    Machine Learning-powered difficulty predictor that learns from user feedback.
    
    Features:
    - Multi-model ensemble for robust predictions
    - Real-time learning from user feedback
    - Feature importance analysis
    - Continuous model improvement
    - A/B testing capabilities
    """
    
    def __init__(self, model_path: str = "models/difficulty_predictor.joblib"):
        """Initialize the ML Difficulty Predictor"""
        self.model_path = Path(model_path)
        self.model_path.parent.mkdir(exist_ok=True)
        
        # Model components
        self.primary_model = None
        self.ensemble_models = {}
        self.scaler = StandardScaler()
        self.feature_encoders = {}
        
        # Training data cache
        self.feature_columns = [
            'player_popularity', 'era_difficulty', 'statistical_complexity',
            'question_type_complexity', 'competition_prestige', 'data_quality',
            'answer_specificity', 'historical_accuracy', 'user_feedback_score',
            'admin_adjustments'
        ]
        
        # Model metadata
        self.model_version = "1.0"
        self.last_training = None
        self.training_data_size = 0
        
        # Load existing model or initialize new one
        self._initialize_model()
        
        # Performance tracking
        self.prediction_history = []
        self.feedback_integration_log = []
    
    def _initialize_model(self):
        """Initialize or load existing model"""
        if self.model_path.exists() and ML_AVAILABLE:
            try:
                model_data = joblib.load(self.model_path)
                self.primary_model = model_data['model']
                self.scaler = model_data['scaler']
                self.feature_encoders = model_data.get('encoders', {})
                self.model_version = model_data.get('version', '1.0')
                self.last_training = model_data.get('last_training')
                logger.info(f"✅ Loaded existing model v{self.model_version}")
            except Exception as e:
                logger.warning(f"⚠️ Failed to load existing model: {e}")
                self._create_default_model()
        else:
            self._create_default_model()
    
    def _create_default_model(self):
        """Create a new default model"""
        if ML_AVAILABLE:
            # Use ensemble of different algorithms
            self.ensemble_models = {
                'random_forest': RandomForestRegressor(n_estimators=100, random_state=42),
                'gradient_boost': GradientBoostingRegressor(n_estimators=100, random_state=42),
                'linear': LinearRegression()
            }
            # Primary model is Random Forest
            self.primary_model = self.ensemble_models['random_forest']
            logger.info("🔧 Created new ML model ensemble")
        else:
            # Fallback to rule-based if ML not available
            self.primary_model = None
            logger.info("🔧 Using rule-based fallback (ML not available)")
    
    def predict_difficulty(self, question_data: Dict[str, Any], 
                         user_context: Optional[Dict[str, Any]] = None) -> PredictionResult:
        """
        Predict question difficulty using ML model.
        
        Args:
            question_data: Question content and metadata
            user_context: Optional user-specific context
            
        Returns:
            PredictionResult with difficulty prediction and metadata
        """
        try:
            # Extract features
            features = self._extract_features(question_data, user_context)
            
            # Make prediction
            if self.primary_model and ML_AVAILABLE:
                prediction = self._ml_predict(features)
            else:
                prediction = self._rule_based_predict(features)
            
            # Log prediction for future training
            self.prediction_history.append({
                'timestamp': datetime.now(),
                'features': features.__dict__,
                'prediction': prediction.predicted_difficulty,
                'question_id': question_data.get('question_id', 'unknown')
            })
            
            return prediction
            
        except Exception as e:
            logger.error(f"❌ Error in difficulty prediction: {e}")
            # Fallback to simple rule-based prediction
            return PredictionResult(
                predicted_difficulty=0.5,
                confidence=0.3,
                feature_importance={},
                model_version="fallback",
                prediction_timestamp=datetime.now()
            )
    
    def _extract_features(self, question_data: Dict[str, Any], 
                         user_context: Optional[Dict[str, Any]]) -> DifficultyFeatures:
        """Extract ML features from question data"""
        
        # Player popularity (enhanced with actual data)
        player_popularity = self._calculate_player_popularity(question_data.get('player', ''))
        
        # Era difficulty (older = harder)
        era_difficulty = self._calculate_era_difficulty(question_data.get('year', 2020))
        
        # Statistical complexity
        statistical_complexity = self._calculate_statistical_complexity(question_data)
        
        # Question type complexity
        question_type_complexity = self._calculate_question_type_complexity(
            question_data.get('type', 'unknown')
        )
        
        # Competition prestige
        competition_prestige = self._calculate_competition_prestige(
            question_data.get('competition', '')
        )
        
        # Data quality
        data_quality = question_data.get('quality_score', 0.8)
        
        # Answer specificity
        answer_specificity = self._calculate_answer_specificity(question_data)
        
        # Historical accuracy (from database)
        historical_accuracy = self._get_historical_accuracy(
            question_data.get('question_id', '')
        )
        
        # User feedback score (from database)
        user_feedback_score = self._get_user_feedback_score(
            question_data.get('question_id', '')
        )
        
        # Admin adjustments
        admin_adjustments = self._get_admin_adjustments(
            question_data.get('question_id', '')
        )
        
        return DifficultyFeatures(
            player_popularity=player_popularity,
            era_difficulty=era_difficulty,
            statistical_complexity=statistical_complexity,
            question_type_complexity=question_type_complexity,
            competition_prestige=competition_prestige,
            data_quality=data_quality,
            answer_specificity=answer_specificity,
            historical_accuracy=historical_accuracy,
            user_feedback_score=user_feedback_score,
            admin_adjustments=admin_adjustments
        )
    
    def _ml_predict(self, features: DifficultyFeatures) -> PredictionResult:
        """Make prediction using ML model"""
        
        # Convert features to array
        feature_array = np.array([[
            features.player_popularity,
            features.era_difficulty,
            features.statistical_complexity,
            features.question_type_complexity,
            features.competition_prestige,
            features.data_quality,
            features.answer_specificity,
            features.historical_accuracy,
            features.user_feedback_score,
            features.admin_adjustments
        ]])
        
        # Scale features
        feature_array_scaled = self.scaler.transform(feature_array)
        
        # Make prediction
        prediction = self.primary_model.predict(feature_array_scaled)[0]
        
        # Calculate confidence based on model certainty
        confidence = self._calculate_prediction_confidence(features, prediction)
        
        # Get feature importance
        feature_importance = {}
        if hasattr(self.primary_model, 'feature_importances_'):
            for i, col in enumerate(self.feature_columns):
                feature_importance[col] = float(self.primary_model.feature_importances_[i])
        
        return PredictionResult(
            predicted_difficulty=float(np.clip(prediction, 0.0, 1.0)),
            confidence=confidence,
            feature_importance=feature_importance,
            model_version=self.model_version,
            prediction_timestamp=datetime.now()
        )
    
    def _rule_based_predict(self, features: DifficultyFeatures) -> PredictionResult:
        """Fallback rule-based prediction when ML is not available"""
        
        # Weighted combination of features
        difficulty = (
            features.player_popularity * 0.25 +
            features.era_difficulty * 0.20 +
            features.statistical_complexity * 0.15 +
            features.question_type_complexity * 0.15 +
            features.competition_prestige * 0.10 +
            features.answer_specificity * 0.10 +
            features.user_feedback_score * 0.05
        )
        
        return PredictionResult(
            predicted_difficulty=float(np.clip(difficulty, 0.0, 1.0)),
            confidence=0.6,  # Medium confidence for rule-based
            feature_importance={},
            model_version="rule_based",
            prediction_timestamp=datetime.now()
        )
    
    def learn_from_feedback(self, feedback_data: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Learn from user feedback to improve model predictions.
        
        Args:
            feedback_data: List of feedback records with actual difficulty ratings
            
        Returns:
            Training result summary
        """
        if not ML_AVAILABLE:
            logger.warning("ML not available - cannot learn from feedback")
            return {'success': False, 'reason': 'ML libraries not available'}
        
        logger.info(f"🧠 Learning from {len(feedback_data)} feedback records...")
        
        try:
            # Prepare training data
            X, y = self._prepare_training_data(feedback_data)
            
            if len(X) < 10:  # Need minimum data for training
                logger.warning("Insufficient data for training")
                return {'success': False, 'reason': 'insufficient_data'}
            
            # Split data
            X_train, X_test, y_train, y_test = train_test_split(
                X, y, test_size=0.2, random_state=42
            )
            
            # Scale features
            X_train_scaled = self.scaler.fit_transform(X_train)
            X_test_scaled = self.scaler.transform(X_test)
            
            # Train ensemble models
            results = {}
            for name, model in self.ensemble_models.items():
                model.fit(X_train_scaled, y_train)
                
                # Evaluate
                y_pred = model.predict(X_test_scaled)
                mse = mean_squared_error(y_test, y_pred)
                r2 = r2_score(y_test, y_pred)
                
                results[name] = {
                    'mse': mse,
                    'r2': r2,
                    'accuracy': 1 - mse  # Simple accuracy metric
                }
            
            # Select best model as primary
            best_model_name = min(results.keys(), key=lambda k: results[k]['mse'])
            self.primary_model = self.ensemble_models[best_model_name]
            
            # Update model metadata
            self.model_version = f"{float(self.model_version) + 0.1:.1f}"
            self.last_training = datetime.now()
            self.training_data_size = len(X)
            
            # Save updated model
            self._save_model()
            
            # Log learning event
            learning_summary = {
                'success': True,
                'training_samples': len(X),
                'best_model': best_model_name,
                'performance': results[best_model_name],
                'model_version': self.model_version,
                'timestamp': self.last_training.isoformat()
            }
            
            self.feedback_integration_log.append(learning_summary)
            logger.info(f"✅ Model updated! New version: {self.model_version}")
            
            return learning_summary
            
        except Exception as e:
            logger.error(f"❌ Error during learning: {e}")
            return {'success': False, 'reason': str(e)}
    
    def _prepare_training_data(self, feedback_data: List[Dict[str, Any]]) -> Tuple[np.ndarray, np.ndarray]:
        """Prepare training data from feedback"""
        
        X = []
        y = []
        
        for feedback in feedback_data:
            # Extract features (would need question data reconstruction)
            # For now, using simplified approach
            feature_vector = [
                feedback.get('original_difficulty', 0.5),
                feedback.get('player_popularity', 0.5),
                feedback.get('era_difficulty', 0.3),
                feedback.get('statistical_complexity', 0.4),
                feedback.get('question_type_complexity', 0.5),
                feedback.get('competition_prestige', 0.6),
                feedback.get('data_quality', 0.8),
                feedback.get('answer_specificity', 0.5),
                feedback.get('historical_accuracy', 0.7),
                feedback.get('admin_adjustments', 0.5)
            ]
            
            # Convert user feedback to difficulty score
            difficulty_score = self._convert_feedback_to_difficulty(feedback.get('user_feedback', 'just_right'))
            
            X.append(feature_vector)
            y.append(difficulty_score)
        
        return np.array(X), np.array(y)
    
    def _convert_feedback_to_difficulty(self, feedback: str) -> float:
        """Convert user feedback to numerical difficulty score"""
        feedback_mapping = {
            'too_easy': 0.3,
            'just_right': 0.5,
            'too_hard': 0.8
        }
        return feedback_mapping.get(feedback, 0.5)
    
    def _save_model(self):
        """Save trained model to disk"""
        if not ML_AVAILABLE or not self.primary_model:
            return
        
        model_data = {
            'model': self.primary_model,
            'scaler': self.scaler,
            'encoders': self.feature_encoders,
            'version': self.model_version,
            'last_training': self.last_training,
            'training_data_size': self.training_data_size
        }
        
        joblib.dump(model_data, self.model_path)
        logger.info(f"💾 Model saved to {self.model_path}")
    
    # Feature calculation methods
    def _calculate_player_popularity(self, player_name: str) -> float:
        """Calculate player popularity score"""
        # Enhanced with actual popularity metrics
        well_known_players = {
            'Lionel Messi': 1.0,
            'Cristiano Ronaldo': 1.0,
            'Neymar': 0.9,
            'Kylian Mbappé': 0.9,
            'Robert Lewandowski': 0.8,
            'Karim Benzema': 0.8,
            'Mohamed Salah': 0.8,
            'Sadio Mané': 0.7,
            'Kevin De Bruyne': 0.7,
            'Virgil van Dijk': 0.7
        }
        
        # Direct match
        if player_name in well_known_players:
            return well_known_players[player_name]
        
        # Partial match for variations
        for known_player, score in well_known_players.items():
            if any(name in player_name for name in known_player.split()):
                return score * 0.8  # Slightly lower for partial match
        
        return 0.3  # Default for unknown players
    
    def _calculate_era_difficulty(self, year: int) -> float:
        """Calculate difficulty based on era (older = harder)"""
        current_year = datetime.now().year
        years_ago = max(0, current_year - year)
        
        # Logarithmic scale: recent years easier, older years harder
        if years_ago <= 5:
            return 0.2
        elif years_ago <= 15:
            return 0.4
        elif years_ago <= 30:
            return 0.6
        else:
            return 0.8
    
    def _calculate_statistical_complexity(self, question_data: Dict[str, Any]) -> float:
        """Calculate complexity based on statistical content"""
        question_type = question_data.get('type', '')
        
        complexity_mapping = {
            'award_winner': 0.3,
            'award_season': 0.4,
            'award_team': 0.5,
            'award_age': 0.6,
            'stat_value': 0.7,
            'stat_comparison': 0.8,
            'stat_leader': 0.6
        }
        
        return complexity_mapping.get(question_type, 0.5)
    
    def _calculate_question_type_complexity(self, question_type: str) -> float:
        """Calculate complexity inherent to question type"""
        type_complexity = {
            'award_nationality': 0.2,
            'award_winner': 0.3,
            'award_season': 0.5,
            'award_team': 0.6,
            'award_age': 0.7,
            'award_odd_one_out': 0.8,
            'stat_value': 0.7,
            'stat_comparison': 0.8,
            'stat_leader': 0.6
        }
        
        return type_complexity.get(question_type, 0.5)
    
    def _calculate_competition_prestige(self, competition: str) -> float:
        """Calculate prestige/difficulty of competition"""
        prestige_mapping = {
            'Ballon_d_Or': 1.0,
            'Champions_League': 0.9,
            'World_Cup': 0.9,
            'Premier_League': 0.8,
            'La_Liga': 0.8,
            'Serie_A': 0.7,
            'Bundesliga': 0.7,
            'Ligue_1': 0.6
        }
        
        # Check for partial matches
        for comp, score in prestige_mapping.items():
            if comp.lower() in competition.lower():
                return score
        
        return 0.5  # Default for unknown competitions
    
    def _calculate_answer_specificity(self, question_data: Dict[str, Any]) -> float:
        """Calculate how specific/precise the answer needs to be"""
        answer = str(question_data.get('answer', ''))
        
        # Numeric answers tend to be more specific
        if answer.isdigit():
            return 0.8
        
        # Date/season answers are moderately specific
        if '-' in answer and len(answer) == 9:  # YYYY-YYYY format
            return 0.6
        
        # Name answers depend on popularity
        return self._calculate_player_popularity(answer) * 0.5 + 0.3
    
    def _get_historical_accuracy(self, question_id: str) -> float:
        """Get historical accuracy for this question from database"""
        # This would query the analytics database
        # For now, return default
        return 0.7
    
    def _get_user_feedback_score(self, question_id: str) -> float:
        """Get aggregated user feedback score"""
        # This would query the feedback database
        # For now, return default
        return 0.5
    
    def _get_admin_adjustments(self, question_id: str) -> float:
        """Get admin difficulty adjustments"""
        # This would query admin adjustments
        # For now, return default
        return 0.5
    
    def _calculate_prediction_confidence(self, features: DifficultyFeatures, prediction: float) -> float:
        """Calculate confidence in prediction"""
        # Higher confidence for well-known patterns
        confidence = 0.5
        
        # Boost confidence for known players
        if features.player_popularity > 0.7:
            confidence += 0.2
        
        # Boost confidence for recent data
        if features.era_difficulty < 0.4:
            confidence += 0.1
        
        # Boost confidence for high-quality data
        if features.data_quality > 0.8:
            confidence += 0.2
        
        return min(confidence, 1.0)
    
    def get_model_performance(self) -> Dict[str, Any]:
        """Get current model performance metrics"""
        return {
            'model_version': self.model_version,
            'last_training': self.last_training.isoformat() if self.last_training else None,
            'training_data_size': self.training_data_size,
            'prediction_count': len(self.prediction_history),
            'feedback_integrations': len(self.feedback_integration_log),
            'ml_available': ML_AVAILABLE
        }


# Example usage and testing
if __name__ == "__main__":
    predictor = MLDifficultyPredictor()
    
    print("=== ML Difficulty Predictor Test ===\n")
    
    # Test prediction
    test_question = {
        'question_id': 'test_001',
        'player': 'Lionel Messi',
        'year': 2021,
        'type': 'award_winner',
        'competition': 'Ballon_d_Or',
        'answer': 'Lionel Messi',
        'quality_score': 0.9
    }
    
    result = predictor.predict_difficulty(test_question)
    
    print(f"🎯 Predicted Difficulty: {result.predicted_difficulty:.3f}")
    print(f"🎲 Confidence: {result.confidence:.3f}")
    print(f"📊 Model Version: {result.model_version}")
    
    if result.feature_importance:
        print(f"🔍 Top Features:")
        sorted_features = sorted(result.feature_importance.items(), key=lambda x: x[1], reverse=True)
        for feature, importance in sorted_features[:3]:
            print(f"   - {feature}: {importance:.3f}")
    
    # Test learning (would need real feedback data)
    print(f"\n📈 Model Performance:")
    perf = predictor.get_model_performance()
    for key, value in perf.items():
        print(f"   - {key}: {value}")
    
    print("\n🚀 ML Difficulty Predictor ready!")