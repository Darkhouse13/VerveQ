/**
 * MISSING LETTERS on the v2 shell — the app twin of the reel the feed runs
 * three times a day. A footballer's name on a board of letter tiles, some
 * tiles blank, a nation clue: fill the gaps. Ten rounds, EASY → IMPOSSIBLE as
 * the reel ramps them (the IMPOSSIBLE board hides the initials too).
 *
 * It wears the reel's look on the shared StageFrame (ink ground, cream tiles,
 * the tier tag, pink as its mode accent) and plays like Who's Older: type into
 * the blanks on the on-screen keyboard (or a real one), Check, and the board
 * flips into the reveal — the missing letters land green when right, red when
 * wrong — which
 * holds for a beat and deals the next name. Tapping skips the wait. Only plain
 * A–Z letters are ever blank (lib/missingLetters.ts), so 26 keys always suffice.
 *
 * Daily first: everyone gets the same ten boards per UTC date, one attempt,
 * scored /10 with an emoji share row. Finishing it unlocks ENDLESS — fresh
 * boards until the first miss.
 *
 * The end game is Who's Older's, piece for piece (WhosOlderRetention.tsx with
 * game="letters"): the daily STREAK with a live countdown, the EMAIL REMINDER,
 * and the CHALLENGE — sharing mints `/letters?c=<id>`; a friend opening it
 * plays the same ten boards under a score-to-beat banner and finishes on a
 * head-to-head. Reminder emails land here with `?rt=<token>`. Every decision
 * is server-authoritative (convex/missingLetters.ts): the client is dealt the
 * tiles with the blanks nulled out and learns the name from the reveal.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useTranslation } from "react-i18next";
import { notify, warnTabSwitchOnce } from "@/lib/notify";
import { CalendarDays, Check, Share2, Delete, Flame, Infinity as InfinityIcon, Star, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PlayStage } from "@/components/shell/play/PlayStage";
import { StageScore, StepDots, TierBadge } from "@/components/shell/play/StageParts";
import { ResultDetails, ResultScreen } from "@/components/shell/play/result/ResultScreen";
import { HeroPill, ResultHero } from "@/components/shell/play/result/ResultHero";
import { NextTodayCard, ResultActions } from "@/components/shell/play/result/ResultActions";
import { nextTodayTarget } from "@/components/shell/play/result/nextToday";
import { MetricsPanel } from "@/components/shell/play/ambient";
import { SHELL_ROUTES } from "@/lib/shellRoutes";
import { getShareBaseUrl } from "@/lib/shareBase";
import { useAntiCheat } from "@/hooks/useAntiCheat";
import { track } from "@/lib/analytics";
import {
  ChallengeBanner,
  ChallengeResults,
  HeadToHead,
  ReminderCard,
  StreakBlock,
} from "@/components/shell/play/whosOlder/WhosOlderRetention";
import { FollowLink, ShareSheet, StreakLinkOffer } from "@/components/shell/play/whosOlder/DailyShare";
import { isInstagramInAppBrowser, isInstagramVisitor, visibleStandingPct } from "@/lib/dailyShare";
import { useStreakLinkClaim } from "@/hooks/useStreakLinkClaim";
import { useAuth } from "@/contexts/AuthContext";
import {
  startRun,
  noteQuestionAnswered,
  completeRun,
  abandonRun,
} from "@/lib/gameAnalytics";
import { cn } from "@/lib/utils";
import { api } from "../../../../convex/_generated/api";

type SessionView = FunctionReturnType<typeof api.missingLetters.startDaily>["session"];
type Reveal = SessionView["history"][number];
type Tier = Reveal["tier"];

/** How long a reveal holds before the next board. A miss holds longer: the
 *  player needs to read the name they didn't get. */
const REVEAL_HOLD_MS = { right: 1900, wrong: 3000 } as const;
/** A tap during the reveal skips it — but not the tap that answered. */
const SKIP_GUARD_MS = 450;

const THEME = "theme-letters";

const TIER_LEVEL: Record<Tier, 0 | 1 | 2 | 3> = { easy: 0, medium: 1, hard: 2, impossible: 3 };

const KEY_ROWS = ["QWERTYUIOP", "ASDFGHJKL", "ZXCVBNM"];

/** "h:mm" until the next UTC midnight — when the next edition goes live. */
function nextEditionCountdown(): string {
  const now = new Date();
  const next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
  const ms = Math.max(0, next - now.getTime());
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return `${h}:${String(m).padStart(2, "0")}`;
}

function emojiRow(history: Reveal[]): string {
  return history.map((r) => (r.correct ? "🟩" : "🟥")).join("");
}

type Cell = { char: string | null; index: number };

/**
 * The board's lines: one per word, and a long hyphenated word breaks after its
 * hyphen ("PIERRE-" / "EMERICK") so a phone never shrinks tiles to slivers.
 */
function boardLines(tiles: Array<string | null>): Cell[][] {
  const words: Cell[][] = [[]];
  tiles.forEach((char, index) => {
    if (char === " ") words.push([]);
    else words[words.length - 1].push({ char, index });
  });
  return words.flatMap((word) => {
    const hyphen = word.findIndex((c) => c.char === "-");
    if (word.length <= 10 || hyphen < 0) return [word];
    return [word.slice(0, hyphen + 1), word.slice(hyphen + 1)];
  });
}

const isLetterCell = (c: Cell) => c.char === null || /\p{L}/u.test(c.char);

export default function MissingLettersPlayScreen() {
  const { t } = useTranslation("play");
  const navigate = useNavigate();
  const { accountState } = useAuth();
  const [searchParams] = useSearchParams();
  const challengeParam = searchParams.get("c");

  const startDailyMut = useMutation(api.missingLetters.startDaily);
  const startEndlessMut = useMutation(api.missingLetters.startEndless);
  const startChallengeMut = useMutation(api.missingLetters.startChallenge);
  const createChallengeMut = useMutation(api.missingLetters.createChallenge);
  const recordChallengeMut = useMutation(api.missingLetters.recordChallengeResult);
  const claimTokenMut = useMutation(api.whosOlderReminders.claimToken);
  const guessMut = useMutation(api.missingLetters.guess);
  // Reactive: the result card's standing, streak, reminder and challenge
  // results update live.
  const today = useQuery(api.missingLetters.getToday, {});
  const challengeInfo = useQuery(
    api.missingLetters.getChallenge,
    challengeParam ? { challengeId: challengeParam } : "skip",
  );
  // A challenge only frames the game for a friend; the sender's own link is
  // just their daily.
  const challenge = challengeInfo && !challengeInfo.own ? challengeInfo : null;
  const [challengeVerdict, setChallengeVerdict] = useState<"won" | "lost" | "tie" | null>(null);

  const [view, setView] = useState<SessionView | null>(null);
  const [reveal, setReveal] = useState<Reveal | null>(null);
  const [status, setStatus] = useState<"loading" | "failed" | "ready">("loading");
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<"right" | "wrong" | null>(null);
  // "Next today" on the result: is today's Who's Older already done? Asked
  // only once a run has finished.
  const olderToday = useQuery(api.whosOlder.getToday, view?.status === "completed" ? {} : "skip");
  // The letters typed into the pending board's blanks, one per blank, in
  // board order, and which blank the next key fills.
  const [typed, setTyped] = useState<Array<string | null>>([]);
  const [cursor, setCursor] = useState(0);
  const revealedAt = useRef(0);
  const inFlight = useRef(false);

  const accountStateRef = useRef(accountState);
  accountStateRef.current = accountState;

  // A reminder email link: `?rt=<token>` (+ `confirm=1` from the confirmation
  // email). Claimed once, then stripped from the address bar so a copied URL
  // never carries the token.
  const claimed = useRef(false);
  // The daily waits for the claim: a browser it links to may already have finished today's.
  const [reminderLinkSettled, setReminderLinkSettled] = useState(() => !searchParams.has("rt"));
  useEffect(() => {
    if (claimed.current) return;
    const token = searchParams.get("rt");
    if (!token) return;
    claimed.current = true;
    const confirm = searchParams.get("confirm") === "1";
    void claimTokenMut({ token, confirm })
      .then((res) => {
        track("missing_letters_reminder_claimed", { confirmed: res.confirmed, ok: res.ok });
        if (res.confirmed) notify.success(t("missingLetters.reminderConfirmed"));
      })
      .catch((err) => console.error("Reminder link failed:", err))
      .finally(() => setReminderLinkSettled(true));
    const url = new URL(window.location.href);
    url.searchParams.delete("rt");
    url.searchParams.delete("confirm");
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}`);
  }, [searchParams, claimTokenMut, t]);

  // A streak link from another browser (`?st=`): join this browser to it.
  const streakLinkSettled = useStreakLinkClaim("letters");

  const loadDaily = useCallback(async () => {
    setStatus("loading");
    try {
      const res = await startDailyMut({});
      // Only a freshly minted daily is a game start; resuming or re-opening a
      // finished one mints nothing and stays silent.
      if (res.created) {
        startRun(res.session.sessionId, "missing-letters", {
          accountState: accountStateRef.current,
        });
      }
      setView(res.session);
      setReveal(null);
      setStatus("ready");
    } catch (err) {
      console.error("Missing Letters failed to start:", err);
      setStatus("failed");
    }
  }, [startDailyMut]);

  /** A past date's challenge: the sender's ten boards as this player's run. */
  const loadChallenge = useCallback(
    async (challengeId: NonNullable<typeof challenge>["challengeId"]) => {
      setStatus("loading");
      try {
        const res = await startChallengeMut({ challengeId });
        if (res.created) {
          startRun(res.session.sessionId, "missing-letters-challenge", {
            accountState: accountStateRef.current,
          });
        }
        setView(res.session);
        setReveal(null);
        setStatus("ready");
      } catch (err) {
        console.error("Challenge failed to start:", err);
        await loadDaily();
      }
    },
    [startChallengeMut, loadDaily],
  );

  // One provision per arrival — a re-created closure (locale switch) is not a
  // new game. A challenge link waits for its challenge to resolve: a past
  // date plays the sender's boards, anything else plays today's daily.
  const autoStarted = useRef(false);
  useEffect(() => {
    if (autoStarted.current) return;
    if (challengeParam && challengeInfo === undefined) return;
    if (!streakLinkSettled || !reminderLinkSettled) return;
    autoStarted.current = true;
    if (challengeInfo) {
      track("missing_letters_challenge_opened", { is_today: challengeInfo.isToday, own: challengeInfo.own });
    }
    if (challenge && !challenge.isToday) void loadChallenge(challenge.challengeId);
    else void loadDaily();
  }, [challengeParam, challengeInfo, challenge, loadChallenge, loadDaily, streakLinkSettled, reminderLinkSettled]);

  // File a finished run of the challenge's date against it (the server reads
  // the score from the session). A player who already had an answer on file
  // gets their verdict straight from the challenge.
  const filedChallenge = useRef(false);
  useEffect(() => {
    if (!challenge || !view || filedChallenge.current) return;
    if (challenge.myResult) {
      setChallengeVerdict(challenge.myResult.verdict);
      return;
    }
    if (view.kind === "endless" || view.status !== "completed" || view.dateKey !== challenge.dateKey) return;
    filedChallenge.current = true;
    void recordChallengeMut({ challengeId: challenge.challengeId, sessionId: view.sessionId })
      .then((res) => {
        if (!res.verdict) return;
        setChallengeVerdict(res.verdict);
        if (res.recorded) track("missing_letters_challenge_finished", { verdict: res.verdict, is_today: challenge.isToday });
      })
      .catch((err) => console.error("Challenge result failed:", err));
  }, [challenge, view, recordChallengeMut]);

  const liveSessionRef = useRef<string | null>(null);
  liveSessionRef.current = view?.status === "active" ? view.sessionId : null;
  useEffect(() => () => abandonRun(liveSessionRef.current), []);

  // The blanks of the board on screen, in board order. A new board (new
  // session or next round) clears what was typed.
  const pending = view?.status === "active" ? view.pending : null;
  const blanks = useMemo(
    () => (pending ? pending.tiles.flatMap((c, i) => (c === null ? [i] : [])) : []),
    [pending],
  );
  const boardKey = view ? `${view.sessionId}:${view.roundIndex}` : "";
  useEffect(() => {
    setTyped(blanks.map(() => null));
    setCursor(0);
  }, [boardKey, blanks]);

  const startEndless = async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    try {
      const res = await startEndlessMut({});
      startRun(res.session.sessionId, "missing-letters-endless", {
        accountState: accountStateRef.current,
        startTrigger: "user_action",
      });
      setView(res.session);
      setReveal(null);
    } catch (err) {
      console.error("Endless failed to start:", err);
      notify.error(t("missingLetters.startFailedMessage"));
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  const submit = useCallback(
    async (answer: { letters: string } | { forfeit: "skip" | "timeout" }) => {
      if (!view || view.status !== "active" || reveal || inFlight.current) return;
      inFlight.current = true;
      setBusy(true);
      try {
        const res = await guessMut({
          sessionId: view.sessionId,
          roundIndex: view.roundIndex,
          ...answer,
        });
        if (res.applied && res.reveal) {
          noteQuestionAnswered(view.sessionId);
          revealedAt.current = Date.now();
          setReveal(res.reveal);
          setFlash(res.reveal.correct ? "right" : "wrong");
          if (res.session.status === "completed") {
            completeRun(view.sessionId, {
              score: res.session.score,
              // Endless only ends on a correct answer when the pool ran dry.
              result: view.kind !== "endless" || res.reveal.correct ? "win" : "loss",
            });
          }
        }
        setView(res.session);
      } catch (err) {
        console.error("Missing Letters guess failed:", err);
        notify.error(t("missingLetters.guessFailed"));
      } finally {
        inFlight.current = false;
        setBusy(false);
      }
    },
    [view, reveal, guessMut, t],
  );

  const complete = typed.length > 0 && typed.every((c) => c !== null);
  const check = useCallback(() => {
    if (complete) void submit({ letters: typed.join("") });
  }, [complete, typed, submit]);

  const typeLetter = useCallback(
    (letter: string) => {
      if (reveal || busy || typed.length === 0) return;
      const next = [...typed];
      next[cursor] = letter;
      setTyped(next);
      // On to the next empty blank after this one (wrapping), else stay put.
      for (let step = 1; step <= next.length; step++) {
        const i = (cursor + step) % next.length;
        if (next[i] === null) {
          setCursor(i);
          return;
        }
      }
      setCursor(Math.min(cursor + 1, next.length - 1));
    },
    [reveal, busy, typed, cursor],
  );

  const backspace = useCallback(() => {
    if (reveal || busy || typed.length === 0) return;
    const next = [...typed];
    if (next[cursor] !== null) {
      next[cursor] = null;
      setTyped(next);
      return;
    }
    const prev = Math.max(0, cursor - 1);
    next[prev] = null;
    setTyped(next);
    setCursor(prev);
  }, [reveal, busy, typed, cursor]);

  // A real keyboard works too (desktop): letters, Backspace, Enter, arrows.
  useEffect(() => {
    if (!pending) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      if (/^[a-zA-Z]$/.test(e.key)) {
        e.preventDefault();
        typeLetter(e.key.toUpperCase());
      } else if (e.key === "Backspace") {
        e.preventDefault();
        backspace();
      } else if (e.key === "Enter") {
        e.preventDefault();
        check();
      } else if (e.key === "ArrowLeft") {
        setCursor((c) => Math.max(0, c - 1));
      } else if (e.key === "ArrowRight") {
        setCursor((c) => Math.min(typed.length - 1, c + 1));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pending, typeLetter, backspace, check, typed.length]);

  // The reveal holds for a beat, then the next board (or the result) takes
  // over on its own — no Next button between rounds.
  useEffect(() => {
    if (!reveal) return;
    const id = window.setTimeout(
      () => setReveal(null),
      reveal.correct ? REVEAL_HOLD_MS.right : REVEAL_HOLD_MS.wrong,
    );
    return () => window.clearTimeout(id);
  }, [reveal]);

  useEffect(() => {
    if (!flash) return;
    const id = window.setTimeout(() => setFlash(null), 450);
    return () => window.clearTimeout(id);
  }, [flash]);

  const skipReveal = () => {
    if (reveal && Date.now() - revealedAt.current > SKIP_GUARD_MS) setReveal(null);
  };

  // Leaving the tab mid-round forfeits THAT round (a name is one search away).
  // It never touches a round already revealed.
  useAntiCheat(
    useCallback(() => {
      if (status !== "ready" || !view || view.status !== "active" || reveal) return;
      notify.error(t("missingLetters.tabSwitchForfeit"));
      void submit({ forfeit: "timeout" });
    }, [status, view, reveal, submit, t]),
    // The hook's mount-time toast would also greet a player re-opening a
    // finished daily; warn once, when a round is actually live.
    { warningMessage: null },
  );
  // The anti-cheat reminder: once per session, on the first tap in a live round.
  const live = view?.status === "active";
  useEffect(() => {
    if (!live) return;
    return warnTabSwitchOnce(t("missingLetters.tabSwitchWarning"));
  }, [live, t]);

  // Sharing a finished daily IS the challenge: the link replays the same ten
  // boards for whoever opens it. If the challenge cannot be minted the plain
  // result link still goes out. The share sheet calls this once as it opens.
  const [shareOpen, setShareOpen] = useState(false);
  const makeShareLink = async (daily: SessionView) => {
    try {
      const { challengeId } = await createChallengeMut({ sessionId: daily.sessionId });
      track("missing_letters_challenge_shared", { edition: daily.edition, score: daily.score });
      return `${getShareBaseUrl()}/letters?c=${challengeId}&ref=missing_letters_challenge`;
    } catch (err) {
      console.error("Challenge link failed:", err);
      return `${getShareBaseUrl()}/letters?ref=missing_letters_share`;
    }
  };

  const exit = () => navigate(SHELL_ROUTES.home);

  if (status !== "ready" || !view) {
    return (
      <PlayStage mode="missing-letters" theme={THEME} title={t("missingLetters.title")} onExit={exit} exitLabel={t("missingLetters.quit")}>
        <div className="flex flex-col items-center justify-center py-12">
          {status === "failed" ? (
            <Card elevation="lifted" padding="lg" className="w-full text-center">
              <p className="font-heading font-bold text-title">{t("missingLetters.startFailedTitle")}</p>
              <p className="mt-3 text-body-sm text-muted-foreground">{t("missingLetters.startFailedMessage")}</p>
              <Button variant="primary" size="lg" block className="mt-6" onClick={loadDaily}>
                {t("missingLetters.tryAgain")}
              </Button>
            </Card>
          ) : (
            <p className="font-heading font-bold text-title-sm animate-pulse motion-reduce:animate-none">{t("missingLetters.loading")}</p>
          )}
        </div>
      </PlayStage>
    );
  }

  // A challenge run is scored and shaped exactly like a daily.
  const isDaily = view.kind !== "endless";
  // A past date — a challenge run, or an old daily a challenge link reopened —
  // is not today's result: no streak, no standing, and it points at today.
  const isChallengeRun =
    view.kind === "challenge" || (view.kind === "daily" && today != null && view.dateKey !== today.dateKey);
  const challengeHere = challenge && view.dateKey === challenge.dateKey && isDaily ? challenge : null;
  // A best of 0 is not worth a line.
  const bestEndless = today?.bestEndless ? today.bestEndless : null;
  const subtitle = isChallengeRun
    ? t("missingLetters.challengeSubtitle", { n: view.edition })
    : isDaily
      ? t("missingLetters.dailySubtitle", { n: view.edition })
      : t("missingLetters.endlessSubtitle");
  const metrics = isDaily ? { score: view.score } : { streak: view.score };

  // ── Finished states (only once the last reveal has played out) ──
  if (view.status === "completed" && !reveal) {
    if (isDaily) {
      const daily = view;
      // Decision 7: "better than X%" only when X ≥ 50 (lib/dailyShare.ts).
      const standingPct = isChallengeRun ? null : visibleStandingPct(today?.standing);
      const streak = !isChallengeRun && today?.streak?.playedToday ? today.streak : null;
      const total = daily.totalRounds ?? daily.history.length;
      const next = nextTodayTarget(
        "letters",
        olderToday === undefined ? undefined : olderToday.daily?.status === "completed",
      );
      return (
        <PlayStage mode="missing-letters" theme={THEME} title={t("missingLetters.title")} subtitle={subtitle} onExit={exit} exitLabel={t("missingLetters.home")}>
          <ResultScreen
            testId="missing-letters-result"
            top={
              challengeHere && challengeVerdict ? (
                <HeadToHead game="letters" challenge={challengeHere} myScore={daily.score} verdict={challengeVerdict} />
              ) : undefined
            }
            hero={
              <ResultHero
                eyebrow={t("missingLetters.editionLabel", { n: daily.edition })}
                score={daily.score}
                total={total}
                squares={daily.history.map((r) => r.correct)}
                squaresLabel={t("result.squares", { score: daily.score, total })}
              >
                {standingPct != null && today?.standing && (
                  <HeroPill testId="missing-letters-standing">
                    {t("missingLetters.standing", { pct: standingPct, count: today.standing.finishers })}
                  </HeroPill>
                )}
              </ResultHero>
            }
            status={
              streak ? (
                <StreakBlock game="letters" current={streak.current} best={streak.best} />
              ) : !isChallengeRun ? (
                <p className="text-center text-body-sm text-muted-foreground">
                  {t("missingLetters.nextIn", { time: nextEditionCountdown() })}
                </p>
              ) : undefined
            }
            actions={
              <ResultActions
                primary={
                  isChallengeRun
                    ? {
                        label: t("missingLetters.playToday", { n: today?.edition ?? "" }),
                        icon: <CalendarDays size={18} aria-hidden="true" />,
                        onClick: loadDaily,
                        testId: "missing-letters-play-today",
                      }
                    : {
                        label: t("dailyShare.cta"),
                        icon: <Share2 size={18} aria-hidden="true" />,
                        onClick: () => {
                          track("missing_letters_share_pressed", { edition: daily.edition, score: daily.score });
                          setShareOpen(true);
                        },
                        testId: "missing-letters-challenge-share",
                      }
                }
                next={
                  isChallengeRun ? undefined : (
                    <NextTodayCard
                      target={next}
                      testId="missing-letters-next-today"
                      onFollow={() =>
                        track("daily_next_today_clicked", { from: "letters", to: next.kind === "game" ? next.game : "home" })
                      }
                    />
                  )
                }
                secondary={
                  isChallengeRun
                    ? []
                    : [
                        {
                          label: t("missingLetters.playEndless"),
                          icon: <InfinityIcon size={18} aria-hidden="true" />,
                          onClick: startEndless,
                          disabled: busy,
                          testId: "missing-letters-endless",
                        },
                      ]
                }
                note={
                  !isChallengeRun && bestEndless != null ? (
                    <p className="text-center font-mono text-eyebrow uppercase text-muted-foreground">
                      {t("missingLetters.bestStreak", { count: bestEndless })}
                    </p>
                  ) : undefined
                }
              />
            }
            details={
              <>
                {streak && isInstagramInAppBrowser() && <StreakLinkOffer game="letters" streak={streak.current} />}
                {!isChallengeRun && today?.challenges && <ChallengeResults game="letters" challenges={today.challenges} />}
                <ResultDetails summary={t("result.answers")}>
                  {/* The ten names — each row marked with its verdict. */}
                  <ol data-testid="missing-letters-answers">
                    {daily.history.map((r, i) => (
                      <li key={i} className="flex items-center gap-3 border-b border-border/15 py-2 text-body-sm last:border-b-0">
                        <span
                          className={cn(
                            "grid h-6 w-6 shrink-0 place-items-center rounded-full text-ink",
                            r.correct ? "bg-verdict-right" : "bg-verdict-wrong",
                          )}
                        >
                          {r.correct ? <Check size={14} strokeWidth={3.5} /> : <X size={14} strokeWidth={3.5} />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="font-heading font-bold">{r.name}</span>{" "}
                          <span className="text-muted-foreground">· {r.nation}</span>
                        </span>
                        <span className="shrink-0 font-mono text-eyebrow uppercase text-muted-foreground">
                          {t(`missingLetters.tier.${r.tier}`)}
                        </span>
                      </li>
                    ))}
                  </ol>
                  <p className="mt-2 text-meta text-muted-foreground">{t("missingLetters.sources")}</p>
                </ResultDetails>
              </>
            }
            footer={
              <>
                {today?.reminder && <ReminderCard game="letters" reminder={today.reminder} collapsed />}
                {!isChallengeRun && isInstagramVisitor() && <FollowLink game="letters" />}
              </>
            }
          />
          {!isChallengeRun && (
            <ShareSheet
              game="letters"
              open={shareOpen}
              onOpenChange={setShareOpen}
              makeLink={() => makeShareLink(daily)}
              result={{
                edition: daily.edition,
                score: daily.score,
                total,
                history: daily.history,
                standingPct,
                streak: streak?.current ?? null,
              }}
            />
          )}
        </PlayStage>
      );
    }

    const last = view.history[view.history.length - 1];
    return (
      <PlayStage mode="missing-letters" theme={THEME} title={t("missingLetters.title")} subtitle={subtitle} onExit={exit} exitLabel={t("missingLetters.home")}>
        <ResultScreen
          testId="missing-letters-run-over"
          hero={
            <ResultHero eyebrow={t("missingLetters.runOver")} score={view.score} caption={t("missingLetters.streakLabel")}>
              {last && !last.correct && (
                <p className="mt-3 text-body-sm font-bold">{t("missingLetters.itWas", { name: last.name })}</p>
              )}
              {bestEndless != null && <HeroPill>{t("missingLetters.bestStreak", { count: bestEndless })}</HeroPill>}
            </ResultHero>
          }
          actions={
            <ResultActions
              primary={{
                label: t("missingLetters.playAgain"),
                icon: <InfinityIcon size={18} aria-hidden="true" />,
                onClick: startEndless,
                disabled: busy,
              }}
              secondary={[
                {
                  label: t("missingLetters.backToDaily"),
                  icon: <CalendarDays size={18} aria-hidden="true" />,
                  onClick: loadDaily,
                },
              ]}
            />
          }
        />
      </PlayStage>
    );
  }

  // ── A round: pending (blanks to fill) or revealed (the full name) ──
  // During a reveal the server has already moved on, so the board on screen
  // is rebuilt from the reveal: the name's own letters, blanks marked.
  const shownIndex = reveal ? view.roundIndex - 1 : view.roundIndex;
  const board = reveal
    ? {
        tier: reveal.tier,
        nation: reveal.nation,
        tiles: [...reveal.name.toUpperCase()],
        blanks: reveal.hidden,
      }
    : view.pending
      ? { tier: view.pending.tier, nation: view.pending.nation, tiles: view.pending.tiles, blanks }
      : null;
  if (!board) return null;

  const blankSlot = new Map(board.blanks.map((idx, slot) => [idx, slot]));
  const lines = boardLines(board.tiles.map((c, i) => (blankSlot.has(i) && !reveal ? null : c)));
  const longest = Math.max(7, ...lines.map((l) => l.length));
  const tileWidth = `min(46px, calc((100cqw - ${(longest - 1) * 5}px) / ${longest}))`;

  const renderTile = (cell: Cell) => {
    const slot = blankSlot.get(cell.index);
    // Hyphens, apostrophes, dots: a narrow glyph, not a tile.
    if (slot === undefined && cell.char !== null && !isLetterCell(cell)) {
      return (
        <span key={cell.index} className="font-heading font-bold text-muted-foreground self-center" style={{ fontSize: `calc(${tileWidth} * 0.6)` }}>
          {cell.char}
        </span>
      );
    }
    const base = "grid place-items-center rounded-md font-heading font-bold uppercase leading-none select-none";
    const size = { width: tileWidth, aspectRatio: "5 / 6", fontSize: `calc(${tileWidth} * 0.62)` } as const;
    if (slot === undefined) {
      return (
        <span key={cell.index} className={cn(base, "bg-paper text-paper-foreground neo-border neo-shadow-sm")} style={size}>
          {cell.char}
        </span>
      );
    }
    if (reveal) {
      const guessed = reveal.guess?.[slot] ?? null;
      const right = guessed === cell.char;
      return (
        <span
          key={cell.index}
          className={cn(
            base,
            "neo-border neo-shadow-sm text-ink animate-badge-land motion-reduce:animate-none",
            right ? "bg-verdict-right" : "bg-verdict-wrong",
          )}
          style={{ ...size, animationDelay: `${slot * 60}ms` }}
        >
          {cell.char}
        </span>
      );
    }
    const letter = typed[slot] ?? null;
    const active = slot === cursor;
    return (
      <button
        key={cell.index}
        type="button"
        onClick={() => setCursor(slot)}
        data-testid="missing-letters-blank"
        aria-label={t("missingLetters.blankLabel", { n: slot + 1 })}
        className={cn(
          base,
          "border-2",
          letter ? "bg-foreground/10 text-foreground border-solid" : "bg-foreground/5 border-dashed",
          active ? "border-ring letters-cursor" : letter ? "border-foreground/70" : "border-foreground/45",
        )}
        style={size}
      >
        {letter}
      </button>
    );
  };

  const verdict = reveal
    ? reveal.forfeit === "timeout"
      ? { label: t("missingLetters.forfeited"), right: false }
      : reveal.forfeit === "skip"
        ? { label: t("missingLetters.gaveUp"), right: false }
        : reveal.correct
          ? { label: t("missingLetters.correct"), right: true }
          : { label: t("missingLetters.wrong"), right: false }
    : null;

  // Leaving an endless run with points on the board loses it; a daily
  // resumes where it was left, so it leaves without asking.
  const exitConfirm =
    !isDaily && view.status === "active" && view.score > 0
      ? {
          title: t("stage.quitRun.title"),
          description: t("stage.quitRun.body", { count: view.score }),
          confirmLabel: t("stage.quitRun.confirm"),
          cancelLabel: t("stage.quitRun.cancel"),
        }
      : undefined;

  return (
    <PlayStage
      mode="missing-letters"
      theme={THEME}
      title={t("missingLetters.title")}
      subtitle={subtitle}
      onExit={exit}
      exitLabel={t("missingLetters.quit")}
      exitConfirm={exitConfirm}
      flash={flash}
      score={
        <StageScore
          icon={isDaily ? <Star size={16} strokeWidth={3} /> : <Flame size={16} strokeWidth={3} />}
          value={view.score}
          label={isDaily ? t("stage.scoreLabel", { value: view.score }) : t("stage.streakLabel", { value: view.score })}
          detail={!isDaily && bestEndless != null ? t("missingLetters.bestShort", { count: bestEndless }) : undefined}
        />
      }
      progress={
        isDaily && view.totalRounds ? (
          <StepDots
            total={view.totalRounds}
            results={view.history.map((h) => h.correct)}
            current={shownIndex}
            label={t("stage.roundLabel", { current: Math.min(shownIndex + 1, view.totalRounds), total: view.totalRounds })}
          />
        ) : undefined
      }
      right={<MetricsPanel metrics={metrics} />}
    >
      <div className="flex flex-col h-full" onClick={reveal ? skipReveal : undefined}>
        {challengeHere && <ChallengeBanner game="letters" challenge={challengeHere} />}
        <div className="shrink-0 mb-2">
          <TierBadge label={t(`missingLetters.tier.${board.tier}`)} level={TIER_LEVEL[board.tier]} testId="missing-letters-tier" />
        </div>

        <div className="shrink-0 flex items-end justify-between gap-3">
          <p className="font-heading font-bold uppercase text-title-lg tracking-tight">
            {t("missingLetters.prompt")}
          </p>
          <span className="flex items-center gap-2 min-w-0">
            <span className="font-mono text-eyebrow text-muted-foreground">{t("missingLetters.clue")}</span>
            <span
              data-testid="missing-letters-clue"
              className="truncate rounded-md bg-paper text-paper-foreground px-2.5 py-0.5 font-heading font-bold uppercase text-body-sm neo-border neo-shadow-sm"
            >
              {board.nation}
            </span>
          </span>
        </div>

        {/* The board. Container-sized: tiles shrink to fit the longest line. */}
        <div
          key={`${view.sessionId}-${shownIndex}`}
          className="flex-1 min-h-[9rem] flex flex-col justify-center gap-2.5 py-4 animate-older-in-top"
          style={{ containerType: "inline-size" }}
          data-testid="missing-letters-board"
        >
          {lines.map((line, li) => (
            <div key={li} className="flex justify-center gap-[5px]">
              {line.map(renderTile)}
            </div>
          ))}
        </div>

        {reveal && verdict ? (
          <div className="shrink-0 min-h-[13rem] flex flex-col items-center justify-center gap-3" aria-live="polite">
            <Badge
              tone={verdict.right ? "right" : "wrong"}
              shape="tag"
              size="md"
              stamp
              className="text-body-sm animate-badge-land motion-reduce:animate-none"
            >
              {verdict.label}
            </Badge>
            <span
              data-testid="missing-letters-answer"
              className="animate-badge-land motion-reduce:animate-none rounded-md bg-paper text-paper-foreground px-3 py-1.5 font-heading font-bold uppercase text-title-sm text-center neo-border neo-shadow-sm"
            >
              {reveal.name}
            </span>
            <span className="font-mono text-eyebrow uppercase text-muted-foreground">{t("missingLetters.tapToContinue")}</span>
          </div>
        ) : (
          <div className="shrink-0 flex flex-col gap-1.5" data-testid="missing-letters-keyboard">
            {KEY_ROWS.map((row, ri) => (
              <div key={row} className="flex justify-center gap-1">
                {ri === 2 && <span className="flex-[0.5]" />}
                {[...row].map((k) => (
                  <Button
                    key={k}
                    variant="secondary"
                    size="sm"
                    disabled={busy}
                    onClick={() => typeLetter(k)}
                    data-testid={`missing-letters-key-${k}`}
                    className="flex-1 min-w-0 max-w-[2.6rem] px-0 text-title-sm neo-shadow-sm"
                  >
                    {k}
                  </Button>
                ))}
                {ri === 2 && (
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={busy}
                    onClick={backspace}
                    aria-label={t("missingLetters.backspace")}
                    data-testid="missing-letters-backspace"
                    className="flex-[1.5] min-w-0 max-w-[4rem] px-0 bg-muted neo-shadow-sm"
                  >
                    <Delete size={20} aria-hidden="true" />
                  </Button>
                )}
              </div>
            ))}
            <div className="mt-1.5 grid grid-cols-[1fr_2fr] gap-2">
              <Button
                variant="secondary"
                disabled={busy}
                onClick={() => void submit({ forfeit: "skip" })}
                data-testid="missing-letters-give-up"
              >
                {t("missingLetters.giveUp")}
              </Button>
              <Button
                variant="primary"
                disabled={busy || !complete}
                onClick={check}
                data-testid="missing-letters-check"
              >
                {t("missingLetters.check")}
              </Button>
            </div>
          </div>
        )}
      </div>
    </PlayStage>
  );
}
