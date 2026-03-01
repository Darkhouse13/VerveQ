"""
Base generator and DB connection stubs used by tests.
"""
from dataclasses import dataclass
import sqlite3
from typing import List


@dataclass
class DatabaseConnection:
    conn: sqlite3.Connection


class BaseQuestionGenerator:
    def __init__(self, db: DatabaseConnection):
        self.db = db

    # Tests patch this method; provide a default implementation
    def get_competition_aware_distractors(self, correct_team: str, competition_id: int, season: int, count: int) -> List[str]:
        # Simple fallback distractors
        return [
            team
            for team in ["PSV Eindhoven", "Feyenoord Rotterdam", "FC Utrecht", "AZ Alkmaar"]
            if team != correct_team
        ][:count]

