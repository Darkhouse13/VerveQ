"""
Quiz session management for tracking questions within a game.
Simple in-memory implementation with optional cache backend support.
Following CLAUDE.md principles (<300 lines, no over-engineering).
"""

import time
import uuid
import logging
import os
from typing import Dict, Set, Optional
from collections import defaultdict
import threading

logger = logging.getLogger(__name__)

# Optional cache backend integration
_cache_backend = None
if os.getenv("ENABLE_CACHE_BACKEND", "false").lower() == "true":
    try:
        from .cache_backend import cache
        _cache_backend = cache
        logger.info("🚀 Quiz sessions will use cache backend")
    except ImportError:
        logger.info("💾 Cache backend not available, using in-memory sessions")

class QuizSessionManager:
    """Manages quiz sessions to prevent duplicate questions within a game"""
    
    def __init__(self, session_ttl: int = 1800):  # 30 minutes default
        """Initialize session manager
        
        Args:
            session_ttl: Time to live for sessions in seconds
        """
        self.sessions: Dict[str, Dict] = {}
        self.session_ttl = session_ttl
        self._lock = threading.Lock()
        self._last_cleanup = time.time()
        self._cleanup_interval = 300  # Clean up expired sessions every 5 minutes
        self.use_cache = _cache_backend is not None
    
    def _get_session_key(self, session_id: str) -> str:
        """Get cache key for session"""
        return f"quiz_session:{session_id}"
    
    def _get_session_from_cache(self, session_id: str) -> Optional[Dict]:
        """Get session from cache backend if available"""
        if self.use_cache:
            return _cache_backend.get(self._get_session_key(session_id))
        return self.sessions.get(session_id)
    
    def _store_session_in_cache(self, session_id: str, session_data: Dict):
        """Store session in cache backend if available"""
        if self.use_cache:
            _cache_backend.set(self._get_session_key(session_id), session_data, self.session_ttl)
        else:
            self.sessions[session_id] = session_data
    
    def create_session(self, sport: str) -> str:
        """Create a new quiz session
        
        Args:
            sport: The sport for this quiz session
            
        Returns:
            Session ID
        """
        session_id = str(uuid.uuid4())
        
        session_data = {
            'sport': sport,
            # Store as a set for efficient membership and add operations
            # If a cache backend requires serialization, it should handle conversion
            'used_questions': set(),
            'question_count': 0,
            'created_at': time.time(),
            'expires_at': time.time() + self.session_ttl
        }
        
        with self._lock:
            self._store_session_in_cache(session_id, session_data)
            
            # Periodic cleanup (only for in-memory)
            if not self.use_cache:
                self._cleanup_expired_sessions()
            
            logger.debug(f"🎮 Created new quiz session {session_id[:8]}... for sport: {sport}")
        
        return session_id
    
    def add_question(self, session_id: str, question_key: str) -> bool:
        """Add a question to session history
        
        Args:
            session_id: The session ID
            question_key: Unique key for the question
            
        Returns:
            True if added successfully, False if duplicate or session not found
        """
        with self._lock:
            session = self.sessions.get(session_id)
            if not session or time.time() > session['expires_at']:
                return False
            
            # Normalize container to a set if legacy sessions used a list
            uq = session.get('used_questions')
            if isinstance(uq, list):
                uq = set(uq)
                session['used_questions'] = uq
            elif uq is None:
                uq = set()
                session['used_questions'] = uq

            if question_key in uq:
                logger.info(f"🔄 Skipping duplicate question: {question_key[:12]}... for session {session_id[:8]}... (already used {len(session['used_questions'])} questions)")
                return False
            
            uq.add(question_key)
            session['question_count'] += 1
            logger.debug(f"✅ Added question {question_key[:12]}... to session {session_id[:8]}... (total: {session['question_count']})")
            return True
    
    def is_question_used(self, session_id: str, question_key: str) -> bool:
        """Check if a question has been used in this session
        
        Args:
            session_id: The session ID
            question_key: Unique key for the question
            
        Returns:
            True if question was already used
        """
        with self._lock:
            session = self.sessions.get(session_id)
            if not session or time.time() > session['expires_at']:
                return False
            
            return question_key in session['used_questions']
    
    def get_used_questions(self, session_id: str) -> Set[str]:
        """Get set of used question keys for a session
        
        Args:
            session_id: The session ID
            
        Returns:
            Set of used question keys
        """
        with self._lock:
            session = self.sessions.get(session_id)
            if not session or time.time() > session['expires_at']:
                return set()
            
            uq = session['used_questions']
            if isinstance(uq, list):
                return set(uq)
            # uq is a set; return a shallow copy as a set
            return set(uq)
    
    def get_session_info(self, session_id: str) -> Optional[Dict]:
        """Get session information
        
        Args:
            session_id: The session ID
            
        Returns:
            Session info dict or None if not found/expired
        """
        with self._lock:
            session = self.sessions.get(session_id)
            if not session or time.time() > session['expires_at']:
                return None
            
            return {
                'sport': session['sport'],
                'question_count': session['question_count'],
                'remaining_time': int(session['expires_at'] - time.time())
            }
    
    def calculate_time_based_score(self, base_points: int, time_taken: float, max_time_per_question: float = 10.0) -> int:
        """Calculate score based on correctness and time taken using progressive-decrease algorithm
        
        Args:
            base_points: Base points for correct answer (should be 100 for new scoring system)
            time_taken: Time taken to answer in seconds
            max_time_per_question: Maximum time allowed per question in seconds (10 seconds for new system)
            
        Returns:
            Calculated score based on progressive-decrease algorithm:
            - Answer within 1 second: 100 points
            - Answer between 1 and 10 seconds: Points decrease from 100
            - Answer after 10 seconds: 0 points
        """
        # If time exceeds maximum allowed time, score is 0
        if time_taken > max_time_per_question:
            return 0
        
        # New progressive-decrease algorithm:
        # - Answer within 1 second: 100 points
        # - Answer between 1 and 10 seconds: Points decrease from 100
        # - Answer after 10 seconds: 0 points
        if time_taken <= 1.0:
            return base_points
        else:
            # Calculate score using formula: base_points * ((max_time - time_taken) / (max_time - 1))
            # This gives a linear decrease from 100 points at 1 second to 0 points at 10 seconds
            calculated_score = int(base_points * ((max_time_per_question - time_taken) / (max_time_per_question - 1.0)))
            return max(0, calculated_score)
    
    def end_session(self, session_id: str) -> None:
        """End a quiz session
        
        Args:
            session_id: The session ID to end
        """
        with self._lock:
            self.sessions.pop(session_id, None)
    
    def _cleanup_expired_sessions(self) -> None:
        """Remove expired sessions (called internally with lock held)"""
        current_time = time.time()
        
        # Only cleanup periodically to avoid performance impact
        if current_time - self._last_cleanup < self._cleanup_interval:
            return
        
        expired_sessions = [
            sid for sid, session in self.sessions.items()
            if current_time > session['expires_at']
        ]
        
        for sid in expired_sessions:
            del self.sessions[sid]
        
        self._last_cleanup = current_time


# Global session manager instance
_quiz_session_manager = None

def get_quiz_session_manager() -> QuizSessionManager:
    """Get the global quiz session manager instance"""
    global _quiz_session_manager
    if _quiz_session_manager is None:
        _quiz_session_manager = QuizSessionManager()
    return _quiz_session_manager