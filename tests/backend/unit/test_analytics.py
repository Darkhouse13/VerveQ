"""
Unit tests for analytics service.
Tests event tracking, metrics calculation, and recommendations.
"""
import pytest
from datetime import datetime, timedelta
from unittest.mock import Mock, patch, AsyncMock

from backend.services.analytics import AnalyticsService
from backend.database.models import AnalyticsEvent, User, GameSession


class TestAnalyticsService:
    """Test cases for analytics service."""
    
    @pytest.fixture
    def analytics_service(self):
        """Create analytics service instance."""
        return AnalyticsService()
    
    @pytest.fixture
    def mock_db_session(self):
        """Create mock database session."""
        session = AsyncMock()
        session.add = AsyncMock()
        session.commit = AsyncMock()
        session.execute = AsyncMock()
        session.scalar = AsyncMock()
        return session
    
    @pytest.mark.asyncio
    async def test_track_event_success(self, analytics_service, mock_db_session):
        """Test successful event tracking."""
        user_id = "user-123"
        event_type = "game_started"
        event_data = {
            "sport": "football",
            "mode": "quiz",
            "platform": "mobile"
        }
        
        await analytics_service.track_event(
            mock_db_session,
            user_id,
            event_type,
            event_data
        )
        
        # Verify event was added to session
        mock_db_session.add.assert_called_once()
        added_event = mock_db_session.add.call_args[0][0]
        
        assert isinstance(added_event, AnalyticsEvent)
        assert added_event.user_id == user_id
        assert added_event.event_type == event_type
        assert added_event.event_data == event_data
        
        # Verify commit was called
        mock_db_session.commit.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_track_event_with_minimal_data(self, analytics_service, mock_db_session):
        """Test event tracking with minimal data."""
        await analytics_service.track_event(
            mock_db_session,
            "user-456",
            "app_opened"
        )
        
        mock_db_session.add.assert_called_once()
        added_event = mock_db_session.add.call_args[0][0]
        
        assert added_event.event_data == {}
    
    @pytest.mark.asyncio
    async def test_get_user_activity_metrics(self, analytics_service, mock_db_session):
        """Test getting user activity metrics."""
        user_id = "user-123"
        now = datetime.utcnow()
        
        # Mock query results
        mock_result = Mock()
        mock_result.scalar.return_value = 25  # Total events
        mock_db_session.execute.return_value = mock_result
        
        # Mock game sessions
        mock_sessions = [
            Mock(created_at=now - timedelta(days=1)),
            Mock(created_at=now - timedelta(days=3)),
            Mock(created_at=now - timedelta(days=10)),
        ]
        mock_db_session.scalars = Mock(return_value=Mock(all=Mock(return_value=mock_sessions)))
        
        metrics = await analytics_service.get_user_activity_metrics(
            mock_db_session,
            user_id
        )
        
        assert metrics["total_events"] == 25
        assert metrics["days_active"] == 3
        assert "average_session_duration" in metrics
        assert "favorite_time_of_day" in metrics
    
    @pytest.mark.asyncio
    async def test_get_platform_metrics(self, analytics_service, mock_db_session):
        """Test getting platform-wide metrics."""
        # Mock various counts
        mock_db_session.scalar.side_effect = [
            1000,  # Total users
            500,   # Active users (30 days)
            150,   # Active users (7 days)
            50,    # Active users (1 day)
            10000, # Total games
            7500,  # Total quiz games
            2500   # Total survival games
        ]
        
        metrics = await analytics_service.get_platform_metrics(mock_db_session)
        
        assert metrics["total_users"] == 1000
        assert metrics["active_users_30d"] == 500
        assert metrics["active_users_7d"] == 150
        assert metrics["active_users_1d"] == 50
        assert metrics["total_games_played"] == 10000
        assert metrics["quiz_games_played"] == 7500
        assert metrics["survival_games_played"] == 2500
        assert metrics["engagement_rate"] == 50.0  # 500/1000 * 100
    
    @pytest.mark.asyncio
    async def test_get_game_mode_analytics(self, analytics_service, mock_db_session):
        """Test getting analytics by game mode."""
        sport = "football"
        mode = "quiz"
        
        # Mock aggregated results
        mock_results = [
            {"total_games": 5000, "avg_score": 75.5, "avg_duration": 180}
        ]
        mock_db_session.execute.return_value = Mock(
            mappings=Mock(all=Mock(return_value=mock_results))
        )
        
        analytics = await analytics_service.get_game_mode_analytics(
            mock_db_session,
            sport,
            mode
        )
        
        assert analytics["total_games"] == 5000
        assert analytics["average_score"] == 75.5
        assert analytics["average_duration"] == 180
        assert "difficulty_distribution" in analytics
        assert "peak_playing_hours" in analytics
    
    @pytest.mark.asyncio
    async def test_generate_recommendations_new_player(self, analytics_service, mock_db_session):
        """Test generating recommendations for new player."""
        user_id = "new-user"
        
        # Mock user with no games
        mock_db_session.scalar.return_value = 0  # No games played
        
        recommendations = await analytics_service.generate_recommendations(
            mock_db_session,
            user_id
        )
        
        assert len(recommendations) > 0
        assert any(r["type"] == "start_playing" for r in recommendations)
        assert any(r["type"] == "try_mode" for r in recommendations)
    
    @pytest.mark.asyncio
    async def test_generate_recommendations_experienced_player(self, analytics_service, mock_db_session):
        """Test generating recommendations for experienced player."""
        user_id = "pro-user"
        
        # Mock user with many games
        mock_db_session.scalar.return_value = 100  # Many games played
        
        # Mock performance data
        mock_db_session.execute.return_value = Mock(
            mappings=Mock(all=Mock(return_value=[
                {"sport": "football", "mode": "quiz", "avg_score": 85},
                {"sport": "football", "mode": "survival", "avg_score": 60}
            ]))
        )
        
        recommendations = await analytics_service.generate_recommendations(
            mock_db_session,
            user_id
        )
        
        assert len(recommendations) > 0
        assert any(r["type"] == "improve_weak_area" for r in recommendations)
        assert any(r["priority"] == "high" for r in recommendations)
    
    @pytest.mark.asyncio
    async def test_get_content_performance(self, analytics_service, mock_db_session):
        """Test analyzing content performance."""
        # Mock question performance data
        mock_results = [
            {"question_id": 1, "times_shown": 100, "correct_rate": 0.75},
            {"question_id": 2, "times_shown": 150, "correct_rate": 0.45},
            {"question_id": 3, "times_shown": 80, "correct_rate": 0.90},
        ]
        
        mock_db_session.execute.return_value = Mock(
            mappings=Mock(all=Mock(return_value=mock_results))
        )
        
        performance = await analytics_service.get_content_performance(
            mock_db_session,
            "football",
            "quiz"
        )
        
        assert "popular_questions" in performance
        assert "difficult_questions" in performance
        assert "easy_questions" in performance
        assert len(performance["difficult_questions"]) > 0
        assert performance["difficult_questions"][0]["question_id"] == 2
    
    @pytest.mark.asyncio
    async def test_track_user_engagement(self, analytics_service, mock_db_session):
        """Test tracking user engagement patterns."""
        user_id = "engaged-user"
        
        # Mock session duration data
        mock_events = [
            Mock(created_at=datetime.utcnow() - timedelta(minutes=30)),
            Mock(created_at=datetime.utcnow() - timedelta(minutes=25)),
            Mock(created_at=datetime.utcnow() - timedelta(minutes=20)),
            Mock(created_at=datetime.utcnow())
        ]
        
        mock_db_session.execute.return_value = Mock(
            scalars=Mock(return_value=Mock(all=Mock(return_value=mock_events)))
        )
        
        engagement = await analytics_service.track_user_engagement(
            mock_db_session,
            user_id
        )
        
        assert "session_duration" in engagement
        assert "actions_per_session" in engagement
        assert engagement["session_duration"] == 30  # 30 minutes
        assert engagement["actions_per_session"] == 4
    
    @pytest.mark.asyncio
    async def test_get_retention_metrics(self, analytics_service, mock_db_session):
        """Test calculating retention metrics."""
        # Mock user cohort data
        mock_cohort_data = [
            {"cohort_date": "2024-01-01", "users": 100, "returned_d1": 80, "returned_d7": 60},
            {"cohort_date": "2024-01-08", "users": 120, "returned_d1": 90, "returned_d7": 65},
        ]
        
        mock_db_session.execute.return_value = Mock(
            mappings=Mock(all=Mock(return_value=mock_cohort_data))
        )
        
        retention = await analytics_service.get_retention_metrics(mock_db_session)
        
        assert "d1_retention" in retention
        assert "d7_retention" in retention
        assert "d30_retention" in retention
        assert retention["d1_retention"] > 0
        assert retention["d7_retention"] > 0
    
    @pytest.mark.asyncio
    async def test_identify_power_users(self, analytics_service, mock_db_session):
        """Test identifying power users."""
        # Mock power user data
        mock_power_users = [
            {"user_id": "user-001", "total_games": 500, "days_active": 150},
            {"user_id": "user-002", "total_games": 450, "days_active": 140},
            {"user_id": "user-003", "total_games": 400, "days_active": 130},
        ]
        
        mock_db_session.execute.return_value = Mock(
            mappings=Mock(all=Mock(return_value=mock_power_users))
        )
        
        power_users = await analytics_service.identify_power_users(
            mock_db_session,
            limit=3
        )
        
        assert len(power_users) == 3
        assert power_users[0]["user_id"] == "user-001"
        assert power_users[0]["total_games"] == 500
        assert all("engagement_score" in user for user in power_users)
    
    @pytest.mark.asyncio
    async def test_error_handling_database_error(self, analytics_service, mock_db_session):
        """Test error handling when database operations fail."""
        # Mock database error
        mock_db_session.add.side_effect = Exception("Database connection lost")
        
        # Should not raise exception, but log error
        await analytics_service.track_event(
            mock_db_session,
            "user-123",
            "test_event"
        )
        
        # Verify rollback would be called in real implementation
        # In production, this would be handled by proper error handling
    
    def test_calculate_engagement_score(self, analytics_service):
        """Test engagement score calculation."""
        # Test various engagement levels
        assert analytics_service._calculate_engagement_score(100, 30, 0.75) > 80
        assert analytics_service._calculate_engagement_score(50, 15, 0.60) > 50
        assert analytics_service._calculate_engagement_score(10, 5, 0.40) < 30
        
        # Test edge cases
        assert analytics_service._calculate_engagement_score(0, 0, 0) == 0
        assert analytics_service._calculate_engagement_score(1000, 365, 1.0) == 100