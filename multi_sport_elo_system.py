"""
Multi-Sport Elo Rating System for VerveQ
Extends the existing Elo system to support sport-specific ratings
"""

import math
from typing import Dict, Any, Optional, Tuple, List
import logging
from datetime import datetime
from sqlalchemy import text, create_engine, MetaData, Table, Column, Integer, String, Float, DateTime
from sqlalchemy.pool import StaticPool
import os

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class MultiSportEloSystem:
    """
    Enhanced Elo rating system supporting multiple sports.
    Each player has separate ratings for each sport.
    """
    
    def __init__(self, db_path: str = 'multi_sport_elo.db'):
        """
        Initialize the multi-sport Elo rating system.
        
        Args:
            db_path: Path to the SQLite database file
        """
        # Database setup
        self.database_url = os.environ.get("DATABASE_URL", f"sqlite:///./{db_path}")
        self.db_path = db_path
        
        engine_args = {}
        if self.database_url.startswith("sqlite"):
            engine_args["connect_args"] = {"check_same_thread": False}
            engine_args["poolclass"] = StaticPool
        
        self.engine = create_engine(self.database_url, **engine_args)
        
        # Elo system parameters
        self.default_elo = 1200
        self.rating_floor = 800
        self.rating_ceiling = 3000
        self.max_change_per_match = 50
        
        # Initialize database schema
        self.init_database()
    
    def init_database(self):
        """Initialize the database schema for multi-sport Elo ratings."""
        try:
            with self.engine.connect() as conn:
                # Determine if we're using PostgreSQL or SQLite
                is_postgresql = 'postgresql' in self.database_url.lower()
                
                # Choose appropriate syntax for auto-increment primary key
                if is_postgresql:
                    pk_syntax = "id SERIAL PRIMARY KEY"
                    timestamp_default = "TIMESTAMP DEFAULT CURRENT_TIMESTAMP"
                else:
                    pk_syntax = "id INTEGER PRIMARY KEY AUTOINCREMENT"
                    timestamp_default = "TIMESTAMP DEFAULT CURRENT_TIMESTAMP"
                
                # Create players table (stores basic player info)
                conn.execute(text(f'''
                    CREATE TABLE IF NOT EXISTS players (
                        {pk_syntax},
                        name TEXT UNIQUE NOT NULL,
                        created_at {timestamp_default},
                        last_active {timestamp_default}
                    )
                '''))
                
                # Create sport_ratings table (stores per-sport ratings)
                conn.execute(text(f'''
                    CREATE TABLE IF NOT EXISTS sport_ratings (
                        {pk_syntax},
                        player_id INTEGER NOT NULL,
                        sport TEXT NOT NULL,
                        current_elo INTEGER DEFAULT 1200,
                        peak_elo INTEGER DEFAULT 1200,
                        games_played INTEGER DEFAULT 0,
                        wins INTEGER DEFAULT 0,
                        losses INTEGER DEFAULT 0,
                        draws INTEGER DEFAULT 0,
                        win_streak INTEGER DEFAULT 0,
                        loss_streak INTEGER DEFAULT 0,
                        last_match {timestamp_default},
                        created_at {timestamp_default},
                        updated_at {timestamp_default},
                        UNIQUE(player_id, sport)
                    )
                '''))
                
                # Create sport_matches table (stores match history per sport)
                conn.execute(text(f'''
                    CREATE TABLE IF NOT EXISTS sport_matches (
                        {pk_syntax},
                        sport TEXT NOT NULL,
                        player1_id INTEGER NOT NULL,
                        player2_id INTEGER NOT NULL,
                        result TEXT NOT NULL,
                        player1_elo_before INTEGER NOT NULL,
                        player2_elo_before INTEGER NOT NULL,
                        player1_elo_after INTEGER NOT NULL,
                        player2_elo_after INTEGER NOT NULL,
                        player1_elo_change INTEGER NOT NULL,
                        player2_elo_change INTEGER NOT NULL,
                        rounds_played INTEGER DEFAULT 0,
                        match_duration INTEGER DEFAULT 0,
                        player1_lives_lost INTEGER DEFAULT 0,
                        player2_lives_lost INTEGER DEFAULT 0,
                        initials TEXT,
                        session_id TEXT,
                        created_at {timestamp_default}
                    )
                '''))
                
                # Create indices for better performance
                conn.execute(text('CREATE INDEX IF NOT EXISTS idx_sport_ratings_sport ON sport_ratings (sport)'))
                conn.execute(text('CREATE INDEX IF NOT EXISTS idx_sport_ratings_elo ON sport_ratings (sport, current_elo DESC)'))
                conn.execute(text('CREATE INDEX IF NOT EXISTS idx_sport_matches_sport ON sport_matches (sport)'))
                conn.execute(text('CREATE INDEX IF NOT EXISTS idx_sport_matches_players ON sport_matches (player1_id, player2_id)'))
                
                conn.commit()
                logger.info("Multi-sport Elo database initialized successfully")
                
        except Exception as e:
            logger.error(f"Error initializing multi-sport Elo database: {e}")
            raise
    
    def get_k_factor(self, games_played: int) -> int:
        """
        Calculate K-factor based on player experience.
        
        Args:
            games_played: Number of games the player has played in this sport
            
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
        """Calculate expected score for a player against opponent."""
        return 1 / (1 + 10 ** ((opponent_elo - player_elo) / 400))
    
    def calculate_rating_change(self, player_elo: int, opponent_elo: int, 
                               actual_score: float, games_played: int) -> int:
        """Calculate the rating change for a player after a match."""
        expected_score = self.calculate_expected_score(player_elo, opponent_elo)
        k_factor = self.get_k_factor(games_played)
        change = k_factor * (actual_score - expected_score)
        return int(round(change))
    
    def apply_rating_limits(self, old_elo: int, new_elo: int) -> int:
        """Apply rating floor, ceiling, and maximum change limits."""
        # Apply maximum change limit
        change = new_elo - old_elo
        if abs(change) > self.max_change_per_match:
            change = self.max_change_per_match if change > 0 else -self.max_change_per_match
            new_elo = old_elo + change
        
        # Apply floor and ceiling
        return max(self.rating_floor, min(self.rating_ceiling, new_elo))
    
    def register_player(self, player_name: str) -> Optional[int]:
        """
        Register a new player or get existing player ID.
        
        Args:
            player_name: Name of the player
            
        Returns:
            Player ID or None if error
        """
        try:
            with self.engine.connect() as conn:
                # Check if player already exists
                result = conn.execute(text('''
                    SELECT id FROM players WHERE name = :name
                '''), {'name': player_name})
                
                existing_player = result.fetchone()
                if existing_player:
                    # Update last active timestamp
                    conn.execute(text('''
                        UPDATE players SET last_active = CURRENT_TIMESTAMP WHERE id = :id
                    '''), {'id': existing_player[0]})
                    conn.commit()
                    return existing_player[0]
                
                # Create new player
                result = conn.execute(text('''
                    INSERT INTO players (name) VALUES (:name)
                '''), {'name': player_name})
                
                player_id = result.lastrowid
                conn.commit()
                
                logger.info(f"Registered new player: {player_name} (ID: {player_id})")
                return player_id
                
        except Exception as e:
            logger.error(f"Error registering player {player_name}: {e}")
            return None
    
    def get_or_create_sport_rating(self, player_id: int, sport: str) -> Dict[str, Any]:
        """
        Get or create sport-specific rating for a player.
        
        Args:
            player_id: Player ID
            sport: Sport name
            
        Returns:
            Sport rating data or None if error
        """
        try:
            with self.engine.connect() as conn:
                # Check if sport rating exists
                result = conn.execute(text('''
                    SELECT * FROM sport_ratings WHERE player_id = :player_id AND sport = :sport
                '''), {'player_id': player_id, 'sport': sport})
                
                existing_rating = result.fetchone()
                if existing_rating:
                    return {
                        'player_id': existing_rating[1],
                        'sport': existing_rating[2],
                        'current_elo': existing_rating[3],
                        'peak_elo': existing_rating[4],
                        'games_played': existing_rating[5],
                        'wins': existing_rating[6],
                        'losses': existing_rating[7],
                        'draws': existing_rating[8],
                        'win_streak': existing_rating[9],
                        'loss_streak': existing_rating[10]
                    }
                
                # Create new sport rating
                conn.execute(text('''
                    INSERT INTO sport_ratings (player_id, sport, current_elo, peak_elo)
                    VALUES (:player_id, :sport, :elo, :elo)
                '''), {'player_id': player_id, 'sport': sport, 'elo': self.default_elo})
                
                conn.commit()
                
                return {
                    'player_id': player_id,
                    'sport': sport,
                    'current_elo': self.default_elo,
                    'peak_elo': self.default_elo,
                    'games_played': 0,
                    'wins': 0,
                    'losses': 0,
                    'draws': 0,
                    'win_streak': 0,
                    'loss_streak': 0
                }
                
        except Exception as e:
            logger.error(f"Error getting/creating sport rating for player {player_id}, sport {sport}: {e}")
            return None
    
    def get_player_stats(self, player_name: str, sport: str) -> Optional[Dict[str, Any]]:
        """
        Get comprehensive player statistics for a specific sport.
        
        Args:
            player_name: Name of the player
            sport: Sport name
            
        Returns:
            Player statistics or None if not found
        """
        try:
            with self.engine.connect() as conn:
                result = conn.execute(text('''
                    SELECT p.id, p.name, sr.current_elo, sr.peak_elo, sr.games_played,
                           sr.wins, sr.losses, sr.draws, sr.win_streak, sr.loss_streak,
                           sr.last_match, sr.created_at
                    FROM players p
                    LEFT JOIN sport_ratings sr ON p.id = sr.player_id AND sr.sport = :sport
                    WHERE p.name = :name
                '''), {'name': player_name, 'sport': sport})
                
                player_data = result.fetchone()
                if not player_data:
                    return None
                
                player_id = player_data[0]
                
                # If no sport rating exists, create one
                if player_data[2] is None:  # current_elo is None
                    sport_rating = self.get_or_create_sport_rating(player_id, sport)
                    if not sport_rating:
                        return None
                    
                    return {
                        'player_id': player_id,
                        'name': player_name,
                        'sport': sport,
                        'current_elo': sport_rating['current_elo'],
                        'peak_elo': sport_rating['peak_elo'],
                        'games_played': sport_rating['games_played'],
                        'wins': sport_rating['wins'],
                        'losses': sport_rating['losses'],
                        'draws': sport_rating['draws'],
                        'win_percentage': 0.0,
                        'win_streak': sport_rating['win_streak'],
                        'loss_streak': sport_rating['loss_streak'],
                        'rank': None
                    }
                
                # Calculate win percentage
                total_games = player_data[5] + player_data[6] + player_data[7]  # wins + losses + draws
                win_percentage = (player_data[5] / total_games * 100) if total_games > 0 else 0.0
                
                # Get rank
                rank = self.get_player_rank(player_name, sport)
                
                return {
                    'player_id': player_id,
                    'name': player_name,
                    'sport': sport,
                    'current_elo': player_data[2],
                    'peak_elo': player_data[3],
                    'games_played': player_data[4],
                    'wins': player_data[5],
                    'losses': player_data[6],
                    'draws': player_data[7],
                    'win_percentage': round(win_percentage, 1),
                    'win_streak': player_data[8],
                    'loss_streak': player_data[9],
                    'last_match': player_data[10],
                    'created_at': player_data[11],
                    'rank': rank
                }
                
        except Exception as e:
            logger.error(f"Error getting player stats for {player_name} in {sport}: {e}")
            return None
    
    def get_leaderboard(self, sport: str, limit: int = 10) -> List[Dict[str, Any]]:
        """
        Get leaderboard for a specific sport.
        
        Args:
            sport: Sport name
            limit: Maximum number of players to return
            
        Returns:
            List of player statistics sorted by Elo rating
        """
        try:
            with self.engine.connect() as conn:
                result = conn.execute(text('''
                    SELECT p.name, sr.current_elo, sr.peak_elo, sr.games_played,
                           sr.wins, sr.losses, sr.draws, sr.win_streak
                    FROM sport_ratings sr
                    JOIN players p ON sr.player_id = p.id
                    WHERE sr.sport = :sport AND sr.games_played > 0
                    ORDER BY sr.current_elo DESC
                    LIMIT :limit
                '''), {'sport': sport, 'limit': limit})
                
                leaderboard = []
                for i, row in enumerate(result.fetchall(), 1):
                    total_games = row[4] + row[5] + row[6]  # wins + losses + draws
                    win_percentage = (row[4] / total_games * 100) if total_games > 0 else 0.0
                    
                    leaderboard.append({
                        'rank': i,
                        'name': row[0],
                        'sport': sport,
                        'current_elo': row[1],
                        'peak_elo': row[2],
                        'games_played': row[3],
                        'wins': row[4],
                        'losses': row[5],
                        'draws': row[6],
                        'win_percentage': round(win_percentage, 1),
                        'win_streak': row[7]
                    })
                
                return leaderboard
                
        except Exception as e:
            logger.error(f"Error getting leaderboard for {sport}: {e}")
            return []
    
    def get_player_rank(self, player_name: str, sport: str) -> Optional[int]:
        """Get a player's rank in a specific sport."""
        try:
            with self.engine.connect() as conn:
                result = conn.execute(text('''
                    SELECT COUNT(*) + 1 as rank
                    FROM sport_ratings sr1
                    JOIN players p1 ON sr1.player_id = p1.id
                    JOIN sport_ratings sr2 ON sr2.sport = sr1.sport
                    JOIN players p2 ON sr2.player_id = p2.id
                    WHERE p2.name = :name AND sr2.sport = :sport
                    AND sr1.current_elo > sr2.current_elo
                    AND sr1.games_played > 0
                '''), {'name': player_name, 'sport': sport})
                
                rank_data = result.fetchone()
                return rank_data[0] if rank_data else None
                
        except Exception as e:
            logger.error(f"Error getting rank for {player_name} in {sport}: {e}")
            return None
    
    def create_match(self, player1_name: str, player2_name: str, sport: str, initials: str = "") -> Optional[int]:
        """
        Create a new match record.
        
        Args:
            player1_name: Name of first player
            player2_name: Name of second player
            sport: Sport name
            initials: Match initials (for survival mode)
            
        Returns:
            Match ID or None if error
        """
        try:
            # Get or create players
            player1_id = self.register_player(player1_name)
            player2_id = self.register_player(player2_name)
            
            if not player1_id or not player2_id:
                return None
            
            # Get current ratings
            player1_stats = self.get_player_stats(player1_name, sport)
            player2_stats = self.get_player_stats(player2_name, sport)
            
            if not player1_stats or not player2_stats:
                return None
            
            with self.engine.connect() as conn:
                result = conn.execute(text('''
                    INSERT INTO sport_matches (
                        sport, player1_id, player2_id, result,
                        player1_elo_before, player2_elo_before,
                        player1_elo_after, player2_elo_after,
                        player1_elo_change, player2_elo_change,
                        initials
                    ) VALUES (
                        :sport, :player1_id, :player2_id, 'ongoing',
                        :player1_elo, :player2_elo,
                        :player1_elo, :player2_elo,
                        0, 0, :initials
                    )
                '''), {
                    'sport': sport,
                    'player1_id': player1_id,
                    'player2_id': player2_id,
                    'player1_elo': player1_stats['current_elo'],
                    'player2_elo': player2_stats['current_elo'],
                    'initials': initials
                })
                
                match_id = result.lastrowid
                conn.commit()
                
                logger.info(f"Created {sport} match {match_id}: {player1_name} vs {player2_name}")
                return match_id
                
        except Exception as e:
            logger.error(f"Error creating match: {e}")
            return None
    
    def finish_match(self, match_id: int, result: str, rounds_played: int = 0, 
                     match_duration: int = 0, player1_lives_lost: int = 0, 
                     player2_lives_lost: int = 0) -> Optional[Dict[str, Any]]:
        """
        Finish a match and update player ratings.
        
        Args:
            match_id: Match ID
            result: Match result ('player1_wins', 'player2_wins', 'draw')
            rounds_played: Number of rounds played
            match_duration: Match duration in seconds
            player1_lives_lost: Lives lost by player 1
            player2_lives_lost: Lives lost by player 2
            
        Returns:
            Match summary with rating changes or None if error
        """
        try:
            with self.engine.connect() as conn:
                # Get match data
                match_result = conn.execute(text('''
                    SELECT sport, player1_id, player2_id, player1_elo_before, player2_elo_before
                    FROM sport_matches WHERE id = :match_id
                '''), {'match_id': match_id})
                
                match_data = match_result.fetchone()
                if not match_data:
                    logger.error(f"Match {match_id} not found")
                    return None
                
                sport, player1_id, player2_id, player1_elo_before, player2_elo_before = match_data
                
                # Get player stats
                player1_result = conn.execute(text('''
                    SELECT sr.games_played FROM sport_ratings sr WHERE sr.player_id = :id AND sr.sport = :sport
                '''), {'id': player1_id, 'sport': sport})
                player1_games = player1_result.fetchone()[0] if player1_result.fetchone() else 0
                
                player2_result = conn.execute(text('''
                    SELECT sr.games_played FROM sport_ratings sr WHERE sr.player_id = :id AND sr.sport = :sport
                '''), {'id': player2_id, 'sport': sport})
                player2_games = player2_result.fetchone()[0] if player2_result.fetchone() else 0
                
                # Calculate scores based on result
                if result == 'player1_wins':
                    player1_score, player2_score = 1.0, 0.0
                elif result == 'player2_wins':
                    player1_score, player2_score = 0.0, 1.0
                else:  # draw
                    player1_score, player2_score = 0.5, 0.5
                
                # Calculate rating changes
                player1_change = self.calculate_rating_change(
                    player1_elo_before, player2_elo_before, player1_score, player1_games
                )
                player2_change = self.calculate_rating_change(
                    player2_elo_before, player1_elo_before, player2_score, player2_games
                )
                
                # Apply limits and calculate new ratings
                player1_elo_after = self.apply_rating_limits(player1_elo_before, player1_elo_before + player1_change)
                player2_elo_after = self.apply_rating_limits(player2_elo_before, player2_elo_before + player2_change)
                
                # Recalculate actual changes after limits
                player1_change = player1_elo_after - player1_elo_before
                player2_change = player2_elo_after - player2_elo_before
                
                # Update match record
                conn.execute(text('''
                    UPDATE sport_matches SET
                        result = :result,
                        player1_elo_after = :p1_elo_after,
                        player2_elo_after = :p2_elo_after,
                        player1_elo_change = :p1_change,
                        player2_elo_change = :p2_change,
                        rounds_played = :rounds,
                        match_duration = :duration,
                        player1_lives_lost = :p1_lives,
                        player2_lives_lost = :p2_lives
                    WHERE id = :match_id
                '''), {
                    'result': result,
                    'p1_elo_after': player1_elo_after,
                    'p2_elo_after': player2_elo_after,
                    'p1_change': player1_change,
                    'p2_change': player2_change,
                    'rounds': rounds_played,
                    'duration': match_duration,
                    'p1_lives': player1_lives_lost,
                    'p2_lives': player2_lives_lost,
                    'match_id': match_id
                })
                
                # Update player ratings
                self._update_player_rating(conn, player1_id, sport, player1_elo_after, player1_score)
                self._update_player_rating(conn, player2_id, sport, player2_elo_after, player2_score)
                
                conn.commit()
                
                return {
                    'match_id': match_id,
                    'sport': sport,
                    'result': result,
                    'player1_rating_change': player1_change,
                    'player2_rating_change': player2_change,
                    'player1_new_rating': player1_elo_after,
                    'player2_new_rating': player2_elo_after
                }
                
        except Exception as e:
            logger.error(f"Error finishing match {match_id}: {e}")
            return None
    
    def _update_player_rating(self, conn, player_id: int, sport: str, new_elo: int, score: float):
        """Update player rating and statistics after a match."""
        # Determine result type
        if score == 1.0:
            result_type = 'win'
        elif score == 0.0:
            result_type = 'loss'
        else:
            result_type = 'draw'
        
        # Update rating and stats
        if result_type == 'win':
            conn.execute(text('''
                UPDATE sport_ratings SET
                    current_elo = :new_elo,
                    peak_elo = CASE WHEN :new_elo > peak_elo THEN :new_elo ELSE peak_elo END,
                    games_played = games_played + 1,
                    wins = wins + 1,
                    win_streak = win_streak + 1,
                    loss_streak = 0,
                    last_match = CURRENT_TIMESTAMP,
                    updated_at = CURRENT_TIMESTAMP
                WHERE player_id = :player_id AND sport = :sport
            '''), {'new_elo': new_elo, 'player_id': player_id, 'sport': sport})
        elif result_type == 'loss':
            conn.execute(text('''
                UPDATE sport_ratings SET
                    current_elo = :new_elo,
                    games_played = games_played + 1,
                    losses = losses + 1,
                    loss_streak = loss_streak + 1,
                    win_streak = 0,
                    last_match = CURRENT_TIMESTAMP,
                    updated_at = CURRENT_TIMESTAMP
                WHERE player_id = :player_id AND sport = :sport
            '''), {'new_elo': new_elo, 'player_id': player_id, 'sport': sport})
        else:  # draw
            conn.execute(text('''
                UPDATE sport_ratings SET
                    current_elo = :new_elo,
                    peak_elo = CASE WHEN :new_elo > peak_elo THEN :new_elo ELSE peak_elo END,
                    games_played = games_played + 1,
                    draws = draws + 1,
                    win_streak = 0,
                    loss_streak = 0,
                    last_match = CURRENT_TIMESTAMP,
                    updated_at = CURRENT_TIMESTAMP
                WHERE player_id = :player_id AND sport = :sport
            '''), {'new_elo': new_elo, 'player_id': player_id, 'sport': sport})
    
    def get_cross_sport_stats(self, player_name: str) -> Dict[str, Any]:
        """
        Get player statistics across all sports.
        
        Args:
            player_name: Name of the player
            
        Returns:
            Dictionary with stats for each sport
        """
        try:
            with self.engine.connect() as conn:
                result = conn.execute(text('''
                    SELECT sr.sport, sr.current_elo, sr.peak_elo, sr.games_played,
                           sr.wins, sr.losses, sr.draws
                    FROM players p
                    JOIN sport_ratings sr ON p.id = sr.player_id
                    WHERE p.name = :name AND sr.games_played > 0
                    ORDER BY sr.current_elo DESC
                '''), {'name': player_name})
                
                stats = {}
                total_games = 0
                total_wins = 0
                
                for row in result.fetchall():
                    sport, elo, peak, games, wins, losses, draws = row
                    total_games += games
                    total_wins += wins
                    
                    win_pct = (wins / games * 100) if games > 0 else 0.0
                    
                    stats[sport] = {
                        'current_elo': elo,
                        'peak_elo': peak,
                        'games_played': games,
                        'wins': wins,
                        'losses': losses,
                        'draws': draws,
                        'win_percentage': round(win_pct, 1)
                    }
                
                # Add overall summary
                overall_win_pct = (total_wins / total_games * 100) if total_games > 0 else 0.0
                stats['overall'] = {
                    'sports_played': len(stats),
                    'total_games': total_games,
                    'total_wins': total_wins,
                    'overall_win_percentage': round(overall_win_pct, 1)
                }
                
                return stats
                
        except Exception as e:
            logger.error(f"Error getting cross-sport stats for {player_name}: {e}")
            return {}
    
    def simulate_match_outcome(self, player1_name: str, player2_name: str, sport: str) -> Optional[Dict[str, Any]]:
        """
        Simulate potential rating changes for different match outcomes.
        
        Args:
            player1_name: Name of first player
            player2_name: Name of second player
            sport: Sport name
            
        Returns:
            Simulation results or None if error
        """
        try:
            player1_stats = self.get_player_stats(player1_name, sport)
            player2_stats = self.get_player_stats(player2_name, sport)
            
            if not player1_stats or not player2_stats:
                return None
            
            p1_elo = player1_stats['current_elo']
            p2_elo = player2_stats['current_elo']
            p1_games = player1_stats['games_played']
            p2_games = player2_stats['games_played']
            
            # Calculate changes for different outcomes
            p1_win_change = self.calculate_rating_change(p1_elo, p2_elo, 1.0, p1_games)
            p1_loss_change = self.calculate_rating_change(p1_elo, p2_elo, 0.0, p1_games)
            p1_draw_change = self.calculate_rating_change(p1_elo, p2_elo, 0.5, p1_games)
            
            p2_win_change = self.calculate_rating_change(p2_elo, p1_elo, 1.0, p2_games)
            p2_loss_change = self.calculate_rating_change(p2_elo, p1_elo, 0.0, p2_games)
            p2_draw_change = self.calculate_rating_change(p2_elo, p1_elo, 0.5, p2_games)
            
            expected_score_p1 = self.calculate_expected_score(p1_elo, p2_elo)
            
            return {
                'sport': sport,
                'player1': {
                    'name': player1_name,
                    'current_elo': p1_elo,
                    'expected_score': round(expected_score_p1, 3),
                    'win_change': p1_win_change,
                    'loss_change': p1_loss_change,
                    'draw_change': p1_draw_change
                },
                'player2': {
                    'name': player2_name,
                    'current_elo': p2_elo,
                    'expected_score': round(1 - expected_score_p1, 3),
                    'win_change': p2_win_change,
                    'loss_change': p2_loss_change,
                    'draw_change': p2_draw_change
                }
            }
            
        except Exception as e:
            logger.error(f"Error simulating match outcome: {e}")
            return None