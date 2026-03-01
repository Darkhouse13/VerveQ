# VerveQ Platform v3.0.0 - Production-Ready Competitive Sports Gaming Platform

[![Deployment Ready](https://img.shields.io/badge/Deployment-Ready-brightgreen.svg)](docs/PM2_DEPLOYMENT_GUIDE.md)
[![PM2 Compatible](https://img.shields.io/badge/PM2-Compatible-blue.svg)](ecosystem.config.js)
[![Production Ready](https://img.shields.io/badge/Production-Ready-success.svg)](docs/DEPLOYMENT_CHECKLIST.md)
[![Health Monitoring](https://img.shields.io/badge/Health-Monitoring-green.svg)](#health-monitoring)

A comprehensive, production-ready competitive sports gaming platform with ELO rankings, global leaderboards, social features, and complete deployment infrastructure.

## 🚀 Features

### Core Gaming
- **Multi-sport Support**: Football, Tennis, and Basketball (more sports coming soon)
- **Quiz Mode**: Trivia questions with smart distractor generation
- **Survival Mode**: Guess players by initials with hint system
- **Real-time Scoring**: Performance tracking with time-based scoring
- **Session Management**: Prevents duplicate questions within a game
- **Achievement System**: Comprehensive achievement tracking and unlockables

### Quiz Enhancements
- **Smart Distractor Generation**: Context-aware wrong answers that challenge players
- **Session-based Tracking**: No duplicate questions in a 20-question game
- **Fallback Question Pool**: 15+ general questions for edge cases
- **Answer Deduplication**: Ensures unique answer options
- **Database-driven Questions**: Prepopulated question repository

### Competitive System
- **ELO Rating System**: Dynamic skill-based matchmaking with difficulty ratings
- **Global Leaderboards**: Daily, weekly, monthly, and all-time rankings
- **Sport-specific Rankings**: Separate leaderboards for each sport and game mode
- **Challenge System**: User-to-user challenges with pending management
- **Analytics System**: Comprehensive user performance tracking

### User Management
- **Anonymous Guest Accounts**: Instant play without registration
- **Optional Email Registration**: For account recovery and enhanced features
- **JWT-based Authentication**: Secure session management with auto-generation
- **Rich User Profiles**: Stats, achievements, and ranking history
- **Session Expiration**: Automatic cleanup of inactive sessions

### Deployment & Operations 🆕
- **PM2 Process Management**: Production-ready process management with auto-restart
- **Health Monitoring**: Comprehensive health check endpoints and system monitoring
- **Automated Deployment**: Complete deployment pipeline with rollback capability
- **Log Management**: Structured logging with rotation and monitoring
- **System Integration**: Nginx reverse proxy, SystemD services, and monitoring scripts

### Security & Infrastructure 🆕
- **Production Security**: Secure JWT configuration, CORS management, rate limiting
- **Environment Management**: Development, staging, and production configurations
- **Database Migration**: Automated database setup and migrations
- **Performance Monitoring**: Resource usage tracking and alerting
- **Cache Backend**: Optional Redis caching with in-memory fallback

### System Features
- **Rate Limiting**: API protection with configurable limits
- **CORS Support**: Secure cross-origin requests with environment-specific origins
- **Comprehensive Logging**: Request/response tracking with structured logs
- **Error Handling**: Graceful error recovery with fallbacks
- **Health Endpoints**: Multiple health check levels for monitoring integration

## 📁 Project Structure

```
verveq-platform/
├── ecosystem.config.js           # PM2 process configuration
├── .env.production              # Production environment template
├── setup_postgres.sql           # PostgreSQL database setup
├── docs/                        # All project documentation
├── backend/                     # FastAPI backend
│   ├── main.py                 # API entry point with middleware
│   ├── run.py                  # Development server
│   ├── requirements.txt        # Python dependencies
│   ├── requirements-dev.txt    # Development dependencies
│   ├── config/                 # Configuration management
│   │   └── settings.py        # Centralized settings with validation
│   ├── database/              # Database layer
│   │   ├── models.py          # SQLAlchemy models
│   │   ├── connection.py      # Database connection management
│   │   ├── migration_*.py     # Database migration scripts
│   │   └── fix_difficulty_values.py # Database maintenance
│   ├── routes/                # API endpoints
│   │   ├── auth.py           # Authentication with JWT
│   │   ├── quiz.py           # Quiz game endpoints
│   │   ├── games.py          # Game completion and scoring
│   │   ├── leaderboards.py   # Ranking system
│   │   ├── challenges.py     # Social challenges
│   │   ├── profile.py        # User profiles and stats
│   │   ├── achievements.py   # Achievement system
│   │   ├── sports.py         # Sports data and configuration
│   │   ├── survival/         # Survival game modes
│   │   │   ├── session.py    # Session-based survival
│   │   │   └── legacy.py     # Legacy survival endpoints
│   │   └── health.py         # 🆕 Health monitoring endpoints
│   ├── services/             # Business logic
│   │   ├── elo_service.py    # ELO calculations with difficulty
│   │   ├── analytics.py      # User analytics and tracking
│   │   ├── quiz_session.py   # Quiz session management
│   │   ├── survival_session.py # Survival session management
│   │   ├── leaderboard_service.py # Leaderboard calculations
│   │   ├── cache_backend.py  # Cache abstraction layer
│   │   ├── question_repository.py # Question database management
│   │   └── difficulty_feedback.py # Difficulty adjustment system
│   ├── auth/                 # Authentication
│   │   └── jwt_auth.py      # JWT implementation with security
│   └── sports/               # Sport implementations
│       ├── __init__.py      # Sport factory initialization
│       ├── simple_adapter.py # Sport data adaptation
│       ├── survival_engine.py # Survival game engine
│       └── survival_helpers.py # Survival utilities
├── frontend/                 # React Native app
│   ├── App.js               # Main app component
│   ├── package.json         # Node dependencies
│   ├── .env                 # Frontend configuration
│   └── src/
│       ├── components/      # React components
│       ├── config/
│       │   └── api.js      # API configuration with platform detection
│       ├── context/        # React contexts
│       ├── screens/        # App screens
│       └── utils/          # Utilities
├── scripts/                 # 🆕 Deployment and operations
│   ├── deploy.sh           # Automated deployment script
│   ├── monitor.sh          # System monitoring and health checks
│   ├── test_pm2_setup.sh   # PM2 setup testing
│   ├── setup_logging.sh    # Log infrastructure setup
│   └── setup_production.sh # Interactive production setup
├── nginx/                   # 🆕 Web server configuration
│   └── verveq.conf         # Production Nginx configuration
├── systemd/                 # 🆕 System service management
│   ├── verveq-backend.service  # Backend systemd service
│   └── verveq-frontend.service # Frontend systemd service
├── logrotate/              # 🆕 Log rotation configuration
│   └── verveq             # Log rotation rules
├── data/                   # Sports data
│   ├── quiz_data/         # Quiz questions database
│   └── survival_data/     # Survival game data
└── tests/                  # Comprehensive test suite
    ├── backend/           # Backend tests (unit, integration, performance)
    ├── frontend/          # Frontend component tests
    └── e2e/              # End-to-end tests
```

## 🏗️ Architecture

### Quiz Generation Pipeline
1. **Question Repository**: Database-driven question management with prepopulation
2. **Sport Adapters**: Unified interface for multiple sports data sources
3. **Session Management**: Prevents duplicate questions and tracks progress
4. **Difficulty System**: ELO-based difficulty adjustment and feedback
5. **Cache Layer**: Optional Redis caching with in-memory fallback

### Deployment Architecture
1. **PM2 Process Manager**: Multi-environment process management with health monitoring
2. **Health Monitoring**: Comprehensive health checks for load balancers and monitoring systems
3. **Log Management**: Structured logging with rotation and monitoring integration
4. **Database Migration**: Automated migration and setup scripts
5. **Reverse Proxy**: Production-ready Nginx configuration with SSL support

### Session Management
- **Quiz Sessions**: Database-backed session tracking with TTL
- **Survival Sessions**: Stateful game progression with hints and scoring
- **User Sessions**: JWT-based authentication with configurable expiration
- **Cache Sessions**: Optional Redis sessions with automatic fallback

## 🚀 Quick Start

### Development Setup

```bash
# Install PM2 globally
npm install -g pm2

# Install backend dependencies
cd backend
pip install -r requirements.txt
pip install -r requirements-dev.txt  # For development

# Install frontend dependencies
cd ../frontend
npm install

# Start with PM2 (recommended)
cd ..
pm2 start ecosystem.config.js --env development

# Or start services individually
cd backend && python run.py  # Terminal 1
cd frontend && npm start     # Terminal 2
```

### Production Deployment

```bash
# Automated production setup
sudo ./scripts/setup_production.sh

# Or manual deployment
./scripts/deploy.sh production

# Test PM2 setup (development)
./scripts/test_pm2_setup.sh

# Monitor system health
./scripts/monitor.sh check
```

### Health Monitoring

```bash
# Basic health check
curl http://localhost:8000/health

# Detailed system health
curl http://localhost:8000/health/detailed

# Readiness probe (Kubernetes-style)
curl http://localhost:8000/health/ready

# Liveness probe
curl http://localhost:8000/health/live

# System metrics (Prometheus-style)
curl http://localhost:8000/health/metrics
```

## 🌐 API Endpoints

### Health Monitoring 🆕
- `GET /health` - Basic health check for PM2 and load balancers
- `GET /health/detailed` - Comprehensive system health with dependencies
- `GET /health/ready` - Readiness probe for deployment verification
- `GET /health/live` - Liveness probe for process health
- `GET /health/metrics` - System metrics for monitoring integration

### Authentication
- `POST /auth/login` - Login/create user with JWT response
- `GET /auth/me` - Get current user info with stats

### Games
- `POST /{sport}/quiz/session` - Create quiz session with configuration
- `GET /{sport}/quiz/question?session_id={id}` - Get quiz question (no duplicates)
- `DELETE /{sport}/quiz/session/{session_id}` - End quiz session
- `POST /{sport}/quiz/check` - Check quiz answer with scoring
- `GET /{sport}/survival/initials` - Get survival initials with hints
- `POST /{sport}/survival/guess` - Submit survival guess with validation

### Sports
- `GET /` - API info with available sports and features
- `GET /sports` - List available sports with metadata
- `GET /sports/{sport}/theme` - Get sport theme configuration

### Leaderboards
- `GET /leaderboards/global` - Global rankings across all sports
- `GET /leaderboards/{sport}/{game_mode}` - Sport-specific rankings with pagination

### User Management
- `GET /profile/{user_id}` - Get user profile with comprehensive stats
- `GET /achievements` - Get available achievements
- `POST /achievements/unlock` - Unlock user achievement

### Challenges
- `GET /challenges/pending` - Get pending challenges with metadata
- `POST /challenges/create` - Create new challenge
- `POST /challenges/{challenge_id}/accept` - Accept challenge

### Sessions & Analytics
- `POST /session` - Create game session with tracking
- `GET /session/{session_id}/dashboard` - Get session statistics
- `POST /session/{session_id}/score` - Update session score with ELO calculation

## 🎯 Technology Stack

### Backend
- **FastAPI** - Modern Python web framework with async support
- **SQLAlchemy** - Database ORM with migration support
- **JWT** - Authentication with secure token management
- **SQLite/PostgreSQL** - Database with production migration support
- **slowapi** - Rate limiting with Redis backend support
- **python-dotenv** - Environment management with validation
- **psutil** - System monitoring and resource tracking 🆕

### Frontend
- **React Native** - Cross-platform mobile app
- **Expo** - Development platform with web support
- **React Navigation** - Navigation library with deep linking

### Deployment & Operations 🆕
- **PM2** - Production process management with monitoring
- **Nginx** - Reverse proxy with SSL termination and rate limiting
- **SystemD** - Service management and auto-startup
- **Logrotate** - Log rotation and management
- **Redis** - Optional caching and session storage

### Key Patterns
- **Factory Pattern** - Sport generator creation and data adaptation
- **Repository Pattern** - Database question management
- **Session Pattern** - Stateful game tracking with persistence
- **Strategy Pattern** - Multiple deployment and caching strategies
- **Health Check Pattern** - Multi-level health monitoring

## 🔧 Configuration

### Environment Setup

**IMPORTANT**: The application includes comprehensive environment management with validation and secure defaults.

```bash
# Development setup
cp .env.example .env
# Edit .env with your configuration

# Production setup
cp .env.production.example .env.production
# Configure production settings
```

### Environment Variables

#### Core Configuration
- `ENVIRONMENT`: development/staging/production (affects behavior)
- `HOST`: Server host address (default: 0.0.0.0)
- `PORT`: Server port (default: 8000)
- `DEBUG`: Enable debug mode (auto-detected by environment)
- `LOG_LEVEL`: Logging level (DEBUG/INFO/WARNING/ERROR)

#### Database Configuration
- `DATABASE_URL`: PostgreSQL connection (optional, uses SQLite if not set)
- `SQLITE_PATH`: SQLite database path (default: verveq_platform.db)

#### Security Configuration (Critical for Production)
- `JWT_SECRET_KEY`: **Required for production** - Auto-generated for development
  ```bash
  # Generate secure key:
  python3 -c "import secrets; print(secrets.token_urlsafe(32))"
  ```
- `JWT_EXPIRE_MINUTES`: Token expiration (default: 10080 - 7 days)
- `CORS_ORIGINS`: **Required for production** - Comma-separated allowed origins
- `CORS_ALLOW_CREDENTIALS`: Allow credentials in CORS (default: true)

#### Cache Configuration 🆕
- `CACHE_ENABLED`: Enable caching (default: false for development)
- `REDIS_URL`: Redis connection string (optional, falls back to in-memory)
- `CACHE_TTL`: Cache time-to-live in seconds (default: 3600)

#### Rate Limiting
- `RATE_LIMIT_ENABLED`: Enable rate limiting (default: true)
- `RATE_LIMIT_REQUESTS_PER_MINUTE`: Request limit per minute (default: 60)

#### Frontend Configuration
- `REACT_APP_API_URL`: API base URL with platform-specific defaults
  - Development: Auto-detects platform (Android: 10.0.2.2, iOS: localhost, etc.)
  - Production: `https://api.your-domain.com`

### Configuration Validation
The application automatically validates configuration on startup:
- ✅ Ensures required variables are set in production
- ✅ Generates secure JWT keys for development with warnings
- ✅ Validates CORS origins and database URLs
- ✅ Provides helpful error messages for missing configuration
- ✅ Environment-specific defaults and security checks

## 🏭 Production Deployment

### Prerequisites
- Python 3.8+ with pip
- Node.js 16+ with npm
- PostgreSQL 12+ (recommended) or SQLite (development)
- Nginx (for reverse proxy)
- Redis (optional, for caching)

### Deployment Steps

#### 1. Automated Setup (Recommended)
```bash
# Interactive production setup
sudo ./scripts/setup_production.sh

# Automated deployment
./scripts/deploy.sh production
```

#### 2. Manual Setup
```bash
# Install PM2
npm install -g pm2

# Setup database
psql -U postgres -f setup_postgres.sql

# Configure environment
cp .env.production .env.production.local
# Edit .env.production.local with your settings

# Install dependencies and deploy
cd backend && pip install -r requirements.txt
cd ../frontend && npm install
cd .. && pm2 start ecosystem.config.js --env production

# Setup web server
sudo cp nginx/verveq.conf /etc/nginx/sites-available/
sudo ln -s /etc/nginx/sites-available/verveq.conf /etc/nginx/sites-enabled/
sudo systemctl reload nginx

# Setup logging
sudo ./scripts/setup_logging.sh
```

#### 3. SSL/TLS Setup
```bash
# Using Let's Encrypt (recommended)
sudo certbot --nginx -d api.your-domain.com -d your-domain.com

# Update nginx configuration with your domain
sudo nano /etc/nginx/sites-enabled/verveq.conf
```

### Health Checks & Monitoring

#### Built-in Monitoring
```bash
# Run health checks
./scripts/monitor.sh check

# Generate monitoring report
./scripts/monitor.sh report

# View recent alerts
./scripts/monitor.sh alerts

# Analyze logs
/usr/local/bin/verveq-log-analyze  # (created by setup_logging.sh)
```

#### PM2 Monitoring
```bash
# View process status
pm2 status

# Monitor resources
pm2 monit

# View logs
pm2 logs

# Restart services
pm2 restart ecosystem.config.js --env production
```

## 📊 Performance Metrics

### Observed Performance (Production Testing)
- **Memory Usage**: ~75MB per backend process (well within 500MB limit)
- **Response Time**: 30-40ms for health checks, <100ms for API calls
- **Startup Time**: 3-5 seconds for full application stack
- **CPU Usage**: <2% idle, efficient under load
- **Database**: SQLite for development, PostgreSQL recommended for production

### Scalability
- **Process Management**: PM2 supports clustering and load balancing
- **Database**: PostgreSQL connection pooling and optimization
- **Caching**: Redis backend for session storage and API caching
- **Load Balancing**: Nginx configuration ready for multiple backend instances

## 🔍 Operations & Monitoring

### Daily Operations
```bash
# Check system health
curl http://localhost:8000/health/detailed

# View application logs
pm2 logs verveq-backend --lines 50

# Monitor resource usage
pm2 monit

# Check database status (PostgreSQL)
pg_isready -h localhost -p 5432
```

### Troubleshooting
```bash
# Restart unresponsive service
pm2 restart verveq-backend

# Check configuration
cd backend && python3 -c "from config.settings import settings; settings.print_config_summary()"

# Test database connectivity
cd backend && python3 -c "from database.connection import get_db; next(get_db())"

# View error logs
tail -f logs/verveq-backend-error.log

# Run deployment tests
./scripts/test_pm2_setup.sh
```

### Log Management
- **Application Logs**: `logs/verveq-*.log`
- **System Logs**: `/var/log/verveq/` (created by setup_logging.sh)
- **Nginx Logs**: `/var/log/nginx/verveq-*.log`
- **Log Rotation**: Automatic via logrotate configuration

## 📈 Current Status

### ✅ Production Ready Features
- **Core Platform**: Quiz and survival games with comprehensive sports support
- **Authentication System**: JWT-based with guest accounts and email registration
- **Database Layer**: SQLAlchemy models with migration support
- **API Infrastructure**: FastAPI with comprehensive validation and error handling
- **Frontend Application**: React Native with cross-platform support
- **Deployment Infrastructure**: Complete PM2-based deployment system
- **Health Monitoring**: Multi-level health checks and system monitoring
- **Security Configuration**: Production-ready JWT, CORS, and rate limiting
- **Log Management**: Structured logging with rotation and monitoring
- **Process Management**: PM2 with auto-restart and resource limits
- **Cache Backend**: Optional Redis with in-memory fallback
- **Achievement System**: Comprehensive achievement tracking and unlocking
- **Performance Optimization**: ELO-based difficulty adjustment and caching

### 🔄 Advanced Features (Future Enhancements)
- **Horizontal Scaling**: Kubernetes deployment manifests
- **Real-time Features**: WebSocket support for live challenges
- **Advanced Monitoring**: Prometheus metrics and Grafana dashboards
- **CI/CD Pipeline**: Automated testing and deployment
- **Internationalization**: Multi-language support
- **Advanced Analytics**: Enhanced player statistics and insights

## 🛠️ Development

### Running Tests
```bash
# All tests with coverage
./run_tests.sh --coverage --lint

# Backend tests only
./run_tests.sh --backend-only

# Frontend tests only  
./run_tests.sh --frontend-only

# PM2 setup testing
./scripts/test_pm2_setup.sh
```

### Contributing
1. Fork the repository
2. Create a feature branch
3. Make your changes with tests
4. Run the test suite
5. Submit a pull request

See [CONTRIBUTING.md](docs/CONTRIBUTING.md) for detailed guidelines.

## 📚 Documentation

- **[PM2 Deployment Guide](docs/PM2_DEPLOYMENT_GUIDE.md)**: Complete deployment documentation
- **[Deployment Checklist](docs/DEPLOYMENT_CHECKLIST.md)**: Production readiness checklist
- **[Code of Conduct](docs/CODE_OF_CONDUCT.md)**: Community guidelines
- **[Security Policy](docs/SECURITY.md)**: Security practices and reporting
- **[Contributing Guide](docs/CONTRIBUTING.md)**: Development and contribution guidelines
- **[API Routes](docs/API_ROUTES.md)**: Complete API endpoint reference

## 🆘 Support & Troubleshooting

### Common Issues

1. **PM2 processes won't start**
   - Check ecosystem configuration: `pm2 ecosystem validate ecosystem.config.js`
   - View logs: `pm2 logs verveq-backend`
   - Restart PM2 daemon: `pm2 kill && pm2 start ecosystem.config.js`

2. **Health checks failing**
   - Test directly: `curl -v http://localhost:8000/health`
   - Check backend logs: `tail -f logs/verveq-backend-out.log`
   - Verify database: `python3 -c "from backend.database.connection import get_db; next(get_db())"`

3. **Database connection errors**
   - Verify database URL format in `.env`
   - Check PostgreSQL service: `sudo systemctl status postgresql`
   - Run migrations: `cd backend && python3 database/migration_*.py`

4. **Frontend can't connect to API**
   - Check API URL in `frontend/.env`
   - Verify CORS origins in backend `.env`
   - Test API accessibility: `curl http://localhost:8000/`

### Getting Help
- **Documentation**: Check specialized guides in the repository
- **Logs**: Review application and system logs
- **Health Checks**: Use built-in monitoring endpoints
- **Community**: Create issues on GitHub for support

---

## 🏆 Conclusion

VerveQ Platform v3.0.0 represents a **production-ready competitive sports gaming platform** with comprehensive deployment infrastructure, monitoring capabilities, and security features. The platform successfully balances performance, maintainability, and operational excellence.

**Ready for production deployment with confidence!** 🚀

---

*Last updated: August 2025 - v3.0.0 with complete PM2 deployment infrastructure*