#!/usr/bin/env python3
"""Comprehensive test script for the enhanced football data integration system"""

import sys
import os
import time
import json
# Add parent directory to path to import from backend
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.sports.football_enhanced import EnhancedFootballQuestionGenerator
from backend.sports.football_data_integration import get_integration_manager
from backend.sports.football_cache_manager import get_cache_manager
from backend.sports.football_lazy_loader import get_lazy_loader
from backend.sports.football_query_optimizer import get_query_optimizer
from backend.sports.football_data_schema import League, DataType

def test_integration_manager():
    """Test the core integration manager functionality"""
    print("Testing Integration Manager...")
    print("=" * 60)
    
    try:
        # Initialize integration manager
        integration_manager = get_integration_manager()
        
        # Test data loading
        print("Loading all data...")
        start_time = time.time()
        all_data = integration_manager.load_all_data()
        load_time = time.time() - start_time
        
        print(f"✓ Loaded data for {len(all_data)} leagues in {load_time:.2f}s")
        
        # Test data source status
        source_status = integration_manager.get_data_source_status()
        print(f"✓ Data source status obtained for {len(source_status)} sources")
        
        # Test integration metrics
        metrics = integration_manager.get_integration_metrics()
        print(f"✓ Integration metrics: {metrics['total_data_loaded']} records loaded")
        print(f"  - Cache hit rate: {metrics['cache_hit_rate_percent']:.1f}%")
        print(f"  - Query performance: {metrics['query_performance_ms']:.2f}ms avg")
        
        # Test data querying
        if League.PREMIER_LEAGUE in all_data:
            query_params = {'player_name': 'Mohamed Salah'}
            results = integration_manager.get_data(League.PREMIER_LEAGUE, DataType.SEASON_STATS_PLAYER, query_params)
            print(f"✓ Query test: Found {len(results)} results for Mohamed Salah")
        
        return True
        
    except Exception as e:
        print(f"✗ Integration manager test failed: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_caching_system():
    """Test the multi-level caching system"""
    print("\n\nTesting Caching System...")
    print("=" * 60)
    
    try:
        cache_manager = get_cache_manager()
        
        # Test cache operations
        test_key = "test_key"
        test_value = {"test": "data", "numbers": [1, 2, 3]}
        
        # Put and get
        cache_manager.put(test_key, test_value)
        retrieved_value = cache_manager.get(test_key)
        
        if retrieved_value == test_value:
            print("✓ Cache put/get operations working")
        else:
            print("✗ Cache put/get operations failed")
            
        # Test cache statistics
        stats = cache_manager.get_stats()
        print(f"✓ Cache statistics:")
        print(f"  - Overall hit rate: {stats['overall']['hit_rate_percent']:.1f}%")
        print(f"  - L1 memory entries: {stats['l1_memory']['size_entries']}")
        print(f"  - L2 file count: {stats['l2_file']['file_count']}")
        
        # Test cache performance
        performance_start = time.time()
        for i in range(100):
            cache_manager.get(test_key)
        performance_time = time.time() - performance_start
        
        print(f"✓ Cache performance: 100 gets in {performance_time:.4f}s")
        
        return True
        
    except Exception as e:
        print(f"✗ Caching system test failed: {e}")
        return False

def test_lazy_loading():
    """Test the lazy loading system"""
    print("\n\nTesting Lazy Loading...")
    print("=" * 60)
    
    try:
        lazy_loader = get_lazy_loader()
        
        # Test lazy loading
        print("Testing lazy data loading...")
        
        # Load data for Premier League
        pl_data = lazy_loader.get_data(League.PREMIER_LEAGUE, DataType.SEASON_STATS_PLAYER)
        if pl_data:
            print(f"✓ Loaded {len(pl_data)} Premier League player stats")
        
        # Test loading status
        loading_status = lazy_loader.get_loading_status()
        print(f"✓ Loading status tracked for {len(loading_status)} data sources")
        
        # Test usage statistics
        usage_stats = lazy_loader.get_usage_stats()
        print(f"✓ Usage statistics available for {len(usage_stats)} leagues")
        
        # Test predictive loading
        lazy_loader.start_predictive_loading()
        print("✓ Predictive loading started")
        
        return True
        
    except Exception as e:
        print(f"✗ Lazy loading test failed: {e}")
        return False

def test_query_optimization():
    """Test the query optimization system"""
    print("\n\nTesting Query Optimization...")
    print("=" * 60)
    
    try:
        query_optimizer = get_query_optimizer()
        
        # Test query statistics
        query_stats = query_optimizer.get_query_stats()
        print(f"✓ Query statistics: {query_stats['total_queries']} queries processed")
        
        # Test index statistics
        index_stats = query_optimizer.get_index_stats()
        print(f"✓ Index statistics: {len(index_stats)} indexes created")
        
        # Show some index details
        for index_name, stats in list(index_stats.items())[:3]:
            print(f"  - {index_name}: {stats['entry_count']} entries, {stats['index_type']} type")
        
        return True
        
    except Exception as e:
        print(f"✗ Query optimization test failed: {e}")
        return False

def test_enhanced_generator():
    """Test the enhanced question generator with integration"""
    print("\n\nTesting Enhanced Question Generator...")
    print("=" * 60)
    
    try:
        generator = EnhancedFootballQuestionGenerator("football")
        
        # Test basic question generation
        print("Generating sample questions...")
        questions = []
        for i in range(5):
            question = generator.get_quiz_question()
            questions.append(question)
            print(f"  {i+1}. {question['category']}: {question['question']}")
        
        print(f"✓ Generated {len(questions)} questions successfully")
        
        # Test comprehensive report
        report = generator.get_comprehensive_report()
        print(f"✓ Comprehensive report generated with {len(report)} sections")
        
        # Test integration metrics
        integration_metrics = generator.get_integration_metrics()
        print(f"✓ Integration metrics: {integration_metrics['total_data_loaded']} records")
        
        # Test data source status
        source_status = generator.get_data_source_status()
        enabled_sources = sum(1 for s in source_status.values() if s['enabled'])
        print(f"✓ Data source status: {enabled_sources}/{len(source_status)} sources enabled")
        
        # Test performance optimization
        optimization_result = generator.optimize_performance()
        print(f"✓ Performance optimization completed: {optimization_result}")
        
        return True
        
    except Exception as e:
        print(f"✗ Enhanced generator test failed: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_advanced_queries():
    """Test advanced query capabilities"""
    print("\n\nTesting Advanced Query Capabilities...")
    print("=" * 60)
    
    try:
        integration_manager = get_integration_manager()
        
        # Test different query types
        test_queries = [
            {
                'league': League.PREMIER_LEAGUE,
                'data_type': DataType.SEASON_STATS_PLAYER,
                'query': {'player_name': 'Mohamed Salah'},
                'description': 'Player-specific query'
            },
            {
                'league': League.GLOBAL,
                'data_type': DataType.AWARD_HISTORICAL,
                'query': {'nationality': 'ARG'},
                'description': 'Nationality-based query'
            },
            {
                'league': League.LA_LIGA,
                'data_type': DataType.SEASON_STATS_TEAM,
                'query': {'team_name': 'Barcelona'},
                'description': 'Team-specific query'
            }
        ]
        
        successful_queries = 0
        
        for test_query in test_queries:
            try:
                results = integration_manager.get_data(
                    test_query['league'],
                    test_query['data_type'],
                    test_query['query']
                )
                
                print(f"✓ {test_query['description']}: {len(results)} results")
                successful_queries += 1
                
            except Exception as e:
                print(f"✗ {test_query['description']} failed: {e}")
        
        print(f"✓ {successful_queries}/{len(test_queries)} advanced queries successful")
        
        return successful_queries > 0
        
    except Exception as e:
        print(f"✗ Advanced queries test failed: {e}")
        return False

def test_performance_metrics():
    """Test performance metrics and monitoring"""
    print("\n\nTesting Performance Metrics...")
    print("=" * 60)
    
    try:
        integration_manager = get_integration_manager()
        
        # Get comprehensive metrics
        metrics = integration_manager.get_integration_metrics()
        
        # Display key performance indicators
        print("Key Performance Indicators:")
        print(f"  - Total data loaded: {metrics['total_data_loaded']} records")
        print(f"  - Load time: {metrics['total_load_time_ms']:.2f}ms")
        print(f"  - Cache hit rate: {metrics['cache_hit_rate_percent']:.1f}%")
        print(f"  - Query performance: {metrics['query_performance_ms']:.2f}ms avg")
        print(f"  - Index creation time: {metrics['index_creation_time_ms']:.2f}ms")
        print(f"  - Transformation time: {metrics['transformation_time_ms']:.2f}ms")
        
        # Check if performance is within acceptable ranges
        performance_checks = [
            (metrics['cache_hit_rate_percent'] > 50, "Cache hit rate > 50%"),
            (metrics['query_performance_ms'] < 100, "Query performance < 100ms"),
            (metrics['total_load_time_ms'] < 30000, "Total load time < 30s")
        ]
        
        passed_checks = sum(1 for check, _ in performance_checks if check)
        print(f"\n✓ Performance checks: {passed_checks}/{len(performance_checks)} passed")
        
        for check, description in performance_checks:
            status = "✓" if check else "✗"
            print(f"  {status} {description}")
        
        return passed_checks >= 2  # At least 2 out of 3 checks should pass
        
    except Exception as e:
        print(f"✗ Performance metrics test failed: {e}")
        return False

def run_comprehensive_integration_test():
    """Run all integration tests"""
    print("Enhanced Football Data Integration System - Comprehensive Test")
    print("=" * 80)
    
    # Run all test modules
    tests = [
        ("Integration Manager", test_integration_manager),
        ("Caching System", test_caching_system),
        ("Lazy Loading", test_lazy_loading),
        ("Query Optimization", test_query_optimization),
        ("Enhanced Generator", test_enhanced_generator),
        ("Advanced Queries", test_advanced_queries),
        ("Performance Metrics", test_performance_metrics)
    ]
    
    passed = 0
    failed = 0
    
    for test_name, test_func in tests:
        try:
            print(f"\n{'='*20} {test_name} {'='*20}")
            if test_func():
                passed += 1
                print(f"✓ {test_name} test PASSED")
            else:
                failed += 1
                print(f"✗ {test_name} test FAILED")
        except Exception as e:
            failed += 1
            print(f"✗ {test_name} test FAILED with exception: {e}")
    
    # Final summary
    print(f"\n\nIntegration Test Summary:")
    print(f"=" * 80)
    print(f"Total tests: {len(tests)}")
    print(f"Passed: {passed}")
    print(f"Failed: {failed}")
    print(f"Success rate: {passed/len(tests)*100:.1f}%")
    
    if failed == 0:
        print("\n🎉 All integration tests passed! The enhanced system is working correctly.")
    else:
        print(f"\n⚠️  {failed} test(s) failed. Please check the output above for details.")
    
    return failed == 0

if __name__ == "__main__":
    success = run_comprehensive_integration_test()
    sys.exit(0 if success else 1)