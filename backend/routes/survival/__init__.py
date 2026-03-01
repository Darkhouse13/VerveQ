"""
Survival mode routes module for VerveQ Platform API
Combines session-based and legacy endpoints
"""
from fastapi import APIRouter
from .session import router as session_router
from .legacy import router as legacy_router

# Create main survival router
router = APIRouter(tags=["survival"])

# Include sub-routers
router.include_router(session_router)
router.include_router(legacy_router)