"""
VerveQ Unified Server
Consolidates functionality from web_server.py, main.py, and multi_sport_web_server.py
into a single configurable FastAPI application.
"""

from fastapi import FastAPI, HTTPException, Query, Depends, Request, Path as FastAPIPath
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from starlette.middleware.sessions import SessionMiddleware
from typing import List, Dict, Any, Optional, Union
import uvicorn
import random
import json
import time
from pathlib import Path
import os
from datetime import datetime
from pydantic import BaseModel
import sys

# Import configuration system
from config import get_config, ServerConfig, ServerMode

# Global variables for conditional imports and initialization
config: ServerConfig = None
app: FastAPI = None

# Data handlers (conditionally initialized)
data_handler = None
cached_data_handler = None
quiz_generator = None
survival_handler = None

# Advanced features (conditionally initialized)
analytics_manager = None
feedback_database = None
enhanced_difficulty_calculator = None
elo_system = None
match_manager = None
monitor = None
error_tracker = None
limiter = None

# Multi-sport features (conditionally initialized)
sport_factory = None


def initialize_core_dependencies():
    """Initialize core data handling dependencies"""
    global data_handler, cached_data_handler, quiz_generator, survival_handler
    
    try:
        print("🔄 Initializing core data handlers...")
        
        # Check if PostgreSQL is enabled and configured
        if config.database.enable_postgresql and config.database.database_url:
            try:
                from postgresql_data_handler import PostgreSQLDataHandler
                data_handler = PostgreSQLDataHandler(
                    database_url=config.database.database_url,
                    cache_ttl=config.database.cache_ttl,
                    redis_url=config.database.redis_url
                )
                print("✅ PostgreSQL data handler initialized")
            except Exception as e:
                print(f"⚠️  PostgreSQL initialization failed: {e}")
                if not config.database.fallback_to_json:
                    raise e
                print("🔄 Falling back to JSON data handler...")
                from Data import JSONDataHandler
                data_handler = JSONDataHandler(data_root=config.data_root)
                print("✅ JSON data handler initialized (fallback)")
        else:
            # Use JSON data handler
            from Data import JSONDataHandler
            data_handler = JSONDataHandler(data_root=config.data_root)
            print("✅ JSON data handler initialized")
        
        # Initialize caching if enabled (only for JSON handler, PostgreSQL has built-in caching)
        if config.enable_caching and not hasattr(data_handler, '_is_postgresql_handler'):
            from Data import CacheManager
            cached_data_handler = CacheManager(data_handler)
            print("✅ Cache manager initialized")
        else:
            cached_data_handler = data_handler
        
        # Initialize quiz generator
        from QuizGenerator import QuizGenerator
        quiz_generator = QuizGenerator(cached_data_handler)
        print("✅ Quiz generator initialized")
        
        # Initialize survival mode if enabled
        if config.enable_survival_mode:
            from SurvivalDataHandler import SurvivalDataHandler
            survival_handler = SurvivalDataHandler()
            print("✅ Survival mode handler initialized")
            
    except Exception as e:
        print(f"❌ Error initializing core dependencies: {e}")
        import traceback
        traceback.print_exc()
        return False
    
    return True


def initialize_advanced_features():
    """Initialize advanced features based on configuration"""
    global analytics_manager, feedback_database, enhanced_difficulty_calculator
    global elo_system, match_manager, monitor, error_tracker, limiter
    
    try:
        # Initialize monitoring if enabled
        if config.enable_monitoring:
            from monitoring import monitor as _monitor
            monitor = _monitor
            print("✅ Monitoring initialized")
            
            from error_tracking import error_tracker as _error_tracker
            error_tracker = _error_tracker
            print("✅ Error tracking initialized")
        
        # Initialize rate limiting if enabled
        if config.enable_rate_limiting:
            from rate_limiter import limiter as _limiter
            limiter = _limiter
            print("✅ Rate limiter initialized")
        
        # Initialize analytics if enabled
        if config.enable_analytics:
            from analytics import AnalyticsManager
            analytics_manager = AnalyticsManager()
            print("✅ Analytics manager initialized")
            
            from difficulty_feedback_database import DifficultyFeedbackDatabase
            feedback_database = DifficultyFeedbackDatabase()
            print("✅ Difficulty feedback database initialized")
            
            from enhanced_difficulty_calculator import EnhancedDifficultyCalculator
            enhanced_difficulty_calculator = EnhancedDifficultyCalculator(data_handler)
            print("✅ Enhanced difficulty calculator initialized")
        
        # Initialize ELO system if enabled
        if config.enable_elo_system:
            from elo_system import EloRatingSystem
            from survival_match_manager import SurvivalMatchManager
            elo_system = EloRatingSystem()
            match_manager = SurvivalMatchManager()
            print("✅ ELO system and match manager initialized")
            
    except Exception as e:
        print(f"❌ Error initializing advanced features: {e}")
        return False
    
    return True


def initialize_multi_sport():
    """Initialize multi-sport features if enabled"""
    global sport_factory
    
    if not config.enable_multi_sport:
        return True
    
    try:
        from sports import SportFactory
        sport_factory = SportFactory
        print("✅ Multi-sport factory initialized")
        return True
    except Exception as e:
        print(f"❌ Error initializing multi-sport features: {e}")
        return False


def create_app() -> FastAPI:
    """Create and configure the FastAPI application"""
    global config, app
    
    # Load configuration
    config = get_config()
    
    # Create FastAPI app with appropriate metadata
    if config.server_mode == ServerMode.MINIMAL:
        app_title = "VerveQ API - Minimal"
        app_description = "Lightweight football quiz API with basic functionality"
        app_version = "3.0.0"
    elif config.server_mode == ServerMode.FULL:
        app_title = "VerveQ Multi-Sport API"
        app_description = "Multi-sport quiz and survival game platform supporting football, tennis, and more"
        app_version = "4.0.0"
    else:  # STANDARD
        app_title = "VerveQ API"
        app_description = "Full-featured football quiz and survival game platform"
        app_version = "3.5.0"
    
    app = FastAPI(
        title=app_title,
        description=app_description,
        version=app_version,
        debug=config.debug
    )
    
    # Configure middleware
    configure_middleware()
    
    # Initialize dependencies based on configuration
    if not initialize_core_dependencies():
        print("❌ Failed to initialize core dependencies")
        sys.exit(1)
    
    if not initialize_advanced_features():
        print("⚠️ Some advanced features failed to initialize")
    
    if not initialize_multi_sport():
        print("⚠️ Multi-sport features failed to initialize")
    
    # Register routes based on configuration
    register_routes()
    
    # Mount static files
    mount_static_files()
    
    return app


def configure_middleware():
    """Configure middleware based on configuration"""
    global app, config
    
    # Session middleware
    if config.enable_sessions and config.secret_key:
        app.add_middleware(
            SessionMiddleware,
            secret_key=config.secret_key,
        )
        print("✅ SessionMiddleware enabled")
    elif config.enable_sessions:
        print("⚠️ Sessions enabled but no SECRET_KEY provided")
    
    # GZip middleware
    if config.enable_gzip:
        app.add_middleware(GZipMiddleware, minimum_size=1000)
        print("✅ GZip middleware enabled")
    
    # CORS middleware
    if config.enable_cors:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=["*"],  # In production, specify exact origins
            allow_credentials=True,
            allow_methods=["*"],
            allow_headers=["*"],
        )
        print("✅ CORS middleware enabled")


def register_routes():
    """Register API routes based on configuration"""
    # Always register basic routes
    register_basic_routes()
    
    # Register legacy endpoints if enabled
    if config.enable_legacy_endpoints:
        register_legacy_routes()
    
    # Register advanced features if enabled
    if config.enable_analytics:
        register_analytics_routes()
    
    if config.enable_elo_system:
        register_elo_routes()
    
    if config.enable_survival_mode:
        register_survival_routes()
    
    if config.enable_admin_dashboard:
        register_admin_routes()
    
    # Register multi-sport routes if enabled
    if config.enable_multi_sport:
        register_multi_sport_routes()


def mount_static_files():
    """Mount static file directories with Vite build support"""
    try:
        # Custom StaticFiles class for cache control
        class ViteStaticFiles(StaticFiles):
            def __init__(self, *args, **kwargs):
                super().__init__(*args, **kwargs)

            def file_response(self, *args, **kwargs):
                response = super().file_response(*args, **kwargs)

                # Cache static assets in production, no-cache for HTML
                if args[0].endswith(('.js', '.css', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.woff', '.woff2')):
                    # Cache static assets for 1 year
                    response.headers["Cache-Control"] = "public, max-age=31536000, immutable"
                else:
                    # No cache for HTML files
                    response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
                    response.headers["Pragma"] = "no-cache"
                    response.headers["Expires"] = "0"

                return response

        # Check if Vite build output exists (production mode)
        dist_path = Path(__file__).parent / "dist"
        if dist_path.exists() and (dist_path / "index.html").exists():
            print("🏗️ Using Vite production build")

            # Mount built assets
            assets_path = dist_path / "assets"
            if assets_path.exists():
                app.mount("/assets", ViteStaticFiles(directory=assets_path), name="vite_assets")
                print("✅ Vite assets mounted")

            # Mount root for HTML files from dist
            app.mount("/", ViteStaticFiles(directory=dist_path, html=True), name="vite_static")
            print("✅ Vite static files mounted")

        else:
            print("🔧 Using development mode (legacy static files)")

            # Fallback to legacy static files for development
            class NoCacheStaticFiles(StaticFiles):
                def file_response(self, *args, **kwargs):
                    response = super().file_response(*args, **kwargs)
                    response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
                    response.headers["Pragma"] = "no-cache"
                    response.headers["Expires"] = "0"
                    return response

            # Mount legacy static directory
            static_path = Path(__file__).parent / "static"
            if static_path.exists():
                app.mount("/static", NoCacheStaticFiles(directory=static_path), name="static")
                print("✅ Legacy static files mounted")

            # Mount root directory for HTML files
            root_path = Path(__file__).parent
            app.mount("/", NoCacheStaticFiles(directory=root_path, html=True), name="root_static")
            print("✅ Legacy root static files mounted")

    except Exception as e:
        print(f"⚠️ Error mounting static files: {e}")


# ================================
# ROUTE REGISTRATION FUNCTIONS
# ================================

def register_basic_routes():
    """Register basic routes available in all server modes"""

    @app.get("/")
    async def read_root():
        """Welcome message and API information"""
        if config.enable_multi_sport and sport_factory:
            return {
                "message": "Welcome to VerveQ Multi-Sport API",
                "version": app.version,
                "supported_sports": sport_factory.get_supported_sports() if sport_factory else ["football"],
                "docs": "/docs",
                "server_mode": config.server_mode.value
            }
        else:
            return {
                "message": "Welcome to VerveQ API",
                "version": app.version,
                "docs": "/docs",
                "server_mode": config.server_mode.value
            }

    @app.get("/health")
    async def health_check():
        """Health check endpoint"""
        if not data_handler:
            return {
                "status": "error",
                "message": "Data handler not initialized",
                "server_mode": config.server_mode.value
            }

        try:
            competitions = data_handler.get_available_competitions()
            health_info = {
                "status": "healthy",
                "message": "VerveQ API is running",
                "server_mode": config.server_mode.value,
                "available_competitions": len(competitions),
                "features": {
                    "analytics": config.enable_analytics,
                    "monitoring": config.enable_monitoring,
                    "elo_system": config.enable_elo_system,
                    "survival_mode": config.enable_survival_mode,
                    "multi_sport": config.enable_multi_sport
                }
            }

            if config.server_mode != ServerMode.MINIMAL:
                health_info.update({
                    "award_competitions": len([c for c in competitions if c['data_type'] == 'award']),
                    "stats_competitions": len([c for c in competitions if c['data_type'] == 'stats'])
                })

            return health_info
        except Exception as e:
            return {
                "status": "error",
                "message": f"Health check failed: {str(e)}",
                "server_mode": config.server_mode.value
            }

    # Rate limiting dependency (conditional)
    def get_rate_limit_dependency():
        if config.enable_rate_limiting and limiter:
            async def rate_limit_dependency(request: Request):
                client_ip = request.client.host if request.client else "unknown"
                endpoint = request.url.path

                allowed, message = limiter.is_allowed(client_ip, endpoint)
                if not allowed:
                    raise HTTPException(status_code=429, detail=message)

                limiter.add_request(client_ip)
                return True
            return rate_limit_dependency
        else:
            # No-op dependency when rate limiting is disabled
            async def no_rate_limit():
                return True
            return no_rate_limit

    rate_limit_dependency = get_rate_limit_dependency()

    # Basic quiz endpoint (available in all modes)
    if config.server_mode == ServerMode.MINIMAL:
        # Minimal mode - simple quiz endpoint like main.py
        @app.get("/api/quiz", summary="Generate a Quiz")
        def generate_quiz_endpoint(
            difficulty: str = Query("casual", pattern="^(casual|diehard)$"),
            num_questions: int = Query(config.default_quiz_questions, ge=5, le=config.max_questions_per_quiz)
        ) -> List[dict]:
            """Generate a quiz from a randomly selected competition (minimal mode)"""
            if not quiz_generator or not data_handler:
                raise HTTPException(status_code=500, detail="Server not initialized correctly.")

            # Get all valid competitions (awards and player stats)
            available_competitions = [
                comp for comp in data_handler.get_available_competitions()
                if comp['data_type'] in ['award', 'stats']
            ]

            if not available_competitions:
                raise HTTPException(status_code=404, detail="No valid competitions available.")

            # Select a random competition
            random_competition = random.choice(available_competitions)
            competition_id = random_competition['competition_id']

            print(f"Generating a '{difficulty}' quiz with {num_questions} questions from: {competition_id}")

            quiz = quiz_generator.generate_quiz(competition_id, num_questions)

            if not quiz:
                raise HTTPException(status_code=500, detail=f"Failed to generate quiz from competition: {competition_id}")

            # Add a timestamp to each question for scoring
            for question in quiz:
                question['timestamp'] = time.time()

            return quiz

    else:
        # Standard/Full mode - advanced quiz endpoint
        @app.get("/quiz", dependencies=[Depends(rate_limit_dependency)])
        async def generate_difficulty_based_quiz(
            difficulty: str = Query(..., pattern="^(casual|diehard)$", description="Quiz difficulty: 'casual' or 'diehard'"),
            num_questions: int = Query(config.default_quiz_questions, ge=5, le=config.max_questions_per_quiz, description="Number of questions")
        ):
            """Generate a quiz based on difficulty level with random competition selection"""
            if monitor:
                monitor.track_usage("quiz_request", difficulty)

            print(f"\nReceived quiz request for difficulty: {difficulty}")

            try:
                if not cached_data_handler or not quiz_generator:
                    raise HTTPException(status_code=500, detail="Server components not initialized properly")

                # Get available competitions
                available_competitions = cached_data_handler.get_available_competitions()
                valid_competitions = [
                    comp for comp in available_competitions
                    if comp['data_type'] in ['award', 'stats'] and comp.get('total_records', 0) > 0
                ]

                if not valid_competitions:
                    raise HTTPException(status_code=404, detail="No valid competitions available for quiz generation")

                # Generate quiz using difficulty-based method
                if hasattr(quiz_generator, 'generate_difficulty_based_quiz'):
                    quiz = quiz_generator.generate_difficulty_based_quiz(
                        difficulty_mode=difficulty,
                        num_questions=num_questions,
                        competitions=valid_competitions
                    )
                else:
                    # Fallback to regular quiz generation
                    random_competition = random.choice(valid_competitions)
                    quiz = quiz_generator.generate_quiz(random_competition['competition_id'], num_questions)

                if not quiz:
                    raise HTTPException(status_code=500, detail="Failed to generate quiz questions")

                # Add metadata
                for question in quiz:
                    question['timestamp'] = time.time()
                    question['difficulty_mode'] = difficulty

                print(f"✅ Generated {len(quiz)} questions for {difficulty} mode")
                return quiz

            except HTTPException:
                raise
            except Exception as e:
                if error_tracker:
                    error_tracker.capture_exception(e)
                print(f"❌ Quiz generation error: {e}")
                raise HTTPException(status_code=500, detail="Internal server error during quiz generation")


def register_legacy_routes():
    """Register legacy API endpoints for backward compatibility"""

    @app.post("/api/feedback", summary="Submit Quiz Feedback")
    async def submit_feedback(feedback: dict):
        """Receives feedback from the quiz and stores it (legacy endpoint)"""
        feedback_file = Path(__file__).parent / "feedback.json"

        try:
            # Load existing feedback
            if feedback_file.exists():
                with open(feedback_file, 'r') as f:
                    try:
                        feedback_data = json.load(f)
                    except json.JSONDecodeError:
                        feedback_data = []
            else:
                feedback_data = []

            # Add new feedback
            feedback_data.append({
                **feedback,
                "timestamp": time.time(),
                "server_mode": config.server_mode.value
            })

            # Save feedback
            with open(feedback_file, 'w') as f:
                json.dump(feedback_data, f, indent=2)

            return {"message": "Feedback received successfully!"}

        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to write feedback: {e}")

    @app.get("/api/all_players", summary="Get All Player Names")
    async def get_all_players_endpoint() -> List[str]:
        """Provides a comprehensive list of all unique player names (legacy endpoint)"""
        if not data_handler:
            raise HTTPException(status_code=500, detail="Data handler not initialized")

        try:
            players = data_handler.get_all_players_across_competitions()
            return players
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to get players: {str(e)}")

    @app.get("/competitions")
    async def get_competitions():
        """Get available competitions (legacy endpoint)"""
        try:
            if not data_handler:
                raise HTTPException(status_code=500, detail="Data handler not initialized")

            competitions = data_handler.get_available_competitions()
            return {"competitions": competitions}
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    @app.get("/players")
    async def get_all_players(
        scope: str = Query("curated", pattern="^(curated|full)$", description="Dataset scope")
    ):
        """Get player names with scope selection for different game modes (legacy endpoint)"""
        try:
            if scope == "full" and config.enable_survival_mode and survival_handler:
                # Use full dataset for survival mode
                if not survival_handler.is_loaded():
                    raise HTTPException(status_code=503, detail="Full dataset is still loading.")

                players = survival_handler.get_all_players()
                stats = survival_handler.get_statistics()

                return {
                    "scope": "full",
                    "total_players": len(players),
                    "unique_initials": stats.get("unique_initials", 0),
                    "players": players,
                    "dataset_info": "Complete football database with 30K+ players"
                }
            else:
                # Use curated dataset
                if not data_handler:
                    raise HTTPException(status_code=500, detail="Data handler not initialized")

                players = data_handler.get_all_players_across_competitions()
                return {
                    "scope": "curated",
                    "total_players": len(players),
                    "players": players,
                    "dataset_info": "Curated dataset with award winners and top players"
                }

        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to get players: {str(e)}")


def register_analytics_routes():
    """Register analytics and feedback routes"""
    if not analytics_manager:
        return

    # Pydantic models for analytics
    class AnalyticsEvent(BaseModel):
        player_id: str
        event_type: str
        event_data: dict
        timestamp: Optional[float] = None

    class QuestionFeedbackRequest(BaseModel):
        question_id: str
        user_rating: int  # 1-5 scale
        actual_difficulty: str  # "too_easy", "just_right", "too_hard"
        time_taken: float
        was_correct: bool

    @app.post("/api/analytics/record")
    async def record_analytics_event(event: AnalyticsEvent):
        """Records a player analytics event"""
        try:
            success = analytics_manager.record_event(
                event.player_id,
                event.event_type,
                event.event_data,
                event.timestamp or time.time()
            )
            if not success:
                raise HTTPException(status_code=400, detail="Failed to record analytics event")
            return {"status": "success"}
        except Exception as e:
            if error_tracker:
                error_tracker.capture_exception(e)
            raise HTTPException(status_code=500, detail="Internal server error")

    @app.get("/api/analytics/player/{player_id}")
    async def get_player_analytics(player_id: str):
        """Retrieves analytics data for a specific player"""
        try:
            data = analytics_manager.get_player_analytics(player_id)
            if not data:
                raise HTTPException(status_code=404, detail="Player analytics not found")
            return data
        except Exception as e:
            if error_tracker:
                error_tracker.capture_exception(e)
            raise HTTPException(status_code=500, detail="Internal server error")

    @app.get("/api/analytics/overall")
    async def get_overall_analytics():
        """Retrieves overall aggregated analytics data"""
        try:
            data = analytics_manager.get_overall_analytics()
            return JSONResponse(content=data)
        except Exception as e:
            if error_tracker:
                error_tracker.capture_exception(e)
            raise HTTPException(status_code=500, detail="Internal server error")

    if feedback_database:
        @app.post("/api/question/feedback")
        async def submit_question_feedback(feedback: QuestionFeedbackRequest):
            """Submit user feedback on question difficulty"""
            try:
                success = feedback_database.record_feedback(
                    feedback.question_id,
                    feedback.user_rating,
                    feedback.actual_difficulty,
                    feedback.time_taken,
                    feedback.was_correct
                )
                if not success:
                    raise HTTPException(status_code=400, detail="Failed to record feedback")
                return {"status": "success", "message": "Feedback recorded"}
            except Exception as e:
                if error_tracker:
                    error_tracker.capture_exception(e)
                raise HTTPException(status_code=500, detail="Internal server error")


def register_elo_routes():
    """Register ELO rating system routes"""
    if not elo_system:
        return

    # Pydantic models for ELO system
    class PlayerRegistration(BaseModel):
        player_name: str

    class MatchCreation(BaseModel):
        player1_name: str
        player2_name: str
        match_type: str = "survival"

    class MatchResult(BaseModel):
        session_id: str
        winner: Optional[str] = None  # None for draw
        player1_score: int = 0
        player2_score: int = 0

    rate_limit_dependency = get_rate_limit_dependency() if config.enable_rate_limiting else lambda: True

    @app.post("/api/elo/register")
    async def register_player(request: PlayerRegistration, rate_limit: bool = Depends(rate_limit_dependency)):
        """Register a new player or get existing player information"""
        try:
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
            if error_tracker:
                error_tracker.capture_exception(e)
            raise HTTPException(status_code=500, detail="Internal server error")

    @app.get("/api/elo/player/{player_name}")
    async def get_player_stats(player_name: str, rate_limit: bool = Depends(rate_limit_dependency)):
        """Get comprehensive player statistics"""
        try:
            player_stats = elo_system.get_player_stats(player_name)
            if not player_stats:
                raise HTTPException(status_code=404, detail="Player not found")

            rank = elo_system.get_player_rank(player_name)
            match_history = elo_system.get_match_history(player_name, 5)

            return {
                "player_stats": player_stats,
                "rank": rank,
                "recent_matches": match_history
            }
        except HTTPException:
            raise
        except Exception as e:
            if error_tracker:
                error_tracker.capture_exception(e)
            raise HTTPException(status_code=500, detail="Internal server error")

    @app.get("/api/elo/leaderboard")
    async def get_leaderboard(limit: int = Query(10, ge=1, le=50), rate_limit: bool = Depends(rate_limit_dependency)):
        """Get current leaderboard"""
        try:
            leaderboard = elo_system.get_leaderboard(limit)
            return {
                "leaderboard": leaderboard,
                "total_players": elo_system.get_total_players()
            }
        except Exception as e:
            if error_tracker:
                error_tracker.capture_exception(e)
            raise HTTPException(status_code=500, detail="Internal server error")

    if match_manager:
        @app.post("/api/elo/match/create")
        async def create_competitive_match(request: MatchCreation, rate_limit: bool = Depends(rate_limit_dependency)):
            """Create a new competitive match"""
            try:
                session_id = match_manager.create_match(
                    request.player1_name,
                    request.player2_name,
                    request.match_type
                )
                if not session_id:
                    raise HTTPException(status_code=400, detail="Failed to create match")

                return {
                    "success": True,
                    "session_id": session_id,
                    "match_type": request.match_type
                }
            except HTTPException:
                raise
            except Exception as e:
                if error_tracker:
                    error_tracker.capture_exception(e)
                raise HTTPException(status_code=500, detail="Internal server error")

        @app.post("/api/elo/match/finish")
        async def finish_competitive_match(request: MatchResult, rate_limit: bool = Depends(rate_limit_dependency)):
            """Finish a competitive match and calculate Elo changes"""
            try:
                result = match_manager.finish_match(
                    request.session_id,
                    request.winner,
                    request.player1_score,
                    request.player2_score
                )
                if not result:
                    raise HTTPException(status_code=400, detail="Failed to finish match")

                return result
            except HTTPException:
                raise
            except Exception as e:
                if error_tracker:
                    error_tracker.capture_exception(e)
                raise HTTPException(status_code=500, detail="Internal server error")


def register_survival_routes():
    """Register survival mode routes"""
    if not survival_handler:
        return

    class SurvivalAnswerRequest(BaseModel):
        answer: str
        initials: str

    rate_limit_dependency = get_rate_limit_dependency() if config.enable_rate_limiting else lambda: True

    @app.get("/survival/round")
    async def get_survival_round():
        """Get a new survival mode round with initials and possible answers"""
        if monitor:
            monitor.track_usage("survival_round_request", "new_round")

        try:
            if not survival_handler.is_loaded():
                raise HTTPException(status_code=503, detail="Survival mode dataset is still loading")

            round_data = survival_handler.get_sample_round()
            if not round_data:
                raise HTTPException(status_code=500, detail="Failed to generate survival round")

            return {
                "initials": round_data['initials_formatted'],
                "possible_answers_count": round_data['possible_answers_count'],
                "sample_answers": round_data.get('sample_answers', [])[:3]  # Show 3 examples
            }
        except HTTPException:
            raise
        except Exception as e:
            if error_tracker:
                error_tracker.capture_exception(e)
            raise HTTPException(status_code=500, detail="Failed to generate survival round")

    @app.post("/survival/validate")
    async def validate_survival_answer(
        answer: str = Query(..., description="Player name to validate"),
        initials: str = Query(..., description="Target initials (e.g., 'LM')"),
        max_mistakes: int = Query(2, ge=0, le=3, description="Maximum spelling mistakes allowed")
    ):
        """Validate a survival mode answer"""
        if monitor:
            monitor.track_usage("survival_validate", f"{initials}_{len(answer)}")

        try:
            is_valid, matched_player = survival_handler.validate_answer(answer, initials, max_mistakes)

            return {
                "valid": is_valid,
                "submitted_answer": answer,
                "target_initials": initials,
                "matched_player": matched_player,
                "max_mistakes_allowed": max_mistakes
            }
        except Exception as e:
            if error_tracker:
                error_tracker.capture_exception(e)
            raise HTTPException(status_code=500, detail="Failed to validate answer")

    @app.get("/api/survival/loading-status")
    async def get_survival_loading_status():
        """Gets the loading status of the survival mode dataset"""
        return survival_handler.get_loading_status()


def register_admin_routes():
    """Register admin dashboard and monitoring routes"""
    if not config.enable_admin_dashboard:
        return

    @app.get("/admin/dashboard", response_class=FileResponse)
    async def get_admin_dashboard():
        """Serves the admin monitoring dashboard"""
        dashboard_path = Path(__file__).parent / "admin_dashboard.html"
        if not dashboard_path.is_file():
            raise HTTPException(status_code=404, detail="Admin dashboard not found")
        return FileResponse(dashboard_path, headers={"Cache-Control": "no-cache, no-store, must-revalidate"})

    if monitor:
        @app.get("/api/monitoring/metrics")
        async def get_monitoring_metrics():
            """Admin endpoint to get current system metrics"""
            return JSONResponse(content=monitor.get_metrics())

    if limiter:
        @app.get("/admin/rate-limit-stats")
        async def get_rate_limit_stats():
            """Admin endpoint to view rate limit statistics"""
            return limiter.get_stats()

    if cached_data_handler and hasattr(cached_data_handler, 'get_stats'):
        @app.get("/api/cache-stats")
        async def get_cache_stats():
            """Returns statistics about the cache"""
            return cached_data_handler.get_stats()

        @app.post("/api/cache-invalidate")
        async def invalidate_cache():
            """Invalidates the entire cache"""
            cached_data_handler.invalidate()
            return {"status": "success", "message": "Cache invalidated"}


def register_multi_sport_routes():
    """Register multi-sport specific routes"""
    if not sport_factory:
        return

    # Sport validation dependency
    async def validate_sport_parameter(sport: str = FastAPIPath(..., description="Sport name")):
        """Validate sport parameter and return sport manager"""
        try:
            sport_manager = sport_factory.create_sport_manager(sport)
            if not sport_manager:
                raise HTTPException(status_code=404, detail=f"Sport '{sport}' not supported")
            return sport_manager
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Invalid sport parameter: {str(e)}")

    @app.get("/api/sports")
    async def get_supported_sports():
        """Get list of supported sports with their configurations"""
        try:
            sports_configs = sport_factory.get_sport_configs()
            return {
                "supported_sports": list(sports_configs.keys()),
                "sports_configs": sports_configs
            }
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error getting sports: {str(e)}")

    @app.get("/api/{sport}/competitions")
    async def get_sport_competitions(sport_manager=Depends(validate_sport_parameter)):
        """Get available competitions for a specific sport"""
        try:
            competitions = sport_manager.get_available_competitions()
            return {
                "sport": sport_manager.get_sport_name(),
                "competitions": competitions
            }
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error getting competitions: {str(e)}")

    rate_limit_dependency = get_rate_limit_dependency() if config.enable_rate_limiting else lambda: True

    @app.get("/api/{sport}/quiz")
    async def generate_sport_quiz(
        sport_manager=Depends(validate_sport_parameter),
        difficulty: str = Query("casual", pattern="^(casual|diehard)$", description="Quiz difficulty"),
        num_questions: int = Query(config.default_quiz_questions, ge=5, le=config.max_questions_per_quiz),
        competition_id: Optional[str] = Query(None, description="Specific competition ID"),
        dependencies=[Depends(rate_limit_dependency)]
    ):
        """Generate a quiz for a specific sport"""
        try:
            sport_name = sport_manager.get_sport_name()
            if monitor:
                monitor.track_usage("quiz_request", f"{sport_name}_{difficulty}")

            quiz = sport_manager.generate_quiz(
                difficulty=difficulty,
                num_questions=num_questions,
                competition_id=competition_id
            )

            if not quiz:
                raise HTTPException(status_code=500, detail="Failed to generate quiz")

            return {
                "sport": sport_name,
                "difficulty": difficulty,
                "questions": quiz
            }
        except HTTPException:
            raise
        except Exception as e:
            if error_tracker:
                error_tracker.capture_exception(e)
            raise HTTPException(status_code=500, detail=f"Error generating quiz: {str(e)}")

    @app.get("/api/stats")
    async def get_platform_stats():
        """Get platform-wide statistics"""
        try:
            sports_configs = sport_factory.get_sport_configs()

            stats = {
                "supported_sports": len(sports_configs),
                "sports": {}
            }

            for sport_name in sports_configs:
                try:
                    manager = sport_factory.create_sport_manager(sport_name)
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
            raise HTTPException(status_code=500, detail=f"Error getting platform stats: {str(e)}")


# Helper function for rate limiting
def get_rate_limit_dependency():
    """Get rate limiting dependency based on configuration"""
    if config.enable_rate_limiting and limiter:
        async def rate_limit_dependency(request: Request):
            client_ip = request.client.host if request.client else "unknown"
            endpoint = request.url.path

            allowed, message = limiter.is_allowed(client_ip, endpoint)
            if not allowed:
                raise HTTPException(status_code=429, detail=message)

            limiter.add_request(client_ip)
            return True
        return rate_limit_dependency
    else:
        async def no_rate_limit():
            return True
        return no_rate_limit


# ================================
# MAIN APPLICATION ENTRY POINT
# ================================

def main():
    """Main entry point for the unified server"""
    print("🚀 Starting VerveQ Unified Server...")
    print("=" * 60)

    # Create the application
    create_app()

    # Print configuration summary
    print(f"\n📋 Server Configuration:")
    print(f"   Mode: {config.server_mode.value}")
    print(f"   Host: {config.host}")
    print(f"   Port: {config.port}")
    print(f"   Debug: {config.debug}")

    print(f"\n🎯 Enabled Features:")
    features = [
        ("Multi-sport", config.enable_multi_sport),
        ("Analytics", config.enable_analytics),
        ("Monitoring", config.enable_monitoring),
        ("ELO System", config.enable_elo_system),
        ("Survival Mode", config.enable_survival_mode),
        ("Admin Dashboard", config.enable_admin_dashboard),
        ("Rate Limiting", config.enable_rate_limiting),
        ("Caching", config.enable_caching),
        ("Legacy Endpoints", config.enable_legacy_endpoints)
    ]

    for feature_name, enabled in features:
        status = "✅" if enabled else "❌"
        print(f"   {status} {feature_name}")

    print(f"\n🌐 Server URLs:")
    print(f"   Main: http://{config.host}:{config.port}")
    print(f"   Health: http://{config.host}:{config.port}/health")
    print(f"   API Docs: http://{config.host}:{config.port}/docs")

    if config.enable_admin_dashboard:
        print(f"   Admin: http://{config.host}:{config.port}/admin/dashboard")

    print(f"\n🛑 Press Ctrl+C to stop the server\n")

    try:
        uvicorn.run(
            app,
            host=config.host,
            port=config.port,
            log_level=config.log_level.lower(),
            reload=config.debug
        )
    except KeyboardInterrupt:
        print("\n👋 Server stopped by user")
    except Exception as e:
        print(f"\n❌ Server error: {e}")
        if config.server_mode != ServerMode.MINIMAL:
            print("💡 Try running in minimal mode: VERVEQ_SERVER_MODE=minimal python unified_server.py")


# Create the app at module level for uvicorn compatibility
app = create_app()

if __name__ == "__main__":
    main()
