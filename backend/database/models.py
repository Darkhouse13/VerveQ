from sqlalchemy import Column, Integer, String, Float, DateTime, Boolean, Text, ForeignKey, JSON, Index, UniqueConstraint
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid
import hashlib

Base = declarative_base()


class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    username = Column(String(50), unique=True, nullable=False)
    email = Column(String(255), unique=True, nullable=True)
    display_name = Column(String(100), nullable=True)
    avatar_url = Column(String(500), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    last_active = Column(DateTime, default=datetime.utcnow)
    is_active = Column(Boolean, default=True)
    is_guest = Column(Boolean, default=False)
    total_games = Column(Integer, default=0)

    # Relationships
    ratings = relationship("UserRating", back_populates="user", lazy="selectin")
    game_sessions = relationship("GameSession", back_populates="user", lazy="selectin")
    achievements = relationship("UserAchievement", back_populates="user", lazy="selectin")
    analytics_events = relationship("AnalyticsEvent", back_populates="user", lazy="selectin")

    def __init__(self, **kwargs):  # type: ignore[no-untyped-def]
        if not kwargs.get('display_name') and kwargs.get('username'):
            kwargs.setdefault('display_name', kwargs['username'])
        super().__init__(**kwargs)


class UserRating(Base):
    __tablename__ = "user_ratings"

    id = Column(Integer, primary_key=True)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    sport = Column(String(50), nullable=False)
    mode = Column(String(50), nullable=False)  # 'quiz' or 'survival'
    elo_rating = Column(Float, default=1200.0)
    peak_rating = Column(Float, default=1200.0)
    games_played = Column(Integer, default=0)
    wins = Column(Integer, default=0)
    losses = Column(Integer, default=0)
    best_score = Column(Integer, default=0)
    average_score = Column(Float, default=0.0)
    average_time_per_game = Column(Float, default=0.0)
    last_played = Column(DateTime, default=datetime.utcnow)

    # Relationships
    user = relationship("User", back_populates="ratings", lazy="joined")

    __table_args__ = (
        UniqueConstraint('user_id', 'sport', 'mode', name='uq_user_sport_mode'),
        Index('idx_user_sport_mode', 'user_id', 'sport', 'mode'),
    )

    def __init__(self, **kwargs):  # type: ignore[no-untyped-def]
        rating = kwargs.pop('rating', None)
        peak_rating = kwargs.pop('peak_rating', None)
        super().__init__(**kwargs)
        if rating is not None:
            self.elo_rating = float(rating)
        if peak_rating is not None:
            self.peak_rating = float(peak_rating)
        elif rating is not None:
            self.peak_rating = float(self.elo_rating)
        if self.peak_rating is None:
            self.peak_rating = float(self.elo_rating)

    @property
    def rating(self) -> float:
        return float(self.elo_rating)

    @rating.setter
    def rating(self, value: float) -> None:
        self.elo_rating = float(value)

    @property
    def win_rate(self) -> float:
        if not self.games_played:
            return 0.0
        return round((self.wins or 0) / float(self.games_played) * 100.0, 2)


class GameSession(Base):
    __tablename__ = "game_sessions"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    sport = Column(String(50), nullable=False)
    mode = Column(String(50), nullable=False)
    score = Column(Integer, nullable=True)
    total_questions = Column(Integer, nullable=True)  # For quiz mode
    correct_answers = Column(Integer, nullable=True)
    accuracy = Column(Float, nullable=True)  # For quiz mode
    duration_seconds = Column(Integer, nullable=True)
    average_answer_time_seconds = Column(Float, nullable=True)
    details = Column(JSON, nullable=True)
    elo_before = Column(Float, nullable=True, default=1200.0)
    elo_after = Column(Float, nullable=True, default=1200.0)
    elo_change = Column(Float, nullable=True, default=0.0)
    started_at = Column(DateTime, default=datetime.utcnow)
    ended_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    user = relationship("User", back_populates="game_sessions", lazy="joined")

    __table_args__ = (
        Index('idx_user_created_at', 'user_id', 'created_at'),
    )

    def __init__(self, **kwargs):  # type: ignore[no-untyped-def]
        questions_answered = kwargs.pop('questions_answered', None)
        correct_answers = kwargs.pop('correct_answers', None)
        started_at = kwargs.pop('started_at', None)
        ended_at = kwargs.pop('ended_at', None)
        data = kwargs.pop('data', None)
        super().__init__(**kwargs)
        if questions_answered is not None:
            self.total_questions = questions_answered
        if correct_answers is not None:
            self.correct_answers = correct_answers
        if started_at is not None:
            self.started_at = started_at
        if ended_at is not None:
            self.ended_at = ended_at
        if data is not None:
            self.details = data
        self._sync_accuracy()

    def _sync_accuracy(self) -> None:
        if self.total_questions and self.total_questions > 0 and self.correct_answers is not None:
            self.accuracy = round((self.correct_answers / float(self.total_questions)) * 100.0, 2)

    @property
    def questions_answered(self) -> int:
        return self.total_questions or 0

    @questions_answered.setter
    def questions_answered(self, value: int) -> None:
        self.total_questions = value
        self._sync_accuracy()

    @property
    def data(self):  # type: ignore[override]
        return self.details or {}

    @data.setter
    def data(self, value) -> None:  # type: ignore[override]
        self.details = value


class Achievement(Base):
    __tablename__ = "achievements"

    id = Column(String, primary_key=True)
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=False)
    category = Column(String(50), nullable=False, default='milestone')
    icon = Column(String(10), nullable=True)
    points = Column(Integer, default=0)
    requirements = Column(JSON, nullable=True)
    requirement_type = Column(String(100), nullable=True)
    requirement_value = Column(Integer, nullable=True)
    is_hidden = Column(Boolean, default=False)

    # Relationships
    user_achievements = relationship("UserAchievement", back_populates="achievement", lazy="selectin")

    def __init__(self, **kwargs):  # type: ignore[no-untyped-def]
        if 'hidden' in kwargs and 'is_hidden' not in kwargs:
            kwargs['is_hidden'] = kwargs.pop('hidden')
        super().__init__(**kwargs)

    @property
    def hidden(self) -> bool:
        return bool(self.is_hidden)

    @hidden.setter
    def hidden(self, value: bool) -> None:
        self.is_hidden = bool(value)


class UserAchievement(Base):
    __tablename__ = "user_achievements"

    id = Column(Integer, primary_key=True)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    achievement_id = Column(String, ForeignKey("achievements.id"), nullable=False)
    unlocked_at = Column(DateTime, nullable=True)
    progress = Column(JSON, nullable=True)

    # Relationships
    user = relationship("User", back_populates="achievements", lazy="joined")
    achievement = relationship("Achievement", back_populates="user_achievements", lazy="joined")


class Leaderboard(Base):
    __tablename__ = "leaderboards"

    id = Column(Integer, primary_key=True)
    sport = Column(String(50), nullable=False)
    mode = Column(String(50), nullable=False)
    period = Column(String(20), nullable=False)  # 'daily', 'weekly', 'monthly', 'all_time'
    rank = Column(Integer, nullable=False)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    score = Column(Integer, nullable=False)
    elo_rating = Column(Float, nullable=False)
    games_played = Column(Integer, default=0)
    wins = Column(Integer, default=0)
    updated_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    user = relationship("User", lazy="joined")

    __table_args__ = (
        Index('idx_sport_mode_rank', 'sport', 'mode', 'rank'),
    )

    def __init__(self, **kwargs):  # type: ignore[no-untyped-def]
        rating = kwargs.pop('rating', None)
        score = kwargs.pop('score', None)
        super().__init__(**kwargs)
        if rating is not None:
            self.elo_rating = float(rating)
        if score is not None:
            self.score = int(score)
        elif self.score is None:
            self.score = int(round(self.elo_rating))

    @property
    def rating(self) -> float:
        return float(self.elo_rating)

    @rating.setter
    def rating(self, value: float) -> None:
        self.elo_rating = float(value)

    @property
    def win_rate(self) -> float:
        if not self.games_played:
            return 0.0
        return round((self.wins or 0) / float(self.games_played) * 100.0, 2)


class AnalyticsEvent(Base):
    __tablename__ = "analytics_events"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("users.id"), nullable=True)
    session_id = Column(String, nullable=True)
    event_type = Column(String(100), nullable=False)
    event_data = Column(JSON, nullable=True)
    sport = Column(String(50), nullable=True)
    mode = Column(String(50), nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow)

    # Relationships
    user = relationship("User", back_populates="analytics_events", lazy="joined")

    __table_args__ = (
        Index('idx_user_timestamp', 'user_id', 'timestamp'),
    )

    def __init__(self, **kwargs):  # type: ignore[no-untyped-def]
        created_at = kwargs.pop('created_at', None)
        super().__init__(**kwargs)
        if created_at is not None:
            self.timestamp = created_at

    @property
    def created_at(self):  # type: ignore[override]
        return self.timestamp

    @created_at.setter
    def created_at(self, value):  # type: ignore[override]
        self.timestamp = value


class Challenge(Base):
    __tablename__ = "challenges"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    challenger_id = Column(String, ForeignKey("users.id"), nullable=False)
    challenged_id = Column(String, ForeignKey("users.id"), nullable=False)
    sport = Column(String(50), nullable=False)
    mode = Column(String(50), nullable=False)
    challenger_score = Column(Integer, nullable=True)
    challenged_score = Column(Integer, nullable=True)
    status = Column(String(20), default='pending')  # 'pending', 'completed', 'declined'
    winner_id = Column(String, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)

    # Relationships
    challenger = relationship("User", foreign_keys=[challenger_id], lazy="joined")
    challenged = relationship("User", foreign_keys=[challenged_id], lazy="joined")
    winner = relationship("User", foreign_keys=[winner_id], lazy="joined")

    def __init__(self, **kwargs):  # type: ignore[no-untyped-def]
        opponent_id = kwargs.pop('opponent_id', None)
        opponent_score = kwargs.pop('opponent_score', None)
        super().__init__(**kwargs)
        if opponent_id is not None:
            self.challenged_id = opponent_id
        if opponent_score is not None:
            self.challenged_score = opponent_score

    @property
    def opponent_id(self) -> str:
        return self.challenged_id

    @opponent_id.setter
    def opponent_id(self, value: str) -> None:
        self.challenged_id = value

    @property
    def opponent_score(self) -> int | None:
        return self.challenged_score

    @opponent_score.setter
    def opponent_score(self, value: int | None) -> None:
        self.challenged_score = value


class QuizQuestion(Base):
    __tablename__ = "quiz_questions"

    id = Column(Integer, primary_key=True)
    sport = Column(String(50), nullable=False)
    category = Column(String(100), nullable=False)
    question = Column(Text, nullable=False)
    options = Column(JSON, nullable=False)  # List of 4 options
    correct_answer = Column(String(200), nullable=False)
    explanation = Column(Text, nullable=True)
    difficulty = Column(String(20), default="intermediate")  # easy/intermediate/hard
    bucket = Column(String(100), nullable=False)  # For ID buckets
    checksum = Column(String(32), nullable=False, unique=True)  # MD5 hash

    # Difficulty feedback tracking
    difficulty_votes = Column(Integer, default=0)
    difficulty_score = Column(Float, default=0.5)  # 0-1 scale (0=easy, 1=hard)
    times_answered = Column(Integer, default=0)
    times_correct = Column(Integer, default=0)

    # Performance tracking
    usage_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        Index('ix_quiz_questions_bucket', 'sport', 'difficulty', 'bucket'),
        Index('ix_quiz_questions_checksum', 'checksum'),
        Index('ix_quiz_questions_sport_difficulty', 'sport', 'difficulty'),
    )

    @staticmethod
    def generate_checksum(question: str, correct_answer: str) -> str:
        """Generate MD5 checksum for question deduplication"""
        content = f"{question}|{correct_answer}".lower().strip()
        return hashlib.md5(content.encode()).hexdigest()[:16]

    @staticmethod
    def generate_bucket_name(sport: str, difficulty: str, category: str, index: int) -> str:
        """Generate bucket name for ID organization"""
        return f"{sport}_{difficulty}_{category}_{index}".replace(" ", "_").lower()





