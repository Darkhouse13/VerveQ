"""
Profile routes for VerveQ Platform API
"""
from fastapi import APIRouter
from typing import Optional, Dict, List
from pydantic import BaseModel
from datetime import datetime

router = APIRouter(prefix="/profile", tags=["profile"])

class UserStats(BaseModel):
    total_games: int
    total_wins: int
    win_rate: float
    current_streak: int
    best_streak: int
    favorite_sport: Optional[str] = None
    favorite_game_mode: Optional[str] = None

class Achievement(BaseModel):
    id: str
    name: str
    description: str
    earned_at: datetime
    icon: Optional[str] = None

class UserProfile(BaseModel):
    user_id: str
    username: str
    display_name: Optional[str] = None
    avatar_url: Optional[str] = None
    elo_rating: int
    created_at: datetime
    last_active: datetime
    stats: UserStats
    achievements: List[Achievement]
    recent_games: List[Dict] = []

@router.get("/{user_id}")
async def get_user_profile(user_id: str) -> UserProfile:
    """Get user profile by user ID"""
    return UserProfile(
        user_id=user_id,
        username=f"user_{user_id}",
        elo_rating=1200,
        created_at=datetime.now(),
        last_active=datetime.now(),
        stats=UserStats(
            total_games=0,
            total_wins=0,
            win_rate=0.0,
            current_streak=0,
            best_streak=0
        ),
        achievements=[],
        recent_games=[]
    )