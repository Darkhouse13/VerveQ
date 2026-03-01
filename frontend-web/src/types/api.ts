// ---- User & Auth ----

export interface User {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  total_games: number;
  created_at: string;
  last_active?: string;
}

export interface LoginRequest {
  display_name: string;
  email?: string;
  avatar_url?: string;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface GuestSessionResponse {
  success: boolean;
  session_id: string;
  type: "guest";
}

export interface ApiError {
  detail: string;
  status: number;
}

// ---- Sports ----

export interface SportsResponse {
  sports: string[];
  count: number;
}

// ---- Quiz ----

export interface QuizSessionResponse {
  session_id: string;
  sport: string;
  max_questions: number;
}

export interface QuizQuestion {
  question: string;
  options: string[];
  correct_answer: string;
  explanation: string | null;
  difficulty: string;
  checksum: string;
}

export interface QuizCheckRequest {
  answer: string;
  time_taken: number;
  question: { correct_answer: string; explanation?: string | null };
}

export interface QuizCheckResponse {
  correct: boolean;
  score: number;
  scoring_breakdown: {
    base_points: number;
    time_taken: number;
    max_time_allowed: number;
    time_factor: number;
    calculated_score: number;
  };
  correct_answer: string;
  explanation: string;
}

export interface GameCompleteRequest {
  user_id: string;
  score: number;
  total_questions: number;
  accuracy: number;
  average_time: number;
  difficulty?: string;
}

export interface GameResultResponse {
  success: boolean;
  message: string;
  new_elo_rating: number;
  elo_change: number;
  game_session_id: string;
}

// ---- Survival ----

export interface SurvivalChallenge {
  initials: string;
  round: number;
  difficulty: string;
  hint: string;
}

export interface SurvivalStartResponse {
  session_id: string;
  sport: string;
  round: number;
  lives: number;
  score: number;
  hint_available: boolean;
  challenge: SurvivalChallenge;
}

export interface SurvivalGuessResponse {
  correct: boolean;
  guess: string;
  correct_answer: string;
  similarity: number;
  lives: number;
  score: number;
  round: number;
  game_over?: boolean;
  final_score?: number;
  final_round?: number;
  next_challenge?: SurvivalChallenge;
}

export interface SurvivalHintResponse {
  session_id: string;
  initials: string;
  sample_players: string[];
  total_players: number;
  hint_used: boolean;
  message: string;
}

export interface SurvivalSkipResponse {
  lives: number;
  score?: number;
  round?: number;
  game_over?: boolean;
  challenge?: SurvivalChallenge;
  skipped?: boolean;
}

export interface SurvivalCompleteRequest {
  user_id: string;
  score: number;
  duration_seconds: number;
}

// ---- Leaderboard ----

export interface LeaderboardEntry {
  rank: number;
  user_id: string;
  username: string;
  score: number;
  elo_rating: number | null;
}

export interface LeaderboardResponse {
  sport: string | null;
  game_mode: string | null;
  period: string;
  entries: LeaderboardEntry[];
  total_entries: number;
}

// ---- Profile ----

export interface ProfileStats {
  total_games: number;
  total_wins: number;
  win_rate: number;
  current_streak: number;
  best_streak: number;
  favorite_sport: string | null;
  favorite_game_mode: string | null;
}

export interface ProfileAchievement {
  id: string;
  name: string;
  description: string;
  earned_at: string;
  icon: string | null;
}

export interface ProfileResponse {
  user_id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  elo_rating: number;
  created_at: string;
  last_active: string;
  stats: ProfileStats;
  achievements: ProfileAchievement[];
  recent_games: Array<{
    id: string;
    sport: string;
    game_mode: string;
    score: number;
    elo_change: number;
    played_at: string;
  }>;
}

// ---- Achievements ----

export interface Achievement {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  points: number;
  is_hidden: boolean;
}

export interface UserAchievement {
  achievement: Achievement;
  unlocked_at: string;
  progress: Record<string, unknown> | null;
}

export interface AchievementCheckResponse {
  newly_unlocked: string[];
  total_unlocked: number;
  total_points: number;
}

// ---- Challenges ----

export interface ChallengeEntry {
  challenge_id: string;
  challenger: string;
  sport: string;
  mode: string;
  created_at: string;
  status: string;
}

export interface PendingChallengesResponse {
  total: number;
  challenges: ChallengeEntry[];
}

export interface CreateChallengeRequest {
  challenged_username: string;
  sport: string;
  mode: string;
}

// ---- Result state passed between pages ----

export interface GameResultState {
  score: number;
  total: number;
  correctCount: number;
  avgTime: number;
  eloChange: number | null;
  newElo: number | null;
  sport: string;
  mode: "quiz" | "survival";
}
