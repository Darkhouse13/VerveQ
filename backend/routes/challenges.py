"""
Challenges routes for VerveQ Platform API
"""
from fastapi import APIRouter
from typing import List, Optional, Dict, Any, Literal
from pydantic import BaseModel, Field
from datetime import datetime
from enum import Enum

router = APIRouter(prefix="/challenges", tags=["challenges"])

# Allowed sports and game modes for challenges
ALLOWED_SPORTS = Literal["football", "tennis", "basketball", "quiz"]
ALLOWED_GAME_MODES = Literal["quiz", "survival", "time_attack"]

class ChallengeStatus(str, Enum):
    PENDING = "pending"
    ACTIVE = "active"
    COMPLETED = "completed"
    EXPIRED = "expired"
    CANCELLED = "cancelled"

class ChallengeType(str, Enum):
    HEAD_TO_HEAD = "head_to_head"
    TOURNAMENT = "tournament"
    TIME_TRIAL = "time_trial"
    ACHIEVEMENT = "achievement"

class Challenge(BaseModel):
    challenge_id: str = Field(..., min_length=1, max_length=50, description="Unique challenge identifier")
    type: ChallengeType
    status: ChallengeStatus
    title: str = Field(..., min_length=5, max_length=100, description="Challenge title")
    description: str = Field(..., min_length=10, max_length=500, description="Challenge description")
    sport: ALLOWED_SPORTS
    game_mode: ALLOWED_GAME_MODES
    created_by: str = Field(..., min_length=1, max_length=50, description="Creator's user ID")
    created_at: datetime
    starts_at: datetime
    ends_at: datetime
    participants: List[str] = Field(..., min_length=1, max_length=100)
    max_participants: Optional[int] = Field(None, ge=2, le=1000, description="Maximum number of participants")
    rewards: Dict[str, int] = {}
    rules: Dict[str, Any] = {}

class PendingChallengesResponse(BaseModel):
    total: int
    challenges: List[Challenge]

@router.get("/pending")
async def get_pending_challenges() -> PendingChallengesResponse:
    """Get all pending challenges for the current user"""
    return PendingChallengesResponse(
        total=0,
        challenges=[]
    )