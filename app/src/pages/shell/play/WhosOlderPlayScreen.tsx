/**
 * WHO'S OLDER? on the v2 shell — the app twin of the reel format that drives
 * most of the account's reach. Two footballers, tap the older one; the gap
 * between their birth dates shrinks every round, from years to days.
 *
 * It wears the reel's look on the shared StageFrame (ink ground, blue card
 * over pink with cream display names, an OLDER stamp, the EASY → IMPOSSIBLE
 * ramp as a neutral tier tag) and moves on by itself:
 * an answer flips straight into the reveal — verdict, birth dates, gap — which
 * holds for a beat and then deals the next pair. Tapping skips the wait.
 *
 * Daily first: everyone gets the same ten pairs per UTC date, one attempt,
 * scored /10 with a shareable emoji row. Finishing it unlocks ENDLESS — fresh
 * pairs until the first wrong answer.
 *
 * The result is the shared ResultScreen (components/shell/play/result): score
 * hero, streak, ONE lime Share, "Next today" (Missing Letters), Endless, and a
 * quiet reminder/follow line. The retention loop's pieces
 * (WhosOlderRetention.tsx) are:
 * the daily STREAK with a live countdown to the next edition, the EMAIL
 * REMINDER sign-up, and the CHALLENGE — sharing turns the result into a
 * `/older?c=<id>` link. A friend opening it plays the same ten pairs (today's
 * daily, or the sender's frozen past date as a "challenge" run) under a
 * score-to-beat banner and finishes on a head-to-head. Reminder emails land
 * here with `?rt=<token>`, which links this browser to the subscription. Every decision is server-authoritative
 * (convex/whosOlder.ts): the client is dealt NAMES only and learns the birth
 * dates from the reveal after it has answered.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useTranslation } from "react-i18next";
import { notify } from "@/lib/notify";
import { CalendarDays, Check, Share2, Flame, Infinity as InfinityIcon, Star, X } from "lucide-react";
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
import { FollowLink, ShareSheet, StreakHandoff } from "@/components/shell/play/whosOlder/DailyShare";
import { InstallPrompt } from "@/components/InstallPrompt";
import { cameThroughHandoff } from "@/lib/openInBrowser";
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

type SessionView = FunctionReturnType<typeof api.whosOlder.startDaily>["session"];
type Reveal = SessionView["history"][number];
type Side = "a" | "b";

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
const TIER_LEVEL: Record<Tier, 0 | 1 | 2 | 3> = { easy: 0, close: 1, tight: 2, impossible: 3 };
/**
 * Heavy ink drop on the cream display names — the reel's type treatment, and
 * the one sanctioned exception to "ink text on fills": ≥24px bold names pass
 * 3:1 large-text contrast on the blue and pink cards.
 */
const NAME_SHADOW = { textShadow: "3px 3px 0 hsl(var(--ink))" } as const;

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
  const [searchParams] = useSearchParams();
  const challengeParam = searchParams.get("c");

  const startDailyMut = useMutation(api.whosOlder.startDaily);
  const startEndlessMut = useMutation(api.whosOlder.startEndless);
  const startChallengeMut = useMutation(api.whosOlder.startChallenge);
  const createChallengeMut = useMutation(api.whosOlder.createChallenge);
  const recordChallengeMut = useMutation(api.whosOlder.recordChallengeResult);
  const claimTokenMut = useMutation(api.whosOlderReminders.claimToken);
  const guessMut = useMutation(api.whosOlder.guess);
  // Reactive: the result card's standing, streak, reminder and challenge
  // results update live.
  const today = useQuery(api.whosOlder.getToday, {});
  const challengeInfo = useQuery(
    api.whosOlder.getChallenge,
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
  const [pendingPick, setPendingPick] = useState<Side | null>(null);
  const [flash, setFlash] = useState<"right" | "wrong" | null>(null);
  const revealedAt = useRef(0);
  const inFlight = useRef(false);
  // "Next today" on the result: is today's Missing Letters already done?
  // Asked only once a run has finished.
  const lettersToday = useQuery(api.missingLetters.getToday, view?.status === "completed" ? {} : "skip");

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
        track("whos_older_reminder_claimed", { confirmed: res.confirmed, ok: res.ok });
        if (res.confirmed) notify.success(t("whosOlder.reminderConfirmed"));
      })
      .catch((err) => console.error("Reminder link failed:", err))
      .finally(() => setReminderLinkSettled(true));
    const url = new URL(window.location.href);
    url.searchParams.delete("rt");
    url.searchParams.delete("confirm");
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}`);
  }, [searchParams, claimTokenMut, t]);

  // A streak link from another browser (`?st=`): join this browser to it.
  const streakLinkSettled = useStreakLinkClaim("older");

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

  /** A past date's challenge: the sender's ten pairs as this player's run. */
  const loadChallenge = useCallback(
    async (challengeId: NonNullable<typeof challenge>["challengeId"]) => {
      setStatus("loading");
      try {
        const res = await startChallengeMut({ challengeId });
        if (res.created) {
          startRun(res.session.sessionId, "whos-older-challenge", {
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
  // date plays the sender's pairs, anything else plays today's daily.
  const autoStarted = useRef(false);
  useEffect(() => {
    if (autoStarted.current) return;
    if (challengeParam && challengeInfo === undefined) return;
    if (!streakLinkSettled || !reminderLinkSettled) return;
    autoStarted.current = true;
    if (challengeInfo) {
      track("whos_older_challenge_opened", { is_today: challengeInfo.isToday, own: challengeInfo.own });
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
        if (res.recorded) track("whos_older_challenge_finished", { verdict: res.verdict, is_today: challenge.isToday });
      })
      .catch((err) => console.error("Challenge result failed:", err));
  }, [challenge, view, recordChallengeMut]);

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
      notify.error(t("whosOlder.startFailedMessage"));
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
          setFlash(res.reveal.correct ? "right" : "wrong");
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
        notify.error(t("whosOlder.guessFailed"));
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
      notify.error(t("whosOlder.tabSwitchForfeit"));
      void answer("timeout");
    }, [status, view, reveal, answer, t]),
    // The rule line counts only once a round is live, so re-opening a
    // finished daily doesn't use up the session's one statement of it.
    { warningMessage: t("whosOlder.tabSwitchWarning"), active: view?.status === "active" },
  );

  // Sharing a finished daily IS the challenge: the link replays the same ten
  // pairs for whoever opens it. If the challenge cannot be minted the plain
  // result link still goes out. The share sheet calls this once as it opens.
  const [shareOpen, setShareOpen] = useState(false);
  const makeShareLink = async (daily: SessionView) => {
    try {
      const { challengeId } = await createChallengeMut({ sessionId: daily.sessionId });
      track("whos_older_challenge_shared", { edition: daily.edition, score: daily.score });
      return `${getShareBaseUrl()}/older?c=${challengeId}&ref=whos_older_challenge`;
    } catch (err) {
      console.error("Challenge link failed:", err);
      return `${getShareBaseUrl()}/older?ref=whos_older_share`;
    }
  };

  const exit = () => navigate(SHELL_ROUTES.home);

  if (status !== "ready" || !view) {
    return (
      <PlayStage mode="whos-older" theme={THEME} title={t("whosOlder.title")} onExit={exit} exitLabel={t("whosOlder.quit")}>
        <div className="flex flex-col items-center justify-center py-12">
          {status === "failed" ? (
            <Card elevation="lifted" padding="lg" className="w-full text-center">
              <p className="font-heading font-bold text-title">{t("whosOlder.startFailedTitle")}</p>
              <p className="mt-3 text-body-sm text-muted-foreground">{t("whosOlder.startFailedMessage")}</p>
              <Button variant="primary" size="lg" block className="mt-6" onClick={loadDaily}>
                {t("whosOlder.tryAgain")}
              </Button>
            </Card>
          ) : (
            <p className="font-heading font-bold text-title-sm animate-pulse motion-reduce:animate-none">{t("whosOlder.loading")}</p>
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
  // A best of 0 is not worth a line; the streak only shows once it means something.
  const bestEndless = today?.bestEndless ? today.bestEndless : null;
  const subtitle = isChallengeRun
    ? t("whosOlder.challengeSubtitle", { n: view.edition })
    : isDaily
      ? t("whosOlder.dailySubtitle", { n: view.edition })
      : t("whosOlder.endlessSubtitle");
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
        "older",
        lettersToday === undefined ? undefined : lettersToday.daily?.status === "completed",
      );
      return (
        <PlayStage mode="whos-older" theme={THEME} title={t("whosOlder.title")} subtitle={subtitle} onExit={exit} exitLabel={t("whosOlder.home")}>
          <ResultScreen
            testId="whos-older-result"
            nameAsk
            top={
              challengeHere && challengeVerdict ? (
                <HeadToHead challenge={challengeHere} myScore={daily.score} verdict={challengeVerdict} />
              ) : undefined
            }
            hero={
              <ResultHero
                eyebrow={t("whosOlder.editionLabel", { n: daily.edition })}
                score={daily.score}
                total={total}
                squares={daily.history.map((r) => r.correct)}
                squaresLabel={t("result.squares", { score: daily.score, total })}
              >
                {standingPct != null && today?.standing && (
                  <HeroPill testId="whos-older-standing">
                    {t("whosOlder.standing", { pct: standingPct, count: today.standing.finishers })}
                  </HeroPill>
                )}
              </ResultHero>
            }
            status={
              streak ? (
                <StreakBlock current={streak.current} best={streak.best} />
              ) : !isChallengeRun ? (
                <p className="text-center text-body-sm text-muted-foreground">
                  {t("whosOlder.nextIn", { time: nextEditionCountdown() })}
                </p>
              ) : undefined
            }
            actions={
              <ResultActions
                primary={
                  isChallengeRun
                    ? {
                        label: t("whosOlder.playToday", { n: today?.edition ?? "" }),
                        icon: <CalendarDays size={18} aria-hidden="true" />,
                        onClick: loadDaily,
                        testId: "whos-older-play-today",
                      }
                    : {
                        label: t("dailyShare.cta"),
                        icon: <Share2 size={18} aria-hidden="true" />,
                        onClick: () => {
                          track("whos_older_share_pressed", { edition: daily.edition, score: daily.score });
                          setShareOpen(true);
                        },
                        testId: "whos-older-challenge-share",
                      }
                }
                next={
                  isChallengeRun ? undefined : (
                    <NextTodayCard
                      target={next}
                      testId="whos-older-next-today"
                      onFollow={() =>
                        track("daily_next_today_clicked", { from: "older", to: next.kind === "game" ? next.game : "home" })
                      }
                    />
                  )
                }
                secondary={
                  isChallengeRun
                    ? []
                    : [
                        {
                          label: t("whosOlder.playEndless"),
                          icon: <InfinityIcon size={18} aria-hidden="true" />,
                          onClick: startEndless,
                          disabled: busy,
                          testId: "whos-older-endless",
                        },
                      ]
                }
                note={
                  !isChallengeRun && bestEndless != null ? (
                    <p className="text-center font-mono text-eyebrow uppercase text-muted-foreground">
                      {t("whosOlder.bestStreak", { count: bestEndless })}
                    </p>
                  ) : undefined
                }
              />
            }
            details={
              <>
                {streak && isInstagramInAppBrowser() && <StreakHandoff game="older" streak={streak.current} />}
                {streak && !isInstagramInAppBrowser() && cameThroughHandoff() && <InstallPrompt placement="result" />}
                {!isChallengeRun && today?.challenges && <ChallengeResults challenges={today.challenges} />}
                <ResultDetails summary={t("result.answers")}>
                  {/* The ten answers — each row marked with its verdict. */}
                  <ol data-testid="whos-older-answers">
                    {daily.history.map((r, i) => {
                      const older = r[r.older];
                      const younger = r[r.older === "a" ? "b" : "a"];
                      return (
                        <li key={i} className="flex items-center gap-3 border-b border-border/15 py-2 text-body-sm last:border-b-0">
                          <span
                            className={cn(
                              "grid h-6 w-6 shrink-0 place-items-center rounded-full text-ink",
                              r.correct ? "bg-verdict-right" : "bg-verdict-wrong",
                            )}
                          >
                            {r.correct ? <Check size={14} strokeWidth={3.5} /> : <X size={14} strokeWidth={3.5} />}
                          </span>
                          <span className="min-w-0">
                            <span className="font-heading font-bold">{older.name}</span>{" "}
                            <span className="text-muted-foreground">
                              {t("whosOlder.olderThan", { name: younger.name, gap: formatGap(r.gapDays) })}
                            </span>
                          </span>
                        </li>
                      );
                    })}
                  </ol>
                  <p className="mt-2 text-meta text-muted-foreground">{t("whosOlder.sources")}</p>
                </ResultDetails>
              </>
            }
            footer={
              <>
                {today?.reminder && <ReminderCard reminder={today.reminder} collapsed />}
                {!isChallengeRun && isInstagramVisitor() && <FollowLink game="older" />}
              </>
            }
          />
          {!isChallengeRun && (
            <ShareSheet
              game="older"
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

    return (
      <PlayStage mode="whos-older" theme={THEME} title={t("whosOlder.title")} subtitle={subtitle} onExit={exit} exitLabel={t("whosOlder.home")}>
        <ResultScreen
          testId="whos-older-run-over"
          nameAsk
          hero={
            <ResultHero eyebrow={t("whosOlder.runOver")} score={view.score} caption={t("whosOlder.streakLabel")}>
              {bestEndless != null && <HeroPill>{t("whosOlder.bestStreak", { count: bestEndless })}</HeroPill>}
            </ResultHero>
          }
          actions={
            <ResultActions
              primary={{
                label: t("whosOlder.playAgain"),
                icon: <InfinityIcon size={18} aria-hidden="true" />,
                onClick: startEndless,
                disabled: busy,
              }}
              secondary={[
                {
                  label: t("whosOlder.backToDaily"),
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
    const pickedRight = reveal && reveal.correct && isOlder;
    return (
      <Card
        key={`${shownIndex}-${side}`}
        interactive
        elevation="flat"
        padding="none"
        disabled={busy}
        onClick={() => (reveal ? skipReveal() : answer(side))}
        data-testid={`whos-older-card-${side}`}
        className={cn(
          "relative flex-1 min-h-0 w-full px-4 py-3 text-cream",
          "flex flex-col items-center justify-center text-center overflow-visible",
          "transition-[transform,box-shadow,border-color] duration-ui motion-reduce:transition-none",
          side === "a" ? "bg-electric-blue animate-older-in-top" : "bg-hot-pink animate-older-in-bottom",
          isOlder ? "neo-shadow-lg -translate-y-1" : "neo-shadow",
          pickedRight && "!border-4 !border-verdict-right",
          pickedWrong && "!border-4 !border-verdict-wrong animate-shake-horizontal",
          !reveal && "enabled:active:translate-x-0.5 enabled:active:translate-y-0.5 enabled:active:neo-shadow-sm",
          pendingPick === side && "translate-x-0.5 translate-y-0.5 neo-shadow-sm",
        )}
      >
        {/* The younger card dims under a scrim — not via opacity, which the
            swing-in animation's fill would override. */}
        {reveal && !isOlder && (
          <span aria-hidden className="absolute inset-0 rounded-lg bg-ink/55 pointer-events-none" />
        )}
        {isOlder && (
          <Badge
            tone="neutral"
            shape="tag"
            size="md"
            stamp
            className="absolute -top-3 right-3 bg-paper text-paper-foreground text-body-sm animate-badge-land motion-reduce:animate-none"
          >
            {t("whosOlder.olderBadge")}
          </Badge>
        )}
        <span
          className="relative font-heading font-bold uppercase leading-none tracking-tight text-title-lg md:text-display break-words max-w-full"
          style={NAME_SHADOW}
        >
          {names[side]}
        </span>
        <span className="relative mt-2.5 min-h-[1.9rem] flex items-center">
          {reveal && (
            <span className="animate-badge-land motion-reduce:animate-none rounded-md bg-paper text-paper-foreground px-2.5 py-0.5 font-mono font-bold text-body-sm tabular-nums neo-border neo-shadow-sm">
              {formatDob(reveal[side].dob)}
            </span>
          )}
        </span>
      </Card>
    );
  };

  const verdict = reveal
    ? reveal.guess === "timeout"
      ? { label: t("whosOlder.forfeited"), right: false }
      : reveal.correct
        ? { label: t("whosOlder.correct"), right: true }
        : { label: t("whosOlder.wrong"), right: false }
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
      mode="whos-older"
      theme={THEME}
      title={t("whosOlder.title")}
      subtitle={subtitle}
      onExit={exit}
      exitLabel={t("whosOlder.quit")}
      exitConfirm={exitConfirm}
      flash={flash}
      score={
        <StageScore
          icon={isDaily ? <Star size={16} strokeWidth={3} /> : <Flame size={16} strokeWidth={3} />}
          value={view.score}
          label={isDaily ? t("stage.scoreLabel", { value: view.score }) : t("stage.streakLabel", { value: view.score })}
          detail={!isDaily && bestEndless != null ? t("whosOlder.bestShort", { count: bestEndless }) : undefined}
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
      <div className="flex flex-col h-full">
        {challengeHere && <ChallengeBanner challenge={challengeHere} />}
        {/* The tier tag + the ask: the reel's top line. */}
        <div className="shrink-0 flex items-center justify-between gap-2 mb-3">
          <TierBadge label={t(`whosOlder.tier.${tier}`)} level={TIER_LEVEL[tier]} />
          <p className="font-heading font-bold uppercase text-body tracking-tight text-right">{t("whosOlder.prompt")}</p>
        </div>

        <div className="relative flex-1 min-h-0 flex flex-col gap-4">
          {renderCard("a")}
          {renderCard("b")}
          {/* The VS hinge on the seam; it becomes the verdict on reveal. */}
          <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-raised">
            <div
              key={reveal ? `v${shownIndex}` : "vs"}
              className={cn(
                "grid place-items-center h-14 w-14 rounded-full neo-border neo-shadow font-heading font-bold text-title-sm",
                reveal && "animate-badge-land motion-reduce:animate-none",
                !reveal
                  ? "bg-paper text-paper-foreground"
                  : reveal.correct
                    ? "bg-verdict-right text-ink"
                    : "bg-verdict-wrong text-ink",
              )}
            >
              {!reveal ? "VS" : reveal.correct ? <Check size={28} strokeWidth={4} /> : <X size={28} strokeWidth={4} />}
            </div>
          </div>
        </div>

        {/* Verdict + gap, where a Next button used to be. */}
        <div className="shrink-0 mt-4 min-h-11 flex items-center justify-center gap-2" aria-live="polite">
          {verdict && reveal && (
            <>
              <Badge
                tone={verdict.right ? "right" : "wrong"}
                shape="tag"
                size="md"
                stamp
                className="text-body-sm animate-badge-land motion-reduce:animate-none"
              >
                {verdict.label}
              </Badge>
              <span className="animate-badge-land motion-reduce:animate-none inline-flex items-baseline gap-2 rounded-md bg-paper text-paper-foreground px-3 py-1 neo-border neo-shadow-sm">
                <span className="font-mono font-bold text-eyebrow text-ink/70">{t("whosOlder.gapLabel")}</span>
                <span className="font-heading font-bold uppercase text-body-sm">{formatGap(reveal.gapDays)}</span>
              </span>
            </>
          )}
        </div>
      </div>
    </PlayStage>
  );
}
