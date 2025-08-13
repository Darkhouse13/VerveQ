"""
Integration tests for time-based scoring API functionality
"""

import pytest
import sys
import os
from fastapi.testclient import TestClient

# Add backend to path so we can import from it
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', '..', 'backend'))

# Import the app
from main import app

client = TestClient(app)

def test_check_quiz_answer_with_time_taken():
    """Test the check_quiz_answer endpoint with time_taken parameter"""
    
    # Test data with a correct answer
    test_data = {
        "answer": "Lionel Messi",
        "time_taken": 5.5,
        "question": {
            "correct_answer": "Lionel Messi",
            "explanation": "Lionel Messi is widely regarded as one of the greatest football players of all time."
        }
    }
    
    response = client.post("/football/quiz/check", json=test_data)
    
    # Check that the response is successful
    assert response.status_code == 200
    
    # Check the response structure
    data = response.json()
    assert "correct" in data
    assert "score" in data
    assert "scoring_breakdown" in data
    assert "correct_answer" in data
    assert "explanation" in data
    
    # Check that the answer is correct
    assert data["correct"] == True
    
    # Check that we got a score
    assert data["score"] > 0
    
    # Check the scoring breakdown
    breakdown = data["scoring_breakdown"]
    assert "base_points" in breakdown
    assert "time_taken" in breakdown
    assert "max_time_allowed" in breakdown
    assert "time_factor" in breakdown
    assert "calculated_score" in breakdown
    
    # Verify the values
    assert breakdown["base_points"] == 100
    assert breakdown["time_taken"] == 5.5
    assert breakdown["max_time_allowed"] == 10.0
    assert breakdown["calculated_score"] == data["score"]

def test_check_quiz_answer_incorrect_with_time_taken():
    """Test the check_quiz_answer endpoint with incorrect answer"""
    
    # Test data with an incorrect answer
    test_data = {
        "answer": "Cristiano Ronaldo",
        "time_taken": 3.2,
        "question": {
            "correct_answer": "Lionel Messi",
            "explanation": "Lionel Messi is widely regarded as one of the greatest football players of all time."
        }
    }
    
    response = client.post("/football/quiz/check", json=test_data)
    
    # Check that the response is successful
    assert response.status_code == 200
    
    # Check the response structure
    data = response.json()
    assert "correct" in data
    assert "score" in data
    assert "scoring_breakdown" in data
    
    # Check that the answer is incorrect
    assert data["correct"] == False
    
    # Check that we got 0 score for incorrect answer
    assert data["score"] == 0

def test_check_quiz_answer_too_slow():
    """Test the check_quiz_answer endpoint with too slow answer"""
    
    # Test data with a correct answer but too slow
    test_data = {
        "answer": "Lionel Messi",
        "time_taken": 15.0,  # Exceeds max time of 10 seconds
        "question": {
            "correct_answer": "Lionel Messi",
            "explanation": "Lionel Messi is widely regarded as one of the greatest football players of all time."
        }
    }
    
    response = client.post("/football/quiz/check", json=test_data)
    
    # Check that the response is successful
    assert response.status_code == 200
    
    # Check the response structure
    data = response.json()
    assert "correct" in data
    assert "score" in data
    assert "scoring_breakdown" in data
    
    # Check that the answer is correct
    assert data["correct"] == True
    
    # Check that we got 0 score for taking too long
    assert data["score"] == 0
    
    # Check the scoring breakdown shows 0 time factor
    breakdown = data["scoring_breakdown"]
    assert breakdown["time_factor"] == 0
    assert breakdown["calculated_score"] == 0

def test_check_quiz_answer_very_fast():
    """Test the check_quiz_answer endpoint with very fast answer (within 1 second)"""
    
    # Test data with a correct answer within 1 second
    test_data = {
        "answer": "Lionel Messi",
        "time_taken": 0.5,  # Within 1 second
        "question": {
            "correct_answer": "Lionel Messi",
            "explanation": "Lionel Messi is widely regarded as one of the greatest football players of all time."
        }
    }
    
    response = client.post("/football/quiz/check", json=test_data)
    
    # Check that the response is successful
    assert response.status_code == 200
    
    # Check the response structure
    data = response.json()
    assert "correct" in data
    assert "score" in data
    assert "scoring_breakdown" in data
    
    # Check that the answer is correct
    assert data["correct"] == True
    
    # Check that we got maximum score for very fast answer
    assert data["score"] == 100
    
    # Check the scoring breakdown
    breakdown = data["scoring_breakdown"]
    assert breakdown["base_points"] == 100
    assert breakdown["time_taken"] == 0.5
    assert breakdown["max_time_allowed"] == 10.0
    assert breakdown["calculated_score"] == 100

def test_check_quiz_answer_moderate_speed():
    """Test the check_quiz_answer endpoint with moderate speed answer (between 1 and 10 seconds)"""
    
    # Test data with a correct answer taking moderate time
    test_data = {
        "answer": "Lionel Messi",
        "time_taken": 5.0,  # Between 1 and 10 seconds
        "question": {
            "correct_answer": "Lionel Messi",
            "explanation": "Lionel Messi is widely regarded as one of the greatest football players of all time."
        }
    }
    
    response = client.post("/football/quiz/check", json=test_data)
    
    # Check that the response is successful
    assert response.status_code == 200
    
    # Check the response structure
    data = response.json()
    assert "correct" in data
    assert "score" in data
    assert "scoring_breakdown" in data
    
    # Check that the answer is correct
    assert data["correct"] == True
    
    # Check that we got appropriate score for moderate speed answer
    # Score should be 100 * ((10 - 5) / (10 - 1)) = 100 * (5/9) = 55.56, rounded to 55 or 56
    assert data["score"] >= 55
    assert data["score"] <= 56
    
    # Check the scoring breakdown
    breakdown = data["scoring_breakdown"]
    assert breakdown["base_points"] == 100
    assert breakdown["time_taken"] == 5.0
    assert breakdown["max_time_allowed"] == 10.0

if __name__ == "__main__":
    pytest.main([__file__])