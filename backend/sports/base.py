from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional
import json
import random
import os

class SportQuestionGenerator(ABC):
    """Base class for sport-specific question generation"""
    
    def __init__(self, sport_name: str):
        self.sport_name = sport_name
        self.data_cache = {}
    
    @abstractmethod
    def get_quiz_question(self) -> Dict[str, Any]:
        """Generate a quiz question for this sport"""
        pass
    
    @abstractmethod
    def get_survival_data(self) -> Dict[str, List[str]]:
        """Get survival initials mapping for this sport"""
        pass
    
    @abstractmethod
    def get_sport_theme(self) -> Dict[str, str]:
        """Get theme colors and styling for this sport"""
        pass
    
    def load_json_file(self, filepath: str) -> List[Dict[str, Any]]:
        """Load JSON data with caching"""
        if filepath in self.data_cache:
            return self.data_cache[filepath]
        
        try:
            with open(filepath, 'r', encoding='utf-8') as file:
                data = json.load(file)
                self.data_cache[filepath] = data
                return data
        except FileNotFoundError:
            return []
    
    def get_random_wrong_options(self, correct: str, all_options: List[str], count: int = 3) -> List[str]:
        """Generate random wrong options excluding the correct answer"""
        filtered_options = [opt for opt in all_options if opt != correct and opt.strip()]
        return random.sample(filtered_options, min(count, len(filtered_options)))

class SportDataFactory:
    """Factory for creating sport-specific question generators"""
    
    _generators = {}
    
    @classmethod
    def register_sport(cls, sport_name: str, generator_class):
        """Register a new sport generator"""
        cls._generators[sport_name.lower()] = generator_class
    
    @classmethod
    def get_generator(cls, sport_name: str) -> Optional[SportQuestionGenerator]:
        """Get generator for a specific sport"""
        generator_class = cls._generators.get(sport_name.lower())
        if generator_class:
            return generator_class(sport_name)
        return None
    
    @classmethod
    def get_available_sports(cls) -> List[str]:
        """Get list of available sports"""
        return list(cls._generators.keys())