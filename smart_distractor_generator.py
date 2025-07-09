import random
import logging
from typing import List, Dict, Any, Optional
from Data import JSONDataHandler
from player_embeddings import PlayerEmbeddingSystem # Import the new embedding system

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class SmartDistractorGenerator:
    """
    Generates intelligent distractors for quiz questions based on contextual similarity.
    """
    def __init__(self, data_handler: JSONDataHandler):
        """
        Initializes the SmartDistractorGenerator with a data handler.

        Args:
            data_handler: An instance of JSONDataHandler to access quiz data.
        """
        self.data_handler = data_handler
        # Note: get_all_players and get_all_teams from the original file require a competition_id
        # I will get all players and teams across all competitions instead.
        self.all_players = self.data_handler.get_all_players_across_competitions()
        self.all_teams = self._get_all_teams_across_competitions()
        self.embedding_system = PlayerEmbeddingSystem(data_handler=self.data_handler)
        self.embedding_system.load_all_embeddings() # Load existing embeddings from cache

    def generate_similar_players(self, correct_player_name: str, num_distractors: int = 3, strategy: str = 'rule_based') -> List[str]:
        """
        Generates a list of player names that are similar to the correct player using embeddings.

        Args:
            correct_player_name: The name of the correct player.
            num_distractors: The number of distractors to generate.
            strategy: The embedding strategy to use ('rule_based' or 'ml_based').

        Returns:
            A list of player names to be used as distractors.
        """
        similar_players_info = self.embedding_system.find_similar_players(correct_player_name, top_n=num_distractors * 5, strategy=strategy)
        
        distractors = []
        for player_info in similar_players_info:
            if player_info['player_name'] != correct_player_name:
                distractors.append(player_info['player_name'])
            if len(distractors) >= num_distractors:
                break
        
        if len(distractors) < num_distractors:
            # ENHANCED: Context-aware fallback for players
            logger.warning(f"Not enough similar players found for {correct_player_name} using {strategy} strategy. Using context-aware fallback.")
            
            # Try to get contextually similar players
            contextual_players = self._get_contextual_players(correct_player_name)
            
            # Filter out players already in distractors and the correct player
            available_contextual = [p for p in contextual_players if p != correct_player_name and p not in distractors]
            
            if available_contextual:
                # Use contextual players first
                needed = num_distractors - len(distractors)
                distractors.extend(available_contextual[:needed])
            else:
                # Last resort: random players, but log this as a quality issue
                logger.error(f"No contextual players found for {correct_player_name}. Question quality may be poor.")
                all_other_players = [p['Player'] for p in self.all_players if p['Player'] != correct_player_name and p['Player'] not in distractors]
                random.shuffle(all_other_players)
                distractors.extend(all_other_players[:num_distractors - len(distractors)])

        return distractors

    def _get_contextual_players(self, player_name: str) -> List[str]:
        """
        Get players from similar context (position, era, nationality) as the given player.
        Uses heuristics to identify contextual similarity for better distractors.
        """
        contextual_players = []
        
        # Define position/role groups for contextual similarity
        position_groups = {
            'goalkeepers': [
                'Manuel Neuer', 'Jan Oblak', 'Alisson', 'Ederson', 'Thibaut Courtois',
                'Marc-André ter Stegen', 'Gianluigi Donnarumma', 'Keylor Navas'
            ],
            'defenders': [
                'Virgil van Dijk', 'Sergio Ramos', 'Raphael Varane', 'Kalidou Koulibaly',
                'Andrew Robertson', 'Trent Alexander-Arnold', 'Dani Alves', 'Marcelo'
            ],
            'midfielders': [
                'Luka Modric', 'Toni Kroos', 'Kevin De Bruyne', 'N\'Golo Kante',
                'Paul Pogba', 'Joshua Kimmich', 'Sergio Busquets', 'Casemiro'
            ],
            'forwards': [
                'Lionel Messi', 'Cristiano Ronaldo', 'Neymar', 'Kylian Mbappé',
                'Robert Lewandowski', 'Karim Benzema', 'Mohamed Salah', 'Sadio Mané'
            ]
        }
        
        # Find which position group the player belongs to
        for position, players in position_groups.items():
            if player_name in players:
                # Return other players from the same position
                contextual_players.extend([p for p in players if p != player_name])
                break
        
        # If not found in position groups, try nationality/era heuristics
        if not contextual_players:
            # Get all player names for analysis
            all_player_names = [p['Player'] for p in self.all_players]
            
            # Look for players with similar name patterns (indicating similar nationality/era)
            player_lower = player_name.lower()
            
            for other_player in all_player_names:
                if other_player == player_name:
                    continue
                    
                other_lower = other_player.lower()
                
                # Similar naming patterns that might indicate same nationality/region
                if any(pattern in player_lower and pattern in other_lower for pattern in 
                      ['luis', 'carlos', 'jose', 'juan', 'sergio', 'diego', 'marco', 'andrea']):
                    contextual_players.append(other_player)
                
                # Same first name heuristic (often indicates same era/region)
                elif player_lower.split()[0] == other_lower.split()[0] and len(contextual_players) < 20:
                    contextual_players.append(other_player)
        
        return contextual_players[:15]  # Limit to prevent too many options

    def generate_plausible_years(self, correct_year: int, career_span: Optional[tuple], num_distractors: int = 3) -> List[int]:
        """
        Generates a list of plausible years as distractors.
        Years are selected based on the player's career span.

        Args:
            correct_year: The correct year for the answer.
            career_span: A tuple (start_year, end_year) for the player's career, or None.
            num_distractors: The number of distractors to generate.

        Returns:
            A list of years to be used as distractors.
        """
        if not career_span or career_span[0] is None or career_span[1] is None:
            # Fallback for undefined career span: generate years around correct year
            return [correct_year + i for i in random.sample([x for x in range(-5, 6) if x != 0], num_distractors)]

        start_year, end_year = career_span
        
        # Define a plausible range around the correct year
        plausible_range_start = max(start_year, correct_year - 5)
        plausible_range_end = min(end_year, correct_year + 5)

        potential_distractors = [y for y in range(plausible_range_start, plausible_range_end + 1) if y != correct_year]

        if len(potential_distractors) < num_distractors:
            # If not enough distractors in the plausible range, expand to the full career span
            potential_distractors = [y for y in range(start_year, end_year + 1) if y != correct_year]

        # Ensure we have enough potential distractors to choose from
        if len(potential_distractors) < num_distractors:
             # Fallback if career span is too short
            return random.sample([y for y in range(correct_year - 10, correct_year + 11) if y != correct_year], num_distractors)

        return random.sample(potential_distractors, num_distractors)

    def generate_similar_teams(self, correct_team_name: str, num_distractors: int = 3, strategy: str = 'rule_based') -> List[str]:
        """
        Generates a list of team names that are similar to the correct team using embeddings.

        Args:
            correct_team_name: The name of the correct team.
            num_distractors: The number of distractors to generate.
            strategy: The embedding strategy to use ('rule_based' or 'ml_based').

        Returns:
            A list of team names to be used as distractors.
        """
        similar_teams_info = self.embedding_system.find_similar_teams(correct_team_name, top_n=num_distractors * 5, strategy=strategy)

        distractors = []
        for team_info in similar_teams_info:
            if team_info['team_name'] != correct_team_name:
                distractors.append(team_info['team_name'])
            if len(distractors) >= num_distractors:
                break
        
        if len(distractors) < num_distractors:
            # ENHANCED: Context-aware fallback instead of random teams
            logger.warning(f"Not enough similar teams found for {correct_team_name} using {strategy} strategy. Using context-aware fallback.")
            
            # Try to identify the league/context of the correct team
            contextual_teams = self._get_contextual_teams(correct_team_name)
            
            # Filter out teams already in distractors and the correct team
            available_contextual = [t for t in contextual_teams if t != correct_team_name and t not in distractors]
            
            if available_contextual:
                # Use contextual teams first
                needed = num_distractors - len(distractors)
                distractors.extend(available_contextual[:needed])
            else:
                # Last resort: random teams, but log this as a quality issue
                logger.error(f"No contextual teams found for {correct_team_name}. Question quality may be poor.")
                all_other_teams = [t for t in self.all_teams if t != correct_team_name and t not in distractors]
                random.shuffle(all_other_teams)
                distractors.extend(all_other_teams[:num_distractors - len(distractors)])

        return distractors
    
    def _get_contextual_teams(self, team_name: str) -> List[str]:
        """
        Get teams from the same league/context as the given team.
        Uses heuristics to identify league context for better distractors.
        """
        # Define league groups for contextual similarity
        league_groups = {
            'premier_league': [
                'Manchester United', 'Manchester City', 'Liverpool', 'Chelsea', 'Arsenal', 
                'Tottenham', 'Leicester City', 'West Ham', 'Everton', 'Newcastle',
                'Aston Villa', 'Brighton', 'Crystal Palace', 'Southampton', 'Leeds United'
            ],
            'la_liga': [
                'Real Madrid', 'Barcelona', 'Atletico Madrid', 'Sevilla', 'Valencia',
                'Real Betis', 'Real Sociedad', 'Villarreal', 'Athletic Bilbao', 'Espanyol'
            ],
            'serie_a': [
                'Juventus', 'AC Milan', 'Inter Milan', 'Roma', 'Napoli', 'Lazio',
                'Atalanta', 'Fiorentina', 'Torino', 'Sampdoria'
            ],
            'bundesliga': [
                'Bayern Munich', 'Borussia Dortmund', 'RB Leipzig', 'Bayer Leverkusen',
                'Borussia Monchengladbach', 'Wolfsburg', 'Eintracht Frankfurt', 'Stuttgart'
            ],
            'ligue_1': [
                'Paris Saint-Germain', 'Marseille', 'Lyon', 'Monaco', 'Nice', 'Lille',
                'Rennes', 'Montpellier', 'Bordeaux', 'Saint-Etienne'
            ]
        }
        
        # Find which league the team belongs to
        for league, teams in league_groups.items():
            if team_name in teams:
                # Return other teams from the same league
                return [t for t in teams if t != team_name]
        
        # If not found in major leagues, try to infer from team name patterns
        contextual_teams = []
        
        # Look for teams with similar geographical or naming patterns
        team_lower = team_name.lower()
        
        for other_team in self.all_teams:
            if other_team == team_name:
                continue
                
            other_lower = other_team.lower()
            
            # Same city/region heuristics
            if any(city in team_lower and city in other_lower for city in 
                  ['manchester', 'madrid', 'milan', 'london', 'liverpool', 'barcelona']):
                contextual_teams.append(other_team)
            
            # Similar naming patterns (Real, FC, etc.)
            elif any(prefix in team_lower and prefix in other_lower for prefix in 
                    ['real', 'fc', 'athletic', 'sporting']):
                contextual_teams.append(other_team)
        
        return contextual_teams[:10]  # Limit to prevent too many options
    
    def _get_all_teams_across_competitions(self) -> List[str]:
        """
        Gets a comprehensive list of all unique team names from all loaded data files.
        """
        # Call the get_all_teams method from data_handler that returns all teams
        all_teams_dicts = self.data_handler.get_all_teams()
        # Extract team names from the list of dictionaries
        teams = [team_dict['team_name'] for team_dict in all_teams_dicts]
        return sorted(list(filter(None, teams)))

    def generate_contextual_stats(self, correct_stat: int, stat_type: str, num_distractors: int = 3) -> List[int]:
        """
        Generates a list of plausible statistical values as distractors.
        Distractors are generated to be numerically close to the correct stat.

        Args:
            correct_stat: The correct statistical value.
            stat_type: The type of statistic (e.g., 'goals', 'appearances').
            num_distractors: The number of distractors to generate.

        Returns:
            A list of statistical values to be used as distractors.
        """
        if correct_stat is None:
            return []

        distractors = set()
        
        # Define variance based on stat type
        if stat_type in ['goals', 'assists']:
            variance = 0.2  # +/- 20%
        elif stat_type in ['appearances', 'age']:
            variance = 0.1 # +/- 10%
        else:
            variance = 0.15

        # Generate distractors
        while len(distractors) < num_distractors:
            if correct_stat == 0:
                # Handle case where correct stat is 0
                offset = random.randint(1, 5)
            else:
                offset = int(correct_stat * variance * random.uniform(0.5, 1.5))
                if offset == 0:
                    offset = 1
            
            # Alternate between adding and subtracting
            if len(distractors) % 2 == 0:
                distractor = correct_stat + offset
            else:
                distractor = correct_stat - offset

            # Ensure non-negative and not the same as correct_stat
            if distractor >= 0 and distractor != correct_stat:
                distractors.add(distractor)
        
        return list(distractors)
