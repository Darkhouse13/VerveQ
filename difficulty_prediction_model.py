import joblib
import numpy as np
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import train_test_split, cross_val_score, GridSearchCV
from sklearn.metrics import mean_absolute_error, r2_score
from typing import Dict, Any, List, Tuple

# Assuming FeatureExtractor is in a separate file and can be imported
from feature_extraction import FeatureExtractor

class DifficultyPredictor:
    """
    A class to implement an ML-based difficulty prediction model using Random Forest.
    """
    def __init__(self, feature_extractor: FeatureExtractor = None):
        self.model = None
        self.feature_extractor = feature_extractor if feature_extractor else FeatureExtractor()

    def extract_features(self, question: Dict[str, Any]) -> np.ndarray:
        """
        Extracts features for a single question using the FeatureExtractor.
        """
        return self.feature_extractor.extract_features(question)

    def extract_features_batch(self, questions: List[Dict[str, Any]]) -> np.ndarray:
        """
        Extracts features for a batch of questions using the FeatureExtractor.
        """
        return self.feature_extractor.extract_features_batch(questions)

    def train_model(self, X: np.ndarray, y: np.ndarray,
                    hyperparameters: Dict[str, Any] = None) -> None:
        """
        Trains the difficulty prediction model.

        Args:
            X (np.ndarray): Feature matrix (n_samples, n_features).
            y (np.ndarray): Target vector (n_samples,) representing difficulty scores.
            hyperparameters (Dict[str, Any], optional): Dictionary of hyperparameters
                                                         for GridSearchCV. Defaults to None.
        """
        if hyperparameters:
            print("Performing GridSearchCV for hyperparameter optimization...")
            param_grid = hyperparameters
            # Using a smaller n_jobs for demonstration, can be -1 for all cores
            grid_search = GridSearchCV(RandomForestRegressor(random_state=42),
                                       param_grid, cv=5, scoring='neg_mean_absolute_error', n_jobs=-1)
            grid_search.fit(X, y)
            self.model = grid_search.best_estimator_
            print(f"Best hyperparameters: {grid_search.best_params_}")
            print(f"Best MAE (from CV): {-grid_search.best_score_}")
        else:
            print("Training Random Forest Regressor with default parameters...")
            self.model = RandomForestRegressor(n_estimators=100, random_state=42, n_jobs=-1)
            self.model.fit(X, y)
        print("Model training complete.")

    def predict_difficulty(self, X: np.ndarray) -> np.ndarray:
        """
        Predicts difficulty scores for new questions.

        Args:
            X (np.ndarray): Feature matrix of new questions.

        Returns:
            np.ndarray: Predicted difficulty scores.
        """
        if self.model is None:
            raise ValueError("Model has not been trained yet. Call train_model first.")
        return self.model.predict(X)

    def evaluate_model(self, X: np.ndarray, y_true: np.ndarray) -> Dict[str, float]:
        """
        Evaluates the trained model's performance.

        Args:
            X (np.ndarray): Feature matrix for evaluation.
            y_true (np.ndarray): True difficulty scores.

        Returns:
            Dict[str, float]: A dictionary containing evaluation metrics (MAE, R2).
        """
        if self.model is None:
            raise ValueError("Model has not been trained yet. Call train_model first.")

        y_pred = self.model.predict(X)
        mae = mean_absolute_error(y_true, y_pred)
        r2 = r2_score(y_true, y_pred)

        print(f"Model Evaluation:")
        print(f"  Mean Absolute Error (MAE): {mae:.4f}")
        print(f"  R-squared (R2): {r2:.4f}")

        # Feature importance analysis
        if hasattr(self.model, 'feature_importances_'):
            importances = self.model.feature_importances_
            # This would ideally be mapped to feature names from FeatureExtractor
            # For now, just print them
            print("\nFeature Importances:")
            for i, importance in enumerate(importances):
                print(f"  Feature {i}: {importance:.4f}")

        return {"mae": mae, "r2": r2}

    def save_model(self, path: str) -> None:
        """
        Saves the trained model to a specified path.

        Args:
            path (str): The file path to save the model (e.g., 'model.joblib').
        """
        if self.model is None:
            raise ValueError("No model to save. Train the model first.")
        joblib.dump(self.model, path)
        print(f"Model saved to {path}")

    def load_model(self, path: str) -> None:
        """
        Loads a trained model from a specified path.

        Args:
            path (str): The file path from which to load the model.
        """
        self.model = joblib.load(path)
        print(f"Model loaded from {path}")

# Example Usage (for testing purposes)
if __name__ == "__main__":
    # This is a simplified example. In a real scenario, you'd load actual data.
    # Create synthetic data for demonstration
    num_samples = 100
    num_features = 10 # Must match the number of features extracted by FeatureExtractor
    X_synthetic = np.random.rand(num_samples, num_features) * 10
    y_synthetic = np.random.rand(num_samples) * 5 + 1 # Difficulty scores between 1 and 6

    # Initialize predictor
    predictor = DifficultyPredictor()

    # Split data for training and testing
    X_train, X_test, y_train, y_test = train_test_split(X_synthetic, y_synthetic, test_size=0.2, random_state=42)

    # Define hyperparameters for GridSearchCV (optional)
    hyperparams = {
        'n_estimators': [50, 100, 200],
        'max_depth': [None, 10, 20],
        'min_samples_split': [2, 5]
    }

    # Train the model
    predictor.train_model(X_train, y_train, hyperparameters=hyperparams)

    # Evaluate the model
    predictor.evaluate_model(X_test, y_test)

    # Save and load the model
    model_path = "difficulty_model.joblib"
    predictor.save_model(model_path)

    new_predictor = DifficultyPredictor()
    new_predictor.load_model(model_path)

    # Make predictions with the loaded model
    sample_prediction_data = np.random.rand(5, num_features) * 10
    predictions = new_predictor.predict_difficulty(sample_prediction_data)
    print("\nPredictions for new data:", predictions)
