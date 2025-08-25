"""
Tests for survival mode name matching logic
Tests the fixes implemented to resolve matching failures
"""

import pytest
import sys
import os

# Add backend to path
backend_path = os.path.join(os.path.dirname(__file__), '..', '..', '..', 'backend')
sys.path.insert(0, backend_path)

from sports.utils import normalize_name, calculate_similarity
from sports.survival_engine import get_survival_engine
from sports import SportDataFactory


class TestNameNormalization:
    """Test the improved normalize_name function"""
    
    def test_basic_normalization(self):
        """Test basic name normalization"""
        assert normalize_name("John Smith") == "john smith"
        assert normalize_name("JOHN SMITH") == "john smith"
        assert normalize_name("  John   Smith  ") == "john smith"
    
    def test_special_characters_replaced_with_spaces(self):
        """Test that special characters are replaced with spaces, not removed"""
        # This was the main issue - special chars were removed, causing mismatches
        assert normalize_name("Al-Farouq Aminu") == "al farouq aminu"
        assert normalize_name("A.C. Green") == "a c green"
        assert normalize_name("Amar'e Stoudemire") == "amar e stoudemire"
        assert normalize_name("O'Neal") == "o neal"
        assert normalize_name("Van_der_Sar") == "van der sar"
    
    def test_multiple_spaces_normalized(self):
        """Test that multiple spaces are normalized to single spaces"""
        assert normalize_name("John    Smith") == "john smith"
        assert normalize_name("Al - Farouq   Aminu") == "al farouq aminu"


class TestSimilarityCalculation:
    """Test the improved calculate_similarity function"""
    
    def test_exact_matches(self):
        """Test exact matches return 1.0"""
        assert calculate_similarity("John Smith", "John Smith") == 1.0
        assert calculate_similarity("john smith", "JOHN SMITH") == 1.0
        assert calculate_similarity("  John Smith  ", "John Smith") == 1.0
    
    def test_spacing_variations(self):
        """Test variations in spacing are handled correctly"""
        # These should now match because we handle spacing better
        assert calculate_similarity("Al Farouq Aminu", "AlFarouq Aminu") == 1.0
        assert calculate_similarity("A.C. Green", "AC Green") == 1.0
        assert calculate_similarity("J.R. Smith", "JR Smith") == 1.0
    
    def test_special_character_variations(self):
        """Test special character variations are handled"""
        # These were failing before the fix
        assert calculate_similarity("Al-Farouq Aminu", "Al Farouq Aminu") >= 0.8
        assert calculate_similarity("Amar'e Stoudemire", "Amare Stoudemire") >= 0.8
        assert calculate_similarity("Jean-Claude Van Damme", "Jean Claude Van Damme") >= 0.8
    
    def test_word_subset_matching(self):
        """Test that subset word matching works"""
        # Should match if all words from shorter name are in longer name
        assert calculate_similarity("Ronaldo", "Cristiano Ronaldo") == 0.9
        assert calculate_similarity("James", "LeBron James") == 0.9
    
    def test_partial_matches(self):
        """Test partial matches return appropriate scores"""
        # Should not match exact but should have some similarity
        similarity = calculate_similarity("John Smith", "John Jones")
        assert 0.3 < similarity < 0.8
        
        similarity = calculate_similarity("Michael Jordan", "Michael Jackson")
        assert 0.3 < similarity < 0.8


class TestSurvivalEngineValidation:
    """Test the survival engine validation logic"""
    
    def test_validation_threshold(self):
        """Test that validation uses 0.8 threshold correctly"""
        engine = get_survival_engine()
        
        # Mock challenge
        challenge = {
            "initials": "CR",
            "correct_answer": "Cristiano Ronaldo",
            "sport": "football"
        }
        
        # These should pass
        assert engine.validate_answer(challenge, "Cristiano Ronaldo")["is_correct"] == True
        assert engine.validate_answer(challenge, "cristiano ronaldo")["is_correct"] == True
        assert engine.validate_answer(challenge, "CRISTIANO RONALDO")["is_correct"] == True
        
        # These should fail
        assert engine.validate_answer(challenge, "Lionel Messi")["is_correct"] == False
        assert engine.validate_answer(challenge, "Random Name")["is_correct"] == False
    
    def test_special_character_validation(self):
        """Test validation with special characters"""
        engine = get_survival_engine()
        
        challenge = {
            "initials": "AA",
            "correct_answer": "Al-Farouq Aminu",
            "sport": "basketball"
        }
        
        # These should all pass now with the fix
        assert engine.validate_answer(challenge, "Al-Farouq Aminu")["is_correct"] == True
        assert engine.validate_answer(challenge, "Al Farouq Aminu")["is_correct"] == True
        assert engine.validate_answer(challenge, "AlFarouq Aminu")["is_correct"] == True


class TestSportDataIntegration:
    """Test integration with actual sport data"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Initialize sports data"""
        SportDataFactory._ensure_initialized()
    
    def test_all_sports_load_data(self):
        """Test that all sports can load survival data"""
        sports = ['football', 'basketball', 'tennis']
        
        for sport in sports:
            generator = SportDataFactory.get_generator(sport)
            assert generator is not None, f"No generator for {sport}"
            
            survival_data = generator.get_survival_data()
            assert isinstance(survival_data, dict), f"No survival data for {sport}"
            assert len(survival_data) > 0, f"Empty survival data for {sport}"
    
    def test_challenge_generation_works(self):
        """Test that challenge generation works for all sports"""
        engine = get_survival_engine()
        sports = ['football', 'basketball', 'tennis']
        
        for sport in sports:
            used_initials = set()
            challenge = engine.generate_challenge(1, sport, used_initials)
            
            assert challenge is not None, f"Could not generate challenge for {sport}"
            assert "initials" in challenge, f"Missing initials in {sport} challenge"
            assert "correct_answer" in challenge, f"Missing correct_answer in {sport} challenge"
            assert "sport" in challenge, f"Missing sport in {sport} challenge"


class TestRealWorldScenarios:
    """Test real-world scenarios that were failing"""
    
    def test_common_basketball_names(self):
        """Test common basketball player name variations"""
        test_cases = [
            ("LeBron James", "lebron james"),
            ("LeBron James", "Lebron James"),
            ("Michael Jordan", "michael jordan"),
            ("Kobe Bryant", "kobe bryant"),
            ("Stephen Curry", "stephen curry"),
            ("Kevin Durant", "kevin durant"),
        ]
        
        for correct, user_input in test_cases:
            similarity = calculate_similarity(correct, user_input)
            assert similarity >= 0.8, f"Failed: '{correct}' vs '{user_input}' = {similarity}"
    
    def test_common_football_names(self):
        """Test common football player name variations"""
        test_cases = [
            ("Cristiano Ronaldo", "cristiano ronaldo"),
            ("Lionel Messi", "lionel messi"),
            ("Kylian Mbappe", "kylian mbappe"),
            ("Kevin De Bruyne", "kevin de bruyne"),
            ("Virgil van Dijk", "virgil van dijk"),
        ]
        
        for correct, user_input in test_cases:
            similarity = calculate_similarity(correct, user_input)
            assert similarity >= 0.8, f"Failed: '{correct}' vs '{user_input}' = {similarity}"
    
    def test_names_with_special_characters(self):
        """Test names with special characters that were causing issues"""
        test_cases = [
            ("Al-Farouq Aminu", "Al Farouq Aminu"),
            ("Jean-Claude Brou", "Jean Claude Brou"),  
            ("Amar'e Stoudemire", "Amare Stoudemire"),
            ("A.C. Green", "AC Green"),
            ("J.R. Smith", "JR Smith"),
            ("D'Angelo Russell", "DAngelo Russell"),
        ]
        
        for correct, user_input in test_cases:
            similarity = calculate_similarity(correct, user_input)
            assert similarity >= 0.8, f"Failed: '{correct}' vs '{user_input}' = {similarity}"


if __name__ == "__main__":
    # Run specific test for debugging
    pytest.main([__file__, "-v"])