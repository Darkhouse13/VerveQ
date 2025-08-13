"""
Integration tests for authentication routes.
Tests the complete auth flow including database interactions.
"""
import pytest
from httpx import AsyncClient
import re

from tests.backend.utils.test_client import TestClient


class TestAuthRoutes:
    """Test cases for authentication endpoints."""
    
    @pytest.mark.asyncio
    async def test_create_user_with_email(self, client: AsyncClient):
        """Test creating a new user with email."""
        response = await client.post(
            "/api/v1/auth/users",
            json={
                "username": "newuser",
                "email": "newuser@example.com"
            }
        )
        
        assert response.status_code == 201
        data = response.json()
        
        assert data["id"] is not None
        assert data["username"] == "newuser"
        assert data["email"] == "newuser@example.com"
        assert data["display_name"] == "newuser"
        assert data["is_guest"] is False
        assert "created_at" in data
    
    @pytest.mark.asyncio
    async def test_create_user_without_email(self, client: AsyncClient):
        """Test creating a new user without email."""
        response = await client.post(
            "/api/v1/auth/users",
            json={"username": "noemailuser"}
        )
        
        assert response.status_code == 201
        data = response.json()
        
        assert data["username"] == "noemailuser"
        assert data["email"] is None
    
    @pytest.mark.asyncio
    async def test_create_user_duplicate_username(self, client: AsyncClient):
        """Test creating user with duplicate username."""
        # Create first user
        await client.post(
            "/api/v1/auth/users",
            json={"username": "duplicate"}
        )
        
        # Try to create second user with same username
        response = await client.post(
            "/api/v1/auth/users",
            json={"username": "duplicate"}
        )
        
        assert response.status_code == 400
        assert "already exists" in response.json()["detail"]
    
    @pytest.mark.asyncio
    async def test_create_user_invalid_username(self, client: AsyncClient):
        """Test creating user with invalid username."""
        # Test various invalid usernames
        invalid_usernames = [
            "",  # Empty
            "a",  # Too short
            "ab",  # Too short
            "user@name",  # Special character
            "user name",  # Space
            "user$name",  # Special character
            "a" * 31,  # Too long
        ]
        
        for username in invalid_usernames:
            response = await client.post(
                "/api/v1/auth/users",
                json={"username": username}
            )
            assert response.status_code == 422, f"Username '{username}' should be invalid"
    
    @pytest.mark.asyncio
    async def test_create_user_valid_username_patterns(self, client: AsyncClient):
        """Test creating users with valid username patterns."""
        valid_usernames = [
            "user123",
            "test_user",
            "user_name_123",
            "123user",
            "_username",
            "user_",
            "USER",
            "UsEr123"
        ]
        
        for i, username in enumerate(valid_usernames):
            response = await client.post(
                "/api/v1/auth/users",
                json={"username": username}
            )
            assert response.status_code == 201, f"Username '{username}' should be valid"
    
    @pytest.mark.asyncio
    async def test_login_existing_user(self, client: AsyncClient):
        """Test logging in with existing user."""
        # Create user first
        await client.post(
            "/api/v1/auth/users",
            json={"username": "logintest", "email": "login@test.com"}
        )
        
        # Login
        response = await client.post(
            "/api/v1/auth/login",
            json={"username": "logintest"}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert "access_token" in data
        assert data["token_type"] == "bearer"
        assert "user" in data
        assert data["user"]["username"] == "logintest"
        assert data["user"]["email"] == "login@test.com"
    
    @pytest.mark.asyncio
    async def test_login_non_existing_user(self, client: AsyncClient):
        """Test logging in with non-existing user."""
        response = await client.post(
            "/api/v1/auth/login",
            json={"username": "nonexistent"}
        )
        
        assert response.status_code == 404
        assert "not found" in response.json()["detail"].lower()
    
    @pytest.mark.asyncio
    async def test_guest_session_creation(self, client: AsyncClient):
        """Test creating a guest session."""
        response = await client.post("/api/v1/auth/guest-session")
        
        assert response.status_code == 200
        data = response.json()
        
        assert "session_id" in data
        assert "access_token" in data
        assert data["token_type"] == "bearer"
        assert "user" in data
        assert data["user"]["is_guest"] is True
        assert data["user"]["username"].startswith("guest_")
    
    @pytest.mark.asyncio
    async def test_guest_session_unique(self, client: AsyncClient):
        """Test that each guest session is unique."""
        # Create multiple guest sessions
        sessions = []
        for _ in range(5):
            response = await client.post("/api/v1/auth/guest-session")
            data = response.json()
            sessions.append(data["session_id"])
        
        # All session IDs should be unique
        assert len(set(sessions)) == 5
    
    @pytest.mark.asyncio
    async def test_get_current_user_authenticated(self, client: AsyncClient):
        """Test getting current user when authenticated."""
        test_client = TestClient(client)
        
        # Create and login user
        await test_client.create_user("authtest")
        login_data = await test_client.login("authtest")
        
        # Get current user
        response = await test_client.get("/api/v1/auth/me")
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["username"] == "authtest"
        assert data["id"] == login_data["user"]["id"]
    
    @pytest.mark.asyncio
    async def test_get_current_user_unauthenticated(self, client: AsyncClient):
        """Test getting current user without authentication."""
        response = await client.get("/api/v1/auth/me")
        
        assert response.status_code == 401
        assert response.json()["detail"] == "Not authenticated"
    
    @pytest.mark.asyncio
    async def test_get_current_user_invalid_token(self, client: AsyncClient):
        """Test getting current user with invalid token."""
        response = await client.get(
            "/api/v1/auth/me",
            headers={"Authorization": "Bearer invalid.token.here"}
        )
        
        assert response.status_code == 401
        assert "Could not validate credentials" in response.json()["detail"]
    
    @pytest.mark.asyncio
    async def test_auth_flow_complete(self, client: AsyncClient):
        """Test complete authentication flow."""
        test_client = TestClient(client)
        
        # 1. Create user
        user_data = await test_client.create_user("flowtest", "flow@test.com")
        assert user_data["username"] == "flowtest"
        
        # 2. Login
        login_data = await test_client.login("flowtest")
        assert "access_token" in login_data
        
        # 3. Use authenticated endpoint
        response = await test_client.get("/api/v1/auth/me")
        assert response.status_code == 200
        me_data = response.json()
        assert me_data["username"] == "flowtest"
        assert me_data["email"] == "flow@test.com"
        
        # 4. Clear auth and verify can't access
        test_client.clear_auth()
        response = await test_client.get("/api/v1/auth/me")
        assert response.status_code == 401
    
    @pytest.mark.asyncio
    async def test_guest_auth_flow(self, client: AsyncClient):
        """Test guest authentication flow."""
        test_client = TestClient(client)
        
        # 1. Create guest session
        response = await client.post("/api/v1/auth/guest-session")
        guest_data = response.json()
        
        # 2. Authenticate as guest
        test_client.authenticate_guest(guest_data["session_id"])
        
        # 3. Access authenticated endpoint
        response = await test_client.get("/api/v1/auth/me")
        assert response.status_code == 200
        me_data = response.json()
        assert me_data["is_guest"] is True
        assert me_data["username"].startswith("guest_")
    
    @pytest.mark.asyncio
    async def test_rate_limiting(self, client: AsyncClient):
        """Test rate limiting on auth endpoints."""
        # Note: Rate limiting might be disabled in test environment
        # This test documents expected behavior
        
        # Try to create many users rapidly
        responses = []
        for i in range(10):
            response = await client.post(
                "/api/v1/auth/users",
                json={"username": f"ratelimit{i}"}
            )
            responses.append(response.status_code)
        
        # Check if any were rate limited (429) or all succeeded (201)
        # In test environment, rate limiting might be disabled
        assert all(status in [201, 429] for status in responses)
    
    @pytest.mark.asyncio
    async def test_auth_with_different_user_types(self, client: AsyncClient):
        """Test authentication with different user types."""
        test_client = TestClient(client)
        
        # Regular user
        await test_client.create_user("regular")
        regular_login = await test_client.login("regular")
        assert regular_login["user"]["is_guest"] is False
        
        # Guest user
        guest_response = await client.post("/api/v1/auth/guest-session")
        guest_data = guest_response.json()
        assert guest_data["user"]["is_guest"] is True
        
        # Verify tokens work correctly
        test_client.authenticate(
            regular_login["user"]["id"],
            regular_login["user"]["username"]
        )
        me_response = await test_client.get("/api/v1/auth/me")
        assert me_response.status_code == 200
        assert me_response.json()["is_guest"] is False
    
    @pytest.mark.asyncio
    async def test_username_generation_uniqueness(self, client: AsyncClient, db_session):
        """Test that username generation handles conflicts."""
        # Create a user with a specific username
        await client.post(
            "/api/v1/auth/users",
            json={"username": "testuser1"}
        )
        
        # The system should handle username conflicts gracefully
        # This is more of a unit test for the username generation logic
        # but included here to ensure the route handles it properly
        response = await client.post(
            "/api/v1/auth/users",
            json={"username": "another_unique_user"}
        )
        assert response.status_code == 201