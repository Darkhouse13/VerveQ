"""
Leaderboard Service for VerveQ Platform
Handles leaderboard queries and rankings
"""
from typing import List, Dict, Optional
from sqlalchemy.orm import Session
from sqlalchemy import desc

from database.connection import SessionLocal
from database.models import User, UserRating

class LeaderboardService:
    """Service for managing leaderboards"""
    
    @staticmethod
    def get_leaderboard(
        sport: Optional[str] = None, 
        mode: Optional[str] = None, 
        period: str = "all_time",
        limit: int = 10
    ) -> List[Dict]:
        """
        Get leaderboard entries
        
        Args:
            sport: Sport filter (None for global)
            mode: Game mode filter (None for all modes)
            period: Time period (only all_time supported for now)
            limit: Number of entries to return
            
        Returns:
            List of leaderboard entries
        """
        db = SessionLocal()
        
        try:
            # Base query joining users and ratings
            query = db.query(
                User.id.label('user_id'),
                User.username,
                User.display_name,
                UserRating.elo_rating,
                UserRating.sport,
                UserRating.mode,
                UserRating.games_played,
                UserRating.wins,
                UserRating.losses,
                UserRating.best_score,
                UserRating.average_score
            ).join(UserRating, User.id == UserRating.user_id)
            
            # Apply filters
            if sport:
                query = query.filter(UserRating.sport == sport)
            if mode:
                query = query.filter(UserRating.mode == mode)
            
            # Only include players who have played games
            query = query.filter(UserRating.games_played > 0)
            
            # Order by ELO rating descending
            query = query.order_by(desc(UserRating.elo_rating))
            
            # Apply limit
            query = query.limit(limit)
            
            # Execute query
            results = query.all()
            
            # Format results
            leaderboard = []
            for rank, result in enumerate(results, 1):
                entry = {
                    "rank": rank,
                    "user_id": result.user_id,
                    "username": result.username,
                    "display_name": result.display_name or result.username,
                    "elo_rating": int(result.elo_rating),
                    "score": int(result.elo_rating),  # For compatibility
                    "games_played": result.games_played,
                    "wins": result.wins,
                    "losses": result.losses,
                    "win_rate": round(result.wins / result.games_played * 100, 1) if result.games_played > 0 else 0,
                    "best_score": result.best_score,
                    "average_score": round(result.average_score, 1),
                    "sport": result.sport,
                    "mode": result.mode
                }
                leaderboard.append(entry)
            
            return leaderboard
            
        except Exception as e:
            print(f"Error getting leaderboard: {e}")
            return []
        finally:
            db.close()
    
    @staticmethod
    def get_user_rank(user_id: str, sport: Optional[str] = None, mode: Optional[str] = None) -> Optional[int]:
        """
        Get user's rank in leaderboard
        
        Args:
            user_id: User ID to get rank for
            sport: Sport filter
            mode: Mode filter
            
        Returns:
            User's rank (1-based) or None if not found
        """
        db = SessionLocal()
        
        try:
            # Get user's rating
            user_rating_query = db.query(UserRating).filter(UserRating.user_id == user_id)
            if sport:
                user_rating_query = user_rating_query.filter(UserRating.sport == sport)
            if mode:
                user_rating_query = user_rating_query.filter(UserRating.mode == mode)
            
            user_rating = user_rating_query.first()
            if not user_rating:
                return None
            
            # Count users with higher ratings
            count_query = db.query(UserRating).filter(
                UserRating.elo_rating > user_rating.elo_rating,
                UserRating.games_played > 0
            )
            if sport:
                count_query = count_query.filter(UserRating.sport == sport)
            if mode:
                count_query = count_query.filter(UserRating.mode == mode)
            
            higher_ratings_count = count_query.count()
            
            # Rank is count of higher ratings + 1
            return higher_ratings_count + 1
            
        except Exception as e:
            print(f"Error getting user rank: {e}")
            return None
        finally:
            db.close()
    
    @staticmethod
    def get_leaderboard_stats(sport: Optional[str] = None, mode: Optional[str] = None) -> Dict:
        """
        Get leaderboard statistics
        
        Args:
            sport: Sport filter
            mode: Mode filter
            
        Returns:
            Dictionary with leaderboard stats
        """
        db = SessionLocal()
        
        try:
            query = db.query(UserRating).filter(UserRating.games_played > 0)
            
            if sport:
                query = query.filter(UserRating.sport == sport)
            if mode:
                query = query.filter(UserRating.mode == mode)
            
            total_players = query.count()
            
            if total_players == 0:
                return {
                    "total_players": 0,
                    "average_elo": 0,
                    "highest_elo": 0,
                    "total_games": 0
                }
            
            # Get statistics
            ratings = [r.elo_rating for r in query.all()]
            total_games = sum(r.games_played for r in query.all())
            
            return {
                "total_players": total_players,
                "average_elo": round(sum(ratings) / len(ratings), 1),
                "highest_elo": round(max(ratings), 1),
                "total_games": total_games
            }
            
        except Exception as e:
            print(f"Error getting leaderboard stats: {e}")
            return {"error": str(e)}
        finally:
            db.close()