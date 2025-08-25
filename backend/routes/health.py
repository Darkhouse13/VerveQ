"""
VerveQ Platform Health Check Endpoints
Provides comprehensive health monitoring for PM2 and external monitoring
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import text
from sqlalchemy.exc import OperationalError
from datetime import datetime, timedelta
import psutil
import os
import redis
import logging
import time

from database.connection import get_db
from database.models import User
from config.settings import settings

router = APIRouter(prefix="/health", tags=["health"])
logger = logging.getLogger(__name__)

@router.get("/")
async def health_check():
    """
    Basic health check endpoint for PM2 and load balancers
    Returns simple OK status for quick health verification
    """
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "service": "verveq-backend",
        "version": settings.api_version
    }

@router.get("/detailed")
async def detailed_health_check(db: Session = Depends(get_db)):
    """
    Comprehensive health check with service dependencies
    Checks database, cache, and system resources
    """
    health_data = {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "service": "verveq-backend",
        "version": settings.api_version,
        "environment": settings.environment,
        "checks": {}
    }
    
    overall_healthy = True
    
    # Database health check
    try:
        # Simple database connectivity test
        db.execute(text("SELECT 1"))
        
        # Check if we can query users table
        user_count = db.query(User).count()
        
        health_data["checks"]["database"] = {
            "status": "healthy",
            "type": "PostgreSQL" if settings.database_url else "SQLite",
            "user_count": user_count,
            "connection": "active"
        }
    except Exception as e:
        logger.error(f"Database health check failed: {e}")
        health_data["checks"]["database"] = {
            "status": "unhealthy",
            "error": str(e)
        }
        overall_healthy = False
    
    # Cache health check (Redis)
    if hasattr(settings, 'redis_url') and settings.redis_url:
        try:
            # Try to connect to Redis
            r = redis.from_url(settings.redis_url)
            r.ping()
            
            health_data["checks"]["cache"] = {
                "status": "healthy",
                "type": "Redis",
                "connection": "active"
            }
        except Exception as e:
            logger.warning(f"Redis health check failed: {e}")
            health_data["checks"]["cache"] = {
                "status": "degraded",
                "type": "Redis",
                "error": str(e),
                "fallback": "in-memory cache active"
            }
            # Redis failure is not critical - we have fallback
    else:
        health_data["checks"]["cache"] = {
            "status": "healthy",
            "type": "in-memory",
            "connection": "active"
        }
    
    # System resource check
    try:
        cpu_percent = psutil.cpu_percent(interval=1)
        memory = psutil.virtual_memory()
        disk = psutil.disk_usage('/')
        
        health_data["checks"]["system"] = {
            "status": "healthy",
            "cpu_percent": cpu_percent,
            "memory_percent": memory.percent,
            "disk_percent": (disk.used / disk.total) * 100,
            "uptime_seconds": time.time() - psutil.boot_time()
        }
        
        # Mark as unhealthy if resources are critically low
        if cpu_percent > 90 or memory.percent > 90 or (disk.used / disk.total) > 0.95:
            health_data["checks"]["system"]["status"] = "degraded"
            health_data["checks"]["system"]["warning"] = "High resource usage detected"
            
    except Exception as e:
        logger.error(f"System health check failed: {e}")
        health_data["checks"]["system"] = {
            "status": "unknown",
            "error": str(e)
        }
    
    # API responsiveness check
    try:
        start_time = time.time()
        # Perform a simple database query to test full stack
        db.execute(text("SELECT COUNT(*) FROM users"))
        response_time = (time.time() - start_time) * 1000  # Convert to ms
        
        health_data["checks"]["api"] = {
            "status": "healthy" if response_time < 1000 else "degraded",
            "response_time_ms": round(response_time, 2),
            "database_responsive": True
        }
        
        if response_time > 5000:  # 5 seconds is definitely unhealthy
            overall_healthy = False
            
    except Exception as e:
        logger.error(f"API health check failed: {e}")
        health_data["checks"]["api"] = {
            "status": "unhealthy",
            "error": str(e)
        }
        overall_healthy = False
    
    # Update overall status
    health_data["status"] = "healthy" if overall_healthy else "unhealthy"
    
    # Return appropriate HTTP status
    if not overall_healthy:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=health_data
        )
    
    return health_data

@router.get("/ready")
async def readiness_check(db: Session = Depends(get_db)):
    """
    Kubernetes-style readiness check
    Returns 200 if service is ready to handle requests
    """
    try:
        # Check database connectivity
        db.execute(text("SELECT 1"))
        
        # Check if essential tables exist
        essential_tables = ['users', 'game_sessions', 'leaderboards', 'user_ratings']
        existing_tables = []
        missing_tables = []

        try:
            # Detect database type from connection URL
            db_url = str(db.bind.url)
            
            if 'sqlite' in db_url.lower():
                # SQLite: Query sqlite_master
                result = db.execute(text(
                    "SELECT name FROM sqlite_master "
                    "WHERE type='table' AND name IN :tables"
                ), {"tables": tuple(essential_tables)})
                existing_tables = [row[0] for row in result]
            else:
                # PostgreSQL/Others: Use information_schema
                result = db.execute(text(
                    "SELECT table_name FROM information_schema.tables "
                    "WHERE table_schema = 'public' AND table_name IN :tables"
                ), {"tables": tuple(essential_tables)})
                existing_tables = [row[0] for row in result]
            
            # Identify missing tables
            missing_tables = [t for t in essential_tables if t not in existing_tables]
            table_count = len(existing_tables)
            
        except OperationalError as e:
            logger.error(f"Database query error while checking tables: {e}")
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail={
                    "status": "not_ready",
                    "reason": "database_query_failed",
                    "error": str(e)
                }
            )
        except Exception as e:
            logger.error(f"Unexpected error checking tables: {e}")
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail={
                    "status": "not_ready",
                    "reason": "table_check_error",
                    "error": str(e)
                }
            )

        if missing_tables:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail={
                    "status": "not_ready",
                    "reason": "database_tables_missing",
                    "missing_tables": missing_tables,
                    "existing_tables": existing_tables
                }
            )
        
        return {
            "status": "ready",
            "timestamp": datetime.utcnow().isoformat(),
            "database": "connected",
            "tables": {
                "count": table_count,
                "essential": len(essential_tables),
                "status": "all_present"
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Readiness check failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "status": "not_ready", 
                "reason": "database_connection_failed",
                "error": str(e)
            }
        )

@router.get("/live")
async def liveness_check():
    """
    Kubernetes-style liveness check
    Returns 200 if the service is alive (basic process health)
    """
    # Calculate process uptime
    try:
        uptime_seconds = time.time() - psutil.Process().create_time()
    except (AttributeError, OSError, Exception):
        uptime_seconds = None
    
    return {
        "status": "alive",
        "timestamp": datetime.utcnow().isoformat(),
        "pid": os.getpid(),
        "uptime_seconds": uptime_seconds
    }

@router.get("/metrics")
async def metrics_endpoint():
    """
    Prometheus-style metrics endpoint for monitoring
    Returns key metrics in a structured format
    """
    try:
        # Get system metrics
        cpu_percent = psutil.cpu_percent()
        memory = psutil.virtual_memory()
        
        # Get process metrics with defensive error handling
        process = psutil.Process()

        # Initialize metrics with defaults
        metrics = {
            "system_cpu_percent": cpu_percent,
            "system_memory_percent": memory.percent,
            "system_memory_used_bytes": memory.used,
            "system_memory_total_bytes": memory.total,
            "process_cpu_percent": 0.0,
            "process_memory_bytes": 0,
            "process_threads": 0,
            "process_connections": 0,
            "process_uptime_seconds": 0.0
        }

        # Process CPU percent with interval for meaningful value
        try:
            metrics["process_cpu_percent"] = process.cpu_percent(interval=0.1)
        except (psutil.AccessDenied, psutil.NoSuchProcess, AttributeError) as e:
            logger.debug(f"Could not get process CPU percent: {e}")
            # Keep default value of 0.0

        # Process memory info
        try:
            metrics["process_memory_bytes"] = process.memory_info().rss
        except (psutil.AccessDenied, psutil.NoSuchProcess, AttributeError) as e:
            logger.debug(f"Could not get process memory info: {e}")
            # Keep default value of 0

        # Process thread count
        try:
            metrics["process_threads"] = process.num_threads()
        except (psutil.AccessDenied, psutil.NoSuchProcess, AttributeError) as e:
            logger.debug(f"Could not get process thread count: {e}")
            # Keep default value of 0

        # Process connections (often requires elevated privileges)
        try:
            metrics["process_connections"] = len(process.connections())
        except (psutil.AccessDenied, psutil.NoSuchProcess, AttributeError) as e:
            logger.debug(f"Could not get process connections: {e}")
            # Keep default value of 0

        # Process uptime
        try:
            metrics["process_uptime_seconds"] = time.time() - process.create_time()
        except (psutil.AccessDenied, psutil.NoSuchProcess, AttributeError) as e:
            logger.debug(f"Could not get process uptime: {e}")
            # Keep default value of 0.0

        return {
            "timestamp": datetime.utcnow().isoformat(),
            "metrics": metrics
        }
    except Exception as e:
        logger.error(f"Metrics collection failed: {e}")
        return {
            "timestamp": datetime.utcnow().isoformat(),
            "error": str(e),
            "metrics": {}
        }