"""
Game completion routes for VerveQ Platform
Handles quiz and survival game result submission
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
import uuid

from database.connection import SessionLocal
from database.models import User, UserRating, GameSession
from services.elo_service import EloService

router = APIRouter(tags=["games"])

class QuizResult(BaseModel):
    user_id: str = Field(..., min_length=1, max_length=50)
    score: int = Field(..., ge=0, description="Number of correct answers")
    total_questions: int = Field(..., ge=1, le=50, description="Total questions answered")
    accuracy: float = Field(..., ge=0.0, le=1.0, description="Accuracy percentage as decimal")
    average_time: Optional[float] = Field(None, ge=0.0, description="Average time per question in seconds")
    difficulty: str = Field("intermediate", description="Question difficulty level")

class SurvivalResult(BaseModel):
    user_id: str = Field(..., min_length=1, max_length=50)
    score: int = Field(..., ge=0, description="Survival score (rounds survived)")
    duration_seconds: int = Field(..., ge=0, description="Game duration in seconds")

class GameResultResponse(BaseModel):
    success: bool
    message: str
    new_elo_rating: float
    elo_change: float
    game_session_id: str

def get_or_create_user(user_id: str, db) -> User:
    """Get existing user or create new one"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        # Use full user_id for unique username
        username = f"player_{user_id.replace('-', '')[:16]}"
        user = User(
            id=user_id,
            username=username,
            display_name=f"Player {user_id[:8]}",
            total_games=0
        )
        db.add(user)
        db.flush()
    return user

def get_or_create_user_rating(user_id: str, sport: str, mode: str, db) -> UserRating:
    """Get existing user rating or create new one"""
    rating = db.query(UserRating).filter(
        UserRating.user_id == user_id,
        UserRating.sport == sport,
        UserRating.mode == mode
    ).first()
    
    if not rating:
        rating = UserRating(
            user_id=user_id,
            sport=sport,
            mode=mode,
            elo_rating=1200.0,  # Starting ELO
            games_played=0,
            wins=0,
            losses=0,
            best_score=0,
            average_score=0.0
        )
        db.add(rating)
        db.flush()
    
    return rating

@router.post("/{sport}/quiz/complete")
async def complete_quiz_game(sport: str, result: QuizResult) -> GameResultResponse:
    """Submit quiz game result and update ELO"""
    db = SessionLocal()
    
    try:
        # Get or create user and rating
        user = get_or_create_user(result.user_id, db)
        user_rating = get_or_create_user_rating(result.user_id, sport, "quiz", db)
        
        # Calculate performance score and ELO change
        performance_score = EloService.get_quiz_performance_score(
            result.score, result.total_questions, result.average_time
        )
        elo_change = EloService.calculate_elo_change(
            user_rating.elo_rating, performance_score, result.difficulty
        )
        new_elo = EloService.calculate_new_rating(user_rating.elo_rating, elo_change)
        
        # Create game session record
        game_session = GameSession(
            id=str(uuid.uuid4()),
            user_id=result.user_id,
            sport=sport,
            mode="quiz",
            score=result.score,
            total_questions=result.total_questions,
            accuracy=result.accuracy,
            average_answer_time_seconds=result.average_time,
            elo_before=user_rating.elo_rating,
            elo_after=new_elo,
            elo_change=elo_change,
            details={
                "difficulty": result.difficulty,
                "performance_score": performance_score
            }
        )
        db.add(game_session)
        
        # Update user rating
        user_rating.elo_rating = new_elo
        user_rating.games_played += 1
        user_rating.best_score = max(user_rating.best_score, result.score)
        
        # Update win/loss record (>80% accuracy = win)
        if result.accuracy >= 0.8:
            user_rating.wins += 1
        else:
            user_rating.losses += 1
        
        # Update average score
        total_score = (user_rating.average_score * (user_rating.games_played - 1)) + result.score
        user_rating.average_score = total_score / user_rating.games_played
        user_rating.last_played = datetime.utcnow()
        
        # Update user total games
        user.total_games += 1
        user.last_active = datetime.utcnow()
        
        db.commit()
        
        return GameResultResponse(
            success=True,
            message=f"Quiz result saved. ELO {'increased' if elo_change > 0 else 'decreased'} by {abs(elo_change):.1f}",
            new_elo_rating=new_elo,
            elo_change=elo_change,
            game_session_id=game_session.id
        )
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to save quiz result: {str(e)}")
    finally:
        db.close()

@router.post("/{sport}/survival/complete")
async def complete_survival_game(sport: str, result: SurvivalResult) -> GameResultResponse:
    """Submit survival game result and update ELO"""
    db = SessionLocal()
    
    try:
        # Get or create user and rating
        user = get_or_create_user(result.user_id, db)
        user_rating = get_or_create_user_rating(result.user_id, sport, "survival", db)
        
        # Calculate performance score and ELO change
        performance_score = EloService.get_survival_performance_score(result.score)
        elo_change = EloService.calculate_elo_change(
            user_rating.elo_rating, performance_score, "intermediate"
        )
        new_elo = EloService.calculate_new_rating(user_rating.elo_rating, elo_change)
        
        # Create game session record
        game_session = GameSession(
            id=str(uuid.uuid4()),
            user_id=result.user_id,
            sport=sport,
            mode="survival",
            score=result.score,
            duration_seconds=result.duration_seconds,
            elo_before=user_rating.elo_rating,
            elo_after=new_elo,
            elo_change=elo_change,
            details={
                "performance_score": performance_score
            }
        )
        db.add(game_session)
        
        # Update user rating
        user_rating.elo_rating = new_elo
        user_rating.games_played += 1
        user_rating.best_score = max(user_rating.best_score, result.score)
        
        # Update win/loss record (>10 score = win)
        if result.score >= 10:
            user_rating.wins += 1
        else:
            user_rating.losses += 1
        
        # Update average score
        total_score = (user_rating.average_score * (user_rating.games_played - 1)) + result.score
        user_rating.average_score = total_score / user_rating.games_played
        user_rating.last_played = datetime.utcnow()
        
        # Update user total games
        user.total_games += 1
        user.last_active = datetime.utcnow()
        
        db.commit()
        
        return GameResultResponse(
            success=True,
            message=f"Survival result saved. ELO {'increased' if elo_change > 0 else 'decreased'} by {abs(elo_change):.1f}",
            new_elo_rating=new_elo,
            elo_change=elo_change,
            game_session_id=game_session.id
        )
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to save survival result: {str(e)}")
    finally:
        db.close()