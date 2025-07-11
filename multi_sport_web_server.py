"""
Multi-Sport VerveQ Web Server
Enhanced FastAPI server supporting multiple sports via sport managers.
"""

from fastapi import FastAPI, HTTPException, Query, Depends, Request, Path
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from starlette.middleware.sessions import SessionMiddleware
from typing import List, Dict, Any, Optional
import uvicorn
import random
import json
import time
from pathlib import Path as PathLib
import os
from datetime import datetime
from pydantic import BaseModel

# Import existing modules
from monitoring import monitor
from error_tracking import error_tracker
from rate_limiter import limiter
from analytics import AnalyticsManager
from difficulty_feedback_database import DifficultyFeedbackDatabase
from enhanced_difficulty_calculator import EnhancedDifficultyCalculator
from elo_system import EloRatingSystem
from survival_match_manager import SurvivalMatchManager

# Import our new sport managers
from sports import SportFactory

# Import configuration and data handler factory
from config import get_config, DatabaseConfig
from data_handler_factory import DataHandlerFactory

# Load configuration
config = get_config()

# Initialize data handler based on configuration
print("🔄 Initializing data handler...")
data_handler = DataHandlerFactory.create_data_handler(
    database_config=config.database,
    data_root=config.data_root
)
data_handler_info = DataHandlerFactory.get_handler_info(data_handler)
print(f"✅ Data handler initialized: {data_handler_info['type']} ({data_handler_info['status']})")

app = FastAPI(
    title="VerveQ Multi-Sport API",
    description="Multi-sport quiz and survival game platform supporting football, tennis, and more.",
    version="4.0.0"
)

# Add SessionMiddleware if SECRET_KEY is available
SECRET_KEY = os.environ.get("SECRET_KEY")
if SECRET_KEY:
    app.add_middleware(
        SessionMiddleware,
        secret_key=SECRET_KEY,
    )
    print("✅ SessionMiddleware enabled with SECRET_KEY")
else:
    print("WARNING: SECRET_KEY not found. Session middleware not enabled.")

# Add GZip middleware for response compression
app.add_middleware(GZipMiddleware, minimum_size=1000)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify exact origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware("http")
async def monitoring_middleware(request: Request, call_next):
    """Middleware to record request metrics and handle exceptions."""
    start_time = time.time()
    
    try:
        response = await call_next(request)
        duration_ms = (time.time() - start_time) * 1000
        
        monitor.record_request(
            path=request.url.path,
            method=request.method,
            status_code=response.status_code,
            duration_ms=duration_ms
        )
        
        return response
    except Exception as e:
        duration_ms = (time.time() - start_time) * 1000
        request_info = {
            "path": request.url.path,
            "method": request.method,
            "headers": {k.decode(): v.decode() for k, v in request.headers.raw}
        }
        error_tracker.capture_exception(e, context={"detail": "Unhandled exception in middleware"}, request=request_info)
        monitor.record_request(
            path=request.url.path,
            method=request.method,
            status_code=500,
            duration_ms=duration_ms
        )
        return JSONResponse(
            status_code=500,
            content={"detail": "Internal Server Error", "error_id": error_tracker.error_timestamps[-1] if error_tracker.error_timestamps else None}
        )

@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    """Generic exception handler to capture all unhandled exceptions."""
    request_info = {
        "path": request.url.path,
        "method": request.method,
        "headers": {k.decode(): v.decode() for k, v in request.headers.raw}
    }
    error_tracker.capture_exception(exc, context={"detail": "Caught by generic exception handler"}, request=request_info)
    
    return JSONResponse(
        status_code=500,
        content={"detail": "An internal server error occurred.", "error_id": error_tracker.error_timestamps[-1] if error_tracker.error_timestamps else None}
    )

# Rate limiting dependency
async def rate_limit_dependency(request: Request):
    client_ip = request.client.host
    endpoint = request.url.path
    
    is_allowed, message = limiter.is_allowed(client_ip, endpoint)
    if not is_allowed:
        raise HTTPException(status_code=429, detail=message)
    
    limiter.add_request(client_ip)
    return True

# Initialize global components
analytics_manager = None
feedback_database = None
elo_system = None
match_manager = None

try:
    print("🔄 Initializing multi-sport components...")
    
    # Display database configuration
    if config.database.enable_postgresql:
        print(f"🗄️  PostgreSQL enabled: {config.database.database_url}")
        print(f"🔄 Fallback to JSON: {config.database.fallback_to_json}")
    else:
        print("📁 Using JSON data handlers")
    
    # Analytics Manager
    analytics_manager = AnalyticsManager()
    print("✅ Analytics Manager initialized")
    
    # Difficulty Feedback Database
    feedback_database = DifficultyFeedbackDatabase()
    print("✅ Difficulty Feedback Database initialized")
    
    # Elo Rating System and Match Manager
    elo_system = EloRatingSystem()
    match_manager = SurvivalMatchManager()
    print("✅ Elo Rating System and Match Manager initialized")
        
except Exception as e:
    print(f"❌ Error initializing components: {e}")
    analytics_manager = None
    feedback_database = None
    elo_system = None
    match_manager = None

# Pydantic models
class Feedback(BaseModel):
    question: str
    user_answer: str
    is_correct: bool
    difficulty: str
    timestamp: float

class SurvivalAnswerRequest(BaseModel):
    answer: str
    initials: str

class PlayerRegistration(BaseModel):
    player_name: str

class MatchCreation(BaseModel):
    player1_name: str
    player2_name: str
    session_id: str

class MatchResult(BaseModel):
    session_id: str
    result: str
    rounds_played: int
    match_duration: int
    player1_lives_lost: Optional[int] = 0
    player2_lives_lost: Optional[int] = 0

class AnswerAttempt(BaseModel):
    session_id: str
    player_name: str
    is_correct: bool
    answer: Optional[str] = ""
    time_taken: Optional[float] = 0

class RoundStart(BaseModel):
    session_id: str
    initials: str

# Helper functions
def get_sport_manager(sport: str):
    """Get sport manager instance, raising HTTPException if invalid."""
    manager = SportFactory.create_sport_manager(sport, data_handler=data_handler)
    if not manager:
        supported = SportFactory.get_supported_sports()
        raise HTTPException(
            status_code=400, 
            detail=f"Sport '{sport}' not supported. Supported sports: {supported}"
        )
    return manager

def validate_sport_parameter(sport: str = Path(..., description="Sport name (football, tennis, etc.)")):
    """Validate sport parameter and return sport manager."""
    return get_sport_manager(sport)

# === CORE API ENDPOINTS ===

@app.get("/")
async def read_root():
    """Welcome message and API information."""
    return {
        "message": "Welcome to VerveQ Multi-Sport API",
        "version": "4.0.0",
        "supported_sports": SportFactory.get_supported_sports(),
        "docs": "/docs"
    }

@app.get("/api/sports")
async def get_supported_sports():
    """Get list of supported sports with their configurations."""
    try:
        sports_configs = SportFactory.get_sport_configs()
        return {
            "supported_sports": list(sports_configs.keys()),
            "sports_configs": sports_configs
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting sports: {str(e)}")

# === SPORT-SPECIFIC ENDPOINTS ===

@app.get("/api/{sport}/competitions")
async def get_sport_competitions(sport_manager=Depends(validate_sport_parameter)):
    """Get available competitions for a specific sport."""
    try:
        competitions = sport_manager.get_available_competitions()
        return {
            "sport": sport_manager.get_sport_name(),
            "competitions": competitions,
            "total_competitions": len(competitions)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting competitions: {str(e)}")

@app.get("/api/{sport}/quiz")
async def generate_sport_quiz(
    sport_manager=Depends(validate_sport_parameter),
    difficulty: str = Query("casual", pattern="^(casual|diehard)$", description="Quiz difficulty"),
    num_questions: int = Query(10, ge=5, le=20, description="Number of questions"),
    competition_id: Optional[str] = Query(None, description="Specific competition ID"),
    dependencies=[Depends(rate_limit_dependency)]
):
    """Generate a quiz for a specific sport."""
    try:
        sport_name = sport_manager.get_sport_name()
        monitor.track_usage("quiz_request", f"{sport_name}_{difficulty}")
        print(f"\nReceived quiz request for {sport_name} - difficulty: {difficulty}")
        
        # Get available competitions
        competitions = sport_manager.get_available_competitions()
        if not competitions:
            raise HTTPException(status_code=404, detail=f"No competitions available for {sport_name}")
        
        # Select competition
        if competition_id:
            selected_comp = next((c for c in competitions if c['competition_id'] == competition_id), None)
            if not selected_comp:
                raise HTTPException(status_code=404, detail=f"Competition '{competition_id}' not found")
        else:
            # Select random competition based on difficulty
            if difficulty == 'casual':
                selected_comp = random.choice(competitions)
            else:
                # For diehard, prefer stats competitions if available
                stats_comps = [c for c in competitions if c.get('data_type') == 'stats']
                selected_comp = random.choice(stats_comps if stats_comps else competitions)
        
        print(f"Selected competition: {selected_comp['competition_name']}")
        
        # Generate questions using sport manager
        all_questions = []
        templates = sport_manager.get_question_templates()
        
        for template in templates:
            try:
                questions = sport_manager.generate_questions(
                    selected_comp['competition_id'], 
                    template['type'], 
                    num_questions // len(templates) + 1
                )
                all_questions.extend(questions)
            except Exception as e:
                print(f"Error generating {template['type']} questions: {e}")
                continue
        
        # Filter questions by difficulty and quality
        filtered_questions = []
        for question in all_questions:
            # Add difficulty scoring
            difficulty_score = sport_manager.calculate_sport_difficulty(question)
            question['difficulty_score'] = difficulty_score
            
            # Filter by difficulty preference
            if difficulty == 'casual' and difficulty_score <= 0.6:
                filtered_questions.append(question)
            elif difficulty == 'diehard' and difficulty_score >= 0.4:
                filtered_questions.append(question)
        
        # Fallback: use any available questions if filtering yields too few
        if len(filtered_questions) < num_questions and all_questions:
            filtered_questions = all_questions
        
        # Select final questions
        if len(filtered_questions) >= num_questions:
            final_questions = random.sample(filtered_questions, num_questions)
        else:
            final_questions = filtered_questions
        
        # Add metadata to questions
        for i, question in enumerate(final_questions):
            question.update({
                "question_id": f"{sport_name}_{selected_comp['competition_id']}_{i}",
                "sport": sport_name,
                "competition": selected_comp['competition_name'],
                "timestamp": time.time()
            })
        
        print(f"Generated {len(final_questions)} questions for {sport_name}")
        
        return {
            "sport": sport_name,
            "difficulty": difficulty,
            "competition": selected_comp,
            "total_questions": len(final_questions),
            "quiz": final_questions
        }
        
    except HTTPException:
        raise
    except Exception as e:
        error_tracker.capture_exception(e)
        raise HTTPException(status_code=500, detail=f"Error generating quiz: {str(e)}")

@app.get("/api/{sport}/survival/round")
async def get_sport_survival_round(sport_manager=Depends(validate_sport_parameter)):
    """Get a new survival mode round for a specific sport."""
    try:
        sport_name = sport_manager.get_sport_name()
        monitor.track_usage("survival_round_request", sport_name)
        
        # Get survival data
        survival_data = sport_manager.get_survival_data()
        if not survival_data or not survival_data.get('initials_map'):
            raise HTTPException(status_code=503, detail=f"Survival mode not available for {sport_name}")
        
        # Select random initials
        initials_map = survival_data['initials_map']
        available_initials = list(initials_map.keys())
        
        if not available_initials:
            raise HTTPException(status_code=503, detail="No survival data available")
        
        # Prefer initials with multiple players for better gameplay
        multi_player_initials = [init for init in available_initials if len(initials_map[init]) > 1]
        selected_initials = random.choice(multi_player_initials if multi_player_initials else available_initials)
        
        possible_answers = initials_map[selected_initials]
        
        return {
            "sport": sport_name,
            "initials": selected_initials,
            "initials_formatted": f"{selected_initials[0]}.{selected_initials[1]}.",
            "possible_answers_count": len(possible_answers),
            "round_id": f"{sport_name}_{selected_initials}_{hash(str(possible_answers))}"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        error_tracker.capture_exception(e)
        raise HTTPException(status_code=500, detail=f"Error generating survival round: {str(e)}")

@app.post("/api/{sport}/survival/validate")
async def validate_sport_survival_answer(
    request: SurvivalAnswerRequest,
    sport_manager=Depends(validate_sport_parameter),
    max_mistakes: int = Query(2, ge=0, le=3, description="Maximum spelling mistakes allowed")
):
    """Validate a survival mode answer for a specific sport."""
    try:
        sport_name = sport_manager.get_sport_name()
        monitor.track_usage("survival_validate", sport_name)
        
        is_valid, matched_player = sport_manager.validate_survival_answer(
            request.answer, 
            request.initials, 
            max_mistakes
        )
        
        return {
            "sport": sport_name,
            "valid": is_valid,
            "matched_player": matched_player,
            "submitted_answer": request.answer,
            "target_initials": request.initials
        }
        
    except HTTPException:
        raise
    except Exception as e:
        error_tracker.capture_exception(e)
        raise HTTPException(status_code=500, detail=f"Error validating answer: {str(e)}")

@app.get("/api/{sport}/players")
async def get_sport_players(
    sport_manager=Depends(validate_sport_parameter),
    search: Optional[str] = Query(None, description="Search term for player names"),
    limit: int = Query(50, ge=1, le=200, description="Maximum number of players to return")
):
    """Get player list for a specific sport with optional search."""
    try:
        sport_name = sport_manager.get_sport_name()
        
        if search:
            # Get suggestions based on search term
            players = sport_manager.get_player_suggestions(search, limit)
        else:
            # Get survival data for full player list
            survival_data = sport_manager.get_survival_data()
            if survival_data and 'initials_map' in survival_data:
                all_players = []
                for players_list in survival_data['initials_map'].values():
                    all_players.extend(players_list)
                players = list(set(all_players))[:limit]
            else:
                players = []
        
        return {
            "sport": sport_name,
            "players": players,
            "total_returned": len(players),
            "search_term": search
        }
        
    except HTTPException:
        raise
    except Exception as e:
        error_tracker.capture_exception(e)
        raise HTTPException(status_code=500, detail=f"Error getting players: {str(e)}")

# === ELO RATING SYSTEM (SPORT-AGNOSTIC FOR NOW) ===

@app.post("/api/elo/register")
async def register_player(request: PlayerRegistration, rate_limit: bool = Depends(rate_limit_dependency)):
    """Register a new player or get existing player information."""
    try:
        if not elo_system:
            raise HTTPException(status_code=503, detail="Elo system not available")
        
        player_id = elo_system.register_player(request.player_name)
        if not player_id:
            raise HTTPException(status_code=400, detail="Failed to register player")
        
        player_stats = elo_system.get_player_stats(request.player_name)
        return {
            "success": True,
            "player_id": player_id,
            "player_stats": player_stats
        }
    except HTTPException:
        raise
    except Exception as e:
        error_tracker.capture_exception(e)
        raise HTTPException(status_code=500, detail="Internal server error")

@app.get("/api/elo/leaderboard")
async def get_leaderboard(limit: int = Query(10, ge=1, le=50), rate_limit: bool = Depends(rate_limit_dependency)):
    """Get current leaderboard."""
    try:
        if not elo_system:
            raise HTTPException(status_code=503, detail="Elo system not available")
        
        leaderboard = elo_system.get_leaderboard(limit)
        return {
            "leaderboard": leaderboard,
            "total_players": len(leaderboard)
        }
    except HTTPException:
        raise
    except Exception as e:
        error_tracker.capture_exception(e)
        raise HTTPException(status_code=500, detail="Internal server error")

# === HEALTH AND SYSTEM ENDPOINTS ===

@app.get("/health")
async def health_check():
    """Health check endpoint."""
    try:
        # Validate all sports
        sport_validation = SportFactory.validate_all_sports(data_handler)
        
        return {
            "status": "healthy" if all(sport_validation.values()) else "degraded",
            "message": "VerveQ Multi-Sport API is running",
            "supported_sports": list(sport_validation.keys()),
            "sport_status": sport_validation,
            "components": {
                "analytics": analytics_manager is not None,
                "elo_system": elo_system is not None,
                "match_manager": match_manager is not None,
                "data_handler": data_handler_info
            }
        }
    except Exception as e:
        return {
            "status": "error",
            "message": f"Health check failed: {str(e)}"
        }

@app.get("/api/stats")
async def get_platform_stats():
    """Get platform-wide statistics."""
    try:
        sports_configs = SportFactory.get_sport_configs()
        
        stats = {
            "supported_sports": len(sports_configs),
            "sports": {}
        }
        
        for sport_name in sports_configs:
            try:
                manager = SportFactory.create_sport_manager(sport_name, data_handler=data_handler)
                if manager:
                    competitions = manager.get_available_competitions()
                    survival_data = manager.get_survival_data()
                    
                    stats["sports"][sport_name] = {
                        "competitions": len(competitions),
                        "survival_players": survival_data.get('total_players', 0),
                        "unique_initials": survival_data.get('unique_initials', 0)
                    }
            except Exception as e:
                stats["sports"][sport_name] = {"error": str(e)}
        
        return stats
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting stats: {str(e)}")

# === STATIC FILE SERVING ===

# Custom StaticFiles class to add no-cache headers
class NoCacheStaticFiles(StaticFiles):
    async def get_response(self, path: str, scope):
        response = await super().get_response(path, scope)
        response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate, max-age=0"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"
        response.headers["Last-Modified"] = time.strftime('%a, %d %b %Y %H:%M:%S GMT', time.gmtime())
        response.headers["ETag"] = f'"{hash(str(time.time()))}"'
        return response

# Custom route to serve the multi-sport index page
@app.get("/", response_class=FileResponse)
async def serve_multi_sport_index():
    """Serve the multi-sport index page"""
    return FileResponse(PathLib(__file__).parent / "multi_sport_index.html")

# Service worker route to eliminate 404s
@app.get("/service-worker.js")
async def serve_service_worker():
    """Serve basic service worker to eliminate 404 errors"""
    service_worker_content = """
// Basic service worker for VerveQ Multi-Sport Platform
self.addEventListener('install', function(event) {
    console.log('VerveQ Service Worker installed');
});

self.addEventListener('fetch', function(event) {
    // Let the browser handle the request normally
    return;
});
"""
    from fastapi.responses import Response
    return Response(content=service_worker_content, media_type="application/javascript")

# Favicon route to eliminate 404s
@app.get("/favicon.ico")
async def serve_favicon():
    """Serve favicon or return 204 No Content to eliminate 404 errors"""
    from fastapi.responses import Response
    return Response(status_code=204)

# Mount static files
app.mount("/static", NoCacheStaticFiles(directory=PathLib(__file__).parent / "static"), name="static")
# Mount other HTML files (but not root to avoid conflict with our custom route)
app.mount("/html", NoCacheStaticFiles(directory=PathLib(__file__).parent, html=True), name="html_static")

if __name__ == "__main__":
    print("🚀 Starting VerveQ Multi-Sport FastAPI Server...")
    print("=" * 60)
    
    # Verify sport managers
    sport_validation = SportFactory.validate_all_sports(data_handler)
    
    print("✅ Multi-sport server initialization successful!")
    print(f"\n📊 Available Sports:")
    for sport, status in sport_validation.items():
        status_icon = "✅" if status else "❌"
        print(f"   {status_icon} {sport.title()}")
    
    print(f"\n🌐 Server starting at: http://127.0.0.1:8008")
    print(f"🔍 Health check: http://127.0.0.1:8008/health")
    print(f"📚 API docs: http://127.0.0.1:8008/docs")
    print(f"🛑 Press Ctrl+C to stop the server\n")
    
    try:
        uvicorn.run(app, host="127.0.0.1", port=8008, log_level="info")
    except KeyboardInterrupt:
        print("\n👋 Multi-sport server stopped by user")
    except Exception as e:
        print(f"\n❌ Server error: {e}")
        print("💡 Check the logs for more details")