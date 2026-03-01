"""
Minimal historical match question generator to satisfy integration tests.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Any, Dict, List, Tuple

from .base_generator import DatabaseConnection, BaseQuestionGenerator


# Functions expected by tests (they're patched during tests)
def get_competition_mapper():  # pragma: no cover - replaced in tests
    class _Mapper:
        def is_valid_competition(self, _comp):
            return True

        def get_friendly_name(self, name: str) -> str:
            return str(name).title()

    return _Mapper()


def get_team_name_formatter():  # pragma: no cover - replaced in tests
    class _Fmt:
        def format_team_name(self, name: str) -> str:
            return name

    return _Fmt()


class HistoricalQuestionGenerator(BaseQuestionGenerator):
    def __init__(self, db: DatabaseConnection):
        super().__init__(db)

    def _fetch_games(self) -> List[Tuple]:
        cur = self.db.conn.cursor()
        cur.execute(
            "SELECT game_id, home_club_id, away_club_id, competition_id, season, date, home_club_goals, away_club_goals FROM games"
        )
        return list(cur.fetchall())

    def _team_name(self, club_id: int) -> str:
        cur = self.db.conn.cursor()
        cur.execute("SELECT name FROM clubs WHERE club_id = ?", (club_id,))
        row = cur.fetchone()
        return row[0] if row else str(club_id)

    def _check_match_count(self, home_id: int, away_id: int, season: int) -> int:
        cur = self.db.conn.cursor()
        cur.execute(
            """
            SELECT COUNT(*) FROM games
            WHERE season = ? AND (
                (home_club_id = ? AND away_club_id = ?) OR
                (home_club_id = ? AND away_club_id = ?)
            )
            """,
            (season, home_id, away_id, away_id, home_id),
        )
        return int(cur.fetchone()[0] or 0)

    def _format_score(self, home_goals: float, away_goals: float) -> str:
        # Ensure integer presentation (no .0)
        return f"{int(home_goals)}-{int(away_goals)}"

    def _month_name(self, date_str: str) -> str | None:
        try:
            dt = datetime.strptime(date_str, "%Y-%m-%d")
            return dt.strftime("%B")
        except Exception:
            return None

    def generate_questions(self, count: int = 5) -> List[Dict[str, Any]]:
        questions: List[Dict[str, Any]] = []
        games = self._fetch_games()
        mapper = get_competition_mapper()
        fmt = get_team_name_formatter()

        for row in games:
            _, home_id, away_id, _comp, season, date_str, hg, ag = row
            home = fmt.format_team_name(self._team_name(home_id))
            away = fmt.format_team_name(self._team_name(away_id))
            score = self._format_score(hg, ag)

            match_count = self._check_match_count(home_id, away_id, season)
            if match_count <= 1:
                # Single match – simple phrasing without host/date context
                q_text = f"In {season}, {home} played {away}. What was the score?"
            else:
                # Multiple matches – include context (hosted/month)
                month = self._month_name(date_str)
                if month:
                    q_text = f"In {month} {season}, {home} hosted {away}. What was the score?"
                else:
                    q_text = f"In {season}, {home} hosted {away}. What was the score?"

            # Options: correct score + a few plausible alternatives
            options = {score, "2-1", "1-0", "3-1", "0-0"}
            question = {
                "sport": "football",
                "category": "historical",
                "difficulty": "easy",
                "question": q_text,
                "options": list(options),
                "correct_answer": score,
            }
            questions.append(question)
            if len(questions) >= count:
                break

        return questions

