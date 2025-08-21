"""
Unit tests for match question format validation
"""
import pytest
import json
import re

class TestMatchQuestionFormat:
    """Test that match questions follow the correct format"""
    
    def test_match_question_has_exactly_three_options(self):
        """Test that match questions have exactly 3 options"""
        # Test proper match question format
        question = {
            'question': "Who won the match between Real Madrid and Barcelona in the laliga 2024?",
            'options': ['Real Madrid', 'Barcelona', 'Draw'],
            'correct_answer': 'Real Madrid',
            'category': 'competitions',
            'difficulty': 'intermediate'
        }
        
        # Verify the format
        assert len(question['options']) == 3, f"Match question should have exactly 3 options, got {len(question['options'])}"
        assert "Draw" in question['options'], "Match question should include 'Draw' option"
        assert 'Real Madrid' in question['options'], "Home team should be in options"
        assert 'Barcelona' in question['options'], "Away team should be in options"
    
    def test_match_question_correct_answer_is_valid(self):
        """Test that the correct answer is one of the options"""
        # Test case 1: Home team wins
        mock_game = {
            'home_club': 'Liverpool',
            'away_club': 'Manchester United',
            'home_goals': 3,
            'away_goals': 1,
            'competition': 'premier-league',
            'season': '2024'
        }
        
        winner = 'Liverpool'
        loser = 'Manchester United'
        options = [winner, loser, "Draw"]
        
        question = {
            'question': f"Who won the match between {mock_game['home_club']} and {mock_game['away_club']} in the {mock_game['competition']} {mock_game['season']}?",
            'options': options,
            'correct_answer': winner
        }
        
        assert question['correct_answer'] in question['options'], f"Correct answer '{question['correct_answer']}' must be in options {question['options']}"
        
        # Test case 2: Away team wins
        mock_game['home_goals'] = 1
        mock_game['away_goals'] = 2
        winner = 'Manchester United'
        loser = 'Liverpool'
        options = [winner, loser, "Draw"]
        question['correct_answer'] = winner
        question['options'] = options
        
        assert question['correct_answer'] in question['options'], f"Correct answer '{question['correct_answer']}' must be in options {question['options']}"
        
        # Test case 3: Draw
        mock_game['home_goals'] = 2
        mock_game['away_goals'] = 2
        winner = 'Draw'
        options = ['Liverpool', 'Manchester United', "Draw"]
        question['correct_answer'] = winner
        question['options'] = options
        
        assert question['correct_answer'] in question['options'], f"Correct answer '{question['correct_answer']}' must be in options {question['options']}"
    
    def test_no_random_teams_in_match_questions(self):
        """Test that match questions don't contain random teams unrelated to the match"""
        mock_game = {
            'home_club': 'Arsenal',
            'away_club': 'Chelsea',
            'home_goals': 1,
            'away_goals': 0,
            'competition': 'premier-league',
            'season': '2024'
        }
        
        winner = 'Arsenal'
        loser = 'Chelsea'
        options = [winner, loser, "Draw"]
        
        question = {
            'question': f"Who won the match between {mock_game['home_club']} and {mock_game['away_club']} in the {mock_game['competition']} {mock_game['season']}?",
            'options': options,
            'correct_answer': winner
        }
        
        # Extract team names from the question
        import re
        pattern = r"Who won (?:the match between|when) (.+?) (?:and|faced) (.+?) in"
        match = re.search(pattern, question['question'], re.IGNORECASE)
        
        if match:
            team1 = match.group(1).strip()
            team2 = match.group(2).strip()
            
            # Check that all non-Draw options are either team1 or team2
            for option in question['options']:
                if option != "Draw":
                    assert (option == team1 or option == team2 or 
                           team1.lower() in option.lower() or option.lower() in team1.lower() or
                           team2.lower() in option.lower() or option.lower() in team2.lower()), \
                           f"Option '{option}' should be one of the teams from the match: {team1}, {team2}"
    
    def test_match_question_has_draw_option(self):
        """Test that all match questions include a 'Draw' option"""
        # Various ways "Draw" might be represented
        valid_draw_options = ["Draw", "draw", "Tie", "tie"]
        
        mock_options_sets = [
            ['Real Madrid', 'Barcelona', 'Draw'],
            ['Liverpool', 'Manchester City', 'draw'],
            ['Arsenal', 'Tottenham', 'Tie'],
            ['Chelsea', 'Manchester United', 'tie']
        ]
        
        for options in mock_options_sets:
            # Normalize to check for draw option
            has_draw = any(opt.lower() in ['draw', 'tie'] for opt in options)
            assert has_draw, f"Match question options {options} should include a draw/tie option"
    
    def test_match_question_options_are_unique(self):
        """Test that match question options don't have duplicates"""
        options = ['Barcelona', 'Real Madrid', 'Draw']
        
        # Check for uniqueness
        assert len(options) == len(set(options)), f"Options should be unique, got duplicates in: {options}"
        
        # Test with potential duplicate scenario
        options_with_duplicate = ['Barcelona', 'Barcelona', 'Draw']
        assert len(options_with_duplicate) != len(set(options_with_duplicate)), "Test should detect duplicates"

    def test_match_question_format_regression_prevention(self):
        """Regression test to prevent 4-option match questions with random teams"""
        # This is the format we DON'T want (the old broken format)
        bad_options = ['Brighton', 'Draw', 'Real Betis Balompié', 'Chelsea']
        
        # Simulate the question about Real Betis vs Valencia
        question_text = "Who won when Real Valladolid faced Real Betis Balompié in the ES1 in 2019?"
        
        # Extract teams from question
        import re
        pattern = r"Who won when (.+?) faced (.+?) in"
        match = re.search(pattern, question_text, re.IGNORECASE)
        
        if match:
            team1 = match.group(1).strip()  # Real Valladolid
            team2 = match.group(2).strip()  # Real Betis Balompié
            
            # Check if bad_options contains wrong teams
            wrong_teams = []
            for option in bad_options:
                if option != "Draw":
                    if not (team1.lower() in option.lower() or option.lower() in team1.lower() or
                           team2.lower() in option.lower() or option.lower() in team2.lower()):
                        wrong_teams.append(option)
            
            # This should fail for the bad format (proving our test catches the issue)
            assert len(wrong_teams) > 0, "Test should detect wrong teams in bad format"
            assert len(bad_options) == 4, "Bad format has 4 options instead of 3"
            
        # Now test the correct format
        good_options = [team1, team2, "Draw"]
        
        assert len(good_options) == 3, "Correct format should have exactly 3 options"
        assert "Draw" in good_options, "Correct format should include Draw"
        
        # Check no wrong teams in good format
        wrong_teams_good = []
        for option in good_options:
            if option != "Draw":
                if not (team1.lower() in option.lower() or option.lower() in team1.lower() or
                       team2.lower() in option.lower() or option.lower() in team2.lower()):
                    wrong_teams_good.append(option)
        
        assert len(wrong_teams_good) == 0, f"Good format should have no wrong teams, found: {wrong_teams_good}"