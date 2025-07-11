"""
Configuration Management for VerveQ Unified Server
Handles feature flags, environment variables, and server configuration.
"""

import os
import json
import secrets
from typing import Dict, Any, Optional, List
from pathlib import Path
from dataclasses import dataclass, field
from enum import Enum

# Optional YAML support
try:
    import yaml
    YAML_AVAILABLE = True
except ImportError:
    YAML_AVAILABLE = False

# Optional dotenv support
try:
    from dotenv import load_dotenv
    DOTENV_AVAILABLE = True
except ImportError:
    DOTENV_AVAILABLE = False

# Load .env file if available
if DOTENV_AVAILABLE:
    load_dotenv()
else:
    # Manual .env loading as fallback
    env_file = Path('.env')
    if env_file.exists():
        with open(env_file, 'r') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    key, value = line.split('=', 1)
                    if key not in os.environ:  # Don't override existing env vars
                        os.environ[key] = value


class ServerMode(Enum):
    """Server complexity levels"""
    MINIMAL = "minimal"      # Basic quiz functionality only (like main.py)
    STANDARD = "standard"    # Full football features (like web_server.py)
    FULL = "full"           # Multi-sport with all features (like multi_sport_web_server.py)


@dataclass
class DatabaseConfig:
    """Database configuration for PostgreSQL integration"""
    
    # Database connection settings
    database_url: Optional[str] = None
    enable_postgresql: bool = False
    fallback_to_json: bool = True
    
    # Connection pool settings
    pool_size: int = 10
    max_overflow: int = 20
    pool_timeout: int = 30
    pool_recycle: int = 3600
    
    # Cache settings
    cache_ttl: int = 3600
    redis_url: Optional[str] = None
    
    def __post_init__(self):
        """Load database configuration from environment variables"""
        # Load from environment if not set
        if not self.database_url:
            self.database_url = os.environ.get('DATABASE_URL')
        
        # Load PostgreSQL enable flag
        if os.environ.get('ENABLE_POSTGRESQL', '').lower() == 'true':
            self.enable_postgresql = True
        
        # Load fallback setting
        if os.environ.get('FALLBACK_TO_JSON', '').lower() == 'false':
            self.fallback_to_json = False
        
        # Load Redis URL
        if not self.redis_url:
            self.redis_url = os.environ.get('REDIS_URL')
        
        # Load pool settings from environment
        if os.environ.get('DB_POOL_SIZE'):
            self.pool_size = int(os.environ.get('DB_POOL_SIZE', self.pool_size))
        if os.environ.get('DB_MAX_OVERFLOW'):
            self.max_overflow = int(os.environ.get('DB_MAX_OVERFLOW', self.max_overflow))
        if os.environ.get('CACHE_TTL'):
            self.cache_ttl = int(os.environ.get('CACHE_TTL', self.cache_ttl))


@dataclass
class ServerConfig:
    """Main server configuration class"""
    
    # Server mode and basic settings
    server_mode: ServerMode = ServerMode.STANDARD
    host: str = "127.0.0.1"
    port: int = 8008
    debug: bool = False
    
    # Feature flags
    enable_multi_sport: bool = False
    enable_analytics: bool = True
    enable_legacy_endpoints: bool = True
    enable_monitoring: bool = True
    enable_elo_system: bool = True
    enable_survival_mode: bool = True
    enable_admin_dashboard: bool = True
    enable_rate_limiting: bool = True
    enable_caching: bool = True
    
    # Security and middleware
    secret_key: Optional[str] = None
    enable_cors: bool = True
    enable_gzip: bool = True
    enable_sessions: bool = True
    
    # Data and performance settings
    data_root: str = "data"
    cache_size: int = 1000
    max_questions_per_quiz: int = 20
    default_quiz_questions: int = 10
    
    # Multi-sport settings (only used when enable_multi_sport=True)
    supported_sports: List[str] = field(default_factory=lambda: ["football", "tennis"])
    default_sport: str = "football"
    
    # Rate limiting settings
    rate_limit_requests: int = 100
    rate_limit_window: int = 60  # seconds
    
    # Logging and monitoring
    log_level: str = "INFO"
    enable_request_logging: bool = True
    
    # Database configuration
    database: DatabaseConfig = field(default_factory=DatabaseConfig)
    
    def __post_init__(self):
        """Validate configuration after initialization"""
        self._validate_config()
        self._apply_mode_defaults()
    
    def _validate_config(self):
        """Validate configuration values"""
        if self.port < 1 or self.port > 65535:
            raise ValueError(f"Invalid port number: {self.port}")
        
        if self.cache_size < 0:
            raise ValueError(f"Cache size cannot be negative: {self.cache_size}")
        
        if self.max_questions_per_quiz < 1:
            raise ValueError(f"Max questions per quiz must be positive: {self.max_questions_per_quiz}")
        
        if not Path(self.data_root).exists():
            print(f"Warning: Data root directory does not exist: {self.data_root}")
    
    def _apply_mode_defaults(self):
        """Apply default settings based on server mode"""
        if self.server_mode == ServerMode.MINIMAL:
            # Minimal mode - disable advanced features
            self.enable_analytics = False
            self.enable_monitoring = False
            self.enable_elo_system = False
            self.enable_survival_mode = False
            self.enable_admin_dashboard = False
            self.enable_rate_limiting = False
            self.enable_caching = False
            self.enable_multi_sport = False
            
        elif self.server_mode == ServerMode.STANDARD:
            # Standard mode - full football features
            self.enable_multi_sport = False
            
        elif self.server_mode == ServerMode.FULL:
            # Full mode - enable everything
            self.enable_multi_sport = True
    
    @property
    def requires_dependencies(self) -> List[str]:
        """Get list of required dependencies based on enabled features"""
        deps = ["fastapi", "uvicorn"]
        
        if self.enable_analytics:
            deps.extend(["pandas", "numpy"])
        
        if self.enable_monitoring:
            deps.extend(["psutil"])
        
        if self.enable_elo_system:
            deps.extend(["sqlalchemy"])
        
        if self.enable_multi_sport:
            deps.extend(["sentence-transformers", "scikit-learn"])
        
        return deps
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert configuration to dictionary"""
        return {
            "server_mode": self.server_mode.value,
            "host": self.host,
            "port": self.port,
            "debug": self.debug,
            "enable_multi_sport": self.enable_multi_sport,
            "enable_analytics": self.enable_analytics,
            "enable_legacy_endpoints": self.enable_legacy_endpoints,
            "enable_monitoring": self.enable_monitoring,
            "enable_elo_system": self.enable_elo_system,
            "enable_survival_mode": self.enable_survival_mode,
            "enable_admin_dashboard": self.enable_admin_dashboard,
            "enable_rate_limiting": self.enable_rate_limiting,
            "enable_caching": self.enable_caching,
            "secret_key": self.secret_key,
            "enable_cors": self.enable_cors,
            "enable_gzip": self.enable_gzip,
            "enable_sessions": self.enable_sessions,
            "data_root": self.data_root,
            "cache_size": self.cache_size,
            "max_questions_per_quiz": self.max_questions_per_quiz,
            "default_quiz_questions": self.default_quiz_questions,
            "supported_sports": self.supported_sports,
            "default_sport": self.default_sport,
            "rate_limit_requests": self.rate_limit_requests,
            "rate_limit_window": self.rate_limit_window,
            "log_level": self.log_level,
            "enable_request_logging": self.enable_request_logging
        }


class ConfigManager:
    """Manages configuration loading from various sources"""
    
    def __init__(self, config_file: Optional[str] = None):
        self.config_file = config_file
        self._config: Optional[ServerConfig] = None
    
    def load_config(self) -> ServerConfig:
        """Load configuration from environment variables and optional config file"""
        if self._config is not None:
            return self._config
        
        # Start with default configuration
        config_dict = {}
        
        # Load from config file if provided
        if self.config_file and Path(self.config_file).exists():
            config_dict.update(self._load_from_file(self.config_file))
        
        # Override with environment variables
        config_dict.update(self._load_from_env())
        
        # Create configuration object
        self._config = self._create_config(config_dict)
        return self._config
    
    def _load_from_file(self, config_file: str) -> Dict[str, Any]:
        """Load configuration from JSON or YAML file"""
        config_path = Path(config_file)
        
        try:
            with open(config_path, 'r') as f:
                if config_path.suffix.lower() in ['.yaml', '.yml']:
                    if not YAML_AVAILABLE:
                        print(f"Warning: YAML support not available. Install PyYAML to use YAML config files.")
                        return {}
                    return yaml.safe_load(f) or {}
                elif config_path.suffix.lower() == '.json':
                    return json.load(f)
                else:
                    raise ValueError(f"Unsupported config file format: {config_path.suffix}")
        except Exception as e:
            print(f"Warning: Failed to load config file {config_file}: {e}")
            return {}
    
    def _load_from_env(self) -> Dict[str, Any]:
        """Load configuration from environment variables"""
        env_config = {}
        
        # Server settings
        if os.getenv("VERVEQ_SERVER_MODE"):
            try:
                env_config["server_mode"] = ServerMode(os.getenv("VERVEQ_SERVER_MODE"))
            except ValueError:
                print(f"Warning: Invalid server mode: {os.getenv('VERVEQ_SERVER_MODE')}")
        
        if os.getenv("VERVEQ_HOST"):
            env_config["host"] = os.getenv("VERVEQ_HOST")
        
        if os.getenv("VERVEQ_PORT"):
            try:
                env_config["port"] = int(os.getenv("VERVEQ_PORT"))
            except ValueError:
                print(f"Warning: Invalid port number: {os.getenv('VERVEQ_PORT')}")
        
        if os.getenv("VERVEQ_DEBUG"):
            env_config["debug"] = os.getenv("VERVEQ_DEBUG").lower() in ["true", "1", "yes"]
        
        # Feature flags
        feature_flags = [
            "enable_multi_sport", "enable_analytics", "enable_legacy_endpoints",
            "enable_monitoring", "enable_elo_system", "enable_survival_mode",
            "enable_admin_dashboard", "enable_rate_limiting", "enable_caching",
            "enable_cors", "enable_gzip", "enable_sessions", "enable_request_logging"
        ]
        
        for flag in feature_flags:
            env_var = f"VERVEQ_{flag.upper()}"
            if os.getenv(env_var):
                env_config[flag] = os.getenv(env_var).lower() in ["true", "1", "yes"]
        
        # Other settings
        if os.getenv("SECRET_KEY"):
            env_config["secret_key"] = os.getenv("SECRET_KEY")
        else:
            # Generate a secure secret key if not provided
            env_config["secret_key"] = secrets.token_urlsafe(32)
        
        if os.getenv("VERVEQ_DATA_ROOT"):
            env_config["data_root"] = os.getenv("VERVEQ_DATA_ROOT")
        
        if os.getenv("VERVEQ_CACHE_SIZE"):
            try:
                env_config["cache_size"] = int(os.getenv("VERVEQ_CACHE_SIZE"))
            except ValueError:
                print(f"Warning: Invalid cache size: {os.getenv('VERVEQ_CACHE_SIZE')}")
        
        if os.getenv("VERVEQ_LOG_LEVEL"):
            env_config["log_level"] = os.getenv("VERVEQ_LOG_LEVEL").upper()
        
        return env_config
    
    def _create_config(self, config_dict: Dict[str, Any]) -> ServerConfig:
        """Create ServerConfig object from dictionary"""
        try:
            return ServerConfig(**config_dict)
        except TypeError as e:
            print(f"Warning: Invalid configuration parameters: {e}")
            # Return default config if there are issues
            return ServerConfig()
    
    def save_config(self, config: ServerConfig, output_file: str):
        """Save configuration to file"""
        config_path = Path(output_file)
        config_dict = config.to_dict()
        
        try:
            with open(config_path, 'w') as f:
                if config_path.suffix.lower() in ['.yaml', '.yml']:
                    if not YAML_AVAILABLE:
                        raise ValueError("YAML support not available. Install PyYAML to save YAML config files.")
                    yaml.dump(config_dict, f, default_flow_style=False, indent=2)
                elif config_path.suffix.lower() == '.json':
                    json.dump(config_dict, f, indent=2)
                else:
                    raise ValueError(f"Unsupported output format: {config_path.suffix}")

            print(f"Configuration saved to {output_file}")
        except Exception as e:
            print(f"Error saving configuration: {e}")


# Global configuration instance
_config_manager = ConfigManager()


def get_config(config_file: Optional[str] = None) -> ServerConfig:
    """Get the current server configuration"""
    global _config_manager
    if config_file:
        _config_manager = ConfigManager(config_file)
    return _config_manager.load_config()


def reload_config(config_file: Optional[str] = None) -> ServerConfig:
    """Reload configuration from sources"""
    global _config_manager
    _config_manager = ConfigManager(config_file)
    return _config_manager.load_config()


if __name__ == "__main__":
    # Example usage and testing
    print("VerveQ Configuration Manager")
    print("=" * 40)

    # Test default configuration
    config = get_config()
    print(f"Default mode: {config.server_mode.value}")
    print(f"Port: {config.port}")
    print(f"Multi-sport enabled: {config.enable_multi_sport}")
    print(f"Analytics enabled: {config.enable_analytics}")

    # Test different modes
    for mode in ServerMode:
        test_config = ServerConfig(server_mode=mode)
        print(f"\n{mode.value.upper()} mode features:")
        print(f"  Analytics: {test_config.enable_analytics}")
        print(f"  Monitoring: {test_config.enable_monitoring}")
        print(f"  Multi-sport: {test_config.enable_multi_sport}")
        print(f"  ELO System: {test_config.enable_elo_system}")
        print(f"  Required deps: {', '.join(test_config.requires_dependencies)}")

    # Test environment variable loading
    print(f"\nEnvironment variables (examples):")
    print(f"  VERVEQ_SERVER_MODE=minimal")
    print(f"  VERVEQ_PORT=8080")
    print(f"  VERVEQ_ENABLE_MULTI_SPORT=true")
    print(f"  SECRET_KEY=your-secret-key")
