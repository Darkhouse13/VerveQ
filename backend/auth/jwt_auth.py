from datetime import datetime, timedelta
from typing import Optional
import jwt
from fastapi import HTTPException, status, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from database.connection import get_db
from database.models import User
from config.settings import settings
import hashlib
import secrets

security = HTTPBearer()

class AuthService:
    @staticmethod
    def create_access_token(data: dict) -> str:
        """Create JWT access token"""
        to_encode = data.copy()
        expire = datetime.utcnow() + timedelta(minutes=settings.jwt_expire_minutes)
        to_encode.update({"exp": expire})
        encoded_jwt = jwt.encode(to_encode, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)
        return encoded_jwt
    
    @staticmethod
    def verify_token(token: str) -> dict:
        """Verify and decode JWT token"""
        try:
            payload = jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
            return payload
        except jwt.ExpiredSignatureError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token has expired"
            )
        except jwt.JWTError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token"
            )
    
    @staticmethod
    def generate_username(display_name: str) -> str:
        """Generate unique username from display name"""
        base_username = display_name.lower().replace(" ", "").replace("-", "")
        # Remove non-alphanumeric characters
        base_username = ''.join(char for char in base_username if char.isalnum())
        # Truncate to reasonable length
        base_username = base_username[:20]
        
        # Add random suffix to ensure uniqueness
        random_suffix = secrets.token_hex(4)
        return f"{base_username}_{random_suffix}"
    
    @staticmethod
    def create_anonymous_user(db: Session, display_name: str) -> User:
        """Create anonymous user account"""
        username = AuthService.generate_username(display_name)
        
        user = User(
            username=username,
            display_name=display_name,
            email=None  # Anonymous users don't have email
        )
        
        db.add(user)
        db.commit()
        db.refresh(user)
        
        return user
    
    @staticmethod
    def get_or_create_user(db: Session, user_data: dict) -> User:
        """Get existing user or create new one"""
        # For anonymous users, always create new
        if not user_data.get("email"):
            return AuthService.create_anonymous_user(db, user_data["display_name"])
        
        # For email users, check if exists
        user = db.query(User).filter(User.email == user_data["email"]).first()
        
        if not user:
            username = AuthService.generate_username(user_data["display_name"])
            user = User(
                username=username,
                email=user_data["email"],
                display_name=user_data["display_name"],
                avatar_url=user_data.get("avatar_url")
            )
            db.add(user)
            db.commit()
            db.refresh(user)
        else:
            # Update last active
            user.last_active = datetime.utcnow()
            db.commit()
        
        return user

def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
) -> User:
    """Get current authenticated user"""
    token = credentials.credentials
    payload = AuthService.verify_token(token)
    
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload"
        )
    
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found"
        )
    
    # Update last active
    user.last_active = datetime.utcnow()
    db.commit()
    
    return user

def get_current_user_optional(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: Session = Depends(get_db)
) -> Optional[User]:
    """Get current user if authenticated, otherwise None"""
    if not credentials:
        return None
    
    try:
        return get_current_user(credentials, db)
    except HTTPException:
        return None