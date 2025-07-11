# VerveQ Unified Server

The VerveQ Unified Server consolidates the functionality of three previous server implementations (`web_server.py`, `main.py`, and `multi_sport_web_server.py`) into a single, configurable FastAPI application.

## 🚀 Quick Start

### Basic Usage
```bash
# Start with default configuration (standard mode)
python unified_server.py

# Or use the universal launcher
python run_server.py
```

### Environment Configuration
```bash
# Minimal mode (basic quiz functionality only)
VERVEQ_SERVER_MODE=minimal python unified_server.py

# Standard mode (full football features)
VERVEQ_SERVER_MODE=standard python unified_server.py

# Full mode (multi-sport with all features)
VERVEQ_SERVER_MODE=full python unified_server.py
```

## 📋 Server Modes

### Minimal Mode
- **Purpose**: Basic quiz functionality with minimal dependencies
- **Features**: Simple quiz generation, basic health checks
- **API Endpoints**: `/api/quiz`, `/health`, `/`
- **Dependencies**: `fastapi`, `uvicorn` only
- **Use Case**: Development, testing, or environments with limited dependencies

### Standard Mode (Default)
- **Purpose**: Full football quiz platform
- **Features**: Advanced quiz generation, analytics, ELO system, survival mode, monitoring
- **API Endpoints**: All endpoints except multi-sport
- **Dependencies**: Full requirements.txt
- **Use Case**: Production football quiz platform

### Full Mode
- **Purpose**: Multi-sport platform supporting football, tennis, and more
- **Features**: Everything in Standard mode + multi-sport functionality
- **API Endpoints**: All endpoints including `/api/{sport}/*`
- **Dependencies**: Full requirements.txt + ML libraries
- **Use Case**: Multi-sport production platform

## ⚙️ Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `VERVEQ_SERVER_MODE` | `standard` | Server mode: `minimal`, `standard`, `full` |
| `VERVEQ_HOST` | `127.0.0.1` | Server host address |
| `VERVEQ_PORT` | `8008` | Server port |
| `VERVEQ_DEBUG` | `false` | Enable debug mode |
| `SECRET_KEY` | `None` | Secret key for sessions |
| `VERVEQ_DATA_ROOT` | `data` | Path to data directory |
| `VERVEQ_LOG_LEVEL` | `INFO` | Logging level |

### Feature Flags

| Variable | Default | Description |
|----------|---------|-------------|
| `VERVEQ_ENABLE_MULTI_SPORT` | `false` | Enable multi-sport functionality |
| `VERVEQ_ENABLE_ANALYTICS` | `true` | Enable user analytics |
| `VERVEQ_ENABLE_MONITORING` | `true` | Enable system monitoring |
| `VERVEQ_ENABLE_ELO_SYSTEM` | `true` | Enable competitive rating system |
| `VERVEQ_ENABLE_SURVIVAL_MODE` | `true` | Enable survival battle mode |
| `VERVEQ_ENABLE_ADMIN_DASHBOARD` | `true` | Enable admin interface |
| `VERVEQ_ENABLE_RATE_LIMITING` | `true` | Enable API rate limiting |
| `VERVEQ_ENABLE_CACHING` | `true` | Enable data caching |
| `VERVEQ_ENABLE_LEGACY_ENDPOINTS` | `true` | Enable backward compatibility |

### Configuration Files

You can also use configuration files instead of environment variables:

```bash
# JSON configuration
python unified_server.py --config verveq_config.json

# YAML configuration (requires PyYAML)
python unified_server.py --config verveq_config.yaml
```

Example configuration files are provided:
- `verveq_config.example.json`
- `verveq_config.example.yaml`

## 🌐 API Endpoints

### Core Endpoints (All Modes)
- `GET /` - Welcome message and server info
- `GET /health` - Health check with feature status
- `GET /docs` - Interactive API documentation

### Quiz Endpoints

#### Standard/Full Mode
- `GET /quiz` - Generate difficulty-based quiz
- `GET /competitions` - Get available competitions
- `GET /players` - Get player names with scope selection

#### Minimal Mode
- `GET /api/quiz` - Simple quiz generation
- `POST /api/feedback` - Submit quiz feedback
- `GET /api/all_players` - Get all player names

### Advanced Features (Standard/Full Mode)

#### Analytics
- `POST /api/analytics/record` - Record analytics event
- `GET /api/analytics/player/{player_id}` - Get player analytics
- `GET /api/analytics/overall` - Get overall analytics

#### ELO System
- `POST /api/elo/register` - Register player
- `GET /api/elo/player/{player_name}` - Get player stats
- `GET /api/elo/leaderboard` - Get leaderboard
- `POST /api/elo/match/create` - Create competitive match
- `POST /api/elo/match/finish` - Finish match and update ratings

#### Survival Mode
- `GET /survival/round` - Get survival round
- `POST /survival/validate` - Validate survival answer
- `GET /api/survival/loading-status` - Get loading status

#### Admin (when enabled)
- `GET /admin/dashboard` - Admin monitoring dashboard
- `GET /api/monitoring/metrics` - System metrics
- `GET /admin/rate-limit-stats` - Rate limiting statistics
- `GET /api/cache-stats` - Cache statistics
- `POST /api/cache-invalidate` - Invalidate cache

### Multi-Sport Endpoints (Full Mode Only)
- `GET /api/sports` - Get supported sports
- `GET /api/{sport}/competitions` - Get sport competitions
- `GET /api/{sport}/quiz` - Generate sport-specific quiz
- `GET /api/stats` - Platform-wide statistics

## 🔧 Development

### Running Tests
```bash
# Run quick functionality test
python quick_test.py

# Run all tests with pytest
pytest

# Run specific test categories
pytest tests/unit/                    # Unit tests only
pytest tests/integration/             # Integration tests only
pytest -m "unit"                      # All unit tests
pytest -m "integration"               # All integration tests
pytest -m "server_mode"               # Server mode tests
pytest -m "feature_flag"              # Feature flag tests
pytest -m "multi_sport"               # Multi-sport tests

# Run tests for specific server modes
VERVEQ_SERVER_MODE=minimal pytest tests/integration/test_server_modes.py -k "minimal"
VERVEQ_SERVER_MODE=standard pytest tests/integration/test_server_modes.py -k "standard"
VERVEQ_SERVER_MODE=full pytest tests/integration/test_server_modes.py -k "full"

# Run tests with coverage
pytest --cov=. --cov-report=html --cov-report=term-missing

# Run tests in parallel (faster)
pytest -n auto

# Run only fast tests (exclude slow tests)
pytest -m "not slow"
```

### Test Organization

The project uses a comprehensive pytest testing framework organized as follows:

```
tests/
├── conftest.py                 # Global fixtures and configuration
├── pytest.ini                 # Pytest configuration
├── unit/                       # Unit tests for individual components
│   ├── test_data_handlers.py
│   ├── test_quiz_generator.py
│   ├── test_elo_system.py
│   ├── test_analytics.py
│   ├── test_survival_mode.py
│   └── test_multi_sport.py
├── integration/                # Integration tests
│   ├── test_server_modes.py
│   ├── test_api_endpoints.py
│   └── test_feature_flags.py
├── fixtures/                   # Test data and fixtures
│   ├── mock_data.py
│   └── mock_factories.py
└── utils/                      # Test utilities
    └── test_helpers.py
```

### Test Markers

Tests are organized using pytest markers:

- `@pytest.mark.unit` - Unit tests for individual components
- `@pytest.mark.integration` - Integration tests for component interactions
- `@pytest.mark.api` - API endpoint tests
- `@pytest.mark.server_mode` - Tests for different server modes
- `@pytest.mark.feature_flag` - Tests for feature flag configurations
- `@pytest.mark.multi_sport` - Tests for multi-sport functionality
- `@pytest.mark.elo` - Tests for ELO rating system
- `@pytest.mark.survival` - Tests for survival mode
- `@pytest.mark.analytics` - Tests for analytics functionality
- `@pytest.mark.slow` - Tests that take longer to run
- `@pytest.mark.performance` - Performance and load tests

### CI/CD Integration

The project includes GitHub Actions workflows for automated testing:

- **Unit Tests**: Run on Python 3.9, 3.10, 3.11
- **Integration Tests**: Test all server modes and feature combinations
- **Security Scanning**: Bandit and Safety checks
- **Code Coverage**: Codecov integration
- **Performance Tests**: Benchmark critical functionality

### Debugging
```bash
# Enable debug mode
VERVEQ_DEBUG=true python unified_server.py

# Check configuration
python config.py

# Run tests with verbose output
pytest -v --tb=long

# Run specific test with debugging
pytest tests/unit/test_quiz_generator.py::TestQuizGenerator::test_generate_basic_quiz -v -s
```

## 🚦 Migration from Legacy Servers

The unified server is fully backward compatible with existing clients:

### From `main.py`
- All `/api/*` endpoints are preserved when `VERVEQ_ENABLE_LEGACY_ENDPOINTS=true`
- Same response formats and behavior
- Automatic fallback to minimal mode if dependencies are missing

### From `web_server.py`
- All endpoints are available in standard mode
- Same advanced features and functionality
- Identical API contracts

### From `multi_sport_web_server.py`
- All multi-sport endpoints available in full mode
- Same sport-specific routing and functionality
- Extensible architecture preserved

## 📊 Monitoring and Health

### Health Check Response
```json
{
  "status": "healthy",
  "message": "VerveQ API is running",
  "server_mode": "standard",
  "available_competitions": 10,
  "features": {
    "analytics": true,
    "monitoring": true,
    "elo_system": true,
    "survival_mode": true,
    "multi_sport": false
  }
}
```

### Metrics (when monitoring enabled)
- Request counts and response times
- Error rates and types
- Cache hit/miss ratios
- System resource usage
- Feature usage statistics

## 🛠️ Troubleshooting

### Common Issues

1. **Server won't start**
   ```bash
   # Check dependencies
   pip install -r requirements.txt
   
   # Try minimal mode
   VERVEQ_SERVER_MODE=minimal python unified_server.py
   ```

2. **Missing features**
   ```bash
   # Check feature flags
   python config.py
   
   # Enable specific features
   VERVEQ_ENABLE_ANALYTICS=true python unified_server.py
   ```

3. **Port conflicts**
   ```bash
   # Use different port
   VERVEQ_PORT=8080 python unified_server.py
   ```

### Logs and Debugging
- Set `VERVEQ_LOG_LEVEL=DEBUG` for detailed logging
- Check server startup messages for feature initialization status
- Use `/health` endpoint to verify feature availability

## 🔄 Deployment

### Production Configuration
```bash
# Recommended production settings
export VERVEQ_SERVER_MODE=standard
export VERVEQ_DEBUG=false
export VERVEQ_LOG_LEVEL=WARNING
export SECRET_KEY="your-secure-secret-key"
export VERVEQ_ENABLE_RATE_LIMITING=true
export VERVEQ_CACHE_SIZE=5000
```

### Docker Deployment
```dockerfile
FROM python:3.9-slim
COPY . /app
WORKDIR /app
RUN pip install -r requirements.txt
EXPOSE 8008
CMD ["python", "unified_server.py"]
```

### Load Balancing
The unified server is stateless and can be easily load balanced. Use sticky sessions if using the session middleware.

## 📈 Performance

### Optimization Tips
1. Enable caching: `VERVEQ_ENABLE_CACHING=true`
2. Tune cache size: `VERVEQ_CACHE_SIZE=5000`
3. Use appropriate server mode for your needs
4. Enable GZip compression (enabled by default)
5. Configure rate limiting based on your traffic

### Scaling
- Horizontal scaling: Run multiple instances behind a load balancer
- Vertical scaling: Increase cache size and system resources
- Database optimization: Consider migrating from JSON to a proper database for high-traffic scenarios

## 🤝 Contributing

When adding new features:
1. Add appropriate feature flags in `config.py`
2. Implement conditional initialization in `unified_server.py`
3. Add route registration functions
4. Update documentation and examples
5. Ensure backward compatibility

## 📝 License

This project maintains the same license as the original VerveQ project.
