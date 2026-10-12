/**
 * MISSING LETTERS on the v2 shell — the app twin of the reel the feed runs
 * three times a day. A footballer's name on a board of letter tiles, some
 * tiles blank, a nation clue: fill the gaps. Ten rounds, EASY → IMPOSSIBLE as
 * the reel ramps them (the IMPOSSIBLE board hides the initials too).
 *
 * It wears the reel's look (`.theme-letters`: ink ground, cream tiles, lime
 * fills, the tier chip) and plays like Who's Older: type into the blanks on the
 * on-screen keyboard (or a real one), Check, and the board flips into the
 * reveal — the missing letters land lime when right, red when wrong — which
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
import { toast } from "sonner";
import { CalendarDays, Check, Delete, Flame, Infinity as InfinityIcon, Swords, X } from "lucide-react";
import { NeoCard } from "@/components/neo/NeoCard";
import { NeoButton } from "@/components/neo/NeoButton";
import { PlayStage } from "@/components/shell/play/PlayStage";
import { MetricsPanel, AmbientStrip } from "@/components/shell/play/ambient";
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

/** Below this many finishers "better than N%" is noise, so it stays hidden. */
const MIN_FINISHERS_FOR_STANDING = 5;

/** How long a reveal holds before the next board. A miss holds longer: the
 *  player needs to read the name they didn't get. */
const REVEAL_HOLD_MS = { right: 1900, wrong: 3000 } as const;
/** A tap during the reveal skips it — but not the tap that answered. */
const SKIP_GUARD_MS = 450;

const THEME = "theme-letters";
/** In-round toasts go up top: at the bottom they would cover Check and Give up. */
const TOAST_AT = "top-center" as const;

const TIER_CHIP: Record<Tier, string> = {
  easy: "bg-success text-success-foreground border-black",
  medium: "bg-yellow text-yellow-foreground border-black",
  hard: "bg-destructive text-destructive-foreground border-black",
  impossible: "bg-black text-accent border-accent",
};

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
  const [flash, setFlash] = useState<"good" | "bad" | null>(null);
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
  useEffect(() => {
    if (claimed.current) return;
    const token = searchParams.get("rt");
    if (!token) return;
    claimed.current = true;
    const confirm = searchParams.get("confirm") === "1";
    void claimTokenMut({ token, confirm })
      .then((res) => {
        track("missing_letters_reminder_claimed", { confirmed: res.confirmed, ok: res.ok });
        if (res.confirmed) toast.success(t("missingLetters.reminderConfirmed"));
      })
      .catch((err) => console.error("Reminder link failed:", err));
    const url = new URL(window.location.href);
    url.searchParams.delete("rt");
    url.searchParams.delete("confirm");
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}`);
  }, [searchParams, claimTokenMut, t]);

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
    autoStarted.current = true;
    if (challengeInfo) {
      track("missing_letters_challenge_opened", { is_today: challengeInfo.isToday, own: challengeInfo.own });
    }
    if (challenge && !challenge.isToday) void loadChallenge(challenge.challengeId);
    else void loadDaily();
  }, [challengeParam, challengeInfo, challenge, loadChallenge, loadDaily]);

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
      toast.error(t("missingLetters.startFailedMessage"));
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
          setFlash(res.reveal.correct ? "good" : "bad");
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
        toast.error(t("missingLetters.guessFailed"), { position: TOAST_AT });
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
      toast.error(t("missingLetters.tabSwitchForfeit"), { position: TOAST_AT });
      void submit({ forfeit: "timeout" });
    }, [status, view, reveal, submit, t]),
    // The hook's mount-time toast would also greet a player re-opening a
    // finished daily; warn once, when a round is actually live.
    { warningMessage: null },
  );
  const warned = useRef(false);
  useEffect(() => {
    if (warned.current || view?.status !== "active") return;
    warned.current = true;
    toast.warning(t("missingLetters.tabSwitchWarning"), { duration: 4000, position: TOAST_AT });
  }, [view?.status, t]);

  // Sharing a finished daily IS the challenge: the link replays the same ten
  // boards for whoever opens it. If the challenge cannot be minted the plain
  // result link still goes out.
  const share = async (daily: SessionView) => {
    const total = daily.totalRounds ?? daily.history.length;
    let url = `${getShareBaseUrl()}/letters?ref=missing_letters_share`;
    try {
      const { challengeId } = await createChallengeMut({ sessionId: daily.sessionId });
      url = `${getShareBaseUrl()}/letters?c=${challengeId}&ref=missing_letters_challenge`;
      track("missing_letters_challenge_shared", { edition: daily.edition, score: daily.score });
    } catch (err) {
      console.error("Challenge link failed:", err);
    }
    const text = `${t("missingLetters.challengeText", { n: daily.edition, score: daily.score, total })}\n${emojiRow(daily.history)}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: t("missingLetters.title"), text, url });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(`${text}\n${url}`);
      toast.success(t("missingLetters.copied"));
    } catch {
      toast.error(t("missingLetters.shareFailed"));
    }
  };

  const exit = () => navigate(SHELL_ROUTES.home);

  if (status !== "ready" || !view) {
    return (
      <PlayStage theme={THEME} title={t("missingLetters.title")} onExit={exit} exitLabel={t("missingLetters.quit")}>
        <div className="flex flex-col items-center justify-center py-12">
          {status === "failed" ? (
            <NeoCard color="pink" shadow="lg" className="w-full text-center py-8 px-5">
              <p className="font-heading font-bold text-2xl">{t("missingLetters.startFailedTitle")}</p>
              <p className="text-sm mt-3 opacity-90">{t("missingLetters.startFailedMessage")}</p>
              <NeoButton variant="primary" size="lg" className="mt-6 w-full" onClick={loadDaily}>
                {t("missingLetters.tryAgain")}
              </NeoButton>
            </NeoCard>
          ) : (
            <p className="font-heading font-bold text-lg animate-pulse">{t("missingLetters.loading")}</p>
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
  const progress =
    isDaily && view.totalRounds
      ? { current: Math.min(view.roundIndex + (reveal ? 0 : 1), view.totalRounds), total: view.totalRounds }
      : undefined;

  // ── Finished states (only once the last reveal has played out) ──
  if (view.status === "completed" && !reveal) {
    if (isDaily) {
      const daily = view;
      const standing = isChallengeRun ? null : (today?.standing ?? null);
      const showStanding = standing && standing.finishers >= MIN_FINISHERS_FOR_STANDING;
      const streak = !isChallengeRun && today?.streak?.playedToday ? today.streak : null;
      return (
        <PlayStage theme={THEME} title={t("missingLetters.title")} subtitle={subtitle} onExit={exit} exitLabel={t("missingLetters.home")}>
          <div className="flex flex-col gap-3 py-2">
            {challengeHere && challengeVerdict && (
              <HeadToHead game="letters" challenge={challengeHere} myScore={daily.score} verdict={challengeVerdict} />
            )}
            <div className="neo-border border-black neo-shadow-lg rounded-lg bg-electric-blue text-white text-center py-6 px-4">
              <p className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] opacity-90">
                {t("missingLetters.editionLabel", { n: daily.edition })}
              </p>
              <p className="font-heading font-black text-7xl leading-none mt-2" style={{ textShadow: "3px 3px 0 hsl(0 0% 7%)" }}>
                {daily.score}
                <span className="text-4xl opacity-80">/{daily.totalRounds}</span>
              </p>
              <p className="text-xl whitespace-nowrap mt-3" aria-hidden>
                {emojiRow(daily.history)}
              </p>
              {showStanding && (
                <p className="inline-block mt-3 rounded-full border-2 border-black bg-accent text-accent-foreground px-3 py-1 text-sm font-bold">
                  {t("missingLetters.standing", {
                    pct: Math.round((standing.below / standing.finishers) * 100),
                    count: standing.finishers,
                  })}
                </p>
              )}
              {!streak && !isChallengeRun && (
                <p className="font-mono text-[10.5px] uppercase mt-3 opacity-90">
                  {t("missingLetters.nextIn", { time: nextEditionCountdown() })}
                </p>
              )}
            </div>

            {streak && <StreakBlock game="letters" current={streak.current} best={streak.best} />}

            {isChallengeRun ? (
              <NeoButton variant="accent" size="lg" onClick={loadDaily} data-testid="missing-letters-play-today">
                <CalendarDays size={18} className="mr-1.5" />
                {t("missingLetters.playToday", { n: today?.edition ?? "" })}
              </NeoButton>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <NeoButton variant="pink" size="lg" onClick={() => share(daily)} data-testid="missing-letters-challenge-share">
                  <Swords size={18} className="mr-1.5" />
                  {t("missingLetters.challengeCta")}
                </NeoButton>
                <NeoButton variant="accent" size="lg" onClick={startEndless} disabled={busy} data-testid="missing-letters-endless">
                  <InfinityIcon size={18} className="mr-1.5" />
                  {t("missingLetters.playEndless")}
                </NeoButton>
              </div>
            )}
            {!isChallengeRun && bestEndless != null && (
              <p className="text-center font-mono text-[11px] uppercase text-accent">
                {t("missingLetters.bestStreak", { count: bestEndless })}
              </p>
            )}

            {today?.reminder && <ReminderCard game="letters" reminder={today.reminder} />}
            {!isChallengeRun && today?.challenges && <ChallengeResults game="letters" challenges={today.challenges} />}

            {/* The ten names — each row carries its verdict colour. */}
            <ol className="space-y-2" data-testid="missing-letters-answers">
              {daily.history.map((r, i) => (
                <li
                  key={i}
                  className={cn(
                    "neo-border border-black rounded-lg flex items-center gap-3 px-3 py-2 text-sm",
                    r.correct ? "bg-success text-success-foreground" : "bg-destructive text-destructive-foreground",
                  )}
                >
                  <span className="shrink-0 grid place-items-center h-6 w-6 rounded-full bg-black/25">
                    {r.correct ? <Check size={14} strokeWidth={3.5} /> : <X size={14} strokeWidth={3.5} />}
                  </span>
                  <span className="min-w-0 flex-1 leading-snug">
                    <span className="font-heading font-bold">{r.name}</span>{" "}
                    <span className="opacity-90">· {r.nation}</span>
                  </span>
                  <span className="shrink-0 font-mono text-[10px] font-bold uppercase opacity-90">
                    {t(`missingLetters.tier.${r.tier}`)}
                  </span>
                </li>
              ))}
            </ol>
            <p className="text-center text-[11px] text-muted-foreground">{t("missingLetters.sources")}</p>
          </div>
        </PlayStage>
      );
    }

    const last = view.history[view.history.length - 1];
    return (
      <PlayStage theme={THEME} title={t("missingLetters.title")} subtitle={subtitle} onExit={exit} exitLabel={t("missingLetters.home")}>
        <div className="flex flex-col gap-3 py-2">
          <div className="neo-border border-black neo-shadow-lg rounded-lg bg-hot-pink text-white text-center py-7 px-4">
            <p className="font-heading font-bold text-lg uppercase">{t("missingLetters.runOver")}</p>
            <p className="font-heading font-black text-8xl leading-none mt-2" style={{ textShadow: "3px 3px 0 hsl(0 0% 7%)" }}>
              {view.score}
            </p>
            <p className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] mt-2">{t("missingLetters.streakLabel")}</p>
            {last && !last.correct && (
              <p className="mt-3 text-sm">{t("missingLetters.itWas", { name: last.name })}</p>
            )}
            {bestEndless != null && (
              <p className="inline-block mt-4 rounded-full border-2 border-black bg-accent text-accent-foreground px-3 py-1 text-sm font-bold">
                {t("missingLetters.bestStreak", { count: bestEndless })}
              </p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <NeoButton variant="accent" size="lg" onClick={startEndless} disabled={busy}>
              {t("missingLetters.playAgain")}
            </NeoButton>
            <NeoButton variant="blue" size="lg" onClick={loadDaily}>
              {t("missingLetters.backToDaily")}
            </NeoButton>
          </div>
        </div>
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
        <span key={cell.index} className="font-heading font-black text-foreground/80 self-center" style={{ fontSize: `calc(${tileWidth} * 0.6)` }}>
          {cell.char}
        </span>
      );
    }
    const base = "grid place-items-center rounded-md font-heading font-black uppercase leading-none select-none";
    const size = { width: tileWidth, aspectRatio: "5 / 6", fontSize: `calc(${tileWidth} * 0.62)` } as const;
    if (slot === undefined) {
      return (
        <span key={cell.index} className={cn(base, "bg-foreground text-background border-[3px] border-black shadow-[3px_3px_0_0_#000]")} style={size}>
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
            "border-[3px] border-black shadow-[3px_3px_0_0_#000] animate-badge-land",
            right ? "bg-accent text-accent-foreground" : "bg-destructive text-destructive-foreground",
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
          "border-[3px]",
          letter ? "bg-white/10 text-foreground border-solid" : "bg-white/5 border-dashed",
          active ? "border-accent letters-cursor" : letter ? "border-foreground/70" : "border-foreground/45",
        )}
        style={size}
      >
        {letter}
      </button>
    );
  };

  const verdict = reveal
    ? reveal.forfeit === "timeout"
      ? { label: t("missingLetters.forfeited"), cls: "bg-destructive text-destructive-foreground" }
      : reveal.forfeit === "skip"
        ? { label: t("missingLetters.gaveUp"), cls: "bg-destructive text-destructive-foreground" }
        : reveal.correct
          ? { label: t("missingLetters.correct"), cls: "bg-accent text-accent-foreground" }
          : { label: t("missingLetters.wrong"), cls: "bg-destructive text-destructive-foreground" }
    : null;

  return (
    <PlayStage
      theme={THEME}
      title={t("missingLetters.title")}
      subtitle={subtitle}
      onExit={exit}
      exitLabel={t("missingLetters.quit")}
      strip={<AmbientStrip metrics={metrics} progress={progress} />}
      right={<MetricsPanel metrics={metrics} />}
    >
      {flash && (
        <div
          aria-hidden
          className={cn(
            "fixed inset-0 z-50 pointer-events-none opacity-0 animate-older-flash",
            flash === "good" ? "bg-success" : "bg-destructive",
          )}
        />
      )}
      <div className="flex flex-col h-full" onClick={reveal ? skipReveal : undefined}>
        {challengeHere && <ChallengeBanner game="letters" challenge={challengeHere} />}
        {/* Tier chip + progress: the reel's top line. */}
        <div className="shrink-0 flex items-center justify-between gap-2 mb-3">
          <span
            data-testid="missing-letters-tier"
            className={cn(
              "rounded-md border-[3px] px-2.5 py-0.5 font-mono font-bold text-[11px] uppercase tracking-[0.14em] shadow-[3px_3px_0_0_#000]",
              TIER_CHIP[board.tier],
            )}
          >
            {t(`missingLetters.tier.${board.tier}`)}
          </span>
          {isDaily && view.totalRounds ? (
            <div className="flex gap-1.5" aria-hidden>
              {Array.from({ length: view.totalRounds }, (_, i) => {
                const done = view.history[i];
                return (
                  <span
                    key={i}
                    className={cn(
                      "h-2.5 w-2.5 rounded-full border-2",
                      done
                        ? done.correct
                          ? "bg-accent border-accent"
                          : "bg-destructive border-destructive"
                        : i === shownIndex
                          ? "border-foreground bg-foreground/30 scale-125"
                          : "border-foreground/40",
                    )}
                  />
                );
              })}
            </div>
          ) : (
            <span className="inline-flex items-center gap-1 font-mono font-bold text-sm text-accent">
              <Flame size={15} strokeWidth={3} />
              {view.score}
              {bestEndless != null && (
                <span className="text-muted-foreground font-normal ml-1">
                  · {t("missingLetters.bestShort", { count: bestEndless })}
                </span>
              )}
            </span>
          )}
        </div>

        <div className="shrink-0 flex items-end justify-between gap-3">
          <p className="font-heading font-black uppercase text-4xl leading-[0.9] tracking-tight">
            {t("missingLetters.prompt")}
          </p>
          <span className="flex items-center gap-2 min-w-0">
            <span className="font-mono font-bold text-[10px] tracking-[0.16em] text-muted-foreground">
              {t("missingLetters.clue")}
            </span>
            <span
              data-testid="missing-letters-clue"
              className="truncate rounded-md border-[3px] border-black bg-foreground text-background px-2.5 py-0.5 font-heading font-black uppercase text-sm shadow-[3px_3px_0_0_#000]"
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
            <span
              className={cn(
                "animate-badge-land rounded-md border-[3px] border-black px-3 py-1 font-heading font-black uppercase text-sm shadow-[3px_3px_0_0_#000]",
                verdict.cls,
              )}
            >
              {verdict.label}
            </span>
            <span
              data-testid="missing-letters-answer"
              className="animate-badge-land rounded-md border-[3px] border-black bg-foreground text-background px-3 py-1.5 font-heading font-black uppercase text-lg shadow-[3px_3px_0_0_#000] text-center"
            >
              {reveal.name}
            </span>
            <span className="font-mono text-[10.5px] uppercase text-muted-foreground">{t("missingLetters.tapToContinue")}</span>
          </div>
        ) : (
          <div className="shrink-0 flex flex-col gap-1.5" data-testid="missing-letters-keyboard">
            {KEY_ROWS.map((row, ri) => (
              <div key={row} className="flex justify-center gap-1">
                {ri === 2 && <span className="flex-[0.5]" />}
                {[...row].map((k) => (
                  <button
                    key={k}
                    type="button"
                    disabled={busy}
                    onClick={() => typeLetter(k)}
                    data-testid={`missing-letters-key-${k}`}
                    className="flex-1 max-w-[2.6rem] h-11 rounded-md border-2 border-black bg-foreground text-background font-heading font-black text-base shadow-[2px_2px_0_0_#000] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none disabled:opacity-60"
                  >
                    {k}
                  </button>
                ))}
                {ri === 2 && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={backspace}
                    aria-label={t("missingLetters.backspace")}
                    data-testid="missing-letters-backspace"
                    className="flex-[1.5] max-w-[4rem] h-11 grid place-items-center rounded-md border-2 border-black bg-muted text-foreground shadow-[2px_2px_0_0_#000] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none disabled:opacity-60"
                  >
                    <Delete size={20} />
                  </button>
                )}
              </div>
            ))}
            <div className="mt-1.5 grid grid-cols-[1fr_2fr] gap-2">
              <NeoButton
                variant="outline"
                size="md"
                disabled={busy}
                onClick={() => void submit({ forfeit: "skip" })}
                data-testid="missing-letters-give-up"
              >
                {t("missingLetters.giveUp")}
              </NeoButton>
              <NeoButton
                variant="accent"
                size="md"
                disabled={busy || !complete}
                onClick={check}
                data-testid="missing-letters-check"
              >
                {t("missingLetters.check")}
              </NeoButton>
            </div>
          </div>
        )}
      </div>
    </PlayStage>
  );
}
