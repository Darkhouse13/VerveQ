"""
Question Validator - Ensures factual correctness and uniqueness of quiz questions
Addresses critical issues with multiple correct answers and poor question quality
"""

import logging
from typing import Dict, Any, List, Optional, Set, Tuple
from collections import defaultdict, Counter
from Data import JSONDataHandler

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class QuestionValidator:
    """
    Validates quiz questions for factual correctness, uniqueness, and quality.
    Prevents questions with multiple correct answers and inappropriate distractors.
    """
    
    def __init__(self, data_handler: JSONDataHandler):
        """
        Initialize the validator with access to the quiz data.
        
        Args:
            data_handler: JSONDataHandler instance for accessing quiz data
        """
        self.data_handler = data_handler
        self.multiple_winners_cache = {}  # Cache for performance
        
    def analyze_award_data_for_duplicates(self, competition_id: str) -> Dict[str, Any]:
        """
        Analyze award data to identify players with multiple wins.
        
        Args:
            competition_id: The competition to analyze
            
        Returns:
            Dictionary with analysis results and recommendations
        """
        try:
            award_data = self.data_handler.get_award_data(competition_id)
            if not award_data:
                return {"error": f"No data found for competition {competition_id}"}
            
            # Group by player to find multiple winners
            player_wins = defaultdict(list)
            for record in award_data:
                player = record.get('Player', '').strip()
                season = record.get('Season', '').strip()
                if player and season:
                    player_wins[player].append(season)
            
            # Identify players with multiple wins
            multiple_winners = {
                player: seasons for player, seasons in player_wins.items() 
                if len(seasons) > 1
            }
            
            # Analyze distribution
            win_counts = Counter(len(seasons) for seasons in player_wins.values())
            
            analysis = {
                "competition_id": competition_id,
                "total_players": len(player_wins),
                "total_records": len(award_data),
                "multiple_winners_count": len(multiple_winners),
                "multiple_winners": multiple_winners,
                "win_distribution": dict(win_counts),
                "problematic_questions": self._identify_problematic_season_questions(multiple_winners)
            }
            
            # Cache results for future use
            self.multiple_winners_cache[competition_id] = multiple_winners
            
            return analysis
            
        except Exception as e:
            logger.error(f"Error analyzing award data for {competition_id}: {e}")
            return {"error": str(e)}
    
    def _identify_problematic_season_questions(self, multiple_winners: Dict[str, List[str]]) -> List[Dict[str, Any]]:
        """
        Identify season questions that would have multiple correct answers.
        
        Args:
            multiple_winners: Dictionary of players with their winning seasons
            
        Returns:
            List of problematic questions with suggested fixes
        """
        problematic = []
        
        for player, seasons in multiple_winners.items():
            # Standard season question would be ambiguous
            problematic_question = {
                "player": player,
                "winning_seasons": seasons,
                "problematic_question": f"In which season did {player} win this award?",
                "issue": "Multiple correct answers",
                "suggested_fixes": [
                    f"In which season did {player} FIRST win this award? (Answer: {min(seasons)})",
                    f"In which season did {player} MOST RECENTLY win this award? (Answer: {max(seasons)})",
                    f"How many times did {player} win this award? (Answer: {len(seasons)})",
                    f"Which of these seasons did {player} NOT win this award? (Exclusion question)"
                ]
            }
            problematic.append(problematic_question)
            
        return problematic
    
    def validate_season_question(self, player: str, season: str, competition_id: str) -> Dict[str, Any]:
        """
        Validate if a season question would have unique correct answer.
        
        Args:
            player: Player name
            season: Season in question
            competition_id: Competition identifier
            
        Returns:
            Validation result with recommendations
        """
        # Get multiple winners data (from cache or fresh analysis)
        if competition_id not in self.multiple_winners_cache:
            self.analyze_award_data_for_duplicates(competition_id)
        
        multiple_winners = self.multiple_winners_cache.get(competition_id, {})
        
        if player in multiple_winners:
            winning_seasons = multiple_winners[player]
            
            return {
                "is_valid": False,
                "issue": "multiple_correct_answers",
                "player": player,
                "target_season": season,
                "all_winning_seasons": winning_seasons,
                "recommendation": "modify_question_type",
                "suggested_alternatives": [
                    {
                        "type": "first_win",
                        "question": f"In which season did {player} FIRST win this award?",
                        "answer": min(winning_seasons)
                    },
                    {
                        "type": "latest_win", 
                        "question": f"In which season did {player} MOST RECENTLY win this award?",
                        "answer": max(winning_seasons)
                    },
                    {
                        "type": "count_wins",
                        "question": f"How many times did {player} win this award?",
                        "answer": str(len(winning_seasons))
                    }
                ]
            }
        
        return {
            "is_valid": True,
            "issue": None,
            "player": player,
            "target_season": season,
            "recommendation": "proceed_with_standard_question"
        }
    
    def validate_distractor_appropriateness(self, question_type: str, correct_answer: str, 
                                          distractors: List[str], context: Dict[str, Any] = None) -> Dict[str, Any]:
        """
        Validate that distractors are appropriate for the question context.
        
        Args:
            question_type: Type of question (award_winner, award_season, etc.)
            correct_answer: The correct answer
            distractors: List of distractor options
            context: Additional context (competition, player info, etc.)
            
        Returns:
            Validation result with quality assessment
        """
        issues = []
        quality_score = 1.0
        
        # Check for generic distractors
        generic_distractors = ["Other Player", "Unknown", "Not Listed", "None of the above"]
        generic_found = [d for d in distractors if d in generic_distractors]
        if generic_found:
            issues.append({
                "type": "generic_distractors",
                "items": generic_found,
                "severity": "critical",
                "recommendation": "Replace with contextually relevant distractors"
            })
            quality_score -= 0.5
        
        # Check for empty or None distractors
        invalid_distractors = [d for d in distractors if not d or not d.strip()]
        if invalid_distractors:
            issues.append({
                "type": "invalid_distractors",
                "count": len(invalid_distractors),
                "severity": "critical",
                "recommendation": "Remove empty distractors and generate valid ones"
            })
            quality_score -= 0.3
        
        # Context-specific validation
        if question_type == "award_team" and context:
            issues.extend(self._validate_team_distractors(correct_answer, distractors, context))
        elif question_type == "award_winner" and context:
            issues.extend(self._validate_player_distractors(correct_answer, distractors, context))
        elif question_type == "award_season":
            issues.extend(self._validate_season_distractors(correct_answer, distractors))
        
        # Calculate final quality score
        for issue in issues:
            if issue["severity"] == "critical":
                quality_score -= 0.2
            elif issue["severity"] == "major":
                quality_score -= 0.1
            elif issue["severity"] == "minor":
                quality_score -= 0.05
        
        quality_score = max(0.0, quality_score)
        
        return {
            "is_valid": quality_score >= 0.7,
            "quality_score": quality_score,
            "issues": issues,
            "recommendation": "accept" if quality_score >= 0.7 else "reject_and_regenerate"
        }
    
    def _validate_team_distractors(self, correct_team: str, distractors: List[str], 
                                 context: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Validate team-specific distractors."""
        issues = []
        
        # Check if any distractors are countries when asking about clubs
        countries = {
            'Spain', 'England', 'Germany', 'Italy', 'France', 'Brazil', 'Argentina',
            'Portugal', 'Netherlands', 'Belgium', 'Croatia', 'Poland'
        }
        
        country_distractors = [d for d in distractors if d in countries]
        if country_distractors:
            issues.append({
                "type": "inappropriate_context",
                "items": country_distractors,
                "severity": "critical",
                "recommendation": "Replace countries with club teams for club-related questions"
            })
        
        return issues
    
    def _validate_player_distractors(self, correct_player: str, distractors: List[str], 
                                   context: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Validate player-specific distractors."""
        issues = []
        
        # Check for obviously inappropriate players (could be enhanced with more logic)
        if len(set(distractors)) != len(distractors):
            duplicate_distractors = [d for d in distractors if distractors.count(d) > 1]
            issues.append({
                "type": "duplicate_distractors",
                "items": list(set(duplicate_distractors)),
                "severity": "major",
                "recommendation": "Remove duplicate distractors"
            })
        
        return issues
    
    def _validate_season_distractors(self, correct_season: str, distractors: List[str]) -> List[Dict[str, Any]]:
        """Validate season-specific distractors."""
        issues = []
        
        # Check season format consistency
        season_formats = set()
        for season in [correct_season] + distractors:
            if '-' in season:
                season_formats.add("range_format")  # e.g., "2020-2021"
            elif season.isdigit() and len(season) == 4:
                season_formats.add("year_format")   # e.g., "2020"
            else:
                season_formats.add("unknown_format")
        
        if len(season_formats) > 1:
            issues.append({
                "type": "inconsistent_season_format",
                "formats_found": list(season_formats),
                "severity": "minor",
                "recommendation": "Standardize season format across all options"
            })
        
        return issues
    
    def generate_comprehensive_report(self, competition_ids: List[str]) -> Dict[str, Any]:
        """
        Generate a comprehensive report of data quality issues across competitions.
        
        Args:
            competition_ids: List of competition IDs to analyze
            
        Returns:
            Comprehensive analysis report
        """
        report = {
            "analysis_timestamp": "2024-01-01T00:00:00Z",  # Would use actual timestamp
            "competitions_analyzed": len(competition_ids),
            "overall_quality_score": 0.0,
            "critical_issues": [],
            "recommendations": [],
            "competition_details": {}
        }
        
        total_quality = 0.0
        critical_issues_count = 0
        
        for comp_id in competition_ids:
            comp_analysis = self.analyze_award_data_for_duplicates(comp_id)
            
            if "error" not in comp_analysis:
                # Calculate competition quality score
                multiple_winners_ratio = comp_analysis["multiple_winners_count"] / max(comp_analysis["total_players"], 1)
                comp_quality = 1.0 - (multiple_winners_ratio * 0.5)  # Penalty for multiple winners
                
                report["competition_details"][comp_id] = {
                    "quality_score": comp_quality,
                    "multiple_winners": comp_analysis["multiple_winners_count"],
                    "total_players": comp_analysis["total_players"],
                    "problematic_questions": len(comp_analysis["problematic_questions"])
                }
                
                total_quality += comp_quality
                critical_issues_count += comp_analysis["multiple_winners_count"]
        
        # Calculate overall metrics
        if competition_ids:
            report["overall_quality_score"] = total_quality / len(competition_ids)
        
        # Generate recommendations
        if critical_issues_count > 0:
            report["recommendations"].append(
                f"Found {critical_issues_count} players with multiple wins. "
                "Implement question type variants (FIRST/LATEST/COUNT) to handle these cases."
            )
        
        if report["overall_quality_score"] < 0.7:
            report["recommendations"].append(
                "Overall data quality is below threshold. Implement enhanced validation pipeline."
            )
        
        return report


if __name__ == "__main__":
    # Test the validator
    from Data import JSONDataHandler
    
    print("=== Testing Question Validator ===\n")
    
    # Initialize components
    data_handler = JSONDataHandler()
    validator = QuestionValidator(data_handler)
    
    # Get available competitions
    competitions = data_handler.get_available_competitions()
    award_competitions = [c['competition_id'] for c in competitions if c['data_type'] == 'award']
    
    print(f"Found {len(award_competitions)} award competitions to analyze\n")
    
    # Analyze first few competitions for multiple winners
    for comp_id in award_competitions[:3]:  # Test first 3
        print(f"🔍 Analyzing {comp_id}...")
        analysis = validator.analyze_award_data_for_duplicates(comp_id)
        
        if "error" in analysis:
            print(f"❌ Error: {analysis['error']}")
        else:
            print(f"   📊 Total players: {analysis['total_players']}")
            print(f"   🏆 Multiple winners: {analysis['multiple_winners_count']}")
            
            if analysis['multiple_winners']:
                print(f"   🚨 Examples of players with multiple wins:")
                for player, seasons in list(analysis['multiple_winners'].items())[:2]:
                    print(f"      - {player}: {seasons}")
        print()
    
    # Generate comprehensive report
    print("📋 Generating comprehensive report...")
    report = validator.generate_comprehensive_report(award_competitions[:5])
    print(f"✅ Overall quality score: {report['overall_quality_score']:.2f}")
    print(f"📈 Recommendations: {len(report['recommendations'])}")
    
    for rec in report['recommendations']:
        print(f"   💡 {rec}")
    
    print("\n✅ Validator testing completed!")