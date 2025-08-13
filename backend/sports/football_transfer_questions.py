"""
Transfer Market category questions for football quiz
"""

import sqlite3
import random
import logging
from typing import Dict, Any, Optional
from .quiz_helpers import get_random_clubs, get_random_player_names, format_currency, format_season
from .football_utils import get_team_short_name, is_well_known_team


class FootballTransferQuestions:
    """Transfer market question generation methods"""
    
    def __init__(self, conn: Optional[sqlite3.Connection], sport_name: str = "football"):
        self.conn = conn
        self.sport_name = sport_name
        self.logger = logging.getLogger(__name__)
    
    def transfer_record_signing_question(self) -> Dict[str, Any]:
        """Ask about a club's most expensive signing in a season."""
        if not self.conn:
            return None
            
        try:
            # Find a club with multiple transfers in a season
            query = """
            SELECT club_id, club_name, season, COUNT(*) as transfer_count
            FROM (
                SELECT t.club_id, c.name as club_name, 
                       SUBSTR(t.transfer_date, 1, 4) || '/' || 
                       SUBSTR(CAST(CAST(SUBSTR(t.transfer_date, 1, 4) AS INTEGER) + 1 AS TEXT), 3, 2) AS season
                FROM transfers t
                JOIN clubs c ON t.club_id = c.club_id
                WHERE t.fee > 0 AND t.transfer_type = 'normal'
            ) GROUP BY club_id, club_name, season
            HAVING transfer_count >= 4
            ORDER BY RANDOM() LIMIT 1
            """
            
            result = self.conn.execute(query).fetchone()
            if not result:
                return None
                
            club_id, club_name, season = result[0], result[1], result[2]
            
            # Get top 4 signings for that club/season
            signings_query = """
            SELECT player_name, fee, from_club_name
            FROM transfers
            WHERE club_id = ? AND transfer_type = 'normal' AND fee > 0
                AND SUBSTR(transfer_date, 1, 4) || '/' || 
                    SUBSTR(CAST(CAST(SUBSTR(transfer_date, 1, 4) AS INTEGER) + 1 AS TEXT), 3, 2) = ?
            ORDER BY fee DESC LIMIT 4
            """
            
            signings = self.conn.execute(signings_query, [club_id, season]).fetchall()
            if len(signings) < 4:
                return None
                
            record_player, record_fee, from_club = signings[0]
            options = [s[0] for s in signings]
            random.shuffle(options)
            
            return {
                "question": f"In the {season} season, who became {club_name}'s most expensive signing?",
                "options": options,
                "correct_answer": record_player,
                "explanation": f"{record_player} joined from {from_club} for {format_currency(record_fee)}",
                "category": "transfer_market",
                "difficulty": "intermediate",
                "source": "database",
                "sport": self.sport_name
            }
        except Exception as e:
            self.logger.debug(f"Transfer record signing question error: {e}")
            return None
    
    def transfer_profit_question(self) -> Dict[str, Any]:
        """Ask about transfer profits from player sales."""
        if not self.conn:
            return None
            
        try:
            query = """
            SELECT DISTINCT
                t1.player_name, t1.club_id, c.name as club_name,
                t1.fee as buy_fee, t2.fee as sell_fee, t2.club_name as sold_to
            FROM transfers t1
            JOIN transfers t2 ON t1.player_id = t2.player_id 
                AND t2.from_club_id = t1.club_id
                AND t2.transfer_date > t1.transfer_date
            JOIN clubs c ON t1.club_id = c.club_id
            WHERE t1.fee > 0 AND t2.fee > 0
                AND t1.transfer_type = 'normal' AND t2.transfer_type = 'normal'
            ORDER BY RANDOM() LIMIT 1
            """
            
            result = self.conn.execute(query).fetchone()
            if not result:
                return None
                
            player, club_id, club, buy_fee, sell_fee, sold_to = result
            
            # Generate price-based distractors
            options = [
                format_currency(sell_fee),
                format_currency(int(sell_fee * 0.7)),
                format_currency(int(sell_fee * 1.3)),
                format_currency(int(sell_fee * 1.5))
            ]
            random.shuffle(options)
            
            profit = sell_fee - buy_fee
            profit_text = f"profit of {format_currency(profit)}" if profit > 0 else f"loss of {format_currency(-profit)}"
            
            return {
                "question": f"{club} signed {player} for {format_currency(buy_fee)} and later sold him. What was the transfer fee?",
                "options": options,
                "correct_answer": format_currency(sell_fee),
                "explanation": f"Sold to {sold_to} for {format_currency(sell_fee)}, a {profit_text}",
                "category": "transfer_market",
                "difficulty": "intermediate",
                "source": "database",
                "sport": self.sport_name
            }
        except Exception as e:
            self.logger.debug(f"Transfer profit question error: {e}")
            return None
    
    def market_value_fluctuation_question(self) -> Dict[str, Any]:
        """Ask about player value changes at a club."""
        if not self.conn:
            return None
            
        try:
            # Find players with significant value changes at well-known clubs
            query = """
            SELECT p.name as player_name, c.name as club_name, 
                   MIN(pv.market_value_in_eur) as start_value,
                   MAX(pv.market_value_in_eur) as end_value,
                   pv.current_club_id
            FROM player_valuations pv
            JOIN players p ON pv.player_id = p.player_id
            JOIN clubs c ON pv.current_club_id = c.club_id
            WHERE c.club_id IN (
                SELECT DISTINCT home_club_id FROM games g
                JOIN competitions comp ON g.competition_id = comp.competition_id
                WHERE comp.competition_code IN ('premier-league', 'laliga', 'serie-a', 
                    'bundesliga', 'ligue-1', 'eredivisie', 'liga-nos')
                UNION
                SELECT DISTINCT away_club_id FROM games g
                JOIN competitions comp ON g.competition_id = comp.competition_id
                WHERE comp.competition_code IN ('premier-league', 'laliga', 'serie-a', 
                    'bundesliga', 'ligue-1', 'eredivisie', 'liga-nos')
            )
            GROUP BY p.player_id, p.name, c.name, pv.current_club_id
            HAVING COUNT(DISTINCT date) >= 5
                AND end_value > start_value * 1.5
            ORDER BY RANDOM() LIMIT 1
            """
            
            result = self.conn.execute(query).fetchone()
            if not result:
                return None
                
            player, club, start_val, end_val, club_id = result
            
            # Shorten club name
            club = get_team_short_name(club)
            
            increase_pct = round((end_val - start_val) * 100 / start_val)
            
            # Get other players from same club as distractors
            distractors_query = """
            SELECT DISTINCT p.name
            FROM player_valuations pv
            JOIN players p ON pv.player_id = p.player_id
            WHERE pv.current_club_id = ? AND p.name != ?
            ORDER BY RANDOM() LIMIT 3
            """
            
            distractors = [row[0] for row in self.conn.execute(distractors_query, [club_id, player])]
            if len(distractors) < 3:
                return None
                
            options = [player] + distractors
            random.shuffle(options)
            
            return {
                "question": f"Which player saw the biggest market value increase at {club}?",
                "options": options,
                "correct_answer": player,
                "explanation": f"{player}'s value increased by {increase_pct}% from {format_currency(start_val)} to {format_currency(end_val)}",
                "category": "transfer_market",
                "difficulty": "intermediate",
                "source": "database",
                "sport": self.sport_name
            }
        except Exception as e:
            self.logger.debug(f"Market value question error: {e}")
            return None