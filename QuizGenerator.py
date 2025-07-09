import random
from typing import List, Dict, Any, Optional
from collections import Counter

try:
    from .Data import JSONDataHandler, MatchDataHandler
    from .smart_distractor_generator import SmartDistractorGenerator
    from .adaptive_difficulty import AdaptiveDifficulty
    from .user_performance_tracker import UserPerformanceTracker
    from .question_analytics import QuestionAnalytics # New import
    from .enhanced_difficulty_calculator import EnhancedDifficultyCalculator
    from .question_validator import QuestionValidator
except ImportError:
    from Data import JSONDataHandler, MatchDataHandler
    from smart_distractor_generator import SmartDistractorGenerator
    from adaptive_difficulty import AdaptiveDifficulty
    from user_performance_tracker import UserPerformanceTracker
    from question_analytics import QuestionAnalytics # New import
    from enhanced_difficulty_calculator import EnhancedDifficultyCalculator
    from question_validator import QuestionValidator

try:
    from .question_quality_scorer import QuestionQualityScorer
except ImportError:
    from question_quality_scorer import QuestionQualityScorer

class QuizGenerator:
    """
    Generates quizzes from JSON football data, supporting both award/title data and statistics data.
    """
    NATION_CODES = {
        'ARG': 'Argentina', 'BRA': 'Brazil', 'FRA': 'France', 'ENG': 'England',
        'POR': 'Portugal', 'ESP': 'Spain', 'GER': 'Germany', 'ITA': 'Italy',
        'NED': 'Netherlands', 'BEL': 'Belgium', 'CRO': 'Croatia', 'URU': 'Uruguay',
        'DEN': 'Denmark', 'SWE': 'Sweden', 'NOR': 'Norway', 'POL': 'Poland',
        'CZE': 'Czech Republic', 'WAL': 'Wales', 'SCO': 'Scotland', 'NIR': 'Northern Ireland',
        'AUT': 'Austria', 'SUI': 'Switzerland', 'SRB': 'Serbia', 'HUN': 'Hungary',
        'BUL': 'Bulgaria', 'ROU': 'Romania', 'GRE': 'Greece', 'TUR': 'Turkey',
        'RUS': 'Russia', 'UKR': 'Ukraine', 'MAR': 'Morocco', 'EGY': 'Egypt',
        'NGA': 'Nigeria', 'CMR': 'Cameroon', 'GHA': 'Ghana', 'SEN': 'Senegal',
        'TRI': 'Trinidad and Tobago', 'LBR': 'Liberia', 'URS': 'Soviet Union',
        'TCH': 'Czechoslovakia', 'USA': 'United States', 'CIV': "Côte d'Ivoire",
        'ALG': 'Algeria', 'CHI': 'Chile', 'COL': 'Colombia', 'PAR': 'Paraguay',
        'KOR': 'South Korea', 'JPN': 'Japan', 'AUS': 'Australia', 'CAN': 'Canada',
        'MEX': 'Mexico', 'IRL': 'Republic of Ireland', 'COD': 'DR Congo'
    }

    def __init__(self, data_handler: JSONDataHandler, user_id: str = "default_user", question_analytics: Optional[QuestionAnalytics] = None, match_data_handler: Optional[MatchDataHandler] = None):
        self.data_handler = data_handler
        actual_handler = data_handler.data_handler if hasattr(data_handler, 'data_handler') else data_handler
        self.smart_distractor_generator = SmartDistractorGenerator(actual_handler)
        self.quality_scorer = QuestionQualityScorer()
        
        # Initialize match data handler
        self.match_data_handler = match_data_handler
        
        # Initialize adaptive difficulty components
        self.user_tracker = UserPerformanceTracker.load(user_id, f"{user_id}_performance.json")
        self.adaptive_difficulty = AdaptiveDifficulty(self.user_tracker)
        
        # Initialize question analytics
        self.question_analytics = question_analytics if question_analytics else QuestionAnalytics()
        
        # Initialize enhanced difficulty calculator
        self.enhanced_difficulty = EnhancedDifficultyCalculator(actual_handler)
        
        # Initialize question validator - CRITICAL for quality control
        self.question_validator = QuestionValidator(actual_handler)
    def generate_quiz(self, competition_id: str, num_questions: int = 10) -> List[Dict[str, Any]]:
        """
        Generates a quiz with questions based on the selected competition, adapting to user difficulty.
        """
        print(f"--- Generating adaptive quiz for {competition_id} ---")
        target_difficulty = self.adaptive_difficulty.suggest_next_difficulty()
        print(f"--- Target difficulty: {target_difficulty:.2f} ---")

        competitions = self.data_handler.get_available_competitions()
        selected_competition = next((comp for comp in competitions if comp['competition_id'] == competition_id), None)

        if not selected_competition:
            print(f"--- Could not find competition {competition_id} ---")
            return []

        if selected_competition['data_type'] == 'award':
            all_possible_questions = self._get_all_possible_award_questions(competition_id)
        else:
            all_possible_questions = self._get_all_possible_stats_questions(competition_id)
        
        # Add match-based questions if handler is available
        if self.match_data_handler:
            match_questions = self._get_all_possible_match_questions()
            all_possible_questions.extend(match_questions)
            print(f"--- Added {len(match_questions)} match-based questions ---")
        
        print(f"--- Found {len(all_possible_questions)} possible questions total ---")

        # Score and select questions based on difficulty
        scored_questions = []
        for i, (q_func, data_record) in enumerate(all_possible_questions):
            # Handle different question function signatures
            if q_func.__name__.startswith('_generate_match'):
                # Match questions have different signatures
                if q_func.__name__ == '_generate_comeback_question':
                    question = q_func()
                elif q_func.__name__ == '_generate_head_to_head_question':
                    question = q_func(data_record[0], data_record[1])
                elif q_func.__name__ == '_generate_biggest_win_question':
                    question = q_func(data_record[0], data_record[1])
                else:
                    question = q_func(data_record)
            elif selected_competition['data_type'] == 'award':
                question = q_func(data_record, self.data_handler.get_award_data(competition_id), competition_id)
            else:
                question = q_func(data_record[0], data_record[1], competition_id)
            
            if question is None:
                print(f"  Question {i+1}: _create_question_with_options returned None for question function {q_func.__name__}.")
                continue

            quality_score = self.quality_scorer.score_question(question)
            is_high_quality = self.quality_scorer.is_high_quality(question)
            print(f"  Question {i+1}: Quality Score: {quality_score:.2f}, Is High Quality: {is_high_quality}")
            
            # Be more lenient with quality filtering - accept questions with score > 0.3
            if quality_score < 0.3:
                print(f"    Skipping question with very low quality score: {quality_score:.2f}")
                continue
            
            base_diff = self.adaptive_difficulty.calculate_question_difficulty(question)
            user_diff = self.adaptive_difficulty.adjust_difficulty_for_user(base_diff, question)
            question['difficulty_score'] = user_diff
            question['difficulty_level'] = self.adaptive_difficulty.get_difficulty_level_name(user_diff)
            scored_questions.append(question)
        
        print(f"--- {len(scored_questions)} questions passed initial filtering and scoring ---")
        
        # Sort questions by how close they are to the target difficulty
        scored_questions.sort(key=lambda q: abs(q['difficulty_score'] - target_difficulty))

        # Select unique questions, prioritizing those closest to target difficulty
        final_questions = []
        seen_questions_text = set()
        
        # First, try to fill with questions closest to the target difficulty
        for q in scored_questions:
            if len(final_questions) >= num_questions:
                break
            if q['question'] not in seen_questions_text:
                final_questions.append(q)
                seen_questions_text.add(q['question'])

        # If not enough questions, supplement with any other available high-quality questions
        # (These would be questions that were further from the target difficulty but still passed quality checks)
        if len(final_questions) < num_questions:
            remaining_needed = num_questions - len(final_questions)
            supplemental_questions = [
                q for q in scored_questions 
                if q['question'] not in seen_questions_text
            ]
            # Shuffle supplemental questions to add variety if needed
            random.shuffle(supplemental_questions) 
            
            for q in supplemental_questions:
                if len(final_questions) >= num_questions:
                    break
                final_questions.append(q)
                seen_questions_text.add(q['question'])

        print(f"--- Generated {len(final_questions)} adaptive questions for {competition_id} ---")
        return final_questions

    def _get_all_possible_award_questions(self, competition_id: str) -> list:
        """Returns a list of all possible award question functions and their data."""
        award_data = self.data_handler.get_award_data(competition_id)
        if not award_data:
            return []

        question_funcs = [
            self._generate_award_winner_question,
            self._generate_award_season_question,
            self._generate_award_team_question,
            self._generate_award_nationality_question,
            self._generate_award_position_question,
            self._generate_award_age_question,
            self._generate_award_odd_one_out_club_question,
        ]
        
        possible_questions = []
        for record in award_data:
            for func in question_funcs:
                possible_questions.append((func, record))
        return possible_questions

    def _get_all_possible_stats_questions(self, competition_id: str) -> list:
        """Returns a list of all possible stats question functions and their data."""
        stat_names = self.data_handler.get_all_stat_names(competition_id)
        if not stat_names:
            return []

        question_funcs = [
            self._generate_stat_leader_question,
            self._generate_stat_value_question,
            self._generate_stat_team_question,
            self._generate_stat_comparison_question,
        ]

        possible_questions = []
        for stat_name in stat_names:
            stat_records = self.data_handler.get_stats_data(competition_id, stat_name=stat_name)
            if stat_records:
                for func in question_funcs:
                    # For comparison questions, we need at least two records
                    if func == self._generate_stat_comparison_question and len(stat_records) < 2:
                        continue
                    possible_questions.append((func, (stat_name, stat_records)))
        return possible_questions
    
    def _get_all_possible_match_questions(self) -> list:
        """Returns a list of all possible match question functions and their data."""
        if not self.match_data_handler:
            return []
        
        possible_questions = []
        
        # Get some random matches for score and winner questions
        sample_size = min(100, len(self.match_data_handler.df))
        sample_matches = self.match_data_handler.df.sample(n=sample_size).to_dict('records')
        
        for match in sample_matches:
            if match.get('FTHome') is not None and match.get('FTAway') is not None:
                possible_questions.append((self._generate_match_score_question, match))
                if match.get('FTResult') != 'D':  # Not a draw
                    possible_questions.append((self._generate_match_winner_question, match))
        
        # Add comeback questions
        for _ in range(10):  # Add up to 10 comeback questions
            possible_questions.append((self._generate_comeback_question, None))
        
        # Add biggest win questions for popular teams
        popular_teams = ['Barcelona', 'Real Madrid', 'Bayern Munich', 'Liverpool', 'Man United', 
                        'Chelsea', 'Arsenal', 'Juventus', 'Milan', 'Inter', 'PSG', 'Dortmund']
        seasons = self.match_data_handler.get_all_seasons()[-5:]  # Last 5 seasons
        
        for team in popular_teams:
            if team in self.match_data_handler.get_all_teams():
                for season in seasons:
                    possible_questions.append((self._generate_biggest_win_question, (team, season)))
        
        # Add head-to-head questions for classic rivalries
        rivalries = [
            ('Barcelona', 'Real Madrid'),
            ('Liverpool', 'Man United'),
            ('Arsenal', 'Tottenham'),
            ('Milan', 'Inter'),
            ('Bayern Munich', 'Dortmund'),
            ('Celtic', 'Rangers')
        ]
        
        for team1, team2 in rivalries:
            if team1 in self.match_data_handler.get_all_teams() and team2 in self.match_data_handler.get_all_teams():
                possible_questions.append((self._generate_head_to_head_question, (team1, team2)))
        
        return possible_questions

    def _create_question_with_options(self, question_text: str, answer: str, distractors: List[str], question_type: str, question_data: dict) -> Optional[Dict[str, Any]]:
        """
        Creates a multiple-choice question with difficulty scoring.
        FIXED: Removed generic distractors, enforces quality standards.
        """
        # Filter and clean distractors
        unique_distractors = list(set(d for d in distractors if d and d.strip() and d != answer))

        # CRITICAL FIX: Require minimum 2 quality distractors - no generic fallbacks
        if len(unique_distractors) < 2:
            print(f"    Skipping question - insufficient quality distractors (need ≥2, found {len(unique_distractors)})")
            return None

        # Sample up to 3 distractors if available
        num_distractors_to_sample = min(len(unique_distractors), 3)
        selected_distractors = random.sample(unique_distractors, num_distractors_to_sample)
        
        # REMOVED: Generic distractor fallback - we now reject questions without quality distractors
        # This ensures every question has contextually appropriate options
        
        # CRITICAL: Validate distractor appropriateness before creating question
        validation_result = self.question_validator.validate_distractor_appropriateness(
            question_type=question_type,
            correct_answer=answer, 
            distractors=selected_distractors,
            context=question_data
        )
        
        if not validation_result["is_valid"]:
            print(f"    Skipping question - failed validation: {validation_result['recommendation']}")
            if validation_result["issues"]:
                for issue in validation_result["issues"]:
                    print(f"      - {issue['type']}: {issue['recommendation']}")
            return None

        options = [answer] + selected_distractors
        random.shuffle(options)

        if len(set(options)) != len(options):  # Check for duplicates
            print(f"    Skipping question - duplicate options detected")
            return None

        # Generate a simple question ID and version for tracking
        question_id = f"{question_type}_{hash(question_text) % 1000000}" # Simple hash for ID
        question_version = "1.0" # Default version for now

        # Attach metadata for difficulty calculation
        base_difficulty = self.adaptive_difficulty.calculate_question_difficulty(question_data)
        user_difficulty = self.adaptive_difficulty.adjust_difficulty_for_user(base_difficulty, question_data)

        return {
            'question_id': question_id, # Added for tracking
            'question_version': question_version, # Added for tracking
            'type': question_type,
            'question': question_text,
            'options': options,
            'distractors': selected_distractors,  # Add distractors for quality scoring
            'answer': answer,
            'difficulty_score': user_difficulty,
            'difficulty_level': self.adaptive_difficulty.get_difficulty_level_name(user_difficulty),
            **question_data # Embed original data for analysis
        }

    def track_quiz_question_performance(self, data: Dict[str, Any]) -> bool:
        """
        Tracks the performance of a single quiz question.
        This method should be called after a user answers a question.
        Args:
            data (dict): Dictionary containing performance data for a question.
                         Expected keys: question_id, question_version, user_id, session_id,
                         is_correct, selected_answer, correct_answer, response_time,
                         user_difficulty_level, user_feedback (optional).
        Returns:
            bool: True if data was successfully tracked, False otherwise.
        """
        return self.question_analytics.track_question_performance(data)

    def _generate_award_winner_question(self, record: Dict[str, Any], all_data: List[Dict[str, Any]], competition_id: str) -> Optional[Dict[str, Any]]:
        """Generates a question about who won an award in a specific season."""
        season = record.get('Season')
        player = record.get('Player')
        
        if not season or not player:
            return None

        other_players = list(set([r['Player'] for r in all_data if r.get('Player') and r.get('Player') != player]))
        question_text = f"Who won the {self.data_handler._format_competition_name(competition_id)} in {season}?"
        
        question_data = {
            'category': 'award_winner',
            'player_popularity': record.get('player_popularity', 0.8), # Placeholder
            'year': int(season.split('-')[0]) if '-' in season else int(season),
            'significance': 0.7, # High significance for winning an award
            'ambiguity': 0.1,
            'competition': competition_id
        }

        return self._create_question_with_options(
            question_text=question_text,
            answer=player,
            distractors=other_players,
            question_type='award_winner',
            question_data=question_data
        )

    def _generate_award_season_question(self, record: Dict[str, Any], all_data: List[Dict[str, Any]], competition_id: str) -> Optional[Dict[str, Any]]:
        """
        Generates a question about when a player won an award.
        FIXED: Now handles players with multiple wins to prevent multiple correct answers.
        """
        season = record.get('Season')
        player = record.get('Player')
        
        if not season or not player:
            return None

        # CRITICAL FIX: Check if player has multiple wins to avoid multiple correct answers
        player_seasons = [r['Season'] for r in all_data if r.get('Player') == player and r.get('Season')]
        
        if len(player_seasons) > 1:
            # Player won multiple times - use modified question types to ensure unique answer
            player_seasons_sorted = sorted(player_seasons)
            
            # Randomly choose question variant to add variety
            import random
            question_variant = random.choice(['first', 'latest', 'count'])
            
            if question_variant == 'first':
                correct_answer = player_seasons_sorted[0]
                question_text = f"In which season did {player} FIRST win the {self.data_handler._format_competition_name(competition_id)}?"
                # Distractors: other seasons they won (but not the first) + other players' seasons
                wrong_player_seasons = player_seasons_sorted[1:]
                other_players_seasons = [r['Season'] for r in all_data if r.get('Player') != player and r.get('Season')]
                distractors = wrong_player_seasons + other_players_seasons
                
            elif question_variant == 'latest':
                correct_answer = player_seasons_sorted[-1]
                question_text = f"In which season did {player} MOST RECENTLY win the {self.data_handler._format_competition_name(competition_id)}?"
                # Distractors: other seasons they won (but not the latest) + other players' seasons
                wrong_player_seasons = player_seasons_sorted[:-1]
                other_players_seasons = [r['Season'] for r in all_data if r.get('Player') != player and r.get('Season')]
                distractors = wrong_player_seasons + other_players_seasons
                
            else:  # count variant
                correct_answer = str(len(player_seasons))
                question_text = f"How many times did {player} win the {self.data_handler._format_competition_name(competition_id)}?"
                # Distractors: different counts
                all_player_counts = [len([r for r in all_data if r.get('Player') == p]) for p in set(r.get('Player') for r in all_data if r.get('Player'))]
                potential_counts = [str(c) for c in all_player_counts if c != len(player_seasons)]
                # Add some reasonable alternatives if not enough variety
                if len(potential_counts) < 3:
                    base_count = len(player_seasons)
                    additional_counts = [str(base_count + i) for i in [-2, -1, 1, 2] if base_count + i > 0 and str(base_count + i) not in potential_counts]
                    potential_counts.extend(additional_counts)
                distractors = potential_counts
        else:
            # Single winner - safe to use standard question
            correct_answer = season
            question_text = f"In which season did {player} win the {self.data_handler._format_competition_name(competition_id)}?"
            # Exclude ALL of this player's seasons from distractors (even though there's only one)
            other_seasons = [r['Season'] for r in all_data if r.get('Season') and r.get('Player') != player]
            distractors = list(set(other_seasons))

        # Remove correct answer from distractors and ensure variety
        distractors = [d for d in distractors if d != correct_answer]
        distractors = list(set(distractors))  # Remove duplicates
        
        if len(distractors) < 2:
            # Not enough quality distractors - reject this question
            return None
        
        question_data = {
            'category': 'award_season',
            'player_popularity': record.get('player_popularity', 0.8),
            'year': int(season.split('-')[0]) if '-' in season else int(season),
            'significance': 0.5,
            'ambiguity': 0.1,  # Much lower ambiguity now that we handle multiple winners
            'competition': competition_id,
            'multiple_winner': len(player_seasons) > 1,
            'question_variant': question_variant if len(player_seasons) > 1 else 'standard'
        }

        return self._create_question_with_options(
            question_text=question_text,
            answer=correct_answer,
            distractors=distractors,
            question_type='award_season',
            question_data=question_data
        )

    def _generate_award_team_question(self, record: Dict[str, Any], all_data: List[Dict[str, Any]], competition_id: str) -> Optional[Dict[str, Any]]:
        """Generates a question about which team a player was with when they won an award."""
        squad = record.get('Squad', '')
        player = record.get('Player')
        season = record.get('Season')

        if not squad or not player or not season:
            return None

        main_team = self._get_main_team_from_squad(squad)
        
        if not main_team:
            return None

        all_teams = set()
        for r in all_data:
            if r.get('Squad'):
                for part in r['Squad'].split(','):
                    part = part.strip()
                    if part and not self.data_handler._is_country_name(part) and part != main_team:
                        all_teams.add(part)

        question_text = f"Which team was {player} playing for when they won the {self.data_handler._format_competition_name(competition_id)} in {season}?"
        
        question_data = {
            'category': 'award_team',
            'player_popularity': record.get('player_popularity', 0.8),
            'year': int(season.split('-')[0]) if '-' in season else int(season),
            'significance': 0.6,
            'ambiguity': 0.2,
            'competition': competition_id
        }

        return self._create_question_with_options(
            question_text=question_text,
            answer=main_team,
            distractors=list(all_teams),
            question_type='award_team',
            question_data=question_data
        )

    def _generate_award_nationality_question(self, record: Dict[str, Any], all_data: List[Dict[str, Any]], competition_id: str) -> Optional[Dict[str, Any]]:
        """Generates a question about a player's nationality."""
        nation_code = record.get('Nation')
        player = record.get('Player')
        season = record.get('Season')

        if not nation_code or not player or nation_code not in self.NATION_CODES or not season:
            return None

        correct_nation_full = self.NATION_CODES[nation_code]

        distractors_full = set()
        for r in all_data:
            code = r.get('Nation')
            if code and code != nation_code and code in self.NATION_CODES:
                distractors_full.add(self.NATION_CODES[code])
        
        distractors_full.discard(correct_nation_full)

        question_text = f"What nationality is {player}?"

        question_data = {
            'category': 'nationality',
            'player_popularity': record.get('player_popularity', 0.8),
            'year': int(season.split('-')[0]) if '-' in season else int(season),
            'significance': 0.3,
            'ambiguity': 0.1,
            'competition': competition_id
        }

        return self._create_question_with_options(
            question_text=question_text,
            answer=correct_nation_full,
            distractors=list(distractors_full),
            question_type='award_nationality',
            question_data=question_data
        )

    def _generate_award_position_question(self, record: Dict[str, Any], all_data: List[Dict[str, Any]], competition_id: str) -> Optional[Dict[str, Any]]:
        """Generates a question about a player's position."""
        pos = record.get('Pos')
        player = record.get('Player')
        season = record.get('Season')

        if not pos or not player or not season:
            return None

        pos_full = self._convert_position(pos)
        other_positions = set()
        for r in all_data:
            if r.get('Pos') and r['Pos'] != pos:
                other_positions.add(self._convert_position(r['Pos']))

        question_text = f"What position does {player} play?"

        question_data = {
            'category': 'position',
            'player_popularity': record.get('player_popularity', 0.8),
            'year': int(season.split('-')[0]) if '-' in season else int(season),
            'significance': 0.2,
            'ambiguity': 0.1,
            'competition': competition_id
        }

        return self._create_question_with_options(
            question_text=question_text,
            answer=pos_full,
            distractors=list(other_positions),
            question_type='award_position',
            question_data=question_data
        )

    def _generate_award_age_question(self, record: Dict[str, Any], all_data: List[Dict[str, Any]], competition_id: str) -> Optional[Dict[str, Any]]:
        """Generates a question about a player's age when they won an award."""
        age = record.get('Age')
        player = record.get('Player')
        season = record.get('Season')
        
        if not age or not player or not season:
            return None

        try:
            age_int = int(age)
        except (ValueError, TypeError):
            return None

        distractors = []
        for offset in [-3, -1, 2, 4]:
            distractor_age = age_int + offset
            if distractor_age > 16 and distractor_age < 45:
                distractors.append(str(distractor_age))

        question_text = f"How old was {player} when they won the {self.data_handler._format_competition_name(competition_id)} in {season}?"
        
        question_data = {
            'category': 'age',
            'player_popularity': record.get('player_popularity', 0.8),
            'year': int(season.split('-')[0]) if '-' in season else int(season),
            'significance': 0.4,
            'ambiguity': 0.4, # Can be ambiguous without exact birth date
            'competition': competition_id
        }

        return self._create_question_with_options(
            question_text=question_text,
            answer=str(age),
            distractors=distractors,
            question_type='award_age',
            question_data=question_data
        )

    def _generate_award_odd_one_out_club_question(self, record: Dict[str, Any], all_data: List[Dict[str, Any]], competition_id: str) -> Optional[Dict[str, Any]]:
        """
        Generates an 'Odd One Out' question based on the club a player won an award with.
        """
        winners_with_teams = []
        for r in all_data:
            team = self._get_main_team_from_squad(r.get('Squad', ''))
            if team and r.get('Player'):
                winners_with_teams.append({'player': r['Player'], 'team': team, 'record': r})

        if not winners_with_teams:
            return None

        club_counts = Counter(item['team'] for item in winners_with_teams)
        popular_clubs = [club for club, count in club_counts.items() if count >= 3]
        
        if not popular_clubs:
            return None

        chosen_club = random.choice(popular_clubs)
        club_winners = [item for item in winners_with_teams if item['team'] == chosen_club]
        non_club_winners = [item for item in winners_with_teams if item['team'] != chosen_club]

        if not non_club_winners or len(club_winners) < 3:
            return None
        
        answer_record = random.choice(non_club_winners)
        distractor_records = random.sample(club_winners, 3)
        
        answer_player = answer_record['player']
        distractor_players = [d['player'] for d in distractor_records]

        question_text = f"Which of these players did NOT win the {self.data_handler._format_competition_name(competition_id)} while playing for {chosen_club}?"
        
        question_data = {
            'category': 'odd_one_out_club',
            'player_popularity': answer_record['record'].get('player_popularity', 0.5),
            'year': int(answer_record['record'].get('Season', '2000').split('-')[0]),
            'significance': 0.8,
            'ambiguity': 0.6,
            'statistical_complexity': 0.7, # Requires comparing multiple players
            'competition': competition_id
        }

        return self._create_question_with_options(
            question_text=question_text,
            answer=answer_player,
            distractors=distractor_players,
            question_type='award_odd_one_out',
            question_data=question_data
        )

    def _generate_stat_leader_question(self, stat_name: str, stat_records: List[Dict[str, Any]], competition_id: str) -> Optional[Dict[str, Any]]:
        """Generates a question about the leader of a specific stat."""
        if not stat_records:
            return None

        leader = stat_records[0]
        leader_name = leader.get('player_name')
        
        if not leader_name:
            return None

        distractors = [r.get('player_name') for r in stat_records[1:4] if r.get('player_name')]
        question_text = f"Who led the {self.data_handler._format_competition_name(competition_id)} in {stat_name}?"
        
        question_data = {
            'category': f'stat_leader_{stat_name}',
            'player_popularity': leader.get('player_popularity', 0.7),
            'year': leader.get('year', 2022),
            'significance': 0.8,
            'ambiguity': 0.1,
            'statistical_complexity': 0.4,
            'competition': competition_id
        }

        return self._create_question_with_options(
            question_text=question_text,
            answer=leader_name,
            distractors=distractors,
            question_type='stat_leader',
            question_data=question_data
        )

    def _generate_stat_value_question(self, stat_name: str, stat_records: List[Dict[str, Any]], competition_id: str) -> Optional[Dict[str, Any]]:
        """Generates a question about the stat value for a specific player."""
        if not stat_records:
            return None

        record = random.choice(stat_records)
        player_name = record.get('player_name')
        stat_value = record.get('stat_value', '').strip()
        
        if not player_name or not stat_value:
            return None

        try:
            value_float = float(stat_value)
            distractors = []
            for factor in [0.8, 1.2, 1.5]:
                distractor = round(value_float * factor, 1)
                if distractor != value_float:
                    distractors.append(str(int(distractor) if distractor.is_integer() else distractor))
        except (ValueError, TypeError):
            return None

        question_text = f"What was {player_name}'s {stat_name} in the {self.data_handler._format_competition_name(competition_id)}?"
        
        question_data = {
            'category': f'stat_value_{stat_name}',
            'player_popularity': record.get('player_popularity', 0.6),
            'year': record.get('year', 2022),
            'significance': 0.5,
            'ambiguity': 0.5, # Can be high if stat is not well-known
            'statistical_complexity': 0.6,
            'competition': competition_id
        }

        return self._create_question_with_options(
            question_text=question_text,
            answer=stat_value,
            distractors=distractors,
            question_type='stat_value',
            question_data=question_data
        )

    def _generate_stat_team_question(self, stat_name: str, stat_records: List[Dict[str, Any]], competition_id: str) -> Optional[Dict[str, Any]]:
        """Generates a question about which team a player with a certain stat plays for."""
        if not stat_records:
            return None

        record = random.choice(stat_records)
        player_name = record.get('player_name')
        team_name = record.get('team_name')
        
        if not player_name or not team_name or not team_name.strip():
            return None

        other_teams = set()
        for r in stat_records:
            if r.get('team_name') and r['team_name'].strip() and r['team_name'] != team_name:
                other_teams.add(r['team_name'].strip())

        question_text = f"Which team does {player_name} play for?"
        
        question_data = {
            'category': 'stat_team',
            'player_popularity': record.get('player_popularity', 0.6),
            'year': record.get('year', 2022),
            'significance': 0.4,
            'ambiguity': 0.2,
            'statistical_complexity': 0.2,
            'competition': competition_id
        }

        return self._create_question_with_options(
            question_text=question_text,
            answer=team_name.strip(),
            distractors=list(other_teams),
            question_type='stat_team',
            question_data=question_data
        )

    def _generate_stat_comparison_question(self, stat_name: str, stat_records: List[Dict[str, Any]], competition_id: str) -> Optional[Dict[str, Any]]:
        """Generates a question comparing two players' statistics."""
        if len(stat_records) < 2:
            return None

        attempts = 0
        while attempts < 10:
            attempts += 1
            player1_record, player2_record = random.sample(stat_records, 2)
            
            if (player1_record.get('player_name') != player2_record.get('player_name') and
                player1_record.get('stat_value') != player2_record.get('stat_value')):
                break
        else:
            return None

        try:
            value1 = float(player1_record.get('stat_value', '0').strip())
            value2 = float(player2_record.get('stat_value', '0').strip())
        except (ValueError, TypeError):
            return None
            
        if value1 > value2:
            higher_player_record, lower_player_record = player1_record, player2_record
        else:
            higher_player_record, lower_player_record = player2_record, player1_record

        higher_player = higher_player_record['player_name']
        lower_player = lower_player_record['player_name']

        question_text = f"Who has a higher {stat_name}: {higher_player} or {lower_player}?"
        
        question_data = {
            'category': f'stat_comparison_{stat_name}',
            'player_popularity': (higher_player_record.get('player_popularity', 0.6) + lower_player_record.get('player_popularity', 0.6)) / 2,
            'year': higher_player_record.get('year', 2022),
            'significance': 0.7,
            'ambiguity': 0.3,
            'statistical_complexity': 0.8, # High complexity due to comparison
            'competition': competition_id
        }

        return self._create_question_with_options(
            question_text=question_text,
            answer=higher_player,
            distractors=[lower_player],
            question_type='stat_comparison',
            question_data=question_data
        )
    
    # Match-based question generation methods
    def _generate_match_score_question(self, match: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Generates a question about the final score of a match."""
        if not self.match_data_handler:
            return None
            
        home_team = match.get('HomeTeam')
        away_team = match.get('AwayTeam')
        home_score = match.get('FTHome')
        away_score = match.get('FTAway')
        date = match.get('MatchDate')
        
        if not all([home_team, away_team, home_score is not None, away_score is not None, date]):
            return None
        
        # Format date nicely
        date_str = date.strftime('%B %Y') if hasattr(date, 'strftime') else str(date)
        
        question_text = f"What was the final score when {home_team} hosted {away_team} in {date_str}?"
        correct_answer = f"{int(home_score)}-{int(away_score)}"
        
        # Generate plausible score distractors
        distractors = []
        # Common football scores
        common_scores = ["1-0", "2-1", "0-0", "1-1", "2-0", "3-1", "2-2", "3-0", "0-1", "1-2"]
        # Add variations of the actual score
        if home_score > 0:
            distractors.append(f"{int(home_score-1)}-{int(away_score)}")
        if away_score > 0:
            distractors.append(f"{int(home_score)}-{int(away_score-1)}")
        distractors.append(f"{int(home_score+1)}-{int(away_score)}")
        distractors.append(f"{int(home_score)}-{int(away_score+1)}")
        
        # Add some common scores
        distractors.extend([s for s in common_scores if s != correct_answer])
        
        question_data = {
            'category': 'match_score',
            'year': date.year if hasattr(date, 'year') else 2000,
            'significance': 0.5,
            'ambiguity': 0.1,
            'competition': match.get('Division', 'unknown')
        }
        
        return self._create_question_with_options(
            question_text=question_text,
            answer=correct_answer,
            distractors=list(set(distractors)),
            question_type='match_score',
            question_data=question_data
        )
    
    def _generate_match_winner_question(self, match: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Generates a question about who won a specific match."""
        if not self.match_data_handler:
            return None
            
        home_team = match.get('HomeTeam')
        away_team = match.get('AwayTeam')
        result = match.get('FTResult')
        date = match.get('MatchDate')
        
        if not all([home_team, away_team, result, date]):
            return None
        
        # Determine winner
        if result == 'H':
            winner = home_team
            loser = away_team
        elif result == 'A':
            winner = away_team
            loser = home_team
        else:  # Draw
            return None  # Skip draw matches for winner questions
        
        date_str = date.strftime('%B %Y') if hasattr(date, 'strftime') else str(date)
        
        question_text = f"Who won the match between {home_team} and {away_team} in {date_str}?"
        
        # Get other teams from same division as distractors
        all_teams = self.match_data_handler.get_all_teams()
        distractors = [loser, "Draw"]  # Include the loser and draw as options
        
        # Add some other teams from the dataset
        other_teams = [t for t in all_teams if t not in [home_team, away_team]]
        if other_teams:
            distractors.extend(random.sample(other_teams, min(2, len(other_teams))))
        
        question_data = {
            'category': 'match_winner',
            'year': date.year if hasattr(date, 'year') else 2000,
            'significance': 0.4,
            'ambiguity': 0.1,
            'competition': match.get('Division', 'unknown')
        }
        
        return self._create_question_with_options(
            question_text=question_text,
            answer=winner,
            distractors=list(set(distractors)),
            question_type='match_winner',
            question_data=question_data
        )
    
    def _generate_biggest_win_question(self, team: str, season: str) -> Optional[Dict[str, Any]]:
        """Generates a question about a team's biggest win in a season."""
        if not self.match_data_handler:
            return None
            
        biggest_wins = self.match_data_handler.get_biggest_wins(team=team, season=season, limit=1)
        
        if not biggest_wins:
            return None
        
        biggest_win = biggest_wins[0]
        question_text = f"What was {team}'s biggest win in the {season} season?"
        correct_answer = f"{biggest_win['score']} vs {biggest_win['home_team'] if biggest_win['away_team'] == team else biggest_win['away_team']}"
        
        # Generate plausible distractors
        other_wins = self.match_data_handler.get_biggest_wins(team=team, season=season, limit=5)
        distractors = []
        for win in other_wins[1:]:
            opponent = win['home_team'] if win['away_team'] == team else win['away_team']
            distractors.append(f"{win['score']} vs {opponent}")
        
        # Add some generic big win scores
        if len(distractors) < 3:
            generic_scores = ["3-0 vs Liverpool", "4-1 vs Chelsea", "5-0 vs Arsenal", "3-1 vs Man United"]
            distractors.extend(random.sample(generic_scores, min(3 - len(distractors), len(generic_scores))))
        
        question_data = {
            'category': 'biggest_win',
            'year': int(season.split('-')[0]) if '-' in season else 2000,
            'significance': 0.7,
            'ambiguity': 0.2,
            'team': team
        }
        
        return self._create_question_with_options(
            question_text=question_text,
            answer=correct_answer,
            distractors=list(set(distractors)),
            question_type='biggest_win',
            question_data=question_data
        )
    
    def _generate_comeback_question(self, limit: int = 20) -> Optional[Dict[str, Any]]:
        """Generates a question about comeback victories."""
        if not self.match_data_handler:
            return None
            
        comebacks = self.match_data_handler.get_comeback_wins(limit=limit)
        
        if not comebacks:
            return None
        
        # Pick a random comeback
        comeback = random.choice(comebacks)
        
        question_text = f"Which team came from behind at halftime ({comeback['halftime_score']}) to win {comeback['fulltime_score']} in {comeback['date']}?"
        
        # Determine the winner
        ft_home, ft_away = map(int, comeback['fulltime_score'].split('-'))
        ht_home, ht_away = map(int, comeback['halftime_score'].split('-'))
        
        if ft_home > ft_away and ht_home < ht_away:
            winner = comeback['home_team']
        else:
            winner = comeback['away_team']
        
        # Distractors include the other team and some random teams
        distractors = [comeback['home_team'] if winner == comeback['away_team'] else comeback['away_team']]
        
        all_teams = self.match_data_handler.get_all_teams()
        other_teams = [t for t in all_teams if t not in [comeback['home_team'], comeback['away_team']]]
        if other_teams:
            distractors.extend(random.sample(other_teams, min(2, len(other_teams))))
        
        question_data = {
            'category': 'comeback_win',
            'year': int(comeback['date'][:4]),
            'significance': 0.8,  # Comebacks are memorable
            'ambiguity': 0.1,
            'division': comeback['division']
        }
        
        return self._create_question_with_options(
            question_text=question_text,
            answer=winner,
            distractors=list(set(distractors)),
            question_type='comeback_win',
            question_data=question_data
        )
    
    def _generate_head_to_head_question(self, team1: str, team2: str) -> Optional[Dict[str, Any]]:
        """Generates a question about head-to-head records."""
        if not self.match_data_handler:
            return None
            
        h2h = self.match_data_handler.get_head_to_head_record(team1, team2)
        
        if h2h['total_matches'] < 5:  # Need enough matches for meaningful question
            return None
        
        # Randomly choose what to ask about
        question_types = ['total_matches', 'most_wins', 'total_goals']
        q_type = random.choice(question_types)
        
        if q_type == 'total_matches':
            question_text = f"How many times have {team1} and {team2} faced each other in the dataset?"
            correct_answer = str(h2h['total_matches'])
            # Generate plausible distractors
            distractors = [str(h2h['total_matches'] + i) for i in [-2, -1, 1, 2] if h2h['total_matches'] + i > 0]
            
        elif q_type == 'most_wins':
            if h2h['team1_wins'] > h2h['team2_wins']:
                question_text = f"In the head-to-head record, which team has more wins: {team1} or {team2}?"
                correct_answer = team1
            elif h2h['team2_wins'] > h2h['team1_wins']:
                question_text = f"In the head-to-head record, which team has more wins: {team1} or {team2}?"
                correct_answer = team2
            else:
                return None  # Equal wins, skip
            distractors = [team2 if correct_answer == team1 else team1, "Equal wins"]
            
        else:  # total_goals
            total_goals = h2h['team1_goals'] + h2h['team2_goals']
            question_text = f"How many total goals have been scored in matches between {team1} and {team2}?"
            correct_answer = str(total_goals)
            # Generate plausible distractors
            avg_goals_per_match = total_goals / h2h['total_matches'] if h2h['total_matches'] > 0 else 2.5
            distractors = [
                str(int(total_goals * 0.8)),
                str(int(total_goals * 1.2)),
                str(int(h2h['total_matches'] * 2.5)),  # Average goals
                str(int(h2h['total_matches'] * 3))
            ]
            distractors = [d for d in distractors if d != correct_answer]
        
        question_data = {
            'category': 'head_to_head',
            'significance': 0.6,
            'ambiguity': 0.2,
            'teams': [team1, team2]
        }
        
        return self._create_question_with_options(
            question_text=question_text,
            answer=correct_answer,
            distractors=list(set(distractors)),
            question_type='head_to_head',
            question_data=question_data
        )

    def generate_enhanced_quiz(self, competition_id: str, num_questions: int = 10, use_smart_distractors: bool = True) -> List[Dict[str, Any]]:
        """
        Generates an enhanced quiz, optionally using smart distractors, with adaptive difficulty.
        This method can be the single entry point for all quiz generation.
        """
        print(f"--- Generating ENHANCED quiz for {competition_id} (Smart Distractors: {use_smart_distractors}) ---")
        # This method can be expanded to use smart distractors for all question types.
        # For now, it will call the main adaptive quiz generator.
        # The logic for smart distractors can be integrated into the question generation functions.
        return self.generate_quiz(competition_id, num_questions)

    def _get_main_team_from_squad(self, squad: str) -> Optional[str]:
        """Extracts the primary club from a squad string."""
        if not squad:
            return None
        team_parts = squad.split(',')
        for part in reversed(team_parts):
            part = part.strip()
            if part and not self.data_handler._is_country_name(part):
                return part
        return None

    def _convert_nation_code(self, code: str) -> str:
        """Converts 3-letter country codes to full country names."""
        return self.NATION_CODES.get(code, code)

    def _convert_position(self, pos: str) -> str:
        """Converts position abbreviations to full position names."""
        positions = {
            'GK': 'Goalkeeper',
            'DF': 'Defender', 
            'MF': 'Midfielder',
            'FW': 'Forward',
            'FW,MF': 'Forward/Midfielder',
            'MF,FW': 'Midfielder/Forward',
            'DF,MF': 'Defender/Midfielder'
        }
        return positions.get(pos, pos)
    
    def generate_enhanced_quiz(self, competition_id: str, difficulty_mode: str = "adaptive", 
                              num_questions: int = 10) -> List[Dict[str, Any]]:
        """
        Generate quiz using enhanced content-based difficulty scoring.
        
        Args:
            competition_id: The competition to generate questions from
            difficulty_mode: 'casual', 'diehard', or 'adaptive'
            num_questions: Number of questions to generate
        
        Returns:
            List of questions with enhanced difficulty scoring
        """
        print(f"\n=== Generating Enhanced Quiz ({difficulty_mode} mode) ===")
        
        # Generate all possible questions for the competition
        all_questions = []
        
        # Award-based questions
        award_records = self.data_handler.get_award_data(competition_id)
        if award_records:
            award_question_funcs = [
                self._generate_award_winner_question,
                self._generate_award_season_question,
                self._generate_award_team_question,
                self._generate_award_nationality_question,
                self._generate_award_position_question,
                self._generate_award_age_question
            ]
            
            for func in award_question_funcs:
                for record in award_records:
                    question = func(record, award_records, competition_id)
                    if question:
                        # Add enhanced difficulty scoring
                        question['enhanced_difficulty'] = self.enhanced_difficulty.calculate_content_difficulty(question)
                        question['difficulty_category'] = self.enhanced_difficulty.categorize_difficulty(question['enhanced_difficulty'])
                        question['difficulty_explanation'] = self.enhanced_difficulty.get_difficulty_explanation(question)
                        all_questions.append(question)
        
        # Statistics-based questions
        stat_names = self.data_handler.get_all_stat_names(competition_id)
        for stat_name in stat_names:
            stat_records = self.data_handler.get_stats_data(competition_id, stat_name=stat_name)
            if stat_records:
                stat_question_funcs = [
                    self._generate_stat_leader_question,
                    self._generate_stat_value_question,
                    self._generate_stat_team_question,
                    self._generate_stat_comparison_question
                ]
                
                for func in stat_question_funcs:
                    if func == self._generate_stat_comparison_question and len(stat_records) < 2:
                        continue
                    
                    if func == self._generate_stat_comparison_question:
                        question = func(stat_name, stat_records, competition_id)
                    else:
                        for record in stat_records:
                            question = func(stat_name, record, competition_id)
                            if question:
                                break  # Only take first valid question per stat
                    
                    if question:
                        # Add enhanced difficulty scoring
                        question['enhanced_difficulty'] = self.enhanced_difficulty.calculate_content_difficulty(question)
                        question['difficulty_category'] = self.enhanced_difficulty.categorize_difficulty(question['enhanced_difficulty'])
                        question['difficulty_explanation'] = self.enhanced_difficulty.get_difficulty_explanation(question)
                        all_questions.append(question)
        
        # Match-based questions (if match handler is available)
        if self.match_data_handler:
            match_questions = self._get_all_possible_match_questions()
            for q_func, data_record in match_questions:
                # Handle different question function signatures
                try:
                    if q_func.__name__ == '_generate_comeback_question':
                        question = q_func()
                    elif q_func.__name__ == '_generate_head_to_head_question':
                        question = q_func(data_record[0], data_record[1])
                    elif q_func.__name__ == '_generate_biggest_win_question':
                        question = q_func(data_record[0], data_record[1])
                    else:
                        question = q_func(data_record)
                    
                    if question:
                        # Add enhanced difficulty scoring
                        question['enhanced_difficulty'] = self.enhanced_difficulty.calculate_content_difficulty(question)
                        question['difficulty_category'] = self.enhanced_difficulty.categorize_difficulty(question['enhanced_difficulty'])
                        question['difficulty_explanation'] = self.enhanced_difficulty.get_difficulty_explanation(question)
                        all_questions.append(question)
                except Exception as e:
                    print(f"Error generating match question with {q_func.__name__}: {e}")
                    continue
        
        print(f"Generated {len(all_questions)} questions total")
        
        # Filter questions based on difficulty mode
        if difficulty_mode == "casual":
            # Filter for easier questions (enhanced_difficulty < 0.35)
            filtered_questions = [q for q in all_questions if q.get('enhanced_difficulty', 0.5) < 0.35]
            print(f"Casual mode: {len(filtered_questions)} easy questions available")
        elif difficulty_mode == "diehard":
            # Filter for harder questions (enhanced_difficulty > 0.65)
            filtered_questions = [q for q in all_questions if q.get('enhanced_difficulty', 0.5) > 0.65]
            print(f"Diehard mode: {len(filtered_questions)} hard questions available")
        else:  # adaptive
            # Use existing adaptive difficulty system
            target_difficulty = self.adaptive_difficulty.suggest_next_difficulty()
            # Find questions closest to target difficulty
            scored_questions = []
            for q in all_questions:
                difficulty_distance = abs(q.get('enhanced_difficulty', 0.5) - target_difficulty)
                scored_questions.append((difficulty_distance, q))
            
            scored_questions.sort(key=lambda x: x[0])  # Sort by distance to target
            filtered_questions = [q[1] for q in scored_questions]
            print(f"Adaptive mode: targeting difficulty {target_difficulty:.2f}")
        
        # If not enough questions in the preferred difficulty, add medium difficulty questions
        if len(filtered_questions) < num_questions:
            medium_questions = [q for q in all_questions 
                              if 0.35 <= q.get('enhanced_difficulty', 0.5) <= 0.65 
                              and q not in filtered_questions]
            filtered_questions.extend(medium_questions)
            print(f"Added {len(medium_questions)} medium difficulty questions")
        
        # If still not enough, add any remaining questions
        if len(filtered_questions) < num_questions:
            remaining_questions = [q for q in all_questions if q not in filtered_questions]
            filtered_questions.extend(remaining_questions)
            print(f"Added {len(remaining_questions)} remaining questions")
        
        # Apply quality filtering
        quality_filtered = []
        for question in filtered_questions:
            quality_score = self.quality_scorer.score_question(question)
            if quality_score >= 0.3:  # Quality threshold
                question['quality_score'] = quality_score
                quality_filtered.append(question)
        
        print(f"After quality filtering: {len(quality_filtered)} questions")
        
        # Remove duplicates and select final questions
        unique_questions = []
        seen_questions = set()
        
        for question in quality_filtered:
            question_key = (question.get('question', ''), question.get('answer', ''))
            if question_key not in seen_questions:
                seen_questions.add(question_key)
                unique_questions.append(question)
        
        # Shuffle and select the requested number
        random.shuffle(unique_questions)
        final_questions = unique_questions[:num_questions]
        
        print(f"Final selection: {len(final_questions)} questions")
        
        # Add debug information for each selected question
        for i, q in enumerate(final_questions, 1):
            difficulty = q.get('enhanced_difficulty', 0.5)
            category = q.get('difficulty_category', 'unknown')
            print(f"  Q{i}: {category} ({difficulty:.2f}) - {q.get('question', '')[:50]}...")
        
        return final_questions

if __name__ == "__main__":
    print("--- Initializing JSON Data Handler ---")
    data_handler = None
    try:
        data_handler = JSONDataHandler()
        print(f"Successfully loaded JSON data!")
    except Exception as e:
        print(f"Error loading JSON data: {e}")

    if data_handler:
        print("\n--- Initializing Quiz Generator for user 'test_user' ---")
        quiz_generator = QuizGenerator(data_handler, user_id="test_user")
        
        # Simulate some user activity
        print("\n--- Simulating user activity ---")
        quiz_generator.adaptive_difficulty.track_user_performance("q1", "award_winner", 0.2, True)
        quiz_generator.adaptive_difficulty.track_user_performance("q2", "award_winner", 0.3, True)
        quiz_generator.adaptive_difficulty.track_user_performance("q3", "award_season", 0.6, False)
        quiz_generator.adaptive_difficulty.track_user_performance("q4", "nationality", 0.1, True)
        
        competitions = data_handler.get_available_competitions()
        if not competitions:
            print("No competitions found. Exiting.")
        else:
            print("\n--- Available Competitions ---")
            for i, comp in enumerate(competitions, 1):
                print(f"  {i}. {comp['competition_name']} ({comp['data_type']}, {comp['total_records']} records)")
            
            selected_competition = next((c for c in competitions if c['competition_id'] == 'Ballon_d_Or'), None)
            if selected_competition:
                print(f"\n--- Generating Adaptive Quiz for {selected_competition['competition_name']} ---")
                quiz = quiz_generator.generate_quiz(selected_competition['competition_id'], num_questions=5)
                
                if not quiz:
                    print("Could not generate the quiz. Check data availability.")
                else:
                    print(f"\nSuccessfully generated a quiz with {len(quiz)} questions!\n")
                    for i, q in enumerate(quiz, 1):
                        print(f"Q{i} (Type: {q['type']}, Difficulty: {q['difficulty_level']} ({q['difficulty_score']:.2f}))")
                        print(f"  Question: {q['question']}")
                        print(f"  Options: {q.get('options', 'N/A')}")
                        print(f"  Answer: {q['answer']}")
                        print("-" * 20)
            else:
                print('Could not find the specified competition.')
