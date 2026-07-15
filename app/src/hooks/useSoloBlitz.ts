/**
 * useSoloBlitz — the solo Blitz game loop, server-authoritative and presentation
 * free, so the v2 shell's `BlitzPlayScreen` can drive the exact same backend flow
 * the legacy `BlitzScreen` runs inline.
 *
 * Every correctness/score/clock decision is the server's: `blitz.start`,
 * `blitz.getQuestion`, `blitz.submitAnswer`, and `blitz.endGame` are called
 * unchanged. This hook only sequences them and exposes view state. No grading,
 * no clock authority, and no scoring live here — the 60s window (and every -3s
 * penalty) is the server's `endTimeMs`.
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useMutation } from "convex/react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { api } from "../../convex/_generated/api";
import { useAntiCheat } from "@/hooks/useAntiCheat";
import { useAuth } from "@/contexts/AuthContext";
import {
  startRun,
  completeRun,
  abandonRun,
  noteQuestionAnswered,
} from "@/lib/gameAnalytics";
import type { Id } from "../../convex/_generated/dataModel";

interface QuestionData {
  question: string;
  options: string[];
  // Canonical English options (same order) — submitted so grading stays canonical.
  optionValues: string[];
  checksum: string;
  imageUrl?: string | null;
}

export interface SoloBlitzState {
  loading: boolean;
  question: QuestionData | null;
  score: number;
  /** Server-authoritative end of the run; the clock counts down to this. */
  endTimeMs: number;
  selected: number | null;
  revealed: boolean;
  /** True while the pick is in flight to the server, before the verdict lands. */
  checking: boolean;
  correctIdx: number;
  /** True briefly after a wrong answer — drives the penalty flash / shake. */
  penaltyFlash: boolean;
  shaking: boolean;
  zoomImage: string | null;
  setZoomImage: (url: string | null) => void;
  onOption: (idx: number) => void;
  /** Clock expiry handler to wire into the countdown component. */
  onExpired: () => void;
}

export function useSoloBlitz(): SoloBlitzState {
  const { t, i18n } = useTranslation("play");
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const sport = params.get("sport") || "football";

  const [sessionId, setSessionId] = useState<Id<"blitzSessions"> | null>(null);
  const [question, setQuestion] = useState<QuestionData | null>(null);
  const [score, setScore] = useState(0);
  const [endTimeMs, setEndTimeMs] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [checking, setChecking] = useState(false);
  const [revealedAnswer, setRevealedAnswer] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [penaltyFlash, setPenaltyFlash] = useState(false);
  const [shaking, setShaking] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [zoomImage, setZoomImage] = useState<string | null>(null);

  const sessionRef = useRef<Id<"blitzSessions"> | null>(null);
  const answerSubmitInFlight = useRef(false);

  const { accountState } = useAuth();
  // Read through a ref, NOT as a dependency of the start effect below: that
  // effect is mount-once and is what mints the server session, so re-running it
  // when auth settles (or when a guest claims a username) would mint a second
  // session and invent a game nobody started.
  const accountStateRef = useRef(accountState);
  accountStateRef.current = accountState;

  const startMut = useMutation(api.blitz.start);
  const getQuestionMut = useMutation(api.blitz.getQuestion);
  const submitAnswerMut = useMutation(api.blitz.submitAnswer);
  const endGameMut = useMutation(api.blitz.endGame);

  const finishGame = useCallback(async () => {
    if (gameOver) return;
    setGameOver(true);
    const sid = sessionRef.current;
    if (!sid) return;
    const goToResults = (res: {
      score: number;
      correctCount: number;
      wrongCount: number;
    }) => {
      // Both finalize paths — the first attempt and the delayed retry below —
      // converge here with a server-confirmed score, and completeRun is
      // idempotent per session, so neither can double-report. `result` stays
      // unset on purpose: Blitz scores a run, it has no win/loss.
      completeRun(sid, { score: res.score });
      navigate("/blitz-results", {
        state: {
          score: res.score,
          correctCount: res.correctCount,
          wrongCount: res.wrongCount,
          sport,
          mode: "blitz" as const,
        },
      });
    };
    try {
      goToResults(await endGameMut({ sessionId: sid }));
    } catch {
      // The buzzer fired on the client, but the server clock may trail it by a
      // hair (or a transient hiccup dropped the call). Wait a beat — the server
      // clock advances past the deadline — and finalize once more before giving
      // up to home, so a clean run still reaches its results screen.
      try {
        await new Promise((r) => setTimeout(r, 1200));
        goToResults(await endGameMut({ sessionId: sid }));
      } catch {
        // The run still ENDED here — the buzzer (or a server gameOver) already
        // fired and the player is being sent home; only the finalize call was
        // lost. Reporting it as anything but completed would silently drop
        // every give-up run. Score is omitted rather than guessed: the server
        // never told us what it was.
        completeRun(sid);
        navigate("/home");
      }
    }
  }, [endGameMut, navigate, sport, gameOver]);

  const fetchQuestion = useCallback(
    async (sid: Id<"blitzSessions">) => {
      try {
        const q = await getQuestionMut({
          sessionId: sid,
          locale: i18n.resolvedLanguage ?? i18n.language,
        });
        setQuestion(q);
        setRevealedAnswer(null);
        setSelected(null);
        setRevealed(false);
      } catch {
        // Time expired or no more questions — server is the authority.
        void finishGame();
      }
    },
    [getQuestionMut, finishGame, i18n],
  );

  useEffect(() => {
    (async () => {
      try {
        const { sessionId: sid, endTimeMs: serverEndTimeMs } = await startMut({
          sport,
        });
        // A game genuinely began — the server minted a session. Fired on that
        // resolution rather than on mount, so passing through this route (or a
        // start that throws below) mints nothing and stays silent.
        startRun(sid, "blitz", { accountState: accountStateRef.current });
        setSessionId(sid);
        sessionRef.current = sid;
        const q = await getQuestionMut({
          sessionId: sid,
          locale: i18n.resolvedLanguage ?? i18n.language,
        });
        setQuestion(q);
        setEndTimeMs(serverEndTimeMs);
        setLoading(false);
      } catch {
        toast.error(t("blitz.startFailedToast"));
        navigate(-1);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Leaving mid-run. Reads the live session through the existing ref so the
  // cleanup sees the session that was live at unmount rather than one captured
  // at mount. abandonRun ignores runs that already ended, so a finished run —
  // including an expired clock, which is a real completion, not an exit — can
  // never be reported as abandoned.
  useEffect(() => () => abandonRun(sessionRef.current), []);

  // Anti-cheat: a tab-away submits a guaranteed-wrong guess; the server still
  // decides correctness and applies the -3s penalty.
  useAntiCheat(
    useCallback(() => {
      if (!gameOver && question && sessionId && !revealed) {
        submitAnswerMut({
          sessionId,
          answer: "__tabbed_away__",
          checksum: question.checksum,
        }).then((res) => {
          setEndTimeMs(res.endTimeMs);
          if (res.gameOver) void finishGame();
        });
        toast.error(t("blitz.tabSwitchWrong"));
      }
    }, [gameOver, question, sessionId, revealed, submitAnswerMut, finishGame, t]),
    { warningMessage: t("blitz.tabSwitchWarning") },
  );

  const onOption = useCallback(
    async (idx: number) => {
      if (
        revealed ||
        checking ||
        answerSubmitInFlight.current ||
        !question ||
        !sessionId ||
        gameOver
      )
        return;
      // Lock input immediately (so a second tap can't fire another submit) and
      // mark the pick "checking" — but DON'T flip `revealed` yet. Revealing
      // before the server verdict arrives would paint a correct pick red for one
      // frame (correctIdx is still -1) and only flip it green once the answer
      // lands. We wait for the verdict and reveal it atomically below.
      answerSubmitInFlight.current = true;
      setSelected(idx);
      setChecking(true);
      try {
        const res = await submitAnswerMut({
          sessionId,
          // Canonical English value — grading compares against correctAnswer.
          answer: question.optionValues[idx],
          checksum: question.checksum,
        });
        // The player's own pick, graded by the server. Counted only here: the
        // anti-cheat auto-submit above is a penalty rather than an answer, and
        // the question it burns stays on screen and pickable, so counting it
        // there would tally the same question twice.
        noteQuestionAnswered(sessionId);
        setScore(res.score);
        setEndTimeMs(res.endTimeMs);
        // Set the correct answer BEFORE revealing so the grading colours (green
        // for correct, red for a wrong pick) are right on the very first frame.
        setRevealedAnswer(res.correctAnswer);
        setRevealed(true);

        if (!res.correct) {
          setPenaltyFlash(true);
          setShaking(true);
          setTimeout(() => setPenaltyFlash(false), 300);
          setTimeout(() => setShaking(false), 500);
        }

        if (res.gameOver) {
          setTimeout(() => void finishGame(), 600);
          return;
        }

        setTimeout(() => {
          void fetchQuestion(sessionId);
        }, res.correct ? 400 : 800);
      } catch {
        void finishGame();
      } finally {
        answerSubmitInFlight.current = false;
        setChecking(false);
      }
    },
    [revealed, checking, question, sessionId, gameOver, submitAnswerMut, finishGame, fetchQuestion],
  );

  const correctIdx =
    question && revealedAnswer
      ? question.optionValues.indexOf(revealedAnswer)
      : -1;

  return {
    loading,
    question,
    score,
    endTimeMs,
    selected,
    revealed,
    checking,
    correctIdx,
    penaltyFlash,
    shaking,
    zoomImage,
    setZoomImage,
    onOption,
    onExpired: finishGame,
  };
}
