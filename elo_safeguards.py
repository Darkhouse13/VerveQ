# File: elo_safeguards.py
"""
Elo Rating System Safeguards and Anti-Abuse Measures
Implements comprehensive protection against rating manipulation and abuse
"""

import time
import hashlib
import ipaddress
from typing import Dict, Any, Optional, List, Tuple
from datetime import datetime, timedelta
from collections import defaultdict, deque
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class RateLimitExceeded(Exception):
    """Raised when rate limits are exceeded"""
    pass


class SuspiciousActivityDetected(Exception):
    """Raised when suspicious activity is detected"""
    pass


class MatchValidationError(Exception):
    """Raised when match validation fails"""
    pass


class EloSafeguardSystem:
    """
    Comprehensive safeguard system for Elo ratings.
    Prevents manipulation, abuse, and ensures fair play.
    """
    
    def __init__(self):
        """Initialize the safeguard system"""
        # Rate limiting
        self.player_actions = defaultdict(deque)  # player_id -> deque of timestamps
        self.ip_actions = defaultdict(deque)  # ip_address -> deque of timestamps
        
        # Activity monitoring
        self.suspicious_patterns = defaultdict(list)  # player_id -> list of incidents
        self.match_history = defaultdict(list)  # player_id -> recent matches
        
        # Validation tracking
        self.pending_matches = {}  # match_id -> match validation data
        self.completed_matches = {}  # match_id -> completion data
        
        # Configuration
        self.config = {
            # Rate limits (actions per time period)
            'max_matches_per_hour': 10,
            'max_matches_per_day': 50,
            'max_api_calls_per_minute': 30,
            'max_registrations_per_ip_per_day': 5,
            
            # Validation thresholds
            'min_match_duration': 30,  # seconds
            'max_match_duration': 3600,  # 1 hour
            'min_rounds_for_valid_match': 3,
            'max_rating_change_per_match': 50,
            
            # Abuse detection
            'max_consecutive_losses_for_review': 10,
            'max_win_rate_spike_threshold': 0.8,  # 80% sudden improvement
            'suspicious_pattern_threshold': 5,
            
            # Penalties
            'temporary_ban_duration': 3600,  # 1 hour
            'rating_freeze_duration': 86400,  # 24 hours
            'escalation_multiplier': 2,
        }
        
        # Penalty tracking
        self.penalties = defaultdict(list)  # player_id -> list of penalties
        self.banned_ips = {}  # ip_address -> ban_expiry_time
        
        logger.info("EloSafeguardSystem initialized with comprehensive protections")
    
    def validate_player_name(self, player_name: str) -> bool:
        """
        Validate player name for appropriateness and format.
        
        Args:
            player_name: The player name to validate
            
        Returns:
            True if valid, False otherwise
        """
        if not player_name or not isinstance(player_name, str):
            return False
        
        # Length constraints
        if len(player_name) < 2 or len(player_name) > 20:
            return False
        
        # Character constraints (alphanumeric, spaces, basic punctuation)
        allowed_chars = set("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 ._-")
        if not all(c in allowed_chars for c in player_name):
            return False
        
        # Profanity filter (basic implementation)
        profanity_keywords = ['admin', 'test', 'bot', 'cheat', 'hack', 'null', 'undefined']
        player_lower = player_name.lower()
        if any(keyword in player_lower for keyword in profanity_keywords):
            return False
        
        return True
    
    def check_rate_limits(self, player_id: str, action_type: str, ip_address: str = None) -> bool:
        """
        Check if action is within rate limits.
        
        Args:
            player_id: ID of the player
            action_type: Type of action ('match_create', 'api_call', 'registration')
            ip_address: IP address of the request
            
        Returns:
            True if within limits, False otherwise
            
        Raises:
            RateLimitExceeded: If rate limits are exceeded
        """
        current_time = time.time()
        
        # Clean old entries
        self._clean_old_entries(current_time)
        
        # Check player-specific limits
        if action_type == 'match_create':
            # Check hourly limit
            hour_ago = current_time - 3600
            recent_matches = [t for t in self.player_actions[player_id] if t > hour_ago]
            if len(recent_matches) >= self.config['max_matches_per_hour']:
                raise RateLimitExceeded(f"Player {player_id} exceeded hourly match limit")
            
            # Check daily limit
            day_ago = current_time - 86400
            daily_matches = [t for t in self.player_actions[player_id] if t > day_ago]
            if len(daily_matches) >= self.config['max_matches_per_day']:
                raise RateLimitExceeded(f"Player {player_id} exceeded daily match limit")
        
        elif action_type == 'api_call':
            # Check API call rate
            minute_ago = current_time - 60
            recent_calls = [t for t in self.player_actions[player_id] if t > minute_ago]
            if len(recent_calls) >= self.config['max_api_calls_per_minute']:
                raise RateLimitExceeded(f"Player {player_id} exceeded API rate limit")
        
        # Check IP-based limits
        if ip_address and action_type == 'registration':
            day_ago = current_time - 86400
            ip_registrations = [t for t in self.ip_actions[ip_address] if t > day_ago]
            if len(ip_registrations) >= self.config['max_registrations_per_ip_per_day']:
                raise RateLimitExceeded(f"IP {ip_address} exceeded daily registration limit")
        
        # Record the action
        self.player_actions[player_id].append(current_time)
        if ip_address:
            self.ip_actions[ip_address].append(current_time)
        
        return True
    
    def validate_match_creation(self, player1_name: str, player2_name: str, 
                               session_id: str, ip_address: str = None) -> bool:
        """
        Validate match creation request.
        
        Args:
            player1_name: Name of first player
            player2_name: Name of second player
            session_id: Session ID
            ip_address: IP address of request
            
        Returns:
            True if valid, False otherwise
            
        Raises:
            MatchValidationError: If validation fails
        """
        # Validate player names
        if not self.validate_player_name(player1_name):
            raise MatchValidationError(f"Invalid player name: {player1_name}")
        
        if not self.validate_player_name(player2_name):
            raise MatchValidationError(f"Invalid player name: {player2_name}")
        
        # Prevent self-play
        if player1_name.lower() == player2_name.lower():
            raise MatchValidationError("Players cannot play against themselves")
        
        # Check for suspicious patterns (same players repeatedly)
        player_pair = tuple(sorted([player1_name.lower(), player2_name.lower()]))
        recent_matches = self.match_history.get(player_pair, [])
        hour_ago = time.time() - 3600
        recent_matches_count = len([m for m in recent_matches if m > hour_ago])
        
        if recent_matches_count >= 5:  # Maximum 5 matches per hour between same players
            raise MatchValidationError("Too many matches between same players")
        
        # Check IP bans
        if ip_address and ip_address in self.banned_ips:
            if time.time() < self.banned_ips[ip_address]:
                raise MatchValidationError("IP address is temporarily banned")
            else:
                del self.banned_ips[ip_address]
        
        # Rate limiting check
        try:
            self.check_rate_limits(player1_name, 'match_create', ip_address)
            self.check_rate_limits(player2_name, 'match_create', ip_address)
        except RateLimitExceeded as e:
            raise MatchValidationError(str(e))
        
        # Record match attempt
        self.match_history[player_pair].append(time.time())
        
        return True
    
    def validate_match_completion(self, match_id: int, duration: int, 
                                 rounds_played: int, result: str) -> bool:
        """
        Validate match completion for legitimacy.
        
        Args:
            match_id: ID of the match
            duration: Match duration in seconds
            rounds_played: Number of rounds played
            result: Match result
            
        Returns:
            True if valid, False otherwise
            
        Raises:
            MatchValidationError: If validation fails
        """
        # Duration validation
        if duration < self.config['min_match_duration']:
            raise MatchValidationError(f"Match too short: {duration}s (min: {self.config['min_match_duration']}s)")
        
        if duration > self.config['max_match_duration']:
            raise MatchValidationError(f"Match too long: {duration}s (max: {self.config['max_match_duration']}s)")
        
        # Rounds validation
        if rounds_played < self.config['min_rounds_for_valid_match']:
            raise MatchValidationError(f"Too few rounds: {rounds_played} (min: {self.config['min_rounds_for_valid_match']})")
        
        # Result validation
        valid_results = ['player1_wins', 'player2_wins', 'draw']
        if result not in valid_results:
            raise MatchValidationError(f"Invalid result: {result}")
        
        # Time consistency check (rounds vs duration)
        min_time_per_round = 10  # seconds
        max_time_per_round = 300  # 5 minutes
        avg_time_per_round = duration / rounds_played if rounds_played > 0 else 0
        
        if avg_time_per_round < min_time_per_round or avg_time_per_round > max_time_per_round:
            raise MatchValidationError(f"Suspicious time per round: {avg_time_per_round:.1f}s")
        
        return True
    
    def detect_suspicious_activity(self, player_name: str, match_result: Dict[str, Any]) -> List[str]:
        """
        Detect suspicious activity patterns.
        
        Args:
            player_name: Name of the player
            match_result: Match result data
            
        Returns:
            List of detected suspicious patterns
        """
        suspicious_patterns = []
        
        # Get recent match history for the player
        recent_matches = self.match_history.get(player_name, [])
        
        # Pattern 1: Excessive consecutive losses (possible rating manipulation)
        consecutive_losses = 0
        for match in reversed(recent_matches[-20:]):  # Check last 20 matches
            if match.get('result') == 'loss':
                consecutive_losses += 1
            else:
                break
        
        if consecutive_losses >= self.config['max_consecutive_losses_for_review']:
            suspicious_patterns.append(f"Excessive consecutive losses: {consecutive_losses}")
        
        # Pattern 2: Sudden win rate improvement (possible account sharing)
        if len(recent_matches) >= 20:
            old_matches = recent_matches[-20:-10]
            new_matches = recent_matches[-10:]
            
            old_wins = sum(1 for m in old_matches if m.get('result') == 'win')
            new_wins = sum(1 for m in new_matches if m.get('result') == 'win')
            
            old_win_rate = old_wins / len(old_matches)
            new_win_rate = new_wins / len(new_matches)
            
            if new_win_rate - old_win_rate > self.config['max_win_rate_spike_threshold']:
                suspicious_patterns.append(f"Sudden win rate spike: {old_win_rate:.2f} -> {new_win_rate:.2f}")
        
        # Pattern 3: Unusual match duration patterns
        if len(recent_matches) >= 5:
            durations = [m.get('duration', 0) for m in recent_matches[-5:]]
            avg_duration = sum(durations) / len(durations)
            
            # Check for suspiciously consistent durations (possible automation)
            duration_variance = sum((d - avg_duration) ** 2 for d in durations) / len(durations)
            if duration_variance < 100:  # Very low variance
                suspicious_patterns.append("Suspiciously consistent match durations")
        
        # Pattern 4: Rapid rating changes
        current_elo_change = match_result.get('elo_change', 0)
        if abs(current_elo_change) > self.config['max_rating_change_per_match']:
            suspicious_patterns.append(f"Excessive rating change: {current_elo_change}")
        
        # Record patterns for escalation
        if suspicious_patterns:
            self.suspicious_patterns[player_name].extend(suspicious_patterns)
            
            # Check for pattern escalation
            recent_incidents = [
                incident for incident in self.suspicious_patterns[player_name]
                if time.time() - incident.get('timestamp', 0) < 86400  # Last 24 hours
            ]
            
            if len(recent_incidents) >= self.config['suspicious_pattern_threshold']:
                suspicious_patterns.append("Multiple suspicious patterns detected")
        
        return suspicious_patterns
    
    def apply_penalty(self, player_name: str, penalty_type: str, reason: str) -> Dict[str, Any]:
        """
        Apply penalty to a player.
        
        Args:
            player_name: Name of the player
            penalty_type: Type of penalty ('warning', 'temp_ban', 'rating_freeze')
            reason: Reason for the penalty
            
        Returns:
            Penalty details
        """
        current_time = time.time()
        
        # Calculate penalty duration based on previous penalties
        previous_penalties = [p for p in self.penalties[player_name] 
                            if current_time - p.get('timestamp', 0) < 604800]  # Last 7 days
        
        penalty_multiplier = self.config['escalation_multiplier'] ** len(previous_penalties)
        
        penalty = {
            'type': penalty_type,
            'reason': reason,
            'timestamp': current_time,
            'player_name': player_name
        }
        
        if penalty_type == 'temp_ban':
            penalty['duration'] = self.config['temporary_ban_duration'] * penalty_multiplier
            penalty['expires_at'] = current_time + penalty['duration']
            
        elif penalty_type == 'rating_freeze':
            penalty['duration'] = self.config['rating_freeze_duration'] * penalty_multiplier
            penalty['expires_at'] = current_time + penalty['duration']
        
        # Record penalty
        self.penalties[player_name].append(penalty)
        
        logger.warning(f"Applied penalty to {player_name}: {penalty_type} - {reason}")
        
        return penalty
    
    def is_player_banned(self, player_name: str) -> Tuple[bool, Optional[Dict[str, Any]]]:
        """
        Check if player is currently banned.
        
        Args:
            player_name: Name of the player
            
        Returns:
            Tuple of (is_banned, active_penalty)
        """
        current_time = time.time()
        
        for penalty in reversed(self.penalties[player_name]):
            if penalty.get('type') == 'temp_ban':
                if current_time < penalty.get('expires_at', 0):
                    return True, penalty
        
        return False, None
    
    def is_rating_frozen(self, player_name: str) -> Tuple[bool, Optional[Dict[str, Any]]]:
        """
        Check if player's rating is frozen.
        
        Args:
            player_name: Name of the player
            
        Returns:
            Tuple of (is_frozen, active_penalty)
        """
        current_time = time.time()
        
        for penalty in reversed(self.penalties[player_name]):
            if penalty.get('type') == 'rating_freeze':
                if current_time < penalty.get('expires_at', 0):
                    return True, penalty
        
        return False, None
    
    def validate_elo_change(self, old_elo: int, new_elo: int, match_context: Dict[str, Any]) -> bool:
        """
        Validate Elo rating change for reasonableness.
        
        Args:
            old_elo: Previous Elo rating
            new_elo: New Elo rating
            match_context: Context about the match
            
        Returns:
            True if valid, False otherwise
            
        Raises:
            MatchValidationError: If change is invalid
        """
        change = abs(new_elo - old_elo)
        
        # Basic range check
        if change > self.config['max_rating_change_per_match']:
            raise MatchValidationError(f"Elo change too large: {change} (max: {self.config['max_rating_change_per_match']})")
        
        # Validate against expected change based on opponent
        opponent_elo = match_context.get('opponent_elo', old_elo)
        expected_change = self._calculate_expected_change(old_elo, opponent_elo, match_context.get('result', 'draw'))
        
        # Allow some variance but flag extreme deviations
        if change > expected_change * 2:
            logger.warning(f"Unusual Elo change: expected ~{expected_change}, got {change}")
        
        return True
    
    def generate_match_token(self, match_id: int, player1_name: str, player2_name: str) -> str:
        """
        Generate a secure token for match validation.
        
        Args:
            match_id: ID of the match
            player1_name: Name of first player
            player2_name: Name of second player
            
        Returns:
            Secure match token
        """
        current_time = int(time.time())
        token_data = f"{match_id}:{player1_name}:{player2_name}:{current_time}"
        
        # Add some entropy
        import secrets
        salt = secrets.token_hex(8)
        
        # Create hash
        token_hash = hashlib.sha256(f"{token_data}:{salt}".encode()).hexdigest()
        
        return f"{current_time}:{salt}:{token_hash[:16]}"
    
    def validate_match_token(self, token: str, match_id: int, player1_name: str, player2_name: str) -> bool:
        """
        Validate a match token.
        
        Args:
            token: Token to validate
            match_id: Expected match ID
            player1_name: Expected first player name
            player2_name: Expected second player name
            
        Returns:
            True if valid, False otherwise
        """
        try:
            timestamp_str, salt, token_hash = token.split(':')
            timestamp = int(timestamp_str)
            
            # Check token age (tokens expire after 1 hour)
            if time.time() - timestamp > 3600:
                return False
            
            # Reconstruct expected token
            token_data = f"{match_id}:{player1_name}:{player2_name}:{timestamp}"
            expected_hash = hashlib.sha256(f"{token_data}:{salt}".encode()).hexdigest()[:16]
            
            return token_hash == expected_hash
            
        except (ValueError, IndexError):
            return False
    
    def _clean_old_entries(self, current_time: float):
        """Clean old entries from tracking dictionaries"""
        cutoff_time = current_time - 86400  # 24 hours ago
        
        # Clean player actions
        for player_id in list(self.player_actions.keys()):
            self.player_actions[player_id] = deque(
                t for t in self.player_actions[player_id] if t > cutoff_time
            )
            if not self.player_actions[player_id]:
                del self.player_actions[player_id]
        
        # Clean IP actions
        for ip in list(self.ip_actions.keys()):
            self.ip_actions[ip] = deque(
                t for t in self.ip_actions[ip] if t > cutoff_time
            )
            if not self.ip_actions[ip]:
                del self.ip_actions[ip]
    
    def _calculate_expected_change(self, player_elo: int, opponent_elo: int, result: str) -> int:
        """Calculate expected Elo change for validation"""
        # Simple expected change calculation
        k_factor = 32  # Assume high K-factor for conservative estimate
        expected_score = 1 / (1 + 10 ** ((opponent_elo - player_elo) / 400))
        
        if result == 'win':
            actual_score = 1.0
        elif result == 'loss':
            actual_score = 0.0
        else:  # draw
            actual_score = 0.5
        
        change = k_factor * (actual_score - expected_score)
        return abs(int(round(change)))
    
    def get_safeguard_status(self, player_name: str) -> Dict[str, Any]:
        """
        Get comprehensive safeguard status for a player.
        
        Args:
            player_name: Name of the player
            
        Returns:
            Dictionary with safeguard status information
        """
        current_time = time.time()
        
        # Check active penalties
        is_banned, ban_penalty = self.is_player_banned(player_name)
        is_frozen, freeze_penalty = self.is_rating_frozen(player_name)
        
        # Get recent activity
        recent_matches = len([t for t in self.player_actions.get(player_name, []) 
                            if t > current_time - 3600])  # Last hour
        
        # Get suspicious patterns
        recent_patterns = [p for p in self.suspicious_patterns.get(player_name, [])
                         if current_time - p.get('timestamp', 0) < 86400]  # Last 24 hours
        
        return {
            'player_name': player_name,
            'is_banned': is_banned,
            'ban_expires_at': ban_penalty.get('expires_at') if ban_penalty else None,
            'is_rating_frozen': is_frozen,
            'freeze_expires_at': freeze_penalty.get('expires_at') if freeze_penalty else None,
            'recent_matches_count': recent_matches,
            'suspicious_patterns_count': len(recent_patterns),
            'total_penalties': len(self.penalties.get(player_name, [])),
            'last_activity': max(self.player_actions.get(player_name, [0])) if self.player_actions.get(player_name) else None
        }


# Global safeguard instance
safeguard_system = EloSafeguardSystem()


def validate_competitive_match_request(player1_name: str, player2_name: str, 
                                     session_id: str, ip_address: str = None) -> bool:
    """
    Validate a competitive match creation request.
    
    Args:
        player1_name: Name of first player
        player2_name: Name of second player  
        session_id: Session ID
        ip_address: IP address of request
        
    Returns:
        True if valid, False otherwise
        
    Raises:
        MatchValidationError: If validation fails
        RateLimitExceeded: If rate limits are exceeded
        SuspiciousActivityDetected: If suspicious activity is detected
    """
    return safeguard_system.validate_match_creation(player1_name, player2_name, session_id, ip_address)


def validate_match_completion_request(match_id: int, duration: int, rounds_played: int, 
                                    result: str, player1_name: str, player2_name: str) -> bool:
    """
    Validate a match completion request.
    
    Args:
        match_id: ID of the match
        duration: Match duration in seconds
        rounds_played: Number of rounds played
        result: Match result
        player1_name: Name of first player
        player2_name: Name of second player
        
    Returns:
        True if valid, False otherwise
        
    Raises:
        MatchValidationError: If validation fails
        SuspiciousActivityDetected: If suspicious activity is detected
    """
    # Validate completion
    safeguard_system.validate_match_completion(match_id, duration, rounds_played, result)
    
    # Check for suspicious activity
    match_data = {
        'result': 'win' if result.endswith('_wins') else 'draw',
        'duration': duration,
        'rounds': rounds_played
    }
    
    patterns1 = safeguard_system.detect_suspicious_activity(player1_name, match_data)
    patterns2 = safeguard_system.detect_suspicious_activity(player2_name, match_data)
    
    if patterns1 or patterns2:
        logger.warning(f"Suspicious patterns detected in match {match_id}: {patterns1 + patterns2}")
        
        # Apply warnings for first-time offenses
        if patterns1 and len(safeguard_system.suspicious_patterns[player1_name]) <= 3:
            safeguard_system.apply_penalty(player1_name, 'warning', f"Suspicious patterns: {patterns1}")
        
        if patterns2 and len(safeguard_system.suspicious_patterns[player2_name]) <= 3:
            safeguard_system.apply_penalty(player2_name, 'warning', f"Suspicious patterns: {patterns2}")
    
    return True


def check_player_eligibility(player_name: str) -> Tuple[bool, Optional[str]]:
    """
    Check if player is eligible to play.
    
    Args:
        player_name: Name of the player
        
    Returns:
        Tuple of (is_eligible, reason_if_not)
    """
    # Check if banned
    is_banned, ban_penalty = safeguard_system.is_player_banned(player_name)
    if is_banned:
        expires_at = datetime.fromtimestamp(ban_penalty.get('expires_at', 0))
        return False, f"Player is temporarily banned until {expires_at}"
    
    # Check rate limits (basic check)
    try:
        current_time = time.time()
        hour_ago = current_time - 3600
        recent_matches = [t for t in safeguard_system.player_actions.get(player_name, []) if t > hour_ago]
        
        if len(recent_matches) >= safeguard_system.config['max_matches_per_hour']:
            return False, "Player has exceeded hourly match limit"
    
    except Exception as e:
        logger.error(f"Error checking eligibility for {player_name}: {e}")
        return False, "Unable to verify player eligibility"
    
    return True, None


if __name__ == "__main__":
    # Test the safeguard system
    print("🛡️ Testing Elo Safeguard System")
    print("=" * 40)
    
    safeguards = EloSafeguardSystem()
    
    # Test player name validation
    valid_names = ["Alice", "Bob123", "Player_One", "Test.User"]
    invalid_names = ["", "A", "VeryLongPlayerNameThatExceedsLimit", "Admin", "Test@User", "Player<script>"]
    
    print("Player name validation:")
    for name in valid_names:
        result = safeguards.validate_player_name(name)
        print(f"  {name}: {'✅' if result else '❌'}")
    
    for name in invalid_names:
        result = safeguards.validate_player_name(name)
        print(f"  {name}: {'✅' if result else '❌'}")
    
    # Test rate limiting
    print("\nRate limiting:")
    try:
        for i in range(12):  # Exceed hourly limit
            safeguards.check_rate_limits("TestPlayer", "match_create")
        print("  Rate limiting: ❌ Failed to catch excess")
    except RateLimitExceeded:
        print("  Rate limiting: ✅ Correctly blocked excess requests")
    
    # Test match validation
    print("\nMatch validation:")
    try:
        safeguards.validate_match_creation("Alice", "Bob", "session123")
        print("  Valid match: ✅")
    except MatchValidationError:
        print("  Valid match: ❌")
    
    try:
        safeguards.validate_match_creation("Alice", "Alice", "session456")
        print("  Self-play prevention: ❌ Failed to prevent")
    except MatchValidationError:
        print("  Self-play prevention: ✅ Correctly blocked")
    
    # Test match completion validation
    print("\nMatch completion validation:")
    try:
        safeguards.validate_match_completion(1, 120, 5, "player1_wins")
        print("  Valid completion: ✅")
    except MatchValidationError:
        print("  Valid completion: ❌")
    
    try:
        safeguards.validate_match_completion(2, 10, 1, "player1_wins")  # Too short
        print("  Short match prevention: ❌ Failed to prevent")
    except MatchValidationError:
        print("  Short match prevention: ✅ Correctly blocked")
    
    # Test penalty system
    print("\nPenalty system:")
    penalty = safeguards.apply_penalty("BadPlayer", "warning", "Suspicious activity")
    print(f"  Applied penalty: ✅ {penalty['type']}")
    
    is_banned, _ = safeguards.is_player_banned("BadPlayer")
    print(f"  Ban check: {'❌' if is_banned else '✅'} (not banned for warning)")
    
    penalty = safeguards.apply_penalty("BadPlayer", "temp_ban", "Repeated violations")
    is_banned, _ = safeguards.is_player_banned("BadPlayer")
    print(f"  Ban enforcement: {'✅' if is_banned else '❌'}")
    
    print("\n✅ Safeguard system tests completed!")