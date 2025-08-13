#!/usr/bin/env python3
"""Test script for the enhanced football data system"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from backend.sports.football_enhanced import EnhancedFootballQuestionGenerator
from backend.sports.football_data_loader import FootballDataLoader
from backend.sports.football_data_schema import League, DataType
from backend.sports.football_data_validator import FootballDataValidator

def test_data_loading():
    """Test data loading functionality"""
    print("Testing Data Loading...")
    print("=" * 50)
    
    loader = FootballDataLoader()
    
    # Test loading each league
    for league in League:
        print(f"\nLoading {league.value} data...")
        league_data = loader.load_league_data(league)
        
        if league_data:
            print(f"  Found data types: {list(league_data.keys())}")
            for data_type, items in league_data.items():
                print(f"  - {data_type.value}: {len(items)} items")
        else:
            print(f"  No data found")
            
def test_data_validation():
    """Test data validation"""
    print("\n\nTesting Data Validation...")
    print("=" * 50)
    
    loader = FootballDataLoader()
    validator = FootballDataValidator()
    
    results = validator.validate_all_files(loader)
    report = validator.generate_validation_report(results)
    print(report)
    
def test_question_generation():
    """Test question generation"""
    print("\n\nTesting Question Generation...")
    print("=" * 50)
    
    generator = EnhancedFootballQuestionGenerator("football")
    
    # Generate questions of different types
    print("\nGenerating 10 sample questions:\n")
    
    for i in range(10):
        try:
            question = generator.get_quiz_question()
            print(f"Question {i+1}:")
            print(f"  Category: {question['category']}")
            print(f"  Q: {question['question']}")
            print(f"  Options: {', '.join(question['options'])}")
            print(f"  Answer: {question['correct_answer']}")
            print()
        except Exception as e:
            print(f"  Error generating question: {e}")
            
def test_specific_features():
    """Test specific loader features"""
    print("\n\nTesting Specific Features...")
    print("=" * 50)
    
    loader = FootballDataLoader()
    
    # Test getting players by league
    print("\nPremier League Players (first 10):")
    pl_players = loader.get_players_by_league(League.PREMIER_LEAGUE)[:10]
    for player in pl_players:
        print(f"  - {player}")
        
    # Test getting teams by league  
    print("\nLa Liga Teams:")
    liga_teams = loader.get_teams_by_league(League.LA_LIGA)
    for team in liga_teams[:10]:
        print(f"  - {team}")
        
    # Test getting stat leaders
    print("\nPremier League Goals Leaders:")
    goal_leaders = loader.get_stat_leaders(League.PREMIER_LEAGUE, "Goals")[:5]
    for stat in goal_leaders:
        print(f"  - {stat.player_name}: {stat.stat_value}")
        
    # Test getting recent award winners
    print("\nRecent Ballon d'Or Winners (last 5 years):")
    recent_winners = loader.get_award_winners(League.GLOBAL, last_n_years=5)
    for award in recent_winners:
        print(f"  - {award.year}: {award.winner_name} ({award.nationality})")

def main():
    """Run all tests"""
    print("Enhanced Football Data System Test Suite")
    print("=" * 70)
    
    try:
        test_data_loading()
        test_data_validation()
        test_question_generation()
        test_specific_features()
        
        print("\n\nAll tests completed successfully!")
        
    except Exception as e:
        print(f"\n\nError during testing: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()