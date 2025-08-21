"""
Unit tests for EloService.
Tests all ELO calculation logic for quiz and survival games.
"""
import pytest
from backend.services.elo_service import EloService


class TestEloService:
    """Test cases for ELO service calculations."""
    
    def test_calculate_elo_change_equal_performance(self):
        """Test ELO change when player performs as expected."""
        # Player rated 1200 vs intermediate difficulty (1200)
        # Performance score 0.5 means they performed exactly as expected
        change = EloService.calculate_elo_change(1200, 0.5, 'intermediate')
        assert change == 0.0  # No change when performing as expected
    
    def test_calculate_elo_change_better_than_expected(self):
        """Test ELO change when player performs better than expected."""
        # Player rated 1200 vs intermediate (1200), but scores 0.8
        change = EloService.calculate_elo_change(1200, 0.8, 'intermediate')
        assert change > 0  # Should gain ELO
        assert abs(change - 9.6) < 0.1  # 32 * (0.8 - 0.5)
    
    def test_calculate_elo_change_worse_than_expected(self):
        """Test ELO change when player performs worse than expected."""
        # Player rated 1200 vs intermediate (1200), but scores 0.2
        change = EloService.calculate_elo_change(1200, 0.2, 'intermediate')
        assert change < 0  # Should lose ELO
        assert abs(change - (-9.6)) < 0.1  # 32 * (0.2 - 0.5)
    
    def test_calculate_elo_change_underdog_wins(self):
        """Test ELO change when lower-rated player performs well."""
        # Player rated 1000 vs hard difficulty (1400)
        # Expected score would be low, so good performance gives big gain
        change = EloService.calculate_elo_change(1000, 0.8, 'hard')
        assert change > 20  # Should get significant ELO gain
    
    def test_calculate_elo_change_favorite_loses(self):
        """Test ELO change when higher-rated player performs poorly."""
        # Player rated 1500 vs easy difficulty (1000)  
        # Expected score would be high, so poor performance gives big loss
        change = EloService.calculate_elo_change(1500, 0.2, 'easy')
        assert change < -20  # Should lose significant ELO
    
    def test_difficulty_ratings_mapping(self):
        """Test that difficulty levels map to correct opponent ratings."""
        # Test each difficulty level with performance score 0.6 to see differences
        easy_change = EloService.calculate_elo_change(1200, 0.6, 'easy')
        inter_change = EloService.calculate_elo_change(1200, 0.6, 'intermediate')
        hard_change = EloService.calculate_elo_change(1200, 0.6, 'hard')
        
        # Player rated 1200 vs opponents: easy=1000, inter=1200, hard=1400
        # With 0.6 performance vs easy (1000): expected to win, so smaller gain
        # With 0.6 performance vs inter (1200): equal, so moderate gain  
        # With 0.6 performance vs hard (1400): underdog, so larger gain
        assert hard_change > inter_change > easy_change
        
        # Inter and hard should be positive (above expected)
        assert inter_change > 0
        assert hard_change > 0
        # Easy might be negative (underperformed vs weaker opponent)
    
    def test_unknown_difficulty_defaults(self):
        """Test that unknown difficulty defaults to intermediate."""
        normal_change = EloService.calculate_elo_change(1200, 0.8, 'intermediate')
        unknown_change = EloService.calculate_elo_change(1200, 0.8, 'unknown')
        
        assert normal_change == unknown_change
    
    def test_get_quiz_performance_score_perfect(self):
        """Test quiz performance score calculation for perfect score."""
        score = EloService.get_quiz_performance_score(10, 10, 5.0)
        assert score == 1.0
    
    def test_get_quiz_performance_score_half(self):
        """Test quiz performance score calculation for 50% accuracy."""
        score = EloService.get_quiz_performance_score(5, 10, 10.0)
        # 50% accuracy = 0.5 base, time bonus/penalty affects final score
        assert 0.4 <= score <= 0.6
    
    def test_get_quiz_performance_score_zero(self):
        """Test quiz performance score calculation for zero correct."""
        score = EloService.get_quiz_performance_score(0, 10, 15.0)
        assert score == 0.0  # Can't go below 0
    
    def test_get_quiz_performance_score_time_bonus(self):
        """Test that fast answers get time bonus."""
        fast_score = EloService.get_quiz_performance_score(8, 10, 3.0)  # 3 sec avg
        slow_score = EloService.get_quiz_performance_score(8, 10, 15.0)  # 15 sec avg
        
        assert fast_score > slow_score
    
    def test_get_quiz_performance_score_no_time(self):
        """Test quiz performance without time data."""
        score = EloService.get_quiz_performance_score(7, 10)  # No average_time
        expected = 7 / 10  # Pure accuracy
        assert score == expected
    
    def test_get_survival_performance_score_football_good(self):
        """Test survival performance for good football score."""
        score = EloService.get_survival_performance_score(15)  # 15 correct guesses
        assert score > 0.8  # Should be high performance
    
    def test_get_survival_performance_score_football_average(self):
        """Test survival performance for average football score."""
        score = EloService.get_survival_performance_score(8)  # 8 correct guesses
        assert 0.4 <= score <= 0.6  # Should be around average
    
    def test_get_survival_performance_score_football_poor(self):
        """Test survival performance for poor football score."""
        score = EloService.get_survival_performance_score(2)  # 2 correct guesses
        assert score < 0.3  # Should be low performance
    
    def test_get_survival_performance_score_zero(self):
        """Test survival performance for zero score."""
        score = EloService.get_survival_performance_score(0)
        assert score == 0.0
    
    def test_get_survival_performance_score_excellent(self):
        """Test survival performance for excellent score."""
        score = EloService.get_survival_performance_score(25)  # Exceptional score
        assert score >= 0.95  # Should be near maximum
    
    def test_calculate_new_rating_normal(self):
        """Test new rating calculation with normal change."""
        new_rating = EloService.calculate_new_rating(1500.0, 15.0)
        assert new_rating == 1515.0
    
    def test_calculate_new_rating_bounds_low(self):
        """Test new rating calculation with lower bound."""
        new_rating = EloService.calculate_new_rating(850.0, -100.0)
        assert new_rating == 800.0  # Minimum rating
    
    def test_calculate_new_rating_bounds_high(self):
        """Test new rating calculation with upper bound."""
        new_rating = EloService.calculate_new_rating(2350.0, 100.0)
        assert new_rating == 2400.0  # Maximum rating


class TestEloServiceEdgeCases:
    """Test edge cases and error conditions."""
    
    def test_negative_performance_score(self):
        """Test that negative performance scores are handled."""
        change = EloService.calculate_elo_change(1200, -0.1, 'intermediate')
        assert change < -16  # Should be significant penalty
    
    def test_performance_score_over_one(self):
        """Test that performance scores over 1.0 are handled."""
        change = EloService.calculate_elo_change(1200, 1.2, 'intermediate')
        assert change > 16  # Should be significant gain
    
    def test_extreme_ratings(self):
        """Test ELO calculations with extreme ratings."""
        # Very low rated player
        low_change = EloService.calculate_elo_change(500, 0.8, 'intermediate')
        assert low_change > 0
        
        # Very high rated player  
        high_change = EloService.calculate_elo_change(3000, 0.2, 'intermediate')
        assert high_change < 0
    
    def test_quiz_performance_extreme_values(self):
        """Test quiz performance with extreme input values."""
        # More correct than total (shouldn't happen but handle gracefully)
        score1 = EloService.get_quiz_performance_score(15, 10, 5.0)
        assert score1 >= 1.0
        
        # Zero total questions
        score3 = EloService.get_quiz_performance_score(5, 0, 5.0)
        assert score3 == 0.0
    
    def test_survival_performance_extreme_values(self):
        """Test survival performance with extreme values."""        
        # Very high score
        score2 = EloService.get_survival_performance_score(100)
        assert score2 <= 1.0  # Should not exceed maximum


class TestEloServiceMathematicalProperties:
    """Test mathematical properties of ELO calculations."""
    
    def test_elo_change_symmetry(self):
        """Test that ELO changes are roughly symmetric."""
        # If player A gains X points, conceptually player B should lose ~X
        player_a_gain = EloService.calculate_elo_change(1200, 0.8, 'intermediate')
        player_a_loss = EloService.calculate_elo_change(1200, 0.2, 'intermediate')
        
        # Should be roughly equal magnitude
        assert abs(abs(player_a_gain) - abs(player_a_loss)) < 0.1
    
    def test_expected_score_calculation(self):
        """Test that expected scores make sense."""
        # Equal ratings should have expected score of 0.5
        rating_diff_0 = 1 / (1 + 10 ** (0 / 400))
        assert abs(rating_diff_0 - 0.5) < 0.001
        
        # Higher rated player should have expected score > 0.5
        rating_diff_200 = 1 / (1 + 10 ** (-200 / 400))  # Player is 200 pts higher
        assert rating_diff_200 > 0.5
    
    def test_k_factor_effect(self):
        """Test that K-factor appropriately scales ELO changes."""
        # Same scenario should produce change proportional to K-factor
        base_change = EloService.calculate_elo_change(1200, 0.8, 'intermediate')
        
        # The change should be 32 * (0.8 - 0.5) = 32 * 0.3 = 9.6
        expected_change = 32 * (0.8 - 0.5)
        assert abs(base_change - expected_change) < 0.1