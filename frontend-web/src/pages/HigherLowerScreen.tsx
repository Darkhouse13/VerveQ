import { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { NeoCard } from "@/components/neo/NeoCard";
import { NeoButton } from "@/components/neo/NeoButton";
import { NeoBadge } from "@/components/neo/NeoBadge";
import { ArrowLeft, TrendingUp, TrendingDown, Flame } from "lucide-react";

// Human-readable stat key labels
const STAT_LABELS: Record<string, string> = {
  goalsFor: "Goals Scored",
  goalsAgainst: "Goals Conceded",
  cleanSheets: "Clean Sheets",
  assists: "Assists",
  appearances: "Appearances",
  yellowCards: "Yellow Cards",
  redCards: "Red Cards",
  wins: "Wins",
  losses: "Losses",
  draws: "Draws",
  points: "Points",
};

function formatStatKey(key: string): string {
  return STAT_LABELS[key] || key.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase());
}

export default function HigherLowerScreen() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const sport = params.get("sport") || "football";

  const startSessionMut = useMutation(api.higherLower.startSession);
  const makeGuessMut = useMutation(api.higherLower.makeGuess);

  const [sessionId, setSessionId] = useState<Id<"higherLowerSessions"> | null>(null);
  const [loading, setLoading] = useState(true);
  const [statKey, setStatKey] = useState("");
  const [context, setContext] = useState("");
  const [contextLabel, setContextLabel] = useState("");
  const [entityType, setEntityType] = useState("");
  const [season, setSeason] = useState<number | undefined>();

  // Player A (value shown)
  const [playerAName, setPlayerAName] = useState("");
  const [playerAValue, setPlayerAValue] = useState(0);
  const [playerAPhoto, setPlayerAPhoto] = useState<string | undefined>();

  // Player B (value hidden until guess)
  const [playerBName, setPlayerBName] = useState("");
  const [playerBPhoto, setPlayerBPhoto] = useState<string | undefined>();

  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [feedback, setFeedback] = useState<{ correct: boolean; value: number } | null>(null);
  const [animating, setAnimating] = useState(false);
  const [shakeB, setShakeB] = useState(false);
  const [slideIn, setSlideIn] = useState(false);

  const startGame = useCallback(async () => {
    setLoading(true);
    try {
      const result = await startSessionMut({ sport });
      setSessionId(result.sessionId);
      setStatKey(result.statKey);
      setContext(result.context);
      setContextLabel(result.contextLabel);
      setEntityType(result.entityType);
      setSeason(result.season);
      setPlayerAName(result.playerAName);
      setPlayerAValue(result.playerAValue);
      setPlayerAPhoto(result.playerAPhoto ?? undefined);
      setPlayerBName(result.playerBName);
      setPlayerBPhoto(result.playerBPhoto ?? undefined);
      setScore(0);
      setStreak(0);
      setGameOver(false);
      setFeedback(null);
    } catch (err) {
      console.error("Failed to start session:", err);
    } finally {
      setLoading(false);
    }
  }, [startSessionMut, sport]);

  useEffect(() => {
    startGame();
  }, [startGame]);

  const handleGuess = async (guess: "higher" | "lower") => {
    if (!sessionId || animating || gameOver) return;
    setAnimating(true);

    try {
      const result = await makeGuessMut({ sessionId, guess });
      setFeedback({ correct: result.correct, value: result.playerBValue });

      if (result.correct) {
        setScore(result.score);
        setStreak(result.streak);

        if (result.gameOver) {
          setGameOver(true);
        } else {
          // Animate transition: slide B → A, new B slides in
          setTimeout(() => {
            setPlayerAName(result.nextPlayerAName!);
            setPlayerAValue(result.nextPlayerAValue!);
            setPlayerAPhoto(result.nextPlayerAPhoto ?? undefined);
            setPlayerBName(result.nextPlayerBName!);
            setPlayerBPhoto(result.nextPlayerBPhoto ?? undefined);
            setContext(result.context!);
            if (result.contextLabel) setContextLabel(result.contextLabel);
            if (result.entityType) setEntityType(result.entityType);
            if (result.season !== undefined) setSeason(result.season ?? undefined);
            setFeedback(null);
            setSlideIn(true);
            setTimeout(() => setSlideIn(false), 400);
          }, 1200);
        }
      } else {
        setShakeB(true);
        setTimeout(() => setShakeB(false), 600);
        setScore(result.score);
        setStreak(result.streak);
        setGameOver(true);
      }
    } catch (err) {
      console.error("Guess error:", err);
    } finally {
      setTimeout(() => setAnimating(false), 1300);
    }
  };

  // International tournaments use a single year; domestic leagues span two years
  const SINGLE_YEAR_CONTEXTS = new Set(["league:fb_1", "league:fb_4", "league:fb_9", "league:fb_15"]);
  const seasonDisplay = season
    ? SINGLE_YEAR_CONTEXTS.has(context)
      ? `${season}`
      : `${season}/${season + 1} Season`
    : null;

  // Display label: prefer contextLabel, fall back to raw context
  const displayLabel = contextLabel || context;

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="font-heading text-lg animate-pulse">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background px-5 py-5 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => navigate("/home")}
          className="neo-border neo-shadow rounded-lg p-2 bg-background cursor-pointer active:neo-shadow-pressed transition-all"
        >
          <ArrowLeft size={20} strokeWidth={2.5} />
        </button>

        <div className="flex items-center gap-2">
          {streak >= 3 && (
            <NeoBadge color="pink" size="sm">
              <Flame size={12} className="mr-1" />
              {streak}
            </NeoBadge>
          )}
          <NeoBadge color="primary" size="md">
            Score: {score}
          </NeoBadge>
        </div>
      </div>

      {/* Stat context */}
      <div className="text-center mb-4">
        {seasonDisplay && (
          <p className="text-[11px] text-muted-foreground mb-0.5">
            {seasonDisplay}
          </p>
        )}
        <p className="font-heading font-bold text-sm text-muted-foreground uppercase">
          {displayLabel} — {formatStatKey(statKey)}
        </p>
        <div className="flex items-center justify-center gap-2 mt-1">
          <NeoBadge color={entityType === "team" ? "accent" : "pink"} size="sm">
            {entityType === "team" ? "Team Stat" : "Player Stat"}
          </NeoBadge>
          <p className="text-xs text-muted-foreground">Who has more?</p>
        </div>
      </div>

      {/* Split layout */}
      <div className="flex-1 flex flex-col gap-4">
        {/* Player A — value shown */}
        <NeoCard
          color="success"
          shadow="lg"
          className="flex-1 flex flex-col items-center justify-center text-center py-6"
        >
          {playerAPhoto && (
            <img
              src={playerAPhoto}
              alt={playerAName}
              className="w-20 h-20 rounded-full neo-border object-cover mb-3"
            />
          )}
          <p className="font-heading font-bold text-lg">{playerAName}</p>
          <p className="font-mono font-bold text-4xl mt-2">{playerAValue}</p>
          <p className="text-xs text-success-foreground opacity-80 mt-1">
            {formatStatKey(statKey)}
          </p>
        </NeoCard>

        {/* VS divider */}
        <div className="flex items-center justify-center">
          <div className="neo-border rounded-full bg-background px-4 py-1.5 font-heading font-bold text-sm">
            VS
          </div>
        </div>

        {/* Player B — value hidden */}
        <NeoCard
          shadow="lg"
          className={`flex-1 flex flex-col items-center justify-center text-center py-6 transition-all ${
            shakeB ? "animate-shake-horizontal" : ""
          } ${slideIn ? "animate-slide-up" : ""} ${
            feedback
              ? feedback.correct
                ? "bg-success text-success-foreground"
                : "bg-destructive text-destructive-foreground"
              : "bg-electric-blue text-electric-blue-foreground"
          }`}
        >
          {playerBPhoto && (
            <img
              src={playerBPhoto}
              alt={playerBName}
              className="w-20 h-20 rounded-full neo-border object-cover mb-3"
            />
          )}
          <p className="font-heading font-bold text-lg">{playerBName}</p>

          {feedback ? (
            <p className="font-mono font-bold text-4xl mt-2">{feedback.value}</p>
          ) : (
            <p className="font-mono font-bold text-4xl mt-2">?</p>
          )}

          <p className="text-xs opacity-80 mt-1">{formatStatKey(statKey)}</p>
        </NeoCard>
      </div>

      {/* Action buttons */}
      {!gameOver && !feedback && (
        <div className="grid grid-cols-2 gap-3 mt-4">
          <NeoButton
            variant="accent"
            size="lg"
            onClick={() => handleGuess("higher")}
            disabled={animating}
          >
            <TrendingUp size={20} className="mr-1" />
            Higher
          </NeoButton>
          <NeoButton
            variant="pink"
            size="lg"
            onClick={() => handleGuess("lower")}
            disabled={animating}
          >
            <TrendingDown size={20} className="mr-1" />
            Lower
          </NeoButton>
        </div>
      )}

      {/* Game over */}
      {gameOver && (
        <div className="mt-4 space-y-3 animate-slide-up">
          <NeoCard color="primary" className="text-center py-4">
            <p className="font-heading font-bold text-xl">Game Over!</p>
            <p className="font-mono font-bold text-3xl mt-1">{score}</p>
            <p className="text-xs opacity-80 mt-1">Final Score</p>
          </NeoCard>
          <div className="grid grid-cols-2 gap-3">
            <NeoButton variant="primary" size="lg" onClick={startGame}>
              Play Again
            </NeoButton>
            <NeoButton variant="secondary" size="lg" onClick={() => navigate("/home")}>
              Home
            </NeoButton>
          </div>
        </div>
      )}
    </div>
  );
}
