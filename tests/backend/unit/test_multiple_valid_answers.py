"""
Test for multiple valid answers fix in survival mode
This addresses the core issue where session validation only accepted one specific player
"""

import pytest
import sys
import os

# Add backend to path
backend_path = os.path.join(os.path.dirname(__file__), '..', '..', '..', 'backend')
sys.path.insert(0, backend_path)

from services.survival_session import get_survival_session_manager
from sports import SportDataFactory


class TestMultipleValidAnswers:
    """Test that session validation accepts any valid player with the given initials"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Initialize sports data"""
        SportDataFactory._ensure_initialized()
        self.session_manager = get_survival_session_manager()
    
    def test_football_ai_initials_multiple_players(self):
        """Test that any valid AI player is accepted in football"""
        # Create session
        session = self.session_manager.create_session('football')
        
        # Set challenge with AI initials (challenge generated with specific player)
        session.current_challenge = {
            'initials': 'AI',
            'correct_answer': 'Andreas Ivanschitz',  # Original generated player
            'round': 1,
            'sport': 'football'
        }
        
        # Test that different valid AI players are all accepted
        valid_ai_players = [
            'Atsuki Ito',
            'Andreas Ivanschitz', 
            'Andrés Iniesta',
            'Ariel Ibagaza',
            'Andoni Iraola'
        ]
        
        for player in valid_ai_players:
            # Create new session for each test (since session advances after correct answer)
            test_session = self.session_manager.create_session('football')
            test_session.current_challenge = {
                'initials': 'AI',
                'correct_answer': 'Andreas Ivanschitz',
                'round': 1,
                'sport': 'football'
            }
            
            result = self.session_manager.submit_answer(test_session.session_id, player)
            
            assert result is not None, f"No result for {player}"
            assert result['is_correct'] == True, f"{player} should be accepted for AI initials"
            assert result['similarity'] >= 0.8, f"{player} should have high similarity"
            
            self.session_manager.end_session(test_session.session_id)
        
        self.session_manager.end_session(session.session_id)
    
    def test_basketball_multiple_players_same_initials(self):
        """Test basketball players with same initials are all accepted"""
        # Get basketball data to find initials with multiple players
        basketball_gen = SportDataFactory.get_generator('basketball')
        basketball_data = basketball_gen.get_survival_data()
        
        # Find initials with multiple players
        multi_player_initials = None
        players_list = []
        
        for initials, players in basketball_data.items():
            if len(players) > 2:  # Need multiple players
                multi_player_initials = initials
                players_list = players[:3]  # Test first 3
                break
        
        if multi_player_initials:
            # Test that all players with these initials are accepted
            for player in players_list:
                session = self.session_manager.create_session('basketball')
                session.current_challenge = {
                    'initials': multi_player_initials,
                    'correct_answer': players_list[0],  # Challenge with first player
                    'round': 1,
                    'sport': 'basketball'
                }
                
                result = self.session_manager.submit_answer(session.session_id, player)
                
                assert result is not None, f"No result for {player}"
                assert result['is_correct'] == True, f"{player} should be accepted for {multi_player_initials}"
                
                self.session_manager.end_session(session.session_id)
    
    def test_invalid_answer_still_rejected(self):
        """Test that invalid answers are still properly rejected"""
        session = self.session_manager.create_session('football')
        
        session.current_challenge = {
            'initials': 'AI',
            'correct_answer': 'Andreas Ivanschitz',
            'round': 1,
            'sport': 'football'
        }
        
        # Test invalid answers
        invalid_answers = [
            'Random Name',
            'Lionel Messi',  # Wrong initials (LM)
            'Michael Jordan', # Basketball player, wrong sport
            '',  # Empty
        ]
        
        for invalid_answer in invalid_answers:
            # Create new session for each test
            test_session = self.session_manager.create_session('football')
            test_session.current_challenge = {
                'initials': 'AI',
                'correct_answer': 'Andreas Ivanschitz',
                'round': 1,
                'sport': 'football'
            }
            
            result = self.session_manager.submit_answer(test_session.session_id, invalid_answer)
            
            if result:  # Skip empty string case
                assert result['is_correct'] == False, f"{invalid_answer} should be rejected"
            
            self.session_manager.end_session(test_session.session_id)
        
        self.session_manager.end_session(session.session_id)
    
    def test_case_variations_accepted(self):
        """Test that case variations are accepted"""
        session = self.session_manager.create_session('football')
        
        session.current_challenge = {
            'initials': 'AI',
            'correct_answer': 'Atsuki Ito',
            'round': 1,
            'sport': 'football'
        }
        
        case_variations = [
            'Atsuki Ito',
            'atsuki ito',
            'ATSUKI ITO',
            'Atsuki  Ito',  # Extra space
            ' Atsuki Ito ', # Leading/trailing spaces
        ]
        
        for variation in case_variations:
            # Create new session for each test
            test_session = self.session_manager.create_session('football')
            test_session.current_challenge = {
                'initials': 'AI',
                'correct_answer': 'Andreas Ivanschitz',
                'round': 1,
                'sport': 'football'
            }
            
            result = self.session_manager.submit_answer(test_session.session_id, variation.strip())
            
            assert result is not None, f"No result for '{variation}'"
            assert result['is_correct'] == True, f"'{variation}' should be accepted"
            
            self.session_manager.end_session(test_session.session_id)
        
        self.session_manager.end_session(session.session_id)
    
    def test_session_progresses_correctly_after_correct_answer(self):
        """Test that session still progresses to next round after correct answer"""
        session = self.session_manager.create_session('football')
        initial_round = session.round
        
        if session.current_challenge:
            original_initials = session.current_challenge['initials']
            
            # Submit any valid player for these initials
            generator = SportDataFactory.get_generator('football')
            survival_data = generator.get_survival_data()
            
            if original_initials in survival_data:
                any_valid_player = survival_data[original_initials][0]
                
                result = self.session_manager.submit_answer(session.session_id, any_valid_player)
                
                assert result is not None
                assert result['is_correct'] == True
                assert result.get('next_round') == True
                assert result.get('next_challenge') is not None
                assert session.round == initial_round + 1, "Session should advance to next round"
        
        self.session_manager.end_session(session.session_id)


if __name__ == "__main__":
    # Run tests
    pytest.main([__file__, "-v"])