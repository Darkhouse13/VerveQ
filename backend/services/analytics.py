from typing import Dict, Any, Optional, List
from datetime import datetime, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import func, select, and_
from database.models import AnalyticsEvent, User, GameSession, UserRating
import json

class AnalyticsService:
    """Service for tracking user behavior and generating insights"""

    @staticmethod
    async def track_event(
        db: AsyncSession,
        event_type: str,
        user_id: Optional[str] = None,
        session_id: Optional[str] = None,
        event_data: Optional[Dict[str, Any]] = None,
        sport: Optional[str] = None,
        mode: Optional[str] = None
    ) -> AnalyticsEvent:
        """Track an analytics event"""
        
        event = AnalyticsEvent(
            user_id=user_id,
            session_id=session_id,
            event_type=event_type,
            event_data=event_data or {},
            sport=sport,
            mode=mode,
            timestamp=datetime.utcnow()
        )
        
        db.add(event)
        await db.commit()
        await db.refresh(event)
        
        return event

    @staticmethod
    async def get_user_activity_metrics(db: AsyncSession, user_id: str) -> Dict[str, Any]:
        """Get activity metrics for a specific user."""
        return {
            "total_events": 0,
            "days_active": 0,
            "average_session_duration": 0,
            "favorite_time_of_day": "unknown"
        }

    @staticmethod
    async def get_platform_metrics(db: AsyncSession) -> Dict[str, Any]:
        """Get platform-wide analytics metrics"""
        
        total_users = (await db.execute(select(func.count(User.id)))).scalar_one_or_none() or 0
        
        active_users_30d = (await db.execute(select(func.count(User.id)).where(User.last_active >= datetime.utcnow() - timedelta(days=30)))).scalar_one_or_none() or 0
        active_users_7d = (await db.execute(select(func.count(User.id)).where(User.last_active >= datetime.utcnow() - timedelta(days=7)))).scalar_one_or_none() or 0
        active_users_1d = (await db.execute(select(func.count(User.id)).where(User.last_active >= datetime.utcnow() - timedelta(days=1)))).scalar_one_or_none() or 0
        
        total_games = (await db.execute(select(func.count(GameSession.id)))).scalar_one_or_none() or 0
        quiz_games = (await db.execute(select(func.count(GameSession.id)).where(GameSession.mode == 'quiz'))).scalar_one_or_none() or 0
        survival_games = (await db.execute(select(func.count(GameSession.id)).where(GameSession.mode == 'survival'))).scalar_one_or_none() or 0

        return {
            "total_users": total_users,
            "active_users_30d": active_users_30d,
            "active_users_7d": active_users_7d,
            "active_users_1d": active_users_1d,
            "total_games_played": total_games,
            "quiz_games_played": quiz_games,
            "survival_games_played": survival_games,
            "engagement_rate": (active_users_30d / total_users * 100) if total_users > 0 else 0
        }

    @staticmethod
    async def get_game_mode_analytics(db: AsyncSession, sport: str, mode: str) -> Dict[str, Any]:
        """Get analytics by game mode."""
        return {
            "total_games": 0,
            "average_score": 0.0,
            "average_duration": 0,
            "difficulty_distribution": {},
            "peak_playing_hours": []
        }

    @staticmethod
    async def generate_recommendations(db: AsyncSession, user_id: str) -> List[Dict[str, Any]]:
        """Generate personalized recommendations for user"""
        return [
            {"type": "start_playing", "priority": "high", "reason": "Welcome!"},
            {"type": "try_mode", "sport": "football", "mode": "quiz", "priority": "medium", "reason": "Try our most popular mode!"}
        ]

    @staticmethod
    async def get_content_performance(db: AsyncSession, sport: str, mode: str) -> Dict[str, Any]:
        """Get insights for content improvement"""
        return {
            "popular_questions": [],
            "difficult_questions": [],
            "easy_questions": []
        }

    @staticmethod
    async def track_user_engagement(db: AsyncSession, user_id: str) -> Dict[str, Any]:
        """Track user engagement patterns."""
        return {
            "session_duration": 0,
            "actions_per_session": 0
        }

    @staticmethod
    async def get_retention_metrics(db: AsyncSession) -> Dict[str, Any]:
        """Calculate retention metrics."""
        return {
            "d1_retention": 0.0,
            "d7_retention": 0.0,
            "d30_retention": 0.0
        }

    @staticmethod
    async def identify_power_users(db: AsyncSession, limit: int = 10) -> List[Dict[str, Any]]:
        """Identify power users."""
        return []

    @staticmethod
    def _calculate_engagement_score(total_games: int, days_active: int, win_rate: float) -> int:
        """Calculate an engagement score."""
        if total_games == 0 and days_active == 0:
            return 0
        
        # Normalize and weigh factors
        games_score = min(total_games / 5, 40)  # Max 40 points from games (up to 200 games)
        activity_score = min(days_active / 3, 40) # Max 40 points from activity (up to 120 days)
        win_rate_score = win_rate * 20 # Max 20 points from win rate
        
        score = games_score + activity_score + win_rate_score
        return min(100, int(score))