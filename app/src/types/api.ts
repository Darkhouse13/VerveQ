export interface GameResultState {
  score: number;
  total: number;
  correctCount: number;
  avgTime: number;
  eloChange: number | null;
  newElo: number | null;
  sport: string;
  mode: "quiz" | "survival" | "daily-quiz" | "daily-survival" | "blitz" | "challenge";
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
  };
}
