from fastapi import FastAPI, HTTPException, Query, Depends, Request
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
from pathlib import Path
import os
from datetime import datetime
from pydantic import BaseModel

from monitoring import monitor
from error_tracking import error_tracker
from Data import JSONDataHandler, CacheManager
from QuizGenerator import QuizGenerator
from SurvivalDataHandler import SurvivalDataHandler
from rate_limiter import limiter
from analytics import AnalyticsManager # Import AnalyticsManager
from difficulty_feedback_database import DifficultyFeedbackDatabase
from enhanced_difficulty_calculator import EnhancedDifficultyCalculator

app = FastAPI()

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

# Add CORS middleware to allow requests from the HTML page
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify exact origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware("http")
async def monitoring_middleware(request: Request, call_next):
    """
    Middleware to record request metrics and handle exceptions.
    """
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
    """
    Generic exception handler to capture all unhandled exceptions.
    """
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

# Initialize components
data_handler = None
quiz_generator = None
survival_handler = None
cached_data_handler = None
analytics_manager = None # Declare analytics_manager

try:
    print("🔄 Initializing data handlers...")
    
    # Quiz mode: Curated dataset (award winners + squad stats)
    data_handler = JSONDataHandler()
    cached_data_handler = CacheManager(data_handler)
    quiz_generator = QuizGenerator(cached_data_handler)
    print("✅ Quiz mode handler initialized (curated dataset with caching)")
    
    # Survival mode: Full 30K+ dataset (with lazy loading)
    survival_handler = SurvivalDataHandler()
    print("✅ Survival mode handler initialized (lazy loading enabled)")

    # Analytics Manager
    analytics_manager = AnalyticsManager()
    print("✅ Analytics Manager initialized")
    
    # Difficulty Feedback Database
    feedback_database = DifficultyFeedbackDatabase()
    print("✅ Difficulty Feedback Database initialized")
    
    # Enhanced Difficulty Calculator
    enhanced_difficulty_calculator = EnhancedDifficultyCalculator(data_handler)
    print("✅ Enhanced Difficulty Calculator initialized")
        
except Exception as e:
    print(f"❌ Error initializing handlers: {e}")
    data_handler = None
    cached_data_handler = None
    quiz_generator = None
    survival_handler = None
    analytics_manager = None # Ensure analytics_manager is None on error

# Pydantic model for feedback data validation
class FeedbackItem(BaseModel):
    question_id: str
    is_correct: bool
    difficulty_level: Optional[str] = None

class AnalyticsEvent(BaseModel):
    player_id: str
    quiz_mode: str
    question_type: str
    question_id: str
    is_correct: int # 0 for false, 1 for true
    time_taken_ms: int
    attempt_number: int
    score_at_event: int
    total_questions_answered: int

class PrivacyPreference(BaseModel):
    player_id: str
    allow_analytics: bool

# Pydantic models for difficulty feedback API
class QuestionFeedbackRequest(BaseModel):
    question_id: str
    question_text: str
    answer: Optional[str] = None
    user_feedback: str  # 'too_easy', 'just_right', 'too_hard'
    original_difficulty: float
    difficulty_category: Optional[str] = None
    user_id: Optional[str] = None
    quiz_mode: Optional[str] = None
    user_performance_context: Optional[Dict[str, Any]] = None

class AdminDifficultyAdjustment(BaseModel):
    question_id: str
    old_difficulty: float
    new_difficulty: float
    new_category: Optional[str] = None
    admin_user: str
    reason: Optional[str] = None

class QuestionsReviewResponse(BaseModel):
    questions: List[Dict[str, Any]]
    total_count: int
    threshold_used: int

@app.post("/api/feedback")
async def receive_feedback(feedback: FeedbackItem):
    """Receives and stores user feedback on question difficulty in feedback.json."""
    feedback_path = Path(__file__).parent / 'feedback.json'
    
    # For a multi-user environment, file locking would be necessary here
    # to prevent race conditions. For bootstrapping, this is sufficient.
    all_feedback = []
    try:
        if feedback_path.exists() and os.path.getsize(feedback_path) > 0:
            with open(feedback_path, 'r', encoding='utf-8') as f:
                all_feedback = json.load(f)
        
        all_feedback.append(feedback.dict())
        
        with open(feedback_path, 'w', encoding='utf-8') as f:
            json.dump(all_feedback, f, indent=4)

    except Exception as e:
        print(f"File I/O error for feedback.json: {e}")
        raise HTTPException(status_code=500, detail="Failed to log feedback.")
            
    return {"status": "success", "message": "Feedback received"}

@app.post("/api/analytics/record")
async def record_analytics_event(event: AnalyticsEvent):
    """Records a player analytics event."""
    if not analytics_manager:
        raise HTTPException(status_code=500, detail="Analytics Manager not initialized.")
    
    if analytics_manager.record_event(event.dict()):
        return {"status": "success", "message": "Analytics event recorded."}
    else:
        raise HTTPException(status_code=400, detail="Failed to record analytics event.")

@app.get("/api/analytics/player/{player_id}")
async def get_player_analytics(player_id: str):
    """Retrieves analytics data for a specific player."""
    if not analytics_manager:
        raise HTTPException(status_code=500, detail="Analytics Manager not initialized.")
    
    data = analytics_manager.get_player_analytics(player_id)
    if data:
        return JSONResponse(content=data)
    else:
        raise HTTPException(status_code=404, detail="Player analytics not found.")

@app.get("/api/analytics/overall")
async def get_overall_analytics():
    """Retrieves overall aggregated analytics data."""
    if not analytics_manager:
        raise HTTPException(status_code=500, detail="Analytics Manager not initialized.")
    
    data = analytics_manager.get_overall_analytics()
    return JSONResponse(content=data)

@app.post("/api/privacy/set_preference")
async def set_privacy_preference(preference: PrivacyPreference):
    """Sets a player's privacy preference for data collection."""
    # In a real application, this would save the preference to a user profile in a database.
    # For now, we'll just log it.
    print(f"Privacy preference for player {preference.player_id}: Allow analytics = {preference.allow_analytics}")
    return {"status": "success", "message": "Privacy preference updated."}

# --- DIFFICULTY FEEDBACK API ENDPOINTS ---

@app.post("/api/question/feedback")
async def submit_question_feedback(feedback: QuestionFeedbackRequest):
    """Submit user feedback on question difficulty"""
    if not feedback_database:
        raise HTTPException(status_code=500, detail="Feedback database not initialized")
    
    try:
        # Convert Pydantic model to dict for database
        feedback_data = {
            'question_id': feedback.question_id,
            'question_text': feedback.question_text,
            'answer': feedback.answer,
            'user_feedback': feedback.user_feedback,
            'original_difficulty': feedback.original_difficulty,
            'difficulty_category': feedback.difficulty_category,
            'user_id': feedback.user_id or f'user_{hash(str(feedback.question_id))}'[:8],
            'quiz_mode': feedback.quiz_mode,
            'user_performance_context': feedback.user_performance_context or {},
            'timestamp': datetime.now().isoformat()
        }
        
        success = feedback_database.submit_user_feedback(feedback_data)
        
        if success:
            return {"status": "success", "message": "Feedback received and stored"}
        else:
            raise HTTPException(status_code=500, detail="Failed to store feedback")
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing feedback: {str(e)}")

@app.put("/api/admin/question/difficulty")
async def update_question_difficulty(adjustment: AdminDifficultyAdjustment):
    """Admin endpoint to adjust question difficulty"""
    if not feedback_database:
        raise HTTPException(status_code=500, detail="Feedback database not initialized")
    
    try:
        # Convert Pydantic model to dict for database
        adjustment_data = {
            'question_id': adjustment.question_id,
            'old_difficulty': adjustment.old_difficulty,
            'new_difficulty': adjustment.new_difficulty,
            'new_category': adjustment.new_category,
            'admin_user': adjustment.admin_user,
            'reason': adjustment.reason
        }
        
        success = feedback_database.submit_admin_adjustment(adjustment_data)
        
        if success:
            return {"status": "success", "message": "Difficulty adjustment applied"}
        else:
            raise HTTPException(status_code=500, detail="Failed to apply adjustment")
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error applying adjustment: {str(e)}")

@app.get("/api/questions/review")
async def get_questions_for_review(threshold: int = Query(5, ge=3, le=20, description="Minimum feedback count for review")):
    """Get questions that need difficulty review based on user feedback"""
    if not feedback_database:
        raise HTTPException(status_code=500, detail="Feedback database not initialized")
    
    try:
        questions = feedback_database.get_questions_needing_review(threshold)
        
        return {
            "questions": questions,
            "total_count": len(questions),
            "threshold_used": threshold,
            "message": f"Found {len(questions)} questions needing review"
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving questions for review: {str(e)}")

@app.get("/api/question/{question_id}/feedback")
async def get_question_feedback_summary(question_id: str):
    """Get feedback summary for a specific question"""
    if not feedback_database:
        raise HTTPException(status_code=500, detail="Feedback database not initialized")
    
    try:
        summary = feedback_database.get_feedback_summary(question_id)
        
        if not summary:
            raise HTTPException(status_code=404, detail="No feedback found for this question")
            
        # Calculate adjusted difficulty if enough feedback exists
        adjusted_difficulty = feedback_database.calculate_adjusted_difficulty(question_id)
        if adjusted_difficulty is not None:
            summary['adjusted_difficulty'] = adjusted_difficulty
            summary['has_sufficient_feedback'] = True
        else:
            summary['has_sufficient_feedback'] = False
            
        return summary
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving feedback summary: {str(e)}")

@app.get("/quiz", dependencies=[Depends(rate_limit_dependency)])
async def generate_difficulty_based_quiz(
    difficulty: str = Query(..., pattern="^(casual|diehard)$", description="Quiz difficulty: 'casual' or 'diehard'"),
    num_questions: int = Query(10, ge=5, le=20, description="Number of questions (5-20)")
):
    """Generate a quiz based on difficulty level with random competition selection"""
    monitor.track_usage("quiz_request", difficulty)
    print(f"\nReceived quiz request for difficulty: {difficulty}")
    try:
        if not cached_data_handler or not quiz_generator:
            raise HTTPException(status_code=500, detail="Server components not initialized properly")

        competitions = cached_data_handler.get_available_competitions()
        if not competitions:
            raise HTTPException(status_code=404, detail="No competitions available")

        # --- Enhanced: Use more competitions for better question variety ---
        # For casual mode, use more competitions to ensure enough easy questions
        # For diehard mode, use fewer but more challenging competitions
        if difficulty == 'casual':
            num_to_sample = min(len(competitions), 5)  # Use more competitions for casual
        else:
            num_to_sample = min(len(competitions), 3)  # Keep original for diehard
            
        sampled_competitions = random.sample(competitions, num_to_sample)
        print(f"Sampling {len(sampled_competitions)} competitions for {difficulty} mode...")
        # ----------------------------------------------------------------

        all_questions = []
        for comp in sampled_competitions: # Iterate over the smaller, sampled list
            print(f" -> Generating questions from: {comp['competition_name']}")
            # Generate more questions than needed to ensure variety
            comp_questions = quiz_generator.generate_quiz(comp['competition_id'], num_questions * 2)
            all_questions.extend(comp_questions)
            print(f"    Generated {len(comp_questions)} questions from {comp['competition_name']}")

        if not all_questions:
            # Enhanced fallback with multiple questions for both difficulty levels
            print("Warning: No questions were generated from the sampled competitions. Using enhanced fallback.")
            fallback_questions = generate_fallback_questions(difficulty, num_questions)
            return {
                "difficulty": difficulty,
                "total_questions": len(fallback_questions),
                "quiz": fallback_questions
            }

        print(f"Generated a pool of {len(all_questions)} questions. Filtering for difficulty...")
        filtered_questions = filter_questions_by_difficulty(all_questions, difficulty)
        
        if len(filtered_questions) < num_questions:
            # If not enough questions after filtering, supplement with other questions
            other_questions = [q for q in all_questions if q not in filtered_questions]
            filtered_questions.extend(other_questions)

        if len(filtered_questions) < num_questions:
             raise HTTPException(status_code=404, detail=f"Could not generate enough questions for the quiz. Only found {len(filtered_questions)}.")

        random.shuffle(filtered_questions)
        final_questions = filtered_questions[:num_questions]
        print(f"Successfully generated {len(final_questions)} questions for the quiz.")

        return {
            "difficulty": difficulty,
            "total_questions": len(final_questions),
            "quiz": final_questions
        }

    except HTTPException:
        raise
    # The generic exception handler will now catch other exceptions.

def generate_fallback_questions(difficulty: str, num_questions: int) -> List[Dict[str, Any]]:
    """Generate fallback questions when normal generation fails"""
    
    casual_questions = [
        {
            "type": "fallback",
            "question": "Who is the all-time top scorer of the FIFA World Cup?",
            "options": ["Ronaldo", "Pele", "Miroslav Klose", "Gerd Muller"],
            "answer": "Miroslav Klose",
            "difficulty_level": "easy",
            "difficulty_score": 0.2
        },
        {
            "type": "fallback",
            "question": "Which country has won the most FIFA World Cups?",
            "options": ["Germany", "Argentina", "Brazil", "Italy"],
            "answer": "Brazil",
            "difficulty_level": "easy",
            "difficulty_score": 0.1
        },
        {
            "type": "fallback",
            "question": "What position does a goalkeeper play?",
            "options": ["Forward", "Midfielder", "Defender", "Goalkeeper"],
            "answer": "Goalkeeper",
            "difficulty_level": "easy",
            "difficulty_score": 0.05
        },
        {
            "type": "fallback",
            "question": "Which club is known as 'The Red Devils'?",
            "options": ["Liverpool", "Arsenal", "Manchester United", "Chelsea"],
            "answer": "Manchester United",
            "difficulty_level": "easy",
            "difficulty_score": 0.3
        },
        {
            "type": "fallback",
            "question": "In which country is the Premier League played?",
            "options": ["Spain", "England", "Germany", "Italy"],
            "answer": "England",
            "difficulty_level": "easy",
            "difficulty_score": 0.1
        },
        {
            "type": "fallback",
            "question": "How many players are on a football team during a match?",
            "options": ["10", "11", "12", "9"],
            "answer": "11",
            "difficulty_level": "easy",
            "difficulty_score": 0.05
        },
        {
            "type": "fallback",
            "question": "Which player is famous for wearing number 10 for Argentina?",
            "options": ["Cristiano Ronaldo", "Neymar", "Lionel Messi", "Kylian Mbappé"],
            "answer": "Lionel Messi",
            "difficulty_level": "easy",
            "difficulty_score": 0.2
        },
        {
            "type": "fallback",
            "question": "What is the maximum duration of a football match?",
            "options": ["80 minutes", "90 minutes", "100 minutes", "120 minutes"],
            "answer": "90 minutes",
            "difficulty_level": "easy",
            "difficulty_score": 0.15
        }
    ]
    
    diehard_questions = [
        {
            "type": "fallback",
            "question": "Who won the first ever Ballon d'Or in 1956?",
            "options": ["Stanley Matthews", "Alfredo Di Stefano", "Ferenc Puskas", "Raymond Kopa"],
            "answer": "Stanley Matthews",
            "difficulty_level": "hard",
            "difficulty_score": 0.9
        },
        {
            "type": "fallback",
            "question": "Which player scored the fastest hat-trick in Premier League history?",
            "options": ["Alan Shearer", "Sadio Mané", "Robbie Fowler", "Jermain Defoe"],
            "answer": "Sadio Mané",
            "difficulty_level": "hard",
            "difficulty_score": 0.85
        },
        {
            "type": "fallback",
            "question": "In which year did the European Cup become the Champions League?",
            "options": ["1990", "1992", "1994", "1996"],
            "answer": "1992",
            "difficulty_level": "hard",
            "difficulty_score": 0.8
        },
        {
            "type": "fallback",
            "question": "Who is the youngest player to score in a World Cup final?",
            "options": ["Pelé", "Kylian Mbappé", "Michael Owen", "Ronaldo"],
            "answer": "Pelé",
            "difficulty_level": "hard",
            "difficulty_score": 0.75
        },
        {
            "type": "fallback",
            "question": "Which goalkeeper has the most clean sheets in Premier League history?",
            "options": ["David Seaman", "Petr Čech", "Edwin van der Sar", "Joe Hart"],
            "answer": "Petr Čech",
            "difficulty_level": "hard",
            "difficulty_score": 0.8
        },
        {
            "type": "fallback",
            "question": "What was the original name of Manchester City?",
            "options": ["Ardwick FC", "West Gorton", "St. Mark's", "All of the above"],
            "answer": "All of the above",
            "difficulty_level": "hard",
            "difficulty_score": 0.95
        },
        {
            "type": "fallback",
            "question": "Who scored the 'Hand of God' goal in the 1986 World Cup?",
            "options": ["Pelé", "Diego Maradona", "Gary Lineker", "Michel Platini"],
            "answer": "Diego Maradona",
            "difficulty_level": "hard",
            "difficulty_score": 0.6
        },
        {
            "type": "fallback",
            "question": "Which team won the first Premier League title in 1992-93?",
            "options": ["Arsenal", "Liverpool", "Manchester United", "Blackburn Rovers"],
            "answer": "Manchester United",
            "difficulty_level": "hard",
            "difficulty_score": 0.7
        }
    ]
    
    # Select appropriate question pool based on difficulty
    question_pool = casual_questions if difficulty == 'casual' else diehard_questions
    
    # Ensure we don't exceed available questions
    num_to_return = min(num_questions, len(question_pool))
    
    # Shuffle and return the requested number of questions
    selected_questions = random.sample(question_pool, num_to_return)
    
    # Add required fields for compatibility
    for i, question in enumerate(selected_questions):
        question.update({
            "question_id": f"fallback_{difficulty}_{i}",
            "question_version": "1.0",
            "distractors": [opt for opt in question["options"] if opt != question["answer"]]
        })
    
    return selected_questions

def filter_questions_by_difficulty(questions: List[Dict[str, Any]], difficulty: str) -> List[Dict[str, Any]]:
    """Filter and prioritize questions based on difficulty level"""
    if difficulty == 'casual':
        # Casual mode: prefer easier question types and well-known subjects
        easy_types = ['award_nationality', 'award_position', 'stat_team', 'stat_leader']
        medium_types = ['award_winner', 'award_team', 'who_am_i']
        
        # Prioritize easy questions, then medium
        easy_questions = [q for q in questions if q.get('type') in easy_types]
        medium_questions = [q for q in questions if q.get('type') in medium_types]
        hard_questions = [q for q in questions if q.get('type') not in easy_types + medium_types]
        
        # Return in order of preference for casual mode
        return easy_questions + medium_questions + hard_questions
        
    else:  # diehard mode
        # Die hard mode: prefer harder question types and obscure facts
        hard_types = ['award_season', 'award_age', 'stat_value', 'stat_comparison', 'who_am_i']
        medium_types = ['award_winner', 'award_team', 'stat_leader']
        
        # Prioritize hard questions, then medium, then easy
        hard_questions = [q for q in questions if q.get('type') in hard_types]
        medium_questions = [q for q in questions if q.get('type') in medium_types]
        easy_questions = [q for q in questions if q.get('type') not in hard_types + medium_types]
        
        # Return in order of preference for die hard mode
        return hard_questions + medium_questions + easy_questions

@app.get("/admin/rate-limit-stats")
async def get_rate_limit_stats():
    """Admin endpoint to view rate limit statistics."""
    return limiter.get_stats()

@app.get("/admin/dashboard", response_class=FileResponse)
async def get_admin_dashboard():
    """Serves the admin monitoring dashboard."""
    dashboard_path = Path(__file__).parent / "admin_dashboard.html"
    if not dashboard_path.is_file():
        raise HTTPException(status_code=404, detail="Admin dashboard not found.")
    return FileResponse(dashboard_path, headers={"Cache-Control": "no-cache, no-store, must-revalidate"})

@app.get("/api/monitoring/metrics")
async def get_monitoring_metrics():
    """Admin endpoint to get current system metrics."""
    return JSONResponse(content=monitor.get_metrics())

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    if not cached_data_handler:
        return {
            "status": "error", 
            "message": "Data handler not initialized"
        }
    
    try:
        competitions = cached_data_handler.get_available_competitions()
        return {
            "status": "healthy", 
            "message": "FootQuizz API is running",
            "available_competitions": len(competitions),
            "award_competitions": len([c for c in competitions if c['data_type'] == 'award']),
            "stats_competitions": len([c for c in competitions if c['data_type'] == 'stats'])
        }
    except Exception as e:
        return {
            "status": "error",
            "message": f"Health check failed: {str(e)}"
        }

@app.get("/competitions")
async def get_competitions():
    """Get available competitions (kept for backwards compatibility)"""
    try:
        if not cached_data_handler:
            raise HTTPException(status_code=500, detail="Data handler not initialized")
        
        competitions = cached_data_handler.get_available_competitions()
        return competitions
    except Exception as e:
        # Generic handler will catch this
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/players")
async def get_all_players(scope: str = Query("curated", regex="^(curated|full)$", description="Dataset scope: 'curated' (award winners) or 'full' (30K+ players)")):
    """Get player names with scope selection for different game modes"""
    try:
        if scope == "full":
            # Use full 30K+ dataset for survival mode
            if not survival_handler:
                 raise HTTPException(status_code=503, detail="Full dataset not available.")
            
            # This will now wait for the data to be loaded
            players = survival_handler.get_all_players()
            if not survival_handler.is_loaded():
                raise HTTPException(status_code=503, detail="Full dataset is still loading or failed to load.")
            
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
            # Use curated dataset for quiz mode
            if not cached_data_handler:
                raise HTTPException(status_code=500, detail="Curated data handler not initialized")
            
            players = cached_data_handler.get_all_players_across_competitions()
            return {
                "scope": "curated", 
                "total_players": len(players),
                "players": players,
                "dataset_info": "Curated dataset with award winners and top players"
            }
            
    except HTTPException:
        raise  # Re-raise HTTP exceptions
    # Generic handler will catch other exceptions

@app.get("/api/cache-stats")
async def get_cache_stats():
    """Returns statistics about the cache."""
    if not cached_data_handler:
        raise HTTPException(status_code=500, detail="Cache not initialized")
    return cached_data_handler.get_stats()

@app.post("/api/cache-invalidate")
async def invalidate_cache():
    """Invalidates the entire cache."""
    if not cached_data_handler:
        raise HTTPException(status_code=500, detail="Cache not initialized")
    cached_data_handler.invalidate()
    return {"status": "success", "message": "Cache invalidated"}

@app.get("/api/survival/loading-status")
async def get_survival_loading_status():
    """Gets the loading status of the survival mode dataset."""
    if not survival_handler:
        raise HTTPException(status_code=503, detail="Survival mode handler not available.")
    # This will trigger the load if it hasn't started
    survival_handler.ensure_loaded()
    return survival_handler.get_loading_status()

@app.get("/survival/round")
async def get_survival_round():
    """Get a new survival mode round with initials and possible answers"""
    monitor.track_usage("survival_round_request", "new_round")
    try:
        if not survival_handler:
            raise HTTPException(status_code=503, detail="Survival mode not available.")
        
        # This will now wait for the data to be loaded
        round_data = survival_handler.get_sample_round()
        if not survival_handler.is_loaded() or not round_data:
            raise HTTPException(status_code=503, detail="Survival mode data is loading or failed to load.")
        
        round_data = survival_handler.get_sample_round()
        if not round_data:
            raise HTTPException(status_code=500, detail="Could not generate survival round")
        
        return {
            "initials": round_data["initials"],
            "initials_formatted": round_data["initials_formatted"],
            "possible_answers_count": round_data["possible_answers_count"],
            "round_id": f"{round_data['initials']}_{hash(str(round_data['all_answers']))}"
        }
        
    except HTTPException:
        raise
    # Generic handler will catch other exceptions

@app.post("/survival/validate")
async def validate_survival_answer(
    answer: str = Query(..., description="Player name to validate"),
    initials: str = Query(..., description="Target initials (e.g., 'LM')"),
    max_mistakes: int = Query(2, ge=0, le=3, description="Maximum spelling mistakes allowed")
):
    """Validate a survival mode answer"""
    try:
        if not survival_handler:
            raise HTTPException(status_code=503, detail="Survival mode not available")
        
        # This will now wait for the data to be loaded
        is_valid, matched_player = survival_handler.validate_answer(answer, initials, max_mistakes)
        if not survival_handler.is_loaded():
            raise HTTPException(status_code=503, detail="Survival mode data is loading or failed to load.")
        
        is_valid, matched_player = survival_handler.validate_answer(answer, initials, max_mistakes)
        
        return {
            "valid": is_valid,
            "matched_player": matched_player,
            "submitted_answer": answer,
            "target_initials": initials
        }
        
    except HTTPException:
        raise
    # Generic handler will catch other exceptions

# Custom StaticFiles class to add no-cache headers
class NoCacheStaticFiles(StaticFiles):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

    async def get_response(self, path: str, scope):
        response = await super().get_response(path, scope)
        # Add comprehensive no-cache headers
        response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate, max-age=0"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"
        response.headers["Last-Modified"] = time.strftime('%a, %d %b %Y %H:%M:%S GMT', time.gmtime())
        response.headers["ETag"] = f'"{hash(str(time.time()))}"'
        return response

# Mount the root directory to serve HTML files directly
app.mount("/", NoCacheStaticFiles(directory=Path(__file__).parent, html=True), name="root_static")

# Mount the static directory to serve static files (CSS, JS, etc.)
# This should come after all other API routes to avoid conflicts.
app.mount("/static", NoCacheStaticFiles(directory=Path(__file__).parent / "static"), name="static")

if __name__ == "__main__":
    print("🚀 Starting FootQuizz FastAPI Server...")
    print("=" * 50)
    
    # Verify initialization
    if not cached_data_handler:
        print("❌ FATAL: Data handler failed to initialize!")
        print("💡 Check your data directory and JSON files")
        input("Press Enter to exit...")
        exit(1)
    
    try:
        competitions = cached_data_handler.get_available_competitions()
        award_comps = [c for c in competitions if c['data_type'] == 'award']
        stats_comps = [c for c in competitions if c['data_type'] == 'stats']
        curated_players = cached_data_handler.get_all_players_across_competitions()
        
        print("✅ Server initialization successful!")
        print(f"\n📊 Available Data:")
        print(f"   🏅 Award Competitions: {len(award_comps)}")
        for comp in award_comps[:3]:  # Show first 3
            print(f"      - {comp['competition_name']} ({comp['total_records']} records)")
        if len(award_comps) > 3:
            print(f"      ... and {len(award_comps) - 3} more")
            
        print(f"   📈 Statistics Competitions: {len(stats_comps)}")
        for comp in stats_comps[:3]:  # Show first 3
            print(f"      - {comp['competition_name']} ({comp['total_records']} records)")
        if len(stats_comps) > 3:
            print(f"      ... and {len(stats_comps) - 3} more")
            
        print(f"   👥 Curated Dataset: {len(curated_players)} unique players")
        
        # Show survival mode dataset info
        if survival_handler:
            # The stats will be fetched on demand by the lazy loader
            print(f"   🎮 Full Dataset: Enabled (lazy loading)")
        else:
            print(f"   ⚠️  Full Dataset: Not available")
        
        print(f"\n🎯 Available Game Modes:")
        print(f"   🟢 Casual Quiz: Easier questions, well-known players")
        print(f"   🔥 Die Hard Quiz: Challenging questions, obscure facts")
        print(f"   ⚡ Survival Mode: Two-player battle with the full dataset")
        
        print(f"\n🌐 Server starting at: http://127.0.0.1:8008")
        print(f"🔍 Health check: http://127.0.0.1:8008/health")
        print(f"📚 API docs: http://127.0.0.1:8008/docs")
        print(f"🛑 Press Ctrl+C to stop the server\n")
            
    except Exception as e:
        print(f"❌ Error during server startup: {e}")
        print("💡 Check TROUBLESHOOTING.md for help")
        input("Press Enter to exit...")
        exit(1)
    
    try:
        uvicorn.run(app, host="127.0.0.1", port=8008, log_level="info")
    except KeyboardInterrupt:
        print("\n👋 Server stopped by user")
    except Exception as e:
        print(f"\n❌ Server error: {e}")
        print("💡 Try running the minimal server instead: python minimal_server.py")
        input("Press Enter to exit...")
