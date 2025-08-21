"""
Integration tests for achievement endpoints
Following CLAUDE.md testing principles (<300 lines)
"""
import pytest
from httpx import AsyncClient
from sqlalchemy.orm import Session

from backend.database.models import Achievement, UserAchievement, User, GameSession
from tests.backend.utils.test_client import TestClient


class TestAchievementRoutes:
    """Test achievement API endpoints"""
    
    @pytest.mark.asyncio
    async def test_list_achievements(self, client: AsyncClient):
        """Test listing all available achievements"""
        response = await client.get("/achievements/")
        
        assert response.status_code == 200
        data = response.json()
        
        # Should return list of achievements
        assert isinstance(data, list)
        assert len(data) > 0
        
        # Check achievement structure
        achievement = data[0]
        required_fields = ["id", "name", "description", "category", "icon", "points", "is_hidden"]
        for field in required_fields:
            assert field in achievement
    
    @pytest.mark.asyncio
    async def test_get_user_achievements_empty(self, client: AsyncClient, test_user: User):
        """Test getting achievements for user with no achievements"""
        response = await client.get(f"/achievements/user/{test_user.id}")
        
        assert response.status_code == 200
        data = response.json()
        
        # Should return empty list
        assert isinstance(data, list)
        assert len(data) == 0
    
    @pytest.mark.asyncio
    async def test_get_user_achievements_with_unlocked(self, client: AsyncClient, test_db: Session):
        """Test getting achievements for user with unlocked achievements"""
        # Create test user
        user = User(
            id="test_user_achievements",
            username="achiever",
            display_name="Achiever",
            email="achiever@test.com"
        )
        test_db.add(user)
        test_db.commit()
        
        # Create user achievement
        user_achievement = UserAchievement(
            user_id=user.id,
            achievement_id="first_quiz"
        )
        test_db.add(user_achievement)
        test_db.commit()
        
        response = await client.get(f"/achievements/user/{user.id}")
        
        assert response.status_code == 200
        data = response.json()
        
        # Should return list with one achievement
        assert isinstance(data, list)
        assert len(data) == 1
        
        # Check structure
        user_achievement = data[0]
        assert "achievement" in user_achievement
        assert "unlocked_at" in user_achievement
        assert user_achievement["achievement"]["id"] == "first_quiz"
    
    @pytest.mark.asyncio
    async def test_get_user_achievements_invalid_user(self, client: AsyncClient):
        """Test getting achievements for non-existent user"""
        response = await client.get("/achievements/user/nonexistent")
        
        assert response.status_code == 404
        data = response.json()
        assert "detail" in data
        assert "not found" in data["detail"].lower()
    
    @pytest.mark.asyncio
    async def test_check_achievements_no_games(self, client: AsyncClient, test_user: User):
        """Test checking achievements for user with no games"""
        response = await client.post(f"/achievements/check/{test_user.id}")
        
        assert response.status_code == 200
        data = response.json()
        
        # Should have proper structure
        assert "newly_unlocked" in data
        assert "total_unlocked" in data
        assert "total_points" in data
        
        # Should be empty since no games played
        assert isinstance(data["newly_unlocked"], list)
        assert len(data["newly_unlocked"]) == 0
        assert data["total_unlocked"] == 0
        assert data["total_points"] == 0
    
    @pytest.mark.asyncio
    async def test_check_achievements_with_games(self, client: AsyncClient, test_db: Session):
        """Test checking achievements unlocks achievements correctly"""
        # Create test user
        user = User(
            id="test_user_games",
            username="gamer",
            display_name="Gamer",
            email="gamer@test.com"
        )
        test_db.add(user)
        test_db.commit()
        
        # Add a quiz game session
        quiz_session = GameSession(
            user_id=user.id,
            sport="football",
            mode="quiz",
            score=80,
            accuracy=100.0,  # Perfect score
            elo_before=1200,
            elo_after=1220,
            elo_change=20
        )
        test_db.add(quiz_session)
        test_db.commit()
        
        response = await client.post(f"/achievements/check/{user.id}")
        
        assert response.status_code == 200
        data = response.json()
        
        # Should unlock achievements
        assert len(data["newly_unlocked"]) >= 1
        assert "first_quiz" in data["newly_unlocked"]
        
        # If accuracy is 100%, should also unlock quiz_master
        if quiz_session.accuracy == 100.0:
            assert "quiz_master" in data["newly_unlocked"]
    
    @pytest.mark.asyncio
    async def test_check_achievements_invalid_user(self, client: AsyncClient):
        """Test checking achievements for non-existent user"""
        response = await client.post("/achievements/check/nonexistent")
        
        assert response.status_code == 404
        data = response.json()
        assert "detail" in data
        assert "not found" in data["detail"].lower()
    
    @pytest.mark.asyncio
    async def test_check_achievements_idempotent(self, client: AsyncClient, test_db: Session):
        """Test that checking achievements twice doesn't unlock same achievement twice"""
        # Create test user with game
        user = User(
            id="test_user_idempotent",
            username="idempotent",
            display_name="Idempotent",
            email="idempotent@test.com"
        )
        test_db.add(user)
        
        quiz_session = GameSession(
            user_id=user.id,
            sport="football",
            mode="quiz",
            score=50,
            accuracy=80.0,
            elo_before=1200,
            elo_after=1210,
            elo_change=10
        )
        test_db.add(quiz_session)
        test_db.commit()
        
        # First check - should unlock first_quiz
        response1 = await client.post(f"/achievements/check/{user.id}")
        assert response1.status_code == 200
        data1 = response1.json()
        
        first_unlocked_count = len(data1["newly_unlocked"])
        assert first_unlocked_count >= 1
        assert "first_quiz" in data1["newly_unlocked"]
        
        # Second check - should not unlock anything new
        response2 = await client.post(f"/achievements/check/{user.id}")
        assert response2.status_code == 200
        data2 = response2.json()
        
        # Should have no newly unlocked achievements
        assert len(data2["newly_unlocked"]) == 0
        # But total should remain the same
        assert data2["total_unlocked"] == data1["total_unlocked"]