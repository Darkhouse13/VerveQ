#!/usr/bin/env python3
"""
Script to create optimized survival data with only initials mapping structure.
This eliminates the redundant players array and reduces file size significantly.
"""

import json
from pathlib import Path

def create_optimized_survival_data():
    """Create optimized JSON file with only initials mapping."""
    
    # Read the original file
    original_file = Path("survival_player_data.json")
    optimized_file = Path("survival_initials_map.json")
    
    if not original_file.exists():
        print(f"❌ Original file not found: {original_file}")
        return
    
    print("📖 Reading original survival data...")
    with open(original_file, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    # Extract only the metadata and initials mapping
    optimized_data = {
        "total_players": data["total_players"],
        "unique_initials": data["unique_initials"],
        "initials_map": data["initials_map"]
    }
    
    # Write optimized file
    print("💾 Writing optimized survival data...")
    with open(optimized_file, 'w', encoding='utf-8') as f:
        json.dump(optimized_data, f, indent=2, ensure_ascii=False)
    
    # Compare file sizes
    original_size = original_file.stat().st_size
    optimized_size = optimized_file.stat().st_size
    reduction = ((original_size - optimized_size) / original_size) * 100
    
    print(f"✅ Optimization complete!")
    print(f"📊 Original file: {original_size / 1024:.1f} KB")
    print(f"📊 Optimized file: {optimized_size / 1024:.1f} KB")
    print(f"📉 Size reduction: {reduction:.1f}%")
    
    # Verify data integrity
    print("\n🔍 Verifying data integrity...")
    verify_data_integrity(optimized_data)
    
    return optimized_file

def verify_data_integrity(data):
    """Verify the optimized data structure."""
    
    # Check metadata
    total_players = data["total_players"]
    unique_initials = data["unique_initials"]
    initials_map = data["initials_map"]
    
    print(f"   📊 Metadata: {total_players} players, {unique_initials} initials")
    
    # Count actual players in mapping
    actual_players = 0
    actual_initials = len(initials_map)
    
    for initials, players in initials_map.items():
        actual_players += len(players)
        
        # Check initials format
        if len(initials) != 2:
            print(f"   ⚠️ Invalid initials format: {initials}")
        
        # Check for empty player lists
        if not players:
            print(f"   ⚠️ Empty player list for initials: {initials}")
    
    print(f"   ✅ Actual players in mapping: {actual_players}")
    print(f"   ✅ Actual initials in mapping: {actual_initials}")
    
    # Check for discrepancies
    if actual_players != total_players:
        print(f"   ⚠️ Player count mismatch: {actual_players} vs {total_players}")
    
    if actual_initials != unique_initials:
        print(f"   ⚠️ Initials count mismatch: {actual_initials} vs {unique_initials}")
    
    # Show some sample initials
    print(f"\n🎯 Sample initials:")
    sample_initials = list(initials_map.keys())[:10]
    for initials in sample_initials:
        player_count = len(initials_map[initials])
        sample_players = initials_map[initials][:3]
        print(f"   {initials}: {player_count} players (e.g., {', '.join(sample_players)})")

if __name__ == "__main__":
    create_optimized_survival_data()