"""
Survival mode session management for VerveQ Platform
Handles session state, round progression, and challenge generation
"""

import uuid
import time
from typing import Dict, Optional, Any
from threading import Lock
from sports.survival_engine import get_survival_engine


class SurvivalSession:
    """Individual survival game session"""
    
    def __init__(self, sport: str):
        self.session_id = str(uuid.uuid4())
        self.sport = sport
        self.round = 1
        self.score = 0
        self.lives = 3
        self.used_initials = set()
        self.current_challenge = None
        self.hint_used = False  # Track if hint has been used for this game session
        self.created_at = time.time()
        self.last_activity = time.time()
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert session to dictionary"""
        return {
            'session_id': self.session_id,
            'sport': self.sport,
            'round': self.round,
            'score': self.score,
            'lives': self.lives,
            'current_challenge': self.current_challenge,
            'hint_available': not self.hint_used,
            'created_at': self.created_at,
            'last_activity': self.last_activity
        }


class SurvivalSessionManager:
    """Manager for survival game sessions"""
    
    def __init__(self):
        self._sessions: Dict[str, SurvivalSession] = {}
        self._lock = Lock()
        self._survival_engine = get_survival_engine()
        
    def create_session(self, sport: str, session_id: str = None) -> SurvivalSession:
        """Create a new survival session"""
        with self._lock:
            session = SurvivalSession(sport)
            if session_id:
                session.session_id = session_id  # Use provided ID for ephemeral sessions
            self._sessions[session.session_id] = session
            
            # Generate first challenge
            challenge = self._survival_engine.generate_challenge(session.round, sport, session.used_initials)
            if challenge:
                session.current_challenge = challenge
            
            session.last_activity = time.time()
            return session
    
    def get_session(self, session_id: str) -> Optional[SurvivalSession]:
        """Get existing session"""
        with self._lock:
            session = self._sessions.get(session_id)
            if session:
                session.last_activity = time.time()
            return session
    
    def next_challenge(self, session_id: str) -> Optional[Dict[str, Any]]:
        """Generate next challenge for session"""
        with self._lock:
            session = self._sessions.get(session_id)
            if not session:
                return None
            
            session.round += 1
            
            # Generate new challenge
            challenge = self._survival_engine.generate_challenge(session.round, session.sport, session.used_initials)
            if challenge:
                session.current_challenge = challenge
                session.last_activity = time.time()
                return challenge
            
            return None
    
    def submit_answer(self, session_id: str, user_answer: str) -> Optional[Dict[str, Any]]:
        """Submit answer and return validation result"""
        with self._lock:
            session = self._sessions.get(session_id)
            if not session or not session.current_challenge:
                return None
            
            # Validate answer using survival engine
            result = self._survival_engine.validate_answer(session.current_challenge, user_answer)
            
            if result['is_correct']:
                session.score += 1
                result['next_round'] = True
            else:
                session.lives -= 1
                result['next_round'] = False
                result['lives_remaining'] = session.lives
                
                # Check if game over
                if session.lives <= 0:
                    result['game_over'] = True
                    # Keep session for final score display but mark as ended
                    session.current_challenge = None
            
            session.last_activity = time.time()
            return result
    
    def end_session(self, session_id: str) -> bool:
        """End and remove session"""
        with self._lock:
            if session_id in self._sessions:
                del self._sessions[session_id]
                return True
            return False
    
    def cleanup_expired_sessions(self, max_age_seconds: int = 3600) -> int:
        """Remove expired sessions"""
        current_time = time.time()
        expired_sessions = []
        
        with self._lock:
            for session_id, session in self._sessions.items():
                if current_time - session.last_activity > max_age_seconds:
                    expired_sessions.append(session_id)
            
            for session_id in expired_sessions:
                del self._sessions[session_id]
        
        return len(expired_sessions)
    
    def get_or_create_ephemeral_session(self, client_ip: str, sport: str) -> SurvivalSession:
        """Get or create an ephemeral session for stateless API calls"""
        ephemeral_id = f"ephemeral_{client_ip}_{sport}"
        
        with self._lock:
            session = self._sessions.get(ephemeral_id)
            if session:
                session.last_activity = time.time()
                return session
            
            # Create new ephemeral session
            session = self.create_session(sport, ephemeral_id)
            return session
    
    def get_ephemeral_challenge(self, client_ip: str, sport: str) -> Optional[Dict[str, Any]]:
        """Get current challenge for ephemeral session"""
        session = self.get_or_create_ephemeral_session(client_ip, sport)
        if session and session.current_challenge and session.lives > 0:
            return session.current_challenge
        return None
    
    def submit_ephemeral_guess(self, client_ip: str, sport: str, initials: str, guess: str) -> Optional[Dict[str, Any]]:
        """Submit guess for ephemeral session"""
        session = self.get_or_create_ephemeral_session(client_ip, sport)
        
        if not session or session.lives <= 0:
            return None
        
        # Verify the initials match the current challenge
        if not session.current_challenge or session.current_challenge['initials'] != initials:
            return None
        
        # Submit the answer
        result = self.submit_answer(session.session_id, guess)
        
        # If correct, generate next challenge for stateless operation
        if result and result.get('is_correct') and result.get('next_round'):
            next_challenge = self.next_challenge(session.session_id)
            if next_challenge:
                result['next_initials'] = next_challenge['initials']
        
        return result

    def use_hint(self, session_id: str) -> bool:
        """Mark hint as used for session and return success status"""
        with self._lock:
            session = self._sessions.get(session_id)
            if not session:
                return False
            
            if session.hint_used:
                return False  # Hint already used
            
            session.hint_used = True
            session.last_activity = time.time()
            return True
    
    def can_use_hint(self, session_id: str) -> bool:
        """Check if hint is available for session"""
        with self._lock:
            session = self._sessions.get(session_id)
            if not session:
                return False
            return not session.hint_used

    def skip_challenge(self, session_id: str) -> Dict[str, Any]:
        """Skip current challenge and lose a life"""
        with self._lock:
            session = self._sessions.get(session_id)
            if not session:
                return {"error": "Session not found"}
            
            # Decrement life
            session.lives -= 1
            session.last_activity = time.time()
            
            # Check game over
            if session.lives <= 0:
                session.current_challenge = None
                return {
                    "game_over": True,
                    "lives": 0,
                    "score": session.score,
                    "round": session.round
                }
            
            # Generate new challenge with session's used_initials
            challenge = self._survival_engine.generate_challenge(
                session.round, session.sport, session.used_initials
            )
            
            if challenge:
                session.current_challenge = challenge
                return {
                    "lives": session.lives,
                    "challenge": challenge,
                    "skipped": True
                }
            
            return {"error": "Failed to generate new challenge"}

    def get_session_stats(self) -> Dict[str, Any]:
        """Get manager statistics"""
        with self._lock:
            ephemeral_count = len([s for s in self._sessions.keys() if s.startswith('ephemeral_')])
            return {
                'total_sessions': len(self._sessions),
                'ephemeral_sessions': ephemeral_count,
                'regular_sessions': len(self._sessions) - ephemeral_count,
                'active_sessions': len([s for s in self._sessions.values() if s.lives > 0])
            }


# Global session manager instance
_session_manager = None

def get_survival_session_manager() -> SurvivalSessionManager:
    """Get global survival session manager instance"""
    global _session_manager
    if _session_manager is None:
        _session_manager = SurvivalSessionManager()
    return _session_manager