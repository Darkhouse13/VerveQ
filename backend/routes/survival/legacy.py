"""
Legacy survival mode routes for VerveQ Platform API
Backward compatibility endpoints
"""
from fastapi import APIRouter, HTTPException, Request, Response
from pydantic import BaseModel, Field, validator
from typing import Literal
from slowapi import Limiter
from slowapi.util import get_remote_address
import random

router = APIRouter()
limiter = Limiter(key_func=get_remote_address)

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

# Sport validation  
ALLOWED_SPORTS = Literal["football", "tennis", "basketball", "soccer", "baseball", "hockey"]

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
                selected = random.choice(fallback_initials)
                logger.info(f"   🔄 No 2-letter initials found, using fallback: {selected}")
                return {
                    "initials": selected,
                    "hint": f"Find a {sport} player with initials {selected}",
                    "sport": sport
                }
            
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