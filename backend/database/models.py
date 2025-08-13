from sqlalchemy import Column, Integer, String, Float, DateTime, Boolean, Text, ForeignKey, JSON, Index
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid

Base = declarative_base()

class User(Base):
    __tablename__ = "users"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    username = Column(String(50), unique=True, nullable=False)
    email = Column(String(255), unique=True, nullable=True)
    display_name = Column(String(100), nullable=False)
    avatar_url = Column(String(500), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    last_active = Column(DateTime, default=datetime.utcnow)
    is_active = Column(Boolean, default=True)
    total_games = Column(Integer, default=0)
    
    # Relationships
    ratings = relationship("UserRating", back_populates="user")
    game_sessions = relationship("GameSession", back_populates="user")
    achievements = relationship("UserAchievement", back_populates="user")
    analytics_events = relationship("AnalyticsEvent", back_populates="user")

class UserRating(Base):
    __tablename__ = "user_ratings"
    
    id = Column(Integer, primary_key=True)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    sport = Column(String(50), nullable=False)
    mode = Column(String(50), nullable=False)  # 'quiz' or 'survival'
    elo_rating = Column(Float, default=1200.0)
    games_played = Column(Integer, default=0)
    wins = Column(Integer, default=0)
    losses = Column(Integer, default=0)
    best_score = Column(Integer, default=0)
    average_score = Column(Float, default=0.0)
    average_time_per_game = Column(Float, default=0.0)
    last_played = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    user = relationship("User", back_populates="ratings")
    
    __table_args__ = (
        Index('idx_user_sport_mode', 'user_id', 'sport', 'mode'),
    )

class GameSession(Base):
    __tablename__ = "game_sessions"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    sport = Column(String(50), nullable=False)
    mode = Column(String(50), nullable=False)
    score = Column(Integer, nullable=False)
    total_questions = Column(Integer, nullable=True)  # For quiz mode
    accuracy = Column(Float, nullable=True)  # For quiz mode
    duration_seconds = Column(Integer, nullable=True)
    average_answer_time_seconds = Column(Float, nullable=True)
    details = Column(JSON, nullable=True)
    elo_before = Column(Float, nullable=False)
    elo_after = Column(Float, nullable=False)
    elo_change = Column(Float, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    user = relationship("User", back_populates="game_sessions")
    
    __table_args__ = (
        Index('idx_user_created_at', 'user_id', 'created_at'),
    )

class Achievement(Base):
    __tablename__ = "achievements"
    
    id = Column(String, primary_key=True)
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=False)
    category = Column(String(50), nullable=False)  # 'score', 'streak', 'milestone', etc.
    icon = Column(String(10), nullable=False)
    points = Column(Integer, default=0)
    requirements = Column(JSON, nullable=False)  # Store achievement criteria
    is_hidden = Column(Boolean, default=False)
    
    # Relationships
    user_achievements = relationship("UserAchievement", back_populates="achievement")

class UserAchievement(Base):
    __tablename__ = "user_achievements"
    
    id = Column(Integer, primary_key=True)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    achievement_id = Column(String, ForeignKey("achievements.id"), nullable=False)
    unlocked_at = Column(DateTime, default=datetime.utcnow)
    progress = Column(JSON, nullable=True)  # Track progress towards achievement
    
    # Relationships
    user = relationship("User", back_populates="achievements")
    achievement = relationship("Achievement", back_populates="user_achievements")

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
    updated_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    user = relationship("User")
    
    __table_args__ = (
        Index('idx_sport_mode_rank', 'sport', 'mode', 'rank'),
    )

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
    user = relationship("User", back_populates="analytics_events")
    
    __table_args__ = (
        Index('idx_user_timestamp', 'user_id', 'timestamp'),
    )

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
    challenger = relationship("User", foreign_keys=[challenger_id])
    challenged = relationship("User", foreign_keys=[challenged_id])
    winner = relationship("User", foreign_keys=[winner_id])