#!/usr/bin/env python3
"""
Migration 003: Add requirement_type and requirement_value columns to achievements table
"""

import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database.connection import engine, DATABASE_URL
from sqlalchemy import text


def column_exists(conn, table, column):
    if "sqlite" in DATABASE_URL:
        result = conn.execute(text(f"PRAGMA table_info({table})"))
        return any(row[1] == column for row in result)
    else:
        result = conn.execute(text(
            f"SELECT 1 FROM information_schema.columns WHERE table_name='{table}' AND column_name='{column}'"
        ))
        return result.fetchone() is not None


def run_migration():
    print("Running Migration 003: Add achievement columns...")

    try:
        with engine.connect() as conn:
            if not column_exists(conn, "achievements", "requirement_type"):
                conn.execute(text("ALTER TABLE achievements ADD COLUMN requirement_type VARCHAR(100)"))
                print("  Added requirement_type column")
            else:
                print("  requirement_type column already exists")

            if not column_exists(conn, "achievements", "requirement_value"):
                conn.execute(text("ALTER TABLE achievements ADD COLUMN requirement_value INTEGER"))
                print("  Added requirement_value column")
            else:
                print("  requirement_value column already exists")

            conn.commit()

        print("Migration 003 completed successfully!")

    except Exception as e:
        print(f"Migration 003 failed: {e}")
        return False

    return True


if __name__ == "__main__":
    run_migration()
