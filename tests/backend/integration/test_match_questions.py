#!/usr/bin/env python3
"""
Integration tests for match question generation
"""

import unittest
import sqlite3
import sys
from pathlib import Path
from unittest.mock import patch, MagicMock

# Add parent directories to path for imports
sys.path.append(str(Path(__file__).parent.parent.parent.parent / "backend"))
from scripts.generators.historical_generator import HistoricalQuestionGenerator
from scripts.generators.season_generator import SeasonQuestionGenerator
from scripts.generators.base_generator import DatabaseConnection


class TestMatchQuestions(unittest.TestCase):
    """Integration tests for match question generation"""
    
    def setUp(self):
        """Set up test environment"""
        # Create in-memory test database
        self.test_conn = sqlite3.connect(':memory:')
        self.test_conn.row_factory = sqlite3.Row
        
        # Create test tables
        self.test_conn.execute('''
            CREATE TABLE clubs (
                club_id INTEGER PRIMARY KEY,
                name TEXT NOT NULL
            )
        ''')
        
        self.test_conn.execute('''
            CREATE TABLE competitions (
                competition_id INTEGER PRIMARY KEY,
                name TEXT NOT NULL
            )
        ''')
        
        self.test_conn.execute('''
            CREATE TABLE games (
                game_id INTEGER PRIMARY KEY,
                home_club_id INTEGER,
                away_club_id INTEGER,
                competition_id INTEGER,
                season INTEGER,
                date TEXT,
                home_club_goals REAL,
                away_club_goals REAL,
                FOREIGN KEY (home_club_id) REFERENCES clubs (club_id),
                FOREIGN KEY (away_club_id) REFERENCES clubs (club_id),
                FOREIGN KEY (competition_id) REFERENCES competitions (competition_id)
            )
        ''')
        
        # Insert test data
        self._insert_test_data()
        
        # Create mock database connection
        self.mock_db_conn = MagicMock()
        self.mock_db_conn.conn = self.test_conn
        
    def _insert_test_data(self):
        """Insert test data"""
        # Insert competitions
        self.test_conn.execute('INSERT INTO competitions (competition_id, name) VALUES (1, "eredivisie")')
        self.test_conn.execute('INSERT INTO competitions (competition_id, name) VALUES (2, "premier-league")')
        
        # Insert clubs
        clubs = [
            (1, "Ajax"), (2, "FC Utrecht"), (3, "PSV Eindhoven"),
            (4, "Manchester United"), (5, "Liverpool"), (6, "Arsenal")
        ]
        
        for club_id, name in clubs:
            self.test_conn.execute('INSERT INTO clubs (club_id, name) VALUES (?, ?)', (club_id, name))
        
        # Insert single match between Ajax and Utrecht in 2020
        self.test_conn.execute('''
            INSERT INTO games (game_id, home_club_id, away_club_id, competition_id, season, date, home_club_goals, away_club_goals)
            VALUES (1, 1, 2, 1, 2020, '2020-10-06', 3.0, 0.0)
        ''')
        
        # Insert multiple matches between Ajax and Utrecht in 2021 (home and away)
        self.test_conn.execute('''
            INSERT INTO games (game_id, home_club_id, away_club_id, competition_id, season, date, home_club_goals, away_club_goals)
            VALUES (2, 1, 2, 1, 2021, '2021-03-15', 2.0, 1.0)
        ''')
        
        self.test_conn.execute('''
            INSERT INTO games (game_id, home_club_id, away_club_id, competition_id, season, date, home_club_goals, away_club_goals)
            VALUES (3, 2, 1, 1, 2021, '2021-10-20', 1.0, 4.0)
        ''')
        
        # Insert Premier League matches
        self.test_conn.execute('''
            INSERT INTO games (game_id, home_club_id, away_club_id, competition_id, season, date, home_club_goals, away_club_goals)
            VALUES (4, 4, 5, 2, 2020, '2020-05-10', 2.0, 1.0)
        ''')
        
        self.test_conn.commit()
    
    def test_single_match_question_format(self):
        """Test that single match questions use simple format"""
        with patch('scripts.generators.historical_generator.get_competition_mapper') as mock_mapper:
            mock_mapper_instance = MagicMock()
            mock_mapper_instance.is_valid_competition.return_value = True
            mock_mapper_instance.get_friendly_name.return_value = "Eredivisie"
            mock_mapper.return_value = mock_mapper_instance
            
            with patch('scripts.generators.historical_generator.get_team_name_formatter') as mock_formatter:
                mock_formatter_instance = MagicMock()
                mock_formatter_instance.format_team_name.side_effect = lambda x: x
                mock_formatter.return_value = mock_formatter_instance
                
                generator = HistoricalQuestionGenerator(self.mock_db_conn)
                
                # Generate questions (should include the single match from 2020)
                questions = generator.generate_questions(5)
                
                # Find the single match question
                single_match_questions = [
                    q for q in questions 
                    if "Ajax" in q["question"] and "Utrecht" in q["question"] and "2020" in q["question"]
                ]
                
                if single_match_questions:
                    question = single_match_questions[0]
                    # Should use simple format without "hosted" or date (can be "played" or "faced")
                    has_simple_format = ("played" in question["question"] or "faced" in question["question"])
                    self.assertTrue(has_simple_format, f"Question doesn't use simple format: {question['question']}")
                    self.assertNotIn("hosted", question["question"])
                    self.assertNotIn("October", question["question"])
    
    def test_multiple_match_question_format(self):
        """Test that multiple match questions include date/venue context"""
        with patch('scripts.generators.historical_generator.get_competition_mapper') as mock_mapper:
            mock_mapper_instance = MagicMock()
            mock_mapper_instance.is_valid_competition.return_value = True
            mock_mapper_instance.get_friendly_name.return_value = "Eredivisie"
            mock_mapper.return_value = mock_mapper_instance
            
            with patch('scripts.generators.historical_generator.get_team_name_formatter') as mock_formatter:
                mock_formatter_instance = MagicMock()
                mock_formatter_instance.format_team_name.side_effect = lambda x: x
                mock_formatter.return_value = mock_formatter_instance
                
                generator = HistoricalQuestionGenerator(self.mock_db_conn)
                
                # Generate questions (should include matches from 2021)
                questions = generator.generate_questions(10)
                
                # Find multiple match questions
                multiple_match_questions = [
                    q for q in questions 
                    if "Ajax" in q["question"] and "Utrecht" in q["question"] and "2021" in q["question"]
                ]
                
                if multiple_match_questions:
                    question = multiple_match_questions[0]
                    # Should include either "hosted" or date for disambiguation
                    has_context = ("hosted" in question["question"] or 
                                 "March" in question["question"] or 
                                 "October" in question["question"])
                    self.assertTrue(has_context, f"Question lacks context: {question['question']}")
    
    def test_score_formatting_consistency(self):
        """Test that scores are formatted as integers"""
        with patch('scripts.generators.historical_generator.get_competition_mapper') as mock_mapper:
            mock_mapper_instance = MagicMock()
            mock_mapper_instance.is_valid_competition.return_value = True
            mock_mapper_instance.get_friendly_name.return_value = "Eredivisie"
            mock_mapper.return_value = mock_mapper_instance
            
            with patch('scripts.generators.historical_generator.get_team_name_formatter') as mock_formatter:
                mock_formatter_instance = MagicMock()
                mock_formatter_instance.format_team_name.side_effect = lambda x: x
                mock_formatter.return_value = mock_formatter_instance
                
                generator = HistoricalQuestionGenerator(self.mock_db_conn)
                questions = generator.generate_questions(5)
                
                for question in questions:
                    if "score" in question["question"]:
                        # Check all options for proper integer formatting
                        for option in question["options"]:
                            if "-" in option:  # This is a score
                                self.assertNotIn(".0", option, f"Score option contains decimal: {option}")
                                self.assertNotIn(".1", option, f"Score option contains decimal: {option}")
    
    def test_season_questions_use_league_aware_distractors(self):
        """Test that season questions use competition-specific distractors"""
        with patch('scripts.generators.season_generator.get_competition_mapper') as mock_mapper:
            mock_mapper_instance = MagicMock()
            mock_mapper_instance.is_valid_competition.return_value = True
            mock_mapper_instance.get_friendly_name.return_value = "Eredivisie"
            mock_mapper.return_value = mock_mapper_instance
            
            with patch('scripts.generators.season_generator.get_team_name_formatter') as mock_formatter:
                mock_formatter_instance = MagicMock()
                mock_formatter_instance.format_team_name.side_effect = lambda x: x
                mock_formatter.return_value = mock_formatter_instance
                
                # Mock the league-aware distractor method
                with patch.object(SeasonQuestionGenerator, 'get_competition_aware_distractors') as mock_distractors:
                    mock_distractors.return_value = ["PSV Eindhoven", "Feyenoord Rotterdam", "FC Utrecht"]
                    
                    generator = SeasonQuestionGenerator(self.mock_db_conn)
                    questions = generator.generate_questions(5)
                    
                    # Find league winner questions
                    winner_questions = [
                        q for q in questions 
                        if "highest goal tally" in q["question"]
                    ]
                    
                    if winner_questions:
                        question = winner_questions[0]
                        # Should call league-aware distractors
                        self.assertTrue(mock_distractors.called)
                        
                        # Check that options don't include obviously wrong league teams
                        options_text = " ".join(question["options"])
                        self.assertNotIn("Manchester United", options_text)  # Not in Eredivisie
                        self.assertNotIn("Barcelona", options_text)  # Not in Eredivisie
    
    def test_match_count_check_accuracy(self):
        """Test that match count checking works correctly"""
        generator = HistoricalQuestionGenerator(self.mock_db_conn)
        
        # Test single match (Ajax vs Utrecht in 2020)
        single_count = generator._check_match_count(1, 2, 2020)  # Ajax ID=1, Utrecht ID=2
        self.assertEqual(single_count, 1)
        
        # Test multiple matches (Ajax vs Utrecht in 2021) 
        multiple_count = generator._check_match_count(1, 2, 2021)
        self.assertEqual(multiple_count, 2)  # Home and away
        
        # Test no matches (Ajax vs Utrecht in 2019)
        no_matches = generator._check_match_count(1, 2, 2019)
        self.assertEqual(no_matches, 0)
    
    def test_question_structure_validation(self):
        """Test that all generated questions have proper structure"""
        with patch('scripts.generators.historical_generator.get_competition_mapper') as mock_mapper:
            mock_mapper_instance = MagicMock()
            mock_mapper_instance.is_valid_competition.return_value = True
            mock_mapper_instance.get_friendly_name.return_value = "Eredivisie"
            mock_mapper.return_value = mock_mapper_instance
            
            with patch('scripts.generators.historical_generator.get_team_name_formatter') as mock_formatter:
                mock_formatter_instance = MagicMock()
                mock_formatter_instance.format_team_name.side_effect = lambda x: x
                mock_formatter.return_value = mock_formatter_instance
                
                generator = HistoricalQuestionGenerator(self.mock_db_conn)
                questions = generator.generate_questions(3)
                
                for question in questions:
                    # Required fields
                    self.assertIn("sport", question)
                    self.assertIn("category", question)
                    self.assertIn("difficulty", question)
                    self.assertIn("question", question)
                    self.assertIn("options", question)
                    self.assertIn("correct_answer", question)
                    
                    # Validation
                    self.assertEqual(question["sport"], "football")
                    self.assertEqual(question["category"], "historical")
                    self.assertEqual(question["difficulty"], "easy")
                    self.assertIsInstance(question["options"], list)
                    self.assertIn(question["correct_answer"], question["options"])
                    self.assertGreaterEqual(len(question["options"]), 2)
                    
                    # No duplicates in options
                    self.assertEqual(len(question["options"]), len(set(question["options"])))
    
    def tearDown(self):
        """Clean up test environment"""
        self.test_conn.close()


if __name__ == '__main__':
    unittest.main()