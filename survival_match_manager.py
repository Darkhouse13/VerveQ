# File: survival_match_manager.py
"""
Survival Match Manager for VerveQ
Manages competitive match state, player tracking, and game flow
"""

import time
from typing import Dict, Any, Optional, List
import logging
from datetime import datetime
from sqlalchemy import text
from elo_system import EloRatingSystem

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class SurvivalMatchManager:
    """
    Manages competitive survival matches between two players.
    Handles match state, performance tracking, and result determination.
    """
    
    def __init__(self, db_path: str = 'difficulty_feedback.db'):
        """
        Initialize the match manager.
        
        Args:
            db_path: Path to the database file
        """
        self.elo_system = EloRatingSystem(db_path)
        self.active_matches: Dict[int, Dict[str, Any]] = {}
        self.match_sessions: Dict[str, int] = {}  # session_id -> match_id
        
    def create_competitive_match(self, player1_name: str, player2_name: str, 
                                session_id: str) -> Optional[Dict[str, Any]]:
        """
        Create a new competitive match between two players.
        
        Args:
            player1_name: Name of first player
            player2_name: Name of second player
            session_id: Unique session identifier
            
        Returns:
            Match information or None if error
        """
        try:
            # Get or create players to ensure they exist
            player1_id = self.elo_system.register_player(player1_name)
            player2_id = self.elo_system.register_player(player2_name)
            
            if not player1_id or not player2_id:
                logger.error("Failed to register players for competitive match")
                return None
            
            # Get player stats for initial display
            player1_stats = self.elo_system.get_player_stats(player1_name)
            player2_stats = self.elo_system.get_player_stats(player2_name)
            
            # Create match in database (initials will be set when first round starts)
            match_id = self.elo_system.create_match(player1_name, player2_name, "TBD")
            
            if not match_id:
                logger.error("Failed to create match in database")
                return None
            
            # Initialize match state
            match_state = {
                'match_id': match_id,
                'player1_name': player1_name,
                'player2_name': player2_name,
                'player1_id': player1_id,
                'player2_id': player2_id,
                'player1_stats': player1_stats,
                'player2_stats': player2_stats,
                'start_time': time.time(),
                'current_round': 0,
                'rounds_played': 0,
                'player1_lives': 3,
                'player2_lives': 3,
                'player1_lives_lost': 0,
                'player2_lives_lost': 0,
                'current_initials': None,
                'round_attempts': {'player1': False, 'player2': False},
                'match_status': 'active',
                'round_history': [],
                'performance_stats': {
                    'player1': {'correct_answers': 0, 'wrong_answers': 0, 'average_time': 0},
                    'player2': {'correct_answers': 0, 'wrong_answers': 0, 'average_time': 0}
                }
            }
            
            # Store match state
            self.active_matches[match_id] = match_state
            self.match_sessions[session_id] = match_id
            
            logger.info(f"Created competitive match {match_id}: {player1_name} vs {player2_name}")
            
            return {
                'match_id': match_id,
                'player1': {
                    'name': player1_name,
                    'elo': player1_stats['current_elo'],
                    'games_played': player1_stats['games_played'],
                    'win_percentage': player1_stats['win_percentage']
                },
                'player2': {
                    'name': player2_name,
                    'elo': player2_stats['current_elo'],
                    'games_played': player2_stats['games_played'],
                    'win_percentage': player2_stats['win_percentage']
                },
                'match_simulation': self.elo_system.simulate_match_outcome(player1_name, player2_name)
            }
            
        except Exception as e:
            logger.error(f"Error creating competitive match: {e}")
            return None
    
    def get_match_by_session(self, session_id: str) -> Optional[Dict[str, Any]]:
        """
        Get active match by session ID.
        
        Args:
            session_id: Session identifier
            
        Returns:
            Match state or None if not found
        """
        match_id = self.match_sessions.get(session_id)
        if match_id and match_id in self.active_matches:
            return self.active_matches[match_id]
        return None
    
    def start_round(self, session_id: str, initials: str) -> bool:
        """
        Start a new round with given initials.
        
        Args:
            session_id: Session identifier
            initials: The initials for this round
            
        Returns:
            True if successful, False otherwise
        """
        try:
            match_state = self.get_match_by_session(session_id)
            if not match_state:
                return False
            
            match_state['current_round'] += 1
            match_state['current_initials'] = initials
            match_state['round_attempts'] = {'player1': False, 'player2': False}
            match_state['round_start_time'] = time.time()
            
            # Update database with first initials if this is the first round
            if match_state['current_round'] == 1:
                try:
                    with self.elo_system.db.engine.connect() as conn:
                        conn.execute(text('''
                            UPDATE survival_matches SET initials = :initials WHERE id = :match_id
                        '''), {'initials': initials, 'match_id': match_state['match_id']})
                        conn.commit()
                except Exception as e:
                    logger.warning(f"Failed to update match initials: {e}")
            
            logger.info(f"Match {match_state['match_id']} round {match_state['current_round']} started with initials: {initials}")
            return True
            
        except Exception as e:
            logger.error(f"Error starting round: {e}")
            return False
    
    def track_answer_attempt(self, session_id: str, player_name: str, 
                           is_correct: bool, answer: str = "", time_taken: float = 0) -> Optional[Dict[str, Any]]:
        """
        Track a player's answer attempt.
        
        Args:
            session_id: Session identifier
            player_name: Name of the player
            is_correct: Whether the answer was correct
            answer: The answer given
            time_taken: Time taken to answer
            
        Returns:
            Updated match state or None if error
        """
        try:
            match_state = self.get_match_by_session(session_id)
            if not match_state or match_state['match_status'] != 'active':
                return None
            
            # Determine player number
            if player_name == match_state['player1_name']:
                player_key = 'player1'
                player_num = 1
            elif player_name == match_state['player2_name']:
                player_key = 'player2'
                player_num = 2
            else:
                logger.error(f"Unknown player: {player_name}")
                return None
            
            # Track the attempt
            match_state['round_attempts'][player_key] = True
            
            # Update performance stats
            perf_stats = match_state['performance_stats'][player_key]
            if is_correct:
                perf_stats['correct_answers'] += 1
            else:
                perf_stats['wrong_answers'] += 1
                # Reduce lives
                match_state[f'{player_key}_lives'] -= 1
                match_state[f'{player_key}_lives_lost'] += 1
            
            # Update average time
            total_attempts = perf_stats['correct_answers'] + perf_stats['wrong_answers']
            if total_attempts > 1:
                perf_stats['average_time'] = ((perf_stats['average_time'] * (total_attempts - 1)) + time_taken) / total_attempts
            else:
                perf_stats['average_time'] = time_taken
            
            # Record round event
            round_event = {
                'round': match_state['current_round'],
                'player': player_name,
                'answer': answer,
                'is_correct': is_correct,
                'time_taken': time_taken,
                'timestamp': time.time()
            }
            match_state['round_history'].append(round_event)
            
            # Check if player is eliminated
            if match_state[f'{player_key}_lives'] <= 0:
                match_state['match_status'] = 'finished'
                winner = 'player2' if player_key == 'player1' else 'player1'
                match_state['winner'] = winner
                match_state['result'] = f"{winner}_wins"
                
                # Finish match in database
                self._finish_match_in_db(match_state)
                
                logger.info(f"Match {match_state['match_id']} finished: {match_state[f'{winner}_name']} wins!")
            
            return match_state
            
        except Exception as e:
            logger.error(f"Error tracking answer attempt: {e}")
            return None
    
    def check_round_completion(self, session_id: str) -> Optional[Dict[str, str]]:
        """
        Check if current round should advance (both players attempted and failed).
        
        Args:
            session_id: Session identifier
            
        Returns:
            Round status information or None if error
        """
        try:
            match_state = self.get_match_by_session(session_id)
            if not match_state or match_state['match_status'] != 'active':
                return None
            
            attempts = match_state['round_attempts']
            
            # Check if both players have attempted
            if attempts['player1'] and attempts['player2']:
                # Both attempted - advance to next round
                return {
                    'status': 'advance',
                    'reason': 'both_attempted',
                    'message': 'Both players attempted - advancing to next round!'
                }
            
            # Check if only one player has lives remaining and the other attempted
            if match_state['player1_lives'] <= 0 or match_state['player2_lives'] <= 0:
                return {
                    'status': 'match_over',
                    'reason': 'elimination',
                    'message': 'Player eliminated!'
                }
            
            # Continue current round
            return {
                'status': 'continue',
                'reason': 'waiting_for_attempts',
                'message': 'Waiting for more attempts...'
            }
            
        except Exception as e:
            logger.error(f"Error checking round completion: {e}")
            return None
    
    def handle_round_timeout(self, session_id: str) -> Optional[Dict[str, Any]]:
        """
        Handle round timeout (time expired).
        
        Args:
            session_id: Session identifier
            
        Returns:
            Updated match state or None if error
        """
        try:
            match_state = self.get_match_by_session(session_id)
            if not match_state or match_state['match_status'] != 'active':
                return None
            
            # Record timeout event
            timeout_event = {
                'round': match_state['current_round'],
                'event': 'timeout',
                'timestamp': time.time()
            }
            match_state['round_history'].append(timeout_event)
            
            logger.info(f"Match {match_state['match_id']} round {match_state['current_round']} timed out")
            return match_state
            
        except Exception as e:
            logger.error(f"Error handling round timeout: {e}")
            return None
    
    def force_draw(self, session_id: str, reason: str = "mutual_agreement") -> Optional[Dict[str, Any]]:
        """
        Force a draw result for the match.
        
        Args:
            session_id: Session identifier
            reason: Reason for the draw
            
        Returns:
            Updated match state or None if error
        """
        try:
            match_state = self.get_match_by_session(session_id)
            if not match_state or match_state['match_status'] != 'active':
                return None
            
            match_state['match_status'] = 'finished'
            match_state['result'] = 'draw'
            match_state['draw_reason'] = reason
            
            # Finish match in database
            self._finish_match_in_db(match_state)
            
            logger.info(f"Match {match_state['match_id']} ended in draw: {reason}")
            return match_state
            
        except Exception as e:
            logger.error(f"Error forcing draw: {e}")
            return None
    
    def get_match_summary(self, session_id: str) -> Optional[Dict[str, Any]]:
        """
        Get comprehensive match summary.
        
        Args:
            session_id: Session identifier
            
        Returns:
            Match summary or None if error
        """
        try:
            match_state = self.get_match_by_session(session_id)
            if not match_state:
                return None
            
            # Calculate match duration
            if match_state['match_status'] == 'finished':
                duration = match_state.get('end_time', time.time()) - match_state['start_time']
            else:
                duration = time.time() - match_state['start_time']
            
            # Get final Elo ratings if match is finished
            final_ratings = {}
            if match_state['match_status'] == 'finished':
                player1_stats = self.elo_system.get_player_stats(match_state['player1_name'])
                player2_stats = self.elo_system.get_player_stats(match_state['player2_name'])
                if player1_stats and player2_stats:
                    final_ratings = {
                        'player1_final_elo': player1_stats['current_elo'],
                        'player2_final_elo': player2_stats['current_elo'],
                        'player1_elo_change': player1_stats['current_elo'] - match_state['player1_stats']['current_elo'],
                        'player2_elo_change': player2_stats['current_elo'] - match_state['player2_stats']['current_elo']
                    }
            
            summary = {
                'match_id': match_state['match_id'],
                'player1_name': match_state['player1_name'],
                'player2_name': match_state['player2_name'],
                'initial_elos': {
                    'player1': match_state['player1_stats']['current_elo'],
                    'player2': match_state['player2_stats']['current_elo']
                },
                'final_ratings': final_ratings,
                'match_status': match_state['match_status'],
                'result': match_state.get('result', 'ongoing'),
                'winner': match_state.get('winner'),
                'rounds_played': match_state['rounds_played'],
                'duration_seconds': int(duration),
                'duration_formatted': f"{int(duration // 60)}:{int(duration % 60):02d}",
                'lives_remaining': {
                    'player1': match_state['player1_lives'],
                    'player2': match_state['player2_lives']
                },
                'lives_lost': {
                    'player1': match_state['player1_lives_lost'],
                    'player2': match_state['player2_lives_lost']
                },
                'performance_stats': match_state['performance_stats'],
                'round_history': match_state['round_history']
            }
            
            return summary
            
        except Exception as e:
            logger.error(f"Error getting match summary: {e}")
            return None
    
    def cleanup_session(self, session_id: str) -> bool:
        """
        Clean up match session data.
        
        Args:
            session_id: Session identifier
            
        Returns:
            True if successful, False otherwise
        """
        try:
            match_id = self.match_sessions.get(session_id)
            if match_id:
                # Remove from active matches if finished
                if match_id in self.active_matches:
                    match_state = self.active_matches[match_id]
                    if match_state['match_status'] == 'finished':
                        del self.active_matches[match_id]
                
                # Remove session mapping
                del self.match_sessions[session_id]
                
                logger.info(f"Cleaned up session {session_id} for match {match_id}")
                return True
            
            return False
            
        except Exception as e:
            logger.error(f"Error cleaning up session {session_id}: {e}")
            return False
    
    def _finish_match_in_db(self, match_state: Dict[str, Any]) -> bool:
        """
        Finish the match in the database and calculate Elo changes.
        
        Args:
            match_state: Current match state
            
        Returns:
            True if successful, False otherwise
        """
        try:
            match_state['end_time'] = time.time()
            duration = int(match_state['end_time'] - match_state['start_time'])
            
            # Update rounds played count
            match_state['rounds_played'] = match_state['current_round']
            
            # Finish match in database
            result = self.elo_system.finish_match(
                match_state['match_id'],
                match_state.get('result', 'draw'),
                match_state['rounds_played'],
                duration,
                match_state['player1_lives_lost'],
                match_state['player2_lives_lost']
            )
            
            return result is not None
            
        except Exception as e:
            logger.error(f"Error finishing match in database: {e}")
            return False


if __name__ == "__main__":
    # Test the match manager
    import os
    
    manager = SurvivalMatchManager('test_match.db')
    
    print("=== Testing Survival Match Manager ===\n")
    
    # Test creating a competitive match
    match_info = manager.create_competitive_match("Alice", "Bob", "test_session_1")
    if match_info:
        print(f"Created match: {match_info['match_id']}")
        print(f"Players: {match_info['player1']['name']} (ELO: {match_info['player1']['elo']}) vs {match_info['player2']['name']} (ELO: {match_info['player2']['elo']})")
        
        # Test starting a round
        success = manager.start_round("test_session_1", "CR")
        print(f"Started round: {success}")
        
        # Test tracking answers
        result1 = manager.track_answer_attempt("test_session_1", "Alice", True, "Cristiano Ronaldo", 5.2)
        result2 = manager.track_answer_attempt("test_session_1", "Bob", False, "Carlos Rodriguez", 8.1)
        
        if result1 and result2:
            print("Tracked answer attempts successfully")
            
            # Check round completion
            round_status = manager.check_round_completion("test_session_1")
            print(f"Round status: {round_status}")
            
            # Get match summary
            summary = manager.get_match_summary("test_session_1")
            if summary:
                print(f"Match summary: Status={summary['match_status']}, Duration={summary['duration_formatted']}")
                print(f"Performance: Alice={summary['performance_stats']['player1']}, Bob={summary['performance_stats']['player2']}")
        
        # Clean up
        manager.cleanup_session("test_session_1")
    
    # Cleanup test database
    if os.path.exists('test_match.db'):
        os.remove('test_match.db')
    
    print("\n✅ All match manager tests completed!")