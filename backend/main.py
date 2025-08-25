"""
VerveQ Platform API v3.0 - Main application file (CLAUDE.md compliant)
Simplified orchestrator under 300 lines per CLAUDE.md guidelines
"""
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
import time
import logging

# Configuration management
from config.settings import settings

# Database initialization
from database.connection import init_db

# Route modules (following CLAUDE.md modular structure)
from routes.auth import router as auth_router
from routes.quiz import router as quiz_router
from routes.survival.session import router as survival_session_router
from routes.survival.legacy import router as survival_legacy_router
from routes.sports import router as sports_router
from routes.simple import router as simple_router
from routes.leaderboards import router as leaderboards_router
from routes.profile import router as profile_router
from routes.challenges import router as challenges_router
from routes.achievements import router as achievements_router
from routes.games import router as games_router
from routes.health import router as health_router

# Create rate limiter instance
limiter = Limiter(key_func=get_remote_address)

# Create FastAPI app with configuration
app = FastAPI(
    title=settings.api_title,
    version=settings.api_version,
    description=settings.api_description,
    debug=settings.debug
)

# Configure logging
logging.basicConfig(level=getattr(logging, settings.log_level.upper()))
logger = logging.getLogger(__name__)

# Add comprehensive request logging middleware for debugging
# CORS middleware with secure configuration (MUST be the first middleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=settings.cors_allow_credentials,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# Add rate limiter middleware (AFTER CORS to allow OPTIONS preflight)
from slowapi.middleware import SlowAPIMiddleware
app.add_middleware(SlowAPIMiddleware)

# Add middleware to skip OPTIONS for rate limiting (prevents 400 errors)
@app.middleware("http")
async def skip_options_for_rate_limiting(request: Request, call_next):
    if request.method == "OPTIONS":
        # Initialize empty state for OPTIONS to prevent rate limiting errors
        request.state.view_rate_limit = None
    response = await call_next(request)
    return response

# Add comprehensive request logging middleware for debugging
@app.middleware("http")
async def debug_request_middleware(request: Request, call_next):
    """Debug middleware to log all requests and responses"""
    start_time = time.time()
    
    # Log incoming request details
    logger.info(f"🔍 REQUEST: {request.method} {request.url}")
    logger.info(f"   Headers: {dict(request.headers)}")
    logger.info(f"   Client: {request.client}")
    
    # Special handling for OPTIONS requests
    if request.method == "OPTIONS":
        logger.info("🚨 OPTIONS REQUEST DETECTED")
        logger.info(f"   Origin: {request.headers.get('origin', 'NOT_SET')}")
        logger.info(f"   Access-Control-Request-Method: {request.headers.get('access-control-request-method', 'NOT_SET')}")
        logger.info(f"   Access-Control-Request-Headers: {request.headers.get('access-control-request-headers', 'NOT_SET')}")
    
    try:
        # Process request
        response = await call_next(request)
        
        # Log response details
        process_time = time.time() - start_time
        logger.info(f"✅ RESPONSE: {request.method} {request.url} - Status: {response.status_code} - Time: {process_time:.4f}s")
        
        # Log response headers for OPTIONS requests
        if request.method == "OPTIONS":
            logger.info("🔄 OPTIONS RESPONSE HEADERS:")
            for header, value in response.headers.items():
                if header.lower().startswith('access-control'):
                    logger.info(f"   {header}: {value}")
        
        return response
        
    except Exception as e:
        process_time = time.time() - start_time
        logger.error(f"❌ ERROR: {request.method} {request.url} - Error: {str(e)} - Time: {process_time:.4f}s")
        raise

# Add rate limit exceeded handler
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Configure limiter state
app.state.limiter = limiter

# Include route modules
app.include_router(health_router)
app.include_router(simple_router)
app.include_router(auth_router)
app.include_router(quiz_router)
# Survival routers: session-based with prefix, legacy without prefix
app.include_router(survival_session_router, prefix="/survival", tags=["survival"])
app.include_router(survival_legacy_router, tags=["survival"])
app.include_router(sports_router)
app.include_router(leaderboards_router)
app.include_router(profile_router)
app.include_router(challenges_router)
app.include_router(achievements_router)
app.include_router(games_router)

@app.on_event("startup")
async def startup_event():
    """Initialize database and default data"""
    init_db()
    settings.print_config_summary()
    
    # Print connection information for development
    print("\n🌐 VerveQ Platform API Server")
    print("=" * 40)
    print(f"🚀 Server starting on: http://{settings.host}:{settings.port}")
    print(f"📚 API Documentation: http://{settings.host}:{settings.port}/docs")
    print(f"🔄 Health Check: http://{settings.host}:{settings.port}/")
    
    # Show network access information
    import socket
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        local_ip = s.getsockname()[0]
        s.close()
        
        if local_ip and local_ip != "127.0.0.1":
            print(f"\n📱 Mobile Development URLs:")
            print(f"   Android Emulator: http://10.0.2.2:{settings.port}")
            print(f"   iOS Simulator: http://localhost:{settings.port}")
            print(f"   Physical Device: http://{local_ip}:{settings.port}")
            print(f"   Network Access: http://{local_ip}:{settings.port}")
            
            print(f"\n🧪 Test Endpoints:")
            print(f"   curl http://{local_ip}:{settings.port}/")
            print(f"   curl http://{local_ip}:{settings.port}/football/survival/initials")
    except Exception:
        print(f"\n📱 Local Development: http://localhost:{settings.port}")
    
    print(f"\n✅ Server ready for connections!")
    print("=" * 40)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host=settings.host, port=settings.port)