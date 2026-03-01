"""
Achievement routes for VerveQ Platform API
Simple MVP implementation following CLAUDE.md principles (<300 lines)
"""
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func, and_
from typing import List, Dict, Any
from pydantic import BaseModel
from datetime import datetime

from database.connection import get_db
from database.models import Achievement, UserAchievement, User, GameSession, UserRating

router = APIRouter(prefix="/achievements", tags=["achievements"])

class AchievementResponse(BaseModel):
    id: str
    name: str
    description: str
    category: str
    icon: str
    points: int
    is_hidden: bool

class UserAchievementResponse(BaseModel):
    achievement: AchievementResponse
    unlocked_at: datetime
    progress: Dict[str, Any] = None

class AchievementCheckResponse(BaseModel):
    newly_unlocked: List[str]
    total_unlocked: int
    total_points: int

@router.get("/", response_model=List[AchievementResponse])
async def list_achievements(db: Session = Depends(get_db)):
    """List all available achievements"""
    achievements = db.query(Achievement).filter(Achievement.is_hidden == False).all()
    return [
        AchievementResponse(
            id=a.id,
            name=a.name,
            description=a.description,
            category=a.category,
            icon=a.icon,
            points=a.points,
            is_hidden=a.is_hidden
        )
        for a in achievements
    ]

@router.get("/user/{user_id}", response_model=List[UserAchievementResponse])
async def get_user_achievements(user_id: str, db: Session = Depends(get_db)):
    """Get user's unlocked achievements"""
    # Verify user exists
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    user_achievements = db.query(UserAchievement, Achievement).join(
        Achievement, UserAchievement.achievement_id == Achievement.id
    ).filter(UserAchievement.user_id == user_id).all()
    
    return [
        UserAchievementResponse(
            achievement=AchievementResponse(
                id=achievement.id,
                name=achievement.name,
                description=achievement.description,
                category=achievement.category,
                icon=achievement.icon,
                points=achievement.points,
                is_hidden=achievement.is_hidden
            ),
            unlocked_at=user_achievement.unlocked_at,
            progress=user_achievement.progress
        )
        for user_achievement, achievement in user_achievements
    ]

@router.post("/check/{user_id}", response_model=AchievementCheckResponse)
async def check_achievements(user_id: str, db: Session = Depends(get_db)):
    """Check and unlock new achievements for user (MVP implementation)"""
    # Verify user exists
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Get already unlocked achievements
    unlocked_achievement_ids = set(
        ua.achievement_id for ua in 
        db.query(UserAchievement).filter(UserAchievement.user_id == user_id).all()
    )
    
    # Get user stats for checking achievements
    total_games = db.query(GameSession).filter(GameSession.user_id == user_id).count()
    quiz_games = db.query(GameSession).filter(
        and_(GameSession.user_id == user_id, GameSession.mode == 'quiz')
    ).count()
    survival_games = db.query(GameSession).filter(
        and_(GameSession.user_id == user_id, GameSession.mode == 'survival')
    ).count()
    
    # Get highest scores
    max_quiz_accuracy = db.query(func.max(GameSession.accuracy)).filter(
        and_(GameSession.user_id == user_id, GameSession.mode == 'quiz')
    ).scalar() or 0
    
    max_survival_score = db.query(func.max(GameSession.score)).filter(
        and_(GameSession.user_id == user_id, GameSession.mode == 'survival')
    ).scalar() or 0
    
    # Get sports played
    sports_played = db.query(GameSession.sport).filter(
        GameSession.user_id == user_id
    ).distinct().count()
    
    # Get highest ELO rating
    max_elo = db.query(func.max(UserRating.elo_rating)).filter(
        UserRating.user_id == user_id
    ).scalar() or 1200
    
    newly_unlocked = []
    
    # Check each achievement (simple MVP logic)
    achievement_checks = [
        ("first_quiz", quiz_games >= 1),
        ("first_survival", survival_games >= 1),
        ("quiz_master", max_quiz_accuracy >= 100),
        ("survival_legend", max_survival_score >= 15),
        ("multi_sport_athlete", sports_played >= 2),
        ("dedicated_player", total_games >= 50),
        ("elo_champion", max_elo >= 1500),
    ]
    
    for achievement_id, condition in achievement_checks:
        if achievement_id not in unlocked_achievement_ids and condition:
            # Unlock achievement
            try:
                user_achievement = UserAchievement(
                    user_id=user_id,
                    achievement_id=achievement_id,
                    unlocked_at=datetime.utcnow()
                )
                db.add(user_achievement)
                newly_unlocked.append(achievement_id)
            except Exception:
                # Skip if achievement doesn't exist or already unlocked
                continue
    
    if newly_unlocked:
        db.commit()
    
    # Get total stats
    total_unlocked = len(unlocked_achievement_ids) + len(newly_unlocked)
    total_points = db.query(func.sum(Achievement.points)).join(
        UserAchievement, Achievement.id == UserAchievement.achievement_id
    ).filter(UserAchievement.user_id == user_id).scalar() or 0
    
    return AchievementCheckResponse(
        newly_unlocked=newly_unlocked,
        total_unlocked=total_unlocked,
        total_points=total_points
    )