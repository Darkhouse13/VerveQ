from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import random
from typing import List
import os
import time
import json
from pydantic import BaseModel

# Use relative imports for package context, absolute for standalone
try:
    from .Data import JSONDataHandler
    from .QuizGenerator import QuizGenerator
except ImportError:
    from Data import JSONDataHandler
    from QuizGenerator import QuizGenerator

# --- Application Setup ---
app = FastAPI(
    title="FootQuizz API",
    description="API for Football Quiz and Survival Modes.",
    version="3.0.0",
)

# --- CORS Middleware ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins, crucial for local file testing
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Global Objects ---
try:
    # Smart path resolution - works from both project root and FootQuizz directory
    data_path = "data"
    if not os.path.exists(data_path) and os.path.exists("FootQuizz/data"):
        data_path = "FootQuizz/data"
    
    data_handler = JSONDataHandler(data_root=data_path)
    quiz_generator = QuizGenerator(data_handler)
    print("Successfully initialized Data Handler and Quiz Generator.")
except Exception as e:
    print(f"FATAL: Could not initialize data handlers. Error: {e}")
    data_handler = None
    quiz_generator = None

# --- Pydantic Models ---
class Feedback(BaseModel):
    question: str
    user_answer: str
    is_correct: bool
    difficulty: str
    timestamp: float

# --- API Endpoints ---

@app.post("/api/feedback", summary="Submit Quiz Feedback")
def submit_feedback(feedback: Feedback):
    """
    Receives feedback from the quiz and stores it.
    """
    feedback_file = "feedback.json"
    if not os.path.exists(feedback_file) and os.path.exists("FootQuizz/feedback.json"):
        feedback_file = "FootQuizz/feedback.json"

    try:
        with open(feedback_file, 'r+') as f:
            try:
                feedback_data = json.load(f)
            except json.JSONDecodeError:
                feedback_data = []
            feedback_data.append(feedback.dict())
            f.seek(0)
            json.dump(feedback_data, f, indent=4)
    except IOError as e:
        raise HTTPException(status_code=500, detail=f"Failed to write feedback: {e}")

    return {"message": "Feedback received successfully!"}

@app.get("/api/quiz", summary="Generate a Quiz")
def generate_quiz_endpoint(difficulty: str = Query("casual", enum=["casual", "die-hard"]), num_questions: int = 10) -> List[dict]:
    """
    Generates a quiz from a randomly selected competition.
    The difficulty parameter can be used in the future to tailor questions.
    """
    if not quiz_generator or not data_handler:
        raise HTTPException(status_code=500, detail="Server not initialized correctly.")

    # Get all valid competitions (awards and player stats)
    available_competitions = [
        comp for comp in data_handler.get_available_competitions() 
        if comp['data_type'] in ['award', 'stats']
    ]
    
    if not available_competitions:
        raise HTTPException(status_code=404, detail="No valid competitions available to generate a quiz.")

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

@app.get("/api/all_players", summary="Get All Player Names")
def get_all_players_endpoint() -> List[str]:
    """
    Provides a comprehensive list of all unique player names from all data sources.
    """
    if not data_handler:
        raise HTTPException(status_code=500, detail="Server not initialized correctly.")
        
    players = data_handler.get_all_players_across_competitions()
    
    if not players:
        raise HTTPException(status_code=404, detail="No players found in the database.")
        
    return players


@app.get("/")
def read_root():
    return {"message": "Welcome to the FootQuizz API. Go to /docs for details."}

# --- How to Run ---
# In your terminal, run from the project's root directory:
# uvicorn FootQuizz.main:app --reload --port 5000

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=5000, reload=True) 