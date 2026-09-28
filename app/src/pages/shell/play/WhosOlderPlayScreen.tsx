/**
 * WHO'S OLDER? on the v2 shell — the app twin of the reel format that drives
 * most of the account's reach. Two footballers, tap the older one; the gap
 * between their birth dates shrinks every round, from years to days.
 *
 * It wears the reel's look (`.theme-older`: ink ground, blue card over pink,
 * lime OLDER stamp, escalating EASY → IMPOSSIBLE chip) and moves on by itself:
 * an answer flips straight into the reveal — verdict, birth dates, gap — which
 * holds for a beat and then deals the next pair. Tapping skips the wait.
 *
 * Daily first: everyone gets the same ten pairs per UTC date, one attempt,
 * scored /10 with a shareable emoji row. Finishing it unlocks ENDLESS — fresh
 * pairs until the first wrong answer. Every decision is server-authoritative
 * (convex/whosOlder.ts): the client is dealt NAMES only and learns the birth
 * dates from the reveal after it has answered.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Check, Flame, Infinity as InfinityIcon, Share2, X } from "lucide-react";
import { NeoCard } from "@/components/neo/NeoCard";
import { NeoButton } from "@/components/neo/NeoButton";
import { PlayStage } from "@/components/shell/play/PlayStage";
import { MetricsPanel, AmbientStrip } from "@/components/shell/play/ambient";
import { SHELL_ROUTES } from "@/lib/shellRoutes";
import { getShareBaseUrl } from "@/lib/shareBase";
import { useAntiCheat } from "@/hooks/useAntiCheat";
import { useAuth } from "@/contexts/AuthContext";
import {
  startRun,
  noteQuestionAnswered,
  completeRun,
  abandonRun,
} from "@/lib/gameAnalytics";
import { cn } from "@/lib/utils";
import { api } from "../../../../convex/_generated/api";

type SessionView = FunctionReturnType<typeof api.whosOlder.startDaily>["session"];
type Reveal = SessionView["history"][number];
type Side = "a" | "b";

/** Below this many finishers "better than N%" is noise, so it stays hidden. */
const MIN_FINISHERS_FOR_STANDING = 5;

/** How long a reveal holds before the next pair. A miss holds longer: that is
 *  the reveal the player actually needs to read. */
const REVEAL_HOLD_MS = { right: 1900, wrong: 2600 } as const;
/** A tap during the reveal skips it — but not the tap that answered. */
const SKIP_GUARD_MS = 450;

const THEME = "theme-older";

type Tier = "easy" | "close" | "tight" | "impossible";
/** The reel's escalation chip, keyed on the round's place in the ramp. */
function tierFor(step: number): Tier {
  if (step <= 2) return "easy";
  if (step <= 5) return "close";
  if (step <= 8) return "tight";
  return "impossible";
}
const TIER_CHIP: Record<Tier, string> = {
  easy: "bg-success text-success-foreground border-black",
  close: "bg-yellow text-yellow-foreground border-black",
  tight: "bg-destructive text-destructive-foreground border-black",
  impossible: "bg-black text-accent border-accent",
};
/** Heavy ink drop on the white names — the reel's type treatment. */
const NAME_SHADOW = { textShadow: "3px 3px 0 hsl(0 0% 7%)" } as const;

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

export default function WhosOlderPlayScreen() {
  const { t, i18n } = useTranslation("play");
  const navigate = useNavigate();
  const { accountState } = useAuth();

  const startDailyMut = useMutation(api.whosOlder.startDaily);
  const startEndlessMut = useMutation(api.whosOlder.startEndless);
  const guessMut = useMutation(api.whosOlder.guess);
  // Reactive: the result card's standing and best streak update live.
  const today = useQuery(api.whosOlder.getToday, {});

  const [view, setView] = useState<SessionView | null>(null);
  const [reveal, setReveal] = useState<Reveal | null>(null);
  const [status, setStatus] = useState<"loading" | "failed" | "ready">("loading");
  const [busy, setBusy] = useState(false);
  const [pendingPick, setPendingPick] = useState<Side | null>(null);
  const [flash, setFlash] = useState<"good" | "bad" | null>(null);
  const revealedAt = useRef(0);
  const inFlight = useRef(false);

  const accountStateRef = useRef(accountState);
  accountStateRef.current = accountState;

  const formatDob = useCallback(
    (dob: string) =>
      new Intl.DateTimeFormat(i18n.resolvedLanguage ?? i18n.language, {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      }).format(new Date(`${dob}T00:00:00Z`)),
    [i18n.resolvedLanguage, i18n.language],
  );

  const formatGap = useCallback(
    (days: number) => {
      if (days < 60) return t("whosOlder.gapDays", { count: days });
      if (days < 365) return t("whosOlder.gapMonths", { count: Math.floor(days / 30.44) });
      return t("whosOlder.gapYears", { count: Math.floor(days / 365.25) });
    },
    [t],
  );

  const loadDaily = useCallback(async () => {
    setStatus("loading");
    try {
      const res = await startDailyMut({});
      // Only a freshly minted daily is a game start; resuming or re-opening a
      // finished one mints nothing and stays silent.
      if (res.created) {
        startRun(res.session.sessionId, "whos-older", {
          accountState: accountStateRef.current,
        });
      }
      setView(res.session);
      setReveal(null);
      setStatus("ready");
    } catch (err) {
      console.error("Who's Older failed to start:", err);
      setStatus("failed");
    }
  }, [startDailyMut]);

  // One provision per arrival — a re-created closure (locale switch) is not a
  // new game.
  const autoStarted = useRef(false);
  useEffect(() => {
    if (autoStarted.current) return;
    autoStarted.current = true;
    void loadDaily();
  }, [loadDaily]);

  const liveSessionRef = useRef<string | null>(null);
  liveSessionRef.current = view?.status === "active" ? view.sessionId : null;
  useEffect(() => () => abandonRun(liveSessionRef.current), []);

  const startEndless = async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    try {
      const res = await startEndlessMut({});
      startRun(res.session.sessionId, "whos-older-endless", {
        accountState: accountStateRef.current,
        startTrigger: "user_action",
      });
      setView(res.session);
      setReveal(null);
    } catch (err) {
      console.error("Endless failed to start:", err);
      toast.error(t("whosOlder.startFailedMessage"));
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  const answer = useCallback(
    async (pick: Side | "timeout") => {
      if (!view || view.status !== "active" || reveal || inFlight.current) return;
      inFlight.current = true;
      setBusy(true);
      if (pick !== "timeout") setPendingPick(pick);
      try {
        const res = await guessMut({
          sessionId: view.sessionId,
          roundIndex: view.roundIndex,
          pick,
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
              result: view.kind === "daily" || res.reveal.correct ? "win" : "loss",
            });
          }
        }
        setView(res.session);
      } catch (err) {
        console.error("Who's Older guess failed:", err);
        toast.error(t("whosOlder.guessFailed"));
      } finally {
        inFlight.current = false;
        setBusy(false);
        setPendingPick(null);
      }
    },
    [view, reveal, guessMut, t],
  );

  // The reveal holds for a beat, then the next pair (or the result) takes over
  // on its own — no Next button between rounds.
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

  // Leaving the tab mid-round forfeits THAT round (a birth date is one search
  // away). It never touches a round already revealed.
  useAntiCheat(
    useCallback(() => {
      if (status !== "ready" || !view || view.status !== "active" || reveal) return;
      toast.error(t("whosOlder.tabSwitchForfeit"));
      void answer("timeout");
    }, [status, view, reveal, answer, t]),
    // The hook's mount-time toast would also greet a player re-opening a
    // finished daily; warn once, when a round is actually live.
    { warningMessage: null },
  );
  const warned = useRef(false);
  useEffect(() => {
    if (warned.current || view?.status !== "active") return;
    warned.current = true;
    toast.warning(t("whosOlder.tabSwitchWarning"), { duration: 4000 });
  }, [view?.status, t]);

  const share = async (daily: SessionView) => {
    const text = `${t("whosOlder.shareTitle", { n: daily.edition, score: daily.score, total: daily.totalRounds ?? daily.history.length })}\n${emojiRow(daily.history)}`;
    const url = `${getShareBaseUrl()}/v2/whos-older?ref=whos_older_share`;
    if (navigator.share) {
      try {
        await navigator.share({ title: t("whosOlder.title"), text, url });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(`${text}\n${url}`);
      toast.success(t("whosOlder.copied"));
    } catch {
      toast.error(t("whosOlder.shareFailed"));
    }
  };

  const exit = () => navigate(SHELL_ROUTES.home);

  if (status !== "ready" || !view) {
    return (
      <PlayStage theme={THEME} title={t("whosOlder.title")} onExit={exit} exitLabel={t("whosOlder.quit")}>
        <div className="flex flex-col items-center justify-center py-12">
          {status === "failed" ? (
            <NeoCard color="pink" shadow="lg" className="w-full text-center py-8 px-5">
              <p className="font-heading font-bold text-2xl">{t("whosOlder.startFailedTitle")}</p>
              <p className="text-sm mt-3 opacity-90">{t("whosOlder.startFailedMessage")}</p>
              <NeoButton variant="primary" size="lg" className="mt-6 w-full" onClick={loadDaily}>
                {t("whosOlder.tryAgain")}
              </NeoButton>
            </NeoCard>
          ) : (
            <p className="font-heading font-bold text-lg animate-pulse">{t("whosOlder.loading")}</p>
          )}
        </div>
      </PlayStage>
    );
  }


  const isDaily = view.kind === "daily";
  // A best of 0 is not worth a line; the streak only shows once it means something.
  const bestEndless = today?.bestEndless ? today.bestEndless : null;
  const subtitle = isDaily
    ? t("whosOlder.dailySubtitle", { n: view.edition })
    : t("whosOlder.endlessSubtitle");
  const metrics = isDaily ? { score: view.score } : { streak: view.score };
  const progress =
    isDaily && view.totalRounds
      ? { current: Math.min(view.roundIndex + (reveal ? 0 : 1), view.totalRounds), total: view.totalRounds }
      : undefined;

  // ── Finished states (only once the last reveal has played out) ──
  if (view.status === "completed" && !reveal) {
    if (isDaily) {
      const daily = view;
      const standing = today?.standing ?? null;
      const showStanding = standing && standing.finishers >= MIN_FINISHERS_FOR_STANDING;
      return (
        <PlayStage theme={THEME} title={t("whosOlder.title")} subtitle={subtitle} onExit={exit} exitLabel={t("whosOlder.home")}>
          <div className="flex flex-col gap-3 py-2">
            <div className="neo-border border-black neo-shadow-lg rounded-lg bg-electric-blue text-white text-center py-6 px-4">
              <p className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] opacity-90">
                {t("whosOlder.editionLabel", { n: daily.edition })}
              </p>
              <p className="font-heading font-black text-7xl leading-none mt-2" style={NAME_SHADOW}>
                {daily.score}
                <span className="text-4xl opacity-80">/{daily.totalRounds}</span>
              </p>
              <p className="text-xl whitespace-nowrap mt-3" aria-hidden>
                {emojiRow(daily.history)}
              </p>
              {showStanding && (
                <p className="inline-block mt-3 rounded-full border-2 border-black bg-accent text-accent-foreground px-3 py-1 text-sm font-bold">
                  {t("whosOlder.standing", {
                    pct: Math.round((standing.below / standing.finishers) * 100),
                    count: standing.finishers,
                  })}
                </p>
              )}
              <p className="font-mono text-[10.5px] uppercase mt-3 opacity-90">
                {t("whosOlder.nextIn", { time: nextEditionCountdown() })}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <NeoButton variant="pink" size="lg" onClick={() => share(daily)}>
                <Share2 size={18} className="mr-1.5" />
                {t("whosOlder.share")}
              </NeoButton>
              <NeoButton variant="accent" size="lg" onClick={startEndless} disabled={busy}>
                <InfinityIcon size={18} className="mr-1.5" />
                {t("whosOlder.playEndless")}
              </NeoButton>
            </div>
            {bestEndless != null && (
              <p className="text-center font-mono text-[11px] uppercase text-accent">
                {t("whosOlder.bestStreak", { count: bestEndless })}
              </p>
            )}

            {/* The ten answers — each row carries its verdict colour. */}
            <ol className="space-y-2">
              {daily.history.map((r, i) => {
                const older = r[r.older];
                const younger = r[r.older === "a" ? "b" : "a"];
                return (
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
                    <span className="min-w-0 leading-snug">
                      <span className="font-heading font-bold">{older.name}</span>{" "}
                      <span className="opacity-90">
                        {t("whosOlder.olderThan", { name: younger.name, gap: formatGap(r.gapDays) })}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ol>
            <p className="text-center text-[11px] text-muted-foreground">{t("whosOlder.sources")}</p>
          </div>
        </PlayStage>
      );
    }

    return (
      <PlayStage theme={THEME} title={t("whosOlder.title")} subtitle={subtitle} onExit={exit} exitLabel={t("whosOlder.home")}>
        <div className="flex flex-col gap-3 py-2">
          <div className="neo-border border-black neo-shadow-lg rounded-lg bg-hot-pink text-white text-center py-7 px-4">
            <p className="font-heading font-bold text-lg uppercase">{t("whosOlder.runOver")}</p>
            <p className="font-heading font-black text-8xl leading-none mt-2" style={NAME_SHADOW}>
              {view.score}
            </p>
            <p className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] mt-2">{t("whosOlder.streakLabel")}</p>
            {bestEndless != null && (
              <p className="inline-block mt-4 rounded-full border-2 border-black bg-accent text-accent-foreground px-3 py-1 text-sm font-bold">
                {t("whosOlder.bestStreak", { count: bestEndless })}
              </p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <NeoButton variant="accent" size="lg" onClick={startEndless} disabled={busy}>
              {t("whosOlder.playAgain")}
            </NeoButton>
            <NeoButton variant="blue" size="lg" onClick={loadDaily}>
              {t("whosOlder.backToDaily")}
            </NeoButton>
          </div>
        </div>
      </PlayStage>
    );
  }

  // ── A round: pending (names only) or revealed (names + birth dates) ──
  const names = reveal
    ? { a: reveal.a.name, b: reveal.b.name }
    : view.pending
      ? { a: view.pending.a.name, b: view.pending.b.name }
      : null;
  if (!names) return null;

  // The round on screen: during a reveal the server has already moved on, so
  // the revealed round is the one before `roundIndex`. Keying the cards on it
  // replays the swing-in only when a NEW pair is dealt.
  const shownIndex = reveal ? view.roundIndex - 1 : view.roundIndex;
  const tier = tierFor(isDaily ? shownIndex : Math.min(shownIndex, 9));

  const renderCard = (side: Side) => {
    const isOlder = reveal?.older === side;
    const pickedWrong = reveal && !reveal.correct && reveal.guess === side;
    return (
      <button
        key={`${shownIndex}-${side}`}
        type="button"
        disabled={busy}
        onClick={() => (reveal ? skipReveal() : answer(side))}
        data-testid={`whos-older-card-${side}`}
        className={cn(
          "relative flex-1 min-h-0 w-full rounded-xl px-4 py-3 text-white",
          "flex flex-col items-center justify-center text-center overflow-visible",
          "border-[3px] transition-[transform,opacity,box-shadow] duration-200",
          side === "a" ? "bg-electric-blue animate-older-in-top" : "bg-hot-pink animate-older-in-bottom",
          isOlder
            ? "border-accent shadow-[7px_7px_0_0_#000] -translate-y-1"
            : pickedWrong
              ? "border-destructive shadow-[5px_5px_0_0_#000]"
              : "border-black shadow-[5px_5px_0_0_#000]",
          pickedWrong && "animate-shake-horizontal",
          !reveal && "active:translate-x-[3px] active:translate-y-[3px] active:shadow-[2px_2px_0_0_#000]",
          pendingPick === side && "translate-x-[3px] translate-y-[3px] shadow-[2px_2px_0_0_#000]",
        )}
      >
        {/* The younger card dims under a scrim — not via opacity, which the
            swing-in animation's fill would override. */}
        {reveal && !isOlder && (
          <span aria-hidden className="absolute inset-0 rounded-[9px] bg-black/55 pointer-events-none" />
        )}
        {isOlder && (
          <span className="absolute -top-3 right-3 rotate-[-8deg] animate-badge-land rounded-md border-[3px] border-black bg-accent text-accent-foreground px-2.5 py-0.5 font-heading font-black text-sm uppercase shadow-[3px_3px_0_0_#000]">
            {t("whosOlder.olderBadge")}
          </span>
        )}
        <span
          className="relative font-heading font-black uppercase leading-[0.92] tracking-tight text-[30px] md:text-[38px] break-words max-w-full"
          style={NAME_SHADOW}
        >
          {names[side]}
        </span>
        <span className="relative mt-2.5 min-h-[1.9rem] flex items-center">
          {reveal && (
            <span className="animate-badge-land rounded-md border-[3px] border-black bg-foreground text-background px-2.5 py-0.5 font-mono font-bold text-sm tabular-nums shadow-[3px_3px_0_0_#000]">
              {formatDob(reveal[side].dob)}
            </span>
          )}
        </span>
      </button>
    );
  };

  const verdict = reveal
    ? reveal.guess === "timeout"
      ? { label: t("whosOlder.forfeited"), cls: "bg-destructive text-destructive-foreground" }
      : reveal.correct
        ? { label: t("whosOlder.correct"), cls: "bg-accent text-accent-foreground" }
        : { label: t("whosOlder.wrong"), cls: "bg-destructive text-destructive-foreground" }
    : null;

  return (
    <PlayStage
      theme={THEME}
      title={t("whosOlder.title")}
      subtitle={subtitle}
      onExit={exit}
      exitLabel={t("whosOlder.quit")}
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
      <div className="flex flex-col h-full">
        {/* Escalation chip + progress: the reel's top line. */}
        <div className="shrink-0 flex items-center justify-between gap-2 mb-2">
          <span
            className={cn(
              "rounded-md border-[3px] px-2.5 py-0.5 font-mono font-bold text-[11px] uppercase tracking-[0.14em] shadow-[3px_3px_0_0_#000]",
              TIER_CHIP[tier],
            )}
          >
            {t(`whosOlder.tier.${tier}`)}
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
                  · {t("whosOlder.bestShort", { count: bestEndless })}
                </span>
              )}
            </span>
          )}
        </div>

        <p className="shrink-0 text-center font-heading font-black uppercase text-lg tracking-tight mb-3">
          {t("whosOlder.prompt")}
        </p>

        <div className="relative flex-1 min-h-0 flex flex-col gap-4">
          {renderCard("a")}
          {renderCard("b")}
          {/* The VS hinge on the seam; it becomes the verdict on reveal. */}
          <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
            <div
              key={reveal ? `v${shownIndex}` : "vs"}
              className={cn(
                "grid place-items-center h-14 w-14 rounded-full border-[3px] border-black font-heading font-black text-lg shadow-[4px_4px_0_0_#000]",
                reveal ? "animate-badge-land" : "",
                !reveal
                  ? "bg-foreground text-background"
                  : reveal.correct
                    ? "bg-accent text-accent-foreground"
                    : "bg-destructive text-destructive-foreground",
              )}
            >
              {!reveal ? "VS" : reveal.correct ? <Check size={28} strokeWidth={4} /> : <X size={28} strokeWidth={4} />}
            </div>
          </div>
        </div>

        {/* Verdict + gap, where a Next button used to be. */}
        <div className="shrink-0 mt-4 min-h-[2.75rem] flex items-center justify-center gap-2" aria-live="polite">
          {verdict && reveal && (
            <>
              <span
                className={cn(
                  "animate-badge-land rounded-md border-[3px] border-black px-3 py-1 font-heading font-black uppercase text-sm shadow-[3px_3px_0_0_#000]",
                  verdict.cls,
                )}
              >
                {verdict.label}
              </span>
              <span className="animate-badge-land inline-flex items-baseline gap-2 rounded-md border-[3px] border-black bg-foreground text-background px-3 py-1 shadow-[3px_3px_0_0_#000]">
                <span className="font-mono font-bold text-[10px] tracking-[0.16em] opacity-60">
                  {t("whosOlder.gapLabel")}
                </span>
                <span
                  className={cn(
                    "font-heading font-black uppercase text-sm",
                    reveal.gapDays < 30 ? "text-destructive" : "text-background",
                  )}
                >
                  {formatGap(reveal.gapDays)}
                </span>
              </span>
            </>
          )}
        </div>
      </div>
    </PlayStage>
  );
}
