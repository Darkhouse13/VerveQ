"""
Clerk authentication dependencies for FastAPI.
Provides an async dependency to verify a Clerk session token and
return lightweight session context for route handlers.
"""
from __future__ import annotations

from typing import Any, Dict, Optional
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jwt import decode as jwt_decode
from jwt import InvalidTokenError

from config.settings import settings
from services.clerk_client import get_clerk_client

bearer_scheme = HTTPBearer(auto_error=True)


async def get_current_clerk_session(
    request: Request,
    token: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> Dict[str, Any]:
    """
    Verify the Clerk session token and return a minimal context dict.
    Context fields:
      - token (str): original bearer token
      - claims (dict): decoded (unverified) JWT claims for quick access (org_role, etc.)
      - user_id (str): Clerk user id (from verified session)
      - session_status (str): session status from Clerk
    Raises 401 on invalid/expired token.
    """
    raw_token = token.credentials

    # Optional early claim checks (iss/aud) without signature verification to fail fast
    try:
        claims = jwt_decode(raw_token, options={"verify_signature": False, "verify_exp": False})
        iss = claims.get("iss")
        aud = claims.get("aud")
        if settings.clerk_issuer and iss and settings.clerk_issuer.rstrip("/") != str(iss).rstrip("/"):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token issuer")
        if settings.clerk_jwt_audience and aud:
            expected = settings.clerk_jwt_audience
            if isinstance(aud, (list, tuple)):
                if expected not in aud:
                    raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token audience")
            else:
                if str(aud) != expected:
                    raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token audience")
    except InvalidTokenError:
        # If we cannot parse claims, proceed to verification which will fail deterministically
        claims = {}
    except HTTPException:
        # Reraise explicit claim mismatch
        raise
    except Exception:
        # Do not leak parsing details
        claims = {}

    # Remote verification with Clerk (authoritative)
    try:
        clerk = get_clerk_client()
        session = await clerk.sessions.verify_async(token=raw_token)
        return {
            "token": raw_token,
            "claims": claims,
            "user_id": session.user_id,
            "session_status": getattr(session, "status", None),
        }
    except Exception:
        # Avoid exposing SDK/internal errors
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired authentication token",
            headers={"WWW-Authenticate": "Bearer"},
        )

