"""
Clerk Demo Routes
Provides a minimal protected endpoint using Clerk session verification.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends
from typing import Any, Dict

from auth.clerk_auth import get_current_clerk_session

router = APIRouter(prefix="/clerk", tags=["clerk"])


@router.get("/me")
async def clerk_me(context: Dict[str, Any] = Depends(get_current_clerk_session)):
    """Return current Clerk user context (safe subset)."""
    claims = context.get("claims") or {}
    return {
        "user_id": context.get("user_id"),
        "org_role": claims.get("org_role"),
        "session_status": context.get("session_status"),
    }

