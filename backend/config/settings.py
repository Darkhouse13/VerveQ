"""
VerveQ Platform Configuration Management
Centralized configuration with environment variable support
"""
import os
import secrets
from typing import List, Optional
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

class Settings:
    """
    Centralized configuration class with environment variable support
    Follows CLAUDE.md security and maintainability principles
    """
    
    def __init__(self):
        self._validate_required_env_vars()
    
    # Environment Detection
    @property
    def environment(self) -> str:
        """Get current environment (development/staging/production)"""
        return os.getenv("ENVIRONMENT", "development").lower()
    
    @property
    def is_development(self) -> bool:
        return self.environment == "development"
    
    @property
    def is_production(self) -> bool:
        return self.environment == "production"
    
    # Server Configuration
    @property
    def host(self) -> str:
        """Server host address"""
        return os.getenv("HOST", "0.0.0.0")
    
    @property
    def port(self) -> int:
        """Server port"""
        return int(os.getenv("PORT", "8000"))
    
    @property
    def debug(self) -> bool:
        """Debug mode enabled"""
        return os.getenv("DEBUG", "true" if self.is_development else "false").lower() == "true"
    
    # Database Configuration
    @property
    def database_url(self) -> Optional[str]:
        """Database connection URL"""
        return os.getenv("DATABASE_URL")
    
    @property
    def sqlite_path(self) -> str:
        """SQLite database path for development"""
        return os.getenv("SQLITE_PATH", "verveq_platform.db")
    
    # JWT Configuration
    @property
    def jwt_secret_key(self) -> str:
        """JWT secret key with secure fallback"""
        secret = os.getenv("JWT_SECRET_KEY")
        
        if not secret:
            if self.is_production:
                raise ValueError(
                    "JWT_SECRET_KEY environment variable is required in production. "
                    "Generate a secure key using: python -c 'import secrets; print(secrets.token_urlsafe(32))'"
                )
            
            # Generate a secure fallback for development with warning
            fallback_secret = secrets.token_urlsafe(32)
            print("⚠️  WARNING: Using auto-generated JWT secret for development.")
            print(f"   Set JWT_SECRET_KEY environment variable to: {fallback_secret}")
            return fallback_secret
        
        return secret
    
    @property
    def jwt_algorithm(self) -> str:
        """JWT algorithm"""
        return os.getenv("JWT_ALGORITHM", "HS256")
    
    @property
    def jwt_expire_minutes(self) -> int:
        """JWT token expiration in minutes"""
        return int(os.getenv("JWT_EXPIRE_MINUTES", "10080"))  # 1 week default
    
    # CORS Configuration
    @property
    def cors_origins(self) -> List[str]:
        """CORS allowed origins"""
        origins_str = os.getenv("CORS_ORIGINS", "")
        
        if not origins_str:
            if self.is_production:
                raise ValueError(
                    "CORS_ORIGINS environment variable is required in production. "
                    "Example: CORS_ORIGINS=https://yourapp.com,https://www.yourapp.com"
                )
            
            # Development fallback with comprehensive mobile app support
            return [
                "http://localhost:3000",
                "http://localhost:19006",  # Expo web
                "http://localhost:8081",  # React Native Web
                "http://192.168.1.174:19006",  # Local network
                "exp://192.168.1.174:19000",  # Expo development
                "exp://localhost:19000",  # Expo localhost
                "http://127.0.0.1:19006",  # IPv4 localhost
                "http://0.0.0.0:19006",  # All interfaces
                "capacitor://localhost",  # Capacitor iOS/Android
                "ionic://localhost",  # Ionic
                "file://",  # File protocol for mobile apps
            ]
        
        return [origin.strip() for origin in origins_str.split(",")]
    
    @property
    def cors_allow_credentials(self) -> bool:
        """CORS allow credentials"""
        return os.getenv("CORS_ALLOW_CREDENTIALS", "true").lower() == "true"
    
    # Rate Limiting Configuration
    @property
    def rate_limit_enabled(self) -> bool:
        """Enable rate limiting"""
        return os.getenv("RATE_LIMIT_ENABLED", "true").lower() == "true"
    
    @property
    def rate_limit_requests_per_minute(self) -> int:
        """Rate limit requests per minute"""
        return int(os.getenv("RATE_LIMIT_REQUESTS_PER_MINUTE", "60"))
    
    # Logging Configuration
    @property
    def log_level(self) -> str:
        """Logging level"""
        default_level = "DEBUG" if self.is_development else "INFO"
        return os.getenv("LOG_LEVEL", default_level)
    
    # API Configuration
    @property
    def api_title(self) -> str:
        """API title"""
        return os.getenv("API_TITLE", "VerveQ Platform API")
    
    @property
    def api_version(self) -> str:
        """API version"""
        return os.getenv("API_VERSION", "3.0.0")
    
    @property
    def api_description(self) -> str:
        """API description"""
        return os.getenv("API_DESCRIPTION", "Competitive Sports Gaming Platform API")
    
    def _validate_required_env_vars(self):
        """Validate required environment variables for production"""
        if not self.is_production:
            return
        
        required_vars = [
            ("JWT_SECRET_KEY", "JWT secret key for token signing"),
            ("CORS_ORIGINS", "CORS allowed origins for security"),
        ]
        
        missing_vars = []
        for var_name, description in required_vars:
            if not os.getenv(var_name):
                missing_vars.append(f"  - {var_name}: {description}")
        
        if missing_vars:
            error_msg = (
                "Missing required environment variables for production:\n"
                + "\n".join(missing_vars) + 
                "\n\nPlease set these variables before running in production."
            )
            raise ValueError(error_msg)
    
    def print_config_summary(self):
        """Print configuration summary (excluding sensitive data)"""
        print(f"🚀 VerveQ Platform Configuration Summary")
        print(f"   Environment: {self.environment}")
        print(f"   Host: {self.host}:{self.port}")
        print(f"   Debug: {self.debug}")
        print(f"   Database: {'PostgreSQL' if self.database_url else 'SQLite'}")
        print(f"   CORS Origins: {len(self.cors_origins)} configured")
        print(f"   Rate Limiting: {'Enabled' if self.rate_limit_enabled else 'Disabled'}")
        print(f"   JWT Expiration: {self.jwt_expire_minutes} minutes")

# Global settings instance
settings = Settings()