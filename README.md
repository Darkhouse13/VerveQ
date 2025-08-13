# VerveQ Platform v1.0 - Competitive Sports Gaming Platform

A comprehensive competitive sports gaming platform with ELO rankings, global leaderboards, and social features.

## 🚀 Features

### Core Gaming
- **Multi-sport support**: Football and Tennis (more sports coming soon)
- **Quiz Mode**: Trivia questions with smart distractor generation
- **Survival Mode**: Guess players by initials
- **Real-time scoring** with performance tracking
- **Session Management**: Prevents duplicate questions within a game

### Quiz Enhancements
- **Smart Distractor Generation**: Context-aware wrong answers that challenge players
- **Session-based Tracking**: No duplicate questions in a 20-question game
- **Fallback Question Pool**: 15+ general questions for edge cases
- **Answer Deduplication**: Ensures unique answer options

### Competitive System
- **ELO Rating System**: Dynamic skill-based matchmaking
- **Global Leaderboards**: Daily, weekly, monthly, and all-time rankings
- **Sport-specific Rankings**: Separate leaderboards for each sport
- **Achievement System**: Unlockable rewards and badges

### User Management
- **Anonymous Guest Accounts**: Instant play without registration
- **Optional Email Registration**: For account recovery
- **JWT-based Authentication**: Secure session management
- **Rich User Profiles**: Stats, achievements, and ranking history
- **Session Expiration**: Automatic cleanup of inactive sessions

### Social Features
- **Friend Challenges**: Challenge other players
- **Score Sharing**: Share achievements on social media
- **Pending Challenge Management**: Track active challenges

### System Features
- **Rate Limiting**: API protection with configurable limits
- **CORS Support**: Secure cross-origin requests
- **Comprehensive Logging**: Request/response tracking
- **Error Handling**: Graceful error recovery

## 📁 Project Structure

```
verveq-platform/
├── backend/                    # FastAPI backend
│   ├── main.py                # API entry point
│   ├── run.py                 # Development server
│   ├── requirements.txt       # Python dependencies
│   ├── requirements-dev.txt   # Development dependencies
│   ├── INSTALL.md            # Detailed installation guide
│   ├── config/              # Configuration management
│   │   ├── __init__.py
│   │   └── settings.py      # Centralized settings
│   ├── database/            # Database layer
│   │   ├── models.py        # SQLAlchemy models
│   │   └── connection.py    # Database connection
│   ├── routes/              # API endpoints
│   │   ├── auth.py          # Authentication
│   │   ├── games.py         # Quiz and survival games
│   │   ├── leaderboards.py  # Ranking system
│   │   ├── challenges.py    # Social challenges
│   │   ├── profile.py       # User profiles
│   │   ├── sports.py        # Sports data
│   │   └── simple.py        # Session management
│   ├── services/            # Business logic
│   │   ├── elo_system.py    # ELO calculations
│   │   ├── analytics.py     # User analytics
│   │   └── quiz_session.py  # Quiz session management
│   ├── auth/                # Authentication
│   │   └── jwt_auth.py      # JWT implementation
│   └── sports/              # Sport implementations
│       ├── base.py          # Base classes & factory
│       ├── quiz_generator.py # Quiz coordination
│       ├── sport_data.py    # Data models
│       ├── utils.py         # Utility functions
│       ├── distractor_generator.py # Smart distractors
│       ├── fallback_questions.py   # Fallback pool
│       ├── survival_engine.py      # Survival mode
│       ├── survival_helpers.py     # Survival utilities
│       ├── football_config.py      # Football config
│       ├── football_generator.py   # Football quiz
│       ├── football_questions.py   # Football questions
│       └── tennis.py        # Tennis implementation
├── frontend/                # React Native app
│   ├── App.js              # Main app component
│   ├── package.json        # Node dependencies
│   └── src/
│       ├── components/     # React components
│       │   └── ErrorBoundary.js # Error handling
│       ├── config/         # Configuration
│       │   └── api.js      # API configuration
│       ├── context/        # React contexts
│       │   └── SessionContext.js # Session state
│       ├── screens/        # App screens
│       └── utils/          # Utilities
│           └── navigationUtils.js # Navigation
├── data/                   # Sports data
│   ├── quiz_data/         # Quiz questions
│   └── survival_data/     # Survival game data
└── tests/                   # Tests for backend and frontend
```

## 🏗️ Architecture

### Quiz Generation Pipeline
1. **SportDataFactory**: Dynamically creates sport-specific generators
2. **QuizCoordinator**: Manages question generation and prevents duplicates
3. **QuestionGenerators**: Sport-specific question creation
4. **SmartDistractorGenerator**: Creates context-aware wrong answers
5. **FallbackQuestions**: Pool of general questions for edge cases

### Session Management
- **QuizSessionManager**: Tracks questions per game session
- **In-memory storage**: Fast session tracking with TTL
- **Automatic cleanup**: Expired sessions removed periodically
- **Session endpoints**: Create, track, and end game sessions

### Data Flow
```
User Request → API Route → Session Check → Quiz Coordinator 
    → Sport Generator → Smart Distractors → Response
```

## 🏗️ Quick Start

### Backend Setup

```bash
# Install dependencies
cd backend
pip install -r requirements.txt

# Run with SQLite (development)
python run.py

# Or with PostgreSQL (production)
export DATABASE_URL="postgresql://user:pass@localhost:5432/verveq_db"
python run.py
```

### Frontend Setup

```bash
cd frontend
npm install
npm start
```

## 🌐 API Endpoints

### Authentication
- `POST /auth/login` - Login/create user
- `GET /auth/me` - Get current user info

### Games
- `POST /{sport}/quiz/session` - Create quiz session
- `GET /{sport}/quiz/question?session_id={id}` - Get quiz question
- `DELETE /{sport}/quiz/session/{session_id}` - End quiz session
- `POST /{sport}/quiz/check` - Check quiz answer
- `GET /{sport}/survival/initials` - Get survival initials
- `POST /{sport}/survival/guess` - Submit survival guess

### Sports
- `GET /sports` - List available sports
- `GET /sports/{sport}/theme` - Get sport theme configuration

### Leaderboards
- `GET /leaderboards/global` - Global rankings
- `GET /leaderboards/{sport}/{game_mode}` - Sport-specific rankings

### User Profiles
- `GET /profile/{user_id}` - Get user profile with stats

### Challenges
- `GET /challenges/pending` - Get pending challenges

### Sessions
- `POST /session` - Create game session
- `GET /session/{session_id}/dashboard` - Get session statistics
- `POST /session/{session_id}/score` - Update session score

### System
- `GET /` - API info and available sports
- `POST /api/guest-session` - Create guest session
- `GET /debug/cors` - CORS debugging endpoint

## 🎯 Technology Stack

### Backend
- **FastAPI** - Modern Python web framework
- **SQLAlchemy** - Database ORM
- **JWT** - Authentication
- **SQLite/PostgreSQL** - Database
- **slowapi** - Rate limiting
- **python-dotenv** - Environment management

### Frontend
- **React Native** - Cross-platform mobile app
- **Expo** - Development platform
- **React Navigation** - Navigation library

### Key Patterns
- **Factory Pattern** - Sport generator creation
- **Coordinator Pattern** - Quiz question management
- **Session Pattern** - Stateful game tracking
- **Strategy Pattern** - Smart distractor generation

## 🔧 Configuration

### Environment Setup

**IMPORTANT**: Copy `.env.example` to `.env` and configure your environment variables before running the application.

```bash
# Copy environment template
cp .env.example .env

# Edit configuration
nano .env  # or your preferred editor
```

### Required Environment Variables

#### Backend Configuration
- `ENVIRONMENT`: Set to "development", "staging", or "production"
- `HOST`: Server host address (default: 0.0.0.0)
- `PORT`: Server port (default: 8000)
- `DEBUG`: Enable debug mode (default: true for development)
- `LOG_LEVEL`: Logging level (default: INFO)

#### Database Configuration
- `DATABASE_URL`: PostgreSQL connection string (optional, uses SQLite if not set)
- `SQLITE_PATH`: SQLite database path (default: verveq_platform.db)

#### Security Configuration (CRITICAL)
- `JWT_SECRET_KEY`: **REQUIRED for production** - JWT signing key
  ```bash
  # Generate secure key:
  python -c "import secrets; print(secrets.token_urlsafe(32))"
  ```
- `JWT_EXPIRE_MINUTES`: Token expiration time (default: 10080 - 7 days)
- `CORS_ORIGINS`: **REQUIRED for production** - Comma-separated allowed origins
  ```bash
  # Example:
  CORS_ORIGINS=https://yourapp.com,https://www.yourapp.com
  ```
- `CORS_ALLOW_CREDENTIALS`: Allow credentials in CORS (default: true)

#### API Configuration
- `API_TITLE`: API title (default: VerveQ Platform API)
- `API_VERSION`: API version (default: 1.0.0)
- `API_DESCRIPTION`: API description

#### Rate Limiting
- `RATE_LIMIT_ENABLED`: Enable rate limiting (default: true)
- `RATE_LIMIT_REQUESTS_PER_MINUTE`: Request limit per minute (default: 60)

#### Frontend Configuration
- `REACT_APP_API_URL`: API base URL for React Native app
  - Development: `http://YOUR_LOCAL_IP:8000`
  - Production: `https://your-api-domain.com`

### Environment-Specific Setup

#### Development Environment
```bash
ENVIRONMENT=development
DEBUG=true
LOG_LEVEL=DEBUG
# Auto-generates secure JWT key with warning
# Uses development CORS origins
```

#### Production Environment
```bash
ENVIRONMENT=production
DEBUG=false
LOG_LEVEL=INFO
JWT_SECRET_KEY=your-secure-32-character-key
CORS_ORIGINS=https://yourapp.com,https://www.yourapp.com
DATABASE_URL=postgresql://user:pass@localhost:5432/verveq_db
REACT_APP_API_URL=https://api.yourapp.com
RATE_LIMIT_ENABLED=true
RATE_LIMIT_REQUESTS_PER_MINUTE=60
```

### Database
- **Development**: SQLite (auto-created)
- **Production**: PostgreSQL recommended

### Configuration Validation
The application automatically validates configuration on startup:
- ✅ Ensures required variables are set in production
- ✅ Generates secure JWT keys for development
- ✅ Validates CORS origins and database URLs
- ✅ Provides helpful error messages for missing configuration

## 📊 Current Status

✅ **Core Features**: Quiz and survival games working  
✅ **Multi-sport**: Football and tennis implemented  
✅ **Authentication**: Guest and email registration with secure JWT  
✅ **Leaderboards**: Global and sport-specific rankings  
✅ **API**: RESTful endpoints with validation and rate limiting  
✅ **Frontend**: React Native app with error boundaries  
✅ **Configuration**: Environment-based configuration management  
✅ **Security**: Secure CORS, JWT secrets, and input validation  
✅ **Quiz Enhancements**: Session management, smart distractors, no duplicates  
✅ **Logging**: Comprehensive request/response logging  
✅ **Error Handling**: Graceful error recovery with fallbacks  

## 🐛 Troubleshooting

See [INSTALL.md](backend/INSTALL.md) for detailed troubleshooting guides including:
- Common installation issues
- Database connection problems
- CORS configuration
- Frontend connectivity issues

## 🚀 Next Steps

1. **Additional Sports**: Implement Basketball, Baseball, Hockey
2. **Testing**: Expand test coverage with pytest
3. **Real-time Features**: WebSocket support for live challenges
4. **Analytics**: Enhanced player statistics and insights
5. **Achievements**: Implement badge and reward system
6. **Multiplayer**: Real-time head-to-head competitions
7. **Deployment**: CI/CD pipeline setup
8. **Monitoring**: Add APM and error tracking
9. **Caching**: Redis integration for performance
10. **Internationalization**: Multi-language support