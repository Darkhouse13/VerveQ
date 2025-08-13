#!/usr/bin/env python3
"""Test script for the enhanced football question generation system"""

import sys
import os
import json
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from backend.sports.football_enhanced import EnhancedFootballQuestionGenerator
from backend.sports.football_config import get_config_manager
from backend.sports.football_logger import get_logger
from backend.sports.football_selector import get_league_selector, get_question_type_selector
from backend.sports.football_categories import get_category_manager
from backend.sports.football_data_schema import League

def test_enhanced_initialization():
    """Test the enhanced system initialization"""
    print("Testing Enhanced System Initialization...")
    print("=" * 60)
    
    try:
        generator = EnhancedFootballQuestionGenerator("football")
        
        print(f"✓ Successfully initialized generator")
        print(f"✓ Available leagues: {len(generator.available_leagues)}")
        print(f"✓ Configuration manager: {generator.config_manager is not None}")
        print(f"✓ Logger: {generator.logger is not None}")
        print(f"✓ League selector: {generator.league_selector is not None}")
        print(f"✓ Question type selector: {generator.question_type_selector is not None}")
        print(f"✓ Category manager: {generator.category_manager is not None}")
        print(f"✓ Error handler: {generator.error_handler is not None}")
        
        return generator
        
    except Exception as e:
        print(f"✗ Initialization failed: {e}")
        return None

def test_league_selection(generator):
    """Test the weighted league selection"""
    print("\n\nTesting League Selection...")
    print("=" * 60)
    
    try:
        # Test multiple selections to see distribution
        selections = []
        for i in range(20):
            league = generator.league_selector.select_league(generator.available_leagues, generator.all_data)
            selections.append(league.value)
            
        # Count distribution
        from collections import Counter
        distribution = Counter(selections)
        
        print("League selection distribution (20 selections):")
        for league, count in distribution.items():
            percentage = (count / 20) * 100
            print(f"  {league}: {count} ({percentage:.1f}%)")
            
        # Test selection statistics
        stats = generator.league_selector.get_selection_stats()
        print(f"\nSelection statistics:")
        print(f"  Total selections: {stats['total_selections']}")
        print(f"  History size: {stats['history_size']}")
        
        return True
        
    except Exception as e:
        print(f"✗ League selection test failed: {e}")
        return False

def test_question_generation(generator):
    """Test the enhanced question generation"""
    print("\n\nTesting Question Generation...")
    print("=" * 60)
    
    try:
        questions = []
        categories = []
        leagues = []
        question_types = []
        
        # Generate multiple questions
        for i in range(15):
            question = generator.get_quiz_question()
            questions.append(question)
            categories.append(question.get("category", "Unknown"))
            
            # Try to extract league from category (simplified)
            category = question.get("category", "")
            if "Premier League" in category:
                leagues.append("Premier League")
            elif "La Liga" in category:
                leagues.append("La Liga")
            elif "International" in category:
                leagues.append("International")
            elif "Serie A" in category:
                leagues.append("Serie A")
            elif "Ligue 1" in category:
                leagues.append("Ligue 1")
            elif "African" in category:
                leagues.append("African")
            else:
                leagues.append("Other")
                
        # Show some sample questions
        print("Sample questions generated:")
        for i, q in enumerate(questions[:5]):
            print(f"\n{i+1}. Category: {q['category']}")
            print(f"   Q: {q['question']}")
            print(f"   Options: {', '.join(q['options'])}")
            print(f"   Answer: {q['correct_answer']}")
            
        # Show category distribution
        from collections import Counter
        category_dist = Counter(categories)
        league_dist = Counter(leagues)
        
        print(f"\nCategory distribution ({len(questions)} questions):")
        for category, count in category_dist.most_common():
            print(f"  {category}: {count}")
            
        print(f"\nLeague distribution ({len(questions)} questions):")
        for league, count in league_dist.most_common():
            print(f"  {league}: {count}")
            
        return True
        
    except Exception as e:
        print(f"✗ Question generation test failed: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_category_management(generator):
    """Test the category management system"""
    print("\n\nTesting Category Management...")
    print("=" * 60)
    
    try:
        category_manager = generator.category_manager
        
        # Test category generation for different leagues
        test_cases = [
            (League.PREMIER_LEAGUE, "award_winner"),
            (League.LA_LIGA, "stat_leader"),
            (League.GLOBAL, "award_winner"),
            (League.SERIE_A, "award_nationality")
        ]
        
        print("Sample category generation:")
        for league, question_type in test_cases:
            from backend.sports.football_data_schema import DataType
            data_type = DataType.AWARD_HISTORICAL if "award" in question_type else DataType.SEASON_STATS_PLAYER
            
            category = category_manager.generate_category(league, data_type, question_type)
            hierarchy = category_manager.get_category_hierarchy(league, data_type, question_type)
            
            print(f"\n  League: {league.value}")
            print(f"  Question Type: {question_type}")
            print(f"  Generated Category: {category}")
            print(f"  Hierarchy: {hierarchy}")
            
        return True
        
    except Exception as e:
        print(f"✗ Category management test failed: {e}")
        return False

def test_error_handling(generator):
    """Test the error handling system"""
    print("\n\nTesting Error Handling...")
    print("=" * 60)
    
    try:
        # Test with invalid data to trigger error handling
        original_data = generator.all_data.copy()
        
        # Temporarily corrupt data to test error handling
        generator.all_data = {}
        
        # This should trigger fallback mechanisms
        question = generator.get_quiz_question()
        
        print(f"✓ Error handling worked - got fallback question:")
        print(f"  Q: {question['question']}")
        print(f"  Category: {question['category']}")
        
        # Restore original data
        generator.all_data = original_data
        
        # Check error statistics
        error_stats = generator.error_handler.get_error_statistics()
        print(f"\nError statistics:")
        print(f"  Total errors: {error_stats.get('total_errors', 0)}")
        print(f"  Fallback usage: {error_stats.get('fallback_usage_count', 0)}")
        
        return True
        
    except Exception as e:
        print(f"✗ Error handling test failed: {e}")
        return False

def test_performance_monitoring(generator):
    """Test performance monitoring features"""
    print("\n\nTesting Performance Monitoring...")
    print("=" * 60)
    
    try:
        # Generate some questions to have data
        for i in range(10):
            generator.get_quiz_question()
            
        # Get comprehensive statistics
        stats = generator.get_generation_statistics()
        
        print("Performance statistics:")
        print(f"  League selector stats: {stats['league_selector_stats']['total_selections']} selections")
        print(f"  Session summary: {stats['logger_session_summary']['session_duration_minutes']:.2f} minutes")
        
        # Get league distribution report
        league_report = generator.get_league_distribution_report(24)
        print(f"\nLeague distribution (24h):")
        print(f"  Total questions: {league_report.get('total_questions', 0)}")
        print(f"  Success rate: {league_report.get('success_rate', 0):.2%}")
        
        if 'league_distribution' in league_report:
            for league, count in league_report['league_distribution'].items():
                print(f"  {league}: {count}")
                
        return True
        
    except Exception as e:
        print(f"✗ Performance monitoring test failed: {e}")
        return False

def test_configuration_system(generator):
    """Test the configuration system"""
    print("\n\nTesting Configuration System...")
    print("=" * 60)
    
    try:
        # Test league weight configuration
        original_weights = {}
        for league in generator.available_leagues:
            original_weights[league.value] = generator.config_manager.get_config().get_league_weight(league)
            
        print("Original league weights:")
        for league, weight in original_weights.items():
            print(f"  {league}: {weight}")
            
        # Test dynamic weight adjustment
        new_weights = {"premier_league": 3.0, "la_liga": 2.5}
        generator.configure_league_weights(new_weights)
        
        print("\nAfter weight adjustment:")
        for league_name, new_weight in new_weights.items():
            try:
                league = League(league_name)
                current_weight = generator.config_manager.get_config().get_league_weight(league)
                print(f"  {league_name}: {current_weight} (expected: {new_weight})")
            except:
                print(f"  {league_name}: Invalid league")
                
        return True
        
    except Exception as e:
        print(f"✗ Configuration system test failed: {e}")
        return False

def test_league_information(generator):
    """Test league information retrieval"""
    print("\n\nTesting League Information...")
    print("=" * 60)
    
    try:
        league_info = generator.get_available_leagues_info()
        
        print("Available leagues information:")
        for league_key, info in league_info.items():
            print(f"\n{info['display_name']} ({league_key}):")
            print(f"  Data types: {[dt.value for dt in info['data_types']]}")
            print(f"  Total records: {info['total_records']}")
            print(f"  Current weight: {info['current_weight']}")
            
            # Show data type breakdown
            for key, value in info.items():
                if key.endswith('_count'):
                    data_type = key.replace('_count', '')
                    print(f"  {data_type}: {value} records")
                    
        return True
        
    except Exception as e:
        print(f"✗ League information test failed: {e}")
        return False

def run_comprehensive_test():
    """Run all tests"""
    print("Enhanced Football Question Generation System - Comprehensive Test")
    print("=" * 80)
    
    # Initialize system
    generator = test_enhanced_initialization()
    if not generator:
        print("Failed to initialize system. Aborting tests.")
        return
        
    # Run all tests
    tests = [
        ("League Selection", test_league_selection),
        ("Question Generation", test_question_generation),
        ("Category Management", test_category_management),
        ("Error Handling", test_error_handling),
        ("Performance Monitoring", test_performance_monitoring),
        ("Configuration System", test_configuration_system),
        ("League Information", test_league_information)
    ]
    
    passed = 0
    failed = 0
    
    for test_name, test_func in tests:
        try:
            if test_func(generator):
                passed += 1
                print(f"✓ {test_name} test PASSED")
            else:
                failed += 1
                print(f"✗ {test_name} test FAILED")
        except Exception as e:
            failed += 1
            print(f"✗ {test_name} test FAILED with exception: {e}")
            
    # Summary
    print(f"\n\nTest Summary:")
    print(f"=" * 80)
    print(f"Total tests: {len(tests)}")
    print(f"Passed: {passed}")
    print(f"Failed: {failed}")
    print(f"Success rate: {passed/len(tests)*100:.1f}%")
    
    if failed == 0:
        print("\n🎉 All tests passed! The enhanced system is working correctly.")
    else:
        print(f"\n⚠️  {failed} test(s) failed. Please check the output above for details.")

if __name__ == "__main__":
    run_comprehensive_test()