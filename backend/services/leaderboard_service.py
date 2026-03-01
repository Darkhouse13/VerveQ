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
        limit: int = 10,
        db: Optional[Session] = None
    ) -> List[Dict]:
        """Return leaderboard entries with optional filtering."""
        session = db or SessionLocal()
        created_session = db is None

        try:
            query = (
                session.query(
                    User.id.label("user_id"),
                    User.username,
                    User.display_name,
                    UserRating.elo_rating,
                    UserRating.sport,
                    UserRating.mode,
                    UserRating.games_played,
                    UserRating.wins,
                    UserRating.losses,
                    UserRating.best_score,
                    UserRating.average_score,
                )
                .join(UserRating, User.id == UserRating.user_id)
            )

            if sport:
                query = query.filter(UserRating.sport == sport)
            if mode:
                query = query.filter(UserRating.mode == mode)

            query = query.filter(UserRating.games_played > 0)
            query = query.order_by(desc(UserRating.elo_rating))

            effective_limit = limit if isinstance(limit, int) and limit > 0 else 10
            query = query.limit(effective_limit)

            results = query.all()

            leaderboard: List[Dict] = []
            for rank, result in enumerate(results, 1):
                games_played = result.games_played or 0
                wins = result.wins or 0
                win_rate = round(wins / games_played, 2) if games_played else 0.0
                elo_value = float(result.elo_rating or 0)

                entry = {
                    "rank": rank,
                    "user_id": result.user_id,
                    "username": result.username,
                    "display_name": result.display_name or result.username,
                    "elo_rating": int(round(elo_value)),
                    "score": int(round(elo_value)),
                    "games_played": games_played,
                    "wins": wins,
                    "losses": result.losses or 0,
                    "win_rate": win_rate,
                    "best_score": result.best_score or 0,
                    "average_score": round(float(result.average_score or 0.0), 1),
                    "sport": result.sport,
                    "mode": result.mode,
                }
                leaderboard.append(entry)

            return leaderboard

        except Exception as exc:
            print(f"Error getting leaderboard: {exc}")
            return []
        finally:
            if created_session:
                session.close()

    @staticmethod
    def get_user_rank(
        user_id: str,
        sport: Optional[str] = None,
        mode: Optional[str] = None,
        db: Optional[Session] = None
    ) -> Optional[int]:
        """Return the 1-based rank for a user, or None if not ranked."""
        session = db or SessionLocal()
        created_session = db is None

        try:
            user_rating_query = session.query(UserRating).filter(UserRating.user_id == user_id)
            if sport:
                user_rating_query = user_rating_query.filter(UserRating.sport == sport)
            if mode:
                user_rating_query = user_rating_query.filter(UserRating.mode == mode)

            user_rating = user_rating_query.first()
            if not user_rating or not user_rating.games_played:
                return None

            count_query = session.query(UserRating).filter(
                UserRating.elo_rating > user_rating.elo_rating,
                UserRating.games_played > 0,
            )
            if sport:
                count_query = count_query.filter(UserRating.sport == sport)
            if mode:
                count_query = count_query.filter(UserRating.mode == mode)

            higher_ratings_count = count_query.count()
            return higher_ratings_count + 1

        except Exception as exc:
            print(f"Error getting user rank: {exc}")
            return None
        finally:
            if created_session:
                session.close()

    @staticmethod
    def get_leaderboard_stats(
        sport: Optional[str] = None,
        mode: Optional[str] = None,
        db: Optional[Session] = None
    ) -> Dict:
        """Return aggregate stats for the requested leaderboard slice."""
        session = db or SessionLocal()
        created_session = db is None

        try:
            query = session.query(UserRating).filter(UserRating.games_played > 0)
            if sport:
                query = query.filter(UserRating.sport == sport)
            if mode:
                query = query.filter(UserRating.mode == mode)

            ratings = query.all()
            if not ratings:
                return {
                    "total_players": 0,
                    "average_elo": 0,
                    "highest_elo": 0,
                    "total_games": 0,
                }

            elo_values = [float(r.elo_rating or 0.0) for r in ratings]
            total_games = sum(r.games_played or 0 for r in ratings)

            return {
                "total_players": len(ratings),
                "average_elo": round(sum(elo_values) / len(elo_values), 1),
                "highest_elo": round(max(elo_values), 1),
                "total_games": total_games,
            }

        except Exception as exc:
            print(f"Error getting leaderboard stats: {exc}")
            return {"error": str(exc)}
        finally:
            if created_session:
                session.close()
