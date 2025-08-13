"""
Factory classes for generating test data using factory_boy.
"""
import factory
from factory import fuzzy
from datetime import datetime, timedelta
import random
import uuid

from backend.database.models import (
    User, UserRating, GameSession, Achievement, 
    UserAchievement, Leaderboard, AnalyticsEvent, Challenge
)


class UserFactory(factory.Factory):
    """Factory for creating User instances."""
    
    class Meta:
        model = User
    
    id = factory.LazyFunction(lambda: str(uuid.uuid4()))
    username = factory.Sequence(lambda n: f"user{n}")
    email = factory.LazyAttribute(lambda obj: f"{obj.username}@example.com")
    display_name = factory.LazyAttribute(lambda obj: f"User {obj.username}")
    created_at = factory.LazyFunction(datetime.utcnow)
    avatar_url = None
    is_guest = False
    last_active = factory.LazyFunction(datetime.utcnow)


class GuestUserFactory(UserFactory):
    """Factory for creating guest User instances."""
    
    username = factory.Sequence(lambda n: f"guest_{uuid.uuid4().hex[:8]}")
    email = None
    display_name = "Guest Player"
    is_guest = True


class UserRatingFactory(factory.Factory):
    """Factory for creating UserRating instances."""
    
    class Meta:
        model = UserRating
    
    user_id = factory.LazyAttribute(lambda obj: obj.user.id if hasattr(obj, 'user') else str(uuid.uuid4()))
    sport = factory.fuzzy.FuzzyChoice(["football", "tennis"])
    mode = factory.fuzzy.FuzzyChoice(["quiz", "survival"])
    rating = factory.fuzzy.FuzzyInteger(800, 2000)
    games_played = factory.fuzzy.FuzzyInteger(0, 100)
    wins = factory.LazyAttribute(lambda obj: random.randint(0, obj.games_played))
    losses = factory.LazyAttribute(lambda obj: obj.games_played - obj.wins)
    peak_rating = factory.LazyAttribute(lambda obj: max(obj.rating, random.randint(obj.rating, obj.rating + 200)))
    last_game_at = factory.LazyFunction(datetime.utcnow)
    win_streak = factory.fuzzy.FuzzyInteger(0, 10)
    best_win_streak = factory.LazyAttribute(lambda obj: max(obj.win_streak, random.randint(0, 15)))


class GameSessionFactory(factory.Factory):
    """Factory for creating GameSession instances."""
    
    class Meta:
        model = GameSession
    
    id = factory.LazyFunction(lambda: str(uuid.uuid4()))
    user_id = factory.LazyAttribute(lambda obj: obj.user.id if hasattr(obj, 'user') else str(uuid.uuid4()))
    sport = factory.fuzzy.FuzzyChoice(["football", "tennis"])
    mode = factory.fuzzy.FuzzyChoice(["quiz", "survival"])
    score = factory.fuzzy.FuzzyInteger(0, 100)
    questions_answered = factory.fuzzy.FuzzyInteger(5, 20)
    correct_answers = factory.LazyAttribute(lambda obj: min(obj.questions_answered, random.randint(0, obj.questions_answered)))
    accuracy = factory.LazyAttribute(lambda obj: (obj.correct_answers / obj.questions_answered * 100) if obj.questions_answered > 0 else 0)
    performance_rating = factory.fuzzy.FuzzyInteger(800, 2000)
    rating_change = factory.fuzzy.FuzzyInteger(-50, 50)
    started_at = factory.LazyFunction(lambda: datetime.utcnow() - timedelta(minutes=random.randint(5, 30)))
    ended_at = factory.LazyFunction(datetime.utcnow)
    duration_seconds = factory.LazyAttribute(lambda obj: int((obj.ended_at - obj.started_at).total_seconds()))
    won = factory.fuzzy.FuzzyChoice([True, False])
    opponent_rating = factory.fuzzy.FuzzyInteger(800, 2000)
    
    # Additional game data
    data = factory.LazyFunction(lambda: {
        "device": random.choice(["mobile", "web", "tablet"]),
        "version": "1.0.0",
        "difficulty": random.choice(["easy", "medium", "hard"])
    })


class AchievementFactory(factory.Factory):
    """Factory for creating Achievement instances."""

    class Meta:
        model = Achievement

    id = factory.Sequence(lambda n: f"achievement_{n}")
    name = factory.Faker("catch_phrase")
    description = factory.Faker("sentence")
    icon = factory.fuzzy.FuzzyChoice(["🏆", "⭐", "🎯", "💪", "🔥", "🎮", "🥇", "🎖️"])
    category = factory.fuzzy.FuzzyChoice(['score', 'streak', 'milestone'])
    requirements = factory.LazyFunction(lambda: {
        "type": random.choice(["wins", "games_played", "win_streak"]),
        "value": random.randint(1, 100)
    })
    points = factory.fuzzy.FuzzyChoice([10, 25, 50, 100])
    is_hidden = factory.fuzzy.FuzzyChoice([True, False], p=[0.2, 0.8])


class UserAchievementFactory(factory.Factory):
    """Factory for creating UserAchievement instances."""
    
    class Meta:
        model = UserAchievement
    
    user_id = factory.LazyAttribute(lambda obj: obj.user.id if hasattr(obj, 'user') else str(uuid.uuid4()))
    achievement_id = factory.LazyAttribute(lambda obj: obj.achievement.id if hasattr(obj, 'achievement') else f"achievement_{random.randint(1, 10)}")
    unlocked_at = factory.LazyFunction(datetime.utcnow)
    progress = factory.fuzzy.FuzzyInteger(0, 100)


class LeaderboardFactory(factory.Factory):
    """Factory for creating Leaderboard instances."""
    
    class Meta:
        model = Leaderboard
    
    user_id = factory.LazyAttribute(lambda obj: obj.user.id if hasattr(obj, 'user') else str(uuid.uuid4()))
    sport = factory.fuzzy.FuzzyChoice(["football", "tennis"])
    mode = factory.fuzzy.FuzzyChoice(["quiz", "survival"])
    period = factory.fuzzy.FuzzyChoice(["daily", "weekly", "monthly", "all_time"])
    rank = factory.fuzzy.FuzzyInteger(1, 1000)
    rating = factory.fuzzy.FuzzyInteger(800, 2000)
    games_played = factory.fuzzy.FuzzyInteger(1, 100)
    wins = factory.LazyAttribute(lambda obj: random.randint(0, obj.games_played))
    win_rate = factory.LazyAttribute(lambda obj: (obj.wins / obj.games_played * 100) if obj.games_played > 0 else 0)
    updated_at = factory.LazyFunction(datetime.utcnow)


class ChallengeFactory(factory.Factory):
    """Factory for creating Challenge instances."""
    
    class Meta:
        model = Challenge
    
    id = factory.LazyFunction(lambda: str(uuid.uuid4()))
    challenger_id = factory.LazyAttribute(lambda obj: obj.challenger.id if hasattr(obj, 'challenger') else str(uuid.uuid4()))
    opponent_id = factory.LazyAttribute(lambda obj: obj.opponent.id if hasattr(obj, 'opponent') else str(uuid.uuid4()))
    sport = factory.fuzzy.FuzzyChoice(["football", "tennis"])
    mode = factory.fuzzy.FuzzyChoice(["quiz", "survival"])
    status = factory.fuzzy.FuzzyChoice(["pending", "active", "completed", "declined"])
    challenger_score = factory.fuzzy.FuzzyInteger(0, 100)
    opponent_score = factory.fuzzy.FuzzyInteger(0, 100)
    winner_id = None  # Set based on scores if completed
    created_at = factory.LazyFunction(lambda: datetime.utcnow() - timedelta(hours=random.randint(1, 48)))
    completed_at = None  # Set if status is completed
    
    @factory.post_generation
    def set_winner(obj, create, extracted, **kwargs):
        """Set winner based on scores if challenge is completed."""
        if obj.status == "completed" and obj.challenger_score is not None and obj.opponent_score is not None:
            if obj.challenger_score > obj.opponent_score:
                obj.winner_id = obj.challenger_id
            elif obj.opponent_score > obj.challenger_score:
                obj.winner_id = obj.opponent_id
            obj.completed_at = datetime.utcnow()


class AnalyticsEventFactory(factory.Factory):
    """Factory for creating AnalyticsEvent instances."""
    
    class Meta:
        model = AnalyticsEvent
    
    id = factory.LazyFunction(lambda: str(uuid.uuid4()))
    user_id = factory.LazyAttribute(lambda obj: obj.user.id if hasattr(obj, 'user') else str(uuid.uuid4()))
    event_type = factory.fuzzy.FuzzyChoice([
        "game_started", "game_completed", "achievement_unlocked",
        "challenge_sent", "challenge_accepted", "app_opened",
        "leaderboard_viewed", "profile_viewed"
    ])
    event_data = factory.LazyFunction(lambda: {
        "platform": random.choice(["ios", "android", "web"]),
        "version": "1.0.0",
        "timestamp": datetime.utcnow().isoformat()
    })
    created_at = factory.LazyFunction(datetime.utcnow)


# Helper functions for creating related objects
def create_user_with_ratings(username: str = None, sports: list = None, **kwargs) -> tuple:
    """Create a user with ratings for specified sports."""
    user = UserFactory(username=username, **kwargs)
    sports = sports or ["football", "tennis"]
    ratings = []
    
    for sport in sports:
        for mode in ["quiz", "survival"]:
            rating = UserRatingFactory(user=user, sport=sport, mode=mode)
            ratings.append(rating)
    
    return user, ratings


def create_game_session_with_user(user=None, **kwargs) -> tuple:
    """Create a game session with associated user."""
    if not user:
        user = UserFactory()
    
    session = GameSessionFactory(user=user, **kwargs)
    return user, session


def create_completed_challenge(challenger=None, opponent=None, **kwargs) -> Challenge:
    """Create a completed challenge between two users."""
    if not challenger:
        challenger = UserFactory()
    if not opponent:
        opponent = UserFactory()
    
    challenge = ChallengeFactory(
        challenger=challenger,
        opponent=opponent,
        status="completed",
        **kwargs
    )
    return challenge