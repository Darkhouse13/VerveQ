CREATE TABLE IF NOT EXISTS question_performance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    question_id TEXT NOT NULL,
    question_version TEXT,
    user_id TEXT,
    session_id TEXT,
    is_correct BOOLEAN NOT NULL,
    selected_answer TEXT,
    correct_answer TEXT,
    response_time REAL,
    user_difficulty_level TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    user_feedback TEXT
);

CREATE INDEX IF NOT EXISTS idx_question_id ON question_performance (question_id);
CREATE INDEX IF NOT EXISTS idx_user_id ON question_performance (user_id);
CREATE INDEX IF NOT EXISTS idx_session_id ON question_performance (session_id);
CREATE INDEX IF NOT EXISTS idx_timestamp ON question_performance (timestamp);
