"""
Utility functions for football questions
"""

from typing import Tuple, Union


def format_score(home_goals: Union[int, float], away_goals: Union[int, float]) -> str:
    """Format a football score, converting floats to ints"""
    # Ensure non-negative scores
    home = max(0, int(home_goals))
    away = max(0, int(away_goals))
    return f"{home}-{away}"


def get_team_short_name(full_name: str) -> str:
    """Convert full team name to common short name"""
    
    # Extended special cases mapping (most comprehensive approach)
    special_cases = {
        # English Teams
        "The Celtic Football Club": "Celtic",
        "Rangers Football Club": "Rangers",
        "Manchester United Football Club": "Manchester United",
        "Liverpool Football Club": "Liverpool",
        "Arsenal Football Club": "Arsenal",
        "Chelsea Football Club": "Chelsea",
        "Tottenham Hotspur Football Club": "Tottenham",
        "West Ham United Football Club": "West Ham",
        "Leicester City Football Club": "Leicester City",
        "Everton Football Club": "Everton",
        "Newcastle United Football Club": "Newcastle United",
        "Aston Villa Football Club": "Aston Villa",
        "Crystal Palace Football Club": "Crystal Palace",
        "Brighton & Hove Albion Football Club": "Brighton",
        "Wolverhampton Wanderers Football Club": "Wolves",
        "Southampton Football Club": "Southampton",
        "Fulham Football Club": "Fulham",
        "Leeds United Football Club": "Leeds United",
        "Burnley Football Club": "Burnley",
        "Sheffield United Football Club": "Sheffield United",
        "Norwich City Football Club": "Norwich City",
        "Watford Football Club": "Watford",
        "AFC Bournemouth": "Bournemouth",
        "Brentford Football Club": "Brentford",
        
        # Spanish Teams
        "Real Madrid Club de Fútbol": "Real Madrid",
        "Futbol Club Barcelona": "Barcelona",
        "Club Atlético de Madrid": "Atlético Madrid",
        "Atlético de Madrid": "Atlético Madrid",
        "Atletico Madrid": "Atlético Madrid",
        "Valencia Club de Fútbol S. A. D.": "Valencia",
        "Sevilla Fútbol Club": "Sevilla",
        "Real Betis Balompié": "Real Betis",
        "Athletic Club Bilbao": "Athletic Bilbao",
        "Real Sociedad de Fútbol": "Real Sociedad",
        "Villarreal Club de Fútbol D.": "Villarreal",
        "Celta de Vigo": "Celta Vigo",
        "Rayo Vallecano de Madrid": "Rayo Vallecano",
        "Getafe Club de Fútbol": "Getafe",
        "Deportivo Alavés": "Alavés",
        "Cádiz Club de Fútbol": "Cádiz",
        "Elche Club de Fútbol": "Elche",
        "Real Club Deportivo Mallorca": "Mallorca",
        "Reial Club Deportiu Espanyol de Barcelona S.A.D.": "Espanyol",
        
        # Italian Teams
        "Football Club Internazionale Milano": "Inter Milan",
        "Football Club Internazionale Milano S.p.A.": "Inter Milan",
        "Associazione Calcio Milan": "AC Milan",
        "Juventus Football Club": "Juventus",
        "Juventus Football Club S.p.A.": "Juventus",
        "Società Sportiva Calcio Napoli": "Napoli",
        "Società Sportiva Calcio Napoli S.p.A.": "Napoli",
        "Società Sportiva Lazio": "Lazio",
        "Società Sportiva Lazio S.p.A.": "Lazio",
        "Associazione Sportiva Roma": "AS Roma",
        "Associazione Sportiva Roma S.p.A.": "AS Roma",
        "Atalanta Bergamasca Calcio S.p.a.": "Atalanta",
        "Atalanta Bergamasca Calcio S.p.A.": "Atalanta",
        "UC Sampdoria": "Sampdoria",
        "Unione Calcio Sampdoria S.p.A.": "Sampdoria",
        "US Sassuolo": "Sassuolo",
        "Unione Sportiva Sassuolo Calcio S.r.l.": "Sassuolo",
        "Genoa Cricket and Football Club": "Genoa",
        "Genoa Cricket and Football Club S.p.A.": "Genoa",
        "Bologna Football Club 1909": "Bologna",
        "Bologna Football Club 1909 S.p.A.": "Bologna",
        "Torino Football Club": "Torino",
        "Torino Football Club S.p.A.": "Torino",
        "ACF Fiorentina": "Fiorentina",
        "ACF Fiorentina S.p.A.": "Fiorentina",
        "Hellas Verona Football Club": "Verona",
        "Hellas Verona Football Club S.p.A.": "Verona",
        "Udinese Calcio": "Udinese",
        "Udinese Calcio S.p.A.": "Udinese",
        "Spezia Calcio": "Spezia",
        "Spezia Calcio S.r.l.": "Spezia",
        "Venezia Football Club": "Venezia",
        "Venezia Football Club S.r.l.": "Venezia",
        "Empoli Football Club": "Empoli",
        "Empoli Football Club S.p.A.": "Empoli",
        "Cagliari Calcio": "Cagliari",
        "Cagliari Calcio S.p.A.": "Cagliari",
        "Salernitana": "Salernitana",
        "Unione Sportiva Salernitana 1919 S.r.l.": "Salernitana",
        
        # German Teams
        "Fußball-Club Bayern München": "Bayern Munich",
        "Ballspielverein Borussia 09 e.V. Dortmund": "Borussia Dortmund",
        "Borussia Verein für Leibesübungen 1900 Mönchengladbach": "Borussia Mönchengladbach",
        "Bayer 04 Leverkusen Fußball GmbH": "Bayer Leverkusen",
        "RasenBallsport Leipzig": "RB Leipzig",
        "Verein für Bewegungsspiele Stuttgart 1893": "VfB Stuttgart",
        "Eintracht Frankfurt Fußball AG": "Eintracht Frankfurt",
        "Turn- und Sportgemeinschaft 1899 Hoffenheim Fußball-Spielbetriebs": "TSG Hoffenheim",
        "1. Fußball-Club Union Berlin": "Union Berlin",
        "Hertha Berliner Sport-Club": "Hertha Berlin",
        "Sport-Club Freiburg": "SC Freiburg",
        "1. Fußball-Club Köln 01/07": "FC Köln",
        "Fortuna Düsseldorf": "Fortuna Düsseldorf",
        "FC Schalke 04": "Schalke 04",
        "Schalke 04": "Schalke 04",
        "Bayern München": "Bayern Munich",
        "Hamburger SV": "Hamburg",
        "Hannover 96": "Hannover",
        "VfL Wolfsburg": "Wolfsburg",
        "Werder Bremen": "Werder Bremen",
        "FC Augsburg": "Augsburg",
        "1. FSV Mainz 05": "Mainz 05",
        "Arminia Bielefeld": "Arminia Bielefeld",
        "1. FC Augsburg 1907": "Augsburg",
        "FC Augsburg 1907": "Augsburg",
        "1. FSV Mainz 05 und Sportverein": "Mainz 05",
        "Hertha Berliner Sport-Club von 1892": "Hertha Berlin",
        "Hertha BSC Berlin": "Hertha Berlin",
        
        # French Teams
        "Paris Saint-Germain Football Club": "PSG",
        "Olympique de Marseille": "Marseille",
        "Olympique Lyonnais": "Lyon",
        "Association sportive de Monaco Football Club": "AS Monaco",
        "Lille Olympique Sporting Club": "Lille",
        "Stade Rennais Football Club": "Rennes",
        "OGC Nice": "Nice",
        "Racing Club de Lens": "Lens",
        "Montpellier Hérault Sport Club": "Montpellier",
        "Stade de Reims": "Reims",
        "FC Nantes": "Nantes",
        "Angers Sporting Club de l'Ouest": "Angers",
        "FC Metz": "Metz",
        "Dijon FCO": "Dijon",
        "Nîmes Olympique": "Nîmes",
        "Amiens Sporting Club": "Amiens",
        
        # Dutch Teams
        "AFC Ajax Amsterdam": "Ajax",
        "Eindhovense Voetbalvereniging Philips Sport Vereniging": "PSV Eindhoven",
        "Feyenoord Rotterdam": "Feyenoord",
        "AZ Alkmaar": "AZ Alkmaar",
        "FC Utrecht": "Utrecht",
        "FC Groningen": "Groningen",
        "Vitesse Arnhem": "Vitesse",
        "Willem II Tilburg": "Willem II",
        "PEC Zwolle": "PEC Zwolle",
        "Heracles Almelo": "Heracles",
        
        # Portuguese Teams
        "Futebol Clube do Porto": "FC Porto",
        "Sport Lisboa e Benfica": "Benfica",
        "Sporting Clube de Portugal": "Sporting CP",
        "Sporting Clube de Braga": "Braga",
        "Vitória Sport Clube": "Vitória SC",
        "Boavista Futebol Clube": "Boavista",
        "Rio Ave Futebol Clube": "Rio Ave",
        "Moreirense Futebol Clube": "Moreirense",
        "Portimonense SC": "Portimonense",
        
        # Other leagues
        "Galatasaray Spor Kulübü": "Galatasaray",
        "Fenerbahçe Spor Kulübü": "Fenerbahçe",
        "Beşiktaş Jimnastik Kulübü": "Beşiktaş"
    }
    
    # Check special cases first
    if full_name in special_cases:
        return special_cases[full_name]
    
    # If not in special cases, apply pattern-based shortening
    short_name = full_name
    
    # Extended patterns to remove (in order of specificity)
    remove_patterns = [
        # Very specific patterns first
        "Turn- und Sportgemeinschaft",
        "Verein für Bewegungsspiele",
        "Ballspielverein Borussia",
        "Fußball-Spielbetriebs",
        "Bergamasca Calcio",
        "Cricket and Football Club",
        "Hérault Sport Club",
        "Sporting Club de l'Ouest",
        "Club de Fútbol S. A. D.",
        "Jimnastik Kulübü",
        "Spor Kulübü",
        "Sport Vereniging",
        "Voetbalvereniging",
        
        # Medium specificity
        "Football Club",
        "Fútbol Club", 
        "Futbol Club",
        "Futebol Clube",
        "Calcio",
        "Società Sportiva",
        "Associazione Calcio",
        "Associazione Sportiva",
        "Sport Club",
        "Sporting Club",
        "Club de Fútbol",
        "Real Club",
        "Olympique",
        "Stade",
        
        # Lower specificity
        "S.p.A.",
        "S.p.a.",
        "S.r.l.",
        "S.A.D.",
        "S.A.",
        "S.L.",
        "S.C.",
        "A.F.C.",
        "F.C.",
        "FC",
        "CF",
        "GmbH",
        "e.V.",
        "01/07",
        "1909",
        "1893",
        "1899",
        "1900",
        "09",
        "04",
        "05",
        "96",
        
        # Generic terms
        "Football",
        "Fútbol",
        "Futbol", 
        "Futebol",
        "Fußball",
        "Association",
        "Sporting",
        "Deportivo",
        "Athletic",
        "Club",
        "Verein",
        "Union"
    ]
    
    # Apply pattern removal
    for pattern in remove_patterns:
        short_name = short_name.replace(pattern, "").strip()
        # Clean up extra spaces after each removal
        short_name = " ".join(short_name.split())
    
    # Final cleanup - remove leading/trailing common words and artifacts
    words_to_remove_from_ends = ["de", "del", "di", "do", "da", "des", "1.", "FC", "CF", "AC", "AS", "SC", "UC", "US", "-", "und", "1907", "1893", "1899", "1900", "Team", "Dubai"]
    words = short_name.split()
    
    # Remove from beginning
    while words and (words[0] in words_to_remove_from_ends or words[0].startswith('-')):
        words = words[1:]
    
    # Remove from end  
    while words and (words[-1] in words_to_remove_from_ends or words[-1].startswith('-')):
        words = words[:-1]
    
    short_name = " ".join(words) if words else short_name
    
    # Clean up any remaining artifacts
    short_name = short_name.replace(" -", "").replace("- ", "").strip()
    short_name = " ".join(short_name.split())  # Remove extra spaces
    
    # If we ended up with empty string or very short, return original
    if not short_name or len(short_name) < 3:
        return full_name
    
    return short_name


def is_well_known_team(team_name: str) -> bool:
    """Check if a team is well-known (simple heuristic)"""
    well_known_leagues = [
        # English
        "Manchester", "Liverpool", "Arsenal", "Chelsea", "Tottenham",
        "Leicester", "Everton", "Newcastle", "West Ham", "Aston Villa",
        # Spanish
        "Real Madrid", "Barcelona", "Atlético", "Sevilla", "Valencia",
        "Villarreal", "Athletic", "Real Sociedad", "Betis",
        # Italian
        "Juventus", "Milan", "Inter", "Roma", "Napoli", "Lazio",
        "Fiorentina", "Atalanta", "Torino",
        # German
        "Bayern", "Dortmund", "Leipzig", "Leverkusen", "Schalke",
        "Wolfsburg", "Frankfurt", "Mönchengladbach",
        # French
        "Paris", "PSG", "Marseille", "Lyon", "Monaco", "Lille",
        "Nice", "Rennes", "Lens",
        # Others
        "Ajax", "PSV", "Feyenoord", "Porto", "Benfica", "Sporting",
        "Celtic", "Rangers", "Galatasaray", "Fenerbahçe", "Beşiktaş"
    ]
    
    return any(known in team_name for known in well_known_leagues)


def is_well_known_player(player_name: str, goals: int = 0) -> bool:
    """Check if a player is well-known (simple heuristic)"""
    # If they scored many goals, they're probably notable
    if goals >= 20:
        return True
    
    # List of known player surnames
    well_known_surnames = [
        "Ronaldo", "Messi", "Mbappé", "Haaland", "Neymar", "Benzema",
        "Lewandowski", "Salah", "De Bruyne", "Kane", "Son", "Mané",
        "Van Dijk", "Alisson", "Courtois", "Modrić", "Kroos", "Casemiro",
        "Griezmann", "Félix", "Sterling", "Rashford", "Bruno Fernandes",
        "Mount", "Foden", "Saka", "Bellingham", "Vinícius", "Rodrygo",
        "Pedri", "Gavi", "Müller", "Kimmich", "Goretzka", "Davies",
        "Sané", "Gnabry", "Immobile", "Martínez", "Vlahović", "Osimhen",
        "Chiesa", "Barella", "Verratti", "Marquinhos", "Hakimi", "Donnarumma"
    ]
    
    return any(surname in player_name for surname in well_known_surnames)