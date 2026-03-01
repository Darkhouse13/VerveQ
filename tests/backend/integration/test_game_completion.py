"""
Integration tests for game completion endpoints.
Tests the complete flow from game completion to ELO updates to leaderboard changes.
"""
import pytest
from httpx import AsyncClient
import json

from tests.backend.utils.test_client import TestClient
from backend.database.models import User, UserRating, GameSession
from backend.services.elo_service import EloService
from backend.services.leaderboard_service import LeaderboardService


class TestQuizGameCompletion:
    """Test cases for quiz game completion endpoints."""
    
    @pytest.mark.asyncio
    async def test_complete_quiz_first_game(self, client: AsyncClient, db_session):
        """Test completing first quiz game creates rating and game session."""
        test_client = TestClient(client)
        user_data = await test_client.create_user("firsttimer")
        await test_client.login("firsttimer")
        
        # Complete a quiz game
        completion_data = {
            "user_id": user_data["id"],
            "score": 8,
            "total_questions": 10,
            "accuracy": 0.8,
            "average_time": 6.5,
            "difficulty": "intermediate"
        }
        
        response = await test_client.post(
            "/api/v1/games/football/quiz/complete",
            json=completion_data
        )
        
        assert response.status_code == 200
        result = response.json()
        
        # Verify response structure
        assert "old_rating" in result
        assert "new_rating" in result
        assert "rating_change" in result
        assert "tier" in result
        assert "games_played" in result
        
        # Verify rating creation
        assert result["old_rating"] == 1200.0  # Initial rating
        assert result["new_rating"] > 1200.0  # Should increase with good performance
        assert result["rating_change"] > 0
        assert result["games_played"] == 1
        
        # Verify database records
        # Check UserRating was created
        rating_result = await db_session.execute(
            UserRating.__table__.select().where(
                UserRating.user_id == user_data["id"],
                UserRating.sport == "football",
                UserRating.mode == "quiz"
            )
        )
        user_rating = rating_result.first()
        assert user_rating is not None
        assert user_rating.elo_rating == result["new_rating"]
        assert user_rating.games_played == 1
        assert user_rating.wins == 1  # 8/10 = 0.8 > 0.5 = win
        assert user_rating.best_score == 8
        
        # Check GameSession was created
        session_result = await db_session.execute(
            GameSession.__table__.select().where(
                GameSession.user_id == user_data["id"]
            )
        )
        game_session = session_result.first()
        assert game_session is not None
        assert game_session.sport == "football"
        assert game_session.mode == "quiz"
        assert game_session.score == 8
        assert game_session.elo_before == 1200.0
        assert game_session.elo_after == result["new_rating"]
    
    @pytest.mark.asyncio
    async def test_complete_quiz_existing_player(self, client: AsyncClient, db_session):
        """Test completing quiz for player with existing rating."""
        test_client = TestClient(client)
        user_data = await test_client.create_user("experienced")
        await test_client.login("experienced")
        
        # Create existing rating
        existing_rating = UserRating(
            user_id=user_data["id"],
            sport="football",
            mode="quiz",
            elo_rating=1500.0,
            games_played=10,
            wins=6,
            losses=4,
            best_score=9,
            average_score=7.2
        )
        db_session.add(existing_rating)
        await db_session.commit()
        await db_session.refresh(existing_rating)
        
        # Complete another quiz
        completion_data = {
            "user_id": user_data["id"],
            "score": 10,  # Perfect score
            "total_questions": 10,
            "accuracy": 1.0,
            "average_time": 4.0,  # Fast time
            "difficulty": "hard"  # Harder difficulty
        }
        
        response = await test_client.post(
            "/api/v1/games/football/quiz/complete",
            json=completion_data
        )
        
        assert response.status_code == 200
        result = response.json()
        
        # Verify rating update
        assert result["old_rating"] == 1500.0
        assert result["new_rating"] > 1500.0  # Should increase significantly
        assert result["rating_change"] > 10  # Hard difficulty + perfect score
        assert result["games_played"] == 11
        
        # Verify database update
        await db_session.refresh(existing_rating)
        assert existing_rating.elo_rating == result["new_rating"]
        assert existing_rating.games_played == 11
        assert existing_rating.wins == 7  # Added another win
        assert existing_rating.best_score == 10  # New best score
        
    @pytest.mark.asyncio
    async def test_complete_quiz_poor_performance(self, client: AsyncClient, db_session):
        """Test completing quiz with poor performance loses ELO."""
        test_client = TestClient(client)
        user_data = await test_client.create_user("struggling")
        await test_client.login("struggling")
        
        # Complete quiz with poor performance
        completion_data = {
            "user_id": user_data["id"],
            "score": 2,  # Poor score
            "total_questions": 10,
            "accuracy": 0.2,
            "average_time": 20.0,  # Slow time
            "difficulty": "easy"  # Easy difficulty makes it worse
        }
        
        response = await test_client.post(
            "/api/v1/games/football/quiz/complete",
            json=completion_data
        )
        
        assert response.status_code == 200
        result = response.json()
        
        # Verify rating decreased
        assert result["old_rating"] == 1200.0
        assert result["new_rating"] < 1200.0
        assert result["rating_change"] < 0
        
        # Verify loss recorded
        rating_result = await db_session.execute(
            UserRating.__table__.select().where(
                UserRating.user_id == user_data["id"]
            )
        )
        user_rating = rating_result.first()
        assert user_rating.wins == 0
        assert user_rating.losses == 1
    
    @pytest.mark.asyncio
    async def test_complete_quiz_guest_user(self, client: AsyncClient, db_session):
        """Test completing quiz as guest user."""
        test_client = TestClient(client)
        
        # Create guest session
        guest_response = await client.post("/api/v1/auth/guest-session")
        guest_data = guest_response.json()
        test_client.authenticate_guest(guest_data["session_id"])
        
        # Complete quiz as guest
        completion_data = {
            "user_id": guest_data["user"]["id"],
            "score": 7,
            "total_questions": 10,
            "accuracy": 0.7,
            "average_time": 8.0,
            "difficulty": "intermediate"
        }
        
        response = await test_client.post(
            "/api/v1/games/football/quiz/complete",
            json=completion_data
        )
        
        assert response.status_code == 200
        result = response.json()
        
        # Guest should get response but no persistent rating
        assert "old_rating" in result
        assert "new_rating" in result
        assert result["games_played"] == 1
        
        # Verify no permanent rating created for guest
        rating_result = await db_session.execute(
            UserRating.__table__.select().where(
                UserRating.user_id == guest_data["user"]["id"]
            )
        )
        user_rating = rating_result.first()
        assert user_rating is None  # No permanent record for guest
    
    @pytest.mark.asyncio
    async def test_complete_quiz_multiple_sports(self, client: AsyncClient, db_session):
        """Test completing quizzes for different sports creates separate ratings."""
        test_client = TestClient(client)
        user_data = await test_client.create_user("multisport")
        await test_client.login("multisport")
        
        sports = ["football", "tennis"]
        
        for sport in sports:
            completion_data = {
                "user_id": user_data["id"],
                "score": 8,
                "total_questions": 10,
                "accuracy": 0.8,
                "average_time": 7.0,
                "difficulty": "intermediate"
            }
            
            response = await test_client.post(
                f"/api/v1/games/{sport}/quiz/complete",
                json=completion_data
            )
            
            assert response.status_code == 200
        
        # Verify separate ratings created for each sport
        for sport in sports:
            rating_result = await db_session.execute(
                UserRating.__table__.select().where(
                    UserRating.user_id == user_data["id"],
                    UserRating.sport == sport,
                    UserRating.mode == "quiz"
                )
            )
            user_rating = rating_result.first()
            assert user_rating is not None
            assert user_rating.sport == sport


class TestSurvivalGameCompletion:
    """Test cases for survival game completion endpoints."""
    
    @pytest.mark.asyncio
    async def test_complete_survival_first_game(self, client: AsyncClient, db_session):
        """Test completing first survival game."""
        test_client = TestClient(client)
        user_data = await test_client.create_user("survivor")
        await test_client.login("survivor")
        
        completion_data = {
            "user_id": user_data["id"],
            "score": 12,  # Good survival score
            "duration_seconds": 240  # 4 minutes
        }
        
        response = await test_client.post(
            "/api/v1/games/football/survival/complete",
            json=completion_data
        )
        
        assert response.status_code == 200
        result = response.json()
        
        # Verify response
        assert result["old_rating"] == 1200.0
        assert result["new_rating"] > 1200.0
        assert result["rating_change"] > 0
        assert result["games_played"] == 1
        
        # Verify database records
        rating_result = await db_session.execute(
            UserRating.__table__.select().where(
                UserRating.user_id == user_data["id"],
                UserRating.sport == "football",
                UserRating.mode == "survival"
            )
        )
        user_rating = rating_result.first()
        assert user_rating is not None
        assert user_rating.mode == "survival"
        assert user_rating.best_score == 12
    
    @pytest.mark.asyncio
    async def test_complete_survival_excellent_score(self, client: AsyncClient, db_session):
        """Test survival completion with excellent score."""
        test_client = TestClient(client)
        user_data = await test_client.create_user("prosurvival")
        await test_client.login("prosurvival")
        
        completion_data = {
            "user_id": user_data["id"],
            "score": 25,  # Excellent score
            "duration_seconds": 900  # 15 minutes
        }
        
        response = await test_client.post(
            "/api/v1/games/football/survival/complete",
            json=completion_data
        )
        
        assert response.status_code == 200
        result = response.json()
        
        # Should get significant ELO boost
        assert result["rating_change"] > 15
        assert result["new_rating"] > 1250
    
    @pytest.mark.asyncio
    async def test_complete_survival_poor_score(self, client: AsyncClient, db_session):
        """Test survival completion with poor score.""" 
        test_client = TestClient(client)
        user_data = await test_client.create_user("earlyexit")
        await test_client.login("earlyexit")
        
        completion_data = {
            "user_id": user_data["id"],
            "score": 1,  # Poor score - eliminated quickly
            "duration_seconds": 30  # 30 seconds
        }
        
        response = await test_client.post(
            "/api/v1/games/football/survival/complete",
            json=completion_data
        )
        
        assert response.status_code == 200
        result = response.json()
        
        # Should lose ELO
        assert result["rating_change"] < 0
        assert result["new_rating"] < 1200


class TestGameCompletionErrorHandling:
    """Test error handling in game completion."""
    
    @pytest.mark.asyncio
    async def test_complete_quiz_invalid_user(self, client: AsyncClient):
        """Test completing quiz with invalid user ID."""
        completion_data = {
            "user_id": "nonexistent_user",
            "score": 8,
            "total_questions": 10,
            "accuracy": 0.8,
            "average_time": 7.0,
            "difficulty": "intermediate"
        }
        
        response = await client.post(
            "/api/v1/games/football/quiz/complete",
            json=completion_data
        )
        
        # Should handle gracefully
        assert response.status_code in [200, 404, 400]
    
    @pytest.mark.asyncio
    async def test_complete_quiz_invalid_data(self, client: AsyncClient):
        """Test completing quiz with invalid data."""
        test_client = TestClient(client)
        user_data = await test_client.create_user("datatest")
        await test_client.login("datatest")
        
        # Missing required fields
        invalid_data = {
            "user_id": user_data["id"],
            "score": -1,  # Invalid score
            "total_questions": 0,  # Invalid total
        }
        
        response = await test_client.post(
            "/api/v1/games/football/quiz/complete",
            json=invalid_data
        )
        
        # Should return appropriate error
        assert response.status_code in [400, 422]
    
    @pytest.mark.asyncio
    async def test_complete_quiz_unauthenticated(self, client: AsyncClient):
        """Test completing quiz without authentication."""
        completion_data = {
            "user_id": "some_user",
            "score": 8,
            "total_questions": 10,
            "accuracy": 0.8,
            "average_time": 7.0,
            "difficulty": "intermediate"
        }
        
        response = await client.post(
            "/api/v1/games/football/quiz/complete",
            json=completion_data
        )
        
        assert response.status_code == 401


class TestLeaderboardIntegration:
    """Test integration between game completion and leaderboards."""
    
    @pytest.mark.asyncio
    async def test_game_completion_affects_leaderboard(self, client: AsyncClient, db_session):
        """Test that completing games updates leaderboard rankings."""
        test_client = TestClient(client)
        
        # Create multiple users
        users = []
        for i in range(3):
            user_data = await test_client.create_user(f"player{i+1}")
            await test_client.login(f"player{i+1}")
            
            # Complete games with different scores
            completion_data = {
                "user_id": user_data["id"],
                "score": 5 + i * 2,  # Scores: 5, 7, 9
                "total_questions": 10,
                "accuracy": (5 + i * 2) / 10,
                "average_time": 8.0,
                "difficulty": "intermediate"
            }
            
            response = await test_client.post(
                "/api/v1/games/football/quiz/complete",
                json=completion_data
            )
            assert response.status_code == 200
            
            users.append((user_data, response.json()))
        
        # Check leaderboard reflects the rankings
        leaderboard_response = await test_client.get("/api/v1/leaderboards/global")
        assert leaderboard_response.status_code == 200
        leaderboard = leaderboard_response.json()
        
        # Should be ordered by ELO (player3 > player2 > player1)
        assert len(leaderboard) >= 3
        
        # Find our users in leaderboard
        our_players = [entry for entry in leaderboard 
                      if entry['username'] in ['player1', 'player2', 'player3']]
        
        # Verify ranking order (higher scores should have higher ELO)
        assert len(our_players) == 3
        player_elos = {entry['username']: entry['elo_rating'] for entry in our_players}
        assert player_elos['player3'] > player_elos['player2'] > player_elos['player1']
    
    @pytest.mark.asyncio
    async def test_multiple_games_ranking_evolution(self, client: AsyncClient, db_session):
        """Test that rankings change correctly as players play more games."""
        test_client = TestClient(client)
        
        # Create two users
        user1_data = await test_client.create_user("improver")
        user2_data = await test_client.create_user("decliner")
        
        # Initial games - user2 starts better
        await test_client.login("improver")
        response1 = await test_client.post("/api/v1/games/football/quiz/complete", json={
            "user_id": user1_data["id"], "score": 6, "total_questions": 10,
            "accuracy": 0.6, "average_time": 8.0, "difficulty": "intermediate"
        })
        
        await test_client.login("decliner") 
        response2 = await test_client.post("/api/v1/games/football/quiz/complete", json={
            "user_id": user2_data["id"], "score": 9, "total_questions": 10,
            "accuracy": 0.9, "average_time": 6.0, "difficulty": "intermediate"
        })
        
        initial_rating1 = response1.json()["new_rating"]
        initial_rating2 = response2.json()["new_rating"]
        assert initial_rating2 > initial_rating1  # user2 starts higher
        
        # User1 improves dramatically, user2 declines
        await test_client.login("improver")
        for _ in range(5):
            await test_client.post("/api/v1/games/football/quiz/complete", json={
                "user_id": user1_data["id"], "score": 10, "total_questions": 10,
                "accuracy": 1.0, "average_time": 4.0, "difficulty": "hard"
            })
        
        await test_client.login("decliner")
        for _ in range(5):
            await test_client.post("/api/v1/games/football/quiz/complete", json={
                "user_id": user2_data["id"], "score": 3, "total_questions": 10,
                "accuracy": 0.3, "average_time": 15.0, "difficulty": "easy"
            })
        
        # Check final leaderboard
        leaderboard_response = await test_client.get("/api/v1/leaderboards/global")
        leaderboard = leaderboard_response.json()
        
        # Find our users
        improver_entry = next(e for e in leaderboard if e['username'] == 'improver')
        decliner_entry = next(e for e in leaderboard if e['username'] == 'decliner')
        
        # Rankings should have flipped
        assert improver_entry['elo_rating'] > decliner_entry['elo_rating']
        assert improver_entry['rank'] < decliner_entry['rank']


class TestConcurrentGameCompletion:
    """Test concurrent game completion scenarios."""
    
    @pytest.mark.asyncio
    async def test_concurrent_quiz_completion(self, client: AsyncClient, db_session):
        """Test multiple users completing games simultaneously."""
        import asyncio
        
        test_client = TestClient(client)
        
        # Create multiple users
        users = []
        for i in range(5):
            user_data = await test_client.create_user(f"concurrent{i+1}")
            users.append(user_data)
        
        # Define completion tasks
        async def complete_quiz(user_data, score):
            await test_client.login(user_data["username"])
            return await test_client.post("/api/v1/games/football/quiz/complete", json={
                "user_id": user_data["id"],
                "score": score,
                "total_questions": 10,
                "accuracy": score / 10,
                "average_time": 7.0,
                "difficulty": "intermediate"
            })
        
        # Run concurrent completions
        tasks = [complete_quiz(users[i], 5 + i) for i in range(5)]
        responses = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Verify all completions succeeded
        for response in responses:
            if isinstance(response, Exception):
                pytest.fail(f"Concurrent completion failed: {response}")
            assert response.status_code == 200
        
        # Verify all ratings were created correctly
        for i, user_data in enumerate(users):
            rating_result = await db_session.execute(
                UserRating.__table__.select().where(
                    UserRating.user_id == user_data["id"],
                    UserRating.sport == "football",
                    UserRating.mode == "quiz"
                )
            )
            user_rating = rating_result.first()
            assert user_rating is not None
            assert user_rating.best_score == 5 + i