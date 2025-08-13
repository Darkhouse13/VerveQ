"""
Quiz session management for tracking questions within a game.
Simple in-memory implementation following CLAUDE.md principles.
"""

import time
import uuid
from typing import Dict, Set, Optional
from collections import defaultdict
import threading

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
    
    def create_session(self, sport: str) -> str:
        """Create a new quiz session
        
        Args:
            sport: The sport for this quiz session
            
        Returns:
            Session ID
        """
        session_id = str(uuid.uuid4())
        
        with self._lock:
            self.sessions[session_id] = {
                'sport': sport,
                'used_questions': set(),
                'question_count': 0,
                'created_at': time.time(),
                'expires_at': time.time() + self.session_ttl
            }
            
            # Periodic cleanup
            self._cleanup_expired_sessions()
        
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
            
            if question_key in session['used_questions']:
                return False
            
            session['used_questions'].add(question_key)
            session['question_count'] += 1
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