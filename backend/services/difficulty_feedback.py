"""
Difficulty Feedback Service for VerveQ Platform
Handles user feedback on question difficulty to improve categorization
"""

import logging
from typing import Dict, Optional
from sqlalchemy.orm import Session
from database.connection import SessionLocal
from database.models import QuizQuestion
from datetime import datetime

logger = logging.getLogger(__name__)

class DifficultyFeedbackService:
    """Service for processing difficulty feedback on quiz questions"""
    
    # Difficulty mapping: user perception -> numeric score (0=easy, 1=hard)
    DIFFICULTY_SCORES = {
        'easy': 0.0,
        'intermediate': 0.5,
        'hard': 1.0
    }
    
    # Thresholds for recategorizing questions
    RECATEGORIZE_VOTE_THRESHOLD = 10  # Minimum votes before recategorizing
    DIFFICULTY_CHANGE_THRESHOLD = 0.3  # Score difference to trigger recategorization
    
    @staticmethod
    def submit_feedback(
        question_checksum: str,
        perceived_difficulty: str,
        was_correct: bool
    ) -> Dict[str, any]:
        """
        Submit difficulty feedback for a question
        
        Args:
            question_checksum: MD5 checksum of the question
            perceived_difficulty: User's perceived difficulty (easy/intermediate/hard)
            was_correct: Whether user answered correctly
            
        Returns:
            Dict with submission status and updated question info
        """
        try:
            db = SessionLocal()
            
            # Find question by checksum
            question = db.query(QuizQuestion).filter(
                QuizQuestion.checksum == question_checksum
            ).first()
            
            if not question:
                return {
                    "success": False,
                    "message": "Question not found",
                    "question_updated": False
                }
            
            # Update answer statistics
            question.times_answered += 1
            if was_correct:
                question.times_correct += 1
            
            # Add difficulty feedback
            user_score = DifficultyFeedbackService.DIFFICULTY_SCORES[perceived_difficulty]
            
            # Calculate new difficulty score using running average
            current_score = question.difficulty_score or 0.5
            current_votes = question.difficulty_votes or 0
            
            # Update with new vote
            new_total_score = (current_score * current_votes) + user_score
            new_votes = current_votes + 1
            new_average_score = new_total_score / new_votes
            
            question.difficulty_votes = new_votes
            question.difficulty_score = new_average_score
            question.updated_at = datetime.utcnow()
            
            # Check if we should recategorize the question
            old_difficulty = question.difficulty
            new_difficulty = DifficultyFeedbackService._calculate_difficulty_category(new_average_score)
            
            question_updated = False
            if (new_votes >= DifficultyFeedbackService.RECATEGORIZE_VOTE_THRESHOLD and 
                new_difficulty != old_difficulty):
                
                # Check if change is significant enough
                old_score = DifficultyFeedbackService.DIFFICULTY_SCORES[old_difficulty]
                if abs(new_average_score - old_score) >= DifficultyFeedbackService.DIFFICULTY_CHANGE_THRESHOLD:
                    question.difficulty = new_difficulty
                    question_updated = True
                    logger.info(f"Recategorized question {question_checksum}: {old_difficulty} -> {new_difficulty}")
            
            db.commit()
            
            return {
                "success": True,
                "message": "Feedback submitted successfully",
                "question_id": question.id,
                "old_difficulty": old_difficulty,
                "new_difficulty": question.difficulty,
                "difficulty_score": round(new_average_score, 3),
                "total_votes": new_votes,
                "accuracy_rate": round((question.times_correct / question.times_answered) * 100, 1),
                "question_updated": question_updated
            }
            
        except Exception as e:
            logger.error(f"Error submitting difficulty feedback: {e}")
            return {
                "success": False,
                "message": f"Error processing feedback: {str(e)}",
                "question_updated": False
            }
        finally:
            db.close()
    
    @staticmethod
    def _calculate_difficulty_category(score: float) -> str:
        """Convert numeric difficulty score to category"""
        if score <= 0.33:
            return 'easy'
        elif score <= 0.66:
            return 'intermediate'
        else:
            return 'hard'
    
    @staticmethod
    def get_question_feedback_stats(question_checksum: str) -> Optional[Dict]:
        """Get feedback statistics for a specific question"""
        try:
            db = SessionLocal()
            question = db.query(QuizQuestion).filter(
                QuizQuestion.checksum == question_checksum
            ).first()
            
            if not question:
                return None
            
            accuracy_rate = 0
            if question.times_answered > 0:
                accuracy_rate = (question.times_correct / question.times_answered) * 100
            
            return {
                "question_id": question.id,
                "sport": question.sport,
                "category": question.category,
                "current_difficulty": question.difficulty,
                "difficulty_score": question.difficulty_score or 0.5,
                "total_feedback_votes": question.difficulty_votes or 0,
                "times_answered": question.times_answered,
                "times_correct": question.times_correct,
                "accuracy_rate": round(accuracy_rate, 1),
                "usage_count": question.usage_count
            }
            
        except Exception as e:
            logger.error(f"Error getting feedback stats: {e}")
            return None
        finally:
            db.close()
    
    @staticmethod
    def get_difficulty_distribution() -> Dict[str, int]:
        """Get overall difficulty distribution across all questions"""
        try:
            db = SessionLocal()
            
            easy_count = db.query(QuizQuestion).filter(QuizQuestion.difficulty == 'easy').count()
            intermediate_count = db.query(QuizQuestion).filter(QuizQuestion.difficulty == 'intermediate').count()
            hard_count = db.query(QuizQuestion).filter(QuizQuestion.difficulty == 'hard').count()
            
            return {
                "easy": easy_count,
                "intermediate": intermediate_count,
                "hard": hard_count,
                "total": easy_count + intermediate_count + hard_count
            }
            
        except Exception as e:
            logger.error(f"Error getting difficulty distribution: {e}")
            return {"easy": 0, "intermediate": 0, "hard": 0, "total": 0}
        finally:
            db.close()

# Global service instance
_difficulty_feedback_service = None

def get_difficulty_feedback_service() -> DifficultyFeedbackService:
    """Get global difficulty feedback service instance"""
    global _difficulty_feedback_service
    if _difficulty_feedback_service is None:
        _difficulty_feedback_service = DifficultyFeedbackService()
    return _difficulty_feedback_service