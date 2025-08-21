"""
Challenges routes for VerveQ Platform API
Complete MVP implementation following CLAUDE.md principles (<300 lines)
"""
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any, Literal
from pydantic import BaseModel, Field
from datetime import datetime, timedelta
from enum import Enum
import uuid

from database.connection import get_db
from database.models import Challenge as DBChallenge, User

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

class CreateChallengeRequest(BaseModel):
    challenged_username: str = Field(..., min_length=1, max_length=50)
    sport: ALLOWED_SPORTS
    mode: ALLOWED_GAME_MODES

class CreateChallengeResponse(BaseModel):
    message: str
    challenge_id: str

class ChallengeActionResponse(BaseModel):
    message: str
    status: str

@router.get("/pending")
async def get_pending_challenges(db: Session = Depends(get_db)) -> PendingChallengesResponse:
    """Get all pending challenges for the current user (MVP - returns empty)"""
    # MVP implementation - just return empty list
    # In full implementation, would filter by current user
    challenges = db.query(DBChallenge).filter(
        DBChallenge.status == 'pending'
    ).limit(10).all()
    
    return PendingChallengesResponse(
        total=len(challenges),
        challenges=[]  # MVP: return empty for now
    )

@router.post("/create", response_model=CreateChallengeResponse)
async def create_challenge(
    request: CreateChallengeRequest, 
    db: Session = Depends(get_db)
):
    """Create a new challenge (MVP implementation)"""
    # Verify challenged user exists
    challenged_user = db.query(User).filter(
        User.username == request.challenged_username
    ).first()
    
    if not challenged_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Create challenge
    challenge_id = str(uuid.uuid4())
    now = datetime.utcnow()
    
    challenge = DBChallenge(
        id=challenge_id,
        challenger_id="system",  # MVP: use system user
        challenged_id=challenged_user.id,
        sport=request.sport,
        mode=request.mode,
        status="pending",
        created_at=now,
        completed_at=None
    )
    
    db.add(challenge)
    db.commit()
    
    return CreateChallengeResponse(
        message=f"Challenge created for {request.challenged_username}",
        challenge_id=challenge_id
    )

@router.post("/accept/{challenge_id}", response_model=ChallengeActionResponse)
async def accept_challenge(challenge_id: str, db: Session = Depends(get_db)):
    """Accept a challenge (MVP implementation)"""
    challenge = db.query(DBChallenge).filter(DBChallenge.id == challenge_id).first()
    
    if not challenge:
        raise HTTPException(status_code=404, detail="Challenge not found")
    
    if challenge.status != "pending":
        raise HTTPException(status_code=400, detail="Challenge is not pending")
    
    # Update status
    challenge.status = "active"
    db.commit()
    
    return ChallengeActionResponse(
        message="Challenge accepted",
        status="active"
    )

@router.post("/decline/{challenge_id}", response_model=ChallengeActionResponse)  
async def decline_challenge(challenge_id: str, db: Session = Depends(get_db)):
    """Decline a challenge (MVP implementation)"""
    challenge = db.query(DBChallenge).filter(DBChallenge.id == challenge_id).first()
    
    if not challenge:
        raise HTTPException(status_code=404, detail="Challenge not found")
    
    if challenge.status != "pending":
        raise HTTPException(status_code=400, detail="Challenge is not pending")
    
    # Update status
    challenge.status = "declined"
    db.commit()
    
    return ChallengeActionResponse(
        message="Challenge declined",
        status="declined"
    )

@router.get("/{challenge_id}/status")
async def get_challenge_status(challenge_id: str, db: Session = Depends(get_db)):
    """Get challenge status (MVP implementation)"""
    challenge = db.query(DBChallenge).filter(DBChallenge.id == challenge_id).first()
    
    if not challenge:
        raise HTTPException(status_code=404, detail="Challenge not found")
    
    return {
        "challenge_id": challenge.id,
        "status": challenge.status,
        "sport": challenge.sport,
        "mode": challenge.mode,
        "created_at": challenge.created_at,
        "completed_at": challenge.completed_at
    }