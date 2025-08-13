"""
Mock API responses for testing.
"""

# Authentication responses
AUTH_LOGIN_SUCCESS = {
    "access_token": "mock-jwt-token-123",
    "token_type": "bearer",
    "user": {
        "id": "user-123",
        "username": "testuser",
        "email": "test@example.com",
        "display_name": "Test User",
        "is_guest": False,
        "created_at": "2024-01-01T12:00:00Z"
    }
}

AUTH_CREATE_USER_SUCCESS = {
    "id": "new-user-456",
    "username": "newuser",
    "email": "new@example.com",
    "display_name": "newuser",
    "is_guest": False,
    "created_at": "2024-01-01T12:00:00Z"
}

AUTH_GUEST_SESSION_SUCCESS = {
    "session_id": "guest-session-789",
    "access_token": "guest-token-789",
    "token_type": "bearer",
    "user": {
        "id": "guest-session-789",
        "username": "guest_abc123",
        "display_name": "Guest Player",
        "is_guest": True,
        "created_at": "2024-01-01T12:00:00Z"
    }
}

# Game responses
QUIZ_START_SUCCESS = {
    "question": "Who won the 2022 Ballon d'Or?",
    "options": ["Lionel Messi", "Karim Benzema", "Kylian Mbappe", "Erling Haaland"],
    "question_id": 1,
    "questions_remaining": 9
}

QUIZ_ANSWER_CORRECT = {
    "correct": True,
    "score": 10,
    "questions_answered": 1,
    "correct_answers": 1,
    "next_question": {
        "question": "Which team won the 2021 Premier League?",
        "options": ["Manchester City", "Manchester United", "Liverpool", "Chelsea"],
        "question_id": 2,
        "questions_remaining": 8
    }
}

QUIZ_ANSWER_INCORRECT = {
    "correct": False,
    "score": 0,
    "questions_answered": 1,
    "correct_answers": 0,
    "correct_answer": "Karim Benzema",
    "explanation": "Karim Benzema won the 2022 Ballon d'Or after an exceptional season with Real Madrid.",
    "next_question": {
        "question": "Which team won the 2021 Premier League?",
        "options": ["Manchester City", "Manchester United", "Liverpool", "Chelsea"],
        "question_id": 2,
        "questions_remaining": 8
    }
}

QUIZ_COMPLETE = {
    "correct": True,
    "score": 80,
    "questions_answered": 10,
    "correct_answers": 8,
    "game_complete": True,
    "final_score": 80,
    "accuracy": 80.0,
    "rating_change": 15,
    "new_rating": 1515,
    "performance_rating": 1600
}

SURVIVAL_START_SUCCESS = {
    "initials": "CR",
    "round": 1,
    "lives": 3,
    "score": 0
}

SURVIVAL_GUESS_CORRECT = {
    "correct": True,
    "round": 2,
    "lives": 3,
    "score": 1,
    "initials": "MS"
}

SURVIVAL_GUESS_INCORRECT = {
    "correct": False,
    "round": 1,
    "lives": 2,
    "score": 0,
    "message": "Incorrect! The player was not in our database."
}

SURVIVAL_GAME_OVER = {
    "correct": False,
    "round": 5,
    "lives": 0,
    "score": 4,
    "game_over": True,
    "final_score": 4,
    "rating_change": -10,
    "new_rating": 1490
}

# Leaderboard responses
LEADERBOARD_SUCCESS = {
    "leaderboard": [
        {
            "rank": 1,
            "user_id": "user-001",
            "username": "pro_player",
            "display_name": "Pro Player",
            "rating": 1850,
            "games_played": 60,
            "wins": 45,
            "win_rate": 75.0
        },
        {
            "rank": 2,
            "user_id": "user-003",
            "username": "expert_player",
            "display_name": "Expert Player",
            "rating": 1600,
            "games_played": 50,
            "wins": 30,
            "win_rate": 60.0
        },
        {
            "rank": 3,
            "user_id": "user-002",
            "username": "beginner",
            "display_name": "Beginner Player",
            "rating": 1200,
            "games_played": 5,
            "wins": 2,
            "win_rate": 40.0
        }
    ],
    "total_players": 150,
    "period": "all_time",
    "sport": "football",
    "mode": "quiz"
}

# Profile responses
PROFILE_SUCCESS = {
    "user": {
        "id": "user-123",
        "username": "testuser",
        "display_name": "Test User",
        "email": "test@example.com",
        "created_at": "2024-01-01T12:00:00Z"
    },
    "stats": {
        "total_games": 85,
        "total_wins": 50,
        "overall_win_rate": 58.8,
        "favorite_sport": "football",
        "favorite_mode": "quiz",
        "achievements_unlocked": 12,
        "total_points": 450
    },
    "ratings": [
        {
            "sport": "football",
            "mode": "quiz",
            "rating": 1515,
            "games_played": 50,
            "wins": 30,
            "peak_rating": 1600,
            "tier": "Advanced"
        },
        {
            "sport": "football",
            "mode": "survival",
            "rating": 1450,
            "games_played": 35,
            "wins": 20,
            "peak_rating": 1500,
            "tier": "Advanced"
        }
    ],
    "recent_games": [
        {
            "id": "game-001",
            "sport": "football",
            "mode": "quiz",
            "score": 80,
            "won": True,
            "rating_change": 15,
            "played_at": "2024-01-15T10:30:00Z"
        }
    ]
}

# Error responses
ERROR_UNAUTHORIZED = {
    "detail": "Not authenticated"
}

ERROR_INVALID_TOKEN = {
    "detail": "Could not validate credentials"
}

ERROR_USER_NOT_FOUND = {
    "detail": "User not found"
}

ERROR_USERNAME_EXISTS = {
    "detail": "Username already exists"
}

ERROR_INVALID_QUESTION = {
    "detail": "Invalid question ID"
}

ERROR_RATE_LIMITED = {
    "detail": "Rate limit exceeded. Please try again later."
}