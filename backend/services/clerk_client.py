"""
Clerk client singleton initialization.
Uses official `clerk-backend-api` SDK with bearer auth.
"""
from __future__ import annotations

from typing import Optional
from clerk_backend_api import Clerk
from config.settings import settings

_client: Optional[Clerk] = None


def get_clerk_client() -> Clerk:
    global _client
    if _client is None:
        secret = settings.clerk_secret_key
        if not secret:
            raise RuntimeError("CLERK_SECRET_KEY is not configured")
        _client = Clerk(bearer_auth=secret)
    return _client

