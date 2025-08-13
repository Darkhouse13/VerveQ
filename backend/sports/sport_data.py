"""
Simple data loading and caching for VerveQ sports quiz game.
Replaces the over-engineered enterprise data loading system with focused simplicity.
"""

import os
import json
from typing import Dict, List, Any, Optional
from dataclasses import dataclass
from enum import Enum


class League(Enum):
    """Football leagues"""
    PREMIER_LEAGUE = "premier_league"
    LA_LIGA = "la_liga"
    BUNDESLIGA = "bundesliga"
    SERIE_A = "serie_a"
    LIGUE_1 = "ligue_1"
    GLOBAL = "global"
    AFRICAN = "african"


class DataType(Enum):
    """Types of sports data"""
    AWARD_HISTORICAL = "award_historical"
    SEASON_STATS_PLAYER = "season_stats_player"
    SEASON_STATS_TEAM = "season_stats_team"
    TOP_SCORERS = "top_scorers"


@dataclass
class Player:
    """Simple player data structure"""
    name: str
    nationality: Optional[str] = None
    age: Optional[int] = None
    position: Optional[str] = None
    team: Optional[str] = None
    season: Optional[str] = None


@dataclass
class Award:
    """Simple award data structure"""
    award_name: str
    winner_name: str
    year: int
    nationality: Optional[str] = None
    age: Optional[int] = None
    team: Optional[str] = None
    position: Optional[str] = None


@dataclass
class PlayerStat:
    """Simple player statistics"""
    stat_name: str
    stat_value: Any
    player_name: Optional[str] = None
    team_name: Optional[str] = None
    season: Optional[str] = None


@dataclass
class TeamStat:
    """Simple team statistics"""
    team_name: str
    season: str
    stats: Dict[str, Any]


class SimpleDataLoader:
    """Simple, focused data loader for quiz game"""
    
    def __init__(self, data_dir: str = None):
        """Initialize with data directory"""
        if data_dir is None:
            current_file = os.path.abspath(__file__)
            project_root = os.path.dirname(os.path.dirname(os.path.dirname(current_file)))
            data_dir = os.path.join(project_root, "data")
        
        self.data_dir = data_dir
        self.quiz_data_path = os.path.join(data_dir, "quiz_data")
        self.survival_data_path = os.path.join(data_dir, "survival_data")
        
        # Simple in-memory cache
        self._cache: Dict[str, Any] = {}
        
        # File mappings for football data
        self.football_files = {
            (League.PREMIER_LEAGUE, DataType.SEASON_STATS_PLAYER): "PL_Players_Stats.json",
            (League.PREMIER_LEAGUE, DataType.AWARD_HISTORICAL): "PL_Player_of_the_Season.json",
            (League.LA_LIGA, DataType.SEASON_STATS_PLAYER): "LaLiga_Players_Stats.json",
            (League.LA_LIGA, DataType.SEASON_STATS_TEAM): "La Liga_squad_std_stats.json",
            (League.LA_LIGA, DataType.AWARD_HISTORICAL): "LaLiga_Best_Player.json",
            (League.BUNDESLIGA, DataType.TOP_SCORERS): "Bundesliga_Top_Scorers.json",
            (League.SERIE_A, DataType.AWARD_HISTORICAL): "SerieA_Footballer_of_the_Year.json",
            (League.LIGUE_1, DataType.AWARD_HISTORICAL): "L1_Player_of_the_Year.json",
            (League.GLOBAL, DataType.AWARD_HISTORICAL): "Ballon_d_Or.json",
            (League.AFRICAN, DataType.AWARD_HISTORICAL): "African_Footballer_of_the_Year.json"
        }
    
    def load_json_file(self, filepath: str) -> List[Dict[str, Any]]:
        """Load JSON file with simple caching"""
        if filepath in self._cache:
            return self._cache[filepath]
        
        try:
            with open(filepath, 'r', encoding='utf-8') as file:
                data = json.load(file)
                self._cache[filepath] = data
                return data
        except (FileNotFoundError, json.JSONDecodeError):
            return []
    
    def get_football_data(self, league: League, data_type: DataType) -> List[Any]:
        """Get football data for specific league and type"""
        cache_key = f"football_{league.value}_{data_type.value}"
        
        if cache_key in self._cache:
            return self._cache[cache_key]
        
        # Get filename for this league/type combination
        filename = self.football_files.get((league, data_type))
        if not filename:
            return []
        
        filepath = os.path.join(self.quiz_data_path, filename)
        raw_data = self.load_json_file(filepath)
        
        # Transform to standardized format
        standardized_data = self._standardize_football_data(raw_data, data_type, filename)
        
        # Cache the standardized data
        self._cache[cache_key] = standardized_data
        
        return standardized_data
    
    def _standardize_football_data(self, raw_data: List[Dict], data_type: DataType, filename: str) -> List[Any]:
        """Convert raw data to standardized objects"""
        standardized = []
        
        for item in raw_data:
            try:
                if data_type == DataType.AWARD_HISTORICAL:
                    award = Award(
                        award_name=self._get_award_name(filename),
                        winner_name=item.get("Player", ""),
                        year=self._extract_year(item.get("Season", "")),
                        nationality=item.get("Nation"),
                        age=self._safe_int(item.get("Age")),
                        team=self._clean_team_name(item.get("Squad", "")),
                        position=item.get("Pos")
                    )
                    standardized.append(award)
                
                elif data_type == DataType.SEASON_STATS_PLAYER:
                    stat = PlayerStat(
                        stat_name=item.get("stat_name", ""),
                        stat_value=item.get("stat_value", ""),
                        player_name=item.get("player_name"),
                        team_name=item.get("team_name"),
                        season="2024-2025"
                    )
                    standardized.append(stat)
                
                elif data_type == DataType.SEASON_STATS_TEAM:
                    # Extract stats (all fields except squad)
                    stats = {k: v for k, v in item.items() if k.lower() != "squad"}
                    team_stat = TeamStat(
                        team_name=item.get("squad", ""),
                        season="2024-2025",
                        stats=stats
                    )
                    standardized.append(team_stat)
                
                elif data_type == DataType.TOP_SCORERS:
                    player = Player(
                        name=item.get("Player", ""),
                        nationality=item.get("Nation"),
                        age=self._safe_int(item.get("Age")),
                        position=item.get("Pos"),
                        team=item.get("Squad"),
                        season=item.get("Season")
                    )
                    standardized.append(player)
            
            except Exception:
                # Skip malformed records
                continue
        
        return standardized
    
    def get_survival_data(self, sport: str = "football") -> Dict[str, List[str]]:
        """Get survival mode data (initials mapping)"""
        cache_key = f"survival_{sport}"
        
        if cache_key in self._cache:
            return self._cache[cache_key]
        
        if sport == "football":
            filepath = os.path.join(self.survival_data_path, "survival_initials_map.json")
        else:
            filepath = os.path.join(self.survival_data_path, f"survival_initials_map_{sport}.json")
        
        data = self.load_json_file(filepath)
        
        if isinstance(data, dict):
            result = data.get("initials_map", {})
        else:
            result = {}
        
        self._cache[cache_key] = result
        return result
    
    def get_all_football_data(self) -> Dict[League, Dict[DataType, List[Any]]]:
        """Get all available football data"""
        result = {}
        
        for (league, data_type), filename in self.football_files.items():
            data = self.get_football_data(league, data_type)
            
            if data:
                if league not in result:
                    result[league] = {}
                result[league][data_type] = data
        
        return result
    
    def _get_award_name(self, filename: str) -> str:
        """Extract award name from filename"""
        award_names = {
            "PL_Player_of_the_Season.json": "Premier League Player of the Season",
            "LaLiga_Best_Player.json": "La Liga Best Player",
            "SerieA_Footballer_of_the_Year.json": "Serie A Footballer of the Year",
            "L1_Player_of_the_Year.json": "Ligue 1 Player of the Year",
            "Ballon_d_Or.json": "Ballon d'Or",
            "African_Footballer_of_the_Year.json": "African Footballer of the Year"
        }
        return award_names.get(filename, "Unknown Award")
    
    def _extract_year(self, season: str) -> int:
        """Extract year from season string"""
        if not season:
            return 0
        
        # Handle formats like "2023-2024" or "2023"
        if "-" in season:
            try:
                return int(season.split("-")[0])
            except ValueError:
                return 0
        else:
            try:
                return int(season)
            except ValueError:
                return 0
    
    def _safe_int(self, value: Any) -> Optional[int]:
        """Safely convert to int"""
        if value is None:
            return None
        try:
            return int(value)
        except (ValueError, TypeError):
            return None
    
    def _clean_team_name(self, squad: str) -> str:
        """Clean team name from squad field"""
        if not squad:
            return ""
        
        # Remove common national team prefixes and clean
        parts = squad.split()
        national_teams = ["fr", "ar", "br", "pt", "de", "es", "it", "en", "nl", "be"]
        clean_parts = [part for part in parts if part.lower() not in national_teams]
        
        return " ".join(clean_parts) if clean_parts else squad


# Global data loader instance
_data_loader = None

def get_data_loader() -> SimpleDataLoader:
    """Get global data loader instance"""
    global _data_loader
    if _data_loader is None:
        _data_loader = SimpleDataLoader()
    return _data_loader