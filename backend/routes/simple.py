"""
Simple routes and utilities for VerveQ Platform API
"""
from fastapi import APIRouter, Request, Response
from pydantic import BaseModel, Field
from typing import Optional
from slowapi import Limiter
from slowapi.util import get_remote_address
from sports import SportDataFactory

router = APIRouter(tags=["api"])
limiter = Limiter(key_func=get_remote_address)

class SessionScore(BaseModel):
    score: int = Field(..., ge=0, le=10000, description="Game score")
    sport: str = Field(..., min_length=1, max_length=50, description="Sport name")
    game_mode: str = Field(..., min_length=1, max_length=50, description="Game mode")
    duration: Optional[int] = Field(None, ge=0, le=3600, description="Game duration in seconds")
    correct_answers: Optional[int] = Field(None, ge=0, description="Number of correct answers")
    total_questions: Optional[int] = Field(None, ge=0, description="Total questions answered")


@router.get("/")
async def root():
    return {
        "message": "VerveQ Platform API v3.0",
        "features": ["ELO Rating", "Leaderboards", "Challenges", "Analytics", "Achievements"],
        "available_sports": SportDataFactory.get_available_sports()
    }

@router.get("/health")
async def health_check():
    """Health check endpoint to verify all subsystems"""
    import time
    start_time = time.time()
    
    health_status = {
        "status": "healthy",
        "timestamp": time.time(),
        "checks": {},
        "response_time_ms": 0
    }
    
    try:
        # Check SportDataFactory initialization
        try:
            available_sports = SportDataFactory.get_available_sports()
            health_status["checks"]["sport_factory"] = {
                "status": "healthy",
                "available_sports": available_sports,
                "count": len(available_sports)
            }
        except Exception as e:
            health_status["checks"]["sport_factory"] = {
                "status": "unhealthy",
                "error": str(e)
            }
            health_status["status"] = "degraded"
        
        # Check football survival data
        try:
            generator = SportDataFactory.get_generator("football")
            if generator:
                survival_data = generator.get_survival_data()
                health_status["checks"]["football_survival"] = {
                    "status": "healthy",
                    "data_available": bool(survival_data),
                    "initials_count": len(survival_data) if survival_data else 0
                }
            else:
                health_status["checks"]["football_survival"] = {
                    "status": "unhealthy",
                    "error": "Football generator not found"
                }
                health_status["status"] = "degraded"
        except Exception as e:
            health_status["checks"]["football_survival"] = {
                "status": "unhealthy",
                "error": str(e)
            }
            health_status["status"] = "degraded"
        
        # Check database connectivity (if applicable)
        try:
            from pathlib import Path
            db_paths = [
                "/mnt/c/Users/hamza/OneDrive/Python_Scripts/VerveQ/data_cleaning/football_comprehensive.db",
                "data_cleaning/football_comprehensive.db",
                "../data_cleaning/football_comprehensive.db"
            ]
            db_available = any(Path(p).exists() for p in db_paths)
            health_status["checks"]["database"] = {
                "status": "healthy" if db_available else "warning",
                "database_available": db_available,
                "note": "Using fallback data" if not db_available else "Database connected"
            }
        except Exception as e:
            health_status["checks"]["database"] = {
                "status": "warning",
                "error": str(e),
                "note": "Database check failed, using fallback"
            }
        
    except Exception as e:
        health_status["status"] = "unhealthy"
        health_status["error"] = str(e)
    
    finally:
        health_status["response_time_ms"] = round((time.time() - start_time) * 1000, 2)
    
    return health_status


@router.post("/api/guest-session")
async def create_guest_session():
    """Create anonymous guest session"""
    import uuid
    session_id = str(uuid.uuid4())
    return {"session_id": session_id, "expires_in": 3600}


@router.get("/debug/cors")
async def debug_cors(request: Request):
    """Debug endpoint for CORS configuration testing"""
    from config.settings import settings
    
    return {
        "message": "CORS Debug Endpoint",
        "method": request.method,
        "headers": dict(request.headers),
        "url": str(request.url),
        "client": str(request.client),
        "cors_configuration": {
            "cors_origins": settings.cors_origins,
            "cors_allow_credentials": settings.cors_allow_credentials,
            "environment": settings.environment,
            "debug": settings.debug
        },
        "request_analysis": {
            "origin": request.headers.get('origin', 'NOT_SET'),
            "user_agent": request.headers.get('user-agent', 'NOT_SET'),
            "referer": request.headers.get('referer', 'NOT_SET')
        },
        "status": "OK"
    }



@router.post("/session")
async def create_session():
    """Create a game session"""
    import uuid
    session_id = str(uuid.uuid4())
    return {"session_id": session_id, "created_at": "2024-01-01T00:00:00Z"}


@router.get("/session/{session_id}/dashboard")
async def get_session_dashboard(session_id: str):
    """Get dashboard data for a specific session"""
    return {
        "session_id": session_id,
        "dashboard": {
            "total_games": 0,
            "best_score": 0,
            "average_score": 0,
            "current_streak": 0,
            "sports_played": []
        }
    }


@router.post("/session/{session_id}/score")
@limiter.limit("20/minute")
async def update_session_score(session_id: str, score_data: SessionScore, request: Request):
    """Update score for a specific session"""
    # Log the received data for debugging
    print(f"Received score update for session {session_id}: {score_data}")
    
    return {
        "session_id": session_id,
        "score_recorded": True,
        "score": score_data.score,
        "sport": score_data.sport,
        "game_mode": score_data.game_mode,
        "elo_change": 0,
        "new_elo": 1200,
        "achievements_earned": []
    }