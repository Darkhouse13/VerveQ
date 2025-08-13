"""
Player Deep Dives category questions for football quiz
"""

import sqlite3
import random
import logging
from typing import Dict, Any, Optional
from .quiz_helpers import get_random_clubs, get_random_player_names, format_currency, format_season
from .football_utils import get_team_short_name


class FootballPlayerQuestions:
    """Player performance question generation methods"""
    
    def __init__(self, conn: Optional[sqlite3.Connection], sport_name: str = "football"):
        self.conn = conn
        self.sport_name = sport_name
        self.logger = logging.getLogger(__name__)
    
    def playmaker_assist_question(self) -> Dict[str, Any]:
        """Ask about assist providers for key goals."""
        if not self.conn:
            return None
            
        try:
            query = """
            SELECT p1.name as scorer, p2.name as assist_provider,
                   c.name as club_name, ge.minute, comp.name as competition,
                   g.season, g.date,
                   CASE 
                       WHEN ge.club_id = g.home_club_id THEN ac.name
                       ELSE hc.name
                   END as opponent,
                   CASE 
                       WHEN ge.club_id = g.home_club_id THEN 'home'
                       ELSE 'away'
                   END as venue
            FROM game_events ge
            JOIN players p1 ON ge.player_id = p1.player_id
            JOIN players p2 ON ge.player_assist_id = p2.player_id
            JOIN clubs c ON ge.club_id = c.club_id
            JOIN games g ON ge.game_id = g.game_id
            JOIN clubs hc ON g.home_club_id = hc.club_id
            JOIN clubs ac ON g.away_club_id = ac.club_id
            JOIN competitions comp ON g.competition_id = comp.competition_id
            WHERE ge.type = 'Goals' AND ge.player_assist_id IS NOT NULL
                AND ge.minute >= 80
                AND comp.competition_code IN ('premier-league', 'laliga', 'serie-a', 'bundesliga', 
                    'ligue-1', 'champions-league', 'europa-league')
            ORDER BY RANDOM() LIMIT 1
            """
            
            result = self.conn.execute(query).fetchone()
            if not result:
                return None
                
            scorer, provider, club, minute, comp, season, date, opponent, venue = result
            
            # Shorten club names
            club = get_team_short_name(club)
            opponent = get_team_short_name(opponent)
            
            # Format venue text
            venue_text = "at home" if venue == "home" else f"away at {opponent}"
            
            # Get teammates as distractors
            distractors = get_random_player_names(self.conn, 3, None)
            if len(distractors) < 3:
                return None
                
            options = [provider] + distractors
            random.shuffle(options)
            
            return {
                "question": f"Who assisted {scorer}'s {minute}th minute goal for {club} {venue_text} in {season}?",
                "options": options,
                "correct_answer": provider,
                "explanation": f"{provider} set up {scorer} in the {comp} match against {opponent}",
                "category": "player_performance",
                "difficulty": "advanced",
                "source": "database",
                "sport": self.sport_name
            }
        except Exception as e:
            self.logger.debug(f"Playmaker assist question error: {e}")
            return None
    
    def super_sub_question(self) -> Dict[str, Any]:
        """Ask about prolific substitute scorers."""
        if not self.conn:
            return None
            
        try:
            query = """
            SELECT p.name as player_name, c.name as club_name, g.season, COUNT(*) as sub_goals
            FROM game_events ge
            JOIN game_lineups gl ON ge.game_id = gl.game_id 
                AND ge.player_id = gl.player_id
            JOIN players p ON ge.player_id = p.player_id
            JOIN clubs c ON ge.club_id = c.club_id
            JOIN games g ON ge.game_id = g.game_id
            WHERE ge.type = 'Goals' AND gl.position IS NULL
            GROUP BY p.player_id, p.name, c.name, g.season
            HAVING sub_goals >= 3
            ORDER BY RANDOM() LIMIT 1
            """
            
            result = self.conn.execute(query).fetchone()
            if not result:
                return None
                
            player, club, season, goals = result
            
            # Get other players as distractors
            distractors = get_random_player_names(self.conn, 3, None)
            if len(distractors) < 3:
                return None
                
            options = [player] + distractors
            random.shuffle(options)
            
            return {
                "question": f"Who scored the most substitute goals for {club} in {season}?",
                "options": options,
                "correct_answer": player,
                "explanation": f"{player} scored {goals} goals coming off the bench",
                "category": "player_performance",
                "difficulty": "intermediate",
                "source": "database",
                "sport": self.sport_name
            }
        except Exception as e:
            self.logger.debug(f"Super sub question error: {e}")
            return None
    
    def team_captain_question(self) -> Dict[str, Any]:
        """Ask about team captains in important matches."""
        if not self.conn:
            return None
            
        try:
            query = """
            SELECT p.name as player_name, c.name as club_name, comp.name as competition, g.round
            FROM game_lineups gl
            JOIN players p ON gl.player_id = p.player_id
            JOIN clubs c ON gl.club_id = c.club_id
            JOIN games g ON gl.game_id = g.game_id
            JOIN competitions comp ON g.competition_id = comp.competition_id
            WHERE gl.team_captain = 1 
                AND (g.round LIKE '%Final%' OR g.round LIKE '%final%')
                AND comp.competition_code IN ('premier-league', 'laliga', 'serie-a', 'bundesliga', 
                    'ligue-1', 'eredivisie', 'liga-nos', 'scottish-premiership',
                    'champions-league', 'europa-league', 'conference-league',
                    'fa-cup', 'copa-del-rey', 'coppa-italia', 'dfb-pokal', 'coupe-de-france')
            ORDER BY RANDOM() LIMIT 1
            """
            
            result = self.conn.execute(query).fetchone()
            if not result:
                return None
                
            captain, club, competition, round_name = result
            
            # Shorten club name
            club = get_team_short_name(club)
            
            # Get other players as distractors
            distractors = get_random_player_names(self.conn, 3, None)
            if len(distractors) < 3:
                return None
                
            options = [captain] + distractors
            random.shuffle(options)
            
            return {
                "question": f"Who captained {club} in the {competition} {round_name}?",
                "options": options,
                "correct_answer": captain,
                "explanation": f"{captain} led {club} as captain",
                "category": "player_performance",
                "difficulty": "intermediate",
                "source": "database",
                "sport": self.sport_name
            }
        except Exception as e:
            self.logger.debug(f"Team captain question error: {e}")
            return None