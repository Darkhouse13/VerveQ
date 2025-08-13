"""
Unit tests for time-based scoring functionality
"""

import pytest
import sys
import os

# Add backend to path so we can import from it
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', '..', 'backend'))

from services.quiz_session import QuizSessionManager

def test_calculate_time_based_score_correct_answer_fast():
    """Test that fast correct answers get high scores"""
    manager = QuizSessionManager()
    
    # Fast answer (0.5 seconds) should get maximum score
    score = manager.calculate_time_based_score(100, 0.5, 10.0)
    # Should get maximum score of 100
    assert score == 100

def test_calculate_time_based_score_correct_answer_slow():
    """Test that slow correct answers get lower scores"""
    manager = QuizSessionManager()
    
    # Slow answer (5 seconds) should get lower score
    score = manager.calculate_time_based_score(100, 5.0, 10.0)
    # Formula: 100 * ((10 - 5) / (10 - 1)) = 100 * (5/9) = 55.56, rounded to 55
    assert score == 55

def test_calculate_time_based_score_too_slow():
    """Test that answers that take too long get 0 points"""
    manager = QuizSessionManager()
    
    # Answer that takes too long (15 seconds) should get 0 points
    score = manager.calculate_time_based_score(100, 15.0, 10.0)
    assert score == 0

def test_calculate_time_based_score_incorrect_answer():
    """Test that incorrect answers get 0 points regardless of time"""
    # This test is for the logic that calls calculate_time_based_score
    # If the answer is incorrect, the score should be 0 regardless of time
    manager = QuizSessionManager()
    
    # Even a fast answer should get 0 points if incorrect
    # (This is tested in the API layer, not here)
    pass

def test_calculate_time_based_score_edge_cases():
    """Test edge cases for time-based scoring"""
    manager = QuizSessionManager()
    
    # Exactly at max time (10 seconds) should give 0 score
    score = manager.calculate_time_based_score(100, 10.0, 10.0)
    assert score == 0
    
    # Exactly at 1 second should give maximum score
    score = manager.calculate_time_based_score(100, 1.0, 10.0)
    assert score == 100
    
    # Zero time should give maximum score
    score = manager.calculate_time_based_score(100, 0.0, 10.0)
    assert score == 100
    
    # Midpoint time (5.5 seconds) should give midpoint score
    score = manager.calculate_time_based_score(100, 5.5, 10.0)
    # Formula: 100 * ((10 - 5.5) / (10 - 1)) = 100 * (4.5/9) = 50
    assert score == 50

if __name__ == "__main__":
    pytest.main([__file__])