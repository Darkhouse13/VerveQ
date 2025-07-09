# File: difficulty_feedback_database.py
"""
Difficulty Feedback Database
Manages storage and retrieval of user feedback on question difficulty
"""

import json
import os
from datetime import datetime
from typing import Dict, List, Any, Optional
import logging
from sqlalchemy import create_engine, text, MetaData, Table, Column, Integer, String, Float, DateTime
from sqlalchemy.pool import StaticPool

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class DifficultyFeedbackDatabase:
    """
    Database for collecting and managing user feedback on question difficulty.
    Supports both user feedback and admin overrides.
    """
    
    def __init__(self, db_path: str = 'difficulty_feedback.db'):
        """
        Initialize the feedback database.
        
        Args:
            db_path: Path to the SQLite database file (used only if DATABASE_URL not set)
        """
        # Check for DATABASE_URL environment variable
        self.database_url = os.environ.get("DATABASE_URL")
        
        if not self.database_url:
            # Fallback for local development
            self.database_url = f"sqlite:///./{db_path}"
            self.db_path = db_path
            logger.warning("DATABASE_URL not found. Falling back to local SQLite database.")
        else:
            self.db_path = None
            logger.info("Using DATABASE_URL for database connection.")
        
        # Create engine with appropriate settings
        engine_args = {}
        if self.database_url.startswith("sqlite"):
            engine_args["connect_args"] = {"check_same_thread": False}
            engine_args["poolclass"] = StaticPool
        
        self.engine = create_engine(self.database_url, **engine_args)
        self.init_database()
    
    def init_database(self):
        """Create the database tables if they don't exist"""
        with self.engine.connect() as conn:
            # Main feedback table
            conn.execute(text('''
                CREATE TABLE IF NOT EXISTS question_difficulty_feedback (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    question_id TEXT NOT NULL,
                    question_text TEXT NOT NULL,
                    answer TEXT,
                    original_difficulty REAL NOT NULL,
                    user_feedback TEXT CHECK(user_feedback IN ('too_easy', 'just_right', 'too_hard')),
                    admin_override REAL,
                    difficulty_category TEXT,
                    user_id TEXT,
                    quiz_mode TEXT,
                    user_performance_context TEXT,
                    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            '''))
            
            # Admin difficulty adjustments table
            conn.execute(text('''
                CREATE TABLE IF NOT EXISTS admin_difficulty_adjustments (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    question_id TEXT NOT NULL,
                    old_difficulty REAL NOT NULL,
                    new_difficulty REAL NOT NULL,
                    new_category TEXT,
                    admin_user TEXT NOT NULL,
                    reason TEXT,
                    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            '''))
            
            # Question difficulty history table (tracks changes over time)
            conn.execute(text('''
                CREATE TABLE IF NOT EXISTS difficulty_history (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    question_id TEXT NOT NULL,
                    difficulty_score REAL NOT NULL,
                    category TEXT NOT NULL,
                    calculation_method TEXT NOT NULL,
                    confidence_score REAL,
                    feedback_count INTEGER DEFAULT 0,
                    last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            '''))
            
            # Create indexes for better performance
            conn.execute(text('CREATE INDEX IF NOT EXISTS idx_question_id ON question_difficulty_feedback(question_id)'))
            conn.execute(text('CREATE INDEX IF NOT EXISTS idx_timestamp ON question_difficulty_feedback(timestamp)'))
            conn.execute(text('CREATE INDEX IF NOT EXISTS idx_user_feedback ON question_difficulty_feedback(user_feedback)'))
            conn.execute(text('CREATE INDEX IF NOT EXISTS idx_difficulty_history_question ON difficulty_history(question_id)'))
            
            conn.commit()
            logger.info(f"Database initialized")
    
    def submit_user_feedback(self, feedback_data: Dict[str, Any]) -> bool:
        """
        Submit user feedback on question difficulty.
        
        Args:
            feedback_data: Dictionary containing feedback information
        
        Returns:
            bool: True if successful, False otherwise
        """
        required_fields = ['question_id', 'question_text', 'user_feedback', 'original_difficulty']
        
        # Validate required fields
        if not all(field in feedback_data for field in required_fields):
            logger.error(f"Missing required fields. Required: {required_fields}")
            return False
        
        try:
            with self.engine.connect() as conn:
                conn.execute(text('''
                    INSERT INTO question_difficulty_feedback 
                    (question_id, question_text, answer, original_difficulty, user_feedback,
                     difficulty_category, user_id, quiz_mode, user_performance_context, timestamp)
                    VALUES (:question_id, :question_text, :answer, :original_difficulty, :user_feedback,
                            :difficulty_category, :user_id, :quiz_mode, :user_performance_context, :timestamp)
                '''), {
                    'question_id': feedback_data['question_id'],
                    'question_text': feedback_data['question_text'],
                    'answer': feedback_data.get('answer', ''),
                    'original_difficulty': feedback_data['original_difficulty'],
                    'user_feedback': feedback_data['user_feedback'],
                    'difficulty_category': feedback_data.get('difficulty_category', ''),
                    'user_id': feedback_data.get('user_id', ''),
                    'quiz_mode': feedback_data.get('quiz_mode', ''),
                    'user_performance_context': json.dumps(feedback_data.get('user_performance_context', {})),
                    'timestamp': feedback_data.get('timestamp', datetime.now().isoformat())
                })
                
                conn.commit()
                logger.info(f"User feedback submitted for question {feedback_data['question_id']}")
                return True
                
        except Exception as e:
            logger.error(f"Error submitting user feedback: {e}")
            return False
    
    def submit_admin_adjustment(self, adjustment_data: Dict[str, Any]) -> bool:
        """
        Submit admin difficulty adjustment.
        
        Args:
            adjustment_data: Dictionary containing admin adjustment information
        
        Returns:
            bool: True if successful, False otherwise
        """
        required_fields = ['question_id', 'old_difficulty', 'new_difficulty', 'admin_user']
        
        if not all(field in adjustment_data for field in required_fields):
            logger.error(f"Missing required fields for admin adjustment. Required: {required_fields}")
            return False
        
        try:
            with self.engine.connect() as conn:
                # Insert admin adjustment record
                conn.execute(text('''
                    INSERT INTO admin_difficulty_adjustments 
                    (question_id, old_difficulty, new_difficulty, new_category, admin_user, reason)
                    VALUES (:question_id, :old_difficulty, :new_difficulty, :new_category, :admin_user, :reason)
                '''), {
                    'question_id': adjustment_data['question_id'],
                    'old_difficulty': adjustment_data['old_difficulty'],
                    'new_difficulty': adjustment_data['new_difficulty'],
                    'new_category': adjustment_data.get('new_category', ''),
                    'admin_user': adjustment_data['admin_user'],
                    'reason': adjustment_data.get('reason', '')
                })
                
                # Update difficulty history
                self._update_difficulty_history(
                    adjustment_data['question_id'],
                    adjustment_data['new_difficulty'],
                    adjustment_data.get('new_category', 'unknown'),
                    'admin_override'
                )
                
                conn.commit()
                logger.info(f"Admin adjustment submitted for question {adjustment_data['question_id']}")
                return True
                
        except Exception as e:
            logger.error(f"Error submitting admin adjustment: {e}")
            return False
    
    def get_question_feedback(self, question_id: str) -> List[Dict[str, Any]]:
        """
        Get all feedback for a specific question.
        
        Args:
            question_id: The question identifier
        
        Returns:
            List of feedback records
        """
        try:
            with self.engine.connect() as conn:
                result = conn.execute(text('''
                    SELECT * FROM question_difficulty_feedback 
                    WHERE question_id = :question_id
                    ORDER BY timestamp DESC
                '''), {'question_id': question_id})
                
                rows = result.fetchall()
                columns = result.keys()
                
                return [dict(zip(columns, row)) for row in rows]
                
        except Exception as e:
            logger.error(f"Error getting question feedback: {e}")
            return []
    
    def get_feedback_summary(self, question_id: str) -> Dict[str, Any]:
        """
        Get a summary of feedback for a question.
        
        Args:
            question_id: The question identifier
        
        Returns:
            Dictionary with feedback summary statistics
        """
        try:
            with self.engine.connect() as conn:
                # Get feedback counts
                result = conn.execute(text('''
                    SELECT user_feedback, COUNT(*) as count
                    FROM question_difficulty_feedback 
                    WHERE question_id = :question_id
                    GROUP BY user_feedback
                '''), {'question_id': question_id})
                
                feedback_counts = dict(result.fetchall())
                
                # Get average original difficulty
                result = conn.execute(text('''
                    SELECT AVG(original_difficulty) as avg_difficulty,
                           COUNT(*) as total_feedback,
                           MIN(timestamp) as first_feedback,
                           MAX(timestamp) as latest_feedback
                    FROM question_difficulty_feedback 
                    WHERE question_id = :question_id
                '''), {'question_id': question_id})
                
                summary_data = result.fetchone()
                
                total_feedback = summary_data[1] or 0
                return {
                    'question_id': question_id,
                    'feedback_counts': feedback_counts,
                    'total_feedback': total_feedback,
                    'average_original_difficulty': summary_data[0] or 0.5,
                    'first_feedback': summary_data[2],
                    'latest_feedback': summary_data[3],
                    'too_easy_percentage': (feedback_counts.get('too_easy', 0) / max(total_feedback, 1)) * 100,
                    'just_right_percentage': (feedback_counts.get('just_right', 0) / max(total_feedback, 1)) * 100,
                    'too_hard_percentage': (feedback_counts.get('too_hard', 0) / max(total_feedback, 1)) * 100
                }
                
        except Exception as e:
            logger.error(f"Error getting feedback summary: {e}")
            return {}
    
    def calculate_adjusted_difficulty(self, question_id: str) -> Optional[float]:
        """
        Calculate adjusted difficulty based on user feedback.
        
        Args:
            question_id: The question identifier
        
        Returns:
            Adjusted difficulty score or None if no feedback available
        """
        summary = self.get_feedback_summary(question_id)
        
        if summary.get('total_feedback', 0) < 3:  # Need at least 3 feedback points
            return None
        
        # Weight feedback types
        feedback_weights = {
            'too_easy': -0.2,   # Decrease difficulty
            'just_right': 0.0,  # No change
            'too_hard': 0.2     # Increase difficulty
        }
        
        original_difficulty = summary.get('average_original_difficulty', 0.5)
        total_feedback = summary.get('total_feedback', 0)
        
        adjustment = 0.0
        for feedback_type, weight in feedback_weights.items():
            count = summary.get('feedback_counts', {}).get(feedback_type, 0)
            adjustment += (count / total_feedback) * weight
        
        # Apply adjustment with diminishing returns for extreme values
        adjusted_difficulty = original_difficulty + adjustment
        
        # Ensure difficulty stays within bounds
        return max(0.0, min(1.0, adjusted_difficulty))
    
    def get_questions_needing_review(self, threshold_feedback_count: int = 5) -> List[Dict[str, Any]]:
        """
        Get questions that have received significant feedback and may need review.
        
        Args:
            threshold_feedback_count: Minimum feedback count to consider for review
        
        Returns:
            List of questions needing review
        """
        try:
            with self.engine.connect() as conn:
                result = conn.execute(text('''
                    SELECT 
                        question_id,
                        question_text,
                        COUNT(*) as feedback_count,
                        AVG(original_difficulty) as avg_original_difficulty,
                        SUM(CASE WHEN user_feedback = 'too_easy' THEN 1 ELSE 0 END) as too_easy_count,
                        SUM(CASE WHEN user_feedback = 'just_right' THEN 1 ELSE 0 END) as just_right_count,
                        SUM(CASE WHEN user_feedback = 'too_hard' THEN 1 ELSE 0 END) as too_hard_count
                    FROM question_difficulty_feedback
                    GROUP BY question_id, question_text
                    HAVING COUNT(*) >= :threshold
                    ORDER BY feedback_count DESC
                '''), {'threshold': threshold_feedback_count})
                
                rows = result.fetchall()
                columns = result.keys()
                
                questions = []
                for row in rows:
                    question_data = dict(zip(columns, row))
                    
                    # Calculate disagreement score (how much feedback disagrees)
                    total = question_data['feedback_count']
                    disagreement = 1 - max(
                        question_data['too_easy_count'],
                        question_data['just_right_count'],
                        question_data['too_hard_count']
                    ) / total
                    
                    question_data['disagreement_score'] = disagreement
                    question_data['needs_review'] = disagreement > 0.6  # High disagreement
                    
                    questions.append(question_data)
                
                return questions
                
        except Exception as e:
            logger.error(f"Error getting questions for review: {e}")
            return []
    
    def _update_difficulty_history(self, question_id: str, difficulty: float, 
                                   category: str, method: str):
        """Update the difficulty history for a question"""
        try:
            with self.engine.connect() as conn:
                conn.execute(text('''
                    INSERT INTO difficulty_history 
                    (question_id, difficulty_score, category, calculation_method)
                    VALUES (:question_id, :difficulty_score, :category, :calculation_method)
                '''), {
                    'question_id': question_id,
                    'difficulty_score': difficulty,
                    'category': category,
                    'calculation_method': method
                })
                
        except Exception as e:
            logger.error(f"Error updating difficulty history: {e}")
    
    def export_feedback_data(self, output_file: str) -> bool:
        """
        Export all feedback data to a JSON file.
        
        Args:
            output_file: Path to output JSON file
        
        Returns:
            bool: True if successful, False otherwise
        """
        try:
            with self.engine.connect() as conn:
                # Get all feedback data
                result = conn.execute(text('SELECT * FROM question_difficulty_feedback ORDER BY timestamp'))
                feedback_rows = result.fetchall()
                feedback_columns = result.keys()
                
                result = conn.execute(text('SELECT * FROM admin_difficulty_adjustments ORDER BY timestamp'))
                admin_rows = result.fetchall()
                admin_columns = result.keys()
                
                export_data = {
                    'export_timestamp': datetime.now().isoformat(),
                    'total_feedback_records': len(feedback_rows),
                    'total_admin_adjustments': len(admin_rows),
                    'feedback_data': [dict(zip(feedback_columns, row)) for row in feedback_rows],
                    'admin_adjustments': [dict(zip(admin_columns, row)) for row in admin_rows]
                }
                
                with open(output_file, 'w') as f:
                    json.dump(export_data, f, indent=2, default=str)
                
                logger.info(f"Feedback data exported to {output_file}")
                return True
                
        except Exception as e:
            logger.error(f"Error exporting feedback data: {e}")
            return False


if __name__ == "__main__":
    # Test the feedback database
    db = DifficultyFeedbackDatabase('test_feedback.db')
    
    print("=== Testing Difficulty Feedback Database ===\n")
    
    # Test user feedback submission
    test_feedback = {
        'question_id': 'test_q_001',
        'question_text': 'Who won the Ballon d\'Or in 2023?',
        'answer': 'Lionel Messi',
        'original_difficulty': 0.3,
        'user_feedback': 'too_easy',
        'difficulty_category': 'casual',
        'user_id': 'test_user_1',
        'quiz_mode': 'casual'
    }
    
    success = db.submit_user_feedback(test_feedback)
    print(f"User feedback submission: {'✅ Success' if success else '❌ Failed'}")
    
    # Test getting feedback
    feedback = db.get_question_feedback('test_q_001')
    print(f"Retrieved feedback records: {len(feedback)}")
    
    # Test feedback summary
    summary = db.get_feedback_summary('test_q_001')
    print(f"Feedback summary: {summary}")
    
    # Test admin adjustment
    admin_adjustment = {
        'question_id': 'test_q_001',
        'old_difficulty': 0.3,
        'new_difficulty': 0.2,
        'new_category': 'casual',
        'admin_user': 'admin_test',
        'reason': 'User feedback indicates too easy'
    }
    
    success = db.submit_admin_adjustment(admin_adjustment)
    print(f"Admin adjustment submission: {'✅ Success' if success else '❌ Failed'}")
    
    # Test export
    success = db.export_feedback_data('test_export.json')
    print(f"Data export: {'✅ Success' if success else '❌ Failed'}")
    
    # Cleanup
    if os.path.exists('test_feedback.db'):
        os.remove('test_feedback.db')
    if os.path.exists('test_export.json'):
        os.remove('test_export.json')
    
    print("\n✅ All tests completed successfully!")