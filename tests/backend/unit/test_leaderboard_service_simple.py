"""
Simplified unit tests for LeaderboardService.
Tests the business logic that can be easily tested.
"""
import pytest
from unittest.mock import patch, MagicMock

from backend.services.leaderboard_service import LeaderboardService


class TestLeaderboardServiceLogic:
    """Test the logical components of the leaderboard service."""
    
    @patch('backend.services.leaderboard_service.SessionLocal')
    def test_get_leaderboard_basic_functionality(self, mock_session_local):
        """Test basic leaderboard functionality with mocked database."""
        # Mock database session
        mock_db = MagicMock()
        mock_session_local.return_value = mock_db
        
        # Mock a single user result
        mock_result = MagicMock()
        mock_result.user_id = 'test_user'
        mock_result.username = 'testplayer'
        mock_result.display_name = None
        mock_result.elo_rating = 1500.5
        mock_result.games_played = 20
        mock_result.wins = 12
        mock_result.losses = 8
        mock_result.best_score = 10
        mock_result.average_score = 7.5
        mock_result.sport = 'football'
        mock_result.mode = 'quiz'
        
        # Mock query chain
        mock_query = MagicMock()
        mock_query.join.return_value = mock_query
        mock_query.filter.return_value = mock_query
        mock_query.order_by.return_value = mock_query
        mock_query.limit.return_value = mock_query
        mock_query.all.return_value = [mock_result]
        
        mock_db.query.return_value = mock_query
        
        # Call the service
        result = LeaderboardService.get_leaderboard(limit=5)
        
        # Verify the formatted output
        assert len(result) == 1
        entry = result[0]
        
        # Check all expected fields are present
        expected_fields = [
            'rank', 'user_id', 'username', 'display_name', 'elo_rating', 
            'score', 'games_played', 'wins', 'losses', 'win_rate',
            'best_score', 'average_score', 'sport', 'mode'
        ]
        
        for field in expected_fields:
            assert field in entry
        
        # Check specific values
        assert entry['rank'] == 1
        assert entry['user_id'] == 'test_user'
        assert entry['username'] == 'testplayer'
        assert entry['display_name'] == 'testplayer'  # Falls back to username
        assert entry['elo_rating'] == 1500  # Converted to int
        assert entry['games_played'] == 20
        assert entry['wins'] == 12
        assert entry['losses'] == 8
        assert entry['win_rate'] == 60.0  # 12/20 * 100
        assert entry['best_score'] == 10
        assert entry['average_score'] == 7.5
        assert entry['sport'] == 'football'
        assert entry['mode'] == 'quiz'
        
        # Verify database was properly closed
        mock_db.close.assert_called_once()
    
    @patch('backend.services.leaderboard_service.SessionLocal')
    def test_get_leaderboard_multiple_users_ranking(self, mock_session_local):
        """Test that multiple users are ranked correctly."""
        mock_db = MagicMock()
        mock_session_local.return_value = mock_db
        
        # Create multiple users with different ratings
        users_data = [
            ('user1', 'first', 2000.0, 30, 25, 5),
            ('user2', 'second', 1800.0, 25, 18, 7),  
            ('user3', 'third', 1600.0, 20, 12, 8),
        ]
        
        mock_results = []
        for user_id, username, rating, games, wins, losses in users_data:
            result = MagicMock()
            result.user_id = user_id
            result.username = username
            result.display_name = None
            result.elo_rating = rating
            result.games_played = games
            result.wins = wins
            result.losses = losses
            result.best_score = 10
            result.average_score = 8.0
            result.sport = 'football'
            result.mode = 'quiz'
            mock_results.append(result)
        
        mock_query = MagicMock()
        mock_query.join.return_value = mock_query
        mock_query.filter.return_value = mock_query
        mock_query.order_by.return_value = mock_query
        mock_query.limit.return_value = mock_query
        mock_query.all.return_value = mock_results
        
        mock_db.query.return_value = mock_query
        
        result = LeaderboardService.get_leaderboard()
        
        # Verify ranking
        assert len(result) == 3
        assert result[0]['rank'] == 1
        assert result[0]['username'] == 'first'
        assert result[0]['elo_rating'] == 2000
        
        assert result[1]['rank'] == 2
        assert result[1]['username'] == 'second'
        assert result[1]['elo_rating'] == 1800
        
        assert result[2]['rank'] == 3
        assert result[2]['username'] == 'third'
        assert result[2]['elo_rating'] == 1600
    
    @patch('backend.services.leaderboard_service.SessionLocal')
    def test_get_leaderboard_win_rate_calculation(self, mock_session_local):
        """Test win rate calculation accuracy."""
        mock_db = MagicMock()
        mock_session_local.return_value = mock_db
        
        # Test different win rate scenarios
        test_cases = [
            (10, 8, 2, 80.0),   # 80% win rate
            (20, 10, 10, 50.0), # 50% win rate  
            (5, 5, 0, 100.0),   # 100% win rate
            (15, 0, 15, 0.0),   # 0% win rate
        ]
        
        for games, wins, losses, expected_rate in test_cases:
            mock_result = MagicMock()
            mock_result.user_id = 'test'
            mock_result.username = 'test'
            mock_result.display_name = None
            mock_result.elo_rating = 1500.0
            mock_result.games_played = games
            mock_result.wins = wins
            mock_result.losses = losses
            mock_result.best_score = 10
            mock_result.average_score = 8.0
            mock_result.sport = 'football'
            mock_result.mode = 'quiz'
            
            mock_query = MagicMock()
            mock_query.join.return_value = mock_query
            mock_query.filter.return_value = mock_query
            mock_query.order_by.return_value = mock_query
            mock_query.limit.return_value = mock_query
            mock_query.all.return_value = [mock_result]
            
            mock_db.query.return_value = mock_query
            
            result = LeaderboardService.get_leaderboard()
            
            assert len(result) == 1
            assert result[0]['win_rate'] == expected_rate
    
    @patch('backend.services.leaderboard_service.SessionLocal')  
    def test_get_leaderboard_handles_empty_results(self, mock_session_local):
        """Test leaderboard handles empty database results."""
        mock_db = MagicMock()
        mock_session_local.return_value = mock_db
        
        # Mock empty results
        mock_query = MagicMock()
        mock_query.join.return_value = mock_query
        mock_query.filter.return_value = mock_query
        mock_query.order_by.return_value = mock_query
        mock_query.limit.return_value = mock_query
        mock_query.all.return_value = []
        
        mock_db.query.return_value = mock_query
        
        result = LeaderboardService.get_leaderboard()
        
        assert result == []
        mock_db.close.assert_called_once()
    
    @patch('backend.services.leaderboard_service.SessionLocal')
    def test_get_leaderboard_handles_database_error(self, mock_session_local):
        """Test leaderboard handles database errors gracefully."""
        mock_db = MagicMock()
        mock_session_local.return_value = mock_db
        
        # Mock database error
        mock_db.query.side_effect = Exception("Database connection failed")
        
        result = LeaderboardService.get_leaderboard()
        
        # Should return empty list on error
        assert result == []
        mock_db.close.assert_called_once()
    
    @patch('backend.services.leaderboard_service.SessionLocal')
    def test_get_user_rank_found(self, mock_session_local):
        """Test getting user rank when user exists."""
        mock_db = MagicMock()
        mock_session_local.return_value = mock_db
        
        # Mock user rating
        mock_user_rating = MagicMock()
        mock_user_rating.elo_rating = 1500.0
        
        # Mock user rating query
        mock_user_query = MagicMock()
        mock_user_query.filter.return_value = mock_user_query
        mock_user_query.first.return_value = mock_user_rating
        
        # Mock count query (5 users with higher rating)
        mock_count_query = MagicMock()
        mock_count_query.filter.return_value = mock_count_query
        mock_count_query.count.return_value = 5
        
        # Setup query behavior
        mock_db.query.side_effect = [mock_user_query, mock_count_query]
        
        rank = LeaderboardService.get_user_rank("test_user")
        
        assert rank == 6  # 5 higher + 1
        mock_db.close.assert_called_once()
    
    @patch('backend.services.leaderboard_service.SessionLocal')
    def test_get_user_rank_not_found(self, mock_session_local):
        """Test getting user rank when user doesn't exist."""
        mock_db = MagicMock()
        mock_session_local.return_value = mock_db
        
        # Mock user not found
        mock_user_query = MagicMock()
        mock_user_query.filter.return_value = mock_user_query
        mock_user_query.first.return_value = None
        
        mock_db.query.return_value = mock_user_query
        
        rank = LeaderboardService.get_user_rank("nonexistent_user")
        
        assert rank is None
        mock_db.close.assert_called_once()
    
    @patch('backend.services.leaderboard_service.SessionLocal')
    def test_get_leaderboard_stats_basic(self, mock_session_local):
        """Test leaderboard stats calculation."""
        mock_db = MagicMock()
        mock_session_local.return_value = mock_db
        
        # Mock rating data
        mock_ratings = [
            MagicMock(elo_rating=1800.0, games_played=20),
            MagicMock(elo_rating=1600.0, games_played=15),
            MagicMock(elo_rating=1400.0, games_played=10),
        ]
        
        mock_query = MagicMock()
        mock_query.filter.return_value = mock_query
        mock_query.count.return_value = 3
        mock_query.all.return_value = mock_ratings
        
        mock_db.query.return_value = mock_query
        
        stats = LeaderboardService.get_leaderboard_stats()
        
        assert stats['total_players'] == 3
        assert stats['average_elo'] == 1600.0  # (1800 + 1600 + 1400) / 3
        assert stats['highest_elo'] == 1800.0
        assert stats['total_games'] == 45  # 20 + 15 + 10
        
        mock_db.close.assert_called_once()
    
    @patch('backend.services.leaderboard_service.SessionLocal')
    def test_get_leaderboard_stats_empty(self, mock_session_local):
        """Test leaderboard stats with no players."""
        mock_db = MagicMock()
        mock_session_local.return_value = mock_db
        
        mock_query = MagicMock()
        mock_query.filter.return_value = mock_query
        mock_query.count.return_value = 0
        
        mock_db.query.return_value = mock_query
        
        stats = LeaderboardService.get_leaderboard_stats()
        
        expected = {
            "total_players": 0,
            "average_elo": 0,
            "highest_elo": 0,
            "total_games": 0
        }
        
        assert stats == expected
        mock_db.close.assert_called_once()


class TestLeaderboardServiceInputValidation:
    """Test input validation and edge cases."""
    
    def test_leaderboard_service_methods_exist(self):
        """Test that all expected methods exist on the service."""
        # Check that the service class has the expected methods
        assert hasattr(LeaderboardService, 'get_leaderboard')
        assert hasattr(LeaderboardService, 'get_user_rank')
        assert hasattr(LeaderboardService, 'get_leaderboard_stats')
        
        # Check methods are callable
        assert callable(getattr(LeaderboardService, 'get_leaderboard'))
        assert callable(getattr(LeaderboardService, 'get_user_rank'))
        assert callable(getattr(LeaderboardService, 'get_leaderboard_stats'))