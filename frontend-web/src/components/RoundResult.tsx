import { NeoCard } from "@/components/neo/NeoCard";
import { Check, X } from "lucide-react";

interface RoundResultProps {
  questionNum: number;
  player1: { name: string; correct: boolean; score: number; timeTaken: number };
  player2: { name: string; correct: boolean; score: number; timeTaken: number };
  player1Total: number;
  player2Total: number;
}

export function RoundResult({
  questionNum,
  player1,
  player2,
  player1Total,
  player2Total,
}: RoundResultProps) {
  return (
    <div className="fixed inset-0 bg-background/95 z-40 flex items-center justify-center px-5">
      <NeoCard shadow="lg" className="w-full max-w-md">
        <p className="font-heading font-bold text-sm text-center text-muted-foreground mb-4">
          Question {questionNum} Result
        </p>

        <div className="grid grid-cols-2 gap-4 mb-4">
          {/* Player 1 */}
          <div className="text-center">
            <p className="font-heading font-bold text-sm mb-2 truncate">
              {player1.name}
            </p>
            <div
              className={`neo-border rounded-lg p-3 ${
                player1.correct
                  ? "bg-success text-success-foreground"
                  : "bg-destructive text-destructive-foreground"
              }`}
            >
              {player1.correct ? (
                <Check size={24} strokeWidth={3} className="mx-auto" />
              ) : (
                <X size={24} strokeWidth={3} className="mx-auto" />
              )}
              <p className="font-mono text-xs mt-1">
                {player1.correct
                  ? `+${player1.score} (${player1.timeTaken.toFixed(1)}s)`
                  : "Incorrect"}
              </p>
            </div>
          </div>

          {/* Player 2 */}
          <div className="text-center">
            <p className="font-heading font-bold text-sm mb-2 truncate">
              {player2.name}
            </p>
            <div
              className={`neo-border rounded-lg p-3 ${
                player2.correct
                  ? "bg-success text-success-foreground"
                  : "bg-destructive text-destructive-foreground"
              }`}
            >
              {player2.correct ? (
                <Check size={24} strokeWidth={3} className="mx-auto" />
              ) : (
                <X size={24} strokeWidth={3} className="mx-auto" />
              )}
              <p className="font-mono text-xs mt-1">
                {player2.correct
                  ? `+${player2.score} (${player2.timeTaken.toFixed(1)}s)`
                  : "Incorrect"}
              </p>
            </div>
          </div>
        </div>

        {/* Running totals */}
        <div className="flex justify-between neo-border rounded-lg p-3 bg-muted">
          <span className="font-mono font-bold">{player1Total}</span>
          <span className="font-heading font-bold text-xs text-muted-foreground">
            SCORE
          </span>
          <span className="font-mono font-bold">{player2Total}</span>
        </div>
      </NeoCard>
    </div>
  );
}
