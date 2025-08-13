"""
Unit tests for the authentication service.
"""
import pytest
from datetime import datetime, timedelta
from unittest.mock import patch, MagicMock
import jwt
from fastapi import HTTPException, status

from backend.auth.jwt_auth import AuthService, get_current_user, get_current_user_optional
from backend.database.models import User
from backend.config.settings import Settings

@pytest.fixture
def mock_settings():
    """Mock settings for testing."""
    with patch('backend.auth.jwt_auth.settings', autospec=True) as mock:
        mock.jwt_secret_key = "test_secret"
        mock.jwt_algorithm = "HS256"
        mock.jwt_expire_minutes = 15
        yield mock

class TestJWTAuth:
    """Test cases for JWT authentication."""

    def test_create_access_token_user(self, mock_settings):
        """Test creating a valid access token for a user."""
        user_id = "user-123"
        token = AuthService.create_access_token(data={"sub": user_id, "type": "user"})
        
        decoded_payload = jwt.decode(token, mock_settings.jwt_secret_key, algorithms=[mock_settings.jwt_algorithm])
        
        assert decoded_payload["sub"] == user_id
        assert decoded_payload["type"] == "user"
        assert "exp" in decoded_payload

    def test_create_access_token_guest(self, mock_settings):
        """Test creating a valid access token for a guest."""
        guest_id = "guest-abc"
        token = AuthService.create_access_token(data={"sub": guest_id, "type": "guest"})
        
        decoded_payload = jwt.decode(token, mock_settings.jwt_secret_key, algorithms=[mock_settings.jwt_algorithm])
        
        assert decoded_payload["sub"] == guest_id
        assert decoded_payload["type"] == "guest"

    def test_token_expiration(self, mock_settings):
        """Test that the token has an expiration time."""
        token = AuthService.create_access_token(data={"sub": "user-123"})
        payload = jwt.decode(token, mock_settings.jwt_secret_key, algorithms=[mock_settings.jwt_algorithm])
        
        expire_time = datetime.fromtimestamp(payload["exp"])
        issue_time = datetime.utcnow()
        
        assert (expire_time - issue_time).total_seconds() > 0
        assert (expire_time - issue_time).total_seconds() <= mock_settings.jwt_expire_minutes * 60

    def test_create_access_token_custom_expiration(self, mock_settings):
        """Test creating a token with a custom expiration."""
        mock_settings.jwt_expire_minutes = 60 # 1 hour
        
        token = AuthService.create_access_token(data={"sub": "user-xyz"})
        payload = jwt.decode(token, mock_settings.jwt_secret_key, algorithms=[mock_settings.jwt_algorithm])
        
        expire_time = datetime.fromtimestamp(payload["exp"])
        issue_time = datetime.utcnow()
        
        # Expiration should be around 1 hour
        assert timedelta(minutes=59) < (expire_time - issue_time) < timedelta(minutes=61)

    def test_verify_token_valid(self, mock_settings):
        """Test verifying a valid token."""
        token = AuthService.create_access_token(data={"sub": "user-123"})
        payload = AuthService.verify_token(token)
        assert payload["sub"] == "user-123"

    def test_verify_token_invalid_signature(self, mock_settings):
        """Test verifying a token with an invalid signature."""
        token = jwt.encode({"sub": "user-123"}, "wrong-secret", algorithm=mock_settings.jwt_algorithm)
        
        with pytest.raises(HTTPException) as exc_info:
            AuthService.verify_token(token)
        
        assert exc_info.value.status_code == status.HTTP_401_UNAUTHORIZED
        assert "Invalid token" in exc_info.value.detail

    def test_verify_token_expired(self, mock_settings):
        """Test verifying an expired token."""
        mock_settings.jwt_expire_minutes = -1 # Expired
        token = AuthService.create_access_token(data={"sub": "user-123"})
        
        with pytest.raises(HTTPException) as exc_info:
            AuthService.verify_token(token)
        
        assert exc_info.value.status_code == status.HTTP_401_UNAUTHORIZED
        assert "Token has expired" in exc_info.value.detail

    def test_verify_token_malformed(self, mock_settings):
        """Test verifying a malformed token."""
        with pytest.raises(HTTPException) as exc_info:
            AuthService.verify_token("this.is.not.a.token")
        
        assert exc_info.value.status_code == status.HTTP_401_UNAUTHORIZED
        assert "Invalid token" in exc_info.value.detail

    def test_verify_token_wrong_algorithm(self, mock_settings):
        """Test verifying a token with a different algorithm."""
        token = jwt.encode({"sub": "user-123"}, mock_settings.jwt_secret_key, algorithm="HS512")
        
        with pytest.raises(HTTPException) as exc_info:
            AuthService.verify_token(token)
        
        assert exc_info.value.status_code == status.HTTP_401_UNAUTHORIZED
        assert "Invalid token" in exc_info.value.detail

    def test_get_current_user_valid(self, mock_settings):
        """Test getting the current user with a valid token."""
        user = User(id="user-123", username="testuser")
        mock_db = MagicMock()
        mock_db.query.return_value.filter.return_value.first.return_value = user
        
        token = AuthService.create_access_token(data={"sub": "user-123"})
        credentials = MagicMock()
        credentials.credentials = token
        
        current_user = get_current_user(credentials=credentials, db=mock_db)
        
        assert current_user.id == "user-123"
        mock_db.commit.assert_called_once()

    def test_get_current_user_invalid_token(self, mock_settings):
        """Test getting the current user with an invalid token."""
        mock_db = MagicMock()
        credentials = MagicMock()
        credentials.credentials = "invalid-token"
        
        with pytest.raises(HTTPException) as exc_info:
            get_current_user(credentials=credentials, db=mock_db)
        
        assert exc_info.value.status_code == status.HTTP_401_UNAUTHORIZED
        assert "Invalid token" in exc_info.value.detail

    def test_get_current_user_optional_with_token(self, mock_settings):
        """Test getting an optional user with a valid token."""
        user = User(id="user-123", username="testuser")
        mock_db = MagicMock()
        mock_db.query.return_value.filter.return_value.first.return_value = user
        
        token = AuthService.create_access_token(data={"sub": "user-123"})
        credentials = MagicMock()
        credentials.credentials = token
        
        current_user = get_current_user_optional(credentials=credentials, db=mock_db)
        
        assert current_user is not None
        assert current_user.id == "user-123"

    def test_get_current_user_optional_no_token(self):
        """Test getting an optional user with no token."""
        mock_db = MagicMock()
        current_user = get_current_user_optional(credentials=None, db=mock_db)
        assert current_user is None

    def test_get_current_user_optional_invalid_token(self, mock_settings):
        """Test getting an optional user with an invalid token."""
        mock_db = MagicMock()
        credentials = MagicMock()
        credentials.credentials = "invalid-token"
        
        current_user = get_current_user_optional(credentials=credentials, db=mock_db)
        assert current_user is None

    def test_token_near_expiration(self, mock_settings):
        """Test token verification near expiration time."""
        mock_settings.jwt_expire_minutes = 1
        token = AuthService.create_access_token(data={"sub": "user-123"})
        
        # Should be valid right after creation
        payload = AuthService.verify_token(token)
        assert payload is not None

    def test_token_security_headers(self, mock_settings):
        """Test that no sensitive headers are included."""
        token = AuthService.create_access_token(data={"sub": "user-123"})
        header = jwt.get_unverified_header(token)
        
        assert "alg" in header
        assert "typ" in header
        assert len(header) == 2 # No extra headers