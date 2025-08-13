"""
Database utilities for testing.
"""
from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.database.connection import Base
from backend.database.models import Achievement


class TestDatabase:
    """Test database helper class."""
    
    def __init__(self, database_url: str = "sqlite+aiosqlite:///:memory:"):
        self.database_url = database_url
        self.engine = None
        self.async_session_maker = None
    
    async def create(self):
        """Create test database with tables."""
        self.engine = create_async_engine(
            self.database_url,
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        
        async with self.engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        
        self.async_session_maker = sessionmaker(
            self.engine, class_=AsyncSession, expire_on_commit=False
        )
        
        # Add default data
        await self._add_default_data()
    
    async def _add_default_data(self):
        """Add default data required for tests."""
        async with self.async_session_maker() as session:
            # Add default achievements
            achievements = [
                Achievement(
                    id="first_win",
                    name="First Victory",
                    description="Win your first game",
                    icon="🏆",
                    requirement_type="wins",
                    requirement_value=1,
                    points=10
                ),
                Achievement(
                    id="quiz_master",
                    name="Quiz Master",
                    description="Score 100% in a quiz",
                    icon="🎯",
                    requirement_type="perfect_score",
                    requirement_value=1,
                    points=50
                ),
                Achievement(
                    id="survival_expert",
                    name="Survival Expert",
                    description="Survive 20 rounds",
                    icon="💪",
                    requirement_type="survival_rounds",
                    requirement_value=20,
                    points=30
                ),
                Achievement(
                    id="streak_starter",
                    name="Streak Starter",
                    description="Win 5 games in a row",
                    icon="🔥",
                    requirement_type="win_streak",
                    requirement_value=5,
                    points=25
                ),
                Achievement(
                    id="dedicated_player",
                    name="Dedicated Player",
                    description="Play 50 games",
                    icon="⭐",
                    requirement_type="games_played",
                    requirement_value=50,
                    points=40
                )
            ]
            
            for achievement in achievements:
                session.add(achievement)
            
            await session.commit()
    
    async def get_session(self) -> AsyncGenerator[AsyncSession, None]:
        """Get a database session."""
        async with self.async_session_maker() as session:
            yield session
    
    async def cleanup(self):
        """Clean up database resources."""
        if self.engine:
            await self.engine.dispose()
    
    async def clear_data(self):
        """Clear all data except default records."""
        async with self.async_session_maker() as session:
            # Clear user-generated data
            await session.execute("DELETE FROM analytics_events")
            await session.execute("DELETE FROM challenges")
            await session.execute("DELETE FROM leaderboards")
            await session.execute("DELETE FROM user_achievements")
            await session.execute("DELETE FROM game_sessions")
            await session.execute("DELETE FROM user_ratings")
            await session.execute("DELETE FROM users")
            await session.commit()


async def create_test_database(database_url: str = "sqlite+aiosqlite:///:memory:") -> TestDatabase:
    """Create and initialize a test database."""
    db = TestDatabase(database_url)
    await db.create()
    return db