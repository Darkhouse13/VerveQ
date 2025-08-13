"""
Helper functions for quiz question generation
"""

def get_random_clubs(conn, count, exclude_club_id=None):
    """Fetch random club names for distractors."""
    query = "SELECT name FROM clubs WHERE club_id != ? ORDER BY RANDOM() LIMIT ?"
    cursor = conn.execute(query, [exclude_club_id or -1, count])
    return [row[0] for row in cursor.fetchall()]

def get_random_player_names(conn, count, exclude_player_id=None):
    """Fetch random player names for distractors."""
    query = """
    SELECT DISTINCT p.name 
    FROM players p
    JOIN appearances a ON p.player_id = a.player_id
    WHERE p.player_id != ?
    ORDER BY RANDOM() 
    LIMIT ?
    """
    cursor = conn.execute(query, [exclude_player_id or -1, count])
    return [row[0] for row in cursor.fetchall()]

def format_currency(amount):
    """Format transfer fees consistently."""
    if amount >= 1_000_000:
        return f"€{amount / 1_000_000:.1f}M"
    elif amount >= 1_000:
        return f"€{amount / 1_000:.0f}K"
    else:
        return f"€{amount:,.0f}"

def format_season(date_str):
    """Convert date to season format (e.g., 2022/23)."""
    year = int(date_str[:4])
    return f"{year}/{str(year + 1)[2:]}"