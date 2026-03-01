"""
Quiz routes for VerveQ Platform API
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field, validator
from typing import Dict, Any, Literal, Optional
from slowapi import Limiter
from slowapi.util import get_remote_address

router = APIRouter(tags=["quiz"])
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

class DifficultyFeedbackRequest(BaseModel):
    question_checksum: str = Field(
        ...,
        min_length=1,
        max_length=32,
        description="MD5 checksum of the question"
    )
    perceived_difficulty: str = Field(
        ...,
        pattern=r'^(easy|intermediate|hard)$',
        description="Perceived difficulty level (easy/intermediate/hard)"
    )
    was_correct: bool = Field(
        ...,
        description="Whether the user answered correctly"
    )
    
    @validator('question_checksum')
    def validate_checksum(cls, v):
        if v and len(v.strip()) == 0:
            raise ValueError('Question checksum cannot be empty')
        return v.strip()
    
    @validator('perceived_difficulty') 
    def validate_difficulty(cls, v):
        valid_difficulties = {'easy', 'intermediate', 'hard'}
        if v.lower() not in valid_difficulties:
            raise ValueError(f'Difficulty must be one of: {", ".join(valid_difficulties)}')
        return v.lower()

# Sport validation
ALLOWED_SPORTS = Literal["football", "tennis", "basketball", "soccer", "baseball", "hockey"]

@router.post("/{sport}/quiz/session")
async def create_quiz_session(sport: ALLOWED_SPORTS, limit: Optional[int] = 10):
    """Create a new quiz session for tracking questions
    
    Args:
        sport: The sport to create session for
        limit: Maximum number of questions for this session (default: 10)
    """
    from services.quiz_session import get_quiz_session_manager
    
    # Validate limit parameter
    if limit is not None and (limit < 1 or limit > 50):
        raise HTTPException(status_code=400, detail="Limit must be between 1 and 50")
    
    session_manager = get_quiz_session_manager()
    session_id = session_manager.create_session(sport)
    
    return {
        "session_id": session_id,
        "sport": sport,
        "max_questions": limit or 10
    }

@router.get("/{sport}/quiz/question")
async def get_quiz_question(
    sport: ALLOWED_SPORTS,
    session_id: Optional[str] = None,
    difficulty: Optional[str] = None
):
    """Get a random quiz question for the specified sport
    
    Args:
        sport: The sport to generate questions for
        session_id: Optional session ID for duplicate prevention
        difficulty: Optional difficulty level (easy/intermediate/hard)
    """
    from services.question_repository import get_question_repository
    from services.quiz_session import get_quiz_session_manager
    import time
    
    start_time = time.time()
    
    try:
        # Get session manager for deduplication
        session_manager = get_quiz_session_manager()
        exclude_checksums = set()
        
        if session_id:
            # Get used question checksums from session
            used_questions = session_manager.get_used_questions(session_id)
            exclude_checksums = set(used_questions)
        
        # Get question from repository
        repository = get_question_repository()
        question_data = repository.get_random_question(
            sport=sport,
            difficulty=difficulty,
            exclude_checksums=exclude_checksums
        )
        
        if question_data:
            # Add question to session tracking
            if session_id:
                checksum = question_data.get("checksum")
                if checksum:
                    session_manager.add_question(session_id, checksum)
            
            # Log timing
            elapsed_ms = (time.time() - start_time) * 1000
            print(f"🚀 DB question served in {elapsed_ms:.1f}ms for {sport}")
            
            return question_data
        
        # No questions available
        raise HTTPException(status_code=404, detail="No questions available for this sport")
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get question: {str(e)}")

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

@router.post("/{sport}/quiz/feedback")
@limiter.limit("30/minute")
async def submit_difficulty_feedback(
    request: Request, 
    sport: ALLOWED_SPORTS, 
    feedback_data: DifficultyFeedbackRequest
):
    """Submit feedback on question difficulty"""
    from services.difficulty_feedback import DifficultyFeedbackService
    
    try:
        result = DifficultyFeedbackService.submit_feedback(
            question_checksum=feedback_data.question_checksum,
            perceived_difficulty=feedback_data.perceived_difficulty,
            was_correct=feedback_data.was_correct
        )
        
        if result["success"]:
            return {
                "message": result["message"],
                "feedback_processed": True,
                "question_updated": result.get("question_updated", False),
                "new_difficulty": result.get("new_difficulty"),
                "total_votes": result.get("total_votes", 0)
            }
        else:
            raise HTTPException(status_code=400, detail=result["message"])
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to submit feedback: {str(e)}")