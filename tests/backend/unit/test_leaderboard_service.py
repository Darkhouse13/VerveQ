"""
Unit tests for LeaderboardService.
Tests leaderboard queries, filtering, and ranking logic.
"""
import pytest
from unittest.mock import MagicMock, Mock, patch
from sqlalchemy.orm import Session
from sqlalchemy import desc

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
        assert result[0]['win_rate'] == 70.0  # 35/50 * 100
        
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
        mock_query.filter.assert_called_once()
    
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
        mock_query.filter.assert_called_once()
    
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
        
        # Verify both filters were applied (filter called twice)
        assert mock_query.filter.call_count == 2
    
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
        mock_query.all.return_value = [(
            item['user_id'], item['username'], item['elo_rating'],
            item['games_played'], item['wins'], item['losses'],
            item['best_score'], item['average_score']
        ) for item in sample_leaderboard_data]
        
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
            ('user1', 'winner', 1500.0, 20, 15, 5, 10, 8.0),  # 15/20 = 0.75
            ('user2', 'average', 1400.0, 10, 5, 5, 9, 7.0),   # 5/10 = 0.5
            ('user3', 'newbie', 1300.0, 2, 1, 1, 8, 6.0),     # 1/2 = 0.5
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
            ('user1', 'inactive', 1200.0, 0, 0, 0, 0, 0.0)
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
            ('user1', 'tied1', 1500.0, 10, 8, 2, 10, 8.0),
            ('user2', 'tied2', 1500.0, 8, 6, 2, 9, 7.5),
            ('user3', 'tied3', 1500.0, 12, 9, 3, 10, 8.5),
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
        with pytest.raises(Exception):
            LeaderboardService.get_user_rank(db=mock_db, user_id='test_user')


class TestLeaderboardServiceIntegration:
    """Integration-style tests with realistic data scenarios."""
    
    @pytest.fixture
    def mock_db(self):
        return MagicMock(spec=Session)
    
    def test_competitive_season_leaderboard(self, mock_db):
        """Test leaderboard for a competitive season scenario."""
        # Realistic competitive season data
        season_data = [
            ('pro1', 'ChampionMaster', 2250.0, 100, 75, 25, 10, 9.2),
            ('pro2', 'SkillfulPlayer', 2100.0, 95, 65, 30, 10, 8.8),  
            ('expert1', 'TalentedUser', 1950.0, 80, 52, 28, 10, 8.1),
            ('expert2', 'ConsistentWin', 1900.0, 85, 55, 30, 9, 7.9),
            ('casual1', 'WeekendWarrior', 1400.0, 40, 20, 20, 8, 6.5),
            ('new1', 'FreshPlayer', 1200.0, 10, 4, 6, 7, 5.2),
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