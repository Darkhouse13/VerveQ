"""
Session-based survival mode routes for VerveQ Platform API
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field, validator
from typing import Literal
from slowapi import Limiter
from slowapi.util import get_remote_address
from services.survival_session import get_survival_session_manager
import random

router = APIRouter()
limiter = Limiter(key_func=get_remote_address)

class SurvivalGuessRequest(BaseModel):
    guess: str = Field(
        ..., 
        min_length=1, 
        max_length=100,
        pattern=r'^[a-zA-Z0-9\s\-_\.\']+$',
        description="Player name guess (alphanumeric, spaces, hyphens, underscores, dots, apostrophes only)"
    )
    session_id: str = Field(
        ...,
        min_length=1,
        max_length=50,
        description="Survival session ID"
    )
    
    @validator('guess')
    def validate_guess(cls, v):
        if v and len(v.strip()) == 0:
            raise ValueError('Guess cannot be empty or whitespace only')
        return v.strip()

class SurvivalStartRequest(BaseModel):
    sport: str = Field(
        ...,
        min_length=1,
        max_length=20,
        description="Sport for survival mode"
    )

@router.post("/start")
async def start_survival_game(start_data: SurvivalStartRequest):
    """Start a new survival game session"""
    sport = start_data.sport
    
    if sport not in ["football", "tennis", "basketball"]:
        raise HTTPException(status_code=400, detail=f"Sport '{sport}' not supported")
    
    try:
        session_manager = get_survival_session_manager()
        session = session_manager.create_session(sport)
        
        if not session.current_challenge:
            raise HTTPException(status_code=500, detail=f"Failed to generate initial challenge for {sport}")
        
        return {
            "session_id": session.session_id,
            "sport": session.sport,
            "round": session.round,
            "lives": session.lives,
            "score": session.score,
            "hint_available": True,  # New sessions always start with hint available
            "challenge": {
                "initials": session.current_challenge["initials"],
                "round": session.current_challenge["round"],
                "difficulty": session.current_challenge["difficulty"],
                "hint": f"Find a {sport} player with initials {session.current_challenge['initials']}"
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to start survival game: {str(e)}")

@router.post("/guess")
@limiter.limit("30/minute")
async def submit_survival_guess(request: Request, guess_data: SurvivalGuessRequest):
    """Submit a guess for survival mode"""
    try:
        session_manager = get_survival_session_manager()
        session = session_manager.get_session(guess_data.session_id)
        
        if not session:
            raise HTTPException(status_code=404, detail="Session not found or expired")
        
        if session.lives <= 0:
            raise HTTPException(status_code=400, detail="Game over - no lives remaining")
        
        # Submit answer
        result = session_manager.submit_answer(guess_data.session_id, guess_data.guess)
        
        if not result:
            raise HTTPException(status_code=500, detail="Failed to process guess")
        
        response = {
            "correct": result["is_correct"],
            "guess": guess_data.guess,
            "correct_answer": result["correct_answer"],
            "similarity": result.get("similarity", 0),
            "lives": session.lives,
            "score": session.score,
            "round": session.round
        }
        
        # Check if game over first
        if result.get("game_over", False):
            response["game_over"] = True
            response["final_score"] = session.score
            response["final_round"] = session.round
            return response
        
        # Always include next challenge for multiplayer sync (from submit_answer result)
        if result.get("next_challenge"):
            next_challenge = result["next_challenge"]
            response["next_challenge"] = {
                "initials": next_challenge["initials"],
                "round": next_challenge["round"],
                "difficulty": next_challenge["difficulty"],
                "hint": f"Find a {session.sport} player with initials {next_challenge['initials']}"
            }
        
        return response
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to process guess: {str(e)}")

@router.get("/session/{session_id}")
async def get_session_status(session_id: str):
    """Get current session status"""
    try:
        session_manager = get_survival_session_manager()
        session = session_manager.get_session(session_id)
        
        if not session:
            raise HTTPException(status_code=404, detail="Session not found or expired")
        
        response = {
            "session_id": session.session_id,
            "sport": session.sport,
            "round": session.round,
            "lives": session.lives,
            "score": session.score,
            "game_over": session.lives <= 0,
            "hint_available": not session.hint_used
        }
        
        if session.current_challenge and session.lives > 0:
            response["current_challenge"] = {
                "initials": session.current_challenge["initials"],
                "round": session.current_challenge["round"],
                "difficulty": session.current_challenge["difficulty"],
                "hint": f"Find a {session.sport} player with initials {session.current_challenge['initials']}"
            }
        
        return response
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get session status: {str(e)}")

@router.post("/session/{session_id}/hint")
async def get_session_hint(session_id: str):
    """Get hint for current challenge (one per game session)"""
    try:
        session_manager = get_survival_session_manager()
        session = session_manager.get_session(session_id)
        
        if not session:
            raise HTTPException(status_code=404, detail="Session not found or expired")
        
        if session.lives <= 0:
            raise HTTPException(status_code=400, detail="Game over - no hints available")
        
        if not session.current_challenge:
            raise HTTPException(status_code=400, detail="No active challenge")
        
        if session.hint_used:
            raise HTTPException(status_code=400, detail="Hint already used for this game session")
        
        # Mark hint as used
        success = session_manager.use_hint(session_id)
        if not success:
            raise HTTPException(status_code=400, detail="Failed to use hint")
        
        # Get hint from SportDataFactory (same as legacy endpoint)
        from sports import SportDataFactory
        generator = SportDataFactory.get_generator(session.sport)
        if not generator:
            raise HTTPException(status_code=404, detail=f"Sport '{session.sport}' not found")
        
        current_initials = session.current_challenge["initials"]
        survival_data = generator.get_survival_data()
        if not survival_data or current_initials not in survival_data:
            raise HTTPException(status_code=400, detail="Invalid initials for hint")
        
        players = survival_data[current_initials]
        
        # Return a sample of players as hints (limit to 3)
        sample_players = random.sample(players, min(3, len(players)))
        
        return {
            "session_id": session_id,
            "initials": current_initials,
            "sample_players": sample_players,
            "total_players": len(players),
            "hint_used": True,
            "message": "Hint provided - no more hints available for this game session"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get hint: {str(e)}")

@router.post("/session/{session_id}/skip")
async def skip_challenge(session_id: str):
    """Skip current challenge and lose a life"""
    try:
        session_manager = get_survival_session_manager()
        result = session_manager.skip_challenge(session_id)
        
        if "error" in result:
            if result["error"] == "Session not found":
                raise HTTPException(status_code=404, detail=result["error"])
            else:
                raise HTTPException(status_code=400, detail=result["error"])
        
        if result.get("game_over"):
            return {
                "game_over": True,
                "lives": 0,
                "score": result["score"],
                "round": result["round"]
            }
        
        return {
            "lives": result["lives"],
            "challenge": result["challenge"],
            "skipped": True
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to skip challenge: {str(e)}")

@router.delete("/session/{session_id}")
async def end_survival_game(session_id: str):
    """End a survival game session"""
    try:
        session_manager = get_survival_session_manager()
        success = session_manager.end_session(session_id)
        
        if not success:
            raise HTTPException(status_code=404, detail="Session not found")
        
        return {"message": "Session ended successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to end session: {str(e)}")