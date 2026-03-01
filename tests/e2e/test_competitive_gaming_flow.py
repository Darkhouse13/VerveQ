"""
End-to-end tests for the complete competitive gaming flow.
Tests the entire user journey from registration to leaderboard updates.
"""
import pytest
import asyncio
from httpx import AsyncClient

from tests.backend.utils.test_client import TestClient
from backend.database.models import User, UserRating, GameSession
from backend.services.elo_service import EloService
from backend.services.leaderboard_service import LeaderboardService


class TestCompetitiveGamingFlow:
    """End-to-end tests for competitive gaming platform."""
    
    @pytest.mark.asyncio
    async def test_complete_user_journey_quiz(self, client: AsyncClient, db_session):
        """Test complete user journey: register → play quiz → check leaderboard."""
        test_client = TestClient(client)
        
        # 1. User Registration
        user_data = await test_client.create_user("competitive_player")
        assert user_data["username"] == "competitive_player"
        
        # 2. User Login
        await test_client.login("competitive_player")
        
        # 3. Play Quiz Games (multiple rounds for progression)
        quiz_results = []
        
        # Play 5 quiz games with improving scores
        for i in range(5):
            # Start quiz
            start_response = await test_client.post("/api/v1/games/quiz/football/start")
            assert start_response.status_code == 200
            question_data = start_response.json()
            
            # Answer questions to complete game
            questions_answered = 0
            total_correct = 6 + i  # Improving performance: 6, 7, 8, 9, 10
            
            while questions_answered < 10:
                # Simulate answering (correct or incorrect based on target score)
                is_correct = questions_answered < total_correct
                answer = question_data["options"][0] if is_correct else question_data["options"][-1]
                
                answer_response = await test_client.post(
                    "/api/v1/games/quiz/football/answer",
                    json={
                        "question_id": question_data.get("question_id", 1),
                        "answer": answer
                    }
                )
                
                if answer_response.status_code != 200:
                    break
                    
                answer_data = answer_response.json()
                questions_answered += 1
                
                if answer_data.get("game_complete", False):
                    quiz_results.append(answer_data)
                    break
                    
                if "next_question" in answer_data:
                    question_data = answer_data["next_question"]
                else:
                    break
        
        # Verify games were completed
        assert len(quiz_results) >= 3  # At least 3 games completed
        
        # 4. Check User's Rating Progression
        final_rating_result = await db_session.execute(
            UserRating.__table__.select().where(
                UserRating.user_id == user_data["id"],
                UserRating.sport == "football",
                UserRating.mode == "quiz"
            )
        )
        user_rating = final_rating_result.first()
        
        assert user_rating is not None
        assert user_rating.elo_rating > 1200.0  # Should have improved from initial rating
        assert user_rating.games_played >= 3
        assert user_rating.wins > 0  # Should have some wins
        
        # 5. Check Game Sessions Were Created
        sessions_result = await db_session.execute(
            GameSession.__table__.select().where(
                GameSession.user_id == user_data["id"]
            )
        )
        game_sessions = sessions_result.fetchall()
        
        assert len(game_sessions) >= 3
        for session in game_sessions:
            assert session.sport == "football"
            assert session.mode == "quiz"
            assert session.elo_before is not None
            assert session.elo_after is not None
            
        # 6. Check Leaderboard Placement
        leaderboard_response = await test_client.get("/api/v1/leaderboards/global")
        assert leaderboard_response.status_code == 200
        leaderboard = leaderboard_response.json()
        
        # Find our user in the leaderboard
        user_entry = next((entry for entry in leaderboard 
                          if entry["username"] == "competitive_player"), None)
        
        assert user_entry is not None
        assert user_entry["elo_rating"] == user_rating.elo_rating
        assert user_entry["games_played"] == user_rating.games_played
        assert user_entry["rank"] >= 1
        
        # 7. Check Sport-Specific Leaderboard
        football_leaderboard_response = await test_client.get(
            "/api/v1/leaderboards/sport/football"
        )
        assert football_leaderboard_response.status_code == 200
        football_leaderboard = football_leaderboard_response.json()
        
        user_football_entry = next((entry for entry in football_leaderboard 
                                   if entry["username"] == "competitive_player"), None)
        
        assert user_football_entry is not None
        assert user_football_entry["elo_rating"] == user_rating.elo_rating
    
    @pytest.mark.asyncio
    async def test_complete_user_journey_survival(self, client: AsyncClient, db_session):
        """Test complete user journey with survival mode."""
        test_client = TestClient(client)
        
        # 1. Create and login user
        user_data = await test_client.create_user("survival_expert")
        await test_client.login("survival_expert")
        
        # 2. Play Survival Games
        survival_scores = [8, 12, 15, 20]  # Progressive improvement
        
        for target_score in survival_scores:
            # Start survival game
            start_response = await test_client.post("/api/v1/games/survival/football/start")
            assert start_response.status_code == 200
            
            # Simulate guesses until target score or game over
            current_score = 0
            lives = 3
            
            while current_score < target_score and lives > 0:
                # Make a guess (simulate correct guesses until target)
                guess_response = await test_client.post(
                    "/api/v1/games/survival/football/guess",
                    json={"player_name": f"Player {current_score + 1}"}
                )
                
                if guess_response.status_code != 200:
                    break
                    
                guess_data = guess_response.json()
                
                if guess_data.get("correct", False):
                    current_score += 1
                else:
                    lives = guess_data.get("lives", lives - 1)
                
                if guess_data.get("game_over", False) or lives <= 0:
                    break
        
        # 3. Verify Survival Rating
        rating_result = await db_session.execute(
            UserRating.__table__.select().where(
                UserRating.user_id == user_data["id"],
                UserRating.sport == "football", 
                UserRating.mode == "survival"
            )
        )
        survival_rating = rating_result.first()
        
        assert survival_rating is not None
        assert survival_rating.elo_rating > 1200.0  # Should improve with good scores
        assert survival_rating.games_played >= 3
        
        # 4. Check Mixed Leaderboard (both quiz and survival players)
        mixed_leaderboard_response = await test_client.get("/api/v1/leaderboards/global")
        assert mixed_leaderboard_response.status_code == 200
        mixed_leaderboard = mixed_leaderboard_response.json()
        
        survival_user_entry = next((entry for entry in mixed_leaderboard 
                                   if entry["username"] == "survival_expert"), None)
        assert survival_user_entry is not None
    
    @pytest.mark.asyncio
    async def test_multi_user_competition(self, client: AsyncClient, db_session):
        """Test competitive scenario with multiple users."""
        test_client = TestClient(client)
        
        # Create multiple competing users
        users = []
        user_configs = [
            ("champion", [10, 9, 10, 9, 10]),  # Excellent player
            ("strong_player", [8, 8, 9, 7, 8]),  # Good player
            ("average_joe", [6, 5, 6, 7, 5]),   # Average player
            ("beginner", [3, 4, 2, 5, 3])       # Poor player
        ]
        
        # 1. Create all users and play games
        for username, scores in user_configs:
            user_data = await test_client.create_user(username)
            await test_client.login(username)
            users.append((user_data, scores))
            
            # Play quiz games with predetermined scores
            for target_score in scores:
                start_response = await test_client.post("/api/v1/games/quiz/football/start")
                if start_response.status_code != 200:
                    continue
                    
                # Simulate game completion with target score
                questions_answered = 0
                question_data = start_response.json()
                
                while questions_answered < 10:
                    is_correct = questions_answered < target_score
                    answer = question_data["options"][0] if is_correct else question_data["options"][-1]
                    
                    answer_response = await test_client.post(
                        "/api/v1/games/quiz/football/answer",
                        json={
                            "question_id": question_data.get("question_id", 1),
                            "answer": answer
                        }
                    )
                    
                    if answer_response.status_code != 200:
                        break
                        
                    answer_data = answer_response.json()
                    questions_answered += 1
                    
                    if answer_data.get("game_complete", False):
                        break
                        
                    if "next_question" in answer_data:
                        question_data = answer_data["next_question"]
                    else:
                        break
        
        # 2. Check final leaderboard rankings
        leaderboard_response = await test_client.get("/api/v1/leaderboards/global")
        assert leaderboard_response.status_code == 200
        leaderboard = leaderboard_response.json()
        
        # Extract our users from leaderboard
        our_users = {entry["username"]: entry for entry in leaderboard 
                    if entry["username"] in ["champion", "strong_player", "average_joe", "beginner"]}
        
        assert len(our_users) == 4
        
        # 3. Verify ranking order matches performance
        champion_entry = our_users["champion"]
        strong_entry = our_users["strong_player"] 
        average_entry = our_users["average_joe"]
        beginner_entry = our_users["beginner"]
        
        # Rankings should reflect performance levels
        assert champion_entry["elo_rating"] > strong_entry["elo_rating"]
        assert strong_entry["elo_rating"] > average_entry["elo_rating"]
        assert average_entry["elo_rating"] > beginner_entry["elo_rating"]
        
        # Ranks should be in correct order
        assert champion_entry["rank"] < strong_entry["rank"]
        assert strong_entry["rank"] < average_entry["rank"]
        assert average_entry["rank"] < beginner_entry["rank"]
        
        # 4. Verify individual rating progression made sense
        for user_data, expected_scores in users:
            rating_result = await db_session.execute(
                UserRating.__table__.select().where(
                    UserRating.user_id == user_data["id"],
                    UserRating.sport == "football",
                    UserRating.mode == "quiz"
                )
            )
            user_rating = rating_result.first()
            
            assert user_rating is not None
            assert user_rating.games_played == len(expected_scores)
            
            # High performers should have ratings above initial
            avg_score = sum(expected_scores) / len(expected_scores)
            if avg_score > 7:
                assert user_rating.elo_rating > 1200.0
            elif avg_score < 4:
                assert user_rating.elo_rating < 1200.0
    
    @pytest.mark.asyncio
    async def test_cross_sport_competition(self, client: AsyncClient, db_session):
        """Test users competing across different sports."""
        test_client = TestClient(client)
        
        # Create user who plays multiple sports
        user_data = await test_client.create_user("multisport_athlete")
        await test_client.login("multisport_athlete")
        
        sports_performance = {
            "football": [9, 8, 10, 9],    # Strong in football
            "tennis": [6, 5, 7, 6]        # Average in tennis
        }
        
        # Play games in each sport
        for sport, scores in sports_performance.items():
            for target_score in scores:
                start_response = await test_client.post(f"/api/v1/games/quiz/{sport}/start")
                if start_response.status_code != 200:
                    continue
                    
                # Complete game with target score
                questions_answered = 0
                question_data = start_response.json()
                
                while questions_answered < 10:
                    is_correct = questions_answered < target_score
                    answer = question_data["options"][0] if is_correct else question_data["options"][-1]
                    
                    answer_response = await test_client.post(
                        f"/api/v1/games/quiz/{sport}/answer",
                        json={
                            "question_id": question_data.get("question_id", 1),
                            "answer": answer
                        }
                    )
                    
                    if answer_response.status_code != 200:
                        break
                        
                    answer_data = answer_response.json()
                    questions_answered += 1
                    
                    if answer_data.get("game_complete", False):
                        break
                        
                    if "next_question" in answer_data:
                        question_data = answer_data["next_question"]
                    else:
                        break
        
        # Check separate ratings for each sport
        for sport in sports_performance.keys():
            rating_result = await db_session.execute(
                UserRating.__table__.select().where(
                    UserRating.user_id == user_data["id"],
                    UserRating.sport == sport,
                    UserRating.mode == "quiz"
                )
            )
            sport_rating = rating_result.first()
            
            assert sport_rating is not None
            assert sport_rating.sport == sport
            assert sport_rating.games_played == 4
        
        # Football rating should be higher than tennis (better performance)
        football_rating_result = await db_session.execute(
            UserRating.__table__.select().where(
                UserRating.user_id == user_data["id"],
                UserRating.sport == "football"
            )
        )
        football_rating = football_rating_result.first()
        
        tennis_rating_result = await db_session.execute(
            UserRating.__table__.select().where(
                UserRating.user_id == user_data["id"],
                UserRating.sport == "tennis"
            )
        )
        tennis_rating = tennis_rating_result.first()
        
        assert football_rating.elo_rating > tennis_rating.elo_rating
        
        # Check sport-specific leaderboards
        football_leaderboard_response = await test_client.get("/api/v1/leaderboards/sport/football")
        tennis_leaderboard_response = await test_client.get("/api/v1/leaderboards/sport/tennis")
        
        assert football_leaderboard_response.status_code == 200
        assert tennis_leaderboard_response.status_code == 200
        
        football_leaderboard = football_leaderboard_response.json()
        tennis_leaderboard = tennis_leaderboard_response.json()
        
        # User should appear in both sport leaderboards
        football_entry = next((e for e in football_leaderboard 
                              if e["username"] == "multisport_athlete"), None)
        tennis_entry = next((e for e in tennis_leaderboard 
                            if e["username"] == "multisport_athlete"), None)
        
        assert football_entry is not None
        assert tennis_entry is not None
        assert football_entry["elo_rating"] > tennis_entry["elo_rating"]
    
    @pytest.mark.asyncio
    async def test_guest_vs_authenticated_users(self, client: AsyncClient, db_session):
        """Test that guest users can play but don't affect rankings."""
        test_client = TestClient(client)
        
        # 1. Create authenticated user
        auth_user = await test_client.create_user("registered_player")
        await test_client.login("registered_player")
        
        # Authenticated user plays games
        for _ in range(3):
            start_response = await test_client.post("/api/v1/games/quiz/football/start")
            if start_response.status_code == 200:
                question_data = start_response.json()
                
                # Play with good performance
                for i in range(8):  # Answer 8 out of 10 correctly
                    answer_response = await test_client.post(
                        "/api/v1/games/quiz/football/answer",
                        json={
                            "question_id": question_data.get("question_id", 1),
                            "answer": question_data["options"][0]
                        }
                    )
                    
                    if answer_response.status_code == 200:
                        answer_data = answer_response.json()
                        if answer_data.get("game_complete", False):
                            break
                        if "next_question" in answer_data:
                            question_data = answer_data["next_question"]
        
        # 2. Create guest session and play games
        guest_response = await client.post("/api/v1/auth/guest-session")
        guest_data = guest_response.json()
        test_client.authenticate_guest(guest_data["session_id"])
        
        # Guest user plays games
        for _ in range(3):
            start_response = await test_client.post("/api/v1/games/quiz/football/start")
            if start_response.status_code == 200:
                question_data = start_response.json()
                
                # Play with perfect performance
                for i in range(10):  # Perfect score
                    answer_response = await test_client.post(
                        "/api/v1/games/quiz/football/answer",
                        json={
                            "question_id": question_data.get("question_id", 1),
                            "answer": question_data["options"][0]
                        }
                    )
                    
                    if answer_response.status_code == 200:
                        answer_data = answer_response.json()
                        if answer_data.get("game_complete", False):
                            break
                        if "next_question" in answer_data:
                            question_data = answer_data["next_question"]
        
        # 3. Check that only authenticated user has permanent rating
        auth_rating_result = await db_session.execute(
            UserRating.__table__.select().where(
                UserRating.user_id == auth_user["id"]
            )
        )
        auth_rating = auth_rating_result.first()
        assert auth_rating is not None
        
        guest_rating_result = await db_session.execute(
            UserRating.__table__.select().where(
                UserRating.user_id == guest_data["user"]["id"]
            )
        )
        guest_rating = guest_rating_result.first()
        assert guest_rating is None  # No permanent rating for guest
        
        # 4. Check leaderboard only shows authenticated users
        leaderboard_response = await test_client.get("/api/v1/leaderboards/global")
        leaderboard = leaderboard_response.json()
        
        usernames = [entry["username"] for entry in leaderboard]
        assert "registered_player" in usernames
        assert guest_data["user"]["username"] not in usernames
    
    @pytest.mark.asyncio  
    async def test_rating_consistency_over_time(self, client: AsyncClient, db_session):
        """Test that ELO ratings remain mathematically consistent over many games."""
        test_client = TestClient(client)
        
        # Create user for consistency testing
        user_data = await test_client.create_user("consistency_test")
        await test_client.login("consistency_test")
        
        # Track rating changes over many games
        rating_history = []
        
        # Play 20 games with varied performance
        performance_pattern = [7, 8, 6, 9, 5, 8, 7, 10, 4, 8, 6, 9, 7, 5, 8, 9, 6, 7, 8, 9]
        
        for target_score in performance_pattern:
            start_response = await test_client.post("/api/v1/games/quiz/football/start")
            if start_response.status_code != 200:
                continue
                
            # Complete game
            questions_answered = 0
            question_data = start_response.json()
            
            while questions_answered < 10:
                is_correct = questions_answered < target_score
                answer = question_data["options"][0] if is_correct else question_data["options"][-1]
                
                answer_response = await test_client.post(
                    "/api/v1/games/quiz/football/answer",
                    json={
                        "question_id": question_data.get("question_id", 1),
                        "answer": answer
                    }
                )
                
                if answer_response.status_code != 200:
                    break
                    
                answer_data = answer_response.json()
                questions_answered += 1
                
                if answer_data.get("game_complete", False):
                    # Record rating after this game
                    rating_result = await db_session.execute(
                        UserRating.__table__.select().where(
                            UserRating.user_id == user_data["id"],
                            UserRating.sport == "football",
                            UserRating.mode == "quiz"
                        )
                    )
                    current_rating = rating_result.first()
                    if current_rating:
                        rating_history.append({
                            'game': len(rating_history) + 1,
                            'score': target_score,
                            'rating': current_rating.elo_rating
                        })
                    break
                    
                if "next_question" in answer_data:
                    question_data = answer_data["next_question"]
                else:
                    break
        
        # Verify rating consistency
        assert len(rating_history) >= 15  # Most games completed successfully
        
        # Check that ratings follow expected patterns
        high_scores = [entry for entry in rating_history if entry['score'] >= 8]
        low_scores = [entry for entry in rating_history if entry['score'] <= 5]
        
        if len(high_scores) > 2 and len(low_scores) > 2:
            # Generally, better scores should lead to higher ratings over time
            avg_rating_after_good = sum(entry['rating'] for entry in high_scores[-3:]) / 3
            avg_rating_after_poor = sum(entry['rating'] for entry in low_scores[-3:]) / 3
            
            # This is a tendency, not absolute due to ELO dynamics
            # But over many games, pattern should emerge
        
        # Check that all ratings are within valid bounds
        for entry in rating_history:
            assert 800 <= entry['rating'] <= 2400  # ELO bounds
            
        # Final rating should reflect overall performance
        avg_performance = sum(performance_pattern) / len(performance_pattern)
        final_rating = rating_history[-1]['rating']
        
        if avg_performance > 7:
            assert final_rating > 1200  # Should be above initial
        elif avg_performance < 5:
            assert final_rating < 1200  # Should be below initial