export interface GameResultState {
  score: number;
  total: number;
  correctCount: number;
  avgTime: number;
  eloChange: number | null;
  newElo: number | null;
  sport: string;
  // `came_first` is the "Which Came First" quiz variant; ResultScreen routes
  // play-again through `/sport-select?mode=` so the variant must survive here.
  mode: "quiz" | "survival" | "daily-quiz" | "daily-survival" | "blitz" | "challenge" | "came_first";
  shareString?: string;
  wrongCount?: number;
  kFactor?: number;
  kFactorLabel?: string;
  scoreBreakdown?: Array<{
    correct: boolean;
    timeTaken: number;
    score: number;
  }>;
  opponentScore?: number;
  outcome?: "win" | "loss" | "draw" | "forfeitWin" | "forfeitLoss";
  opponentName?: string;
  opponentId?: string;
  versusScore?: {
    player1Wins: number;
    player2Wins: number;
    draws: number;
    totalMatches: number;
    lastPlayedAt?: number;
    currentStreak?: {
      count: number;
      owner: "player1" | "player2" | "you" | "opponent";
      streakOwner?: "player1" | "player2" | "you" | "opponent";
    } | null;
    recentMatches?: Array<{
      outcome: "win" | "loss" | "draw";
      player1Score: number;
      player2Score: number;
      playedAt: number;
    }>;
  };
  currentStreak?: {
    count: number;
    owner: "player1" | "player2" | "you" | "opponent";
    streakOwner?: "player1" | "player2" | "you" | "opponent";
  } | null;
  recentMatches?: Array<{
    outcome: "win" | "loss" | "draw";
    player1Score: number;
    player2Score: number;
    playedAt: number;
  }>;
  currentUserIsPlayer1?: boolean;
}
