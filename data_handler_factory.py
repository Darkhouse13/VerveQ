"""
Data Handler Factory for VerveQ Multi-Sport Platform

This module provides a factory for creating data handlers based on configuration.
It supports both PostgreSQL and JSON data handlers with graceful fallback.
"""

import logging
from typing import Optional, Union
from config import DatabaseConfig

try:
    from postgresql_data_handler import PostgreSQLDataHandler
    POSTGRESQL_AVAILABLE = True
except ImportError:
    POSTGRESQL_AVAILABLE = False
    
try:
    from Data import JSONDataHandler
    JSON_AVAILABLE = True
except ImportError:
    JSON_AVAILABLE = False

logger = logging.getLogger(__name__)


class DataHandlerFactory:
    """
    Factory class for creating appropriate data handlers based on configuration.
    Handles PostgreSQL connections with graceful fallback to JSON.
    """
    
    @staticmethod
    def create_data_handler(database_config: DatabaseConfig, 
                          data_root: str = "data") -> Optional[Union[PostgreSQLDataHandler, JSONDataHandler]]:
        """
        Create a data handler based on database configuration.
        
        Args:
            database_config: Database configuration containing PostgreSQL settings
            data_root: Root directory for JSON data files (fallback)
            
        Returns:
            PostgreSQLDataHandler if PostgreSQL is enabled and available,
            JSONDataHandler as fallback, or None if no handlers available
        """
        
        # Try PostgreSQL first if enabled
        if database_config.enable_postgresql:
            if not POSTGRESQL_AVAILABLE:
                logger.warning("PostgreSQL handler requested but not available. Check postgresql_data_handler.py import.")
                if database_config.fallback_to_json:
                    logger.info("Falling back to JSON data handler")
                else:
                    logger.error("Fallback disabled. No data handler available.")
                    return None
            else:
                try:
                    # Attempt to create PostgreSQL handler
                    pg_handler = PostgreSQLDataHandler(
                        database_url=database_config.database_url,
                        enable_caching=True,
                        cache_ttl=database_config.cache_ttl
                    )
                    
                    # Test the connection
                    if DataHandlerFactory._test_postgresql_connection(pg_handler):
                        logger.info(f"✅ PostgreSQL data handler initialized successfully")
                        logger.info(f"🔗 Database URL: {database_config.database_url}")
                        return pg_handler
                    else:
                        logger.warning("PostgreSQL connection test failed")
                        if database_config.fallback_to_json:
                            logger.info("Falling back to JSON data handler")
                        else:
                            logger.error("Fallback disabled. No data handler available.")
                            return None
                            
                except Exception as e:
                    logger.error(f"Failed to initialize PostgreSQL handler: {e}")
                    if database_config.fallback_to_json:
                        logger.info("Falling back to JSON data handler")
                    else:
                        logger.error("Fallback disabled. No data handler available.")
                        return None
        
        # Use JSON handler as default or fallback
        if JSON_AVAILABLE:
            try:
                json_handler = JSONDataHandler(data_root=data_root)
                logger.info(f"📁 JSON data handler initialized")
                logger.info(f"📂 Data root: {data_root}")
                return json_handler
            except Exception as e:
                logger.error(f"Failed to initialize JSON handler: {e}")
                return None
        else:
            logger.error("JSON handler not available. Check Data.py import.")
            return None
    
    @staticmethod
    def _test_postgresql_connection(pg_handler: PostgreSQLDataHandler) -> bool:
        """
        Test PostgreSQL connection by attempting a simple query.
        
        Args:
            pg_handler: PostgreSQL data handler instance
            
        Returns:
            True if connection successful, False otherwise
        """
        try:
            # Try a simple connection test - attempt to get available competitions
            # This will test if the database is accessible and tables exist
            pg_handler.get_available_competitions()
            return True
        except Exception as e:
            logger.warning(f"PostgreSQL connection test failed: {e}")
            return False
    
    @staticmethod
    def get_handler_info(handler) -> dict:
        """
        Get information about the current data handler.
        
        Args:
            handler: Data handler instance
            
        Returns:
            Dictionary with handler information
        """
        if handler is None:
            return {"type": "none", "status": "unavailable"}
        
        if isinstance(handler, PostgreSQLDataHandler):
            return {
                "type": "postgresql",
                "status": "active",
                "database_url": handler.database_url,
                "caching_enabled": handler.enable_caching
            }
        elif isinstance(handler, JSONDataHandler):
            return {
                "type": "json",
                "status": "active", 
                "data_root": str(handler.data_root)
            }
        else:
            return {
                "type": "unknown",
                "status": "active",
                "class": handler.__class__.__name__
            }