import json
from collections import defaultdict
import time

class UserPerformanceTracker:
    def __init__(self, user_id):
        self.user_id = user_id
        self.performance_data = {
            "history": [],
            "by_difficulty": defaultdict(lambda: {"correct": 0, "total": 0}),
            "by_category": defaultdict(lambda: {"correct": 0, "total": 0}),
            "last_seen": {}
        }

    def track_response(self, question_id, category, difficulty_score, is_correct):
        timestamp = time.time()
        self.performance_data["history"].append({
            "question_id": question_id,
            "category": category,
            "difficulty_score": difficulty_score,
            "is_correct": is_correct,
            "timestamp": timestamp
        })
        
        difficulty_level = self._get_difficulty_level(difficulty_score)
        
        self.performance_data["by_difficulty"][difficulty_level]["correct"] += 1 if is_correct else 0
        self.performance_data["by_difficulty"][difficulty_level]["total"] += 1
        
        self.performance_data["by_category"][category]["correct"] += 1 if is_correct else 0
        self.performance_data["by_category"][category]["total"] += 1
        
        self.performance_data["last_seen"][question_id] = timestamp

    def get_success_rate(self, level=None, category=None):
        if level:
            data = self.performance_data["by_difficulty"][level]
            return data["correct"] / data["total"] if data["total"] > 0 else 0.5
        if category:
            data = self.performance_data["by_category"][category]
            return data["correct"] / data["total"] if data["total"] > 0 else 0.5
        
        total_correct = sum(item['is_correct'] for item in self.performance_data["history"])
        total_questions = len(self.performance_data["history"])
        return total_correct / total_questions if total_questions > 0 else 0.5

    def get_recent_performance(self, last_n=10):
        recent_history = self.performance_data["history"][-last_n:]
        if not recent_history:
            return 0.5
        
        total_correct = sum(item['is_correct'] for item in recent_history)
        return total_correct / len(recent_history)

    def get_familiarity(self, category):
        # A simple measure of familiarity based on exposure and success
        category_data = self.performance_data["by_category"][category]
        if category_data["total"] == 0:
            return 0.0
        
        success_rate = category_data["correct"] / category_data["total"]
        exposure = min(category_data["total"] / 10, 1.0) # Cap exposure effect
        
        return (success_rate * 0.7) + (exposure * 0.3)

    def _get_difficulty_level(self, score):
        if score < 0.3:
            return "beginner"
        elif score < 0.7:
            return "intermediate"
        else:
            return "advanced"

    def save(self, file_path):
        with open(file_path, 'w') as f:
            json.dump(self.performance_data, f)

    @classmethod
    def load(cls, user_id, file_path):
        tracker = cls(user_id)
        try:
            with open(file_path, 'r') as f:
                tracker.performance_data = json.load(f)
                # Ensure defaultdicts are correctly initialized
                tracker.performance_data['by_difficulty'] = defaultdict(lambda: {"correct": 0, "total": 0}, tracker.performance_data.get('by_difficulty', {}))
                tracker.performance_data['by_category'] = defaultdict(lambda: {"correct": 0, "total": 0}, tracker.performance_data.get('by_category', {}))
        except FileNotFoundError:
            pass # Return a new tracker
        return tracker
