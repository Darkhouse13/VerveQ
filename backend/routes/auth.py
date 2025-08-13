"""
Authentication routes for VerveQ Platform API
"""
from fastapi import APIRouter, HTTPException, Depends, Request, Response
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field, validator
from typing import Optional
from slowapi import Limiter
from slowapi.util import get_remote_address
import re     
import uuid

from database.connection import get_db
from database.models import User
from auth.jwt_auth import AuthService, get_current_user
from services.analytics import AnalyticsService

router = APIRouter(prefix="/auth", tags=["authentication"])
analytics_service = AnalyticsService()
limiter = Limiter(key_func=get_remote_address)

class UserCreate(BaseModel):
    display_name: str = Field(
        ..., 
        min_length=1, 
        max_length=100,
        pattern=r'^[a-zA-Z0-9\s\-_\.]+$',
        description="User display name (alphanumeric, spaces, hyphens, underscores, dots only)"
    )
    email: Optional[str] = Field(
        None, 
        max_length=255,
        pattern=r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$',
        description="Valid email address"
    )
    avatar_url: Optional[str] = Field(
        None, 
        max_length=500,
        pattern=r'^https?://[^\s/$.?#].[^\s]*$',
        description="Valid HTTP/HTTPS URL for avatar"
    )
    
    @validator('display_name')
    def validate_display_name(cls, v):
        if v and len(v.strip()) == 0:
            raise ValueError('Display name cannot be empty or whitespace only')
        return v.strip()
    
    @validator('email')
    def validate_email(cls, v):
        if v and len(v.strip()) == 0:
            raise ValueError('Email cannot be empty string')
        return v.strip().lower() if v else None
    
    @validator('avatar_url')
    def validate_avatar_url(cls, v):
        if v and len(v.strip()) == 0:
            raise ValueError('Avatar URL cannot be empty string')
        return v.strip() if v else None

@router.options("/login")
async def login_options(response: Response):
    """Handle OPTIONS request for login endpoint"""
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "*"
    response.headers["Access-Control-Max-Age"] = "86400"
    return {"message": "OK"}

@router.post("/login")
@limiter.limit("10/minute")
async def login(request: Request, user_data: UserCreate, db: Session = Depends(get_db)):
    """Login or create user account"""
    user = AuthService.get_or_create_user(db, user_data.dict())
    
    # Track login event
    analytics_service.track_event(
        db, "user_login", user_id=user.id, 
        event_data={"method": "anonymous" if not user.email else "email"}
    )
    
    # Create access token
    token = AuthService.create_access_token({"sub": user.id})
    
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "username": user.username,
            "display_name": user.display_name,
            "avatar_url": user.avatar_url,
            "total_games": user.total_games,
            "created_at": user.created_at.isoformat()
        }
    }

@router.options("/guest-session")
async def guest_session_options(response: Response):
    """Handle OPTIONS request for guest session endpoint"""
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "*"
    response.headers["Access-Control-Max-Age"] = "86400"
    return {"message": "OK"}

@router.post("/guest-session")
async def create_guest_session():
    """Create a guest session for anonymous users"""
    session_id = f"guest_{uuid.uuid4().hex[:8]}"
    
    return {
        "success": True,
        "session_id": session_id,
        "type": "guest"
    }

@router.get("/me")
async def get_current_user_info(current_user: User = Depends(get_current_user)):
    """Get current user information"""
    return {
        "id": current_user.id,
        "username": current_user.username,
        "display_name": current_user.display_name,
        "avatar_url": current_user.avatar_url,
        "total_games": current_user.total_games,
        "created_at": current_user.created_at.isoformat(),
        "last_active": current_user.last_active.isoformat()
    }