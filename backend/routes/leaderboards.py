"""
Leaderboard routes for VerveQ Platform API
"""
from fastapi import APIRouter, Query, Request
from typing import Optional, List, Literal
from pydantic import BaseModel, Field
from slowapi import Limiter
from slowapi.util import get_remote_address

router = APIRouter(prefix="/leaderboards", tags=["leaderboards"])
limiter = Limiter(key_func=get_remote_address)

# Allowed leaderboard periods
ALLOWED_PERIODS = Literal["daily", "weekly", "monthly", "all_time"]

class LeaderboardEntry(BaseModel):
    rank: int = Field(..., ge=1, description="User rank on the leaderboard")
    user_id: str = Field(..., min_length=1, max_length=50, description="User's unique identifier")
    username: str = Field(..., min_length=1, max_length=100, description="Username")
    score: int = Field(..., ge=0, description="User's score")
    elo_rating: Optional[int] = Field(None, ge=0, description="User's ELO rating")

class LeaderboardResponse(BaseModel):
    sport: Optional[str] = Field(None, min_length=1, max_length=50)
    game_mode: Optional[str] = Field(None, min_length=1, max_length=50)
    period: ALLOWED_PERIODS
    entries: List[LeaderboardEntry]
    total_entries: int = Field(..., ge=0)

@router.get("/global")
@limiter.limit("30/minute")
async def get_global_leaderboard(
    request: Request,
    period: ALLOWED_PERIODS = Query("all_time", description="Time period: daily, weekly, monthly, all_time"),
    limit: int = Query(10, description="Number of entries to return", ge=1, le=100)
) -> LeaderboardResponse:
    """Get global leaderboard across all sports and game modes"""
    return LeaderboardResponse(
        sport=None,
        game_mode=None,
        period=period,
        entries=[],
        total_entries=0
    )

@router.get("/{sport}/{game_mode}")
@limiter.limit("30/minute")
async def get_sport_leaderboard(
    request: Request,
    sport: str,
    game_mode: str,
    period: ALLOWED_PERIODS = Query("all_time", description="Time period: daily, weekly, monthly, all_time"),
    limit: int = Query(10, description="Number of entries to return", ge=1, le=100)
) -> LeaderboardResponse:
    """Get leaderboard for specific sport and game mode"""
    return LeaderboardResponse(
        sport=sport,
        game_mode=game_mode,
        period=period,
        entries=[],
        total_entries=0
    )