"""
Unit tests for the ELO rating system.
This is critical business logic that needs comprehensive testing.
"""
import pytest
from freezegun import freeze_time
from datetime import datetime, timedelta
from unittest.mock import MagicMock

from backend.services.elo_system import ELOSystem
from backend.database.models import UserRating

class TestEloSystem:
    """Test cases for ELO rating calculations."""
    
    @pytest.fixture
    def elo_system(self):
        """Create an ELO system instance."""
        return ELOSystem()
    
    def test_calculate_elo_change_equal_ratings_win(self, elo_system):
        """Test ELO change when equal rated players, winner wins."""
        change = elo_system.calculate_new_rating(1500, 0.5, 1) - 1500
        assert change == 16
    
    def test_calculate_elo_change_equal_ratings_loss(self, elo_system):
        """Test ELO change when equal rated players, winner loses."""
        change = elo_system.calculate_new_rating(1500, 0.5, 0) - 1500
        assert change == -16
        
    def test_calculate_elo_change_underdog_wins(self, elo_system):
        """Test ELO change when lower rated player wins."""
        expected_score = elo_system.calculate_expected_score(1200, 1800)
        change = elo_system.calculate_new_rating(1200, expected_score, 1) - 1200
        assert 30 < change < 32

    def test_calculate_elo_change_favorite_wins(self, elo_system):
        """Test ELO change when higher rated player wins."""
        expected_score = elo_system.calculate_expected_score(1800, 1200)
        change = elo_system.calculate_new_rating(1800, expected_score, 1) - 1800
        assert 0 < change < 2

    def test_calculate_elo_change_favorite_loses(self, elo_system):
        """Test ELO change when higher rated player loses."""
        expected_score = elo_system.calculate_expected_score(1800, 1200)
        change = elo_system.calculate_new_rating(1800, expected_score, 0) - 1800
        assert -32 < change < -30

    def test_performance_score_quiz_perfect(self, elo_system):
        """Test performance score for perfect quiz."""
        score = elo_system.get_performance_score(10, "quiz", "football", 10)
        assert score == 1.0

    def test_performance_score_quiz_half(self, elo_system):
        """Test performance score for 50% quiz accuracy."""
        score = elo_system.get_performance_score(5, "quiz", "football", 10)
        assert score == 0.0

    def test_performance_score_quiz_zero(self, elo_system):
        """Test performance score for zero quiz accuracy."""
        score = elo_system.get_performance_score(0, "quiz", "football", 10)
        assert score == 0.0

    def test_performance_score_survival_football_good(self, elo_system):
        """Test performance score for good survival game in football."""
        score = elo_system.get_performance_score(15, "survival", "football")
        assert score > 0.9

    def test_performance_score_survival_tennis_thresholds(self, elo_system):
        """Test performance score thresholds for tennis survival."""
        assert elo_system.get_performance_score(8, "survival", "tennis") > 0.5
        assert elo_system.get_performance_score(3, "survival", "tennis") < 0.5

    def test_baseline_rating_empty_ratings(self, elo_system):
        """Test baseline rating with no existing ratings."""
        mock_db = MagicMock()
        mock_db.query.return_value.filter.return_value.all.return_value = []
        baseline = elo_system.calculate_baseline_rating(mock_db, "football", "quiz")
        assert baseline == elo_system.initial_rating

    def test_get_tier_from_rating(self, elo_system):
        """Test tier assignment based on rating."""
        assert elo_system.get_rating_tier(799)["tier"] == "Novice"
        assert elo_system.get_rating_tier(1200)["tier"] == "Intermediate"
        assert elo_system.get_rating_tier(2000)["tier"] == "Grandmaster"

    def test_baseline_rating_mixed_activity(self, elo_system):
        """Test baseline rating with mixed active/inactive players."""
        mock_db = MagicMock()
        ratings = [(1500,), (1400,), (1700,)]
        mock_db.query.return_value.filter.return_value.all.return_value = ratings
        baseline = elo_system.calculate_baseline_rating(mock_db, "football", "quiz")
        assert baseline == 1500

    def test_baseline_rating_even_number_of_players(self, elo_system):
        """Test baseline rating with even number of players."""
        mock_db = MagicMock()
        ratings = [(1200,), (1400,), (1600,), (1800,)]
        mock_db.query.return_value.filter.return_value.all.return_value = ratings
        baseline = elo_system.calculate_baseline_rating(mock_db, "football", "quiz")
        assert baseline == 1500

    def test_performance_score_unknown_sport(self, elo_system):
        """Test performance score with unknown sport defaults."""
        score = elo_system.get_performance_score(7, "survival", "basketball")
        assert score == 0.5

from backend.database.models import User, GameSession
from sqlalchemy.orm import Session

@freeze_time("2023-01-01 12:00:00")
class TestUpdateRating:
    """Test cases for the main update_rating method."""

    @pytest.fixture
    def elo_system(self):
        """Create an ELO system instance."""
        return ELOSystem()

    @pytest.fixture
    def mock_user(self):
        """A mock user object."""
        user = MagicMock(spec=User)
        user.id = "test_user_1"
        user.total_games = 0
        return user

    @pytest.fixture
    def mock_db_session(self, mock_user):
        """A mock db session that can find the mock user."""
        db = MagicMock(spec=Session)
        
        def query_side_effect(model):
            if model == User:
                # This query is for updating the user's total_games
                q = MagicMock()
                q.filter.return_value.first.return_value = mock_user
                return q
            if model == UserRating:
                # This query is for finding the rating
                q = MagicMock()
                # By default, find no rating
                q.filter.return_value.first.return_value = None
                return q
            return MagicMock()

        db.query.side_effect = query_side_effect
        return db

    def test_update_rating_first_game(self, elo_system, mock_db_session, mock_user):
        """Test updating rating for a user's first game (creation case)."""
        # Arrange
        db = mock_db_session
        elo_system.calculate_baseline_rating = MagicMock(return_value=1200.0)

        # Act
        old, new, change = elo_system.update_rating(
            db=db, user_id=mock_user.id, sport="football", mode="quiz",
            user_score=8, total_questions=10
        )

        # Assert
        assert old == 1200.0
        assert new > 1200.0
        assert change > 0

        # Verify a new UserRating was created and added
        added_object = db.add.call_args_list[0].args[0]
        assert isinstance(added_object, UserRating)
        assert added_object.elo_rating == new
        assert added_object.games_played == 1
        assert added_object.wins == 1 # 8/10 score -> performance > 0.5
        assert added_object.best_score == 8

        # Verify GameSession was created
        session_object = db.add.call_args_list[1].args[0]
        assert isinstance(session_object, GameSession)
        assert session_object.score == 8
        assert session_object.elo_after == new

        # Verify user stats updated
        assert mock_user.total_games == 1
        assert mock_user.last_active is not None
        
        db.commit.assert_called_once()

    def test_update_rating_existing_user_win(self, elo_system, mock_db_session, mock_user):
        """Test updating rating for an existing user who performs well."""
        # Arrange
        db = mock_db_session
        
        # Create a real UserRating object that will be "found" in the db
        existing_rating = UserRating(
            user_id=mock_user.id,
            sport="football",
            mode="quiz",
            elo_rating=1350.0,
            games_played=10,
            wins=5,
            losses=5,
            best_score=9,
            average_score=7.5
        )
        
        # Configure the mock db to find this rating
        rating_query_mock = MagicMock()
        rating_query_mock.filter.return_value.first.return_value = existing_rating
        
        def query_side_effect(model):
            if model == UserRating:
                return rating_query_mock
            if model == User:
                user_query_mock = MagicMock()
                user_query_mock.filter.return_value.first.return_value = mock_user
                return user_query_mock
            return MagicMock()
            
        db.query.side_effect = query_side_effect
        
        elo_system.calculate_baseline_rating = MagicMock(return_value=1300.0)

        # Act: User gets a perfect score, a new best
        old, new, change = elo_system.update_rating(
            db=db, user_id=mock_user.id, sport="football", mode="quiz",
            user_score=10, total_questions=10
        )

        # Assert
        assert old == 1350.0
        assert new > 1350.0 # Should win points against a lower baseline
        
        # Check that the original object was updated
        assert existing_rating.elo_rating == new
        assert existing_rating.games_played == 11
        assert existing_rating.wins == 6
        assert existing_rating.best_score == 10 # New best score
        assert existing_rating.average_score == (7.5 * 10 + 10) / 11

        db.commit.assert_called_once()