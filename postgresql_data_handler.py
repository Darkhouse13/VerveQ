#!/usr/bin/env python3
"""
PostgreSQL Data Handler for FootQuizz

This module provides a PostgreSQL-based data handler that replaces the JSON-based
data storage system while maintaining API compatibility with the existing JSONDataHandler.
"""

import os
import logging
from typing import Dict, List, Any, Optional, Tuple
from datetime import datetime
import json

from sqlalchemy import create_engine, text, MetaData, Table, Column, Integer, String, Boolean, DECIMAL, DateTime, ARRAY
from sqlalchemy.orm import sessionmaker, declarative_base
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.pool import QueuePool
from cachetools import TTLCache

# Configure logging
logger = logging.getLogger(__name__)

# SQLAlchemy Base
Base = declarative_base()


class PostgreSQLDataHandler:
    """
    PostgreSQL-based data handler that provides the same interface as JSONDataHandler
    but with improved performance, scalability, and data integrity.
    """

    def __init__(self, database_url: str = None, enable_caching: bool = True,
                 cache_ttl: int = 3600, redis_url: str = None):
        """
        Initialize the PostgreSQL data handler.

        Args:
            database_url: PostgreSQL connection string
            enable_caching: Whether to enable caching
            cache_ttl: Cache time-to-live in seconds
            redis_url: Redis connection string for distributed caching
        """
        self.database_url = database_url or os.environ.get('DATABASE_URL')
        if not self.database_url:
            raise ValueError("No database URL provided. Set DATABASE_URL environment variable or pass database_url parameter.")

        self.enable_caching = enable_caching
        self.cache_ttl = cache_ttl

        # Initialize database connection
        self.engine = create_engine(
            self.database_url,
            poolclass=QueuePool,
            pool_size=10,
            max_overflow=20,
            pool_pre_ping=True,
            echo=False
        )

        Session = sessionmaker(bind=self.engine)
        self.session = Session()

        # Initialize caching
        self.cache = None
        self.redis_client = None

        if self.enable_caching:
            if redis_url:
                try:
                    import redis
                    self.redis_client = redis.from_url(redis_url)
                    logger.info("Redis caching enabled")
                except ImportError:
                    logger.warning("Redis not available, falling back to in-memory cache")
                    self.cache = TTLCache(maxsize=1000, ttl=cache_ttl)
            else:
                self.cache = TTLCache(maxsize=1000, ttl=cache_ttl)
                logger.info("In-memory caching enabled")

        # Test database connection
        self._test_connection()
        logger.info("PostgreSQL data handler initialized successfully")

    def _test_connection(self):
        """Test database connection and schema"""
        try:
            with self.engine.connect() as conn:
                result = conn.execute(text("SELECT COUNT(*) FROM sports"))
                count = result.fetchone()[0]
                logger.info(f"Database connection successful. Found {count} sports.")
        except Exception as e:
            raise ConnectionError(f"Failed to connect to database: {e}")

    def _get_cache_key(self, method_name: str, *args, **kwargs) -> str:
        """Generate cache key for method call"""
        key_parts = [method_name] + [str(arg) for arg in args]
        for k, v in sorted(kwargs.items()):
            key_parts.append(f"{k}:{v}")
        return ":".join(key_parts)

    def _get_from_cache(self, key: str) -> Any:
        """Get value from cache"""
        if not self.enable_caching:
            return None

        try:
            if self.redis_client:
                value = self.redis_client.get(key)
                return json.loads(value) if value else None
            elif self.cache:
                return self.cache.get(key)
        except Exception as e:
            logger.warning(f"Cache get error: {e}")

        return None

    def _set_cache(self, key: str, value: Any):
        """Set value in cache"""
        if not self.enable_caching:
            return

        try:
            if self.redis_client:
                self.redis_client.setex(key, self.cache_ttl, json.dumps(value))
            elif self.cache:
                self.cache[key] = value
        except Exception as e:
            logger.warning(f"Cache set error: {e}")

    def _cached_query(self, method_name: str, query_func, *args, **kwargs):
        """Execute query with caching"""
        cache_key = self._get_cache_key(method_name, *args, **kwargs)

        # Try cache first
        cached_result = self._get_from_cache(cache_key)
        if cached_result is not None:
            logger.debug(f"Cache hit for {method_name}")
            return cached_result

        # Execute query
        result = query_func(*args, **kwargs)

        # Cache result
        self._set_cache(cache_key, result)
        logger.debug(f"Cache miss for {method_name}, result cached")

        return result

    def get_available_competitions(self) -> List[Dict[str, Any]]:
        """
        Get list of available competitions.
        Maintains compatibility with JSONDataHandler interface.
        """
        def _query():
            with self.engine.connect() as conn:
                result = conn.execute(text("""
                    SELECT c.id, c.name, c.display_name, c.competition_type, c.data_source,
                           s.name as sport_name, s.display_name as sport_display_name
                    FROM competitions c
                    JOIN sports s ON c.sport_id = s.id
                    WHERE c.is_active = true
                    ORDER BY s.name, c.display_name
                """))

                competitions = []
                for row in result:
                    competitions.append({
                        'competition_id': row.name,
                        'display_name': row.display_name,
                        'data_type': row.competition_type,
                        'sport': row.sport_name,
                        'sport_display_name': row.sport_display_name,
                        'source_file': row.data_source
                    })

                return competitions

        return self._cached_query('get_available_competitions', _query)

    def get_players_by_competition(self, competition_id: str) -> List[Dict[str, Any]]:
        """
        Get players for a specific competition.
        Maintains compatibility with JSONDataHandler interface.
        """
        def _query(comp_id):
            with self.engine.connect() as conn:
                # For award competitions
                result = conn.execute(text("""
                    SELECT DISTINCT p.name as Player, p.nationality as Nation,
                           pa.age as Age, t.name as Squad,
                           array_to_string(p.positions, ',') as Pos, pa.season as Season
                    FROM players p
                    JOIN player_awards pa ON p.id = pa.player_id
                    JOIN award_types at ON pa.award_type_id = at.id
                    JOIN competitions c ON at.competition_id = c.id
                    LEFT JOIN teams t ON pa.team_id = t.id
                    WHERE c.name = :competition_id
                    ORDER BY pa.season DESC, p.name
                """), {"competition_id": comp_id})

                players = []
                for row in result:
                    players.append({
                        'Player': row.Player,
                        'Nation': row.Nation,
                        'Age': str(row.Age) if row.Age else '',
                        'Squad': row.Squad or '',
                        'Pos': row.Pos or '',
                        'Season': row.Season
                    })

                return players

        return self._cached_query('get_players_by_competition', _query, competition_id)

    def get_all_players_across_competitions(self) -> List[str]:
        """
        Get all unique player names across all competitions.
        Maintains compatibility with JSONDataHandler interface.
        """
        def _query():
            with self.engine.connect() as conn:
                result = conn.execute(text("""
                    SELECT DISTINCT name FROM players
                    WHERE is_active = true
                    ORDER BY name
                """))

                return [row.name for row in result]

        return self._cached_query('get_all_players_across_competitions', _query)

    def get_all_teams(self) -> List[Dict[str, Any]]:
        """
        Get all unique team names from all loaded data, returned as a list of dictionaries.
        Maintains compatibility with JSONDataHandler interface.
        """
        def _query():
            with self.engine.connect() as conn:
                result = conn.execute(text("""
                    SELECT DISTINCT name as team_name, display_name, country
                    FROM teams
                    WHERE is_active = true
                    ORDER BY name
                """))

                return [{'team_name': row.team_name, 'display_name': row.display_name, 'country': row.country} for row in result]

        return self._cached_query('get_all_teams', _query)