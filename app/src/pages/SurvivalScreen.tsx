/**
 * Legacy (v1) Survival screen — kept as the rollback seam for the v2 shell.
 * Ported to the Reveal Ladder server API (requestHelp / free skips / endRun /
 * pot-based scoring) so a shell rollback still plays the live game. Copy is
 * raw English by design (v1 screens are untranslated).
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { NeoCard } from "@/components/neo/NeoCard";
import { NeoButton } from "@/components/neo/NeoButton";
import { NeoInput } from "@/components/neo/NeoInput";
import { NeoBadge } from "@/components/neo/NeoBadge";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Heart } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useAntiCheat } from "@/hooks/useAntiCheat";
import { ExitGameButton } from "@/components/ExitGameButton";
import { toast } from "sonner";
import type { Id } from "../../convex/_generated/dataModel";
import type { GameResultState } from "@/types/api";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface ChallengeData {
  initials: string;
  difficulty: string;
  hint: string;
  maskedName: string;
  basePot: number;
  potValue: number;
  lettersRemaining: number;
}

const MASK_CHAR = "•";
/** Ladder stages 1-2 are clues; must mirror CLUE_STAGES on the server. */
const CLUE_STAGES = 2;

export default function SurvivalScreen() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const sport = params.get("sport") || "football";
  const { user, isLoading: authLoading, isAuthenticated } = useAuth();

  const [sessionId, setSessionId] = useState<Id<"survivalSessions"> | null>(
    null,
  );
  const [lives, setLives] = useState(3);
  const [score, setScore] = useState(0);
  const [round, setRound] = useState(1);
  const [challenge, setChallenge] = useState<ChallengeData | null>(null);
  const [guess, setGuess] = useState("");
  const [feedback, setFeedback] = useState<{
    correct: boolean;
    answer: string;
    points: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Reveal Ladder round state
  const [maskedName, setMaskedName] = useState("");
  const [potValue, setPotValue] = useState(0);
  const [basePot, setBasePot] = useState(0);
  const [lettersRemaining, setLettersRemaining] = useState(0);
  const [helpStage, setHelpStage] = useState(0);
  const [clues, setClues] = useState<string[]>([]);
  const [helpLoading, setHelpLoading] = useState(false);

  // Speed streak state
  const [speedStreak, setSpeedStreak] = useState(0);
  const [isOnFire, setIsOnFire] = useState(false);
  const correctCountRef = useRef(0);

  // Skip budget (free — lives are never lost on skips)
  const [skipsLeft, setSkipsLeft] = useState(3);

  // Close call state
  const [closeCallShake, setCloseCallShake] = useState(false);

  // Earn-a-life animation
  const [showEarnedLife, setShowEarnedLife] = useState(false);

  // Anti-cheat state: first offense warns (pot floored), repeats cost a life
  const [cheatModal, setCheatModal] = useState<"warning" | "penalty" | null>(
    null,
  );
  const [shakeKey, setShakeKey] = useState(0);
  const [endingRun, setEndingRun] = useState(false);

  const startTime = useRef(Date.now());

  const startGameMut = useMutation(api.survivalSessions.startGame);
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
    setLettersRemaining(next.lettersRemaining);
    setHelpStage(0);
    setClues([]);
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      navigate("/", { replace: true });
      return;
    }
    (async () => {
      try {
        const data = await startGameMut({ sport });
        setSessionId(data.sessionId);
        setLives(data.lives);
        setScore(data.score);
        setRound(data.round);
        setSkipsLeft(data.skipsLeft);
        applyChallenge(data.challenge);
        setLoading(false);
        startTime.current = Date.now();
      } catch {
        toast.error("Failed to start survival");
        navigate(-1);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, isAuthenticated]);

  // Anti-cheat: warn first (pot floored), penalize repeats
  useAntiCheat(
    useCallback(() => {
      if (!sessionId || !challenge) return;
      penalizeTabSwitchMut({ sessionId, currentRound: round }).then((res) => {
        if (!res.penalized) return;
        setShakeKey((k) => k + 1);
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
    { warningMessage: "Don't switch tabs — it will cost you" },
  );

  const goToResults = async (finalScore: number, finalRound: number) => {
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
    const state: GameResultState = {
      score: finalScore,
      total: finalRound,
      correctCount: correctCountRef.current,
      avgTime: 0,
      eloChange,
      newElo,
      sport,
      mode: "survival",
      kFactor,
      kFactorLabel,
    };
    navigate("/results", { state });
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
        toast.warning(
          res.ambiguousSurname
            ? "More than one player has that surname — type the full name."
            : "CLOSE! Check your spelling.",
          { duration: 3000 },
        );
        setSubmitting(false);
        return;
      }

      setFeedback({
        correct: res.correct,
        answer: res.correctAnswer ?? "",
        points: res.pointsEarned,
      });
      setLives(res.lives);
      setScore(res.score);
      setRound(res.round);
      setGuess("");

      if (res.correct) {
        correctCountRef.current += 1;
        setSpeedStreak(res.speedStreak ?? 0);
        setIsOnFire(res.isOnFire ?? false);
        if (res.surnameMatch) {
          toast.success(`SURNAME ACCEPTED: ${res.correctAnswer}`, {
            duration: 3000,
          });
        } else if (res.typoAccepted) {
          toast.warning(`TYPO ACCEPTED: Did you mean ${res.correctAnswer}?`, {
            duration: 3000,
          });
        }
        if (res.isHiddenAnswer) {
          toast.success("HIDDEN ANSWER FOUND!", { duration: 4000 });
        }
        if (res.earnedLife) {
          setShowEarnedLife(true);
          setTimeout(() => setShowEarnedLife(false), 1500);
          toast.success("+1 LIFE", { duration: 3000 });
        }
      } else {
        setSpeedStreak(0);
        setIsOnFire(false);
      }

      if (res.gameOver) {
        goToResults(res.score, res.round);
      } else if (res.nextChallenge) {
        const next = res.nextChallenge;
        setTimeout(() => {
          applyChallenge(next);
          setFeedback(null);
        }, 1500);
      }
    } catch {
      toast.error("Failed to submit guess");
    } finally {
      setSubmitting(false);
    }
  };

  const helpExhausted = helpStage >= CLUE_STAGES && lettersRemaining <= 0;

  const handleHelp = async () => {
    if (!sessionId || helpLoading || helpExhausted) return;
    setHelpLoading(true);
    try {
      const res = await helpMutation({ sessionId });
      if (res.kind === "clue" && res.hintText) {
        setClues((prev) => [...prev, res.hintText as string]);
      }
      setMaskedName(res.maskedName);
      setPotValue(res.potValue);
      setLettersRemaining(res.lettersRemaining);
      setHelpStage(res.stage);
    } catch {
      toast.error("Failed to get help");
    } finally {
      setHelpLoading(false);
    }
  };

  const handleSkip = async () => {
    if (!sessionId || skipsLeft <= 0) return;
    try {
      const res = await skipMut({ sessionId });
      setSkipsLeft(res.skipsLeft);
      setFeedback(null);
      setSpeedStreak(0);
      setIsOnFire(false);
      if (res.gameOver) {
        goToResults(res.score, res.round);
      } else if (res.challenge) {
        applyChallenge(res.challenge);
        setRound(res.round);
      }
    } catch {
      toast.error("Failed to skip");
    }
  };

  const handleCashOut = async () => {
    if (!sessionId || endingRun) return;
    setEndingRun(true);
    try {
      const res = await endRunMut({ sessionId });
      await goToResults(res.score, res.round);
    } catch {
      toast.error("Failed to cash out");
      setEndingRun(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="font-heading font-bold text-lg animate-pulse">
          Starting survival...
        </p>
      </div>
    );
  }

  const initials = challenge?.initials.split("") || [];

  return (
    <div
      key={shakeKey}
      className={`min-h-screen bg-background px-5 py-5 flex flex-col ${shakeKey > 0 ? "animate-shake" : ""} ${isOnFire ? "on-fire-bg" : ""}`}
    >
      <div className="mb-3">
        <ExitGameButton title="Quit survival run?" description="Leaving without cashing out abandons your banked points." />
      </div>
      {/* Header: Lives / Streak / Score */}
      <div className="flex items-center justify-between mb-4">
        <div className="relative">
          <div className={`flex gap-1.5 ${lives === 1 ? "animate-pulse" : ""}`}>
            {Array.from({ length: 3 }).map((_, i) => (
              <Heart
                key={i}
                size={24}
                strokeWidth={2.5}
                className={`neo-border rounded ${i < lives ? "fill-destructive text-destructive" : "text-muted"}`}
              />
            ))}
          </div>
          {showEarnedLife && (
            <span className="absolute -top-2 left-1/2 -translate-x-1/2 text-success font-heading font-bold text-sm animate-float-up pointer-events-none">
              +1 LIFE
            </span>
          )}
        </div>
        {speedStreak >= 2 && (
          <div
            className={`neo-border rounded px-2 py-1 ${isOnFire ? "bg-destructive text-destructive-foreground animate-pulse-urgent" : "bg-primary text-primary-foreground"}`}
          >
            <span className="font-heading font-bold text-xs uppercase">
              {isOnFire ? "\u{1F525} ON FIRE" : `⚡ STREAK: x${speedStreak}`}
            </span>
          </div>
        )}
        <p className="font-mono font-bold text-lg">Score: {score}</p>
      </div>

      {/* Feedback banner */}
      {feedback && (
        <div
          className={`neo-border rounded-lg p-3 mb-5 flex items-center gap-2 ${feedback.correct ? "bg-success text-success-foreground" : "bg-destructive text-destructive-foreground"}`}
        >
          <span className="font-heading font-bold text-sm">
            {feedback.correct
              ? `Correct! ${feedback.answer} (+${feedback.points} pts)`
              : `Wrong! It was ${feedback.answer}`}
          </span>
        </div>
      )}

      {/* Initials + masked name card — panic state when 1 life */}
      <NeoCard
        shadow="lg"
        className={`flex flex-col items-center py-8 mb-5 ${
          lives === 1 ? "border-red-600 border-4 animate-pulse" : ""
        }`}
      >
        <p className="text-sm text-muted-foreground font-heading mb-4">
          Who has these initials?
        </p>
        <div className="flex gap-4 mb-2">
          {initials.map((letter, i) => (
            <div
              key={i}
              className="neo-border neo-shadow-lg rounded-xl w-20 h-20 flex items-center justify-center bg-primary text-primary-foreground"
            >
              <span className="font-heading font-bold text-4xl">{letter}</span>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground font-body mb-4">
          Any player with these initials counts
        </p>

        {/* The Reveal Ladder mask stays hidden until help is requested —
            shown up front, the name's letter boxes read as a constraint on
            the answer, when really any player with the initials counts.
            Once visible it is labelled as the famous-match hint target. */}
        {helpStage > 0 && maskedName && (
          <div className="flex flex-col items-center">
            <p className="text-xs text-muted-foreground font-heading uppercase mb-2">
              Best-known answer:
            </p>
            <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 mb-2">
              {maskedName.split(" ").map((word, wi) => (
                <div key={wi} className="flex gap-1">
                  {Array.from(word).map((char, ci) =>
                    char === MASK_CHAR ? (
                      <div
                        key={ci}
                        className="neo-border rounded w-7 h-9 bg-muted"
                        aria-hidden
                      />
                    ) : /\p{L}|\p{N}/u.test(char) ? (
                      <div
                        key={ci}
                        className="neo-border rounded w-7 h-9 flex items-center justify-center bg-primary text-primary-foreground"
                      >
                        <span className="font-heading font-bold text-sm">
                          {char}
                        </span>
                      </div>
                    ) : (
                      <span
                        key={ci}
                        className="w-3 h-9 flex items-center justify-center font-heading font-bold text-sm"
                      >
                        {char}
                      </span>
                    ),
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center gap-3 mt-3">
          <NeoBadge color={potValue < basePot ? "accent" : "success"} rotated>
            POT: {potValue} pts
          </NeoBadge>
          <NeoBadge color="blue" rotated>
            Round {round}
          </NeoBadge>
        </div>
      </NeoCard>

      {/* Clues from the help ladder — one caption states the target so the
          bare facts below don't read as random noise. */}
      {clues.length > 0 && (
        <div className="space-y-2 mb-4">
          <p className="text-xs text-muted-foreground font-body">
            Hints point to the best-known player with these initials
          </p>
          {clues.map((h, i) => (
            <NeoCard
              key={i}
              color={i === 0 ? "blue" : "accent"}
              className="animate-slide-up"
            >
              <p className="text-xs font-body">
                <strong>Clue {i + 1}:</strong> {h}
              </p>
            </NeoCard>
          ))}
        </div>
      )}

      {/* Input — close call shake + panic glow */}
      <NeoInput
        placeholder="Type player name..."
        value={guess}
        onChange={(e) => setGuess(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && handleGuess()}
        className={`mb-4 ${isOnFire ? "on-fire-input" : ""} ${closeCallShake ? "border-yellow-400 border-4 animate-shake-horizontal" : ""}`}
      />

      {/* Submit */}
      <NeoButton
        variant="primary"
        size="full"
        className="mb-3"
        onClick={handleGuess}
        disabled={!guess.trim() || submitting}
      >
        {submitting ? "Checking..." : "Submit Guess"}
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
            ? "Getting Help..."
            : helpExhausted
              ? "All Revealed"
              : helpStage < CLUE_STAGES
                ? "\u{1F4A1} Clue (-15%)"
                : "\u{1F524} Letter (-15%)"}
        </NeoButton>
        <NeoButton
          variant="secondary"
          size="md"
          onClick={handleSkip}
          disabled={skipsLeft <= 0}
        >
          {skipsLeft > 0 ? `SKIP (${skipsLeft})` : "NO SKIPS LEFT"}
        </NeoButton>
        <NeoButton
          variant="accent"
          size="md"
          onClick={handleCashOut}
          disabled={endingRun}
        >
          {endingRun ? "Cashing Out..." : "CASH OUT"}
        </NeoButton>
      </div>

      {/* Anti-cheat modal: warning (pot floored) vs penalty (life lost) */}
      <Dialog
        open={cheatModal !== null}
        onOpenChange={(open) => !open && setCheatModal(null)}
      >
        <DialogContent
          className={`neo-border neo-shadow-lg max-w-sm ${cheatModal === "warning" ? "bg-accent text-accent-foreground" : "bg-destructive text-destructive-foreground"}`}
        >
          <DialogHeader>
            <DialogTitle className="font-heading text-xl text-center">
              {cheatModal === "warning"
                ? "⚠️ EYES ON THE GAME ⚠️"
                : `\u{1F6A8} CHEATING DETECTED \u{1F6A8}`}
            </DialogTitle>
            <DialogDescription
              className={`text-center text-sm mt-2 ${cheatModal === "warning" ? "text-accent-foreground/90" : "text-destructive-foreground/90"}`}
            >
              {cheatModal === "warning"
                ? "You left the game window. This round's pot dropped to the minimum — next time costs a life."
                : "You lost focus on the game window again. 1 Life deducted."}
            </DialogDescription>
          </DialogHeader>
          <NeoButton
            variant="secondary"
            size="full"
            onClick={() => setCheatModal(null)}
            className="mt-2"
          >
            I UNDERSTAND
          </NeoButton>
        </DialogContent>
      </Dialog>
    </div>
  );
}
