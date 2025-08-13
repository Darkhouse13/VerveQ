"""
Advanced football question generators - Part 2
"""

import sqlite3
import random
import logging
from typing import Dict, Any, Optional
from .football_utils import format_score, get_team_short_name, is_well_known_team, is_well_known_player


class FootballQuestionGeneratorsAdvanced:
    """Advanced question generation methods for football quiz"""
    
    def __init__(self, conn: Optional[sqlite3.Connection], sport_name: str = "football"):
        self.conn = conn
        self.sport_name = sport_name
        self.logger = logging.getLogger(__name__)
    
    def late_goal_question(self) -> Dict[str, Any]:
        """Generate question about late goals"""
        if not self.conn:
            return None
            
        cursor = self.conn.cursor()
        cursor.execute("""
            SELECT p.name, ge.minute, hc.name as home_team, ac.name as away_team,
                   g.home_club_goals, g.away_club_goals, c.name as player_club,
                   comp.name as competition, g.season
            FROM game_events ge
            JOIN players p ON ge.player_id = p.player_id
            JOIN games g ON ge.game_id = g.game_id
            JOIN clubs hc ON g.home_club_id = hc.club_id
            JOIN clubs ac ON g.away_club_id = ac.club_id
            JOIN clubs c ON ge.club_id = c.club_id
            JOIN competitions comp ON g.competition_id = comp.competition_id
            WHERE ge.type = 'Goals' AND ge.minute >= 80
            AND g.competition_id IN (
                SELECT competition_id FROM competitions 
                WHERE competition_code IN ('premier-league', 'laliga', 'serie-a', 'bundesliga', 'ligue-1', 'fa-cup', 'champions-league', 'europa-league')
            )
            ORDER BY RANDOM() LIMIT 1
        """)
        
        result = cursor.fetchone()
        if not result:
            return None
        
        player_name, minute, home_team, away_team, home_goals, away_goals, player_club, competition, season = result
        home_team = get_team_short_name(home_team)
        away_team = get_team_short_name(away_team)
        player_club = get_team_short_name(player_club)
        final_score = format_score(home_goals, away_goals)
        
        # Determine opponent team
        if player_club == home_team:
            opponent = away_team
        else:
            opponent = home_team
        
        # Generate plausible alternative scores
        distractors = [
            format_score(home_goals-1, away_goals),
            format_score(home_goals, away_goals-1),
            format_score(home_goals+1, away_goals)
        ]
        options = distractors + [final_score]
        random.shuffle(options)
        
        return {
            "question": f"When {player_name} scored for {player_club} against {opponent} in the {int(minute)}th minute of their {season} {competition} match, what was the final score?",
            "options": options,
            "correct_answer": final_score,
            "explanation": f"The match between {home_team} and {away_team} ended {final_score}, with {player_name} scoring a crucial late goal.",
            "category": "dramatic_moments",
            "difficulty": "intermediate",
            "source": "database",
            "sport": self.sport_name
        }
    
    def player_hat_trick_question(self) -> Dict[str, Any]:
        """Generate question about player hat-tricks"""
        if not self.conn:
            return None
            
        cursor = self.conn.cursor()
        cursor.execute("""
            SELECT p.name, opp.name as opponent_team, g.date, c.name as player_club,
                   g.season, comp.name as competition, g.competition_id
            FROM game_events ge
            JOIN games g ON ge.game_id = g.game_id
            JOIN players p ON ge.player_id = p.player_id
            JOIN clubs c ON ge.club_id = c.club_id
            JOIN clubs opp ON (CASE WHEN g.home_club_id = ge.club_id THEN g.away_club_id ELSE g.home_club_id END) = opp.club_id
            JOIN competitions comp ON g.competition_id = comp.competition_id
            WHERE ge.type = 'Goals'
            AND g.competition_id IN (
                SELECT competition_id FROM competitions 
                WHERE competition_code IN ('premier-league', 'laliga', 'serie-a', 'bundesliga', 'ligue-1')
            )
            GROUP BY g.game_id, p.player_id, p.name, opp.name, g.date, c.name, g.season, comp.name, g.competition_id
            HAVING COUNT(ge.game_event_id) >= 3
            ORDER BY RANDOM()
            LIMIT 1
        """)
        
        result = cursor.fetchone()
        if not result:
            return None
        
        player_name, opponent_team, date, player_club, season, competition, competition_id = result
        opponent_team = get_team_short_name(opponent_team)
        player_club = get_team_short_name(player_club)
        
        # For prolific players like Ronaldo, Messi, add date context
        prolific_players = ['Cristiano Ronaldo', 'Lionel Messi', 'Robert Lewandowski', 
                           'Harry Kane', 'Karim Benzema', 'Mohamed Salah']
        hat_trick_count = 10 if player_name in prolific_players else 1
        
        # Get contextually relevant distractors from the same competition and season
        # Exclude both the opponent team AND the player's team
        cursor.execute("""
            SELECT DISTINCT c.name FROM clubs c
            JOIN games g ON (c.club_id = g.home_club_id OR c.club_id = g.away_club_id)
            WHERE c.name != ? 
            AND c.name != ?
            AND g.competition_id = ?
            AND g.season = ?
            ORDER BY RANDOM() 
            LIMIT 3
        """, (opponent_team, player_club, competition_id, season))
        
        distractors = [get_team_short_name(row[0]) for row in cursor.fetchall()]
        
        # If we don't have enough distractors from same season, get from same competition
        if len(distractors) < 3:
            cursor.execute("""
                SELECT DISTINCT c.name FROM clubs c
                JOIN games g ON (c.club_id = g.home_club_id OR c.club_id = g.away_club_id)
                WHERE c.name != ? 
                AND c.name != ?
                AND g.competition_id = ?
                ORDER BY RANDOM() 
                LIMIT 3
            """, (opponent_team, player_club, competition_id))
            distractors = [get_team_short_name(row[0]) for row in cursor.fetchall()]
        
        options = distractors + [opponent_team]
        random.shuffle(options)
        
        # Create question with appropriate context
        if hat_trick_count > 3:  # Prolific player needs date
            question = f"Against which team did {player_name} score a hat-trick for {player_club} on {date} in the {competition}?"
        else:  # Season context is sufficient
            question = f"Against which team did {player_name} score a hat-trick for {player_club} in the {season} {competition}?"
        
        return {
            "question": question,
            "options": options,
            "correct_answer": opponent_team,
            "explanation": f"{player_name} scored a memorable hat-trick against {opponent_team} on {date}, showcasing his scoring prowess.",
            "category": "player_milestones",
            "difficulty": "intermediate",
            "source": "database",
            "sport": self.sport_name
        }
    
    def team_biggest_win_question(self) -> Dict[str, Any]:
        """Generate question about team's biggest wins"""
        if not self.conn:
            return None
            
        cursor = self.conn.cursor()
        cursor.execute("""
            SELECT
                hc.name as winning_team, ac.name as losing_team,
                g.home_club_goals, g.away_club_goals, g.season
            FROM games g
            JOIN clubs hc ON g.home_club_id = hc.club_id
            JOIN clubs ac ON g.away_club_id = ac.club_id
            WHERE g.result = 'H' AND (g.home_club_goals - g.away_club_goals) >= 4
            AND g.competition_id IN (
                SELECT competition_id FROM competitions 
                WHERE competition_code IN ('premier-league', 'laliga', 'serie-a', 'bundesliga', 'ligue-1', 'fa-cup', 'champions-league', 'europa-league')
            )
            ORDER BY RANDOM()
            LIMIT 1
        """)
        
        result = cursor.fetchone()
        if not result:
            return None
        
        winning_team, losing_team, home_goals, away_goals, season = result
        winning_team = get_team_short_name(winning_team)
        losing_team = get_team_short_name(losing_team)
        final_score = format_score(home_goals, away_goals)
        margin = int(home_goals - away_goals)
        
        # Generate other large-margin score distractors
        distractors = [
            format_score(home_goals-1, away_goals),
            format_score(home_goals, away_goals+1),
            format_score(home_goals+1, away_goals)
        ]
        options = distractors + [final_score]
        random.shuffle(options)
        
        return {
            "question": f"What was the score in {winning_team}'s dominant win against {losing_team} during the {season} season?",
            "options": options,
            "correct_answer": final_score,
            "explanation": f"{winning_team} dominated with a {final_score} victory over {losing_team}, winning by {margin} goals.",
            "category": "team_performance",
            "difficulty": "intermediate",
            "source": "database",
            "sport": self.sport_name
        }
    
    def fallback_question(self) -> Dict[str, Any]:
        """Fallback question when database is unavailable"""
        questions = [
            {
                "question": "How many players are on a football team?",
                "options": ["9", "10", "11", "12"],
                "correct_answer": "11",
                "explanation": "A football team has 11 players on the field.",
                "category": "basics",
                "difficulty": "beginner",
                "source": "fallback",
                "sport": self.sport_name
            },
            {
                "question": "What shape is a football field?",
                "options": ["Square", "Circle", "Rectangle", "Triangle"],
                "correct_answer": "Rectangle",
                "explanation": "A football field is rectangular in shape.",
                "category": "basics", 
                "difficulty": "beginner",
                "source": "fallback",
                "sport": self.sport_name
            }
        ]
        return random.choice(questions)