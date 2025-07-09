import json
from typing import Dict, List
import os
import glob

def load_json_data(file_pattern: str) -> List:
    """Load and return the JSON data from files matching the pattern."""
    all_data = []
    script_dir = os.path.dirname(os.path.abspath(__file__))
    
    # Look for files matching the pattern
    pattern = os.path.join(script_dir, file_pattern)
    json_files = glob.glob(pattern)
    
    if not json_files:
        # Try the original single file name
        single_file = os.path.join(script_dir, 'all_parsed_football_data.json')
        if os.path.exists(single_file):
            json_files = [single_file]
    
    print(f"Found {len(json_files)} JSON files to process")
    
    for file_path in sorted(json_files):
        print(f"Loading {os.path.basename(file_path)}...")
        with open(file_path, 'r', encoding='utf-8') as file:
            data = json.load(file)
            all_data.extend(data)
    
    return all_data

def calculate_team_stats(data: List, team_name: str, season: str) -> Dict:
    """
    Calculate statistics for a specific team in a given season.
    Returns a dictionary containing matches played and total points.
    """
    matches_played = 0
    points = 0
    wins = 0
    draws = 0
    losses = 0
    goals_scored = 0
    goals_conceded = 0
    
    # Iterate through all matches
    for match in data:
        # Check if the match is from the specified season
        if match.get('season') == season:
            # Check if the team is either home or away
            if match['home_team'] == team_name or match['away_team'] == team_name:
                matches_played += 1
                
                # Calculate goals
                if match['home_team'] == team_name:
                    goals_scored += match['full_time_home_goals']
                    goals_conceded += match['full_time_away_goals']
                    
                    # Calculate points and results
                    if match['full_time_home_goals'] > match['full_time_away_goals']:
                        points += 3
                        wins += 1
                    elif match['full_time_home_goals'] == match['full_time_away_goals']:
                        points += 1
                        draws += 1
                    else:
                        losses += 1
                else:  # team is away
                    goals_scored += match['full_time_away_goals']
                    goals_conceded += match['full_time_home_goals']
                    
                    # Calculate points and results
                    if match['full_time_away_goals'] > match['full_time_home_goals']:
                        points += 3
                        wins += 1
                    elif match['full_time_away_goals'] == match['full_time_home_goals']:
                        points += 1
                        draws += 1
                    else:
                        losses += 1
    
    return {
        'matches_played': matches_played,
        'total_points': points,
        'wins': wins,
        'draws': draws,
        'losses': losses,
        'goals_scored': goals_scored,
        'goals_conceded': goals_conceded,
        'goal_difference': goals_scored - goals_conceded
    }

def main():
    # Load the JSON data (handle multiple files)
    data = load_json_data('league_matches.json')
    
    # Calculate Liverpool's stats for 2021/22 season
    team_name = 'Liverpool FC'
    season = '2003/04'
    
    stats = calculate_team_stats(data, team_name, season)
    
    # Print the results
    print(f"\nLiverpool Statistics for {season} Season:")
    print(f"Matches Played: {stats['matches_played']}")
    print(f"Total Points: {stats['total_points']}")
    print(f"Wins: {stats['wins']}")
    print(f"Draws: {stats['draws']}")
    print(f"Losses: {stats['losses']}")
    print(f"Goals Scored: {stats['goals_scored']}")
    print(f"Goals Conceded: {stats['goals_conceded']}")
    print(f"Goal Difference: {stats['goal_difference']}")

if __name__ == "__main__":
    main()
