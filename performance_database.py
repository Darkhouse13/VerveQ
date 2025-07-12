import sqlite3
import json
import os

class PerformanceDatabase:
    def __init__(self, db_path='question_performance.db', schema_path='performance_schema.sql'):
        self.db_path = db_path
        self.schema_path = schema_path
        self._initialize_db()

    def _initialize_db(self):
        """Initializes the database by creating tables if they don't exist."""
        conn = None
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            with open(self.schema_path, 'r') as f:
                schema_sql = f.read()
            cursor.executescript(schema_sql)
            conn.commit()
            print(f"Database initialized at {self.db_path}")
        except sqlite3.Error as e:
            print(f"Error initializing database: {e}")
        finally:
            if conn:
                conn.close()

    def insert_performance_data(self, data: dict):
        """
        Inserts a single record of question performance data into the database.
        Data should be a dictionary matching the schema.
        """
        conn = None
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO question_performance (
                    question_id, question_version, user_id, session_id,
                    is_correct, selected_answer, correct_answer, response_time,
                    user_difficulty_level, user_feedback
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                data.get('question_id'),
                data.get('question_version'),
                data.get('user_id'),
                data.get('session_id'),
                data.get('is_correct'),
                data.get('selected_answer'),
                data.get('correct_answer'),
                data.get('response_time'),
                data.get('user_difficulty_level'),
                data.get('user_feedback')
            ))
            conn.commit()
            return True
        except sqlite3.Error as e:
            print(f"Error inserting performance data: {e}")
            return False
        finally:
            if conn:
                conn.close()

    def fetch_performance_data(self, query: str = "SELECT * FROM question_performance", params: tuple = ()):
        """
        Fetches data from the question_performance table based on a custom query.
        """
        conn = None
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            cursor.execute(query, params)
            rows = cursor.fetchall()
            columns = [description[0] for description in cursor.description]
            return [dict(zip(columns, row)) for row in rows]
        except sqlite3.Error as e:
            print(f"Error fetching performance data: {e}")
            return []
        finally:
            if conn:
                conn.close()

    def export_data_to_json(self, filename='question_performance_export.json'):
        """Exports all performance data to a JSON file."""
        data = self.fetch_performance_data()
        try:
            with open(filename, 'w') as f:
                json.dump(data, f, indent=4)
            print(f"Data exported to {filename}")
            return True
        except IOError as e:
            print(f"Error exporting data to JSON: {e}")
            return False

    def close(self):
        """No explicit close needed for SQLite connections opened and closed per operation."""
        pass

if __name__ == '__main__':
    # Example Usage:
    db = PerformanceDatabase()

    # Insert some dummy data
    dummy_data = {
        'question_id': 'Q001',
        'question_version': '1.0',
        'user_id': 'user123',
        'session_id': 'sess456',
        'is_correct': True,
        'selected_answer': 'A',
        'correct_answer': 'A',
        'response_time': 5.2,
        'user_difficulty_level': 'easy',
        'user_feedback': 'Clear question'
    }
    db.insert_performance_data(dummy_data)

    dummy_data_2 = {
        'question_id': 'Q002',
        'question_version': '1.1',
        'user_id': 'user124',
        'session_id': 'sess457',
        'is_correct': False,
        'selected_answer': 'C',
        'correct_answer': 'B',
        'response_time': 10.5,
        'user_difficulty_level': 'medium',
        'user_feedback': 'Confusing options'
    }
    db.insert_performance_data(dummy_data_2)

    # Fetch all data
    all_data = db.fetch_performance_data()
    print("\nAll Performance Data:")
    for row in all_data:
        print(row)

    # Fetch data for a specific question
    q001_data = db.fetch_performance_data("SELECT * FROM question_performance WHERE question_id = ?", ('Q001',))
    print("\nData for Q001:")
    for row in q001_data:
        print(row)

    # Export data
    db.export_data_to_json()

    # Clean up (optional, for testing purposes)
    # if os.path.exists('question_performance.db'):
    #     os.remove('question_performance.db')
    #     print("Database file removed.")
