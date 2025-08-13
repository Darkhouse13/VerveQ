"""
Integration tests for game routes.
Tests quiz and survival game endpoints with complete flows.
"""
import pytest
from httpx import AsyncClient
import json

from tests.backend.utils.test_client import TestClient
from backend.database.models import UserRating, GameSession


class TestQuizGameRoutes:
    """Test cases for quiz game endpoints."""
    
    @pytest.mark.asyncio
    async def test_start_quiz_authenticated(self, client: AsyncClient, db_session):
        """Test starting a quiz game as authenticated user."""
        test_client = TestClient(client)
        
        # Create and authenticate user
        await test_client.create_user("quizplayer")
        await test_client.login("quizplayer")
        
        # Start quiz
        response = await test_client.post("/api/v1/games/quiz/football/start")
        
        assert response.status_code == 200
        data = response.json()
        
        assert "question" in data
        assert "options" in data
        assert len(data["options"]) == 4
        assert "question_id" in data
        assert "questions_remaining" in data
        assert data["questions_remaining"] >= 0
    
    @pytest.mark.asyncio
    async def test_start_quiz_guest(self, client: AsyncClient):
        """Test starting a quiz game as guest."""
        test_client = TestClient(client)
        
        # Create guest session
        guest_response = await client.post("/api/v1/auth/guest-session")
        guest_data = guest_response.json()
        test_client.authenticate_guest(guest_data["session_id"])
        
        # Start quiz
        response = await test_client.post("/api/v1/games/quiz/football/start")
        
        assert response.status_code == 200
        data = response.json()
        assert "question" in data
    
    @pytest.mark.asyncio
    async def test_start_quiz_unauthenticated(self, client: AsyncClient):
        """Test starting a quiz without authentication."""
        response = await client.post("/api/v1/games/quiz/football/start")
        
        assert response.status_code == 401
        assert "Not authenticated" in response.json()["detail"]
    
    @pytest.mark.asyncio
    async def test_quiz_different_sports(self, client: AsyncClient):
        """Test starting quiz for different sports."""
        test_client = TestClient(client)
        await test_client.create_user("sportplayer")
        await test_client.login("sportplayer")
        
        sports = ["football", "tennis"]
        
        for sport in sports:
            response = await test_client.post(f"/api/v1/games/quiz/{sport}/start")
            assert response.status_code == 200
            data = response.json()
            assert "question" in data
    
    @pytest.mark.asyncio
    async def test_submit_quiz_answer_correct(self, client: AsyncClient, db_session):
        """Test submitting a correct quiz answer."""
        test_client = TestClient(client)
        await test_client.create_user("quizmaster")
        await test_client.login("quizmaster")
        
        # Start quiz
        start_response = await test_client.post("/api/v1/games/quiz/football/start")
        question_data = start_response.json()
        
        # Find correct answer (in real test, we'd mock this)
        # For now, submit first option
        response = await test_client.post(
            "/api/v1/games/quiz/football/answer",
            json={
                "question_id": question_data["question_id"],
                "answer": question_data["options"][0]
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert "correct" in data
        assert isinstance(data["correct"], bool)
        assert "score" in data
        assert "questions_answered" in data
        assert "correct_answers" in data
        
        if "next_question" in data:
            assert "question" in data["next_question"]
            assert "options" in data["next_question"]
    
    @pytest.mark.asyncio
    async def test_submit_quiz_answer_invalid_question_id(self, client: AsyncClient):
        """Test submitting answer with invalid question ID."""
        test_client = TestClient(client)
        await test_client.create_user("invalidplayer")
        await test_client.login("invalidplayer")
        
        # Start quiz to establish session
        await test_client.post("/api/v1/games/quiz/football/start")
        
        # Submit with invalid question ID
        response = await test_client.post(
            "/api/v1/games/quiz/football/answer",
            json={
                "question_id": 99999,
                "answer": "Some Answer"
            }
        )
        
        assert response.status_code == 400
        assert "Invalid question" in response.json()["detail"]
    
    @pytest.mark.asyncio
    async def test_complete_quiz_flow(self, client: AsyncClient, db_session):
        """Test completing a full quiz game."""
        test_client = TestClient(client)
        user_data = await test_client.create_user("completeplayer")
        await test_client.login("completeplayer")
        
        # Start quiz
        response = await test_client.post("/api/v1/games/quiz/football/start")
        assert response.status_code == 200
        
        questions_answered = 0
        max_questions = 10  # Prevent infinite loop
        
        while questions_answered < max_questions:
            question_data = response.json()
            
            # Submit answer
            answer_response = await test_client.post(
                "/api/v1/games/quiz/football/answer",
                json={
                    "question_id": question_data.get("question_id", 
                                                    question_data.get("next_question", {}).get("question_id")),
                    "answer": question_data.get("options", 
                                               question_data.get("next_question", {}).get("options", []))[0]
                }
            )
            
            assert answer_response.status_code == 200
            answer_data = answer_response.json()
            questions_answered += 1
            
            if "game_complete" in answer_data and answer_data["game_complete"]:
                # Game is complete
                assert "final_score" in answer_data
                assert "rating_change" in answer_data
                assert "new_rating" in answer_data
                assert "accuracy" in answer_data
                break
            
            response = answer_response
        
        # Verify game session was created
        session = await db_session.execute(
            GameSession.__table__.select().where(
                GameSession.user_id == user_data["id"]
            )
        )
        game_session = session.first()
        assert game_session is not None
    
    @pytest.mark.asyncio
    async def test_quiz_session_persistence(self, client: AsyncClient):
        """Test that quiz session persists between requests."""
        test_client = TestClient(client)
        await test_client.create_user("sessionplayer")
        await test_client.login("sessionplayer")
        
        # Start quiz
        start_response = await test_client.post("/api/v1/games/quiz/football/start")
        first_question = start_response.json()
        
        # Submit answer
        answer_response = await test_client.post(
            "/api/v1/games/quiz/football/answer",
            json={
                "question_id": first_question["question_id"],
                "answer": first_question["options"][0]
            }
        )
        
        answer_data = answer_response.json()
        assert answer_data["questions_answered"] == 1
        
        # Submit another answer
        if "next_question" in answer_data:
            second_response = await test_client.post(
                "/api/v1/games/quiz/football/answer",
                json={
                    "question_id": answer_data["next_question"]["question_id"],
                    "answer": answer_data["next_question"]["options"][0]
                }
            )
            
            second_data = second_response.json()
            assert second_data["questions_answered"] == 2


class TestSurvivalGameRoutes:
    """Test cases for survival game endpoints."""
    
    @pytest.mark.asyncio
    async def test_start_survival_authenticated(self, client: AsyncClient):
        """Test starting a survival game as authenticated user."""
        test_client = TestClient(client)
        await test_client.create_user("survivalplayer")
        await test_client.login("survivalplayer")
        
        response = await test_client.post("/api/v1/games/survival/football/start")
        
        assert response.status_code == 200
        data = response.json()
        
        assert "initials" in data
        assert "round" in data
        assert data["round"] == 1
        assert "lives" in data
        assert data["lives"] == 3
        assert len(data["initials"]) == 2  # Two letter initials
    
    @pytest.mark.asyncio
    async def test_submit_survival_guess_correct(self, client: AsyncClient):
        """Test submitting a correct survival guess."""
        test_client = TestClient(client)
        await test_client.create_user("guesser")
        await test_client.login("guesser")
        
        # Start survival
        start_response = await test_client.post("/api/v1/games/survival/football/start")
        game_data = start_response.json()
        
        # Submit a guess (in real test, we'd know valid players)
        response = await test_client.post(
            "/api/v1/games/survival/football/guess",
            json={"player_name": "Cristiano Ronaldo"}  # Common player
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert "correct" in data
        assert isinstance(data["correct"], bool)
        assert "round" in data
        assert "lives" in data
        assert "score" in data
        
        if data["correct"]:
            assert data["round"] == 2  # Advanced to next round
        else:
            assert data["lives"] <= 2  # Lost a life
    
    @pytest.mark.asyncio
    async def test_survival_game_over(self, client: AsyncClient):
        """Test survival game over scenario."""
        test_client = TestClient(client)
        await test_client.create_user("loser")
        await test_client.login("loser")
        
        # Start survival
        await test_client.post("/api/v1/games/survival/football/start")
        
        # Make wrong guesses to lose all lives
        wrong_guesses = ["Invalid Player Name", "Another Wrong Name", "Third Wrong Name"]
        
        for i, guess in enumerate(wrong_guesses):
            response = await test_client.post(
                "/api/v1/games/survival/football/guess",
                json={"player_name": guess}
            )
            
            data = response.json()
            
            if data.get("game_over", False):
                assert "final_score" in data
                assert "rating_change" in data
                assert "new_rating" in data
                assert data["lives"] == 0
                break
    
    @pytest.mark.asyncio
    async def test_survival_different_sports(self, client: AsyncClient):
        """Test survival game for different sports."""
        test_client = TestClient(client)
        await test_client.create_user("multisport")
        await test_client.login("multisport")
        
        # Test football
        football_response = await test_client.post("/api/v1/games/survival/football/start")
        assert football_response.status_code == 200
        football_data = football_response.json()
        assert "initials" in football_data
        
        # Test tennis
        tennis_response = await test_client.post("/api/v1/games/survival/tennis/start")
        assert tennis_response.status_code == 200
        tennis_data = tennis_response.json()
        assert "initials" in tennis_data
    
    @pytest.mark.asyncio
    async def test_survival_session_persistence(self, client: AsyncClient):
        """Test that survival session persists between guesses."""
        test_client = TestClient(client)
        await test_client.create_user("persistent")
        await test_client.login("persistent")
        
        # Start game
        start_response = await test_client.post("/api/v1/games/survival/football/start")
        start_data = start_response.json()
        initial_round = start_data["round"]
        initial_lives = start_data["lives"]
        
        # Make a guess
        guess_response = await test_client.post(
            "/api/v1/games/survival/football/guess",
            json={"player_name": "Test Player"}
        )
        
        guess_data = guess_response.json()
        
        # Verify session maintained state
        if guess_data["correct"]:
            assert guess_data["round"] == initial_round + 1
            assert guess_data["lives"] == initial_lives
        else:
            assert guess_data["round"] == initial_round
            assert guess_data["lives"] == initial_lives - 1


class TestGameStatistics:
    """Test cases for game statistics and ratings."""
    
    @pytest.mark.asyncio
    async def test_rating_updates_after_game(self, client: AsyncClient, db_session):
        """Test that ratings are updated after completing a game."""
        test_client = TestClient(client)
        user_data = await test_client.create_user("ratingtest")
        await test_client.login("ratingtest")
        
        # Check initial rating (should be created on first game)
        await test_client.post("/api/v1/games/quiz/football/start")
        
        # Complete a quiz with some answers
        for _ in range(5):
            response = await test_client.post(
                "/api/v1/games/quiz/football/answer",
                json={
                    "question_id": 1,  # Simplified for test
                    "answer": "Test Answer"
                }
            )
            
            if response.status_code == 200:
                data = response.json()
                if data.get("game_complete", False):
                    assert "rating_change" in data
                    assert "new_rating" in data
                    break
        
        # Verify rating was created/updated in database
        rating = await db_session.execute(
            UserRating.__table__.select().where(
                UserRating.user_id == user_data["id"],
                UserRating.sport == "football",
                UserRating.mode == "quiz"
            )
        )
        user_rating = rating.first()
        assert user_rating is not None
        assert user_rating.games_played >= 1
    
    @pytest.mark.asyncio
    async def test_guest_games_no_rating(self, client: AsyncClient, db_session):
        """Test that guest games don't create ratings."""
        # Create guest session
        guest_response = await client.post("/api/v1/auth/guest-session")
        guest_data = guest_response.json()
        
        test_client = TestClient(client)
        test_client.authenticate_guest(guest_data["session_id"])
        
        # Play a game
        await test_client.post("/api/v1/games/quiz/football/start")
        response = await test_client.post(
            "/api/v1/games/quiz/football/answer",
            json={
                "question_id": 1,
                "answer": "Test"
            }
        )
        
        # Guests should still get responses but no ratings
        assert response.status_code == 200
        
        # Verify no rating was created for guest
        rating = await db_session.execute(
            UserRating.__table__.select().where(
                UserRating.user_id == guest_data["user"]["id"]
            )
        )
        assert rating.first() is None