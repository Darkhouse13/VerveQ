"""
ELO Rating Service for VerveQ Platform
Simple ELO calculations for quiz and survival games
"""

class EloService:
    """Service for calculating ELO rating changes"""
    
    # Standard ELO K-factor
    K_FACTOR = 32
    
    # Default opponent ratings by difficulty
    DIFFICULTY_RATINGS = {
        'easy': 1000,
        'intermediate': 1200,
        'hard': 1400
    }
    
    @staticmethod
    def calculate_elo_change(player_rating: float, performance_score: float, difficulty: str = 'intermediate') -> float:
        """
        Calculate ELO rating change for a game
        
        Args:
            player_rating: Current ELO rating of player
            performance_score: Performance score (0.0 to 1.0)
            difficulty: Game difficulty level
            
        Returns:
            ELO change (can be positive or negative)
        """
        # Get opponent rating based on difficulty
        opponent_rating = EloService.DIFFICULTY_RATINGS.get(difficulty, 1200)
        
        # Calculate expected score using ELO formula
        expected_score = 1 / (1 + 10 ** ((opponent_rating - player_rating) / 400))
        
        # Calculate ELO change
        elo_change = EloService.K_FACTOR * (performance_score - expected_score)
        
        return round(elo_change, 1)
    
    @staticmethod
    def get_quiz_performance_score(correct_answers: int, total_questions: int, average_time: float = None) -> float:
        """
        Calculate performance score for quiz game
        
        Args:
            correct_answers: Number of correct answers
            total_questions: Total number of questions
            average_time: Average time per question (optional)
            
        Returns:
            Performance score between 0.0 and 1.0
        """
        if total_questions == 0:
            return 0.0
        
        # Base score from accuracy
        accuracy = correct_answers / total_questions
        performance_score = accuracy
        
        # Time bonus for fast answers (optional)
        if average_time is not None and average_time < 5.0:
            time_bonus = min(0.1, (5.0 - average_time) / 50.0)  # Max 0.1 bonus
            performance_score = min(1.0, performance_score + time_bonus)
        
        return round(performance_score, 3)
    
    @staticmethod
    def get_survival_performance_score(survival_score: int) -> float:
        """
        Calculate performance score for survival game
        
        Args:
            survival_score: Number of rounds survived
            
        Returns:
            Performance score between 0.0 and 1.0
        """
        # Scale: 15+ rounds = perfect score
        perfect_score = 15
        performance_score = min(survival_score / perfect_score, 1.0)
        
        return round(performance_score, 3)
    
    @staticmethod
    def calculate_new_rating(current_rating: float, elo_change: float) -> float:
        """
        Calculate new ELO rating after a game
        
        Args:
            current_rating: Current ELO rating
            elo_change: ELO change from the game
            
        Returns:
            New ELO rating (minimum 800, maximum 2400)
        """
        new_rating = current_rating + elo_change
        
        # Apply bounds
        new_rating = max(800, min(2400, new_rating))
        
        return round(new_rating, 1)