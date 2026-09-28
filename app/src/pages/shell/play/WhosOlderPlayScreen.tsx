/**
 * WHO'S OLDER? on the v2 shell — the app twin of the reel format that drives
 * most of the account's reach. Two footballers, tap the older one; the gap
 * between their birth dates shrinks every round, from years to days.
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
import { Infinity as InfinityIcon, Share2 } from "lucide-react";
import { NeoCard } from "@/components/neo/NeoCard";
import { NeoButton } from "@/components/neo/NeoButton";
import { NeoBadge } from "@/components/neo/NeoBadge";
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
      try {
        const res = await guessMut({
          sessionId: view.sessionId,
          roundIndex: view.roundIndex,
          pick,
        });
        if (res.applied && res.reveal) {
          noteQuestionAnswered(view.sessionId);
          setReveal(res.reveal);
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
      }
    },
    [view, reveal, guessMut, t],
  );

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
      <PlayStage title={t("whosOlder.title")} onExit={exit} exitLabel={t("whosOlder.quit")}>
        <div className="flex flex-col items-center justify-center py-12">
          {status === "failed" ? (
            <NeoCard color="primary" shadow="lg" className="w-full text-center py-8 px-5">
              <p className="font-heading font-bold text-2xl">{t("whosOlder.startFailedTitle")}</p>
              <p className="text-sm text-muted-foreground mt-3">{t("whosOlder.startFailedMessage")}</p>
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
  const bestEndless = today?.bestEndless ?? null;
  const subtitle = isDaily
    ? t("whosOlder.dailySubtitle", { n: view.edition })
    : t("whosOlder.endlessSubtitle");
  const metrics = isDaily ? { score: view.score } : { streak: view.score };
  const progress =
    isDaily && view.totalRounds
      ? { current: Math.min(view.roundIndex + (reveal ? 0 : 1), view.totalRounds), total: view.totalRounds }
      : undefined;

  // ── Finished states (only once the last reveal has been dismissed) ──
  if (view.status === "completed" && !reveal) {
    if (isDaily) {
      const daily = view;
      const standing = today?.standing ?? null;
      const showStanding = standing && standing.finishers >= MIN_FINISHERS_FOR_STANDING;
      return (
        <PlayStage title={t("whosOlder.title")} subtitle={subtitle} onExit={exit} exitLabel={t("whosOlder.home")}>
          <div className="flex flex-col gap-3 py-2">
            <NeoCard color="yellow" shadow="lg" className="text-center py-6 px-4">
              <p className="font-mono text-[11px] font-bold uppercase tracking-[0.16em]">
                {t("whosOlder.editionLabel", { n: daily.edition })}
              </p>
              <p className="font-heading font-black text-6xl leading-none mt-2">
                {daily.score}/{daily.totalRounds}
              </p>
              <p className="text-xl whitespace-nowrap mt-3" aria-hidden>
                {emojiRow(daily.history)}
              </p>
              {showStanding && (
                <p className="text-sm font-medium mt-3">
                  {t("whosOlder.standing", {
                    pct: Math.round((standing.below / standing.finishers) * 100),
                    count: standing.finishers,
                  })}
                </p>
              )}
              <p className="font-mono text-[10.5px] uppercase text-muted-foreground mt-3">
                {t("whosOlder.nextIn", { time: nextEditionCountdown() })}
              </p>
            </NeoCard>

            <div className="grid grid-cols-2 gap-3">
              <NeoButton variant="secondary" size="lg" onClick={() => share(daily)}>
                <Share2 size={18} className="mr-1.5" />
                {t("whosOlder.share")}
              </NeoButton>
              <NeoButton variant="primary" size="lg" onClick={startEndless} disabled={busy}>
                <InfinityIcon size={18} className="mr-1.5" />
                {t("whosOlder.playEndless")}
              </NeoButton>
            </div>
            {bestEndless != null && (
              <p className="text-center font-mono text-[11px] uppercase text-muted-foreground">
                {t("whosOlder.bestStreak", { count: bestEndless })}
              </p>
            )}

            {/* The ten answers, oldest-first facts on each line. */}
            <NeoCard className="p-3">
              <ol className="space-y-1.5">
                {daily.history.map((r, i) => {
                  const older = r[r.older];
                  const younger = r[r.older === "a" ? "b" : "a"];
                  return (
                    <li key={i} className="flex items-baseline gap-2 text-sm">
                      <span aria-hidden>{r.correct ? "🟩" : "🟥"}</span>
                      <span className="min-w-0">
                        <span className="font-bold">{older.name}</span>
                        <span className="text-muted-foreground">
                          {" "}
                          {t("whosOlder.olderThan", { name: younger.name, gap: formatGap(r.gapDays) })}
                        </span>
                      </span>
                    </li>
                  );
                })}
              </ol>
            </NeoCard>
            <p className="text-center text-[11px] text-muted-foreground">{t("whosOlder.sources")}</p>
          </div>
        </PlayStage>
      );
    }

    return (
      <PlayStage title={t("whosOlder.title")} subtitle={subtitle} onExit={exit} exitLabel={t("whosOlder.home")}>
        <div className="flex flex-col gap-3 py-2">
          <NeoCard color="primary" shadow="lg" className="text-center py-6 px-4">
            <p className="font-heading font-bold text-lg">{t("whosOlder.runOver")}</p>
            <p className="font-heading font-black text-6xl leading-none mt-2">{view.score}</p>
            <p className="font-mono text-[11px] uppercase mt-1">{t("whosOlder.streakLabel")}</p>
            {bestEndless != null && (
              <p className="text-sm font-medium mt-3">{t("whosOlder.bestStreak", { count: bestEndless })}</p>
            )}
          </NeoCard>
          <div className="grid grid-cols-2 gap-3">
            <NeoButton variant="primary" size="lg" onClick={startEndless} disabled={busy}>
              {t("whosOlder.playAgain")}
            </NeoButton>
            <NeoButton variant="secondary" size="lg" onClick={loadDaily}>
              {t("whosOlder.backToDaily")}
            </NeoButton>
          </div>
        </div>
      </PlayStage>
    );
  }

  // ── A round: pending (names only) or revealed (names + birth dates) ──
  const names = reveal ? { a: reveal.a.name, b: reveal.b.name } : view.pending
    ? { a: view.pending.a.name, b: view.pending.b.name }
    : null;
  if (!names) return null;

  const cardTone = (side: Side) => {
    if (!reveal) return "bg-card";
    if (reveal.older === side) return "bg-success text-success-foreground";
    if (reveal.guess === side) return "bg-destructive text-destructive-foreground";
    return "bg-card opacity-80";
  };

  const renderCard = (side: Side) => (
    <button
      key={side}
      type="button"
      disabled={!!reveal || busy}
      onClick={() => answer(side)}
      data-testid={`whos-older-card-${side}`}
      className={cn(
        "neo-border neo-shadow-lg rounded-lg flex-1 min-h-0 w-full px-4 py-3 flex flex-col items-center justify-center text-center transition-transform",
        !reveal && "hover:-translate-x-[2px] hover:-translate-y-[2px] active:translate-x-[2px] active:translate-y-[2px]",
        cardTone(side),
      )}
    >
      {reveal?.older === side && (
        <NeoBadge color="yellow" size="sm" className="mb-1.5">
          {t("whosOlder.olderBadge")}
        </NeoBadge>
      )}
      <span className="font-heading font-black uppercase leading-[0.95] text-[26px] md:text-[34px] break-words max-w-full">
        {names[side]}
      </span>
      <span className="font-mono font-bold text-sm mt-2 min-h-[1.25rem]">
        {reveal ? t("whosOlder.born", { date: formatDob(reveal[side].dob) }) : ""}
      </span>
    </button>
  );

  const last = view.status === "completed";

  return (
    <PlayStage
      title={t("whosOlder.title")}
      subtitle={subtitle}
      onExit={exit}
      exitLabel={t("whosOlder.quit")}
      strip={<AmbientStrip metrics={metrics} progress={progress} />}
      right={<MetricsPanel metrics={metrics} />}
    >
      <div className="flex flex-col h-full">
        {isDaily && view.totalRounds ? (
          <div className="shrink-0 flex justify-center gap-1.5 mb-2" aria-hidden>
            {Array.from({ length: view.totalRounds }, (_, i) => {
              const done = view.history[i];
              return (
                <span
                  key={i}
                  className={cn(
                    "h-2.5 w-2.5 rounded-full border-2 border-foreground",
                    done ? (done.correct ? "bg-success" : "bg-destructive") : "bg-background",
                  )}
                />
              );
            })}
          </div>
        ) : (
          <p className="shrink-0 text-center font-mono text-[11px] uppercase text-muted-foreground mb-2">
            {bestEndless != null ? t("whosOlder.bestStreak", { count: bestEndless }) : t("whosOlder.endlessHint")}
          </p>
        )}

        <p className="shrink-0 text-center font-heading font-bold text-base mb-2">
          {t("whosOlder.prompt")}
        </p>

        <div className="flex-1 min-h-0 flex flex-col gap-1.5">
          {renderCard("a")}
          <div className="shrink-0 flex items-center justify-center">
            <div className="neo-border rounded-full bg-background px-3 py-0.5 font-heading font-bold text-xs uppercase">
              {reveal ? t("whosOlder.apart", { gap: formatGap(reveal.gapDays) }) : "VS"}
            </div>
          </div>
          {renderCard("b")}
        </div>

        <div className="shrink-0 mt-3 min-h-[3rem]">
          {reveal && (
            <NeoButton
              variant="primary"
              size="lg"
              className="w-full"
              onClick={() => setReveal(null)}
              data-testid="whos-older-next"
            >
              {reveal.guess === "timeout"
                ? t("whosOlder.forfeited")
                : reveal.correct
                  ? t("whosOlder.correct")
                  : t("whosOlder.wrong")}
              {" · "}
              {last ? t("whosOlder.seeResult") : t("whosOlder.next")}
            </NeoButton>
          )}
        </div>
      </div>
    </PlayStage>
  );
}
