#!/usr/bin/env python3
"""
Question Export Script for VerveQ Platform
Exports all quiz questions to CSV format for manual quality review
"""

import csv
import json
import sqlite3
import sys
import os
from datetime import datetime
from pathlib import Path

# Add backend directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

def export_questions_to_csv(output_file: str = None):
    """Export all quiz questions to CSV format"""
    
    # Default output file
    if not output_file:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        output_file = f"quiz_questions_export_{timestamp}.csv"
    
    # Database connection
    db_path = "verveq_platform.db"
    if not os.path.exists(db_path):
        print(f"❌ Database not found: {db_path}")
        print("   Make sure you're running this script from the backend directory")
        return False
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Get all questions with their data
        cursor.execute("""
            SELECT 
                id,
                sport,
                category,
                difficulty,
                question,
                options,
                correct_answer,
                explanation,
                times_answered,
                times_correct,
                usage_count,
                difficulty_votes,
                difficulty_score,
                created_at
            FROM quiz_questions
            ORDER BY sport, category, difficulty, question
        """)
        
        questions = cursor.fetchall()
        
        if not questions:
            print("❌ No questions found in database")
            return False
        
        # Write to CSV
        with open(output_file, 'w', newline='', encoding='utf-8') as csvfile:
            writer = csv.writer(csvfile)
            
            # Header row
            headers = [
                'ID',
                'Sport',
                'Category', 
                'Difficulty',
                'Question',
                'Option_1',
                'Option_2', 
                'Option_3',
                'Option_4',
                'Correct_Answer',
                'Explanation',
                'Times_Answered',
                'Times_Correct',
                'Accuracy_Rate',
                'Usage_Count',
                'Difficulty_Votes',
                'Difficulty_Score',
                'Quality_Issues',  # Empty column for manual notes
                'Review_Status',   # Empty column for manual tracking
                'Created_At'
            ]
            writer.writerow(headers)
            
            # Data rows
            for q in questions:
                (q_id, sport, category, difficulty, question_text, options_json, 
                 correct_answer, explanation, times_answered, times_correct, 
                 usage_count, difficulty_votes, difficulty_score, created_at) = q
                
                # Parse options
                try:
                    options = json.loads(options_json) if options_json else []
                except json.JSONDecodeError:
                    options = []
                
                # Ensure we have 4 options (pad with empty strings if needed)
                while len(options) < 4:
                    options.append("")
                
                # Calculate accuracy rate
                accuracy_rate = ""
                if times_answered and times_answered > 0:
                    accuracy_rate = f"{(times_correct / times_answered * 100):.1f}%"
                
                # Format difficulty score
                diff_score_formatted = ""
                if difficulty_score is not None:
                    diff_score_formatted = f"{difficulty_score:.2f}"
                
                row = [
                    q_id,
                    sport,
                    category,
                    difficulty,
                    question_text,
                    options[0] if len(options) > 0 else "",
                    options[1] if len(options) > 1 else "",
                    options[2] if len(options) > 2 else "",
                    options[3] if len(options) > 3 else "",
                    correct_answer,
                    explanation or "",
                    times_answered or 0,
                    times_correct or 0,
                    accuracy_rate,
                    usage_count or 0,
                    difficulty_votes or 0,
                    diff_score_formatted,
                    "",  # Quality_Issues - empty for manual notes
                    "",  # Review_Status - empty for manual tracking  
                    created_at or ""
                ]
                
                writer.writerow(row)
        
        conn.close()
        
        print(f"✅ Successfully exported {len(questions)} questions to: {output_file}")
        print(f"📊 Breakdown by sport:")
        
        # Show breakdown
        sport_counts = {}
        for q in questions:
            sport = q[1]
            sport_counts[sport] = sport_counts.get(sport, 0) + 1
        
        for sport, count in sorted(sport_counts.items()):
            print(f"   {sport.capitalize()}: {count} questions")
        
        print(f"\n📝 You can now open {output_file} in Excel/Google Sheets to review questions")
        print("💡 Use the 'Quality_Issues' and 'Review_Status' columns to track your review progress")
        
        return True
        
    except Exception as e:
        print(f"❌ Error exporting questions: {e}")
        import traceback
        traceback.print_exc()
        return False

def show_stats():
    """Show basic statistics about the questions"""
    db_path = "verveq_platform.db"
    if not os.path.exists(db_path):
        print(f"❌ Database not found: {db_path}")
        return
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Total questions
        cursor.execute("SELECT COUNT(*) FROM quiz_questions")
        total = cursor.fetchone()[0]
        print(f"📊 Total questions: {total}")
        
        # By sport
        cursor.execute("SELECT sport, COUNT(*) FROM quiz_questions GROUP BY sport ORDER BY COUNT(*) DESC")
        sports = cursor.fetchall()
        print("\nBy sport:")
        for sport, count in sports:
            print(f"  {sport.capitalize()}: {count}")
        
        # By difficulty 
        cursor.execute("SELECT difficulty, COUNT(*) FROM quiz_questions GROUP BY difficulty ORDER BY COUNT(*) DESC")
        difficulties = cursor.fetchall()
        print("\nBy difficulty:")
        for difficulty, count in difficulties:
            print(f"  {difficulty.capitalize()}: {count}")
        
        # Questions without explanations
        cursor.execute("SELECT COUNT(*) FROM quiz_questions WHERE explanation IS NULL OR explanation = ''")
        no_explanation = cursor.fetchone()[0]
        print(f"\nQuestions without explanations: {no_explanation} ({no_explanation/total*100:.1f}%)")
        
        # Usage statistics
        cursor.execute("SELECT AVG(usage_count), MAX(usage_count), MIN(usage_count) FROM quiz_questions")
        avg_usage, max_usage, min_usage = cursor.fetchone()
        print(f"\nUsage statistics:")
        print(f"  Average usage: {avg_usage:.1f}")
        print(f"  Max usage: {max_usage}")
        print(f"  Min usage: {min_usage}")
        
        conn.close()
        
    except Exception as e:
        print(f"❌ Error getting stats: {e}")

if __name__ == "__main__":
    print("🔍 VerveQ Question Export Tool")
    print("=" * 40)
    
    if len(sys.argv) > 1:
        if sys.argv[1] == "stats":
            show_stats()
        elif sys.argv[1] == "help":
            print("Usage:")
            print("  python export_questions.py           # Export all questions to CSV")
            print("  python export_questions.py stats     # Show question statistics")
            print("  python export_questions.py help      # Show this help")
        else:
            # Custom output filename
            export_questions_to_csv(sys.argv[1])
    else:
        # Default export
        export_questions_to_csv()