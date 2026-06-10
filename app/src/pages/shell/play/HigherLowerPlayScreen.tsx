/**
 * Higher or Lower (solo) on the v2 shell — a PRESENTATION-ONLY reskin of the
 * live `HigherLowerScreen` into the centered-column "prototype layout".
 *
 * The game loop is a faithful port: every decision stays server-authoritative
 * and UNCHANGED — `higherLower.startSession / makeGuess / penalizeTabSwitch`.
 * The stat pool, comparison, scoring, streak, and the pool-exhausted end state
 * all behave exactly as on the live screen. Only the layout changes: the binary
 * call (Higher / Lower) and the two player cards own the answering column;
 * score + streak move to the ambient rail (the allowlisted ambient fields),
 * content-blind by contract. Football only, matching the live mode.
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { TrendingUp, TrendingDown } from "lucide-react";
import { NeoCard } from "@/components/neo/NeoCard";
import { NeoButton } from "@/components/neo/NeoButton";
import { NeoBadge } from "@/components/neo/NeoBadge";
import { PlayStage } from "@/components/shell/play/PlayStage";
import { MetricsPanel, AmbientStrip } from "@/components/shell/play/ambient";
import { SHELL_ROUTES } from "@/lib/shellRoutes";
import { useAntiCheat } from "@/hooks/useAntiCheat";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";

// Human-readable stat key labels (ported verbatim from the live screen).
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

const SUPPORTED_HIGHER_LOWER_SPORTS = new Set(["football"]);
const START_SESSION_TIMEOUT_MS = 8000;

// International tournaments use a single year; domestic leagues span two years.
const SINGLE_YEAR_CONTEXTS = new Set(["league:fb_1", "league:fb_4", "league:fb_9", "league:fb_15"]);

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      window.setTimeout(() => {
        reject(new Error("Higher or Lower startup timed out"));
      }, timeoutMs);
    }),
  ]);
}

export default function HigherLowerPlayScreen() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const sport = params.get("sport") || "football";
  const isSupportedSport = SUPPORTED_HIGHER_LOWER_SPORTS.has(sport);

  const startSessionMut = useMutation(api.higherLower.startSession);
  const makeGuessMut = useMutation(api.higherLower.makeGuess);
  const penalizeTabSwitchMut = useMutation(api.higherLower.penalizeTabSwitch);

  const [sessionId, setSessionId] = useState<Id<"higherLowerSessions"> | null>(null);
  const [loading, setLoading] = useState(true);
  const [statKey, setStatKey] = useState("");
  const [context, setContext] = useState("");
  const [contextLabel, setContextLabel] = useState("");
  const [entityType, setEntityType] = useState("");
  const [season, setSeason] = useState<number | undefined>();

  // Player A (value shown) / Player B (value hidden until guess).
  const [playerAName, setPlayerAName] = useState("");
  const [playerAValue, setPlayerAValue] = useState(0);
  const [playerAPhoto, setPlayerAPhoto] = useState<string | undefined>();
  const [playerBName, setPlayerBName] = useState("");
  const [playerBPhoto, setPlayerBPhoto] = useState<string | undefined>();

  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [feedback, setFeedback] = useState<{ correct: boolean; value: number } | null>(null);
  const [endReason, setEndReason] = useState<string | null>(null);
  const [animating, setAnimating] = useState(false);
  const [pendingGuess, setPendingGuess] = useState<"higher" | "lower" | null>(null);
  const guessInFlight = useRef(false);
  const [shakeB, setShakeB] = useState(false);
  const [slideIn, setSlideIn] = useState(false);
  const [startupState, setStartupState] = useState<{
    kind: "unsupported" | "start_failed";
    title: string;
    message: string;
  } | null>(null);

  const startGame = useCallback(async () => {
    if (!isSupportedSport) {
      setStartupState({
        kind: "unsupported",
        title: "Football Only For Now",
        message:
          "Higher or Lower is currently available for football only. Pick football to start a round.",
      });
      setLoading(false);
      return;
    }

    setLoading(true);
    setStartupState(null);
    try {
      const result = await withTimeout(startSessionMut({ sport }), START_SESSION_TIMEOUT_MS);
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
      setEndReason(null);
      setStartupState(null);
    } catch (err) {
      console.error("Failed to start session:", err);
      setSessionId(null);
      setStartupState({
        kind: "start_failed",
        title: "Couldn't Start A Round",
        message:
          "Higher or Lower couldn't load right now. Try again, or go back and retry from Compete.",
      });
    } finally {
      setLoading(false);
    }
  }, [isSupportedSport, sport, startSessionMut]);

  useEffect(() => {
    startGame();
  }, [startGame]);

  useAntiCheat(
    useCallback(() => {
      if (!sessionId || gameOver || loading || startupState) return;
      penalizeTabSwitchMut({ sessionId }).then((res) => {
        if (res.penalized) {
          setGameOver(true);
          setScore(res.score);
          toast.error("Run ended — you switched tabs");
        }
      });
    }, [sessionId, gameOver, loading, startupState, penalizeTabSwitchMut]),
    { warningMessage: "Don't switch tabs — your run will end" },
  );

  const handleGuess = async (guess: "higher" | "lower") => {
    if (!sessionId || animating || gameOver || guessInFlight.current) return;
    guessInFlight.current = true;
    setAnimating(true);
    setPendingGuess(guess);

    try {
      const result = await makeGuessMut({ sessionId, guess });
      setFeedback({ correct: result.correct, value: result.playerBValue });

      if (result.correct) {
        setScore(result.score);
        setStreak(result.streak);

        if (result.gameOver) {
          setEndReason(result.endReason ?? null);
          setGameOver(true);
        } else {
          // Animate transition: slide B → A, new B slides in.
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
        setEndReason(null);
        setGameOver(true);
      }
    } catch (err) {
      console.error("Guess error:", err);
    } finally {
      setTimeout(() => {
        setAnimating(false);
        setPendingGuess(null);
        guessInFlight.current = false;
      }, 1300);
    }
  };

  const seasonDisplay = season
    ? SINGLE_YEAR_CONTEXTS.has(context)
      ? `${season}`
      : `${season}/${season + 1} Season`
    : null;
  const displayLabel = contextLabel || context;

  const metrics = { score, streak };

  if (loading) {
    return (
      <PlayStage title="Higher or Lower" onExit={() => navigate(SHELL_ROUTES.home)}>
        <div className="flex items-center justify-center py-16">
          <p className="font-heading font-bold text-lg animate-pulse">Loading…</p>
        </div>
      </PlayStage>
    );
  }

  if (startupState) {
    return (
      <PlayStage
        title="Higher or Lower"
        onExit={() => navigate(SHELL_ROUTES.home)}
        exitLabel="Quit"
      >
        <div className="flex flex-col items-center justify-center py-10">
          <NeoCard color="primary" shadow="lg" className="w-full text-center py-8 px-5">
            <p className="font-heading font-bold text-2xl">{startupState.title}</p>
            <p className="text-sm text-muted-foreground mt-3">{startupState.message}</p>

            <div className="grid grid-cols-1 gap-3 mt-6">
              {startupState.kind === "unsupported" ? (
                <NeoButton
                  variant="primary"
                  size="lg"
                  onClick={() => navigate(`${SHELL_ROUTES.higherLowerPlay}?sport=football`)}
                >
                  Play Football
                </NeoButton>
              ) : (
                <NeoButton variant="primary" size="lg" onClick={startGame}>
                  Try Again
                </NeoButton>
              )}
              <NeoButton
                variant="secondary"
                size="lg"
                onClick={() => navigate(SHELL_ROUTES.competeSportGrid(sport))}
              >
                Back To Compete
              </NeoButton>
            </div>
          </NeoCard>
        </div>
      </PlayStage>
    );
  }

  return (
    <PlayStage
      title="Higher or Lower"
      subtitle="Who has more?"
      onExit={() => navigate(SHELL_ROUTES.home)}
      exitLabel="Quit"
      strip={<AmbientStrip metrics={metrics} />}
      right={<MetricsPanel metrics={metrics} />}
    >
      <div className="flex flex-col">
        {/* Stat context — the question framing for the binary call. */}
        <div className="text-center mb-4">
          {seasonDisplay && (
            <p className="text-[11px] text-muted-foreground mb-0.5">{seasonDisplay}</p>
          )}
          <p className="font-heading font-bold text-sm text-muted-foreground uppercase">
            {displayLabel} — {formatStatKey(statKey)}
          </p>
          <div className="flex items-center justify-center gap-2 mt-1">
            <NeoBadge color={entityType === "team" ? "accent" : "pink"} size="sm">
              {entityType === "team" ? "Team Stat" : "Player Stat"}
            </NeoBadge>
          </div>
        </div>

        {/* Player A — value shown */}
        <NeoCard
          color="success"
          shadow="lg"
          className="flex flex-col items-center justify-center text-center py-3"
        >
          {playerAPhoto && (
            <img
              src={playerAPhoto}
              alt={playerAName}
              className="w-14 h-14 rounded-full neo-border object-cover mb-2"
            />
          )}
          <p className="font-heading font-bold text-lg">{playerAName}</p>
          <p className="font-mono font-bold text-4xl mt-1">{playerAValue}</p>
          <p className="text-xs text-success-foreground opacity-80 mt-1">
            {formatStatKey(statKey)}
          </p>
        </NeoCard>

        {/* VS divider */}
        <div className="flex items-center justify-center my-2">
          <div className="neo-border rounded-full bg-background px-4 py-1.5 font-heading font-bold text-sm">
            VS
          </div>
        </div>

        {/* Player B — value hidden until guess */}
        <NeoCard
          shadow="lg"
          className={`flex flex-col items-center justify-center text-center py-3 transition-all ${
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
              className="w-14 h-14 rounded-full neo-border object-cover mb-2"
            />
          )}
          <p className="font-heading font-bold text-lg">{playerBName}</p>
          <p className="font-mono font-bold text-4xl mt-1">{feedback ? feedback.value : "?"}</p>
          <p className="text-xs opacity-80 mt-1">{formatStatKey(statKey)}</p>
        </NeoCard>

        {/* Action buttons — the binary call. */}
        {!gameOver && !feedback && (
          <div className="grid grid-cols-2 gap-3 mt-4">
            <NeoButton
              variant="accent"
              size="lg"
              onPointerDownCapture={(event) => {
                if (animating || gameOver || guessInFlight.current) return;
                event.preventDefault();
                void handleGuess("higher");
              }}
              onClick={() => handleGuess("higher")}
              disabled={animating}
            >
              <TrendingUp size={20} className="mr-1" />
              {pendingGuess === "higher" ? "Checking..." : "Higher"}
            </NeoButton>
            <NeoButton
              variant="pink"
              size="lg"
              onPointerDownCapture={(event) => {
                if (animating || gameOver || guessInFlight.current) return;
                event.preventDefault();
                void handleGuess("lower");
              }}
              onClick={() => handleGuess("lower")}
              disabled={animating}
            >
              <TrendingDown size={20} className="mr-1" />
              {pendingGuess === "lower" ? "Checking..." : "Lower"}
            </NeoButton>
          </div>
        )}

        {/* Game over */}
        {gameOver && (
          <div className="mt-5 space-y-3 animate-slide-up">
            <NeoCard color="primary" className="text-center py-4">
              <p className="font-heading font-bold text-xl">Game Over!</p>
              <p className="font-mono font-bold text-3xl mt-1">{score}</p>
              <p className="text-xs opacity-80 mt-1">Final Score</p>
              {endReason === "pool_exhausted" && (
                <p className="text-xs opacity-80 mt-2">
                  Perfect run: this stat pool is exhausted.
                </p>
              )}
            </NeoCard>
            <div className="grid grid-cols-2 gap-3">
              <NeoButton variant="primary" size="lg" onClick={startGame}>
                Play Again
              </NeoButton>
              <NeoButton variant="secondary" size="lg" onClick={() => navigate(SHELL_ROUTES.home)}>
                Home
              </NeoButton>
            </div>
          </div>
        )}
      </div>
    </PlayStage>
  );
}
