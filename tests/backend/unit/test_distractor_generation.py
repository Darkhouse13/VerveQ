#!/usr/bin/env python3
"""
Unit tests for distractor generation functionality
"""

import unittest
import sqlite3
import sys
from pathlib import Path
from unittest.mock import patch, MagicMock

# Add parent directories to path for imports
sys.path.append(str(Path(__file__).parent.parent.parent.parent / "backend"))
from sports.utils import get_competition_teams, get_league_aware_distractors
from scripts.generators.base_generator import BaseQuestionGenerator, DatabaseConnection


class TestDistractorGeneration(unittest.TestCase):
    """Test cases for distractor generation"""
    
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
                FOREIGN KEY (home_club_id) REFERENCES clubs (club_id),
                FOREIGN KEY (away_club_id) REFERENCES clubs (club_id),
                FOREIGN KEY (competition_id) REFERENCES competitions (competition_id)
            )
        ''')
        
        # Insert test data
        self._insert_test_data()
        
    def _insert_test_data(self):
        """Insert test data for Eredivisie and Premier League"""
        # Insert competitions
        self.test_conn.execute('INSERT INTO competitions (competition_id, name) VALUES (1, "eredivisie")')
        self.test_conn.execute('INSERT INTO competitions (competition_id, name) VALUES (2, "premier-league")')
        
        # Insert Eredivisie clubs
        eredivisie_clubs = [
            (1, "Ajax"), (2, "PSV Eindhoven"), (3, "Feyenoord Rotterdam"),
            (4, "FC Utrecht"), (5, "Vitesse Arnhem"), (6, "ADO Den Haag"),
            (7, "FC Groningen"), (8, "Willem II"), (9, "SC Heerenveen"),
            (10, "PEC Zwolle"), (11, "Fortuna Sittardia Combinatie"), (12, "VVV-Venlo")
        ]
        
        # Insert Premier League clubs  
        premier_clubs = [
            (13, "Manchester United"), (14, "Liverpool"), (15, "Arsenal"),
            (16, "Chelsea"), (17, "Manchester City"), (18, "Tottenham"),
            (19, "Newcastle United"), (20, "Brighton"), (21, "Crystal Palace"),
            (22, "Leicester City"), (23, "Aston Villa"), (24, "West Ham United")
        ]
        
        all_clubs = eredivisie_clubs + premier_clubs
        for club_id, name in all_clubs:
            self.test_conn.execute('INSERT INTO clubs (club_id, name) VALUES (?, ?)', (club_id, name))
        
        # Insert games for 2020 season - Eredivisie
        game_id = 1
        for home_id in range(1, 13):  # Eredivisie clubs
            for away_id in range(1, 13):
                if home_id != away_id:
                    self.test_conn.execute('''
                        INSERT INTO games (game_id, home_club_id, away_club_id, competition_id, season)
                        VALUES (?, ?, ?, ?, ?)
                    ''', (game_id, home_id, away_id, 1, 2020))
                    game_id += 1
        
        # Insert games for 2020 season - Premier League  
        for home_id in range(13, 25):  # Premier League clubs
            for away_id in range(13, 25):
                if home_id != away_id:
                    self.test_conn.execute('''
                        INSERT INTO games (game_id, home_club_id, away_club_id, competition_id, season)
                        VALUES (?, ?, ?, ?, ?)
                    ''', (game_id, home_id, away_id, 2, 2020))
                    game_id += 1
        
        self.test_conn.commit()
    
    @patch('sports.utils.sqlite3.connect')
    def test_get_competition_teams_same_season(self, mock_connect):
        """Test getting teams from same competition and season"""
        mock_connect.return_value = self.test_conn
        
        # Test getting Eredivisie teams for 2020
        teams = get_competition_teams(1, 2020, min_count=5)
        
        # Should return teams from Eredivisie
        self.assertGreaterEqual(len(teams), 5)
        team_names = [team[1] for team in teams]
        self.assertIn("Ajax", team_names)
        self.assertIn("PSV Eindhoven", team_names)
        self.assertNotIn("Manchester United", team_names)  # Not in Eredivisie
    
    @patch('sports.utils.sqlite3.connect')
    def test_get_competition_teams_fallback(self, mock_connect):
        """Test fallback when not enough teams in specific season"""
        mock_connect.return_value = self.test_conn
        
        # Test with very high min_count to trigger fallback
        teams = get_competition_teams(1, 2021, min_count=50)  # Season with no data
        
        # Should still return some teams (fallback to broader search)
        self.assertGreater(len(teams), 0)
    
    def test_get_league_aware_distractors_excludes_correct_team(self):
        """Test that league-aware distractors never include the correct team"""
        with patch('sports.utils.get_competition_teams') as mock_get_teams:
            # Mock return value with teams including the correct one
            mock_get_teams.return_value = [
                (1, "Ajax"), (2, "PSV Eindhoven"), (3, "Feyenoord Rotterdam"),
                (4, "FC Utrecht"), (5, "Vitesse Arnhem")
            ]
            
            distractors = get_league_aware_distractors("Ajax", 1, 2020, 3)
            
            # Should not include Ajax in distractors
            self.assertNotIn("Ajax", distractors)
            self.assertEqual(len(distractors), 3)
            self.assertIn("PSV Eindhoven", distractors)
    
    def test_get_league_aware_distractors_deduplication(self):
        """Test that distractors are deduplicated"""
        with patch('sports.utils.get_competition_teams') as mock_get_teams:
            # Mock return value with duplicate teams
            mock_get_teams.return_value = [
                (1, "Ajax"), (2, "PSV Eindhoven"), (3, "PSV Eindhoven"),  # Duplicate
                (4, "FC Utrecht"), (5, "Vitesse Arnhem")
            ]
            
            distractors = get_league_aware_distractors("Ajax", 1, 2020, 3)
            
            # Should not have duplicates
            self.assertEqual(len(distractors), len(set(distractors)))
            # Should only have one "PSV Eindhoven" instance
            self.assertEqual(distractors.count("PSV Eindhoven"), 1)
    
    def test_get_league_aware_distractors_fallback_to_famous_clubs(self):
        """Test fallback to famous clubs when not enough competition teams"""
        with patch('sports.utils.get_competition_teams') as mock_get_teams:
            # Mock return value with only 1 team
            mock_get_teams.return_value = [(2, "PSV Eindhoven")]
            
            distractors = get_league_aware_distractors("Ajax", 1, 2020, 3)
            
            # Should have 3 distractors total
            self.assertEqual(len(distractors), 3)
            # Should include the competition team
            self.assertIn("PSV Eindhoven", distractors)
            # Should supplement with famous clubs
            famous_club_found = any(club in distractors for club in 
                                  ["Manchester United", "Real Madrid", "Barcelona", "Bayern Munich"])
            self.assertTrue(famous_club_found)
    
    def test_base_generator_competition_aware_distractors(self):
        """Test BaseQuestionGenerator.get_competition_aware_distractors method"""
        # Create mock database connection
        mock_db_conn = MagicMock()
        mock_db_conn.conn = self.test_conn
        
        generator = BaseQuestionGenerator(mock_db_conn)
        
        with patch.object(generator, 'get_competition_aware_distractors') as mock_method:
            mock_method.return_value = ["PSV Eindhoven", "Feyenoord Rotterdam", "FC Utrecht"]
            
            distractors = generator.get_competition_aware_distractors("Ajax", 1, 2020, 3)
            
            self.assertEqual(len(distractors), 3)
            self.assertNotIn("Ajax", distractors)
            mock_method.assert_called_once_with("Ajax", 1, 2020, 3)
    
    def test_get_league_aware_distractors_handles_normalization(self):
        """Test that team name normalization works correctly"""
        with patch('sports.utils.get_competition_teams') as mock_get_teams:
            mock_get_teams.return_value = [
                (1, "ajax"), (2, "PSV Eindhoven"), (3, "Feyenoord Rotterdam"),
                (4, "FC Utrecht"), (5, "Vitesse Arnhem")
            ]
            
            # Test with different capitalization
            distractors = get_league_aware_distractors("Ajax", 1, 2020, 3)
            
            # Should exclude "ajax" (normalized match with "Ajax")
            self.assertNotIn("ajax", distractors)
            self.assertNotIn("Ajax", distractors)
            self.assertEqual(len(distractors), 3)
    
    def tearDown(self):
        """Clean up test environment"""
        self.test_conn.close()


if __name__ == '__main__':
    unittest.main()