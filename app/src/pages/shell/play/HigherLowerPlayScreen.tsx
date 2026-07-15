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
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { TrendingUp, TrendingDown } from "lucide-react";
import { NeoCard } from "@/components/neo/NeoCard";
import { NeoButton } from "@/components/neo/NeoButton";
import { NeoBadge } from "@/components/neo/NeoBadge";
import { PlayStage } from "@/components/shell/play/PlayStage";
import { MetricsPanel, AmbientStrip } from "@/components/shell/play/ambient";
import { SHELL_ROUTES } from "@/lib/shellRoutes";
import { parseDifficulty } from "@/lib/difficulty";
import { useAntiCheat } from "@/hooks/useAntiCheat";
import { useAuth } from "@/contexts/AuthContext";
import {
  startRun,
  noteQuestionAnswered,
  completeRun,
  abandonRun,
} from "@/lib/gameAnalytics";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";

// Fallback human-readable stat key labels (ported verbatim from the live
// screen). Used as i18n defaultValues so a missing translation still renders.
const STAT_LABEL_FALLBACKS: Record<string, string> = {
  goalsFor: "Goals Scored",
  goalsAgainst: "Goals Conceded",
  goals: "Goals",
  cleanSheets: "Clean Sheets",
  assists: "Assists",
  appearances: "Appearances",
  minutes: "Minutes Played",
  cardsYellow: "Yellow Cards",
  yellowCards: "Yellow Cards",
  redCards: "Red Cards",
  wins: "Wins",
  losses: "Losses",
  draws: "Draws",
  points: "Points",
};

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
  const { t } = useTranslation("play");

  // Human-readable stat label, translated. Falls back to the verbatim English
  // label (or a de-camelCased key) so an untranslated stat still renders.
  const formatStatKey = useCallback(
    (key: string): string => {
      const fallback =
        STAT_LABEL_FALLBACKS[key] ||
        key.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase());
      return t(`higherLower.stats.${key}`, { defaultValue: fallback });
    },
    [t],
  );

  const navigate = useNavigate();
  const [params] = useSearchParams();
  const sport = params.get("sport") || "football";
  const isSupportedSport = SUPPORTED_HIGHER_LOWER_SPORTS.has(sport);
  // Tier is chosen on the difficulty picker and carried in the URL; a direct
  // deep link (no param) falls back to easy.
  const difficulty = parseDifficulty(params.get("difficulty"));

  const startSessionMut = useMutation(api.higherLower.startSession);
  const makeGuessMut = useMutation(api.higherLower.makeGuess);
  const penalizeTabSwitchMut = useMutation(api.higherLower.penalizeTabSwitch);

  const { accountState } = useAuth();

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
  // The KIND only — never the rendered copy. Holding translated strings here
  // would put `t` in startGame's closure, and a locale switch would then re-run
  // the auto-start effect (see below); it would also freeze this text in the
  // language that was active when the failure happened.
  const [startupState, setStartupState] = useState<
    "unsupported" | "start_failed" | null
  >(null);

  // Read through a ref, NOT as a startGame dependency: startGame is its own
  // useEffect's only dep, so adding accountState there would mint a fresh
  // server session every time auth settled — inventing games nobody started.
  const accountStateRef = useRef(accountState);
  accountStateRef.current = accountState;

  const startGame = useCallback(async () => {
    if (!isSupportedSport) {
      setStartupState("unsupported");
      setLoading(false);
      return;
    }

    setLoading(true);
    setStartupState(null);
    try {
      const result = await withTimeout(
        startSessionMut({ sport, difficulty }),
        START_SESSION_TIMEOUT_MS,
      );
      // A game genuinely began — the server minted a session. Keyed on that id,
      // so a real replay counts as its own game while a bare navigation here
      // mints nothing and stays silent.
      startRun(result.sessionId, "higher-lower", {
        accountState: accountStateRef.current,
      });
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
      setStartupState("start_failed");
    } finally {
      setLoading(false);
    }
    // NO `t` here, deliberately: every start below is a server session, and a
    // re-created translation function is not a reason to mint one.
  }, [isSupportedSport, sport, difficulty, startSessionMut]);

  // Arriving provisions exactly ONE session per sport+difficulty. "Play again"
  // and "Try again" call startGame directly and are untouched by this guard, so
  // a real new game is still a real new start.
  //
  // Keyed on the real inputs, NOT on startGame's identity: a re-created closure
  // is not a new game. The first-run language modal is exactly that case — it
  // overlays whatever screen loads first, and picking a language makes i18n
  // hand out a new `t`, re-creating anything holding it. Re-running the effect
  // then minted a SECOND server session and orphaned the first, which reported
  // an abandon it never earned.
  const autoStartedForRef = useRef<string | null>(null);
  useEffect(() => {
    const key = `${sport}|${difficulty}`;
    if (autoStartedForRef.current === key) return;
    autoStartedForRef.current = key;
    void startGame();
  }, [sport, difficulty, startGame]);

  // Leaving mid-game. Reads the session through a ref so the cleanup sees the
  // session that was live at unmount rather than the one captured at mount.
  // abandonRun ignores runs that already ended, so a finished game can never
  // be reported as abandoned.
  const liveSessionRef = useRef<string | null>(null);
  liveSessionRef.current = sessionId;
  useEffect(() => () => abandonRun(liveSessionRef.current), []);

  useAntiCheat(
    useCallback(() => {
      if (!sessionId || gameOver || loading || startupState) return;
      penalizeTabSwitchMut({ sessionId }).then((res) => {
        if (res.penalized) {
          setGameOver(true);
          setScore(res.score);
          // A forfeit is a real end state, not an exit — the server has already
          // closed the session, so this run can never be abandoned afterwards.
          completeRun(sessionId, { score: res.score, result: "loss" });
          toast.error(t("higherLower.tabSwitchEnded"));
        }
      });
    }, [sessionId, gameOver, loading, startupState, penalizeTabSwitchMut, t]),
    { warningMessage: t("higherLower.tabSwitchWarning") },
  );

  const handleGuess = async (guess: "higher" | "lower") => {
    if (!sessionId || animating || gameOver || guessInFlight.current) return;
    guessInFlight.current = true;
    setAnimating(true);
    setPendingGuess(guess);

    try {
      const result = await makeGuessMut({ sessionId, guess });
      // Counted before any terminal report below, which reads the tally: every
      // resolved call is an answered question, right or wrong.
      noteQuestionAnswered(sessionId);
      setFeedback({ correct: result.correct, value: result.playerBValue });

      if (result.correct) {
        setScore(result.score);
        setStreak(result.streak);

        if (result.gameOver) {
          setEndReason(result.endReason ?? null);
          setGameOver(true);
          // The server only ends a CORRECT call when the pool ran dry, so this
          // is the one way out of this mode still standing.
          completeRun(sessionId, { score: result.score, result: "win" });
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
        // Reported HERE rather than from inside the 1200ms timeout below: the
        // run is over the instant the server rejects the guess, and the delay
        // is presentation only. A player who bounces during the reveal has
        // still finished the game, and the unmount cleanup would otherwise get
        // there first and file it as abandoned.
        completeRun(sessionId, { score: result.score, result: "loss" });
        // Reveal the losing value for a beat BEFORE mounting the game-over
        // actions (mirrors the correct-path delay above). This keeps any
        // tappable control OUT of the guess buttons' screen region while the
        // tap that fired this guess is still completing, so that tap's
        // trailing `click` can't land on — and auto-activate — the freshly
        // mounted "Play Again"/"Home" buttons (a ghost-click that would
        // silently restart the round with a new comparison).
        setTimeout(() => setGameOver(true), 1200);
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
      : t("higherLower.seasonRange", { start: season, end: season + 1 })
    : null;
  const displayLabel = contextLabel || context;

  const metrics = { score, streak };

  if (loading) {
    return (
      <PlayStage title={t("higherLower.title")} onExit={() => navigate(SHELL_ROUTES.home)}>
        <div className="flex items-center justify-center py-16">
          <p className="font-heading font-bold text-lg animate-pulse">{t("higherLower.loading")}</p>
        </div>
      </PlayStage>
    );
  }

  if (startupState) {
    return (
      <PlayStage
        title={t("higherLower.title")}
        onExit={() => navigate(SHELL_ROUTES.home)}
        exitLabel={t("higherLower.quit")}
      >
        <div className="flex flex-col items-center justify-center py-10">
          <NeoCard color="primary" shadow="lg" className="w-full text-center py-8 px-5">
            <p className="font-heading font-bold text-2xl">
              {startupState === "unsupported"
                ? t("higherLower.unsupportedTitle")
                : t("higherLower.startFailedTitle")}
            </p>
            <p className="text-sm text-muted-foreground mt-3">
              {startupState === "unsupported"
                ? t("higherLower.unsupportedMessage")
                : t("higherLower.startFailedMessage")}
            </p>

            <div className="grid grid-cols-1 gap-3 mt-6">
              {startupState === "unsupported" ? (
                <NeoButton
                  variant="primary"
                  size="lg"
                  onClick={() => navigate("/difficulty?sport=football&mode=higher-lower")}
                >
                  {t("higherLower.playFootball")}
                </NeoButton>
              ) : (
                <NeoButton variant="primary" size="lg" onClick={startGame}>
                  {t("higherLower.tryAgain")}
                </NeoButton>
              )}
              <NeoButton
                variant="secondary"
                size="lg"
                onClick={() => navigate(SHELL_ROUTES.competeSportGrid(sport))}
              >
                {t("higherLower.backToCompete")}
              </NeoButton>
            </div>
          </NeoCard>
        </div>
      </PlayStage>
    );
  }

  return (
    <PlayStage
      title={t("higherLower.title")}
      subtitle={t("higherLower.subtitle")}
      onExit={() => navigate(SHELL_ROUTES.home)}
      exitLabel={t("higherLower.quit")}
      strip={<AmbientStrip metrics={metrics} />}
      right={<MetricsPanel metrics={metrics} />}
    >
      {/* Fit-to-viewport column: the mode-local header and the binary-call
          buttons are pinned (shrink-0); the two team panels flex to share the
          leftover height so both values + the buttons stay on one phone screen
          without scrolling. The PlayStage shell already locks the page at
          100dvh and hands this column a bounded height (h-full resolves
          against it); a scroll fallback remains for extreme/short viewports. */}
      <div className="flex flex-col h-full">
        {/* Stat context — collapsed to one line (league · season · stat). The
            shell's top bar already frames the "Who has more?" question, so the
            body just names the stat; the badge colour encodes team vs player. */}
        <div className="shrink-0 flex flex-wrap items-center justify-center gap-1.5 text-center mb-2">
          <NeoBadge color="yellow" size="sm">{displayLabel}</NeoBadge>
          {seasonDisplay && (
            <NeoBadge color="muted" size="sm">{seasonDisplay}</NeoBadge>
          )}
          <NeoBadge color={entityType === "team" ? "accent" : "pink"} size="sm">
            {formatStatKey(statKey)}
          </NeoBadge>
        </div>

        {/* Team panels — flex-1 min-h-0 so they shrink to fit; each panel
            shares the leftover height. min-h-0 is required or the panels won't
            shrink below their content and the column overflows. */}
        <div className="flex-1 min-h-0 flex flex-col gap-1.5">
          {/* Player A — value shown */}
          <NeoCard
            color="success"
            shadow="lg"
            className="flex-1 min-h-0 flex flex-col items-center justify-center text-center overflow-hidden py-2"
          >
            {playerAPhoto && (
              <img
                src={playerAPhoto}
                alt={playerAName}
                className="aspect-square h-[12dvh] max-h-[6rem] w-auto min-h-0 rounded-full neo-border object-cover mb-1.5"
              />
            )}
            <p className="font-heading font-bold text-lg truncate w-full px-3 shrink-0">{playerAName}</p>
            <p className="font-mono font-bold text-4xl leading-none mt-0.5 shrink-0">{playerAValue}</p>
          </NeoCard>

          {/* VS divider */}
          <div className="shrink-0 flex items-center justify-center">
            <div className="neo-border rounded-full bg-background px-3 py-0.5 font-heading font-bold text-xs">
              VS
            </div>
          </div>

          {/* Player B — value hidden until guess */}
          <NeoCard
            shadow="lg"
            className={`flex-1 min-h-0 flex flex-col items-center justify-center text-center overflow-hidden py-2 transition-all ${
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
                className="aspect-square h-[12dvh] max-h-[6rem] w-auto min-h-0 rounded-full neo-border object-cover mb-1.5"
              />
            )}
            <p className="font-heading font-bold text-lg truncate w-full px-3 shrink-0">{playerBName}</p>
            <p className="font-mono font-bold text-4xl leading-none mt-0.5 shrink-0">{feedback ? feedback.value : "?"}</p>
          </NeoCard>
        </div>

        {/* Action buttons — the binary call, docked at the bottom (shrink-0)
            so they're always on screen. */}
        {!gameOver && !feedback && (
          <div className="shrink-0 grid grid-cols-2 gap-3 mt-3">
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
              {pendingGuess === "higher" ? t("higherLower.checking") : t("higherLower.higher")}
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
              {pendingGuess === "lower" ? t("higherLower.checking") : t("higherLower.lower")}
            </NeoButton>
          </div>
        )}

        {/* Game over — docked (shrink-0) so the final score + actions stay on
            screen; the panels above flex to absorb the remaining height. */}
        {gameOver && (
          <div className="shrink-0 mt-3 space-y-2 animate-slide-up">
            <NeoCard color="primary" className="text-center py-3">
              <p className="font-heading font-bold text-lg">{t("higherLower.gameOver")}</p>
              <p className="font-mono font-bold text-3xl leading-none mt-0.5">{score}</p>
              <p className="text-[10px] opacity-80 mt-0.5">{t("higherLower.finalScore")}</p>
              {endReason === "pool_exhausted" && (
                <p className="text-[10px] opacity-80 mt-1">
                  {t("higherLower.poolExhausted")}
                </p>
              )}
            </NeoCard>
            <div className="grid grid-cols-2 gap-3">
              <NeoButton variant="primary" size="lg" onClick={startGame}>
                {t("higherLower.playAgain")}
              </NeoButton>
              <NeoButton variant="secondary" size="lg" onClick={() => navigate(SHELL_ROUTES.home)}>
                {t("higherLower.home")}
              </NeoButton>
            </div>
          </div>
        )}
      </div>
    </PlayStage>
  );
}
