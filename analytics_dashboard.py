import json
import pandas as pd
from question_analytics import QuestionAnalytics
import logging

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class AnalyticsDashboard:
    def __init__(self, db_path='question_performance.db'):
        self.analytics = QuestionAnalytics(db_path=db_path)

    def display_overall_summary(self):
        """Displays a summary of overall question performance."""
        report = self.analytics.generate_performance_report()
        overall_metrics = report.get("overall_metrics", {})
        
        print("\n--- Overall Performance Summary ---")
        if overall_metrics:
            print(f"Total Questions Tracked: {report.get('total_questions_tracked', 0)}")
            print(f"Average Success Rate: {overall_metrics.get('average_success_rate', 0):.2f}%")
            print(f"Average Response Time: {overall_metrics.get('average_response_time', 0):.2f} seconds")
            print(f"Total Responses Recorded: {overall_metrics.get('total_responses_recorded', 0)}")
        else:
            print("No overall performance data available.")

    def display_question_level_metrics(self):
        """Displays detailed metrics for each question."""
        metrics_df = self.analytics.calculate_question_metrics()
        print("\n--- Question-Level Metrics ---")
        if not metrics_df.empty:
            print(metrics_df.to_string())
        else:
            print("No question-level metrics available.")

    def display_problematic_questions(self):
        """Displays questions identified as problematic."""
        problematic_df = self.analytics.identify_problematic_questions()
        print("\n--- Problematic Questions Identified ---")
        if not problematic_df.empty:
            print(problematic_df.to_string())
        else:
            print("No problematic questions identified.")

    def display_recommendations(self):
        """Displays recommendations for question pool optimization."""
        recommendations = self.analytics.optimize_question_pool()
        print("\n--- Optimization Recommendations ---")
        for insight in recommendations.get("general_insights", []):
            print(insight)
        
        question_specific_recs = recommendations.get("question_specific_recommendations", {})
        if question_specific_recs:
            for q_id, recs in question_specific_recs.items():
                print(f"\nRecommendations for {q_id}:")
                for rec in recs:
                    print(rec)
        else:
            print("No specific question recommendations at this time.")

    def generate_full_report_json(self, filename='question_performance_report.json'):
        """Generates and saves a full performance report to a JSON file."""
        report = self.analytics.generate_performance_report()
        
        # Convert any non-serializable types (like numpy.int64, numpy.float64) to standard Python types
        # This is crucial because Pandas/Numpy types are not directly JSON serializable
        def convert_to_serializable(obj):
            if isinstance(obj, (pd.Int64Dtype, pd.Float64Dtype)): # Check for Pandas dtypes
                return obj.item() # Convert to Python scalar
            if isinstance(obj, (int, float, str, bool, type(None))):
                return obj
            if isinstance(obj, dict):
                return {k: convert_to_serializable(v) for k, v in obj.items()}
            if isinstance(obj, list):
                return [convert_to_serializable(elem) for elem in obj]
            # Handle numpy specific types if they somehow persist
            if hasattr(obj, 'item'): # For numpy.int64, numpy.float64 etc.
                return obj.item()
            return obj

        serializable_report = convert_to_serializable(report)

        try:
            with open(filename, 'w') as f:
                json.dump(serializable_report, f, indent=4)
            logger.info(f"Full performance report saved to {filename}")
            return True
        except (IOError, TypeError) as e:
            logger.error(f"Error saving report to JSON: {e}")
            return False

    def run_dashboard(self):
        """Runs the interactive dashboard display."""
        print("--- FootQuizz Question Performance Dashboard ---")
        self.display_overall_summary()
        self.display_question_level_metrics()
        self.display_problematic_questions()
        self.display_recommendations()
        
        if self.generate_full_report_json():
            print("\nFull report also generated as 'question_performance_report.json'.")

if __name__ == '__main__':
    # This part is for demonstration and requires some data in the DB
    # You might want to run question_analytics.py's example usage first
    # to populate the 'question_performance.db' file.
    
    # Example of populating data for testing the dashboard
    # (This is a simplified version of what's in question_analytics.py's __main__)
    import os
    if os.path.exists('question_performance.db'):
        os.remove('question_performance.db')
        print("Cleaned up existing question_performance.db for fresh dashboard test.")
    
    qa = QuestionAnalytics()
    qa.track_question_performance({
        'question_id': 'Q001', 'question_version': '1.0', 'user_id': 'userA', 'session_id': 's1',
        'is_correct': True, 'selected_answer': 'A', 'correct_answer': 'A', 'response_time': 5.0,
        'user_difficulty_level': 'easy', 'user_feedback': 'Good question'
    })
    qa.track_question_performance({
        'question_id': 'Q001', 'question_version': '1.0', 'user_id': 'userB', 'session_id': 's1',
        'is_correct': False, 'selected_answer': 'B', 'correct_answer': 'A', 'response_time': 7.0,
        'user_difficulty_level': 'easy', 'user_feedback': 'Confusing options'
    })
    qa.track_question_performance({
        'question_id': 'Q002', 'question_version': '1.1', 'user_id': 'userA', 'session_id': 's1',
        'is_correct': True, 'selected_answer': 'C', 'correct_answer': 'C', 'response_time': 12.0,
        'user_difficulty_level': 'medium', 'user_feedback': None
    })
    qa.track_question_performance({
        'question_id': 'Q002', 'question_version': '1.1', 'user_id': 'userC', 'session_id': 's2',
        'is_correct': False, 'selected_answer': 'A', 'correct_answer': 'C', 'response_time': 15.0,
        'user_difficulty_level': 'medium', 'user_feedback': 'Distractor A is too similar'
    })
    qa.track_question_performance({
        'question_id': 'Q003', 'question_version': '1.0', 'user_id': 'userD', 'session_id': 's3',
        'is_correct': False, 'selected_answer': 'X', 'correct_answer': 'Y', 'response_time': 20.0,
        'user_difficulty_level': 'hard', 'user_feedback': 'Too hard'
    })
    qa.track_question_performance({
        'question_id': 'Q003', 'question_version': '1.0', 'user_id': 'userE', 'session_id': 's3',
        'is_correct': False, 'selected_answer': 'X', 'correct_answer': 'Y', 'response_time': 22.0,
        'user_difficulty_level': 'hard', 'user_feedback': 'Ambiguous'
    })
    qa.track_question_performance({
        'question_id': 'Q003', 'question_version': '1.0', 'user_id': 'userF', 'session_id': 's3',
        'is_correct': True, 'selected_answer': 'Y', 'correct_answer': 'Y', 'response_time': 10.0,
        'user_difficulty_level': 'hard', 'user_feedback': 'Challenging but fair'
    })

    dashboard = AnalyticsDashboard()
    dashboard.run_dashboard()

    # Clean up after example
    if os.path.exists('question_performance.db'):
        os.remove('question_performance.db')
        print("Database file removed after dashboard example.")
    if os.path.exists('question_performance_report.json'):
        os.remove('question_performance_report.json')
        print("Report JSON file removed after dashboard example.")
