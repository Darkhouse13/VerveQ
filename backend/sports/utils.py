"""
Utility functions for VerveQ sports quiz game.
Simple, focused helpers that support the core game functionality.
"""

import random
import re
from typing import List, Dict, Any, Optional


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