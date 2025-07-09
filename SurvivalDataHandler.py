#!/usr/bin/env python3

import json
import random
import os
import time
import threading

class SurvivalDataHandler:
    """
    Optimized data handler for survival mode using the massive 30k+ player dataset.
    This handler is designed for fast random access and efficient memory usage.
    """
    
    def __init__(self, data_file="survival_player_data.json"):
        self.data_file = data_file
        self.total_players = 0
        self.unique_initials = 0
        self.players = []
        self.initials_map = {}
        self.loaded = False
        self.loading_progress = 0
        self.loading_lock = threading.Lock()

        # Pre-check for file existence
        if not os.path.exists(self.data_file):
            print(f"❌ Survival data file not found: {self.data_file}")
        else:
            print("✅ SurvivalDataHandler initialized (lazy loading enabled).")

    def _load_data_chunked(self):
        """
        Load data in a separate thread to avoid blocking.
        This is a simplified chunking simulation; for huge files, a streaming parser would be better.
        """
        with self.loading_lock:
            if self.loaded or self.loading_progress != 0:
                return

            def load_action():
                try:
                    print("🔄 Starting background data load...")
                    self.loading_progress = 10
                    
                    with open(self.data_file, 'r', encoding='utf-8') as f:
                        data = json.load(f)
                    
                    self.loading_progress = 50
                    
                    self.total_players = data.get('total_players', 0)
                    self.unique_initials = data.get('unique_initials', 0)
                    self.players = data.get('players', [])
                    self.initials_map = data.get('initials_map', {})
                    
                    self.loading_progress = 90
                    
                    self.loaded = True
                    self.loading_progress = 100
                    print(f"✅ Loaded survival data: {self.total_players} players, {self.unique_initials} initial combinations")

                except Exception as e:
                    print(f"❌ Error loading survival data: {e}")
                    self.loading_progress = -1 # Indicate error

            # Start the loading in a background thread
            thread = threading.Thread(target=load_action)
            thread.start()

    def ensure_loaded(self):
        """Ensures data is loaded before access, triggering load if needed."""
        if not self.loaded and self.loading_progress == 0:
            self._load_data_chunked()
        # Wait for loading to complete if it's in progress
        while self.loading_progress > 0 and self.loading_progress < 100:
            time.sleep(0.1)
    
    def is_loaded(self):
        """Check if data is properly loaded"""
        return self.loaded

    def get_loading_status(self):
        """Returns the current loading progress."""
        return {"progress": self.loading_progress, "loaded": self.loaded}

    def get_all_players(self):
        """Get all unique player names"""
        self.ensure_loaded()
        if not self.is_loaded():
            return []
        return self.players.copy()
    
    def get_random_initials(self):
        """Get random initials that have multiple valid answers"""
        self.ensure_loaded()
        if not self.is_loaded() or not self.initials_map:
            return None, []
        
        # Get a random set of initials
        available_initials = list(self.initials_map.keys())
        random_initials = random.choice(available_initials)
        
        # Get all possible players for these initials
        possible_players = self.initials_map[random_initials].copy()
        
        return random_initials, possible_players
    
    def get_players_by_initials(self, initials):
        """Get all players that match the given initials"""
        self.ensure_loaded()
        if not self.is_loaded():
            return []
        
        return self.initials_map.get(initials, [])
    
    def validate_answer(self, answer, valid_initials, max_spelling_mistakes=2):
        """
        Validate if an answer matches any player with the given initials.
        Uses Levenshtein distance for fuzzy matching.
        """
        self.ensure_loaded()
        if not answer or not valid_initials:
            return False, None
        
        possible_players = self.get_players_by_initials(valid_initials)
        if not possible_players:
            return False, None
        
        # Check for exact matches first
        for player in possible_players:
            if player.lower() == answer.lower():
                return True, player
        
        # Check for fuzzy matches using Levenshtein distance
        for player in possible_players:
            if self._levenshtein_distance(player.lower(), answer.lower()) <= max_spelling_mistakes:
                return True, player
        
        return False, None
    
    def _levenshtein_distance(self, s1, s2):
        """Calculate Levenshtein distance between two strings"""
        if len(s1) < len(s2):
            return self._levenshtein_distance(s2, s1)
        
        if len(s2) == 0:
            return len(s1)
        
        previous_row = list(range(len(s2) + 1))
        for i, c1 in enumerate(s1):
            current_row = [i + 1]
            for j, c2 in enumerate(s2):
                insertions = previous_row[j + 1] + 1
                deletions = current_row[j] + 1
                substitutions = previous_row[j] + (c1 != c2)
                current_row.append(min(insertions, deletions, substitutions))
            previous_row = current_row
        
        return previous_row[-1]
    
    def get_statistics(self):
        """Get statistics about the dataset"""
        self.ensure_loaded()
        if not self.is_loaded():
            return {}
        
        # Calculate initials distribution
        initials_distribution = {}
        for initials, players in self.initials_map.items():
            count = len(players)
            if count not in initials_distribution:
                initials_distribution[count] = 0
            initials_distribution[count] += 1
        
        # Find most and least common initials
        sorted_initials = sorted(self.initials_map.items(), key=lambda x: len(x[1]), reverse=True)
        most_common = sorted_initials[:5] if sorted_initials else []
        least_common = sorted_initials[-5:] if len(sorted_initials) >= 5 else []
        
        return {
            'total_players': self.total_players,
            'unique_initials': self.unique_initials,
            'most_common_initials': [(initials, len(players)) for initials, players in most_common],
            'least_common_initials': [(initials, len(players)) for initials, players in least_common],
            'initials_distribution': initials_distribution
        }
    
    def search_players(self, query, limit=20):
        """Search for players by name (useful for testing/debugging)"""
        self.ensure_loaded()
        if not self.is_loaded() or not query:
            return []
        
        query_lower = query.lower()
        matches = []
        
        for player in self.players:
            if query_lower in player.lower():
                matches.append(player)
                if len(matches) >= limit:
                    break
        
        return matches
    
    def get_sample_round(self):
        """Get a sample round for testing purposes"""
        self.ensure_loaded()
        if not self.is_loaded():
            return None
        
        initials, possible_players = self.get_random_initials()
        if not initials:
            return None
        
        return {
            'initials': initials,
            'initials_formatted': f"{initials[0]} {initials[1]}",
            'possible_answers_count': len(possible_players),
            'sample_answers': possible_players[:5],  # Show first 5 as examples
            'all_answers': possible_players  # For validation
        }

# Quick test function
def test_survival_data_handler():
    """Test the SurvivalDataHandler functionality"""
    print("🧪 Testing SurvivalDataHandler...")
    
    handler = SurvivalDataHandler()
    
    # Trigger loading
    print("   - Triggering lazy load...")
    handler.ensure_loaded()
    
    # Check loading status
    while not handler.is_loaded():
        status = handler.get_loading_status()
        print(f"   - Loading... {status['progress']}%")
        time.sleep(0.2)
    
    print("   - ✅ Data loaded!")

    # Test basic functionality
    stats = handler.get_statistics()
    print(f"📊 Dataset stats: {stats['total_players']} players, {stats['unique_initials']} initials")
    
    # Test random round generation
    for i in range(3):
        round_data = handler.get_sample_round()
        if round_data:
            print(f"🎮 Round {i+1}: {round_data['initials_formatted']} ({round_data['possible_answers_count']} answers)")
            print(f"   Sample: {', '.join(round_data['sample_answers'][:3])}")
    
    # Test answer validation
    test_cases = [
        ("Lionel Messi", "LM"),
        ("Cristiano Ronaldo", "CR"),
        ("messi", "LM"),  # Case insensitive
        ("messy", "LM"),  # Fuzzy match
        ("Invalid Player", "XX")  # Should fail
    ]
    
    print("\n🧪 Testing answer validation:")
    for answer, initials in test_cases:
        is_valid, matched_player = handler.validate_answer(answer, initials)
        print(f"   '{answer}' for {initials}: {'✅' if is_valid else '❌'} {matched_player or ''}")
    
    return True

if __name__ == "__main__":
    test_survival_data_handler()
