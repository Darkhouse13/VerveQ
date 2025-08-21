"""
Question Repository Service for VerveQ Platform
Manages prepopulated quiz questions with in-memory caching
"""

import random
import time
import logging
from typing import Dict, List, Optional, Set
from sqlalchemy.orm import Session
from sqlalchemy import func
from database.connection import SessionLocal
from database.models import QuizQuestion
from config.settings import settings

logger = logging.getLogger(__name__)

class QuestionCache:
    """In-memory cache for question ID buckets"""
    
    def __init__(self, bucket_size: int = 75):
        """Initialize cache with configurable bucket size"""
        self.bucket_size = bucket_size
        self.buckets: Dict[str, List[int]] = {}  # bucket_key -> list of question IDs
        self.bucket_metadata: Dict[str, Dict] = {}  # bucket_key -> metadata
        self.last_refill: Dict[str, float] = {}  # bucket_key -> timestamp
        
    def get_bucket_key(self, sport: str, difficulty: str, category: str = "general") -> str:
        """Generate cache bucket key"""
        return f"{sport}_{difficulty}_{category}".replace(" ", "_").lower()
    
    def get_question_ids(self, bucket_key: str, exclude_ids: Set[int] = None) -> List[int]:
        """Get available question IDs from bucket, excluding used ones"""
        exclude_ids = exclude_ids or set()
        
        if bucket_key not in self.buckets:
            return []
        
        available_ids = [qid for qid in self.buckets[bucket_key] if qid not in exclude_ids]
        return available_ids
    
    def needs_refill(self, bucket_key: str, threshold_percent: float = 0.2) -> bool:
        """Check if bucket needs refilling"""
        if bucket_key not in self.buckets:
            return True
        
        current_size = len(self.buckets[bucket_key])
        return current_size < (self.bucket_size * threshold_percent)
    
    def refill_bucket(self, bucket_key: str, question_ids: List[int]) -> None:
        """Refill bucket with new question IDs"""
        self.buckets[bucket_key] = question_ids[:self.bucket_size]
        self.last_refill[bucket_key] = time.time()
        
        logger.info(f"Refilled bucket {bucket_key} with {len(self.buckets[bucket_key])} questions")
    
    def remove_question_id(self, bucket_key: str, question_id: int) -> None:
        """Remove used question ID from bucket"""
        if bucket_key in self.buckets and question_id in self.buckets[bucket_key]:
            self.buckets[bucket_key].remove(question_id)
    
    def get_cache_stats(self) -> Dict[str, int]:
        """Get cache statistics"""
        total_questions = sum(len(bucket) for bucket in self.buckets.values())
        return {
            "total_buckets": len(self.buckets),
            "total_cached_questions": total_questions,
            "average_bucket_size": total_questions // len(self.buckets) if self.buckets else 0
        }

class QuestionRepository:
    """Repository for managing quiz questions from database"""
    
    def __init__(self):
        """Initialize repository with cache"""
        self.cache = QuestionCache()
        
    def get_random_question(
        self, 
        sport: str, 
        difficulty: str = None,
        category: str = None,
        exclude_checksums: Set[str] = None
    ) -> Optional[Dict]:
        """
        Get random question from database with caching
        
        Args:
            sport: Sport name (e.g., 'football', 'tennis')
            difficulty: Question difficulty ('easy', 'intermediate', 'hard')
            category: Question category (optional)
            exclude_checksums: Set of checksums to exclude
            
        Returns:
            Question dict or None if not found
        """
        start_time = time.time()
        
        try:
            # Use default difficulty if not specified
            if not difficulty:
                difficulty = settings.default_question_difficulty
            
            # Get cache bucket key
            bucket_key = self.cache.get_bucket_key(sport, difficulty, category or "general")
            
            # Check if bucket needs refill
            if self.cache.needs_refill(bucket_key):
                self._refill_bucket(bucket_key, sport, difficulty, category)
            
            # Convert checksums to question IDs for exclusion
            exclude_ids = self._get_question_ids_by_checksums(exclude_checksums) if exclude_checksums else set()
            
            # Get available question IDs from cache
            available_ids = self.cache.get_question_ids(bucket_key, exclude_ids)
            
            if not available_ids:
                logger.warning(f"No available questions in bucket {bucket_key}")
                from fastapi import HTTPException
                raise HTTPException(status_code=404, detail="No questions available")
            
            # Select random question ID
            question_id = random.choice(available_ids)
            
            # Fetch question from database
            question = self._fetch_question_by_id(question_id)
            
            if question:
                # Remove from cache to prevent immediate reuse
                self.cache.remove_question_id(bucket_key, question_id)
                
                # Update usage stats
                self._update_usage_stats(question_id)
                
                # Log timing
                elapsed_ms = (time.time() - start_time) * 1000
                logger.debug(f"Repository fetch took {elapsed_ms:.1f}ms for {sport}/{difficulty}")
                
                return self._format_question(question)
            
        except Exception as e:
            logger.error(f"Error fetching question from repository: {e}")
            raise
        
        return None
    
    def _refill_bucket(self, bucket_key: str, sport: str, difficulty: str, category: str = None) -> None:
        """Refill cache bucket with question IDs from database"""
        try:
            db = SessionLocal()
            
            query = db.query(QuizQuestion.id).filter(
                QuizQuestion.sport == sport,
                QuizQuestion.difficulty == difficulty
            )
            
            if category and category != "general":
                query = query.filter(QuizQuestion.category.ilike(f"%{category}%"))
            
            # Get random question IDs
            question_ids = query.order_by(func.random()).limit(self.cache.bucket_size).all()
            question_ids = [q.id for q in question_ids]
            
            if question_ids:
                self.cache.refill_bucket(bucket_key, question_ids)
            else:
                logger.warning(f"No questions found for refill: {sport}/{difficulty}")
                
        except Exception as e:
            logger.error(f"Error refilling bucket {bucket_key}: {e}")
        finally:
            db.close()
    
    def _fetch_question_by_id(self, question_id: int) -> Optional[QuizQuestion]:
        """Fetch single question from database by ID"""
        try:
            db = SessionLocal()
            return db.query(QuizQuestion).filter(QuizQuestion.id == question_id).first()
        except Exception as e:
            logger.error(f"Error fetching question {question_id}: {e}")
            return None
        finally:
            db.close()
    
    def _get_question_ids_by_checksums(self, checksums: Set[str]) -> Set[int]:
        """Convert checksums to question IDs"""
        if not checksums:
            return set()
        
        try:
            db = SessionLocal()
            questions = db.query(QuizQuestion.id).filter(QuizQuestion.checksum.in_(checksums)).all()
            return {q.id for q in questions}
        except Exception as e:
            logger.error(f"Error converting checksums to IDs: {e}")
            return set()
        finally:
            db.close()
    
    def _update_usage_stats(self, question_id: int) -> None:
        """Update question usage statistics (async in real implementation)"""
        try:
            db = SessionLocal()
            question = db.query(QuizQuestion).filter(QuizQuestion.id == question_id).first()
            if question:
                question.usage_count += 1
                db.commit()
        except Exception as e:
            logger.error(f"Error updating usage stats for {question_id}: {e}")
        finally:
            if 'db' in locals():
                db.close()
    
    def _format_question(self, question: QuizQuestion) -> Dict:
        """Format QuizQuestion model to API response format"""
        return {
            "question": question.question,
            "options": question.options,
            "correct_answer": question.correct_answer,
            "explanation": question.explanation,
            "category": question.category,
            "difficulty": question.difficulty,
            "sport": question.sport,
            "checksum": question.checksum  # For session deduplication
        }
    
    def get_repository_stats(self) -> Dict:
        """Get repository performance statistics"""
        cache_stats = self.cache.get_cache_stats()
        
        try:
            db = SessionLocal()
            total_questions = db.query(QuizQuestion).count()
            sports_count = db.query(QuizQuestion.sport).distinct().count()
            
            return {
                **cache_stats,
                "total_db_questions": total_questions,
                "sports_available": sports_count
            }
        except Exception as e:
            logger.error(f"Error getting repository stats: {e}")
            return cache_stats
        finally:
            db.close()

# Global repository instance
_question_repository = None

def get_question_repository() -> QuestionRepository:
    """Get global question repository instance"""
    global _question_repository
    if _question_repository is None:
        _question_repository = QuestionRepository()
    return _question_repository