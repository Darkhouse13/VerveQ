import json
import logging
from typing import Dict, Any, List, Optional

# Configure logging
logging.basicConfig(level=logging.DEBUG, format='%(asctime)s - %(levelname)s - %(message)s')

class QuestionQualityScorer:
    """
    Assesses the quality of generated quiz questions based on multiple metrics.
    Scores are combined into a composite quality score from 0 to 1.
    """

    def __init__(self, config_path: str = 'quality_config.json'):
        """
        Initializes the scorer with configuration from a JSON file.

        Args:
            config_path (str): Path to the configuration file.
        """
        try:
            with open(config_path, 'r') as f:
                self.config = json.load(f)
            self.weights = self.config.get('weights', {})
            self.thresholds = self.config.get('thresholds', {})
            logging.info("QuestionQualityScorer initialized with config from %s", config_path)
        except FileNotFoundError:
            logging.error("Configuration file not found at %s. Using default weights and thresholds.", config_path)
            self.weights = {
                "distractor_plausibility": 0.25, "question_clarity": 0.20, "answer_uniqueness": 0.15,
                "difficulty_appropriateness": 0.15, "factual_correctness": 0.20, "overall_coherence": 0.05
            }
            self.thresholds = {"composite_score": 0.75}
        except json.JSONDecodeError:
            logging.error("Invalid JSON in config file: %s. Using default weights.", config_path)
            self.weights = {}
            self.thresholds = {}

    def score_question(self, question_data: Dict[str, Any]) -> float:
        """
        Calculates a composite quality score for a given question.

        Args:
            question_data (Dict[str, Any]): A dictionary containing the question, correct_answer,
                                             and distractors.

        Returns:
            float: A composite quality score between 0 and 1.
        """
        report = self.get_quality_report(question_data)
        
        composite_score = sum(report[metric] * self.weights.get(metric, 0) for metric in report)
        
        # Normalize by the sum of weights used, in case some weights are missing
        total_weight = sum(self.weights.get(metric, 0) for metric in report if metric in self.weights)
        if total_weight == 0:
            return 0.0
            
        return min(1.0, composite_score / total_weight)

    def get_quality_report(self, question_data: Dict[str, Any]) -> Dict[str, float]:
        """
        Generates a detailed report of all quality scoring factors.

        Args:
            question_data (Dict[str, Any]): The question to be evaluated.

        Returns:
            Dict[str, float]: A dictionary with scores for each quality metric.
        """
        report = {
            "distractor_plausibility": self._score_distractors(question_data.get('distractors', [])),
            "question_clarity": self._score_clarity(question_data.get('question', '')),
            "answer_uniqueness": self._score_uniqueness(question_data),
            "difficulty_appropriateness": self._score_difficulty(question_data),
            "factual_correctness": self._verify_facts(question_data),
            "overall_coherence": self._score_coherence(question_data)
        }
        logging.debug(f"Quality Report for question: {report}")
        return report

    def _score_distractors(self, distractors: List[str]) -> float:
        """Scores distractor plausibility and diversity based on count and quality."""
        if not distractors:
            return 0.0
        
        # Filter out empty or None distractors
        valid_distractors = [d for d in distractors if d and d.strip()]
        
        # Score based on number of valid distractors
        # 3+ distractors = perfect score, 2 distractors = good score, 1 = poor
        if len(valid_distractors) >= 3:
            return 1.0
        elif len(valid_distractors) == 2:
            return 0.8
        elif len(valid_distractors) == 1:
            return 0.4
        else:
            return 0.0

    def _score_clarity(self, question_text: str) -> float:
        """Placeholder for assessing question clarity and grammar."""
        if not question_text or len(question_text.split()) < 5:
            return 0.2
        return 0.8  # Assume good clarity for now

    def _score_uniqueness(self, question_data: Dict[str, Any]) -> float:
        """Placeholder for checking for question uniqueness."""
        # In a real implementation, this would check against a database of past questions.
        return 0.9  # Assume unique for now

    def _score_difficulty(self, question_data: Dict[str, Any]) -> float:
        """Placeholder for evaluating if difficulty matches intended level."""
        # This would require more context on the intended difficulty.
        return 0.7  # Neutral score

    def _verify_facts(self, question_data: Dict[str, Any]) -> float:
        """Placeholder for validating factual correctness."""
        # This would involve an external API or a knowledge base.
        if self.config.get("scoring_options", {}).get("enable_fact_checking"):
            # Simulate an API call
            return 0.85  # Assume mostly correct
        return 1.0  # Skip if disabled

    def _score_coherence(self, question_data: Dict[str, Any]) -> float:
        """Placeholder for overall coherence."""
        return 0.9 # Assume coherent for now

    def is_high_quality(self, question_data: Dict[str, Any]) -> bool:
        """
        Determines if a question meets the quality thresholds defined in the config.

        Args:
            question_data (Dict[str, Any]): The question to check.

        Returns:
            bool: True if the question is of high quality, False otherwise.
        """
        composite_score = self.score_question(question_data)
        if composite_score < self.thresholds.get("composite_score", 0.75):
            return False

        report = self.get_quality_report(question_data)
        for metric, threshold in self.thresholds.items():
            if metric.startswith("min_") and report.get(metric.replace("min_", ""), 0) < threshold:
                return False
        
        return True

if __name__ == '__main__':
    # Example Usage
    scorer = QuestionQualityScorer()
    
    sample_question = {
        "question": "Which player won the Ballon d'Or in 2021?",
        "correct_answer": "Lionel Messi",
        "distractors": ["Cristiano Ronaldo", "Robert Lewandowski", "Jorginho"],
        "difficulty": "medium"
    }
    
    quality_score = scorer.score_question(sample_question)
    quality_report = scorer.get_quality_report(sample_question)
    is_good = scorer.is_high_quality(sample_question)

    print(f"Quality Score: {quality_score:.2f}")
    print("Quality Report:")
    for metric, score in quality_report.items():
        print(f"  - {metric}: {score:.2f}")
    print(f"Is high quality? {'Yes' if is_good else 'No'}")
