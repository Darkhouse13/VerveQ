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
from routes.games import router as games_router
from routes.sports import router as sports_router
from routes.simple import router as simple_router
from routes.leaderboards import router as leaderboards_router
from routes.profile import router as profile_router
from routes.challenges import router as challenges_router

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
logging.basicConfig(level=logging.DEBUG)
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
# TEMPORARILY DISABLED: SlowAPI middleware was intercepting OPTIONS requests
# causing 400 errors. Re-enable after implementing proper OPTIONS handling.
# from slowapi.middleware import SlowAPIMiddleware
# app.add_middleware(SlowAPIMiddleware)

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
app.include_router(simple_router)
app.include_router(auth_router)
app.include_router(games_router)
app.include_router(sports_router)
app.include_router(leaderboards_router)
app.include_router(profile_router)
app.include_router(challenges_router)

@app.on_event("startup")
async def startup_event():
    """Initialize database and default data"""
    init_db()
    settings.print_config_summary()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host=settings.host, port=settings.port)