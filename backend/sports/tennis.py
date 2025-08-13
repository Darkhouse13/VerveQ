import os
import random
from typing import List, Dict, Any
from .base import SportQuestionGenerator, SportDataFactory

class TennisQuestionGenerator(SportQuestionGenerator):
    """Tennis-specific question generator"""
    
    def __init__(self, sport_name: str):
        super().__init__(sport_name)
        # Use absolute path from project root
        self.data_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "processed_tennis")
        # Track data source usage for variety
        self.data_source_usage = {"stats": 0, "awards": 0, "tournaments": 0}
    
    def get_quiz_question(self) -> Dict[str, Any]:
        """Generate a random tennis quiz question"""
        
        # Load tennis stats data
        stats_path = os.path.join(self.data_dir, "tennis_stats.json")
        awards_path = os.path.join(self.data_dir, "tennis_awards.json") 
        tournaments_path = os.path.join(self.data_dir, "tennis_tournaments.json")
        
        stats_data = self.load_json_file(stats_path)
        awards_data = self.load_json_file(awards_path)
        tournaments_data = self.load_json_file(tournaments_path)
        
        # Choose data source randomly
        data_sources = []
        if stats_data:
            data_sources.append(("stats", stats_data))
        if awards_data:
            data_sources.append(("awards", awards_data))
        if tournaments_data and isinstance(tournaments_data, dict):
            data_sources.append(("tournaments", tournaments_data))
        
        if not data_sources:
            raise ValueError("No tennis quiz data available")
        
        # Choose data source with preference for less used sources (for variety)
        weighted_sources = []
        min_usage = min(self.data_source_usage.get(ds[0], 0) for ds in data_sources)
        
        for data_type, data in data_sources:
            usage = self.data_source_usage.get(data_type, 0)
            # Give higher weight to less used sources
            weight = max(1, (min_usage + 2) - usage)
            weighted_sources.extend([(data_type, data)] * weight)
        
        data_type, data = random.choice(weighted_sources)
        self.data_source_usage[data_type] += 1
        
        if data_type == "stats":
            return self._generate_stats_question(data)
        elif data_type == "awards":
            return self._generate_awards_question(data)
        else:  # tournaments
            return self._generate_tournaments_question(data)
    
    def _generate_stats_question(self, stats_data: List[Dict]) -> Dict[str, Any]:
        """Generate question from tennis stats data"""
        # Filter out incomplete records
        valid_stats = [
            player for player in stats_data 
            if player.get('player_name') and player.get('player_name').strip()
        ]
        
        if not valid_stats:
            raise ValueError("No valid stats data available")
            
        player_data = random.choice(valid_stats)
        
        # Choose question type based on available data
        available_types = []
        if player_data.get('career_titles') is not None:
            available_types.append("career_titles")
        if player_data.get('grand_slam_titles') is not None:
            available_types.append("grand_slams")
        if player_data.get('win_percentage') is not None:
            available_types.append("win_percentage")
        if player_data.get('best_surface'):
            available_types.append("best_surface")
            
        if not available_types:
            available_types = ["career_titles"]  # fallback
            
        question_type = random.choice(available_types)
        
        if question_type == "career_titles" and "career_titles" in player_data:
            question = f"How many career titles does {player_data['player_name']} have?"
            correct = str(player_data['career_titles'])
            
            # Generate wrong numerical options
            base_val = player_data['career_titles']
            wrong_options = [str(base_val + random.randint(-20, 20)) for _ in range(3)]
            wrong_options = [opt for opt in wrong_options if opt != correct and int(opt) > 0][:3]
            
        elif question_type == "grand_slams" and "grand_slam_titles" in player_data:
            question = f"How many Grand Slam titles has {player_data['player_name']} won?"
            correct = str(player_data['grand_slam_titles'])
            
            # Generate plausible wrong options
            base_val = player_data['grand_slam_titles']
            wrong_options = [str(base_val + random.randint(-5, 10)) for _ in range(3)]
            wrong_options = [opt for opt in wrong_options if opt != correct and int(opt) >= 0][:3]
            
        elif question_type == "win_percentage" and "win_percentage" in player_data:
            question = f"What is {player_data['player_name']}'s career win percentage?"
            correct = f"{player_data['win_percentage']}%"
            
            # Generate wrong percentage options
            base_val = player_data['win_percentage']
            wrong_options = [f"{base_val + random.uniform(-10, 10):.1f}%" for _ in range(3)]
            
        else:  # best_surface or fallback
            if "best_surface" in player_data:
                question = f"What is {player_data['player_name']}'s best playing surface?"
                correct = player_data['best_surface']
                
                all_surfaces = ["Hard", "Clay", "Grass", "Carpet"]
                wrong_options = [surf for surf in all_surfaces if surf != correct][:3]
            else:
                # Fallback to career wins
                question = f"How many career wins does {player_data['player_name']} have?"
                correct = str(player_data.get('career_wins', 0))
                base_val = player_data.get('career_wins', 0)
                wrong_options = [str(base_val + random.randint(-100, 200)) for _ in range(3)]
        
        options = [correct] + wrong_options
        random.shuffle(options)
        
        return {
            "question": question,
            "options": options,
            "correct_answer": correct,
            "category": "Tennis Stats",
            "sport": "tennis"
        }
    
    def _generate_awards_question(self, awards_data: List[Dict]) -> Dict[str, Any]:
        """Generate question from tennis awards data"""
        # Filter out incomplete records
        valid_awards = [
            award for award in awards_data 
            if all([
                award.get('Award') and award.get('Award').strip(),
                award.get('Player') and award.get('Player').strip(), 
                award.get('Season') and str(award.get('Season')).strip()
            ])
        ]
        
        if not valid_awards:
            raise ValueError("No valid award data available")
            
        award = random.choice(valid_awards)
        
        question = f"Who won the {award['Award']} in {award['Season']}?"
        correct = award['Player']
        
        # Get other winners for wrong options (only valid players)
        other_winners = [item['Player'] for item in valid_awards 
                        if item['Player'] != correct and item['Player'].strip()]
        wrong_options = self.get_random_wrong_options(correct, other_winners, 3)
        
        options = [correct] + wrong_options
        random.shuffle(options)
        
        return {
            "question": question,
            "options": options,
            "correct_answer": correct,
            "category": "Tennis Awards",
            "sport": "tennis"
        }
    
    def _generate_tournaments_question(self, tournaments_data: Dict) -> Dict[str, Any]:
        """Generate question from tennis tournaments data"""
        # Convert dict to list of tournaments with valid data
        valid_tournaments = []
        for tournament_key, tournament_info in tournaments_data.items():
            if all([
                tournament_info.get('tournament_name') and tournament_info.get('tournament_name').strip(),
                tournament_info.get('champion') and tournament_info.get('champion').strip(),
                tournament_info.get('year') and str(tournament_info.get('year')).strip()
            ]):
                valid_tournaments.append(tournament_info)
        
        if not valid_tournaments:
            raise ValueError("No valid tournament data available")
            
        tournament = random.choice(valid_tournaments)
        
        question = f"Who won the {tournament['tournament_name']} in {tournament['year']}?"
        correct = tournament['champion']
        
        # Get other champions for wrong options (only valid champions)
        other_champions = [item['champion'] for item in valid_tournaments 
                          if item['champion'] != correct and item['champion'].strip()]
        wrong_options = self.get_random_wrong_options(correct, other_champions, 3)
        
        options = [correct] + wrong_options
        random.shuffle(options)
        
        return {
            "question": question,
            "options": options,
            "correct_answer": correct,
            "category": "Tennis Tournaments",
            "sport": "tennis"
        }
    
    def get_survival_data(self) -> Dict[str, List[str]]:
        """Get tennis survival initials mapping"""
        # Use absolute path from project root
        project_root = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
        survival_path = os.path.join(project_root, "data", "survival_data", "survival_initials_map_tennis.json")
        data = self.load_json_file(survival_path)
        
        if isinstance(data, dict):
            return data.get("initials_map", {})
        return {}
    
    def get_sport_theme(self) -> Dict[str, str]:
        """Get tennis theme colors and styling"""
        return {
            "primary_color": "#2e7d32",
            "secondary_color": "#66bb6a",
            "accent_color": "#ffb74d", 
            "background_color": "#f1f8e9",
            "text_color": "#1b5e20",
            "icon": "🎾",
            "display_name": "Tennis"
        }

# Registration handled in __init__.py