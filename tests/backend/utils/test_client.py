"""
Test client utilities for API testing.
"""
from typing import Dict, Optional, Any
from httpx import AsyncClient
from backend.auth.jwt_auth import AuthService


class TestClient:
    """Enhanced test client with authentication helpers."""
    
    def __init__(self, client: AsyncClient):
        self.client = client
        self._auth_headers = None
        self._current_user = None
    
    def authenticate(self, user_id: str, username: str, user_type: str = "user"):
        """Set authentication for the test client."""
        token = AuthService.create_access_token(
            data={
                "sub": user_id,
                "username": username,
                "type": user_type
            }
        )
        self._auth_headers = {"Authorization": f"Bearer {token}"}
        self._current_user = {
            "id": user_id,
            "username": username,
            "type": user_type
        }
        return self
    
    def authenticate_guest(self, session_id: str):
        """Set guest authentication for the test client."""
        token = AuthService.create_access_token(
            data={
                "sub": session_id,
                "type": "guest"
            }
        )
        self._auth_headers = {"Authorization": f"Bearer {token}"}
        self._current_user = {
            "id": session_id,
            "type": "guest"
        }
        return self
    
    def clear_auth(self):
        """Clear authentication."""
        self._auth_headers = None
        self._current_user = None
        return self
    
    async def get(self, url: str, **kwargs):
        """GET request with optional authentication."""
        headers = kwargs.pop("headers", {})
        if self._auth_headers:
            headers.update(self._auth_headers)
        return await self.client.get(url, headers=headers, **kwargs)
    
    async def post(self, url: str, **kwargs):
        """POST request with optional authentication."""
        headers = kwargs.pop("headers", {})
        if self._auth_headers:
            headers.update(self._auth_headers)
        return await self.client.post(url, headers=headers, **kwargs)
    
    async def put(self, url: str, **kwargs):
        """PUT request with optional authentication."""
        headers = kwargs.pop("headers", {})
        if self._auth_headers:
            headers.update(self._auth_headers)
        return await self.client.put(url, headers=headers, **kwargs)
    
    async def patch(self, url: str, **kwargs):
        """PATCH request with optional authentication."""
        headers = kwargs.pop("headers", {})
        if self._auth_headers:
            headers.update(self._auth_headers)
        return await self.client.patch(url, headers=headers, **kwargs)
    
    async def delete(self, url: str, **kwargs):
        """DELETE request with optional authentication."""
        headers = kwargs.pop("headers", {})
        if self._auth_headers:
            headers.update(self._auth_headers)
        return await self.client.delete(url, headers=headers, **kwargs)
    
    @property
    def current_user(self):
        """Get current authenticated user info."""
        return self._current_user
    
    async def create_user(self, username: str, email: Optional[str] = None) -> Dict[str, Any]:
        """Helper to create a new user."""
        response = await self.post(
            "/api/v1/auth/users",
            json={
                "username": username,
                "email": email
            }
        )
        return response.json()
    
    async def login(self, username: str) -> Dict[str, Any]:
        """Helper to login a user."""
        response = await self.post(
            "/api/v1/auth/login",
            json={"username": username}
        )
        data = response.json()
        if response.status_code == 200:
            # Auto-authenticate the client
            self.authenticate(
                user_id=data["user"]["id"],
                username=data["user"]["username"]
            )
        return data
    
    async def start_quiz(self, sport: str = "football") -> Dict[str, Any]:
        """Helper to start a quiz game."""
        response = await self.post(
            f"/api/v1/games/quiz/{sport}/start"
        )
        return response.json()
    
    async def submit_quiz_answer(self, sport: str, question_id: int, answer: str) -> Dict[str, Any]:
        """Helper to submit a quiz answer."""
        response = await self.post(
            f"/api/v1/games/quiz/{sport}/answer",
            json={
                "question_id": question_id,
                "answer": answer
            }
        )
        return response.json()
    
    async def get_leaderboard(self, sport: str = "football", mode: str = "quiz", period: str = "all_time") -> Dict[str, Any]:
        """Helper to get leaderboard."""
        response = await self.get(
            f"/api/v1/leaderboards/{sport}/{mode}",
            params={"period": period}
        )
        return response.json()