"""
Simple Football Adapter - Direct database integration
"""

import sqlite3
import random
import logging
from typing import Dict, Any, List
from pathlib import Path


class SimpleFootballAdapter:
    """Direct football quiz adapter using the comprehensive database"""
    
    def __init__(self, sport_name: str = "football"):
        self.sport_name = sport_name
        self.logger = logging.getLogger(__name__)
        self.db_path = self._find_database()
        self.conn = None
        if self.db_path:
            self.conn = sqlite3.connect(self.db_path)
            self.logger.info(f"Connected to database: {self.db_path}")
        
        # Initialize data loader for survival data
        from .sport_data import SimpleDataLoader
        self.data_loader = SimpleDataLoader()
        
    
    def _find_database(self) -> str:
        """Find the football database"""
        paths = [
            "/mnt/c/Users/hamza/OneDrive/Python_Scripts/VerveQ/data_cleaning/football_comprehensive.db",
            "data_cleaning/football_comprehensive.db",
            "../data_cleaning/football_comprehensive.db"
        ]
        for path in paths:
            if Path(path).exists():
                return path
        self.logger.error("Football database not found")
        return None
    
    def get_quiz_question(self) -> Dict[str, Any]:
        """Dynamic quiz question generation is no longer supported"""
        raise NotImplementedError("Dynamic quiz question generation has been removed. Use database-only approach.")
    
    def get_survival_data(self) -> Dict[str, List[str]]:
        """Get survival initials mapping for football from JSON data"""
        try:
            # Use the data loader to get actual survival data
            return self.data_loader.get_survival_data(self.sport_name)
        except Exception as e:
            self.logger.error(f"Failed to load survival data: {e}")
            # Return empty dict on error to avoid crashes
            return {}
    
    def get_sport_theme(self) -> Dict[str, str]:
        """Get theme colors and styling for football"""
        return {
            "primary": "#2E7D32",
            "secondary": "#66BB6A",
            "accent": "#FDD835",
            "background": "#F1F8E9"
        }