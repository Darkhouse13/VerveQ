export interface GameResultState {
  score: number;
  total: number;
  correctCount: number;
  avgTime: number;
  eloChange: number | null;
  newElo: number | null;
  sport: string;
  mode: "quiz" | "survival" | "daily-quiz" | "daily-survival" | "blitz";
  shareString?: string;
  wrongCount?: number;
  kFactor?: number;
  kFactorLabel?: string;
  scoreBreakdown?: Array<{
    correct: boolean;
    timeTaken: number;
    score: number;
  }>;
}
