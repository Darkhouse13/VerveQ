#!/usr/bin/env python3
"""
Fix difficulty value mismatch in quiz_questions table
Changes all 'medium' difficulty values to 'intermediate'
"""

import sys
import os

# Add backend directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database.connection import SessionLocal
from database.models import QuizQuestion

def fix_difficulty_values():
    """Update all 'medium' difficulty values to 'intermediate'"""
    print("🔄 Fixing difficulty value mismatch...")
    
    db = SessionLocal()
    
    try:
        # Count affected records before update
        affected = db.query(QuizQuestion).filter(
            QuizQuestion.difficulty == 'medium'
        ).count()
        
        print(f"📊 Found {affected} questions with 'medium' difficulty")
        
        if affected > 0:
            # Show breakdown by sport
            sports_breakdown = {}
            for sport in ['football', 'tennis', 'basketball']:
                count = db.query(QuizQuestion).filter(
                    QuizQuestion.sport == sport,
                    QuizQuestion.difficulty == 'medium'
                ).count()
                if count > 0:
                    sports_breakdown[sport] = count
                    print(f"  {sport}: {count} questions")
            
            # Update all medium to intermediate
            updated = db.query(QuizQuestion).filter(
                QuizQuestion.difficulty == 'medium'
            ).update({'difficulty': 'intermediate'})
            
            db.commit()
            print(f"✅ Updated {updated} questions from 'medium' to 'intermediate'")
            
            # Verify the fix
            print("\n📈 New distribution after fix:")
            for sport in ['football', 'tennis', 'basketball']:
                count = db.query(QuizQuestion).filter(
                    QuizQuestion.sport == sport,
                    QuizQuestion.difficulty == 'intermediate'
                ).count()
                print(f"  {sport}: {count} intermediate questions")
                
            # Verify no medium questions remain
            remaining_medium = db.query(QuizQuestion).filter(
                QuizQuestion.difficulty == 'medium'
            ).count()
            
            if remaining_medium == 0:
                print("✅ No 'medium' difficulty questions remain")
            else:
                print(f"⚠️  Warning: {remaining_medium} 'medium' questions still exist")
        else:
            print("✅ No questions need updating - already using correct difficulty values")
            
    except Exception as e:
        db.rollback()
        print(f"❌ Error updating difficulty values: {e}")
        return False
    finally:
        db.close()
    
    print("🎯 Fix completed! Football and tennis medium difficulty should now work.")
    return True

if __name__ == "__main__":
    success = fix_difficulty_values()
    if success:
        print("\n🧪 Test the fix:")
        print("  curl http://localhost:8000/football/quiz/question?difficulty=intermediate")
        print("  curl http://localhost:8000/tennis/quiz/question?difficulty=intermediate")
    sys.exit(0 if success else 1)