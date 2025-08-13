"""
Game routes for VerveQ Platform API (Quiz and Survival modes)
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field, validator
from typing import Dict, Any, Literal, Optional
from slowapi import Limiter
from slowapi.util import get_remote_address
from sports.base import SportDataFactory
import random

router = APIRouter(tags=["games"])
limiter = Limiter(key_func=get_remote_address)

# Pydantic models for request validation
class QuizAnswerRequest(BaseModel):
    answer: str = Field(
        ...,
        min_length=1,
        max_length=200,
        pattern=r'^[a-zA-Z0-9\s\-_\.,:;()!?\'\"]+$',
        description="Quiz answer (alphanumeric and common punctuation only)"
    )
    time_taken: float = Field(
        ...,
        gt=0,
        description="Time taken to answer the question in seconds"
    )
    question: Dict[str, Any] = Field(
        ...,
        description="Question object containing correct answer and explanation"
    )
    
    @validator('answer')
    def validate_answer(cls, v):
        if v and len(v.strip()) == 0:
            raise ValueError('Answer cannot be empty or whitespace only')
        return v.strip()
    
    @validator('question')
    def validate_question(cls, v):
        if not isinstance(v, dict):
            raise ValueError('Question must be a dictionary')
        if 'correct_answer' not in v:
            raise ValueError('Question must contain correct_answer field')
        return v

class SurvivalGuessRequest(BaseModel):
    guess: str = Field(
        ..., 
        min_length=1, 
        max_length=100,
        pattern=r'^[a-zA-Z0-9\s\-_\.\']+$',
        description="Player name guess (alphanumeric, spaces, hyphens, underscores, dots, apostrophes only)"
    )
    initials: str = Field(
        ..., 
        min_length=2, 
        max_length=5,
        pattern=r'^[A-Z]{2,5}$',
        description="Player initials (2-5 uppercase letters)"
    )
    
    @validator('guess')
    def validate_guess(cls, v):
        if v and len(v.strip()) == 0:
            raise ValueError('Guess cannot be empty or whitespace only')
        return v.strip()
    
    @validator('initials')
    def validate_initials(cls, v):
        if v and len(v.strip()) == 0:
            raise ValueError('Initials cannot be empty or whitespace only')
        return v.strip().upper()

# Sport validation
ALLOWED_SPORTS = Literal["football", "tennis", "basketball", "soccer", "baseball", "hockey"]

@router.post("/{sport}/quiz/session")
async def create_quiz_session(sport: ALLOWED_SPORTS):
    """Create a new quiz session for tracking questions"""
    from services.quiz_session import get_quiz_session_manager
    
    session_manager = get_quiz_session_manager()
    session_id = session_manager.create_session(sport)
    
    return {
        "session_id": session_id,
        "sport": sport,
        "max_questions": 20
    }

@router.get("/{sport}/quiz/question")
async def get_quiz_question(
    sport: ALLOWED_SPORTS,
    session_id: Optional[str] = None
):
    """Generate a random quiz question for the specified sport
    
    Args:
        sport: The sport to generate questions for
        session_id: Optional session ID for duplicate prevention
    """
    from sports.quiz_generator import get_quiz_coordinator
    
    # Use coordinator for session-based tracking
    coordinator = get_quiz_coordinator()
    
    # Register generator if not already registered
    generator = SportDataFactory.get_generator(sport)
    if not generator:
        raise HTTPException(status_code=404, detail=f"Sport '{sport}' not found")
    
    coordinator.register_generator(sport, generator)
    
    try:
        question_data = coordinator.generate_question(sport, session_id)
        if not question_data:
            # If no unique question found, still return a question (fallback)
            question_data = generator.get_quiz_question()
        return question_data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate question: {str(e)}")

@router.delete("/{sport}/quiz/session/{session_id}")
async def end_quiz_session(sport: ALLOWED_SPORTS, session_id: str):
    """End a quiz session"""
    from services.quiz_session import get_quiz_session_manager
    
    session_manager = get_quiz_session_manager()
    session_manager.end_session(session_id)
    
    return {"message": "Session ended successfully"}

@router.post("/{sport}/quiz/check")
@limiter.limit("20/minute")
async def check_quiz_answer(request: Request, sport: ALLOWED_SPORTS, answer_data: QuizAnswerRequest):
    """Check if the submitted answer is correct and calculate time-based score"""
    try:
        submitted_answer = answer_data.answer
        time_taken = answer_data.time_taken
        question = answer_data.question
        
        # Get the correct answer from the question
        correct_answer = question.get('correct_answer')
        
        # Normalize both submitted and correct answers for robust comparison
        from utils.answer_normalizer import normalize_answer
        normalized_submitted_answer = normalize_answer(submitted_answer)
        normalized_correct_answer = normalize_answer(correct_answer)
        
        is_correct = normalized_submitted_answer == normalized_correct_answer
        
        # Calculate time-based score
        from services.quiz_session import get_quiz_session_manager
        session_manager = get_quiz_session_manager()
        
        # Base points for correct answer (can be adjusted based on question difficulty)
        base_points = 100
        max_time_per_question = 10.0  # seconds
        
        if is_correct:
            score = session_manager.calculate_time_based_score(base_points, time_taken, max_time_per_question)
        else:
            score = 0
        
        # Prepare scoring breakdown
        scoring_breakdown = {
            "base_points": base_points,
            "time_taken": time_taken,
            "max_time_allowed": max_time_per_question,
            "time_factor": 1 - (time_taken / max_time_per_question) if time_taken <= max_time_per_question else 0,
            "calculated_score": score
        }
        
        return {
            "correct": is_correct,
            "score": score,
            "scoring_breakdown": scoring_breakdown,
            "correct_answer": correct_answer,
            "explanation": question.get('explanation', '')
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to check answer: {str(e)}")

@router.get("/{sport}/survival/initials")
async def get_survival_initials(sport: ALLOWED_SPORTS):
    """Get random initials for survival mode in the specified sport"""
    generator = SportDataFactory.get_generator(sport)
    if not generator:
        raise HTTPException(status_code=404, detail=f"Sport '{sport}' not found")
    
    try:
        survival_data = generator.get_survival_data()
        if not survival_data:
            raise HTTPException(status_code=500, detail=f"No survival data available for {sport}")
        
        initials = random.choice(list(survival_data.keys()))
        
        return {
            "initials": initials,
            "hint": f"Find a {sport} player with initials {initials}",
            "sport": sport
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get initials: {str(e)}")

@router.post("/{sport}/survival/guess")
@limiter.limit("20/minute")
async def submit_survival_guess(request: Request, sport: ALLOWED_SPORTS, guess_data: SurvivalGuessRequest):
    """Submit a guess for survival mode"""
    generator = SportDataFactory.get_generator(sport)
    if not generator:
        raise HTTPException(status_code=404, detail=f"Sport '{sport}' not found")
    
    try:
        guess = guess_data.guess.lower()
        initials = guess_data.initials.upper()
        
        survival_data = generator.get_survival_data()
        if not survival_data or initials not in survival_data:
            raise HTTPException(status_code=400, detail="Invalid initials")
        
        # Check if guess matches any player with these initials
        players = survival_data[initials]
        is_correct = any(guess in player.lower() for player in players)
        
        return {
            "correct": is_correct,
            "guess": guess,
            "initials": initials,
            "message": "Correct!" if is_correct else "Try again!"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to process guess: {str(e)}")

@router.get("/{sport}/survival/reveal/{initials}")
async def reveal_survival_hints(sport: ALLOWED_SPORTS, initials: str):
    """Get hint players for survival mode"""
    
    # Validate initials parameter
    if not initials or len(initials.strip()) == 0:
        raise HTTPException(status_code=400, detail="Initials cannot be empty")
    initials = initials.strip().upper()
    if len(initials) > 5 or not initials.isalpha():
        raise HTTPException(status_code=400, detail="Invalid initials format")
    
    generator = SportDataFactory.get_generator(sport)
    if not generator:
        raise HTTPException(status_code=404, detail=f"Sport '{sport}' not found")
    
    try:
        survival_data = generator.get_survival_data()
        if not survival_data or initials not in survival_data:
            raise HTTPException(status_code=400, detail="Invalid initials")
        
        players = survival_data[initials]
        
        # Return a sample of players as hints (limit to 3)
        sample_players = random.sample(players, min(3, len(players)))
        
        return {
            "initials": initials,
            "sample_players": sample_players,
            "total_players": len(players)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get hints: {str(e)}")