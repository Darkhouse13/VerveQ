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
                # Track used initials to avoid duplicates
                session.used_initials.add(challenge['initials'])
            
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
                # Track used initials to avoid duplicates
                session.used_initials.add(challenge['initials'])
                session.last_activity = time.time()
                return challenge
            
            return None
    
    def submit_answer(self, session_id: str, user_answer: str) -> Optional[Dict[str, Any]]:
        """Submit answer and return validation result"""
        with self._lock:
            session = self._sessions.get(session_id)
            if not session or not session.current_challenge:
                return None
            
            # Get all valid players for these initials (survival mode should accept ANY valid player)
            from sports import SportDataFactory
            generator = SportDataFactory.get_generator(session.sport)
            if not generator:
                return None
                
            survival_data = generator.get_survival_data()
            initials = session.current_challenge['initials']
            
            # Check if user answer matches ANY valid player with these initials
            result = None
            best_similarity = 0.0
            matching_player = None
            
            if initials in survival_data:
                valid_players = survival_data[initials]
                
                for valid_player in valid_players:
                    # Create a test challenge with this valid player
                    test_challenge = {
                        'initials': initials,
                        'correct_answer': valid_player,
                        'sport': session.sport
                    }
                    
                    # Test if user answer matches this player
                    test_result = self._survival_engine.validate_answer(test_challenge, user_answer)
                    
                    # Track best similarity for feedback
                    if test_result['similarity'] > best_similarity:
                        best_similarity = test_result['similarity']
                        matching_player = valid_player
                    
                    # If we found a match, use this result
                    if test_result['is_correct']:
                        result = test_result
                        matching_player = valid_player
                        break
            
            # If no match found, create a result showing the best match
            if not result:
                result = {
                    'is_correct': False,
                    'similarity': best_similarity,
                    'correct_answer': matching_player or session.current_challenge['correct_answer'],
                    'user_answer': user_answer
                }
            
            if result['is_correct']:
                session.score += 1
            else:
                session.lives -= 1
                result['lives_remaining'] = session.lives
                
                # Check if game over
                if session.lives <= 0:
                    result['game_over'] = True
                    # Keep session for final score display but mark as ended
                    session.current_challenge = None
                    session.last_activity = time.time()
                    return result
            
            # Always advance to next round for multiplayer sync (unless game over)
            session.round += 1
            result['next_round'] = True
            
            # Generate new challenge for next round
            challenge = self._survival_engine.generate_challenge(session.round, session.sport, session.used_initials)
            if challenge:
                session.current_challenge = challenge
                result['next_challenge'] = challenge
                # Track used initials to avoid duplicates
                session.used_initials.add(challenge['initials'])
            
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
        
        # If correct, use next challenge already generated by submit_answer
        if result and result.get('is_correct') and result.get('next_round'):
            # Use the next_challenge already generated by submit_answer
            next_challenge = result.get('next_challenge')
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
            
            # Advance to next round for multiplayer sync
            session.round += 1
            
            # Generate new challenge for next round
            challenge = self._survival_engine.generate_challenge(
                session.round, session.sport, session.used_initials
            )
            
            if challenge:
                session.current_challenge = challenge
                return {
                    "lives": session.lives,
                    "score": session.score,
                    "round": session.round,
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
_session_manager_lock = Lock()

def get_survival_session_manager() -> SurvivalSessionManager:
    """Get global survival session manager instance (thread-safe)"""
    global _session_manager
    
    # First check without lock (performance optimization)
    if _session_manager is None:
        # Acquire lock for thread safety
        with _session_manager_lock:
            # Double-check inside lock (another thread may have created it)
            if _session_manager is None:
                _session_manager = SurvivalSessionManager()
    
    return _session_manager