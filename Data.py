import json
import os
import time
from typing import Dict, List, Optional, Any, Tuple
from pathlib import Path
import jsonschema
import pandas as pd
from datetime import datetime

class CacheManager:
    """
    A caching layer that wraps a data handler to provide in-memory caching
    with Time-To-Live (TTL) for improved performance.
    """

    def __init__(self, data_handler, ttl_seconds: int = 3600):
        """
        Initializes the CacheManager.

        Args:
            data_handler: An instance of a data handler class (e.g., JSONDataHandler).
            ttl_seconds (int): The time-to-live for cache entries in seconds.
        """
        self.data_handler = data_handler
        self.ttl = ttl_seconds
        self.cache = {}
        self.stats = {"hits": 0, "misses": 0}
        print(f"CacheManager initialized with TTL: {self.ttl} seconds")

    def _get_cache_key(self, method_name: str, *args, **kwargs) -> str:
        """Generates a unique cache key for a method call."""
        return f"{method_name}:{str(args)}:{str(kwargs)}"

    def _is_cache_valid(self, key: str) -> bool:
        """Checks if a cache entry is still valid based on TTL."""
        if key not in self.cache:
            return False
        
        entry_time = self.cache[key].get('timestamp', 0)
        return (time.time() - entry_time) < self.ttl

    def get(self, method_name: str, *args, **kwargs) -> Any:
        """
        Retrieves data from the cache or the data handler if the cache is invalid.
        """
        key = self._get_cache_key(method_name, *args, **kwargs)
        
        if self._is_cache_valid(key):
            self.stats["hits"] += 1
            print(f"[Cache HIT] Returning cached data for key: {key}")
            return self.cache[key]['data']
        
        # Cache miss or expired
        self.stats["misses"] += 1
        print(f"[Cache MISS] Fetching fresh data for key: {key}")
        
        method_to_call = getattr(self.data_handler, method_name)
        fresh_data = method_to_call(*args, **kwargs)
        
        self.cache[key] = {
            'data': fresh_data,
            'timestamp': time.time()
        }
        return fresh_data

    def invalidate(self):
        """Clears the entire cache."""
        self.cache = {}
        self.stats = {"hits": 0, "misses": 0}
        print("[Cache] Cache has been invalidated.")

    def get_stats(self) -> Dict[str, int]:
        """Returns cache statistics."""
        return {**self.stats, "current_size": len(self.cache)}

    def __getattr__(self, name):
        """
        Magic method to dynamically handle calls to the wrapped data_handler.
        This makes the CacheManager a transparent proxy.
        """
        def method(*args, **kwargs):
            return self.get(name, *args, **kwargs)
        return method

class JSONDataHandler:
    """
    A unified data handler for loading and querying football data from JSON files.
    Handles both award/title files and statistics files, with schema validation.
    """

    def __init__(self, data_root: str = "data", schema_root: str = "schemas"):
        """
        Initializes the data handler by loading all JSON files from the data directory.

        Args:
            data_root (str): The path to the directory containing JSON files.
            schema_root (str): The path to the directory containing JSON schemas.
        """
        script_dir = Path(__file__).parent
        self.data_root = script_dir / data_root
        self.schema_root = script_dir / schema_root
        if not self.data_root.is_dir():
            raise FileNotFoundError(f"Data directory not found at: {self.data_root.resolve()}")
        if not self.schema_root.is_dir():
            raise FileNotFoundError(f"Schema directory not found at: {self.schema_root.resolve()}")

        self.award_data = {}
        self.stats_data = {}
        self.squad_stats_data = {}
        self.schemas = self._load_schemas()
        self._load_all_data()
        print(f"JSON data handler initialized. Loaded {len(self.award_data)} award files, {len(self.stats_data)} player stats files, and {len(self.squad_stats_data)} squad stats files.")

    def _load_schemas(self) -> Dict[str, Dict[str, Any]]:
        """Loads all JSON schemas from the schema directory."""
        schemas = {}
        for schema_path in self.schema_root.glob("*.json"):
            try:
                with open(schema_path, 'r', encoding='utf-8') as f:
                    schema = json.load(f)
                    schemas[schema_path.stem] = schema
            except (json.JSONDecodeError, IOError) as e:
                print(f"[Error] Failed to load schema {schema_path}: {e}")
        return schemas

    def _validate_data(self, data: Any, schema_name: str) -> bool:
        """Validates data against a loaded schema."""
        schema = self.schemas.get(schema_name)
        if not schema:
            print(f"[Warning] Schema '{schema_name}' not found. Skipping validation.")
            return False
        try:
            jsonschema.validate(instance=data, schema=schema)
            return True
        except jsonschema.exceptions.ValidationError as e:
            print(f"[Error] Schema validation failed for {schema_name}: {e.message}")
            return False

    def _load_json(self, file_path: Path) -> Optional[List[Dict[str, Any]]]:
        """Helper to load a JSON file and handle potential errors."""
        if not file_path.exists():
            print(f"[Warning] JSON file not found: {file_path}")
            return None
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        except json.JSONDecodeError as e:
            print(f"[Error] Failed to parse {file_path}: {e}")
            return None
        except IOError as e:
            print(f"[Error] Failed to load {file_path}: {e}")
            return None

    def _load_all_data(self):
        """Loads all JSON files and categorizes them into award or stats data."""
        json_files = list(self.data_root.glob("*.json"))
        
        for file_path in json_files:
            data = self._load_json(file_path)
            if not data or len(data) == 0:
                continue
            
            file_name = file_path.stem
            first_record = data[0]
            
            if 'Player' in first_record and 'Season' in first_record:
                if self._validate_data(data, 'award_schema'):
                    self.award_data[file_name] = data
                    print(f"[Info] Loaded award file: {file_name} ({len(data)} records)")
            elif 'stat_name' in first_record and 'player_name' in first_record:
                if self._validate_data(data, 'player_stats_schema'):
                    self.stats_data[file_name] = data
                    print(f"[Info] Loaded player stats file: {file_name} ({len(data)} records)")
            elif 'squad' in first_record and 'num_players' in first_record:
                if self._validate_data(data, 'squad_stats_schema'):
                    self.squad_stats_data[file_name] = data
                    print(f"[Info] Loaded squad stats file: {file_name} ({len(data)} records)")
            else:
                print(f"[Warning] Skipping file with unknown format: {file_name}")

    def get_available_competitions(self) -> List[Dict[str, Any]]:
        """
        Returns a list of available competitions based on loaded JSON files.
        """
        competitions = []
        
        for file_name, data in self.award_data.items():
            if data:
                seasons = sorted(list(set(record.get('Season', 'Unknown') for record in data)))
                competitions.append({
                    "competition_id": file_name,
                    "competition_name": self._format_competition_name(file_name),
                    "data_type": "award",
                    "seasons": seasons,
                    "total_records": len(data)
                })
        
        for file_name, data in self.stats_data.items():
            if data:
                stat_names = sorted(list(set(d.get('stat_name', 'Unknown') for d in data)))
                competitions.append({
                    "competition_id": file_name,
                    "competition_name": self._format_competition_name(file_name),
                    "data_type": "stats", 
                    "stat_names": stat_names,
                    "total_records": len(data)
                })

        return competitions

    def _format_competition_name(self, file_name: str) -> str:
        """Formats the file name into a readable competition name."""
        name = file_name.replace('_', ' ').replace('-', ' ')
        replacements = {
            'PL': 'Premier League',
            'L1': 'Ligue 1',
            'LaLiga': 'La Liga',
            'SerieA': 'Serie A'
        }
        for abbr, full_name in replacements.items():
            if name.startswith(abbr):
                name = name.replace(abbr, full_name, 1)
        return name.title()

    def get_award_data(self, competition_id: str, season: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        Gets award data for a specific competition and optionally a specific season.
        """
        data = self.award_data.get(competition_id, [])
        if season:
            data = [record for record in data if record.get('Season') == season]
        return data

    def get_stats_data(self, competition_id: str, stat_name: Optional[str] = None, 
                      team_name: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        Gets statistics data for a specific competition with optional filters.
        """
        data = self.stats_data.get(competition_id, [])
        if stat_name:
            data = [record for record in data if record.get('stat_name') == stat_name]
        if team_name:
            data = [record for record in data if record.get('team_name') == team_name]
        return data
    
    def get_all_stat_names(self, competition_id: str) -> List[str]:
        """Gets all unique statistic names for a given competition."""
        if competition_id not in self.stats_data:
            return []
        stat_names = set()
        for record in self.stats_data[competition_id]:
            stat_names.add(record.get('stat_name'))
        return sorted(list(filter(None, stat_names)))

    def get_all_players(self, competition_id: str) -> List[str]:
        """
        Gets all unique player names from a competition.
        """
        players = set()
        if competition_id in self.award_data:
            for record in self.award_data[competition_id]:
                players.add(record.get('Player'))
        if competition_id in self.stats_data:
            for record in self.stats_data[competition_id]:
                players.add(record.get('player_name'))
        return sorted(list(filter(None, players)))

    def get_all_teams(self, competition_id: str) -> List[str]:
        """
        Gets all unique team names from a competition.
        """
        teams = set()
        if competition_id in self.award_data:
            for record in self.award_data[competition_id]:
                squad = record.get('Squad', '')
                if squad:
                    team_parts = squad.split(',')
                    for part in team_parts:
                        team = part.strip()
                        if team and not self._is_country_name(team):
                            teams.add(team)
        if competition_id in self.stats_data:
            for record in self.stats_data[competition_id]:
                team = record.get('team_name')
                if team and team.strip():
                    teams.add(team.strip())
        return sorted(list(teams))

    def get_all_players_across_competitions(self) -> List[str]:
        """
        Gets a comprehensive list of all unique player names from all loaded data files.
        """
        players = set()
        for competition_id in self.award_data:
            for record in self.award_data[competition_id]:
                players.add(record.get('Player'))
        for competition_id in self.stats_data:
            for record in self.stats_data[competition_id]:
                players.add(record.get('player_name'))
        return sorted(list(filter(None, players)))

    def get_all_players(self) -> List[Dict[str, Any]]:
        """
        Gets a comprehensive list of all unique player records (dictionaries) 
        from all loaded data files. This is the primary method for player data.
        """
        player_records = {} # Use a dict to store the most complete record of a player
        
        # Process award data first, as it might have more details
        for competition_id in self.award_data:
            for record in self.award_data[competition_id]:
                player_name = record.get('Player')
                if player_name:
                    # If player already exists, update with missing info
                    if player_name in player_records:
                        player_records[player_name].update({k: v for k, v in record.items() if k not in player_records[player_name]})
                    else:
                        player_records[player_name] = record

        # Process stats data
        for competition_id in self.stats_data:
            for record in self.stats_data[competition_id]:
                player_name = record.get('player_name')
                if player_name:
                    # Rename 'player_name' to 'Player' for consistency
                    if 'player_name' in record:
                        record['Player'] = record.pop('player_name')

                    if player_name in player_records:
                        player_records[player_name].update({k: v for k, v in record.items() if k not in player_records[player_name]})
                    else:
                        player_records[player_name] = record
                        
        return list(player_records.values())

    def get_all_teams(self) -> List[Dict[str, Any]]:
        """
        Gets a comprehensive list of all unique team names from all loaded data files,
        returned as a list of dictionaries with 'team_name'.
        """
        teams = set()
        # Iterate through award data
        for comp_data in self.award_data.values():
            for record in comp_data:
                squad = record.get('Squad', '')
                if squad:
                    team_parts = squad.split(',')
                    for part in team_parts:
                        team = part.strip()
                        if team and not self._is_country_name(team):
                            teams.add(team)
        # Iterate through stats data
        for comp_data in self.stats_data.values():
            for record in comp_data:
                team = record.get('team_name')
                if team and team.strip():
                    teams.add(team.strip())
        # Iterate through squad stats data (assuming it has a 'squad' key or similar)
        for comp_data in self.squad_stats_data.values():
            for record in comp_data:
                squad = record.get('squad', '') # Assuming 'squad' key for squad_stats_data
                if squad:
                    teams.add(squad.strip()) # Assuming squad_stats_data records are directly team names or similar
        
        # Convert set of names to list of dictionaries
        return sorted([{"team_name": team} for team in list(filter(None, teams))], key=lambda x: x['team_name'])

    def _is_country_name(self, name: str) -> bool:
        """Helper to identify if a name is likely a country rather than a club."""
        countries = {
            'Spain', 'Argentina', 'Brazil', 'France', 'England', 'Portugal', 
            'Germany', 'Italy', 'Netherlands', 'Belgium', 'Croatia', 'Uruguay',
            'Denmark', 'Sweden', 'Norway', 'Poland', 'Czech Republic', 'Wales',
            'Scotland', 'Northern Ireland', 'Republic of Ireland', 'Austria',
            'Switzerland', 'Serbia', 'Hungary', 'Bulgaria', 'Romania', 'Greece',
            'Turkey', 'Russia', 'Ukraine', 'Morocco', 'Egypt', 'Nigeria',
            'Cameroon', 'Ghana', 'Senegal', 'Algeria', 'Tunisia', 'Japan',
            'South Korea', 'Australia', 'USA', 'Mexico', 'Colombia', 'Chile',
            'Peru', 'Ecuador', 'Paraguay', 'Venezuela', 'Bolivia'
        }
        return name in countries
    
    def get_all_seasons(self, competition_id: str) -> List[str]:
        """Gets all unique seasons from an award competition."""
        if competition_id not in self.award_data:
            return []
        seasons = set()
        for record in self.award_data[competition_id]:
            seasons.add(record.get('Season'))
        return sorted(list(filter(None, seasons)))


class MatchDataHandler:
    """
    Handler for football match data from CSV files.
    Focuses on football-relevant information like scores, results, and match statistics.
    """
    
    def __init__(self, csv_path: str = "Matches.csv"):
        """
        Initialize the match data handler.
        
        Args:
            csv_path: Path to the matches CSV file
        """
        self.csv_path = Path(csv_path)
        if not self.csv_path.exists():
            # Try looking in common locations
            script_dir = Path(__file__).parent
            alternative_paths = [
                script_dir / csv_path,
                script_dir / "data.csv" / csv_path,
                script_dir / "data" / csv_path
            ]
            for alt_path in alternative_paths:
                if alt_path.exists():
                    self.csv_path = alt_path
                    break
            else:
                raise FileNotFoundError(f"Matches CSV not found. Tried: {csv_path} and alternatives")
        
        print(f"Loading match data from: {self.csv_path}")
        self._load_data()
        
    def _load_data(self):
        """Load and preprocess the match data."""
        # Load CSV with appropriate data types
        dtype_spec = {
            'Division': str,
            'HomeTeam': str,
            'AwayTeam': str,
            'FTHome': 'Int64',  # Nullable integer
            'FTAway': 'Int64',
            'HTHome': 'Int64',
            'HTAway': 'Int64',
            'FTResult': str,
            'HTResult': str
        }
        
        # Load the data
        self.df = pd.read_csv(self.csv_path, dtype=dtype_spec, parse_dates=['MatchDate'])
        
        # Clean team names
        self.df['HomeTeam'] = self.df['HomeTeam'].str.strip()
        self.df['AwayTeam'] = self.df['AwayTeam'].str.strip()
        
        # Create some useful derived columns
        self.df['TotalGoals'] = self.df['FTHome'] + self.df['FTAway']
        self.df['GoalDifference'] = self.df['FTHome'] - self.df['FTAway']
        self.df['Season'] = self.df['MatchDate'].apply(self._get_season)
        
        # Create indexes for fast lookup
        self._create_indexes()
        
        print(f"Loaded {len(self.df)} matches from {self.df['MatchDate'].min()} to {self.df['MatchDate'].max()}")
        print(f"Divisions: {self.df['Division'].nunique()}, Teams: {self._get_all_teams_count()}")
        
    def _get_season(self, date):
        """Determine season from date (e.g., 2023-24)."""
        if pd.isna(date):
            return None
        year = date.year
        month = date.month
        if month >= 7:  # July onwards is new season
            return f"{year}-{str(year+1)[2:]}"
        else:
            return f"{year-1}-{str(year)[2:]}"
    
    def _create_indexes(self):
        """Create indexes for efficient querying."""
        # Team index
        self.team_matches = {}
        for idx, row in self.df.iterrows():
            home_team = row['HomeTeam']
            away_team = row['AwayTeam']
            
            if home_team not in self.team_matches:
                self.team_matches[home_team] = []
            if away_team not in self.team_matches:
                self.team_matches[away_team] = []
                
            self.team_matches[home_team].append(idx)
            self.team_matches[away_team].append(idx)
    
    def _get_all_teams_count(self) -> int:
        """Get count of unique teams."""
        all_teams = set(self.df['HomeTeam'].unique()) | set(self.df['AwayTeam'].unique())
        return len(all_teams)
    
    def get_match_by_teams_and_date(self, team1: str, team2: str, date: Optional[str] = None) -> Optional[Dict]:
        """
        Get a specific match between two teams, optionally on a specific date.
        
        Args:
            team1: First team name
            team2: Second team name  
            date: Optional date in YYYY-MM-DD format
            
        Returns:
            Match data as dictionary or None if not found
        """
        # Find matches where teams played each other
        condition = ((self.df['HomeTeam'] == team1) & (self.df['AwayTeam'] == team2)) | \
                   ((self.df['HomeTeam'] == team2) & (self.df['AwayTeam'] == team1))
        
        matches = self.df[condition]
        
        if date:
            matches = matches[matches['MatchDate'] == pd.to_datetime(date)]
        
        if len(matches) == 0:
            return None
        
        # Return most recent match if multiple
        match = matches.iloc[-1]
        return match.to_dict()
    
    def get_head_to_head_record(self, team1: str, team2: str) -> Dict:
        """
        Get head-to-head record between two teams.
        
        Returns:
            Dictionary with wins, draws, losses for team1 vs team2
        """
        # Find all matches between the teams
        condition = ((self.df['HomeTeam'] == team1) & (self.df['AwayTeam'] == team2)) | \
                   ((self.df['HomeTeam'] == team2) & (self.df['AwayTeam'] == team1))
        
        matches = self.df[condition]
        
        record = {
            'team1': team1,
            'team2': team2,
            'total_matches': len(matches),
            'team1_wins': 0,
            'draws': 0,
            'team2_wins': 0,
            'team1_goals': 0,
            'team2_goals': 0
        }
        
        for _, match in matches.iterrows():
            if match['HomeTeam'] == team1:
                team1_goals = match['FTHome']
                team2_goals = match['FTAway']
            else:
                team1_goals = match['FTAway']
                team2_goals = match['FTHome']
            
            if pd.notna(team1_goals) and pd.notna(team2_goals):
                record['team1_goals'] += int(team1_goals)
                record['team2_goals'] += int(team2_goals)
                
                if team1_goals > team2_goals:
                    record['team1_wins'] += 1
                elif team1_goals < team2_goals:
                    record['team2_wins'] += 1
                else:
                    record['draws'] += 1
        
        return record
    
    def get_biggest_wins(self, team: Optional[str] = None, division: Optional[str] = None, 
                        season: Optional[str] = None, limit: int = 10) -> List[Dict]:
        """
        Get biggest wins, optionally filtered by team, division, or season.
        
        Returns:
            List of matches with biggest winning margins
        """
        df = self.df.copy()
        
        # Apply filters
        if team:
            df = df[(df['HomeTeam'] == team) | (df['AwayTeam'] == team)]
        if division:
            df = df[df['Division'] == division]
        if season:
            df = df[df['Season'] == season]
        
        # Calculate absolute goal difference
        df['AbsGoalDiff'] = df['GoalDifference'].abs()
        
        # Sort by biggest difference and get top matches
        biggest = df.nlargest(limit, 'AbsGoalDiff')
        
        results = []
        for _, match in biggest.iterrows():
            if pd.notna(match['FTHome']) and pd.notna(match['FTAway']):
                results.append({
                    'date': match['MatchDate'].strftime('%Y-%m-%d'),
                    'home_team': match['HomeTeam'],
                    'away_team': match['AwayTeam'],
                    'score': f"{int(match['FTHome'])}-{int(match['FTAway'])}",
                    'goal_difference': int(match['AbsGoalDiff']),
                    'division': match['Division']
                })
        
        return results
    
    def get_highest_scoring_matches(self, division: Optional[str] = None, 
                                   season: Optional[str] = None, limit: int = 10) -> List[Dict]:
        """
        Get matches with most total goals.
        
        Returns:
            List of highest scoring matches
        """
        df = self.df.copy()
        
        # Apply filters
        if division:
            df = df[df['Division'] == division]
        if season:
            df = df[df['Season'] == season]
        
        # Get matches with valid scores
        df = df[df['TotalGoals'].notna()]
        
        # Sort by total goals
        highest = df.nlargest(limit, 'TotalGoals')
        
        results = []
        for _, match in highest.iterrows():
            results.append({
                'date': match['MatchDate'].strftime('%Y-%m-%d'),
                'home_team': match['HomeTeam'],
                'away_team': match['AwayTeam'],
                'score': f"{int(match['FTHome'])}-{int(match['FTAway'])}",
                'total_goals': int(match['TotalGoals']),
                'division': match['Division']
            })
        
        return results
    
    def get_team_season_record(self, team: str, season: str, division: Optional[str] = None) -> Dict:
        """
        Get a team's record for a specific season.
        
        Returns:
            Dictionary with wins, draws, losses, goals for/against
        """
        df = self.df[self.df['Season'] == season]
        
        if division:
            df = df[df['Division'] == division]
        
        # Get all matches for the team
        team_matches = df[(df['HomeTeam'] == team) | (df['AwayTeam'] == team)]
        
        record = {
            'team': team,
            'season': season,
            'played': 0,
            'wins': 0,
            'draws': 0,
            'losses': 0,
            'goals_for': 0,
            'goals_against': 0,
            'points': 0
        }
        
        for _, match in team_matches.iterrows():
            if pd.notna(match['FTHome']) and pd.notna(match['FTAway']):
                record['played'] += 1
                
                if match['HomeTeam'] == team:
                    goals_for = int(match['FTHome'])
                    goals_against = int(match['FTAway'])
                    
                    if match['FTResult'] == 'H':
                        record['wins'] += 1
                        record['points'] += 3
                    elif match['FTResult'] == 'D':
                        record['draws'] += 1
                        record['points'] += 1
                    else:
                        record['losses'] += 1
                else:
                    goals_for = int(match['FTAway'])
                    goals_against = int(match['FTHome'])
                    
                    if match['FTResult'] == 'A':
                        record['wins'] += 1
                        record['points'] += 3
                    elif match['FTResult'] == 'D':
                        record['draws'] += 1
                        record['points'] += 1
                    else:
                        record['losses'] += 1
                
                record['goals_for'] += goals_for
                record['goals_against'] += goals_against
        
        record['goal_difference'] = record['goals_for'] - record['goals_against']
        
        return record
    
    def get_comeback_wins(self, team: Optional[str] = None, limit: int = 10) -> List[Dict]:
        """
        Get matches where a team came back from behind at halftime to win.
        
        Returns:
            List of comeback victories
        """
        # Find matches where halftime result differs from fulltime
        df = self.df.copy()
        
        # Filter for matches with both HT and FT results
        df = df[df['HTResult'].notna() & df['FTResult'].notna()]
        
        # Comeback conditions
        home_comebacks = (df['HTResult'] == 'A') & (df['FTResult'] == 'H')
        away_comebacks = (df['HTResult'] == 'H') & (df['FTResult'] == 'A')
        
        comebacks = df[home_comebacks | away_comebacks]
        
        # Filter by team if specified
        if team:
            team_comebacks = comebacks[
                ((comebacks['HomeTeam'] == team) & home_comebacks) |
                ((comebacks['AwayTeam'] == team) & away_comebacks)
            ]
            comebacks = team_comebacks
        
        # Sort by date and limit
        comebacks = comebacks.sort_values('MatchDate', ascending=False).head(limit)
        
        results = []
        for _, match in comebacks.iterrows():
            results.append({
                'date': match['MatchDate'].strftime('%Y-%m-%d'),
                'home_team': match['HomeTeam'],
                'away_team': match['AwayTeam'],
                'halftime_score': f"{int(match['HTHome'])}-{int(match['HTAway'])}",
                'fulltime_score': f"{int(match['FTHome'])}-{int(match['FTAway'])}",
                'division': match['Division']
            })
        
        return results
    
    def get_all_teams(self) -> List[str]:
        """Get all unique team names."""
        home_teams = set(self.df['HomeTeam'].unique())
        away_teams = set(self.df['AwayTeam'].unique())
        all_teams = home_teams.union(away_teams)
        return sorted(list(all_teams))
    
    def get_all_divisions(self) -> List[str]:
        """Get all unique divisions."""
        return sorted(self.df['Division'].unique().tolist())
    
    def get_all_seasons(self) -> List[str]:
        """Get all unique seasons."""
        return sorted(self.df['Season'].dropna().unique().tolist())



if __name__ == "__main__":
    print("--- Testing JSONDataHandler and CacheManager ---")
    try:
        # 1. Initialize the core data handler
        data_handler = JSONDataHandler()
        
        # 2. Wrap it with the CacheManager
        # Using a short TTL for testing purposes
        cached_handler = CacheManager(data_handler, ttl_seconds=5)

        # 3. Perform a data request
        print("\n--- First Request (should be a cache miss) ---")
        competitions = cached_handler.get_available_competitions()
        print(f"Found {len(competitions)} competitions.")
        print(f"Cache Stats: {cached_handler.get_stats()}")

        # 4. Perform the same request again (should be a cache hit)
        print("\n--- Second Request (should be a cache hit) ---")
        competitions_from_cache = cached_handler.get_available_competitions()
        print(f"Found {len(competitions_from_cache)} competitions from cache.")
        print(f"Cache Stats: {cached_handler.get_stats()}")

        # 5. Test TTL expiration
        print("\n--- Testing TTL (waiting 6 seconds) ---")
        time.sleep(6)
        competitions_after_ttl = cached_handler.get_available_competitions()
        print(f"Found {len(competitions_after_ttl)} competitions after TTL expiry.")
        print(f"Cache Stats: {cached_handler.get_stats()}")

        # 6. Test cache invalidation
        print("\n--- Testing Cache Invalidation ---")
        cached_handler.get_available_competitions() # Ensure it's cached
        print(f"Cache Stats before invalidation: {cached_handler.get_stats()}")
        cached_handler.invalidate()
        print(f"Cache Stats after invalidation: {cached_handler.get_stats()}")
        cached_handler.get_available_competitions() # Should be a miss again
        print(f"Cache Stats after re-fetch: {cached_handler.get_stats()}")

        print("\n--- Caching test successful! ---")

    except Exception as e:
        print(f"Error during testing: {e}")
