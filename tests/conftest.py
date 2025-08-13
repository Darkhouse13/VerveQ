"""
Global pytest configuration and fixtures for VerveQ tests.
"""
import asyncio
import json
import os
import sys
from typing import AsyncGenerator, Generator
from datetime import datetime, timedelta

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy import create_engine
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

# Add backend to Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

from backend.database.connection import Base, get_db
from backend.database.models import User, UserRating, GameSession, Achievement
from backend.main import app
from backend.auth.jwt_auth import AuthService


# Test database URL - using in-memory SQLite for speed
TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"


@pytest.fixture(scope="session")
def event_loop():
    """Create an instance of the default event loop for the test session."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture
async def test_db():
    """Create a test database with all tables."""
    # Create async engine for testing
    engine = create_async_engine(
        TEST_DATABASE_URL,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    
    # Create all tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    # Create session factory
    async_session_maker = sessionmaker(
        engine, class_=AsyncSession, expire_on_commit=False
    )
    
    async with async_session_maker() as session:
        # Add default achievements
        default_achievements = [
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
            )
        ]
        
        for achievement in default_achievements:
            session.add(achievement)
        
        await session.commit()
    
    yield engine
    
    # Cleanup
    await engine.dispose()


@pytest_asyncio.fixture
async def db_session(test_db):
    """Get a database session for testing."""
    async_session_maker = sessionmaker(
        test_db, class_=AsyncSession, expire_on_commit=False
    )
    
    async with async_session_maker() as session:
        yield session
        await session.rollback()


@pytest_asyncio.fixture
async def client(test_db):
    """Create a test client with database override."""
    async_session_maker = sessionmaker(
        test_db, class_=AsyncSession, expire_on_commit=False
    )
    
    async def override_get_db():
        async with async_session_maker() as session:
            yield session
    
    app.dependency_overrides[get_db] = override_get_db
    
    async with AsyncClient(app=app, base_url="http://test") as ac:
        yield ac
    
    app.dependency_overrides.clear()


@pytest.fixture
def sample_user_data():
    """Sample user data for testing."""
    return {
        "username": "testuser",
        "email": "test@example.com",
        "display_name": "Test User"
    }


@pytest.fixture
def auth_headers(sample_user_data):
    """Generate authentication headers with a valid JWT token."""
    token = AuthService.create_access_token(
        data={
            "sub": "test-user-id",
            "username": sample_user_data["username"],
            "type": "user"
        }
    )
    return {"Authorization": f"Bearer {token}"}


@pytest_asyncio.fixture
async def test_user(db_session, sample_user_data):
    """Create a test user in the database."""
    user = User(
        id="test-user-id",
        username=sample_user_data["username"],
        email=sample_user_data["email"],
        display_name=sample_user_data["display_name"],
        created_at=datetime.utcnow()
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest_asyncio.fixture
async def test_user_with_rating(db_session, test_user):
    """Create a test user with ELO ratings."""
    ratings = [
        UserRating(
            user_id=test_user.id,
            sport="football",
            mode="quiz",
            rating=1500,
            games_played=10,
            peak_rating=1600
        ),
        UserRating(
            user_id=test_user.id,
            sport="football",
            mode="survival",
            rating=1400,
            games_played=5,
            peak_rating=1450
        )
    ]
    
    for rating in ratings:
        db_session.add(rating)
    
    await db_session.commit()
    return test_user


@pytest.fixture
def quiz_questions():
    """Sample quiz questions for testing."""
    return [
        {
            "id": 1,
            "question": "Who won the 2022 Ballon d'Or?",
            "options": ["Messi", "Benzema", "Mbappe", "Haaland"],
            "correct_answer": "Benzema",
            "explanation": "Karim Benzema won the 2022 Ballon d'Or."
        },
        {
            "id": 2,
            "question": "Which team won the 2021 Premier League?",
            "options": ["Man City", "Man United", "Liverpool", "Chelsea"],
            "correct_answer": "Man City",
            "explanation": "Manchester City won the 2020-21 Premier League."
        }
    ]


@pytest.fixture
def survival_data():
    """Sample survival game data for testing."""
    return {
        "initials": "CR",
        "players": ["Cristiano Ronaldo", "Casemiro", "Carvajal"],
        "sport": "football"
    }


@pytest.fixture
def mock_datetime(monkeypatch):
    """Mock datetime for consistent testing."""
    class MockDatetime:
        @staticmethod
        def utcnow():
            return datetime(2024, 1, 1, 12, 0, 0)
        
        @staticmethod
        def now():
            return datetime(2024, 1, 1, 12, 0, 0)
    
    monkeypatch.setattr("datetime.datetime", MockDatetime)
    return MockDatetime