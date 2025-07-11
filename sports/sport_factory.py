"""
Sport Factory - Creates and manages sport-specific managers.
"""

from typing import Dict, Optional, Type, List, Any
from .base_sport_manager import BaseSportManager
from .football_manager import FootballManager
from .tennis_manager import TennisManager


class SportFactory:
    """
    Factory class for creating sport-specific managers.
    """
    
    # Registry of available sports
    _sport_registry: Dict[str, Type[BaseSportManager]] = {
        'football': FootballManager,
        'tennis': TennisManager,
    }
    
    # Singleton instances cache
    _instances: Dict[str, BaseSportManager] = {}
    
    @classmethod
    def create_sport_manager(cls, sport_name: str, data_root: str = None, 
                           force_new: bool = False, data_handler=None) -> Optional[BaseSportManager]:
        """
        Create or get a sport manager instance.
        
        Args:
            sport_name: Name of the sport ('football', 'tennis', etc.)
            data_root: Root directory for sport data
            force_new: Force creation of new instance (don't use cache)
            data_handler: Data handler instance (PostgreSQL or JSON)
            
        Returns:
            Sport manager instance or None if sport not supported
        """
        sport_name = sport_name.lower()
        
        # Check if sport is supported
        if sport_name not in cls._sport_registry:
            return None
        
        # Return cached instance if available and not forcing new
        if not force_new and sport_name in cls._instances:
            return cls._instances[sport_name]
        
        # Create new instance
        sport_class = cls._sport_registry[sport_name]
        instance = sport_class(sport_name, data_root, data_handler)
        
        # Initialize the instance
        if instance.initialize():
            cls._instances[sport_name] = instance
            return instance
        else:
            return None
    
    @classmethod
    def get_supported_sports(cls) -> List[str]:
        """
        Get list of supported sport names.
        
        Returns:
            List of supported sport names
        """
        return list(cls._sport_registry.keys())
    
    @classmethod
    def is_sport_supported(cls, sport_name: str) -> bool:
        """
        Check if a sport is supported.
        
        Args:
            sport_name: Name of the sport
            
        Returns:
            True if sport is supported, False otherwise
        """
        return sport_name.lower() in cls._sport_registry
    
    @classmethod
    def register_sport(cls, sport_name: str, sport_class: Type[BaseSportManager]) -> bool:
        """
        Register a new sport manager class.
        
        Args:
            sport_name: Name of the sport
            sport_class: Sport manager class
            
        Returns:
            True if registration successful, False if already exists
        """
        sport_name = sport_name.lower()
        
        if sport_name in cls._sport_registry:
            return False
        
        cls._sport_registry[sport_name] = sport_class
        return True
    
    @classmethod
    def get_sport_configs(cls) -> Dict[str, Dict[str, Any]]:
        """
        Get configuration for all supported sports.
        
        Returns:
            Dictionary mapping sport names to their configurations
        """
        configs = {}
        
        for sport_name in cls._sport_registry:
            # Try to get cached instance first
            manager = cls._instances.get(sport_name)
            
            if not manager:
                # Create temporary instance for config
                manager = cls.create_sport_manager(sport_name)
            
            if manager:
                configs[sport_name] = manager.get_sport_config()
        
        return configs
    
    @classmethod
    def clear_cache(cls, sport_name: str = None) -> None:
        """
        Clear cached instances.
        
        Args:
            sport_name: Specific sport to clear, or None to clear all
        """
        if sport_name:
            cls._instances.pop(sport_name.lower(), None)
        else:
            cls._instances.clear()
    
    @classmethod
    def validate_all_sports(cls, data_handler=None) -> Dict[str, bool]:
        """
        Validate that all registered sports can be initialized.
        
        Args:
            data_handler: Data handler instance to use for validation
        
        Returns:
            Dictionary mapping sport names to initialization success
        """
        results = {}
        
        for sport_name in cls._sport_registry:
            try:
                manager = cls.create_sport_manager(sport_name, force_new=True, data_handler=data_handler)
                results[sport_name] = manager is not None
            except Exception as e:
                results[sport_name] = False
        
        return results