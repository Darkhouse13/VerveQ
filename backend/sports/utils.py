"""
Utility functions for VerveQ sports quiz game.
Simple, focused helpers that support the core game functionality.
"""

import random
import re
import sqlite3
from functools import lru_cache
from typing import List, Dict, Any, Optional, Tuple


def clean_string(text: str) -> str:
    """Clean and normalize string for consistent processing"""
    if not text:
        return ""
    
    # Remove extra whitespace and normalize
    cleaned = re.sub(r'\s+', ' ', text.strip())
    return cleaned


def normalize_name(name: str) -> str:
    """Normalize player/team names for matching"""
    if not name:
        return ""
    
    # Convert to lowercase and remove special characters for matching
    normalized = re.sub(r'[^\w\s]', '', name.lower())
    normalized = re.sub(r'\s+', ' ', normalized.strip())
    return normalized


def get_player_initials(name: str) -> str:
    """Get initials from player name"""
    if not name:
        return ""
    
    # Split name and get first letter of each part
    parts = clean_string(name).split()
    initials = ''.join([part[0].upper() for part in parts if part])
    return initials


def calculate_similarity(text1: str, text2: str) -> float:
    """Calculate simple similarity score between two strings"""
    if not text1 or not text2:
        return 0.0
    
    norm1 = normalize_name(text1)
    norm2 = normalize_name(text2)
    
    # Exact match
    if norm1 == norm2:
        return 1.0
    
    # Check if one contains the other
    if norm1 in norm2 or norm2 in norm1:
        shorter = min(len(norm1), len(norm2))
        longer = max(len(norm1), len(norm2))
        return shorter / longer
    
    # Check for word overlap
    words1 = set(norm1.split())
    words2 = set(norm2.split())
    
    if words1 and words2:
        overlap = len(words1.intersection(words2))
        total = len(words1.union(words2))
        return overlap / total if total > 0 else 0.0
    
    return 0.0


def get_random_wrong_options(correct: str, all_options: List[str], count: int = 3) -> List[str]:
    """Generate random wrong options excluding the correct answer"""
    if not all_options:
        return []
    
    # Filter out the correct answer and empty options
    filtered_options = [opt for opt in all_options if opt and opt.strip() and opt != correct]
    
    # Deduplicate options while preserving order for variety
    seen = set()
    unique_options = []
    for opt in filtered_options:
        # Normalize for comparison (case-insensitive, trimmed)
        normalized = opt.strip().lower()
        if normalized not in seen:
            seen.add(normalized)
            unique_options.append(opt)
    
    if len(unique_options) < count:
        return unique_options
    
    return random.sample(unique_options, count)


def shuffle_options(correct: str, wrong_options: List[str]) -> List[str]:
    """Shuffle correct answer with wrong options"""
    # Ensure no duplicates in the final options
    all_options = [correct]
    seen_normalized = {correct.strip().lower()}
    
    for opt in wrong_options:
        normalized = opt.strip().lower()
        if normalized not in seen_normalized:
            all_options.append(opt)
            seen_normalized.add(normalized)
    
    random.shuffle(all_options)
    return all_options


def get_country_name(country_code: str) -> str:
    """Convert country code to full country name"""
    if not country_code:
        return ""
    
    country_map = {
        # European countries
        "ARG": "Argentina",
        "BRA": "Brazil", 
        "FRA": "France",
        "GER": "Germany",
        "ESP": "Spain",
        "ITA": "Italy",
        "POR": "Portugal",
        "ENG": "England",
        "NED": "Netherlands",
        "BEL": "Belgium",
        "CRO": "Croatia",
        "POL": "Poland",
        "WAL": "Wales",
        "SWE": "Sweden",
        "DEN": "Denmark",
        "UKR": "Ukraine",
        "CZE": "Czech Republic",
        "BUL": "Bulgaria",
        "SCO": "Scotland",
        "NIR": "Northern Ireland",
        "HUN": "Hungary",
        "URS": "Soviet Union",
        "TCH": "Czechoslovakia",
        "AUT": "Austria",
        "NOR": "Norway",
        "FIN": "Finland",
        "IRL": "Ireland",
        "SUI": "Switzerland",
        "SRB": "Serbia",
        "GBR": "Great Britain",
        "RUS": "Russia",
        
        # South American countries
        "URU": "Uruguay",
        "COL": "Colombia",
        "CHI": "Chile",
        "PER": "Peru",
        "ECU": "Ecuador",
        "VEN": "Venezuela",
        "BOL": "Bolivia",
        "PAR": "Paraguay",
        
        # North American countries
        "USA": "United States",
        "MEX": "Mexico",
        "CAN": "Canada",
        "CRC": "Costa Rica",
        "PAN": "Panama",
        "HON": "Honduras",
        "GUA": "Guatemala",
        "ESA": "El Salvador",
        "NIC": "Nicaragua",
        
        # African countries
        "NGA": "Nigeria",
        "SEN": "Senegal",
        "EGY": "Egypt",
        "ALG": "Algeria",
        "GAB": "Gabon",
        "CIV": "Ivory Coast",
        "CMR": "Cameroon",
        "TOG": "Togo",
        "MLI": "Mali",
        "LBR": "Liberia",
        "GHA": "Ghana",
        "ZAM": "Zambia",
        "MAR": "Morocco",
        "TUN": "Tunisia",
        "CGO": "Congo",
        "COD": "Democratic Republic of Congo",
        "GUI": "Guinea",
        "ETH": "Ethiopia",
        "KEN": "Kenya",
        "RSA": "South Africa",
        
        # Asian/Oceanic countries
        "JPN": "Japan",
        "KOR": "South Korea",
        "AUS": "Australia",
        "NZL": "New Zealand",
        "CHN": "China",
        "IND": "India",
        "IRN": "Iran",
        "KSA": "Saudi Arabia",
        "UAE": "United Arab Emirates",
        "QAT": "Qatar",
        "THA": "Thailand",
        "VIE": "Vietnam",
        "PHI": "Philippines"
    }
    
    return country_map.get(country_code.upper(), country_code)


def get_league_display_name(league_value: str) -> str:
    """Get display name for league"""
    league_names = {
        "premier_league": "Premier League",
        "la_liga": "La Liga",
        "bundesliga": "Bundesliga", 
        "serie_a": "Serie A",
        "ligue_1": "Ligue 1",
        "global": "International",
        "african": "African Football"
    }
    return league_names.get(league_value, league_value.title())


def format_stat_name(stat_name: str) -> str:
    """Format stat name for display"""
    if not stat_name:
        return ""
    
    # Common stat name mappings
    stat_display = {
        "gls": "Goals",
        "ast": "Assists", 
        "xG": "Expected Goals (xG)",
        "poss": "Possession %",
        "age": "Average Age"
    }
    
    return stat_display.get(stat_name, stat_name.title())


def create_question_dict(question: str, options: List[str], correct: str, 
                        category: str, sport: str = "football") -> Dict[str, Any]:
    """Create standardized question dictionary"""
    return {
        "question": question,
        "options": options,
        "correct_answer": correct,
        "category": category,
        "sport": sport
    }


def validate_question(question_dict: Dict[str, Any]) -> bool:
    """Validate that a question has all required fields and no duplicates"""
    required_fields = ["question", "options", "correct_answer", "category", "sport"]
    
    # Check required fields
    for field in required_fields:
        if field not in question_dict:
            return False
    
    # Check that correct answer is in options
    if question_dict["correct_answer"] not in question_dict["options"]:
        return False
    
    # Check for duplicate options
    options = question_dict["options"]
    if len(options) != len(set(options)):
        return False
    
    # Check minimum number of options
    if len(options) < 2:
        return False
    
    return True

def log_simple(message: str, level: str = "INFO") -> None:
    """Simple logging for debugging"""
    import datetime
    timestamp = datetime.datetime.now().strftime("%H:%M:%S")
    print(f"[{timestamp}] {level}: {message}")

def safe_random_choice(items: List[Any]) -> Any:
    """Safely choose random item from list"""
    if not items:
        return None
    return random.choice(items)

def deduplicate_preserving_order(items: List[str]) -> List[str]:
    """Remove duplicates while preserving order"""
    seen = set()
    result = []
    for item in items:
        if item not in seen:
            seen.add(item)
            result.append(item)
    return result


@lru_cache(maxsize=128)
def get_competition_teams(competition_id: int, season: int, min_count: int = 10) -> List[Tuple[int, str]]:
    """
    Get teams from specific competition/season with fallback logic.
    Returns list of (team_id, team_name) tuples.
    
    Fallback hierarchy:
    1. Same competition, same season (preferred)
    2. Same competition, adjacent seasons (±1 year) 
    3. Same country/tier competitions
    4. Global pool (last resort)
    """
    try:
        db_path = "/mnt/c/Users/hamza/OneDrive/Python_Scripts/VerveQ/data_cleaning/football_comprehensive.db"
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Try 1: Same competition, same season
        cursor.execute('''
            SELECT DISTINCT c.club_id, c.name
            FROM clubs c
            JOIN games g ON (c.club_id = g.home_club_id OR c.club_id = g.away_club_id)
            WHERE g.competition_id = ? AND g.season = ?
            AND c.name IS NOT NULL
            ORDER BY c.name
        ''', (competition_id, season))
        
        teams = cursor.fetchall()
        if len(teams) >= min_count:
            conn.close()
            return teams
        
        # Try 2: Same competition, adjacent seasons
        cursor.execute('''
            SELECT DISTINCT c.club_id, c.name
            FROM clubs c
            JOIN games g ON (c.club_id = g.home_club_id OR c.club_id = g.away_club_id)
            WHERE g.competition_id = ? AND g.season BETWEEN ? AND ?
            AND c.name IS NOT NULL
            ORDER BY c.name
        ''', (competition_id, season - 1, season + 1))
        
        teams = cursor.fetchall()
        if len(teams) >= min_count:
            conn.close()
            return teams
        
        # Try 3: Same competition, broader season range
        cursor.execute('''
            SELECT DISTINCT c.club_id, c.name
            FROM clubs c
            JOIN games g ON (c.club_id = g.home_club_id OR c.club_id = g.away_club_id)
            WHERE g.competition_id = ?
            AND c.name IS NOT NULL
            ORDER BY c.name
        ''', (competition_id,))
        
        teams = cursor.fetchall()
        if len(teams) >= min_count:
            conn.close()
            return teams
        
        # Try 4: Global pool (last resort)
        cursor.execute('''
            SELECT DISTINCT c.club_id, c.name
            FROM clubs c
            JOIN games g ON (c.club_id = g.home_club_id OR c.club_id = g.away_club_id)
            WHERE c.name IS NOT NULL
            ORDER BY RANDOM()
            LIMIT 50
        ''')
        
        teams = cursor.fetchall()
        conn.close()
        return teams
        
    except Exception as e:
        log_simple(f"Error fetching competition teams: {e}", "ERROR")
        # Return empty list on error
        return []


def get_league_aware_distractors(correct_team: str, competition_id: int, season: int, 
                                count: int = 3, db_conn=None) -> List[str]:
    """
    Get distractors from same competition, with fallback logic.
    - Never includes correct team
    - Deduplicates results  
    - Falls back to broader pools if needed
    """
    try:
        # Get teams from the competition
        competition_teams = get_competition_teams(competition_id, season, min_count=count + 1)
        
        # Filter out correct team and extract names
        team_names = []
        correct_normalized = normalize_name(correct_team)
        
        for team_id, team_name in competition_teams:
            if team_name and normalize_name(team_name) != correct_normalized:
                team_names.append(team_name)
        
        # Deduplicate while preserving order
        unique_names = deduplicate_preserving_order(team_names)
        
        # Return requested count
        if len(unique_names) >= count:
            return random.sample(unique_names, count)
        
        # If not enough, supplement with famous clubs but try to avoid obvious mismatches
        famous_clubs = [
            "Manchester United", "Real Madrid", "Barcelona", "Bayern Munich",
            "Liverpool", "Chelsea", "Arsenal", "Manchester City", "Juventus",
            "Paris Saint-Germain", "AC Milan", "Inter Milan", "Atletico Madrid",
            "Borussia Dortmund", "Tottenham", "Ajax", "Porto", "Benfica"
        ]
        
        # Filter out correct team from famous clubs too
        filtered_famous = [club for club in famous_clubs 
                          if normalize_name(club) != correct_normalized]
        
        # Add more teams from famous clubs if needed
        remaining_needed = count - len(unique_names)
        if remaining_needed > 0 and filtered_famous:
            additional = random.sample(filtered_famous, min(remaining_needed, len(filtered_famous)))
            unique_names.extend(additional)
        
        return unique_names[:count]
        
    except Exception as e:
        log_simple(f"Error getting league-aware distractors: {e}", "ERROR")
        
        # Fallback to basic famous clubs
        famous_clubs = [
            "Manchester United", "Real Madrid", "Barcelona", "Bayern Munich",
            "Liverpool", "Chelsea", "Arsenal", "Manchester City"
        ]
        correct_normalized = normalize_name(correct_team)
        filtered = [club for club in famous_clubs 
                   if normalize_name(club) != correct_normalized]
        
        return random.sample(filtered, min(count, len(filtered)))