import math
from typing import Tuple, Optional
from sqlalchemy.orm import Session
from database.models import User, UserRating, GameSession
from datetime import datetime

class ELOSystem:
    """
    ELO rating system for competitive ranking across sports and modes
    """
    
    def __init__(self, k_factor: int = 32, initial_rating: float = 1200.0):
        self.k_factor = k_factor
        self.initial_rating = initial_rating
    
    def calculate_expected_score(self, rating_a: float, rating_b: float) -> float:
        """Calculate expected score for player A against player B"""
        return 1 / (1 + math.pow(10, (rating_b - rating_a) / 400))
    
    def calculate_new_rating(self, current_rating: float, expected_score: float, actual_score: float) -> float:
        """Calculate new ELO rating based on performance"""
        return current_rating + self.k_factor * (actual_score - expected_score)
    
    def get_performance_score(self, user_score: int, mode: str, sport: str, total_questions: Optional[int] = None) -> float:
        """
        Convert game performance to ELO score (0.0 to 1.0)
        """
        if mode == "quiz":
            # Quiz performance based on accuracy
            if total_questions and total_questions > 0:
                accuracy = user_score / total_questions
                # Scale accuracy: 50% = 0.0, 100% = 1.0
                return max(0.0, min(1.0, (accuracy - 0.5) * 2))
            return 0.5  # Default neutral performance
        
        elif mode == "survival":
            # Survival performance based on score thresholds
            # Adjust thresholds per sport
            if sport == "football":
                # Football survival: 0-5 low, 6-10 medium, 11+ high
                if user_score <= 5:
                    return max(0.0, user_score / 10)  # 0.0 to 0.5
                elif user_score <= 10:
                    return 0.5 + (user_score - 5) / 10  # 0.5 to 1.0
                else:
                    return min(1.0, 0.8 + (user_score - 10) / 20)  # Diminishing returns
            
            elif sport == "tennis":
                # Tennis survival: similar scaling
                if user_score <= 4:
                    return max(0.0, user_score / 8)
                elif user_score <= 8:
                    return 0.5 + (user_score - 4) / 8
                else:
                    return min(1.0, 0.8 + (user_score - 8) / 16)
        
        return 0.5  # Default neutral performance
    
    def get_or_create_rating(self, db: Session, user_id: str, sport: str, mode: str) -> UserRating:
        """Get existing rating or create new one with initial rating"""
        rating = db.query(UserRating).filter(
            UserRating.user_id == user_id,
            UserRating.sport == sport,
            UserRating.mode == mode
        ).first()
        
        if not rating:
            rating = UserRating(
                user_id=user_id,
                sport=sport,
                mode=mode,
                elo_rating=self.initial_rating,
                games_played=0,
                wins=0,
                losses=0,
                best_score=0,
                average_score=0.0
            )
            db.add(rating)
            db.flush()  # Get the ID
        
        return rating
    
    def calculate_baseline_rating(self, db: Session, sport: str, mode: str) -> float:
        """Calculate baseline rating for comparison (median of all players)"""
        ratings = db.query(UserRating.elo_rating).filter(
            UserRating.sport == sport,
            UserRating.mode == mode,
            UserRating.games_played >= 5  # Only include active players
        ).all()
        
        if not ratings:
            return self.initial_rating
        
        rating_values = [r[0] for r in ratings]
        rating_values.sort()
        
        # Return median rating
        n = len(rating_values)
        if n % 2 == 0:
            return (rating_values[n//2-1] + rating_values[n//2]) / 2
        else:
            return rating_values[n//2]
    
    def update_rating(self, db: Session, user_id: str, sport: str, mode: str, 
                     user_score: int, total_questions: Optional[int] = None,
                     duration_seconds: Optional[int] = None) -> Tuple[float, float, float]:
        """
        Update user's ELO rating based on game performance
        Returns: (old_rating, new_rating, rating_change)
        """
        # Get or create user rating
        user_rating = self.get_or_create_rating(db, user_id, sport, mode)
        old_rating = user_rating.elo_rating
        
        # Calculate performance score
        performance = self.get_performance_score(user_score, mode, sport, total_questions)
        
        # Get baseline rating for comparison
        baseline_rating = self.calculate_baseline_rating(db, sport, mode)
        
        # Calculate expected score against baseline
        expected_score = self.calculate_expected_score(old_rating, baseline_rating)
        
        # Calculate new rating
        new_rating = self.calculate_new_rating(old_rating, expected_score, performance)
        rating_change = new_rating - old_rating
        
        # Update rating record
        user_rating.elo_rating = new_rating
        user_rating.games_played += 1
        user_rating.last_played = datetime.utcnow()
        
        # Update statistics
        if performance > 0.5:  # Consider > 50% performance a "win"
            user_rating.wins += 1
        else:
            user_rating.losses += 1
        
        if user_score > user_rating.best_score:
            user_rating.best_score = user_score
        
        # Update average score
        total_score = user_rating.average_score * (user_rating.games_played - 1) + user_score
        user_rating.average_score = total_score / user_rating.games_played
        
        # Create game session record
        game_session = GameSession(
            user_id=user_id,
            sport=sport,
            mode=mode,
            score=user_score,
            total_questions=total_questions,
            accuracy=(user_score / total_questions * 100) if total_questions else None,
            duration_seconds=duration_seconds,
            elo_before=old_rating,
            elo_after=new_rating,
            elo_change=rating_change
        )
        db.add(game_session)
        
        # Update user total games
        user = db.query(User).filter(User.id == user_id).first()
        if user:
            user.total_games += 1
            user.last_active = datetime.utcnow()
        
        db.commit()
        
        return old_rating, new_rating, rating_change
    
    def get_user_rank(self, db: Session, user_id: str, sport: str, mode: str) -> Optional[int]:
        """Get user's rank in the specified sport/mode"""
        user_rating = db.query(UserRating).filter(
            UserRating.user_id == user_id,
            UserRating.sport == sport,
            UserRating.mode == mode
        ).first()
        
        if not user_rating:
            return None
        
        # Count users with higher ratings
        higher_rated = db.query(UserRating).filter(
            UserRating.sport == sport,
            UserRating.mode == mode,
            UserRating.elo_rating > user_rating.elo_rating,
            UserRating.games_played >= 5  # Only count active players
        ).count()
        
        return higher_rated + 1
    
    def get_rating_tier(self, rating: float) -> dict:
        """Get rating tier information"""
        if rating >= 2000:
            return {"tier": "Grandmaster", "color": "#ff6b6b", "icon": "👑"}
        elif rating >= 1800:
            return {"tier": "Master", "color": "#4ecdc4", "icon": "🏆"}
        elif rating >= 1600:
            return {"tier": "Expert", "color": "#45b7d1", "icon": "⭐"}
        elif rating >= 1400:
            return {"tier": "Advanced", "color": "#96ceb4", "icon": "🎯"}
        elif rating >= 1200:
            return {"tier": "Intermediate", "color": "#ffeaa7", "icon": "📈"}
        elif rating >= 1000:
            return {"tier": "Beginner", "color": "#ddd6fe", "icon": "🌱"}
        else:
            return {"tier": "Novice", "color": "#fee2e2", "icon": "🎲"}