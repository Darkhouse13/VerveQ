-- FootQuizz PostgreSQL Database Schema
-- This script creates the complete database schema for migrating from JSON to PostgreSQL
-- Run this script on a fresh PostgreSQL database

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- CORE TABLES
-- ============================================================================

-- Sports table
CREATE TABLE sports (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Competitions table
CREATE TABLE competitions (
    id SERIAL PRIMARY KEY,
    sport_id INTEGER REFERENCES sports(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    display_name VARCHAR(200) NOT NULL,
    competition_type VARCHAR(50) NOT NULL CHECK (competition_type IN ('award', 'player_stats', 'squad_stats', 'tournament')),
    data_source VARCHAR(200), -- original JSON file name for reference
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(sport_id, name)
);

-- Teams/Squads table
CREATE TABLE teams (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    display_name VARCHAR(200),
    sport_id INTEGER REFERENCES sports(id) ON DELETE CASCADE,
    country VARCHAR(3), -- ISO 3166-1 alpha-3 country code
    founded_year INTEGER,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(sport_id, name)
);

-- Players table
CREATE TABLE players (
    id SERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    normalized_name VARCHAR(200) NOT NULL, -- for fuzzy matching and search
    sport_id INTEGER REFERENCES sports(id) ON DELETE CASCADE,
    nationality VARCHAR(3), -- ISO 3166-1 alpha-3 country code
    birth_date DATE,
    positions TEXT[], -- array of positions (e.g., ['FW', 'MF'])
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Player-Team relationships (many-to-many with time periods)
CREATE TABLE player_teams (
    id SERIAL PRIMARY KEY,
    player_id INTEGER REFERENCES players(id) ON DELETE CASCADE,
    team_id INTEGER REFERENCES teams(id) ON DELETE CASCADE,
    season VARCHAR(20),
    start_date DATE,
    end_date DATE,
    is_current BOOLEAN DEFAULT FALSE,
    jersey_number INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- AWARDS AND ACHIEVEMENTS
-- ============================================================================

-- Award types table
CREATE TABLE award_types (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    display_name VARCHAR(200) NOT NULL,
    sport_id INTEGER REFERENCES sports(id) ON DELETE CASCADE,
    competition_id INTEGER REFERENCES competitions(id) ON DELETE SET NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(sport_id, name)
);

-- Player awards table
CREATE TABLE player_awards (
    id SERIAL PRIMARY KEY,
    player_id INTEGER REFERENCES players(id) ON DELETE CASCADE,
    award_type_id INTEGER REFERENCES award_types(id) ON DELETE CASCADE,
    season VARCHAR(20) NOT NULL,
    team_id INTEGER REFERENCES teams(id) ON DELETE SET NULL, -- team at time of award
    age INTEGER,
    additional_data JSONB, -- flexible storage for award-specific data
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- STATISTICS SYSTEM
-- ============================================================================

-- Statistic type definitions
CREATE TABLE statistic_types (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    display_name VARCHAR(200) NOT NULL,
    sport_id INTEGER REFERENCES sports(id) ON DELETE CASCADE,
    category VARCHAR(50), -- 'offensive', 'defensive', 'general', 'goalkeeping', etc.
    data_type VARCHAR(20) DEFAULT 'numeric' CHECK (data_type IN ('numeric', 'percentage', 'text', 'boolean')),
    unit VARCHAR(20), -- 'goals', 'minutes', '%', 'km', etc.
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(sport_id, name)
);

-- Player statistics
CREATE TABLE player_statistics (
    id SERIAL PRIMARY KEY,
    player_id INTEGER REFERENCES players(id) ON DELETE CASCADE,
    statistic_type_id INTEGER REFERENCES statistic_types(id) ON DELETE CASCADE,
    team_id INTEGER REFERENCES teams(id) ON DELETE SET NULL,
    season VARCHAR(20),
    competition_id INTEGER REFERENCES competitions(id) ON DELETE SET NULL,
    numeric_value DECIMAL(12,4),
    text_value VARCHAR(100),
    boolean_value BOOLEAN,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    -- Ensure only one type of value is set
    CHECK (
        (numeric_value IS NOT NULL AND text_value IS NULL AND boolean_value IS NULL) OR
        (numeric_value IS NULL AND text_value IS NOT NULL AND boolean_value IS NULL) OR
        (numeric_value IS NULL AND text_value IS NULL AND boolean_value IS NOT NULL)
    )
);

-- Team/Squad statistics
CREATE TABLE team_statistics (
    id SERIAL PRIMARY KEY,
    team_id INTEGER REFERENCES teams(id) ON DELETE CASCADE,
    statistic_type_id INTEGER REFERENCES statistic_types(id) ON DELETE CASCADE,
    season VARCHAR(20),
    competition_id INTEGER REFERENCES competitions(id) ON DELETE SET NULL,
    numeric_value DECIMAL(12,4),
    text_value VARCHAR(100),
    boolean_value BOOLEAN,
    additional_data JSONB, -- for complex statistics with multiple components
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    -- Ensure only one type of value is set
    CHECK (
        (numeric_value IS NOT NULL AND text_value IS NULL AND boolean_value IS NULL) OR
        (numeric_value IS NULL AND text_value IS NOT NULL AND boolean_value IS NULL) OR
        (numeric_value IS NULL AND text_value IS NULL AND boolean_value IS NOT NULL)
    )
);

-- ============================================================================
-- TOURNAMENT SYSTEM (TENNIS)
-- ============================================================================

-- Tournaments table
CREATE TABLE tournaments (
    id SERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    year INTEGER NOT NULL,
    sport_id INTEGER REFERENCES sports(id) ON DELETE CASCADE,
    surface VARCHAR(50), -- 'Hard', 'Clay', 'Grass', 'Carpet', etc.
    level VARCHAR(10), -- 'A', 'M', 'G' (Grand Slam), 'F' (Finals), etc.
    draw_size INTEGER,
    location VARCHAR(200),
    country VARCHAR(3), -- ISO 3166-1 alpha-3 country code
    start_date DATE,
    end_date DATE,
    prize_money DECIMAL(12,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(name, year, sport_id)
);

-- Tournament results
CREATE TABLE tournament_results (
    id SERIAL PRIMARY KEY,
    tournament_id INTEGER REFERENCES tournaments(id) ON DELETE CASCADE,
    champion_id INTEGER REFERENCES players(id) ON DELETE CASCADE,
    runner_up_id INTEGER REFERENCES players(id) ON DELETE CASCADE,
    final_score VARCHAR(100),
    match_duration INTEGER, -- in minutes
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- SURVIVAL MODE AND GAMING
-- ============================================================================

-- Survival game players (extends existing players with game-specific data)
CREATE TABLE survival_players (
    id SERIAL PRIMARY KEY,
    player_id INTEGER REFERENCES players(id) ON DELETE CASCADE,
    initials VARCHAR(10) NOT NULL,
    current_elo INTEGER DEFAULT 1200,
    games_played INTEGER DEFAULT 0,
    games_won INTEGER DEFAULT 0,
    games_lost INTEGER DEFAULT 0,
    longest_streak INTEGER DEFAULT 0,
    current_streak INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(player_id)
);

-- Survival matches
CREATE TABLE survival_matches (
    id SERIAL PRIMARY KEY,
    player1_id INTEGER REFERENCES survival_players(id) ON DELETE CASCADE,
    player2_id INTEGER REFERENCES survival_players(id) ON DELETE CASCADE,
    winner_id INTEGER REFERENCES survival_players(id) ON DELETE SET NULL,
    rounds_played INTEGER NOT NULL DEFAULT 0,
    match_duration INTEGER, -- in seconds
    session_id VARCHAR(100),
    match_type VARCHAR(50) DEFAULT 'standard', -- 'standard', 'tournament', 'practice'
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Elo rating history
CREATE TABLE elo_history (
    id SERIAL PRIMARY KEY,
    player_id INTEGER REFERENCES survival_players(id) ON DELETE CASCADE,
    match_id INTEGER REFERENCES survival_matches(id) ON DELETE CASCADE,
    old_elo INTEGER NOT NULL,
    new_elo INTEGER NOT NULL,
    elo_change INTEGER NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- QUESTION AND PERFORMANCE TRACKING
-- ============================================================================

-- Question difficulty feedback (migrated from existing SQLite)
CREATE TABLE question_difficulty_feedback (
    id SERIAL PRIMARY KEY,
    question_id VARCHAR(100) NOT NULL,
    question_text TEXT NOT NULL,
    answer TEXT,
    original_difficulty DECIMAL(5,3) NOT NULL,
    user_feedback VARCHAR(20) CHECK(user_feedback IN ('too_easy', 'just_right', 'too_hard')),
    admin_override DECIMAL(5,3),
    difficulty_category VARCHAR(50),
    user_id VARCHAR(100),
    quiz_mode VARCHAR(50),
    user_performance_context TEXT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Admin difficulty adjustments
CREATE TABLE admin_difficulty_adjustments (
    id SERIAL PRIMARY KEY,
    question_id VARCHAR(100) NOT NULL,
    old_difficulty DECIMAL(5,3) NOT NULL,
    new_difficulty DECIMAL(5,3) NOT NULL,
    new_category VARCHAR(50),
    admin_user VARCHAR(100) NOT NULL,
    reason TEXT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Question performance tracking
CREATE TABLE question_performance (
    id SERIAL PRIMARY KEY,
    question_id VARCHAR(100) NOT NULL,
    question_version VARCHAR(20),
    user_id VARCHAR(100),
    session_id VARCHAR(100),
    is_correct BOOLEAN NOT NULL,
    selected_answer TEXT,
    correct_answer TEXT,
    response_time DECIMAL(8,3), -- in seconds
    user_difficulty_level VARCHAR(50),
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    user_feedback TEXT
);

-- ============================================================================
-- PERFORMANCE INDEXES
-- ============================================================================

-- Primary lookup indexes
CREATE INDEX idx_players_normalized_name ON players(normalized_name);
CREATE INDEX idx_players_sport ON players(sport_id);
CREATE INDEX idx_players_nationality ON players(nationality);
CREATE INDEX idx_teams_sport ON teams(sport_id);
CREATE INDEX idx_teams_country ON teams(country);

-- Award and statistics indexes
CREATE INDEX idx_player_awards_player_season ON player_awards(player_id, season);
CREATE INDEX idx_player_awards_award_type ON player_awards(award_type_id);
CREATE INDEX idx_player_statistics_player_type ON player_statistics(player_id, statistic_type_id);
CREATE INDEX idx_player_statistics_season ON player_statistics(season);
CREATE INDEX idx_team_statistics_team_season ON team_statistics(team_id, season);
CREATE INDEX idx_team_statistics_type ON team_statistics(statistic_type_id);

-- Tournament indexes
CREATE INDEX idx_tournaments_year_sport ON tournaments(year, sport_id);
CREATE INDEX idx_tournaments_surface ON tournaments(surface);
CREATE INDEX idx_tournament_results_champion ON tournament_results(champion_id);

-- Survival mode indexes
CREATE INDEX idx_survival_players_initials ON survival_players(initials);
CREATE INDEX idx_survival_players_elo ON survival_players(current_elo DESC);
CREATE INDEX idx_survival_matches_timestamp ON survival_matches(timestamp DESC);
CREATE INDEX idx_survival_matches_players ON survival_matches(player1_id, player2_id);
CREATE INDEX idx_elo_history_player ON elo_history(player_id);
CREATE INDEX idx_elo_history_match ON elo_history(match_id);

-- Performance tracking indexes
CREATE INDEX idx_question_performance_question_id ON question_performance(question_id);
CREATE INDEX idx_question_performance_user_id ON question_performance(user_id);
CREATE INDEX idx_question_performance_session_id ON question_performance(session_id);
CREATE INDEX idx_question_performance_timestamp ON question_performance(timestamp);
CREATE INDEX idx_question_difficulty_feedback_question_id ON question_difficulty_feedback(question_id);

-- Full-text search indexes
CREATE INDEX idx_players_name_gin ON players USING gin(to_tsvector('english', name));
CREATE INDEX idx_teams_name_gin ON teams USING gin(to_tsvector('english', name));

-- Composite indexes for common queries
CREATE INDEX idx_player_awards_sport_season ON player_awards (award_type_id, season);
CREATE INDEX idx_player_statistics_sport_season ON player_statistics (statistic_type_id, season);

-- ============================================================================
-- INITIAL DATA SEEDING
-- ============================================================================

-- Insert sports
INSERT INTO sports (name, display_name) VALUES
('football', 'Football'),
('tennis', 'Tennis');

-- Insert basic competitions (these will be expanded during migration)
INSERT INTO competitions (sport_id, name, display_name, competition_type, data_source) VALUES
((SELECT id FROM sports WHERE name = 'football'), 'ballon_dor', 'Ballon d''Or', 'award', 'Ballon_d_Or.json'),
((SELECT id FROM sports WHERE name = 'football'), 'pl_player_of_season', 'Premier League Player of the Season', 'award', 'PL_Player_of_the_Season.json'),
((SELECT id FROM sports WHERE name = 'football'), 'pl_player_stats', 'Premier League Player Statistics', 'player_stats', 'PL_Players_Stats.json'),
((SELECT id FROM sports WHERE name = 'football'), 'laliga_player_stats', 'La Liga Player Statistics', 'player_stats', 'LaLiga_Players_Stats.json'),
((SELECT id FROM sports WHERE name = 'football'), 'laliga_squad_stats', 'La Liga Squad Statistics', 'squad_stats', 'La Liga_squad_std_stats.json'),
((SELECT id FROM sports WHERE name = 'tennis'), 'tennis_awards', 'Tennis Awards', 'award', 'tennis_awards.json'),
((SELECT id FROM sports WHERE name = 'tennis'), 'tennis_tournaments', 'Tennis Tournaments', 'tournament', 'tennis_tournaments.json');

-- Create update timestamp triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers to all tables with updated_at columns
CREATE TRIGGER update_sports_updated_at BEFORE UPDATE ON sports FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_competitions_updated_at BEFORE UPDATE ON competitions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_teams_updated_at BEFORE UPDATE ON teams FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_players_updated_at BEFORE UPDATE ON players FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_player_teams_updated_at BEFORE UPDATE ON player_teams FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_award_types_updated_at BEFORE UPDATE ON award_types FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_player_awards_updated_at BEFORE UPDATE ON player_awards FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_statistic_types_updated_at BEFORE UPDATE ON statistic_types FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_player_statistics_updated_at BEFORE UPDATE ON player_statistics FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_team_statistics_updated_at BEFORE UPDATE ON team_statistics FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_tournaments_updated_at BEFORE UPDATE ON tournaments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_tournament_results_updated_at BEFORE UPDATE ON tournament_results FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_survival_players_updated_at BEFORE UPDATE ON survival_players FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();