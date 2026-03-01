"""
Unit tests for LeaderboardService.
Tests leaderboard queries, filtering, and ranking logic.
"""
import pytest
from unittest.mock import MagicMock, Mock, patch
from sqlalchemy.orm import Session
from sqlalchemy import desc
from types import SimpleNamespace

from backend.services.leaderboard_service import LeaderboardService
from backend.database.models import User, UserRating


class TestLeaderboardService:
    """Test cases for leaderboard service."""
    
    @patch('backend.services.leaderboard_service.SessionLocal')
    def test_get_leaderboard_no_filters(self, mock_session_local):
        """Test getting leaderboard without any filters."""
        # Mock database session
        mock_db = MagicMock()
        mock_session_local.return_value = mock_db
        
        # Mock query results
        mock_result = MagicMock()
        mock_result.user_id = 'user1'
        mock_result.username = 'champion'
        mock_result.display_name = None
        mock_result.elo_rating = 2100.0
        mock_result.games_played = 50
        mock_result.wins = 35
        mock_result.losses = 15
        mock_result.best_score = 10
        mock_result.average_score = 8.5
        mock_result.sport = 'football'
        mock_result.mode = 'quiz'
        
        mock_query = MagicMock()
        mock_query.join.return_value = mock_query
        mock_query.filter.return_value = mock_query
        mock_query.order_by.return_value = mock_query
        mock_query.limit.return_value = mock_query
        mock_query.all.return_value = [mock_result]
        
        mock_db.query.return_value = mock_query
        
        # Call service method
        result = LeaderboardService.get_leaderboard()
        
        # Verify result structure
        assert len(result) == 1
        assert result[0]['username'] == 'champion'
        assert result[0]['elo_rating'] == 2100
        assert result[0]['rank'] == 1
        assert result[0]['win_rate'] == 0.7  # 35/50
        
        # Verify database was closed
        mock_db.close.assert_called_once()
    
    def test_get_leaderboard_with_sport_filter(self, mock_db):
        """Test getting leaderboard filtered by sport."""
        mock_query = MagicMock()
        mock_query.join.return_value = mock_query
        mock_query.filter.return_value = mock_query
        mock_query.order_by.return_value = mock_query
        mock_query.limit.return_value = mock_query
        mock_query.all.return_value = []
        
        mock_db.query.return_value = mock_query
        
        # Call with sport filter
        LeaderboardService.get_leaderboard(db=mock_db, sport='football')
        
        # Verify sport filter was applied
        filter_calls = [call.args[0] for call in mock_query.filter.call_args_list]
        assert any('sport' in str(arg) for arg in filter_calls)
    
    def test_get_leaderboard_with_mode_filter(self, mock_db):
        """Test getting leaderboard filtered by game mode."""
        mock_query = MagicMock()
        mock_query.join.return_value = mock_query
        mock_query.filter.return_value = mock_query
        mock_query.order_by.return_value = mock_query
        mock_query.limit.return_value = mock_query
        mock_query.all.return_value = []
        
        mock_db.query.return_value = mock_query
        
        # Call with mode filter
        LeaderboardService.get_leaderboard(db=mock_db, mode='quiz')
        
        # Verify mode filter was applied
        filter_calls = [call.args[0] for call in mock_query.filter.call_args_list]
        assert any('mode' in str(arg) for arg in filter_calls)
    
    def test_get_leaderboard_with_both_filters(self, mock_db):
        """Test getting leaderboard filtered by both sport and mode."""
        mock_query = MagicMock()
        mock_query.join.return_value = mock_query
        mock_query.filter.return_value = mock_query
        mock_query.order_by.return_value = mock_query
        mock_query.limit.return_value = mock_query
        mock_query.all.return_value = []
        
        mock_db.query.return_value = mock_query
        
        # Call with both filters
        LeaderboardService.get_leaderboard(db=mock_db, sport='football', mode='survival')
        
        # Verify both filters were applied
        filter_calls = [call.args[0] for call in mock_query.filter.call_args_list]
        assert any('sport' in str(arg) for arg in filter_calls)
        assert any('mode' in str(arg) for arg in filter_calls)
    
    def test_get_leaderboard_custom_limit(self, mock_db):
        """Test getting leaderboard with custom limit."""
        mock_query = MagicMock()
        mock_query.join.return_value = mock_query
        mock_query.order_by.return_value = mock_query
        mock_query.limit.return_value = mock_query
        mock_query.all.return_value = []
        
        mock_db.query.return_value = mock_query
        
        # Call with custom limit
        LeaderboardService.get_leaderboard(db=mock_db, limit=25)
        
        # Verify custom limit was used
        mock_query.limit.assert_called_once_with(25)
    
    def test_get_leaderboard_rank_calculation(self, mock_db, sample_leaderboard_data):
        """Test that ranks are calculated correctly."""
        # Mock query to return data in ELO order (highest first)
        mock_query = MagicMock()
        mock_query.join.return_value = mock_query
        mock_query.order_by.return_value = mock_query
        mock_query.limit.return_value = mock_query
        mock_query.all.return_value = [SimpleNamespace(**item) for item in sample_leaderboard_data]
        
        mock_db.query.return_value = mock_query
        
        result = LeaderboardService.get_leaderboard(db=mock_db)
        
        # Verify ranks are assigned correctly (1, 2, 3...)
        for i, entry in enumerate(result):
            assert entry['rank'] == i + 1
            
        # Verify entries are in descending ELO order
        for i in range(len(result) - 1):
            assert result[i]['elo_rating'] >= result[i+1]['elo_rating']
    
    def test_get_leaderboard_win_rate_calculation(self, mock_db):
        """Test that win rates are calculated correctly."""
        mock_data = [
            SimpleNamespace(user_id='user1', username='winner', display_name=None, elo_rating=1500.0, games_played=20, wins=15, losses=5, best_score=10, average_score=8.0, sport='football', mode='quiz'),
            SimpleNamespace(user_id='user2', username='average', display_name=None, elo_rating=1400.0, games_played=10, wins=5, losses=5, best_score=9, average_score=7.0, sport='football', mode='quiz'),
            SimpleNamespace(user_id='user3', username='newbie', display_name=None, elo_rating=1300.0, games_played=2, wins=1, losses=1, best_score=8, average_score=6.0, sport='football', mode='quiz'),
        ]
        
        mock_query = MagicMock()
        mock_query.join.return_value = mock_query
        mock_query.order_by.return_value = mock_query
        mock_query.limit.return_value = mock_query
        mock_query.all.return_value = mock_data
        
        mock_db.query.return_value = mock_query
        
        result = LeaderboardService.get_leaderboard(db=mock_db)
        
        # Verify win rates
        assert result[0]['win_rate'] == 0.75
        assert result[1]['win_rate'] == 0.5
        assert result[2]['win_rate'] == 0.5
    
    def test_get_leaderboard_empty_result(self, mock_db):
        """Test getting leaderboard when no data exists."""
        mock_query = MagicMock()
        mock_query.join.return_value = mock_query
        mock_query.order_by.return_value = mock_query
        mock_query.limit.return_value = mock_query
        mock_query.all.return_value = []
        
        mock_db.query.return_value = mock_query
        
        result = LeaderboardService.get_leaderboard(db=mock_db)
        
        assert result == []
    
    def test_get_user_rank_found(self, mock_db):
        """Test getting user rank when user exists."""
        # Mock user exists in ranking
        mock_query = MagicMock()
        mock_query.join.return_value = mock_query
        mock_query.filter.return_value = mock_query
        mock_query.order_by.return_value = mock_query
        
        # Mock count query for rank calculation
        mock_count_query = MagicMock()
        mock_count_query.join.return_value = mock_count_query
        mock_count_query.filter.return_value = mock_count_query
        mock_count_query.count.return_value = 5  # 5 users have higher ELO
        
        # Mock the user's rating query
        mock_user_rating = MagicMock()
        mock_user_rating.elo_rating = 1400.0
        mock_query.first.return_value = mock_user_rating
        
        # Setup query return behavior
        def query_side_effect(*args):
            if 'count' in str(args):
                return mock_count_query
            return mock_query
        
        mock_db.query.side_effect = query_side_effect
        
        rank = LeaderboardService.get_user_rank(
            db=mock_db, user_id='test_user', sport='football', mode='quiz'
        )
        
        # User is ranked 6th (5 users have higher ELO + 1)
        assert rank == 6
    
    def test_get_user_rank_not_found(self, mock_db):
        """Test getting user rank when user doesn't exist."""
        mock_query = MagicMock()
        mock_query.join.return_value = mock_query
        mock_query.filter.return_value = mock_query
        mock_query.order_by.return_value = mock_query
        mock_query.first.return_value = None  # User not found
        
        mock_db.query.return_value = mock_query
        
        rank = LeaderboardService.get_user_rank(
            db=mock_db, user_id='nonexistent_user'
        )
        
        assert rank is None
    
    def test_get_user_rank_with_filters(self, mock_db):
        """Test getting user rank with sport/mode filters."""
        mock_query = MagicMock()
        mock_query.join.return_value = mock_query
        mock_query.filter.return_value = mock_query
        mock_query.order_by.return_value = mock_query
        
        mock_user_rating = MagicMock()
        mock_user_rating.elo_rating = 1500.0
        mock_query.first.return_value = mock_user_rating
        
        mock_count_query = MagicMock()
        mock_count_query.join.return_value = mock_count_query
        mock_count_query.filter.return_value = mock_count_query
        mock_count_query.count.return_value = 2
        
        def query_side_effect(*args):
            if 'count' in str(args):
                return mock_count_query
            return mock_query
        
        mock_db.query.side_effect = query_side_effect
        
        rank = LeaderboardService.get_user_rank(
            db=mock_db, user_id='test_user', sport='tennis', mode='survival'
        )
        
        # Verify filters were applied
        assert mock_query.filter.call_count >= 3  # user_id + sport + mode
        assert rank == 3  # 2 higher + 1


class TestLeaderboardServiceEdgeCases:
    """Test edge cases and error conditions."""
    
    @pytest.fixture
    def mock_db(self):
        return MagicMock(spec=Session)
    
    def test_get_leaderboard_zero_games_played(self, mock_db):
        """Test leaderboard entry with zero games played."""
        mock_data = [
            SimpleNamespace(user_id='user1', username='inactive', display_name=None, elo_rating=1200.0, games_played=0, wins=0, losses=0, best_score=0, average_score=0.0, sport='football', mode='quiz')
        ]
        
        mock_query = MagicMock()
        mock_query.join.return_value = mock_query
        mock_query.order_by.return_value = mock_query
        mock_query.limit.return_value = mock_query
        mock_query.all.return_value = mock_data
        
        mock_db.query.return_value = mock_query
        
        result = LeaderboardService.get_leaderboard(db=mock_db)
        
        # Should handle division by zero gracefully
        assert len(result) == 1
        assert result[0]['win_rate'] == 0.0
    
    def test_get_leaderboard_same_elo_ratings(self, mock_db):
        """Test leaderboard with users having same ELO ratings."""
        mock_data = [
            SimpleNamespace(user_id='user1', username='tied1', display_name=None, elo_rating=1500.0, games_played=10, wins=8, losses=2, best_score=10, average_score=8.0, sport='football', mode='quiz'),
            SimpleNamespace(user_id='user2', username='tied2', display_name=None, elo_rating=1500.0, games_played=8, wins=6, losses=2, best_score=9, average_score=7.5, sport='football', mode='quiz'),
            SimpleNamespace(user_id='user3', username='tied3', display_name=None, elo_rating=1500.0, games_played=12, wins=9, losses=3, best_score=10, average_score=8.5, sport='football', mode='quiz'),
        ]
        
        mock_query = MagicMock()
        mock_query.join.return_value = mock_query
        mock_query.order_by.return_value = mock_query
        mock_query.limit.return_value = mock_query
        mock_query.all.return_value = mock_data
        
        mock_db.query.return_value = mock_query
        
        result = LeaderboardService.get_leaderboard(db=mock_db)
        
        # All should have different ranks despite same ELO
        ranks = [entry['rank'] for entry in result]
        assert len(set(ranks)) == len(ranks)  # All ranks unique
        assert ranks == [1, 2, 3]
    
    def test_get_leaderboard_negative_limit(self, mock_db):
        """Test leaderboard with negative limit."""
        mock_query = MagicMock()
        mock_query.join.return_value = mock_query
        mock_query.order_by.return_value = mock_query
        mock_query.limit.return_value = mock_query
        mock_query.all.return_value = []
        
        mock_db.query.return_value = mock_query
        
        # Should handle negative limit gracefully
        result = LeaderboardService.get_leaderboard(db=mock_db, limit=-5)
        
        # Should probably default to a reasonable limit or return empty
        assert isinstance(result, list)
    
    def test_get_leaderboard_very_large_limit(self, mock_db):
        """Test leaderboard with very large limit."""
        mock_query = MagicMock()
        mock_query.join.return_value = mock_query
        mock_query.order_by.return_value = mock_query
        mock_query.limit.return_value = mock_query
        mock_query.all.return_value = []
        
        mock_db.query.return_value = mock_query
        
        # Should handle large limits without issues
        LeaderboardService.get_leaderboard(db=mock_db, limit=10000)
        
        mock_query.limit.assert_called_once_with(10000)
    
    def test_get_user_rank_database_error_handling(self, mock_db):
        """Test user rank when database query fails."""
        # Mock database error
        mock_db.query.side_effect = Exception("Database connection failed")
        
        # Should handle database errors gracefully
        result = LeaderboardService.get_user_rank(db=mock_db, user_id='test_user')
        assert result is None


class TestLeaderboardServiceIntegration:
    """Integration-style tests with realistic data scenarios."""
    
    @pytest.fixture
    def mock_db(self):
        return MagicMock(spec=Session)
    
    def test_competitive_season_leaderboard(self, mock_db):
        """Test leaderboard for a competitive season scenario."""
        # Realistic competitive season data
        season_data = [
            SimpleNamespace(user_id='pro1', username='ChampionMaster', display_name='ChampionMaster', elo_rating=2250.0, games_played=100, wins=75, losses=25, best_score=10, average_score=9.2, sport='football', mode='quiz'),
            SimpleNamespace(user_id='pro2', username='SkillfulPlayer', display_name='SkillfulPlayer', elo_rating=2100.0, games_played=95, wins=65, losses=30, best_score=10, average_score=8.8, sport='football', mode='quiz'),
            SimpleNamespace(user_id='expert1', username='TalentedUser', display_name='TalentedUser', elo_rating=1950.0, games_played=80, wins=52, losses=28, best_score=10, average_score=8.1, sport='football', mode='quiz'),
            SimpleNamespace(user_id='expert2', username='ConsistentWin', display_name='ConsistentWin', elo_rating=1900.0, games_played=85, wins=55, losses=30, best_score=9, average_score=7.9, sport='football', mode='quiz'),
            SimpleNamespace(user_id='casual1', username='WeekendWarrior', display_name='WeekendWarrior', elo_rating=1400.0, games_played=40, wins=20, losses=20, best_score=8, average_score=6.5, sport='football', mode='quiz'),
            SimpleNamespace(user_id='new1', username='FreshPlayer', display_name='FreshPlayer', elo_rating=1200.0, games_played=10, wins=4, losses=6, best_score=7, average_score=5.2, sport='football', mode='quiz'),
        ]
        
        mock_query = MagicMock()
        mock_query.join.return_value = mock_query
        mock_query.filter.return_value = mock_query
        mock_query.order_by.return_value = mock_query
        mock_query.limit.return_value = mock_query
        mock_query.all.return_value = season_data
        
        mock_db.query.return_value = mock_query
        
        # Get football quiz leaderboard
        result = LeaderboardService.get_leaderboard(
            db=mock_db, sport='football', mode='quiz', limit=5
        )
        
        # Verify competitive structure
        assert len(result) == 6  # All players returned
        assert result[0]['username'] == 'ChampionMaster'
        assert result[0]['elo_rating'] == 2250.0
        assert result[0]['rank'] == 1
        
        # Verify win rates are calculated correctly
        assert result[0]['win_rate'] == 0.75  # 75/100
        assert result[1]['win_rate'] == pytest.approx(0.684, abs=0.01)  # 65/95
        
        # Verify ranking order by ELO
        for i in range(len(result) - 1):
            assert result[i]['elo_rating'] >= result[i+1]['elo_rating']