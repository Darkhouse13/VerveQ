/**
 * Survival (solo) on the v2 shell — the REVEAL LADDER edition.
 *
 * Survival is protected: every gameplay decision stays server-authoritative —
 * `survivalSessions.startGame / submitGuess / requestHelp / skipChallenge /
 * endRun`, `games.completeSurvival`, and the tab-switch anti-cheat all live on
 * the server. The client only renders what the server projects: the initials,
 * the masked name (letters are filled in exclusively by server-side help-ladder
 * responses — the full name never reaches the client while a round is live),
 * the current pot, and the outcome flags (close call / ambiguous surname /
 * typo / hidden answer / earned life).
 *
 * Reveal Ladder rules, for orientation:
 * - each round is a pot (Easy 100 → Expert 300) that shrinks 15% of base per
 *   help press and floors at 10, so every round is finishable;
 * - one HELP button: 2 metadata clues, then letter-by-letter reveals;
 * - lives are only lost on committed wrong guesses (skips are free, budget 3);
 * - CASH OUT ends the run voluntarily and banks the score into ELO/results.
 *
 * VerveQ ONE P3.1: the run ends in place on the shared ResultScreen (it used
 * to leave the shell for the v1 /results and /daily-results pages); every
 * verdict lands in ONE fixed slot above the input (no banner + toast double);
 * lime is only the Submit button — the initials wear the mode accent and Cash
 * out is a secondary.
 */
import { useState, useEffect, useRef, useCallback, type ReactNode } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useMutation } from "convex/react";
import { notify } from "@/lib/notify";
import { Check, Coins, Flame, Zap } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { NeoButton } from "@/components/neo/NeoButton";
import { NeoInput } from "@/components/neo/NeoInput";
import { PlayStage } from "@/components/shell/play/PlayStage";
import { StageScore } from "@/components/shell/play/StageParts";
import { RevealedAnswer, VerdictBadge, VerdictSlot } from "@/components/shell/play/StageSignals";
import { MetricsPanel } from "@/components/shell/play/ambient";
import {
  DailySurvivalResult,
  NextTodayFor,
  SurvivalResult,
  type DailySurvivalResultData,
  type SurvivalResultData,
} from "@/components/shell/play/result/ModeResults";
import { useUtcMidnightCountdown } from "@/hooks/useUtcMidnightCountdown";
import { cn } from "@/lib/utils";
import { SHELL_ROUTES } from "@/lib/shellRoutes";
import { useAuth } from "@/contexts/AuthContext";
import { useAntiCheat } from "@/hooks/useAntiCheat";
import {
  startRun,
  noteQuestionAnswered,
  completeRun,
  abandonRun,
} from "@/lib/gameAnalytics";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { isAlreadyAttemptedError } from "@/lib/errors";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

interface ChallengeData {
  initials: string;
  difficulty: string;
  hint: string;
  maskedName: string;
  basePot: number;
  potValue: number;
  // Clue stages for THIS round's hint target (0 when it has no metadata —
  // then every help press reveals a letter). Server-decided per challenge.
  clueStages: number;
  lettersRemaining: number;
}

interface ClueI18n {
  key: string;
  vars: Record<string, string | number>;
}

const MASK_CHAR = "•";

/** The masked name as tappable-looking letter boxes, word by word. */
function MaskedName({ maskedName }: { maskedName: string }) {
  return (
    <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 mb-2">
      {maskedName.split(" ").map((word, wi) => (
        <div key={wi} className="flex gap-1">
          {Array.from(word).map((char, ci) =>
            char === MASK_CHAR ? (
              <div
                key={ci}
                className="neo-border rounded-sm w-7 h-9 bg-muted"
                aria-hidden
              />
            ) : /\p{L}|\p{N}/u.test(char) ? (
              <div
                key={ci}
                className="neo-border rounded-sm w-7 h-9 flex items-center justify-center bg-mode-accent text-ink"
              >
                <span className="font-heading font-bold text-body-sm">{char}</span>
              </div>
            ) : (
              <span
                key={ci}
                className="w-3 h-9 flex items-center justify-center font-heading font-bold text-body-sm"
              >
                {char}
              </span>
            ),
          )}
        </div>
      ))}
    </div>
  );
}

/**
 * Daily, already spent: a clean "come back at midnight" card, never an error
 * state — one attempt is the product rule, not a failure. The reset time is
 * the same ticking countdown the daily result screens use, and the way on is
 * the next unfinished daily.
 */
function PlayedToday({ onExit }: { onExit: () => void }) {
  const { t } = useTranslation("play");
  const time = useUtcMidnightCountdown();
  return (
    <PlayStage mode="daily-survival" title={t("survival.daily.title")} onExit={onExit} exitLabel={t("result.home")}>
      <div className="flex flex-col gap-3 py-2">
        <Card elevation="lifted" padding="lg" className="text-center">
          <Check size={32} strokeWidth={3} className="mx-auto mb-3 text-mode-accent" aria-hidden="true" />
          <h2 className="font-heading font-bold text-title mb-2">{t("survival.daily.playedTitle")}</h2>
          <p className="text-body-sm text-muted-foreground tabular-nums">{t("survival.daily.playedBody", { time })}</p>
        </Card>
        <NextTodayFor from="survival" mode="daily-survival" />
      </div>
    </PlayStage>
  );
}

/** What the one verdict slot says after a guess. */
type Verdict =
  | { kind: "close"; message: string }
  | { kind: "right"; answer: string; points: number; notes: string[] }
  | { kind: "wrong"; answer: string };

/**
 * The verdict, in the shared fixed slot (StageSignals) above the input, so
 * nothing jumps and nothing doubles up as a toast: ✓ / ✕ with the right answer
 * revealed in green. A close call is neutral (it costs nothing).
 */
function SurvivalVerdict({ verdict }: { verdict: Verdict | null }) {
  const { t } = useTranslation("play");
  let body: ReactNode = null;
  if (verdict?.kind === "close") {
    body = (
      <Badge tone="neutral" shape="tag" size="md" className="normal-case text-body-sm">
        {verdict.message}
      </Badge>
    );
  } else if (verdict?.kind === "right") {
    body = (
      <>
        <VerdictBadge right testId="survival-right">
          {t("result.right")} · {t("result.pts", { score: `+${verdict.points}` })}
        </VerdictBadge>
        <RevealedAnswer>{verdict.answer}</RevealedAnswer>
        {verdict.notes.length > 0 && (
          <p className="basis-full text-meta font-bold text-muted-foreground">{verdict.notes.join(" · ")}</p>
        )}
      </>
    );
  } else if (verdict?.kind === "wrong") {
    body = (
      <>
        <VerdictBadge right={false} testId="survival-wrong">
          {t("result.wrong")}
        </VerdictBadge>
        <RevealedAnswer>{verdict.answer}</RevealedAnswer>
      </>
    );
  }
  return (
    <VerdictSlot className="mb-3 min-h-14" testId="survival-verdict">
      {body}
    </VerdictSlot>
  );
}

/**
 * `daily` runs the shared Daily Survival instead of a ranked run: same Reveal
 * Ladder engine and UI, but the server serves the frozen 10-round queue, the
 * result lands in dailyAttempts (never ELO), one attempt per UTC day, and
 * leaving the tab forfeits outright.
 */
function SurvivalRun({
  daily,
  onFinish,
  onExit,
}: {
  daily: boolean;
  onFinish: (result: SurvivalResultData | DailySurvivalResultData) => void;
  onExit: () => void;
}) {
  const { t } = useTranslation("play");
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const sport = daily ? "football" : params.get("sport") || "football";
  const { user, isLoading: authLoading, isAuthenticated, accountState } = useAuth();

  const [sessionId, setSessionId] = useState<Id<"survivalSessions"> | null>(
    null,
  );
  const [lives, setLives] = useState(3);
  const [score, setScore] = useState(0);
  const [round, setRound] = useState(1);
  const [challenge, setChallenge] = useState<ChallengeData | null>(null);
  const [guess, setGuess] = useState("");
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  // Daily only: today's attempt is already spent (server-enforced).
  const [playedToday, setPlayedToday] = useState(false);

  // Reveal Ladder round state — updated by requestHelp responses and reset
  // whenever a fresh challenge arrives.
  const [maskedName, setMaskedName] = useState("");
  const [potValue, setPotValue] = useState(0);
  const [basePot, setBasePot] = useState(0);
  const [lettersRemaining, setLettersRemaining] = useState(0);
  const [helpStage, setHelpStage] = useState(0);
  const [clueStages, setClueStages] = useState(0);
  const [clues, setClues] = useState<ClueI18n[]>([]);
  const [helpLoading, setHelpLoading] = useState(false);

  // Speed streak state
  const [speedStreak, setSpeedStreak] = useState(0);
  const [isOnFire, setIsOnFire] = useState(false);
  const correctCountRef = useRef(0);
  // Daily share grid: one emoji per finished round (🟩 clean, 🟨 helped,
  // 🟥 miss, ⬜ skip) — client-built exactly like the daily quiz's
  // shareString; display-only, so no server round-trip needed.
  const dailyOutcomesRef = useRef<string[]>([]);

  // Skip budget (free — lives are never lost on skips)
  const [skipsLeft, setSkipsLeft] = useState(3);

  // Close call state
  const [closeCallShake, setCloseCallShake] = useState(false);

  // Anti-cheat state: first offense is a warning (pot floored), repeats cost a life
  const [cheatModal, setCheatModal] = useState<"warning" | "penalty" | null>(
    null,
  );
  const [shakeKey, setShakeKey] = useState(0);
  const [endingRun, setEndingRun] = useState(false);
  const [confirmCashOut, setConfirmCashOut] = useState(false);

  const startTime = useRef(Date.now());

  const startGameMut = useMutation(api.survivalSessions.startGame);
  const startDailyGameMut = useMutation(api.survivalSessions.startDailyGame);
  const submitGuessMut = useMutation(api.survivalSessions.submitGuess);
  const helpMutation = useMutation(api.survivalSessions.requestHelp);
  const skipMut = useMutation(api.survivalSessions.skipChallenge);
  const endRunMut = useMutation(api.survivalSessions.endRun);
  const completeSurvivalMut = useMutation(api.games.completeSurvival);
  const penalizeTabSwitchMut = useMutation(
    api.survivalSessions.penalizeTabSwitch,
  );

  const applyChallenge = useCallback((next: ChallengeData) => {
    setChallenge(next);
    setMaskedName(next.maskedName);
    setPotValue(next.potValue);
    setBasePot(next.basePot);
    setClueStages(next.clueStages);
    setLettersRemaining(next.lettersRemaining);
    setHelpStage(0);
    setClues([]);
  }, []);

  // Read through a ref, NOT as a dependency of the start effect below: adding
  // accountState there would re-run it and mint a brand-new server session on
  // every auth transition. `isAuthenticated` is deliberately not reused as the
  // reported identity either — it counts tab-local guests with no server
  // identity as authenticated, which is only good enough for the route gate.
  const accountStateRef = useRef(accountState);
  accountStateRef.current = accountState;

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      navigate("/", { replace: true });
      return;
    }
    (async () => {
      try {
        if (daily) {
          const data = await startDailyGameMut({});
          // `resumed` means the server handed back an attempt that was ALREADY
          // running (a mid-run refresh), not a new one. Daily is capped at one
          // attempt per UTC day, so counting a start here would report more
          // daily games than the server can create — a refresh loop could
          // invent them without end. The earlier load already reported this
          // attempt's start; leaving the run unregistered means the registry
          // no-ops its completion and its abandon too, which is the honest
          // trade: silence for a run this page load did not begin.
          if (!data.resumed) {
            startRun(data.sessionId, "daily-survival", {
              accountState: accountStateRef.current,
            });
          }
          setSessionId(data.sessionId);
          setLives(data.lives);
          setScore(data.score);
          setRound(data.round);
          setSkipsLeft(data.skipsLeft);
          applyChallenge(data.challenge);
          // Mid-run refresh: replay the help ladder the server already
          // granted (mask/pot come back inside data.challenge).
          if (data.resumed) {
            setHelpStage(data.helpStage);
            setClues(data.clues);
          }
        } else {
          const data = await startGameMut({ sport });
          // Ranked runs never resume — the server inserts a fresh session on
          // every call — so a resolved start is always a new game.
          startRun(data.sessionId, "survival", {
            accountState: accountStateRef.current,
          });
          setSessionId(data.sessionId);
          setLives(data.lives);
          setScore(data.score);
          setRound(data.round);
          setSkipsLeft(data.skipsLeft);
          applyChallenge(data.challenge);
        }
        setLoading(false);
        startTime.current = Date.now();
      } catch (error) {
        if (
          daily &&
          isAlreadyAttemptedError(error)
        ) {
          setPlayedToday(true);
          setLoading(false);
          return;
        }
        notify.error(t("survival.failedToStart"));
        navigate(-1);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, isAuthenticated]);

  // Leaving mid-run. Reads the session through a ref so the cleanup sees the
  // session that was live at unmount rather than the one captured at mount.
  // abandonRun ignores runs that already ended, so the cash-out and forfeit
  // exits — which navigate, and so unmount — can never be filed as abandons.
  const liveSessionRef = useRef<string | null>(null);
  liveSessionRef.current = sessionId;
  useEffect(() => () => abandonRun(liveSessionRef.current), []);

  // Anti-cheat: warn first (pot floored), penalize repeats
  useAntiCheat(
    useCallback(() => {
      if (!sessionId || !challenge || finished.current) return;
      penalizeTabSwitchMut({ sessionId, currentRound: round }).then((res) => {
        if (!res.penalized) return;
        setShakeKey((k) => k + 1);
        // Daily rule: leaving the tab forfeits the one attempt outright.
        if ("dailyForfeit" in res && res.dailyForfeit) {
          setCheatModal("penalty");
          notify.error(t("survival.daily.forfeited"), { duration: 4000 });
          setTimeout(() => goToResults(0, round, true), 2000);
          return;
        }
        if (res.warning) {
          setCheatModal("warning");
          if (typeof res.potValue === "number") setPotValue(res.potValue);
        } else {
          setCheatModal("penalty");
          setLives(res.lives);
          if (res.gameOver) {
            setTimeout(() => goToResults(score, round), 2000);
          }
        }
      });
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sessionId, round, challenge]),
    { warningMessage: t("survival.tabSwitchWarning") },
  );

  const finished = useRef(false);
  const goToResults = async (finalScore: number, finalRound: number, forfeited = false) => {
    // One ending per run, however many paths race to it.
    if (finished.current) return;
    finished.current = true;
    // Every way this run can end funnels through here — lives gone, skip that
    // emptied the queue, anti-cheat forfeit, and CASH OUT. Cash out is a
    // voluntary end but still a completion, not an abandon: the player banked
    // a final score and the server closed the session, which is the opposite
    // of walking out mid-round. Reported before the result replaces this run
    // (unmounting it), so the unmount finds the run already ended; daily is
    // included even though it never reaches completeSurvival.
    completeRun(sessionId, { score: finalScore });
    // Daily runs end on the daily result (share copy included) and never call
    // completeSurvival — the server rejects daily sessions there.
    if (daily) {
      onFinish({
        score: finalScore,
        rounds: finalRound,
        correctCount: correctCountRef.current,
        shareString: dailyOutcomesRef.current.join("") || undefined,
        forfeited,
      });
      return;
    }
    let eloChange: number | null = null;
    let newElo: number | null = null;
    let kFactor: number | undefined;
    let kFactorLabel: string | undefined;
    if (user && sessionId) {
      try {
        const res = await completeSurvivalMut({ sessionId });
        eloChange = res.eloChange;
        newElo = res.newElo;
        kFactor = res.kFactor;
        kFactorLabel = res.kFactorLabel;
      } catch {
        /* continue */
      }
    }
    onFinish({
      score: finalScore,
      rounds: finalRound,
      correctCount: correctCountRef.current,
      eloChange,
      newElo,
      sport,
      kFactor,
      kFactorLabel,
    });
  };

  const handleGuess = async () => {
    if (!guess.trim() || !sessionId) return;
    setSubmitting(true);
    try {
      const res = await submitGuessMut({
        sessionId,
        guess: guess.trim(),
      });

      // Close call / ambiguous surname: shake, keep input, free retry
      if (res.closeCall) {
        setCloseCallShake(true);
        setTimeout(() => setCloseCallShake(false), 600);
        setVerdict({
          kind: "close",
          message: res.ambiguousSurname
            ? t("survival.ambiguousSurname")
            : t("survival.closeCheckSpelling"),
        });
        setSubmitting(false);
        return;
      }

      // Past the close-call retry above, the guess is committed — that is the
      // point a question is genuinely resolved. Counted before any goToResults
      // below, which reads the tally, so the last guess of a run still lands.
      noteQuestionAnswered(sessionId);
      setLives(res.lives);
      setScore(res.score);
      setRound(res.round);
      setGuess("");

      if (res.correct) {
        correctCountRef.current += 1;
        if (daily) {
          dailyOutcomesRef.current.push(helpStage > 0 ? "🟨" : "🟩");
        }
        setSpeedStreak(res.speedStreak ?? 0);
        setIsOnFire(res.isOnFire ?? false);
        // How the guess was accepted, the hidden-answer bonus and an earned
        // life ride in the verdict slot under the verdict — not as toasts.
        const notes: string[] = [];
        if (res.surnameMatch) notes.push(t("survival.surnameAccepted", { answer: res.correctAnswer }));
        else if (res.typoAccepted) notes.push(t("survival.typoAccepted", { answer: res.correctAnswer }));
        if (res.isHiddenAnswer) notes.push(t("survival.hiddenAnswerFound"));
        if (res.earnedLife) notes.push(t("survival.plusOneLife"));
        setVerdict({ kind: "right", answer: res.correctAnswer ?? "", points: res.pointsEarned, notes });
      } else {
        if (daily) dailyOutcomesRef.current.push("🟥");
        setVerdict({ kind: "wrong", answer: res.correctAnswer ?? "" });
        setSpeedStreak(0);
        setIsOnFire(false);
      }

      if (res.gameOver) {
        goToResults(res.score, res.round);
      } else if (res.nextChallenge) {
        const next = res.nextChallenge;
        setTimeout(() => {
          applyChallenge(next);
          setVerdict(null);
        }, 1500);
      }
    } catch {
      notify.error(t("survival.failedToSubmit"));
    } finally {
      setSubmitting(false);
    }
  };

  const helpExhausted = helpStage >= clueStages && lettersRemaining <= 0;

  const handleHelp = async () => {
    if (!sessionId || helpLoading || helpExhausted) return;
    setHelpLoading(true);
    try {
      const res = await helpMutation({ sessionId });
      if (res.kind === "clue" && res.hintI18n) {
        setClues((prev) => [...prev, res.hintI18n as ClueI18n]);
      }
      setMaskedName(res.maskedName);
      setPotValue(res.potValue);
      setLettersRemaining(res.lettersRemaining);
      setHelpStage(res.stage);
    } catch {
      notify.error(t("survival.failedToGetHelp"));
    } finally {
      setHelpLoading(false);
    }
  };

  const handleSkip = async () => {
    if (!sessionId || skipsLeft <= 0) return;
    try {
      const res = await skipMut({ sessionId });
      if (daily) dailyOutcomesRef.current.push("⬜");
      setSkipsLeft(res.skipsLeft);
      setVerdict(null);
      setSpeedStreak(0);
      setIsOnFire(false);
      if (res.gameOver) {
        goToResults(res.score, res.round);
      } else if (res.challenge) {
        applyChallenge(res.challenge);
        setRound(res.round);
      }
    } catch {
      notify.error(t("survival.failedToSkip"));
    }
  };

  const handleCashOut = async () => {
    if (!sessionId || endingRun) return;
    setEndingRun(true);
    try {
      const res = await endRunMut({ sessionId });
      await goToResults(res.score, res.round);
    } catch {
      notify.error(t("survival.failedToCashOut"));
      setEndingRun(false);
    }
  };

  const metrics = { score, lives, streak: speedStreak };
  const mode = daily ? "daily-survival" : "survival";

  if (loading) {
    return (
      <PlayStage
        mode={mode}
        title={daily ? t("survival.daily.title") : t("survival.title")}
        onExit={onExit}
      >
        <div className="flex items-center justify-center py-16">
          <p className="font-heading font-bold text-title-sm animate-pulse motion-reduce:animate-none">
            {t("survival.starting")}
          </p>
        </div>
      </PlayStage>
    );
  }

  if (playedToday) return <PlayedToday onExit={onExit} />;

  const initials = challenge?.initials.split("") || [];

  return (
    <PlayStage
      title={daily ? t("survival.daily.title") : t("survival.title")}
      subtitle={
        daily
          ? t("survival.daily.round", { round })
          : t("survival.round", { round })
      }
      mode={mode}
      onExit={onExit}
      exitLabel={t("survival.quit")}
      score={
        <StageScore
          icon={<Zap size={16} strokeWidth={3} />}
          value={score}
          label={t("stage.scoreLabel", { value: score })}
          detail={t("survival.livesDetail", { count: lives })}
        />
      }
      right={<MetricsPanel metrics={metrics} />}
    >
      <div
        key={shakeKey}
        className={`flex flex-col ${shakeKey > 0 ? "animate-shake" : ""} ${isOnFire ? "on-fire-bg" : ""}`}
      >
        {/* On-fire / streak banner — Survival's signature flair, kept in column. */}
        {speedStreak >= 2 && (
          <div className="flex justify-center mb-3">
            <Badge
              tone="mode"
              shape="tag"
              size="md"
              className={cn(isOnFire && "animate-pulse-urgent motion-reduce:animate-none")}
            >
              {isOnFire && <Flame size={14} strokeWidth={3} aria-hidden="true" />}
              {isOnFire
                ? t("survival.onFire")
                : t("survival.streak", { count: speedStreak })}
            </Badge>
          </div>
        )}

        {/* Initials + masked name card — panic state when 1 life */}
        <Card
          elevation="lifted"
          className={cn(
            "relative flex flex-col items-center py-6 mb-3",
            // Last life: the card's edge pulses in the mode accent.
            lives === 1 && "border-4 border-mode-accent animate-pulse motion-reduce:animate-none",
          )}
        >
          <p className="text-body-sm text-muted-foreground font-heading mb-3">
            {t("survival.whoHasInitials")}
          </p>
          <div className="flex gap-4 mb-2">
            {initials.map((letter, i) => (
              <div
                key={i}
                className="neo-border neo-shadow-lg rounded-lg w-20 h-20 flex items-center justify-center bg-mode-accent text-ink"
              >
                <span className="font-heading font-bold text-display">{letter}</span>
              </div>
            ))}
          </div>
          <p className="text-meta text-muted-foreground font-body mb-3">
            {t("survival.anyPlayerCounts")}
          </p>

          {/* The Reveal Ladder mask stays hidden until help is requested —
              shown up front, the name's letter boxes read as a constraint on
              the answer, when really any player with the initials counts.
              Once visible it is labelled as the famous-match hint target. */}
          {helpStage > 0 && maskedName && (
            <div className="flex flex-col items-center">
              <p className="font-mono text-eyebrow text-muted-foreground uppercase mb-2">
                {t("survival.maskLabel")}
              </p>
              <MaskedName maskedName={maskedName} />
            </div>
          )}

          {/* The round's pot: what a right answer is worth now (help shrinks
              it). The round number is already in the header. */}
          <div className="flex items-center gap-3 mt-3">
            <Badge tone="neutral" shape="tag" size="md" data-shrunk={potValue < basePot || undefined}>
              <Coins size={14} strokeWidth={3} aria-hidden="true" />
              {t("survival.pot", { points: potValue })}
            </Badge>
          </div>
        </Card>

        {/* Clues from the help ladder — one caption states the target so the
            bare facts below don't read as random noise. */}
        {clues.length > 0 && (
          <div className="space-y-2 mb-3">
            <p className="text-meta text-muted-foreground font-body">
              {t("survival.hintsTarget")}
            </p>
            {clues.map((h, i) => (
              <Card
                key={i}
                tone="paper"
                padding="sm"
                elevation="flat"
                className="animate-slide-up"
              >
                <p className="text-body-sm font-body">
                  <strong>{t("survival.clueLabel", { number: i + 1 })}</strong>{" "}
                  {t(
                    `survival.hintBody.${h.key}`,
                    // `sport` is the only var that localizes (small closed enum);
                    // all other vars are canonical proper nouns, passed through.
                    "sport" in h.vars
                      ? { ...h.vars, sport: t(`survival.sportName.${h.vars.sport}`) }
                      : h.vars,
                  )}
                </p>
              </Card>
            ))}
          </div>
        )}

        <SurvivalVerdict verdict={verdict} />

        {/* Input — a close call shakes it */}
        <NeoInput
          placeholder={t("survival.inputPlaceholder")}
          value={guess}
          onChange={(e) => setGuess(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleGuess()}
          className={cn("mb-3", closeCallShake && "border-4 border-foreground animate-shake-horizontal")}
        />

        {/* Submit */}
        <NeoButton
          variant="primary"
          size="full"
          className="mb-3"
          onClick={handleGuess}
          disabled={!guess.trim() || submitting}
        >
          {submitting ? t("survival.checking") : t("survival.submitGuess")}
        </NeoButton>

        {/* Help + Skip + Cash Out */}
        <div className="grid grid-cols-3 gap-3">
          <NeoButton
            variant="blue"
            size="md"
            onClick={handleHelp}
            disabled={helpLoading || helpExhausted}
          >
            {helpLoading
              ? t("survival.gettingHelp")
              : helpExhausted
                ? t("survival.nothingToReveal")
                : helpStage < clueStages
                  ? t("survival.helpClue")
                  : t("survival.helpLetter")}
          </NeoButton>
          <NeoButton
            variant="secondary"
            size="md"
            onClick={handleSkip}
            disabled={skipsLeft <= 0}
          >
            {skipsLeft > 0
              ? t("survival.skip", { count: skipsLeft })
              : t("survival.noSkipsLeft")}
          </NeoButton>
          {/* Secondary: the screen's one lime action is Submit. */}
          <NeoButton
            variant="secondary"
            size="md"
            onClick={daily ? () => setConfirmCashOut(true) : handleCashOut}
            disabled={endingRun}
          >
            {endingRun ? t("survival.cashingOut") : t("survival.cashOut")}
          </NeoButton>
        </div>
      </div>

      {/* Daily runs are one a day, so cashing out asks first. */}
      <ConfirmDialog
        open={confirmCashOut}
        onOpenChange={setConfirmCashOut}
        title={t("survival.cashOutConfirmTitle")}
        description={t("survival.cashOutConfirmBody")}
        confirmLabel={t("survival.cashOutConfirmYes")}
        cancelLabel={t("survival.cashOutConfirmNo")}
        stacked
        onConfirm={() => {
          setConfirmCashOut(false);
          void handleCashOut();
        }}
      />

      {/* Anti-cheat modal: warning (pot floored) vs penalty (life lost) */}
      <Dialog
        open={cheatModal !== null}
        onOpenChange={(open) => !open && setCheatModal(null)}
      >
        <DialogContent className="neo-border neo-shadow-lg max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-heading text-title-sm text-center">
              {cheatModal === "warning"
                ? `⚠️ ${t("survival.tabSwitchCaughtTitle")} ⚠️`
                : `\u{1F6A8} ${t("survival.cheatingDetected")} \u{1F6A8}`}
            </DialogTitle>
            <DialogDescription className="text-center text-body-sm mt-2">
              {cheatModal === "warning"
                ? t("survival.tabSwitchWarningDescription")
                : t("survival.cheatingDescription")}
            </DialogDescription>
          </DialogHeader>
          <NeoButton
            variant="secondary"
            size="full"
            onClick={() => setCheatModal(null)}
            className="mt-2"
          >
            {t("survival.iUnderstand")}
          </NeoButton>
        </DialogContent>
      </Dialog>
    </PlayStage>
  );
}

/**
 * `daily` runs the shared Daily Survival instead of a ranked run (see
 * SurvivalRun). The result replaces the run in place; "Play again" (ranked
 * only — the daily is one attempt) mounts a fresh run, which starts a fresh
 * server session.
 */
export default function SurvivalPlayScreen({ daily = false }: { daily?: boolean }) {
  const navigate = useNavigate();
  const [result, setResult] = useState<SurvivalResultData | DailySurvivalResultData | null>(null);
  const [run, setRun] = useState(0);
  const exit = () => navigate(SHELL_ROUTES.home);

  if (result) {
    return daily ? (
      <DailySurvivalResult result={result as DailySurvivalResultData} onExit={exit} />
    ) : (
      <SurvivalResult
        result={result as SurvivalResultData}
        onExit={exit}
        onPlayAgain={() => {
          setResult(null);
          setRun((n) => n + 1);
        }}
      />
    );
  }
  return <SurvivalRun key={run} daily={daily} onFinish={setResult} onExit={exit} />;
}
