"""
Base football question generators - Part 1
"""

import sqlite3
import random
import logging
from typing import Dict, Any, Optional
from .football_utils import format_score, get_team_short_name, is_well_known_team, is_well_known_player


class FootballQuestionGeneratorsBase:
    """Base question generation methods for football quiz"""
    
    def __init__(self, conn: Optional[sqlite3.Connection], sport_name: str = "football"):
        self.conn = conn
        self.sport_name = sport_name
        self.logger = logging.getLogger(__name__)
    
    def high_scoring_match_question(self) -> Dict[str, Any]:
        """Generate question about high-scoring matches"""
        if not self.conn:
            return None
            
        cursor = self.conn.cursor()
        cursor.execute("""
            SELECT 
                hc.name as home_team, ac.name as away_team,
                g.home_club_goals, g.away_club_goals,
                g.stadium, c.name as competition, g.season
            FROM games g
            JOIN clubs hc ON g.home_club_id = hc.club_id
            JOIN clubs ac ON g.away_club_id = ac.club_id
            JOIN competitions c ON g.competition_id = c.competition_id
            WHERE (g.home_club_goals + g.away_club_goals) >= 6
            AND c.competition_code IN ('premier-league', 'laliga', 'serie-a', 'bundesliga', 'ligue-1', 'fa-cup', 'champions-league', 'europa-league')
            ORDER BY RANDOM() LIMIT 1
        """)
        
        result = cursor.fetchone()
        if not result:
            return None
        
        home_team, away_team, home_goals, away_goals, stadium, competition, season = result
        home_team = get_team_short_name(home_team)
        away_team = get_team_short_name(away_team)
        final_score = format_score(home_goals, away_goals)
        
        # Generate plausible score distractors
        distractors = [
            format_score(home_goals-1, away_goals+1),
            format_score(home_goals+1, away_goals-1),
            format_score(home_goals, away_goals+1)
        ]
        options = distractors + [final_score]
        random.shuffle(options)
        
        return {
            "question": f"What was the final score when {home_team} faced {away_team} at {stadium} in the {season} {competition} season?",
            "options": options,
            "correct_answer": final_score,
            "explanation": f"The match ended {final_score}, with {int(home_goals + away_goals)} total goals scored at {stadium}.",
            "category": "high_scoring_matches",
            "difficulty": "beginner",
            "source": "database",
            "sport": self.sport_name
        }
    
    def stadium_attendance_question(self) -> Dict[str, Any]:
        """Generate question about stadium attendance"""
        if not self.conn:
            return None
            
        cursor = self.conn.cursor()
        cursor.execute("""
            SELECT g.stadium, g.attendance, hc.name as home_team, ac.name as away_team, g.date
            FROM games g
            JOIN clubs hc ON g.home_club_id = hc.club_id
            JOIN clubs ac ON g.away_club_id = ac.club_id
            WHERE g.attendance > 50000 AND g.attendance IS NOT NULL
            AND g.competition_id IN (
                SELECT competition_id FROM competitions 
                WHERE competition_code IN ('premier-league', 'laliga', 'serie-a', 'bundesliga', 'ligue-1', 'eredivisie')
            )
            ORDER BY RANDOM() LIMIT 1
        """)
        
        result = cursor.fetchone()
        if not result:
            return None
        
        stadium, attendance, home_team, away_team, date = result
        home_team = get_team_short_name(home_team)
        away_team = get_team_short_name(away_team)
        attendance = int(attendance)
        
        # Generate realistic distractors
        distractors = [
            attendance - random.randint(5000, 10000),
            attendance + random.randint(5000, 10000),
            attendance - random.randint(2000, 4000)
        ]
        options = distractors + [attendance]
        random.shuffle(options)
        
        return {
            "question": f"What was the approximate attendance for the {home_team} vs {away_team} match at {stadium} on {date}?",
            "options": [f"{opt:,}" for opt in options],
            "correct_answer": f"{attendance:,}",
            "explanation": f"The attendance was {attendance:,} spectators.",
            "category": "stadium_records",
            "difficulty": "intermediate",
            "source": "database",
            "sport": self.sport_name
        }
    
    def player_goals_question(self) -> Dict[str, Any]:
        """Generate question about player goals"""
        if not self.conn:
            return None
            
        cursor = self.conn.cursor()
        cursor.execute("""
            SELECT
                p.name, g.season, c.name as club, COUNT(ge.game_event_id) as goals
            FROM game_events ge
            JOIN players p ON ge.player_id = p.player_id
            JOIN games g ON ge.game_id = g.game_id
            JOIN clubs c ON ge.club_id = c.club_id
            WHERE ge.type = 'Goals'
            AND g.competition_id IN (
                SELECT competition_id FROM competitions 
                WHERE competition_code IN ('premier-league', 'laliga', 'serie-a', 'bundesliga', 'ligue-1')
            )
            GROUP BY p.player_id, g.season, c.club_id
            HAVING goals >= 15
            ORDER BY goals DESC, RANDOM() LIMIT 1
        """)
        
        result = cursor.fetchone()
        if not result:
            return None
        
        player_name, season, club, goals = result
        
        # Generate distractors
        distractors = [goals - 3, goals + 2, goals - 1]
        options = distractors + [goals]
        random.shuffle(options)
        
        return {
            "question": f"How many goals did {player_name} score for {club} during the {season} season?",
            "options": [str(opt) for opt in options],
            "correct_answer": str(goals),
            "explanation": f"{player_name} scored {goals} goals for {club} in the {season} season.",
            "category": "player_stats",
            "difficulty": "intermediate",
            "source": "database",
            "sport": self.sport_name
        }
    
    def high_stakes_match_question(self) -> Dict[str, Any]:
        """Generate question about high-stakes matches (finals, derbies, etc)"""
        if not self.conn:
            return None
            
        cursor = self.conn.cursor()
        cursor.execute("""
            SELECT hc.name as home_team, ac.name as away_team,
                   g.home_club_goals, g.away_club_goals, g.result,
                   g.round, c.name as competition, g.season
            FROM games g
            JOIN clubs hc ON g.home_club_id = hc.club_id
            JOIN clubs ac ON g.away_club_id = ac.club_id
            JOIN competitions c ON g.competition_id = c.competition_id
            WHERE g.home_club_goals IS NOT NULL
            AND (
                g.round LIKE '%Final%' OR g.round LIKE '%final%' 
                OR g.round LIKE '%Semi%' OR g.round LIKE '%semi%'
                OR (hc.name LIKE '%United%' AND ac.name LIKE '%City%' AND hc.name LIKE '%Manchester%' AND ac.name LIKE '%Manchester%')
                OR (hc.name LIKE '%City%' AND ac.name LIKE '%United%' AND hc.name LIKE '%Manchester%' AND ac.name LIKE '%Manchester%')
                OR (hc.name LIKE '%Real Madrid%' AND ac.name LIKE '%Barcelona%')
                OR (hc.name LIKE '%Barcelona%' AND ac.name LIKE '%Real Madrid%')
                OR (hc.name LIKE '%Liverpool%' AND ac.name LIKE '%Everton%')
                OR (hc.name LIKE '%Everton%' AND ac.name LIKE '%Liverpool%')
                OR (hc.name LIKE '%Arsenal%' AND ac.name LIKE '%Tottenham%')
                OR (hc.name LIKE '%Tottenham%' AND ac.name LIKE '%Arsenal%')
            )
            ORDER BY RANDOM() LIMIT 1
        """)
        
        result = cursor.fetchone()
        if not result:
            return None
        
        home_team, away_team, home_goals, away_goals, result_code, round_info, competition, season = result
        home_team = get_team_short_name(home_team)
        away_team = get_team_short_name(away_team)
        
        if result_code == 'H':
            winner = home_team
        elif result_code == 'A':
            winner = away_team
        else:
            winner = "Draw"
        
        options = [home_team, away_team, "Draw"]
        if winner != "Draw":
            options.append("No winner (abandoned)")
        random.shuffle(options)
        
        # Create contextual question based on round
        if 'Final' in round_info or 'final' in round_info:
            question = f"Who won the {season} {competition} {round_info} between {home_team} and {away_team}?"
        else:
            question = f"Who won when {home_team} faced {away_team} in the {season} {competition}?"
        
        return {
            "question": question,
            "options": options,
            "correct_answer": winner,
            "explanation": f"The match ended {format_score(home_goals, away_goals)}. {'It was a draw' if winner == 'Draw' else f'{winner} won this important match'}.",
            "category": "high_stakes_matches",
            "difficulty": "intermediate",
            "source": "database",
            "sport": self.sport_name
        }