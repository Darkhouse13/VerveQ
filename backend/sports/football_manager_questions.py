"""
Managerial Masterminds category questions for football quiz
"""

import sqlite3
import random
import logging
from typing import Dict, Any, Optional
from .quiz_helpers import get_random_clubs, get_random_player_names, format_currency, format_season
from .football_utils import format_score, get_team_short_name


class FootballManagerQuestions:
    """Managerial question generation methods"""
    
    def __init__(self, conn: Optional[sqlite3.Connection], sport_name: str = "football"):
        self.conn = conn
        self.sport_name = sport_name
        self.logger = logging.getLogger(__name__)
    
    def manager_head_to_head_question(self) -> Dict[str, Any]:
        """Ask about manager vs manager records."""
        if not self.conn:
            return None
            
        try:
            # Find managers with multiple encounters
            query = """
            SELECT home_club_manager_name, away_club_manager_name, 
                   COUNT(*) as games,
                   SUM(CASE WHEN home_club_goals > away_club_goals THEN 1 ELSE 0 END) as home_wins,
                   SUM(CASE WHEN home_club_goals < away_club_goals THEN 1 ELSE 0 END) as away_wins,
                   SUM(CASE WHEN home_club_goals = away_club_goals THEN 1 ELSE 0 END) as draws
            FROM games
            WHERE home_club_manager_name IS NOT NULL 
                AND away_club_manager_name IS NOT NULL
            GROUP BY home_club_manager_name, away_club_manager_name
            HAVING games >= 5
            ORDER BY RANDOM() LIMIT 1
            """
            
            result = self.conn.execute(query).fetchone()
            if not result:
                return None
                
            mgr1, mgr2, total, h_wins, a_wins, draws = result
            
            # Determine most common outcome
            if h_wins > a_wins and h_wins > draws:
                answer = f"{mgr1} wins"
            elif a_wins > h_wins and a_wins > draws:
                answer = f"{mgr2} wins"
            else:
                answer = "Draw"
                
            options = [
                f"{mgr1} wins",
                f"{mgr2} wins",
                "Draw",
                "1-0 wins"
            ]
            # Remove duplicate if answer is one of the first three
            if answer in options[:3]:
                options = options[:3] + ["2-1 wins"]
            random.shuffle(options)
            
            return {
                "question": f"In matches between {mgr1} and {mgr2}, what is the most common outcome?",
                "options": options,
                "correct_answer": answer,
                "explanation": f"Record: {mgr1} {h_wins}W-{draws}D-{a_wins}L {mgr2}",
                "category": "managerial",
                "difficulty": "advanced",
                "source": "database",
                "sport": self.sport_name
            }
        except Exception as e:
            self.logger.debug(f"Manager head to head question error: {e}")
            return None
    
    def giant_killing_question(self) -> Dict[str, Any]:
        """Ask about underdog victories."""
        if not self.conn:
            return None
            
        try:
            query = """
            SELECT g.season, hc.name as home_team, ac.name as away_team,
                   g.home_club_goals, g.away_club_goals,
                   CASE WHEN g.home_club_goals > g.away_club_goals 
                        THEN g.home_club_manager_name 
                        ELSE g.away_club_manager_name END as winner_mgr,
                   CASE WHEN g.home_club_goals > g.away_club_goals 
                        THEN hc.name ELSE ac.name END as winner_team
            FROM games g
            JOIN clubs hc ON g.home_club_id = hc.club_id
            JOIN clubs ac ON g.away_club_id = ac.club_id
            WHERE ABS(g.home_club_goals - g.away_club_goals) >= 3
                AND g.home_club_manager_name IS NOT NULL
                AND g.away_club_manager_name IS NOT NULL
            ORDER BY RANDOM() LIMIT 1
            """
            
            result = self.conn.execute(query).fetchone()
            if not result:
                return None
                
            season, home, away, h_goals, a_goals, winner_mgr, winner = result
            
            # Shorten team names
            home = get_team_short_name(home)
            away = get_team_short_name(away)
            winner = get_team_short_name(winner)
            
            loser = away if winner == home else home
            score = format_score(h_goals, a_goals)
            
            # Get other managers as distractors
            distractors_query = """
            SELECT DISTINCT home_club_manager_name FROM games 
            WHERE season = ? AND home_club_manager_name != ?
            ORDER BY RANDOM() LIMIT 3
            """
            
            distractors = [row[0] for row in self.conn.execute(distractors_query, [season, winner_mgr])]
            if len(distractors) < 3:
                return None
                
            options = [winner_mgr] + distractors
            random.shuffle(options)
            
            return {
                "question": f"Who managed {winner} in their {score} victory over {loser} in {season}?",
                "options": options,
                "correct_answer": winner_mgr,
                "explanation": f"{winner_mgr} led {winner} to a famous {score} win",
                "category": "managerial",
                "difficulty": "intermediate",
                "source": "database",
                "sport": self.sport_name
            }
        except Exception as e:
            self.logger.debug(f"Giant killing question error: {e}")
            return None
    
    def formation_tactics_question(self) -> Dict[str, Any]:
        """Ask about formations used in specific matches."""
        if not self.conn:
            return None
            
        try:
            query = """
            SELECT date, hc.name as home_club, ac.name as away_club, 
                   home_club_goals, away_club_goals,
                   home_club_formation, away_club_formation
            FROM games g
            JOIN clubs hc ON g.home_club_id = hc.club_id
            JOIN clubs ac ON g.away_club_id = ac.club_id
            JOIN competitions comp ON g.competition_id = comp.competition_id
            WHERE home_club_formation IS NOT NULL 
                AND away_club_formation IS NOT NULL
                AND ABS(home_club_goals - away_club_goals) >= 2
                AND (
                    comp.competition_code IN ('premier-league', 'laliga', 'serie-a', 
                        'bundesliga', 'ligue-1', 'champions-league', 'europa-league')
                    OR (g.round LIKE '%Final%' OR g.round LIKE '%final%')
                )
            ORDER BY RANDOM() LIMIT 1
            """
            
            result = self.conn.execute(query).fetchone()
            if not result:
                return None
                
            date, home, away, h_goals, a_goals, h_form, a_form = result
            
            # Shorten team names
            home = get_team_short_name(home)
            away = get_team_short_name(away)
            
            if h_goals > a_goals:
                winner, formation, score = home, h_form, format_score(h_goals, a_goals)
            else:
                winner, formation, score = away, a_form, format_score(a_goals, h_goals)
                
            # Common formations as distractors
            all_formations = ["4-4-2", "4-3-3", "3-5-2", "4-2-3-1", "5-3-2"]
            options = [formation]
            for f in all_formations:
                if f != formation and len(options) < 4:
                    options.append(f)
            random.shuffle(options)
            
            return {
                "question": f"What formation did {winner} use in their {score} win on {date[:10]}?",
                "options": options,
                "correct_answer": formation,
                "explanation": f"{winner} dominated with a {formation} formation",
                "category": "managerial",
                "difficulty": "advanced",
                "source": "database",
                "sport": self.sport_name
            }
        except Exception as e:
            self.logger.debug(f"Formation tactics question error: {e}")
            return None