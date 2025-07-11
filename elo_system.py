# File: elo_system.py
"""
Elo Rating System for VerveQ Survival Mode
Implements competitive ranking with draws and safeguards
"""

import math
from typing import Dict, Any, Optional, Tuple
import logging
from datetime import datetime
from sqlalchemy import text
from difficulty_feedback_database import DifficultyFeedbackDatabase

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class EloRatingSystem:
    """
    Core Elo rating calculation and management system.
    Handles rating updates, match results, and player statistics.
    """
    
    def __init__(self, db_path: str = 'difficulty_feedback.db'):
        """
        Initialize the Elo rating system.
        
        Args:
            db_path: Path to the SQLite database file
        """
        self.db = DifficultyFeedbackDatabase(db_path)
        self.default_elo = 1200
        self.rating_floor = 800
        self.rating_ceiling = 3000
        self.max_change_per_match = 50
        
    def get_k_factor(self, games_played: int) -> int:
        """
        Calculate K-factor based on player experience.
        
        Args:
            games_played: Number of games the player has played
            
        Returns:
            K-factor for rating calculation
        """
        if games_played < 10:
            return 32  # New players get higher K-factor for faster calibration
        elif games_played < 30:
            return 24  # Intermediate players
        else:
            return 16  # Experienced players
    
    def calculate_expected_score(self, player_elo: int, opponent_elo: int) -> float:
        """
        Calculate expected score for a player against opponent.
        
        Args:
            player_elo: Player's current Elo rating
            opponent_elo: Opponent's current Elo rating
            
        Returns:
            Expected score (0.0 to 1.0)
        """
        return 1 / (1 + 10 ** ((opponent_elo - player_elo) / 400))
    
    def calculate_rating_change(self, player_elo: int, opponent_elo: int, 
                               actual_score: float, games_played: int) -> int:
        """
        Calculate the rating change for a player after a match.
        
        Args:
            player_elo: Player's current Elo rating
            opponent_elo: Opponent's current Elo rating
            actual_score: Actual match result (1.0 = win, 0.5 = draw, 0.0 = loss)
            games_played: Number of games the player has played
            
        Returns:
            Rating change (positive or negative)
        """
        expected_score = self.calculate_expected_score(player_elo, opponent_elo)
        k_factor = self.get_k_factor(games_played)
        
        change = k_factor * (actual_score - expected_score)
        return int(round(change))
    
    def apply_rating_limits(self, old_elo: int, new_elo: int) -> int:
        """
        Apply rating floor, ceiling, and maximum change limits.
        
        Args:
            old_elo: Previous Elo rating
            new_elo: Calculated new Elo rating
            
        Returns:
            Limited new Elo rating
        """
        # First apply maximum change limit
        change = new_elo - old_elo
        if abs(change) > self.max_change_per_match:
            limited_elo = old_elo + (self.max_change_per_match if change > 0 else -self.max_change_per_match)
        else:
            limited_elo = new_elo
        
        # Then apply floor and ceiling (these override max change if necessary)
        limited_elo = max(self.rating_floor, min(self.rating_ceiling, limited_elo))
        
        return limited_elo
    
    def register_player(self, player_name: str) -> Optional[int]:
        """
        Register a new player or get existing player ID.
        
        Args:
            player_name: Name of the player
            
        Returns:
            Player ID or None if error
        """
        return self.db.get_or_create_player(player_name)
    
    def get_player_stats(self, player_name: str) -> Optional[Dict[str, Any]]:
        """
        Get comprehensive player statistics.
        
        Args:
            player_name: Name of the player
            
        Returns:
            Player statistics dictionary or None if not found
        """
        return self.db.get_player_stats(player_name)
    
    def create_match(self, player1_name: str, player2_name: str, initials: str) -> Optional[int]:
        """
        Create a new competitive match between two players.
        
        Args:
            player1_name: Name of first player
            player2_name: Name of second player
            initials: The initials being played
            
        Returns:
            Match ID or None if error
        """
        return self.db.create_match(player1_name, player2_name, initials)
    
    def finish_match(self, match_id: int, result: str, rounds_played: int, 
                    match_duration: int, player1_lives_lost: int = 0, 
                    player2_lives_lost: int = 0) -> Optional[Dict[str, Any]]:
        """
        Finish a match and calculate Elo changes.
        
        Args:
            match_id: ID of the match
            result: Match result ('player1_wins', 'player2_wins', 'draw')
            rounds_played: Number of rounds played
            match_duration: Duration in seconds
            player1_lives_lost: Lives lost by player 1
            player2_lives_lost: Lives lost by player 2
            
        Returns:
            Dictionary with match results and Elo changes, or None if error
        """
        try:
            # Determine winner ID based on result
            if result == 'player1_wins':
                # Get player IDs from match
                with self.db.engine.connect() as conn:
                    match_result = conn.execute(text('''
                        SELECT player1_id, player2_id FROM survival_matches WHERE id = :match_id
                    '''), {'match_id': match_id})
                    match_row = match_result.fetchone()
                    if not match_row:
                        return None
                    winner_id = match_row[0]
            elif result == 'player2_wins':
                with self.db.engine.connect() as conn:
                    match_result = conn.execute(text('''
                        SELECT player1_id, player2_id FROM survival_matches WHERE id = :match_id
                    '''), {'match_id': match_id})
                    match_row = match_result.fetchone()
                    if not match_row:
                        return None
                    winner_id = match_row[1]
            else:  # draw
                winner_id = None
            
            # Finish the match in database
            success = self.db.finish_match(
                match_id, winner_id, rounds_played, match_duration,
                player1_lives_lost, player2_lives_lost
            )
            
            if success:
                # Get updated match information for return
                with self.db.engine.connect() as conn:
                    result = conn.execute(text('''
                        SELECT m.*, p1.player_name as player1_name, p2.player_name as player2_name,
                               p1.current_elo as player1_elo, p2.current_elo as player2_elo
                        FROM survival_matches m
                        JOIN survival_players p1 ON m.player1_id = p1.id
                        JOIN survival_players p2 ON m.player2_id = p2.id
                        WHERE m.id = :match_id
                    '''), {'match_id': match_id})
                    
                    match_data = result.fetchone()
                    if match_data:
                        columns = result.keys()
                        return dict(zip(columns, match_data))
            
            return None
            
        except Exception as e:
            logger.error(f"Error finishing match {match_id}: {e}")
            return None
    
    def get_leaderboard(self, limit: int = 10) -> list[Dict[str, Any]]:
        """
        Get current leaderboard.
        
        Args:
            limit: Number of top players to return
            
        Returns:
            List of player records sorted by Elo rating
        """
        return self.db.get_leaderboard(limit)
    
    def get_player_rank(self, player_name: str) -> Optional[int]:
        """
        Get a player's current rank.
        
        Args:
            player_name: Name of the player
            
        Returns:
            Player's rank (1-based) or None if not found
        """
        try:
            player_stats = self.get_player_stats(player_name)
            if not player_stats:
                return None
            
            player_elo = player_stats['current_elo']
            
            with self.db.engine.connect() as conn:
                result = conn.execute(text('''
                    SELECT COUNT(*) + 1 as rank
                    FROM survival_players
                    WHERE current_elo > :player_elo AND games_played > 0
                '''), {'player_elo': player_elo})
                
                rank_row = result.fetchone()
                return rank_row[0] if rank_row else None
                
        except Exception as e:
            logger.error(f"Error getting rank for {player_name}: {e}")
            return None
    
    def get_match_history(self, player_name: str, limit: int = 10) -> list[Dict[str, Any]]:
        """
        Get recent match history for a player.
        
        Args:
            player_name: Name of the player
            limit: Number of recent matches to return
            
        Returns:
            List of match records
        """
        try:
            with self.db.engine.connect() as conn:
                result = conn.execute(text('''
                    SELECT m.*, 
                           p1.player_name as player1_name, p2.player_name as player2_name,
                           CASE 
                               WHEN m.winner_id = p1.id THEN 'player1_wins'
                               WHEN m.winner_id = p2.id THEN 'player2_wins'
                               ELSE 'draw'
                           END as result,
                           CASE
                               WHEN p1.player_name = :player_name THEN 
                                   CASE WHEN m.winner_id = p1.id THEN 'win'
                                        WHEN m.winner_id = p2.id THEN 'loss'
                                        ELSE 'draw' END
                               ELSE
                                   CASE WHEN m.winner_id = p2.id THEN 'win'
                                        WHEN m.winner_id = p1.id THEN 'loss'
                                        ELSE 'draw' END
                           END as player_result
                    FROM survival_matches m
                    JOIN survival_players p1 ON m.player1_id = p1.id
                    JOIN survival_players p2 ON m.player2_id = p2.id
                    WHERE p1.player_name = :player_name OR p2.player_name = :player_name
                    ORDER BY m.timestamp DESC
                    LIMIT :limit
                '''), {'player_name': player_name, 'limit': limit})
                
                columns = result.keys()
                return [dict(zip(columns, row)) for row in result.fetchall()]
                
        except Exception as e:
            logger.error(f"Error getting match history for {player_name}: {e}")
            return []
    
    def simulate_match_outcome(self, player1_name: str, player2_name: str) -> Dict[str, Any]:
        """
        Simulate potential Elo changes for different match outcomes.
        
        Args:
            player1_name: Name of first player
            player2_name: Name of second player
            
        Returns:
            Dictionary with potential Elo changes for each outcome
        """
        try:
            player1_stats = self.get_player_stats(player1_name)
            player2_stats = self.get_player_stats(player2_name)
            
            if not player1_stats or not player2_stats:
                return {}
            
            p1_elo = player1_stats['current_elo']
            p2_elo = player2_stats['current_elo']
            p1_games = player1_stats['games_played']
            p2_games = player2_stats['games_played']
            
            # Calculate potential changes for each outcome
            outcomes = {}
            
            # Player 1 wins
            p1_change_win = self.calculate_rating_change(p1_elo, p2_elo, 1.0, p1_games)
            p2_change_loss = self.calculate_rating_change(p2_elo, p1_elo, 0.0, p2_games)
            outcomes['player1_wins'] = {
                'player1_change': p1_change_win,
                'player2_change': p2_change_loss,
                'player1_new_elo': self.apply_rating_limits(p1_elo, p1_elo + p1_change_win),
                'player2_new_elo': self.apply_rating_limits(p2_elo, p2_elo + p2_change_loss)
            }
            
            # Player 2 wins
            p1_change_loss = self.calculate_rating_change(p1_elo, p2_elo, 0.0, p1_games)
            p2_change_win = self.calculate_rating_change(p2_elo, p1_elo, 1.0, p2_games)
            outcomes['player2_wins'] = {
                'player1_change': p1_change_loss,
                'player2_change': p2_change_win,
                'player1_new_elo': self.apply_rating_limits(p1_elo, p1_elo + p1_change_loss),
                'player2_new_elo': self.apply_rating_limits(p2_elo, p2_elo + p2_change_win)
            }
            
            # Draw
            p1_change_draw = self.calculate_rating_change(p1_elo, p2_elo, 0.5, p1_games)
            p2_change_draw = self.calculate_rating_change(p2_elo, p1_elo, 0.5, p2_games)
            outcomes['draw'] = {
                'player1_change': p1_change_draw,
                'player2_change': p2_change_draw,
                'player1_new_elo': self.apply_rating_limits(p1_elo, p1_elo + p1_change_draw),
                'player2_new_elo': self.apply_rating_limits(p2_elo, p2_elo + p2_change_draw)
            }
            
            # Add match probability
            p1_expected = self.calculate_expected_score(p1_elo, p2_elo)
            outcomes['probabilities'] = {
                'player1_win_probability': p1_expected,
                'player2_win_probability': 1 - p1_expected,
                'draw_probability': 0.1  # Estimated based on game mechanics
            }
            
            return outcomes
            
        except Exception as e:
            logger.error(f"Error simulating match between {player1_name} and {player2_name}: {e}")
            return {}


if __name__ == "__main__":
    # Test the Elo rating system
    elo_system = EloRatingSystem('test_elo.db')
    
    print("=== Testing Elo Rating System ===\n")
    
    # Test player registration
    player1_id = elo_system.register_player("TestPlayer1")
    player2_id = elo_system.register_player("TestPlayer2")
    print(f"Registered players: {player1_id}, {player2_id}")
    
    # Test getting player stats
    stats1 = elo_system.get_player_stats("TestPlayer1")
    stats2 = elo_system.get_player_stats("TestPlayer2")
    print(f"Player 1 stats: {stats1}")
    print(f"Player 2 stats: {stats2}")
    
    # Test match simulation
    simulation = elo_system.simulate_match_outcome("TestPlayer1", "TestPlayer2")
    print(f"Match simulation: {simulation}")
    
    # Test creating and finishing a match
    match_id = elo_system.create_match("TestPlayer1", "TestPlayer2", "CR")
    if match_id:
        print(f"Created match: {match_id}")
        
        # Finish match with player 1 winning
        result = elo_system.finish_match(match_id, "player1_wins", 5, 120, 0, 3)
        if result:
            print(f"Match finished: {result}")
    
    # Test leaderboard
    leaderboard = elo_system.get_leaderboard(5)
    print(f"Leaderboard: {leaderboard}")
    
    # Test player rank
    rank = elo_system.get_player_rank("TestPlayer1")
    print(f"Player 1 rank: {rank}")
    
    # Cleanup
    import os
    if os.path.exists('test_elo.db'):
        os.remove('test_elo.db')
    
    print("\n✅ All Elo system tests completed!")