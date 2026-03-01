"""
Simple cache abstraction for VerveQ Platform
Optional Redis support with graceful fallback to in-memory
Following CLAUDE.md principles (<100 lines, no over-engineering)
"""
import os
import json
import logging
from typing import Any, Optional, Dict
from threading import Lock

logger = logging.getLogger(__name__)

class SimpleCache:
    """Simple cache with Redis support and in-memory fallback"""
    
    def __init__(self):
        self.use_redis = False
        self.backend = None
        self._memory_cache: Dict[str, Any] = {}
        self._lock = Lock()
        
        # Try to use Redis if configured
        redis_url = os.getenv("REDIS_URL")
        if redis_url:
            try:
                import redis
                self.backend = redis.from_url(redis_url, decode_responses=True)
                # Test connection
                self.backend.ping()
                self.use_redis = True
                logger.info("✅ Redis cache backend initialized")
            except ImportError:
                logger.info("📦 Redis not installed, using in-memory cache")
            except Exception as e:
                logger.warning(f"⚠️ Redis connection failed: {e}, using in-memory cache")
        else:
            logger.info("💾 Using in-memory cache (no REDIS_URL configured)")
    
    def get(self, key: str) -> Optional[Any]:
        """Get value from cache"""
        try:
            if self.use_redis:
                value = self.backend.get(key)
                return json.loads(value) if value else None
            else:
                with self._lock:
                    return self._memory_cache.get(key)
        except Exception as e:
            logger.error(f"Cache get error for key {key}: {e}")
            return None
    
    def set(self, key: str, value: Any, ttl: int = 1800) -> bool:
        """Set value in cache with TTL"""
        try:
            if self.use_redis:
                self.backend.setex(key, ttl, json.dumps(value))
            else:
                with self._lock:
                    self._memory_cache[key] = value
                    # Note: in-memory cache doesn't support TTL in this simple implementation
            return True
        except Exception as e:
            logger.error(f"Cache set error for key {key}: {e}")
            return False
    
    def delete(self, key: str) -> bool:
        """Delete key from cache"""
        try:
            if self.use_redis:
                return bool(self.backend.delete(key))
            else:
                with self._lock:
                    return bool(self._memory_cache.pop(key, None))
        except Exception as e:
            logger.error(f"Cache delete error for key {key}: {e}")
            return False
    
    def clear(self) -> bool:
        """Clear all cache entries"""
        try:
            if self.use_redis:
                self.backend.flushdb()
            else:
                with self._lock:
                    self._memory_cache.clear()
            return True
        except Exception as e:
            logger.error(f"Cache clear error: {e}")
            return False
    
    def get_stats(self) -> Dict[str, Any]:
        """Get cache statistics"""
        try:
            if self.use_redis:
                info = self.backend.info()
                return {
                    "backend": "redis",
                    "connected": True,
                    "used_memory": info.get("used_memory_human", "unknown"),
                    "keys": self.backend.dbsize()
                }
            else:
                return {
                    "backend": "memory",
                    "connected": True,
                    "keys": len(self._memory_cache)
                }
        except Exception as e:
            return {
                "backend": "redis" if self.use_redis else "memory",
                "connected": False,
                "error": str(e)
            }

# Global cache instance
cache = SimpleCache()