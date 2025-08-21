"""
Survival mode routes for VerveQ Platform API
"""
from fastapi import APIRouter, HTTPException, Request, Response
from pydantic import BaseModel, Field, validator
from typing import Literal, Optional
from slowapi import Limiter
from slowapi.util import get_remote_address
from services.survival_session import get_survival_session_manager
import random

router = APIRouter(tags=["survival"])
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

class SurvivalGuessLegacyRequest(BaseModel):
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

class SurvivalStartRequest(BaseModel):
    sport: str = Field(
        ...,
        min_length=1,
        max_length=20,
        description="Sport for survival mode"
    )

# Sport validation  
ALLOWED_SPORTS = Literal["football", "tennis", "basketball", "soccer", "baseball", "hockey"]

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
        
        # If correct and game continues, get next challenge
        if result["is_correct"] and result.get("next_round", False):
            next_challenge = session_manager.next_challenge(guess_data.session_id)
            if next_challenge:
                response["next_challenge"] = {
                    "initials": next_challenge["initials"],
                    "round": next_challenge["round"],
                    "difficulty": next_challenge["difficulty"],
                    "hint": f"Find a {session.sport} player with initials {next_challenge['initials']}"
                }
        
        # Check if game over
        if result.get("game_over", False):
            response["game_over"] = True
            response["final_score"] = session.score
            response["final_round"] = session.round
        
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
        import random
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

# Legacy endpoints for backward compatibility
@router.options("/{sport}/survival/initials")
async def survival_initials_options(response: Response, sport: ALLOWED_SPORTS):
    """Handle OPTIONS request for survival initials endpoint"""
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "*"
    response.headers["Access-Control-Max-Age"] = "86400"
    return {"message": "OK"}

@router.get("/{sport}/survival/initials")
async def get_survival_initials_legacy(request: Request, sport: ALLOWED_SPORTS):
    """Legacy endpoint - Get initials using simple direct approach (fallback)"""
    import logging
    import asyncio
    import time
    
    logger = logging.getLogger(__name__)
    start_time = time.time()
    
    logger.info(f"🎯 SURVIVAL INITIALS REQUEST: sport={sport}")
    logger.info(f"   Request URL: {request.url}")
    logger.info(f"   Request headers: {dict(request.headers)}")
    
    try:
        # Add timeout to prevent infinite hanging
        async def get_initials_with_timeout():
            logger.info(f"   Loading SportDataFactory for {sport}")
            
            # Fallback to direct SportDataFactory approach for immediate compatibility
            from sports import SportDataFactory
            
            generator = SportDataFactory.get_generator(sport)
            if not generator:
                logger.error(f"   ❌ Sport '{sport}' not found in SportDataFactory")
                raise HTTPException(status_code=404, detail=f"Sport '{sport}' not found")
            
            logger.info(f"   ✅ Generator found: {type(generator).__name__}")
            logger.info(f"   Loading survival data...")
            
            survival_data = generator.get_survival_data()
            if not survival_data:
                logger.error(f"   ❌ No survival data available for {sport}")
                # Return fallback data instead of failing
                fallback_initials = ["CR", "LM", "KM", "VV", "KD", "EM", "RS", "NG", "RB", "MR"]
                import random
                selected = random.choice(fallback_initials)
                logger.info(f"   🔄 Using fallback initials: {selected}")
                return {
                    "initials": selected,
                    "hint": f"Find a {sport} player with initials {selected}",
                    "sport": sport
                }
            
            logger.info(f"   ✅ Survival data loaded: {len(survival_data)} initials sets")
            
            # Filter for 2-letter initials only (rounds 1-7 behavior) with performance limits
            two_letter_initials = []
            count = 0
            max_to_check = 100  # Only check first 100 entries for performance
            
            for k in survival_data.keys():
                if count >= max_to_check:
                    break
                if len(k) == 2 and k.isalpha() and all('A' <= c <= 'Z' for c in k):
                    two_letter_initials.append(k)
                count += 1
            
            if not two_letter_initials:
                # Fallback to hardcoded initials
                fallback_initials = ["CR", "LM", "KM", "VV", "KD"]
                import random
                selected = random.choice(fallback_initials)
                logger.info(f"   🔄 No 2-letter initials found, using fallback: {selected}")
                return {
                    "initials": selected,
                    "hint": f"Find a {sport} player with initials {selected}",
                    "sport": sport
                }
            
            import random
            initials = random.choice(two_letter_initials)
            
            logger.info(f"   🎲 Selected initials: {initials}")
            response_data = {
                "initials": initials,
                "hint": f"Find a {sport} player with initials {initials}",
                "sport": sport
            }
            logger.info(f"   📤 Returning response: {response_data}")
            return response_data
        
        # Execute with timeout (5 seconds maximum)
        try:
            result = await asyncio.wait_for(get_initials_with_timeout(), timeout=5.0)
            elapsed = time.time() - start_time
            logger.info(f"   ⏱️ Request completed in {elapsed:.2f}s")
            return result
        except asyncio.TimeoutError:
            logger.error(f"   ⏰ Request timed out after 5 seconds")
            # Return hardcoded fallback on timeout
            fallback_initials = ["CR", "LM", "KM", "VV", "KD", "EM", "RS", "NG", "RB", "MR"]
            import random
            selected = random.choice(fallback_initials)
            return {
                "initials": selected,
                "hint": f"Find a {sport} player with initials {selected}",
                "sport": sport
            }
        
    except HTTPException as he:
        elapsed = time.time() - start_time
        logger.error(f"   ❌ HTTP Exception after {elapsed:.2f}s: {he.detail}")
        raise
    except Exception as e:
        elapsed = time.time() - start_time
        logger.error(f"   ❌ Unexpected error after {elapsed:.2f}s: {str(e)}")
        logger.exception("   Full traceback:")
        
        # Return fallback response instead of crashing
        fallback_initials = ["CR", "LM", "KM", "VV", "KD", "EM", "RS", "NG", "RB", "MR"]
        import random
        selected = random.choice(fallback_initials)
        logger.info(f"   🔄 Returning fallback response due to error: {selected}")
        return {
            "initials": selected,
            "hint": f"Find a {sport} player with initials {selected}",
            "sport": sport
        }

@router.options("/{sport}/survival/guess")
async def survival_guess_options(response: Response, sport: ALLOWED_SPORTS):
    """Handle OPTIONS request for survival guess endpoint"""
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "*"
    response.headers["Access-Control-Max-Age"] = "86400"
    return {"message": "OK"}

@router.post("/{sport}/survival/guess")
@limiter.limit("30/minute")
async def submit_survival_guess_legacy(request: Request, sport: ALLOWED_SPORTS, guess_data: SurvivalGuessLegacyRequest):
    """Legacy endpoint - Submit guess using simple direct validation"""
    try:
        # Fallback to direct SportDataFactory approach for immediate compatibility
        from sports import SportDataFactory
        generator = SportDataFactory.get_generator(sport)
        if not generator:
            raise HTTPException(status_code=404, detail=f"Sport '{sport}' not found")
        
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
            "guess": guess_data.guess,
            "initials": initials,
            "message": "Correct!" if is_correct else "Try again!"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to process guess: {str(e)}")

@router.get("/{sport}/survival/reveal/")
async def reveal_survival_hints_empty(sport: ALLOWED_SPORTS):
    """Handle empty reveal endpoint (URL ending with slash)"""
    raise HTTPException(
        status_code=400, 
        detail="No initials provided. Please load a challenge first by calling the initials endpoint."
    )

@router.get("/{sport}/survival/reveal/{initials}")
async def reveal_survival_hints_legacy(sport: ALLOWED_SPORTS, initials: str):
    """Legacy endpoint - Get hint players for survival mode"""
    # Handle empty initials case
    if not initials or len(initials.strip()) == 0:
        raise HTTPException(
            status_code=400, 
            detail="No initials provided. Please load a challenge first by calling the initials endpoint."
        )
    
    # Validate initials parameter
    initials = initials.strip().upper()
    if len(initials) > 5 or not initials.isalpha():
        raise HTTPException(status_code=400, detail="Invalid initials format")
    
    try:
        # Use the sport data factory to get survival data for hints
        from sports import SportDataFactory
        generator = SportDataFactory.get_generator(sport)
        if not generator:
            raise HTTPException(status_code=404, detail=f"Sport '{sport}' not found")
        
        survival_data = generator.get_survival_data()
        if not survival_data or initials not in survival_data:
            raise HTTPException(status_code=400, detail="Invalid initials")
        
        players = survival_data[initials]
        
        # Return a sample of players as hints (limit to 3)
        import random
        sample_players = random.sample(players, min(3, len(players)))
        
        return {
            "initials": initials,
            "sample_players": sample_players,
            "total_players": len(players)
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get hints: {str(e)}")