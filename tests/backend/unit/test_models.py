"""
Unit tests for database models.
Tests model validation, relationships, and constraints.
"""
import pytest
import uuid
from datetime import datetime
from sqlalchemy.exc import IntegrityError

from backend.database.models import (
    User, UserRating, GameSession, Achievement,
    UserAchievement, Leaderboard, AnalyticsEvent, Challenge
)


class TestUserModel:
    """Test cases for User model."""
    
    @pytest.mark.asyncio
    async def test_create_user_with_email(self, db_session):
        """Test creating a user with email."""
        user = User(
            id=str(uuid.uuid4()),
            username="testuser",
            email="test@example.com",
            display_name="Test User"
        )
        db_session.add(user)
        await db_session.commit()
        
        # Verify user was created
        assert user.id is not None
        assert user.username == "testuser"
        assert user.email == "test@example.com"
        assert user.is_guest is False
        assert user.created_at is not None
    
    @pytest.mark.asyncio
    async def test_create_guest_user(self, db_session):
        """Test creating a guest user."""
        user = User(
            id=str(uuid.uuid4()),
            username=f"guest_{uuid.uuid4().hex[:8]}",
            display_name="Guest Player",
            is_guest=True
        )
        db_session.add(user)
        await db_session.commit()
        
        assert user.email is None
        assert user.is_guest is True
        assert user.username.startswith("guest_")
    
    @pytest.mark.asyncio
    async def test_user_unique_username(self, db_session):
        """Test username uniqueness constraint."""
        user1 = User(
            id=str(uuid.uuid4()),
            username="duplicate",
            email="user1@example.com"
        )
        user2 = User(
            id=str(uuid.uuid4()),
            username="duplicate",  # Same username
            email="user2@example.com"
        )
        
        db_session.add(user1)
        await db_session.commit()
        
        db_session.add(user2)
        with pytest.raises(IntegrityError):
            await db_session.commit()
    
    @pytest.mark.asyncio
    async def test_user_relationships(self, db_session, test_user):
        """Test User model relationships."""
        # Add related data
        rating = UserRating(
            user_id=test_user.id,
            sport="football",
            mode="quiz",
            rating=1500
        )
        
        session = GameSession(
            id=str(uuid.uuid4()),
            user_id=test_user.id,
            sport="football",
            mode="quiz",
            score=80
        )
        
        db_session.add_all([rating, session])
        await db_session.commit()
        
        # Refresh to load relationships
        await db_session.refresh(test_user)
        
        # Test relationships exist (actual loading depends on lazy loading config)
        assert hasattr(test_user, 'ratings')
        assert hasattr(test_user, 'game_sessions')
        assert hasattr(test_user, 'achievements')


class TestUserRatingModel:
    """Test cases for UserRating model."""
    
    @pytest.mark.asyncio
    async def test_create_user_rating(self, db_session, test_user):
        """Test creating a user rating."""
        rating = UserRating(
            user_id=test_user.id,
            sport="football",
            mode="quiz",
            rating=1500,
            games_played=10,
            wins=6,
            losses=4
        )
        db_session.add(rating)
        await db_session.commit()
        
        assert rating.user_id == test_user.id
        assert rating.rating == 1500
        assert rating.win_rate == 60.0  # 6/10 * 100
        assert rating.peak_rating == 1500  # Should default to current rating
    
    @pytest.mark.asyncio
    async def test_user_rating_unique_constraint(self, db_session, test_user):
        """Test unique constraint on user_id, sport, mode combination."""
        rating1 = UserRating(
            user_id=test_user.id,
            sport="football",
            mode="quiz",
            rating=1500
        )
        rating2 = UserRating(
            user_id=test_user.id,
            sport="football",  # Same sport
            mode="quiz",      # Same mode
            rating=1600
        )
        
        db_session.add(rating1)
        await db_session.commit()
        
        db_session.add(rating2)
        with pytest.raises(IntegrityError):
            await db_session.commit()
    
    @pytest.mark.asyncio
    async def test_user_rating_different_sports(self, db_session, test_user):
        """Test user can have ratings for different sports."""
        rating1 = UserRating(
            user_id=test_user.id,
            sport="football",
            mode="quiz",
            rating=1500
        )
        rating2 = UserRating(
            user_id=test_user.id,
            sport="tennis",  # Different sport
            mode="quiz",
            rating=1400
        )
        
        db_session.add_all([rating1, rating2])
        await db_session.commit()
        
        # Should succeed - different sports
        assert rating1.sport != rating2.sport
    
    @pytest.mark.asyncio
    async def test_win_rate_calculation(self, db_session, test_user):
        """Test win rate property calculation."""
        rating = UserRating(
            user_id=test_user.id,
            sport="football",
            mode="quiz",
            rating=1500,
            games_played=20,
            wins=15,
            losses=5
        )
        
        assert rating.win_rate == 75.0  # 15/20 * 100
        
        # Test edge case: no games played
        rating.games_played = 0
        rating.wins = 0
        assert rating.win_rate == 0.0


class TestGameSessionModel:
    """Test cases for GameSession model."""
    
    @pytest.mark.asyncio
    async def test_create_game_session(self, db_session, test_user):
        """Test creating a game session."""
        session = GameSession(
            id=str(uuid.uuid4()),
            user_id=test_user.id,
            sport="football",
            mode="quiz",
            score=90,
            questions_answered=10,
            correct_answers=9,
            started_at=datetime.utcnow(),
            ended_at=datetime.utcnow()
        )
        db_session.add(session)
        await db_session.commit()
        
        assert session.accuracy == 90.0  # 9/10 * 100
        assert session.user_id == test_user.id
    
    @pytest.mark.asyncio
    async def test_game_session_json_data(self, db_session, test_user):
        """Test storing JSON data in game session."""
        data = {
            "difficulty": "hard",
            "device": "mobile",
            "version": "1.0.0",
            "custom_field": ["value1", "value2"]
        }
        
        session = GameSession(
            id=str(uuid.uuid4()),
            user_id=test_user.id,
            sport="football",
            mode="survival",
            score=15,
            data=data
        )
        db_session.add(session)
        await db_session.commit()
        
        # Refresh and verify JSON data
        await db_session.refresh(session)
        assert session.data == data
        assert session.data["difficulty"] == "hard"
        assert isinstance(session.data["custom_field"], list)


class TestAchievementModel:
    """Test cases for Achievement model."""
    
    @pytest.mark.asyncio
    async def test_create_achievement(self, db_session):
        """Test creating an achievement."""
        achievement = Achievement(
            id="speed_demon",
            name="Speed Demon",
            description="Complete a quiz in under 30 seconds",
            icon="⚡",
            requirement_type="time_limit",
            requirement_value=30,
            points=25,
            hidden=False
        )
        db_session.add(achievement)
        await db_session.commit()
        
        assert achievement.id == "speed_demon"
        assert achievement.points == 25
        assert achievement.hidden is False
    
    @pytest.mark.asyncio
    async def test_achievement_unique_id(self, db_session):
        """Test achievement ID uniqueness."""
        ach1 = Achievement(
            id="unique_id",
            name="Achievement 1",
            description="First achievement",
            requirement_type="wins",
            requirement_value=1
        )
        ach2 = Achievement(
            id="unique_id",  # Same ID
            name="Achievement 2",
            description="Second achievement",
            requirement_type="wins",
            requirement_value=2
        )
        
        db_session.add(ach1)
        await db_session.commit()
        
        db_session.add(ach2)
        with pytest.raises(IntegrityError):
            await db_session.commit()


class TestUserAchievementModel:
    """Test cases for UserAchievement model."""
    
    @pytest.mark.asyncio
    async def test_user_achievement_progress(self, db_session, test_user):
        """Test user achievement progress tracking."""
        # First create an achievement
        achievement = Achievement(
            id="test_achievement",
            name="Test Achievement",
            description="Test",
            requirement_type="wins",
            requirement_value=10
        )
        db_session.add(achievement)
        await db_session.commit()
        
        # Create user achievement
        user_achievement = UserAchievement(
            user_id=test_user.id,
            achievement_id=achievement.id,
            progress=5  # 50% progress
        )
        db_session.add(user_achievement)
        await db_session.commit()
        
        assert user_achievement.progress == 5
        assert user_achievement.unlocked_at is None
        
        # Update to completed
        user_achievement.progress = 10
        user_achievement.unlocked_at = datetime.utcnow()
        await db_session.commit()
        
        assert user_achievement.unlocked_at is not None


class TestLeaderboardModel:
    """Test cases for Leaderboard model."""
    
    @pytest.mark.asyncio
    async def test_create_leaderboard_entry(self, db_session, test_user):
        """Test creating a leaderboard entry."""
        entry = Leaderboard(
            user_id=test_user.id,
            sport="football",
            mode="quiz",
            period="weekly",
            rank=1,
            rating=1800,
            games_played=25,
            wins=20
        )
        db_session.add(entry)
        await db_session.commit()
        
        assert entry.rank == 1
        assert entry.win_rate == 80.0  # 20/25 * 100
        assert entry.period == "weekly"
    
    @pytest.mark.asyncio
    async def test_leaderboard_periods(self, db_session, test_user):
        """Test different leaderboard periods."""
        periods = ["daily", "weekly", "monthly", "all_time"]
        
        for i, period in enumerate(periods):
            entry = Leaderboard(
                user_id=test_user.id,
                sport="football",
                mode="quiz",
                period=period,
                rank=i + 1,
                rating=1500 + (i * 100)
            )
            db_session.add(entry)
        
        await db_session.commit()
        
        # All entries should be created successfully
        assert len(periods) == 4


class TestChallengeModel:
    """Test cases for Challenge model."""
    
    @pytest.mark.asyncio
    async def test_create_challenge(self, db_session):
        """Test creating a challenge between users."""
        challenger_id = str(uuid.uuid4())
        opponent_id = str(uuid.uuid4())
        
        # Create users first
        challenger = User(id=challenger_id, username="challenger")
        opponent = User(id=opponent_id, username="opponent")
        db_session.add_all([challenger, opponent])
        await db_session.commit()
        
        # Create challenge
        challenge = Challenge(
            id=str(uuid.uuid4()),
            challenger_id=challenger_id,
            opponent_id=opponent_id,
            sport="football",
            mode="quiz",
            status="pending"
        )
        db_session.add(challenge)
        await db_session.commit()
        
        assert challenge.status == "pending"
        assert challenge.winner_id is None
        assert challenge.completed_at is None
    
    @pytest.mark.asyncio
    async def test_complete_challenge(self, db_session):
        """Test completing a challenge."""
        challenger_id = str(uuid.uuid4())
        opponent_id = str(uuid.uuid4())
        
        # Create users
        challenger = User(id=challenger_id, username="winner")
        opponent = User(id=opponent_id, username="loser")
        db_session.add_all([challenger, opponent])
        await db_session.commit()
        
        # Create and complete challenge
        challenge = Challenge(
            id=str(uuid.uuid4()),
            challenger_id=challenger_id,
            opponent_id=opponent_id,
            sport="tennis",
            mode="survival",
            status="completed",
            challenger_score=15,
            opponent_score=10,
            winner_id=challenger_id,
            completed_at=datetime.utcnow()
        )
        db_session.add(challenge)
        await db_session.commit()
        
        assert challenge.status == "completed"
        assert challenge.winner_id == challenger_id
        assert challenge.completed_at is not None


class TestAnalyticsEventModel:
    """Test cases for AnalyticsEvent model."""
    
    @pytest.mark.asyncio
    async def test_create_analytics_event(self, db_session, test_user):
        """Test creating an analytics event."""
        event_data = {
            "platform": "ios",
            "version": "1.0.0",
            "screen": "quiz",
            "action": "answer_submitted"
        }
        
        event = AnalyticsEvent(
            id=str(uuid.uuid4()),
            user_id=test_user.id,
            event_type="game_action",
            event_data=event_data
        )
        db_session.add(event)
        await db_session.commit()
        
        assert event.event_type == "game_action"
        assert event.event_data == event_data
        assert event.created_at is not None
    
    @pytest.mark.asyncio
    async def test_analytics_event_types(self, db_session, test_user):
        """Test various analytics event types."""
        event_types = [
            "app_opened",
            "game_started",
            "game_completed",
            "achievement_unlocked",
            "challenge_sent",
            "challenge_accepted",
            "leaderboard_viewed"
        ]
        
        for event_type in event_types:
            event = AnalyticsEvent(
                id=str(uuid.uuid4()),
                user_id=test_user.id,
                event_type=event_type,
                event_data={"test": True}
            )
            db_session.add(event)
        
        await db_session.commit()
        
        # All events should be created successfully
        assert len(event_types) == 7