import pandas as pd
from performance_database import PerformanceDatabase
import logging
import os

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class QuestionAnalytics:
    def __init__(self, db_path='question_performance.db'):
        self.db = PerformanceDatabase(db_path=db_path)

    def track_question_performance(self, data: dict) -> bool:
        """
        Records user responses and metrics for a question.
        Args:
            data (dict): Dictionary containing question performance data.
                         Expected keys: question_id, question_version, user_id, session_id,
                         is_correct, selected_answer, correct_answer, response_time,
                         user_difficulty_level, user_feedback (optional).
        Returns:
            bool: True if data was successfully tracked, False otherwise.
        """
        required_keys = [
            'question_id', 'question_version', 'user_id', 'session_id',
            'is_correct', 'selected_answer', 'correct_answer', 'response_time',
            'user_difficulty_level'
        ]
        if not all(key in data for key in required_keys):
            logger.error(f"Missing required keys for tracking: {required_keys}. Provided: {data.keys()}")
            return False
        
        return self.db.insert_performance_data(data)

    def calculate_question_metrics(self, question_id: str = None) -> pd.DataFrame:
        """
        Computes performance statistics for questions.
        Args:
            question_id (str, optional): If provided, calculates metrics for a specific question.
                                         Otherwise, calculates for all questions.
        Returns:
            pd.DataFrame: DataFrame with calculated metrics (success rate, avg response time, etc.).
        """
        if question_id:
            query = "SELECT * FROM question_performance WHERE question_id = ?"
            data = self.db.fetch_performance_data(query, (question_id,))
        else:
            data = self.db.fetch_performance_data()

        if not data:
            logger.info("No data available to calculate metrics.")
            return pd.DataFrame()

        df = pd.DataFrame(data)
        
        # Ensure 'is_correct' is boolean for calculations
        df['is_correct'] = df['is_correct'].astype(bool)

        metrics = df.groupby('question_id').agg(
            total_responses=('id', 'count'),
            correct_responses=('is_correct', 'sum'),
            avg_response_time=('response_time', 'mean'),
            min_response_time=('response_time', 'min'),
            max_response_time=('response_time', 'max'),
            avg_difficulty_level=('user_difficulty_level', lambda x: x.mode()[0] if not x.empty else None) # Mode for categorical
        ).reset_index()

        metrics['success_rate'] = (metrics['correct_responses'] / metrics['total_responses']) * 100

        # Distractor effectiveness (example - needs more sophisticated logic for multiple choice)
        # This is a simplified example, a real implementation would need to parse options and track each distractor
        distractor_analysis = df[~df['is_correct']].groupby(['question_id', 'selected_answer']).agg(
            distractor_count=('id', 'count')
        ).reset_index()
        
        # Pivot to get distractors as columns or process further
        # For simplicity, we'll just add a column indicating if there are common wrong answers
        metrics['most_chosen_wrong_answer'] = None
        for q_id in metrics['question_id'].unique():
            q_distractors = distractor_analysis[distractor_analysis['question_id'] == q_id]
            if not q_distractors.empty:
                # Exclude correct answer from distractor analysis
                correct_ans = df[df['question_id'] == q_id]['correct_answer'].iloc[0]
                q_distractors = q_distractors[q_distractors['selected_answer'] != correct_ans]
                if not q_distractors.empty:
                    most_chosen = q_distractors.loc[q_distractors['distractor_count'].idxmax()]
                    metrics.loc[metrics['question_id'] == q_id, 'most_chosen_wrong_answer'] = most_chosen['selected_answer']

        return metrics

    def identify_problematic_questions(self, success_rate_threshold: float = 60.0, response_time_std_dev_threshold: float = 2.0) -> pd.DataFrame:
        """
        Flags questions that might need review based on performance metrics.
        Args:
            success_rate_threshold (float): Questions below this success rate are flagged.
            response_time_std_dev_threshold (float): Questions with response time std dev above this are flagged.
        Returns:
            pd.DataFrame: DataFrame of flagged questions with reasons.
        """
        metrics = self.calculate_question_metrics()
        if metrics.empty:
            return pd.DataFrame()

        problematic_questions = []

        # Flag by low success rate
        low_success_rate_q = metrics[metrics['success_rate'] < success_rate_threshold]
        for _, row in low_success_rate_q.iterrows():
            problematic_questions.append({
                'question_id': row['question_id'],
                'reason': f"Low success rate ({row['success_rate']:.2f}%)",
                'metric_value': row['success_rate']
            })

        # Flag by high response time variability (indicates confusion or ambiguity)
        # Calculate std dev of response times for each question
        df_raw = pd.DataFrame(self.db.fetch_performance_data())
        if not df_raw.empty:
            response_time_std = df_raw.groupby('question_id')['response_time'].std().reset_index()
            response_time_std.rename(columns={'response_time': 'std_dev_response_time'}, inplace=True)
            
            # Filter for questions with high std dev
            high_std_dev_q = response_time_std[response_time_std['std_dev_response_time'] > response_time_std_dev_threshold]
            for _, row in high_std_dev_q.iterrows():
                # Avoid duplicate entries if already flagged by success rate
                if not any(pq['question_id'] == row['question_id'] and "response time variability" in pq['reason'] for pq in problematic_questions):
                    problematic_questions.append({
                        'question_id': row['question_id'],
                        'reason': f"High response time variability (std dev: {row['std_dev_response_time']:.2f})",
                        'metric_value': row['std_dev_response_time']
                    })

        return pd.DataFrame(problematic_questions)

    def optimize_question_pool(self) -> dict:
        """
        Recommends question improvements based on analytics.
        Returns:
            dict: Recommendations for question improvements.
        """
        problematic_q = self.identify_problematic_questions()
        metrics = self.calculate_question_metrics()
        
        recommendations = {
            "general_insights": [],
            "question_specific_recommendations": {}
        }

        if problematic_q.empty and metrics.empty:
            recommendations["general_insights"].append("No performance data or problematic questions found. All questions seem to be performing well.")
            return recommendations

        if not problematic_q.empty:
            recommendations["general_insights"].append("Identified questions needing review based on low success rates or high response time variability.")
            
            # Group problematic questions by question_id to aggregate all reasons for each question
            grouped_problematic = problematic_q.groupby('question_id')

            for q_id, group in grouped_problematic:
                rec_list = []
                q_metrics = metrics[metrics['question_id'] == q_id].iloc[0] if not metrics[metrics['question_id'] == q_id].empty else None

                # Add all reasons for this question
                for _, reason_row in group.iterrows():
                    rec_list.append(f"Reason: {reason_row['reason']}")
                
                if q_metrics is not None:
                    rec_list.append(f"  - Success Rate: {q_metrics['success_rate']:.2f}%")
                    rec_list.append(f"  - Avg Response Time: {q_metrics['avg_response_time']:.2f}s")
                    if pd.notna(q_metrics['most_chosen_wrong_answer']):
                        rec_list.append(f"  - Most chosen wrong answer: '{q_metrics['most_chosen_wrong_answer']}' - Consider revising distractors or question clarity.")
                    
                    # Add general suggestions based on the reasons
                    if any("Low success rate" in r for r in rec_list):
                        rec_list.append("  - Suggestion: Review question clarity, options, or consider adjusting difficulty.")
                    if any("High response time variability" in r for r in rec_list):
                        rec_list.append("  - Suggestion: Question might be ambiguous or too complex. Simplify wording or provide clearer context.")
                
                recommendations["question_specific_recommendations"][q_id] = rec_list
        else:
            recommendations["general_insights"].append("No problematic questions identified. All questions are performing above thresholds.")

        # General recommendations based on overall trends
        if not metrics.empty:
            overall_avg_success_rate = metrics['success_rate'].mean()
            overall_avg_response_time = metrics['avg_response_time'].mean()
            recommendations["general_insights"].append(f"Overall Average Success Rate: {overall_avg_success_rate:.2f}%")
            recommendations["general_insights"].append(f"Overall Average Response Time: {overall_avg_response_time:.2f}s")

            if overall_avg_success_rate < 70: # Example threshold
                recommendations["general_insights"].append("Consider a general review of question difficulty or clarity across the board.")
            if overall_avg_response_time > 15: # Example threshold
                recommendations["general_insights"].append("Questions might be too long or require excessive thought. Review average question length/complexity.")

        return recommendations

    def generate_performance_report(self) -> dict:
        """
        Creates a detailed analytics report.
        Returns:
            dict: A dictionary containing various sections of the performance report.
        """
        metrics = self.calculate_question_metrics()
        problematic_q = self.identify_problematic_questions()
        recommendations = self.optimize_question_pool()

        report = {
            "report_summary": "Comprehensive Question Performance Report",
            "total_questions_tracked": len(metrics) if not metrics.empty else 0,
            "overall_metrics": {},
            "question_level_metrics": metrics.to_dict(orient='records') if not metrics.empty else [],
            "problematic_questions_identified": problematic_q.to_dict(orient='records') if not problematic_q.empty else [],
            "recommendations_for_improvement": recommendations,
            "raw_data_export_status": "Not exported yet. Call export_data_to_json() if needed."
        }

        if not metrics.empty:
            report["overall_metrics"] = {
                "average_success_rate": metrics['success_rate'].mean(),
                "average_response_time": metrics['avg_response_time'].mean(),
                "total_responses_recorded": metrics['total_responses'].sum()
            }
        
        return report

if __name__ == '__main__':
    # Example Usage
    analytics = QuestionAnalytics()

    # Clean up previous test data if exists
    if os.path.exists('question_performance.db'):
        os.remove('question_performance.db')
        print("Cleaned up existing question_performance.db for fresh test.")
    
    # Re-initialize DB after cleanup
    analytics = QuestionAnalytics()

    # 1. Track some performance data
    print("\n--- Tracking Performance Data ---")
    analytics.track_question_performance({
        'question_id': 'Q001', 'question_version': '1.0', 'user_id': 'userA', 'session_id': 's1',
        'is_correct': True, 'selected_answer': 'A', 'correct_answer': 'A', 'response_time': 5.0,
        'user_difficulty_level': 'easy', 'user_feedback': 'Good question'
    })
    analytics.track_question_performance({
        'question_id': 'Q001', 'question_version': '1.0', 'user_id': 'userB', 'session_id': 's1',
        'is_correct': False, 'selected_answer': 'B', 'correct_answer': 'A', 'response_time': 7.0,
        'user_difficulty_level': 'easy', 'user_feedback': 'Confusing options'
    })
    analytics.track_question_performance({
        'question_id': 'Q002', 'question_version': '1.1', 'user_id': 'userA', 'session_id': 's1',
        'is_correct': True, 'selected_answer': 'C', 'correct_answer': 'C', 'response_time': 12.0,
        'user_difficulty_level': 'medium', 'user_feedback': None
    })
    analytics.track_question_performance({
        'question_id': 'Q002', 'question_version': '1.1', 'user_id': 'userC', 'session_id': 's2',
        'is_correct': False, 'selected_answer': 'A', 'correct_answer': 'C', 'response_time': 15.0,
        'user_difficulty_level': 'medium', 'user_feedback': 'Distractor A is too similar'
    })
    analytics.track_question_performance({
        'question_id': 'Q003', 'question_version': '1.0', 'user_id': 'userD', 'session_id': 's3',
        'is_correct': False, 'selected_answer': 'X', 'correct_answer': 'Y', 'response_time': 20.0,
        'user_difficulty_level': 'hard', 'user_feedback': 'Too hard'
    })
    analytics.track_question_performance({
        'question_id': 'Q003', 'question_version': '1.0', 'user_id': 'userE', 'session_id': 's3',
        'is_correct': False, 'selected_answer': 'X', 'correct_answer': 'Y', 'response_time': 22.0,
        'user_difficulty_level': 'hard', 'user_feedback': 'Ambiguous'
    })
    analytics.track_question_performance({
        'question_id': 'Q003', 'question_version': '1.0', 'user_id': 'userF', 'session_id': 's3',
        'is_correct': True, 'selected_answer': 'Y', 'correct_answer': 'Y', 'response_time': 10.0,
        'user_difficulty_level': 'hard', 'user_feedback': 'Challenging but fair'
    })

    # 2. Calculate metrics
    print("\n--- Calculated Question Metrics ---")
    metrics_df = analytics.calculate_question_metrics()
    print(metrics_df.to_string())

    # 3. Identify problematic questions
    print("\n--- Problematic Questions ---")
    problematic_df = analytics.identify_problematic_questions(success_rate_threshold=60.0, response_time_std_dev_threshold=1.0)
    print(problematic_df.to_string())

    # 4. Optimize question pool
    print("\n--- Optimization Recommendations ---")
    recommendations = analytics.optimize_question_pool()
    for insight in recommendations["general_insights"]:
        print(insight)
    for q_id, recs in recommendations["question_specific_recommendations"].items():
        print(f"\nRecommendations for {q_id}:")
        for rec in recs:
            print(rec)

    # 5. Generate full report
    print("\n--- Full Performance Report ---")
    report = analytics.generate_performance_report()
    import json
    print(json.dumps(report, indent=4))

    # Export raw data
    analytics.db.export_data_to_json('question_performance_export_example.json')
    print("\nRaw data exported to question_performance_export_example.json")

    # Clean up (optional)
    if os.path.exists('question_performance.db'):
        os.remove('question_performance.db')
        print("Database file removed after example run.")
    if os.path.exists('question_performance_export_example.json'):
        os.remove('question_performance_export_example.json')
        print("Exported JSON file removed after example run.")
