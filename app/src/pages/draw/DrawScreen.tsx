/**
 * THE DRAW — /draw. Every screen runs against the DrawApi seam; the route
 * binds that seam to the Convex serving layer (Ticket C), while tests and dev
 * harnesses inject a LocalMockApi into DrawExperience directly. Flag-gated
 * and unlinked from any nav.
 *
 * Screen flow: S1 entry → S2 draft (DraftStage) → S3 rounds (RoundStage) →
 * S4 result + S5 share card (ResultStage). S2/S3 obey the LAYOUT_SPEC
 * 390×844 no-scroll budget; the stage components consume the same LAYOUT
 * constants the spec is checked against.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useConvex } from "convex/react";
import { ConvexError } from "convex/values";
import { Coins, Flame } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { DRAW_ENABLED } from "@/lib/flags";
import {
  DRAW_AUTH_REQUIRED_CODE,
  DRAW_DISABLED_CODE,
  DRAW_DISABLED_MESSAGE,
  DRAW_SIGN_IN_REQUIRED,
} from "../../../convex/lib/drawMessages";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StageFrame } from "@/components/shell/play/PlayStage";
import { StageScore } from "@/components/shell/play/StageParts";
import { NextTodayCard } from "@/components/shell/play/result/ResultActions";
import { useNextToday } from "@/components/shell/play/result/useNextToday";
import { track } from "@/lib/analytics";
import { createDrawApi } from "@/lib/drawApi";
import { buildRunShareUrl, drawModeUrl } from "@/lib/drawShareLinks";
import type {
  DrawApi,
  DrawLeaderboardEntry,
  DrawRarity,
  DrawRunView,
  DrawStreak,
  DrawToday,
} from "@/lib/drawApi/types";
import type { Choice } from "@/lib/drawEngine";
import { FixtureStrip } from "@/components/draw/FixtureStrip";
import { DraftStage } from "@/components/draw/DraftStage";
import { RoundStage } from "@/components/draw/RoundStage";
import { ResultStage } from "@/components/draw/ResultStage";
import { useDrawT, type DrawT } from "@/components/draw/drawI18n";
import "@/components/draw/draw.css";
import { abandonRun, completeRun, noteQuestionAnswered, startRun } from "@/lib/gameAnalytics";
import type { AccountState } from "@/contexts/AuthContext";

type Stage = "loading" | "entry" | "play" | "result" | "error";

interface DrawExperienceProps {
  api: DrawApi;
  /** Per-beat duration of the staged reveal (Ticket G3); tests pass 0. */
  revealMs?: number;
  /** Analytics identity state; omitted by tests and harnesses. */
  accountState?: AccountState;
  /**
   * The result's "Next today" card. The route passes the live one (it reads
   * today's dailies from Convex); tests and harnesses render without it.
   */
  nextToday?: React.ReactNode;
}

/** "Next today" after THE DRAW: the first of today's dailies not yet done. */
function DrawNextToday() {
  const target = useNextToday(null);
  return (
    <NextTodayCard
      target={target}
      testId="draw-next-today"
      onFollow={() =>
        track("daily_next_today_clicked", { from: "draw", to: target.kind === "game" ? target.game : "home" })
      }
    />
  );
}

/**
 * The mock could never reject, so the screen originally had no failure path
 * and any rejection left it spinning on "Loading…" forever. Against a real
 * backend every call can fail — the flag gate ("not open yet"), a lost
 * session ("Sign in required"), the replay gate, or the network — so failures
 * are surfaced rather than swallowed.
 */
/**
 * Machine code off a server throw (Ticket K1). requireDrawUser throws
 * ConvexError({ code, message }); data survives prod redaction, the message
 * does not — so the code is the ONLY signal a prod client can rely on.
 */
function codeOf(error: unknown): string | null {
  if (error instanceof ConvexError) {
    const data: unknown = error.data;
    if (typeof data === "object" && data !== null && "code" in data) {
      const code = (data as { code: unknown }).code;
      if (typeof code === "string") return code;
    }
  }
  return null;
}

function messageOf(error: unknown, t: DrawT): string {
  const code = codeOf(error);
  const raw = error instanceof Error ? error.message : String(error);
  // Code first (prod redacts sentences); the sentence match stays as the
  // dev/legacy fallback only — dev deployments pass messages through.
  if (code === DRAW_AUTH_REQUIRED_CODE || raw.includes(DRAW_SIGN_IN_REQUIRED)) {
    return t("error.guest");
  }
  if (code === DRAW_DISABLED_CODE || raw.includes(DRAW_DISABLED_MESSAGE)) {
    return t("error.disabled");
  }
  return raw;
}

/** The full mock-driven experience. Exported ungated for component tests. */
export function DrawExperience({ api, revealMs = 380, accountState, nextToday }: DrawExperienceProps) {
  const navigate = useNavigate();
  const t = useDrawT();
  const [stage, setStage] = useState<Stage>("loading");
  const [today, setToday] = useState<DrawToday | null>(null);
  const [view, setView] = useState<DrawRunView | null>(null);
  const [rarity, setRarity] = useState<DrawRarity | null>(null);
  const [streak, setStreak] = useState<DrawStreak | null>(null);
  const [leaderboard, setLeaderboard] = useState<DrawLeaderboardEntry[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  // Synchronous double-tap guard: React state alone flips too late for two
  // taps landing in the same frame (choice submission ordering contract).
  const busyRef = useRef(false);
  const [reloadKey, setReloadKey] = useState(0);
  const runKeyRef = useRef<string | null>(null);

  // Leaving mid-run reports an abandon; a finished run is ignored.
  useEffect(() => () => abandonRun(runKeyRef.current), []);

  useEffect(() => {
    let cancelled = false;
    api
      .getToday()
      .then((t) => {
        if (cancelled) return;
        setToday(t);
        setStage("entry");
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e);
        setStage("error");
      });
    return () => {
      cancelled = true;
    };
  }, [api, reloadKey]);

  const retry = useCallback(() => {
    setError(null);
    setStage("loading");
    setReloadKey((k) => k + 1);
  }, []);

  const loadResult = useCallback(async () => {
    const [r, s, lb, t] = await Promise.all([
      api.getRarity().catch(() => null),
      api.getStreak().catch(() => null),
      api.getLeaderboard().catch(() => [] as DrawLeaderboardEntry[]),
      api.getToday().catch(() => null),
    ]);
    setRarity(r);
    setStreak(s);
    setLeaderboard(lb);
    if (t) setToday(t);
    setStage("result");
  }, [api]);

  const begin = useCallback(async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      const v = await api.startRun();
      setView(v);
      // One board per day, so the board number keys the run.
      if (v.phase !== "done" && accountState) {
        runKeyRef.current = `draw-${v.boardNumber}`;
        startRun(runKeyRef.current, "draw", { accountState, startTrigger: "user_action" });
      }
      if (v.phase === "done") {
        await loadResult();
      } else {
        setStage("play");
      }
    } catch (e: unknown) {
      // Without this the rejection escapes as an unhandled promise and the
      // CTA just silently un-sticks.
      setError(e);
      setStage("error");
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, [api, loadResult, accountState]);

  const submit = useCallback(
    async (choice: Choice) => {
      if (busyRef.current) return;
      busyRef.current = true;
      setBusy(true);
      try {
        const next = await api.submitChoice(choice);
        setView(next);
        noteQuestionAnswered(runKeyRef.current);
        if (next.phase === "done") {
          completeRun(runKeyRef.current, {
            score: next.finalScore ?? Math.round(next.cumulative),
            result: next.outcome === "busted" ? "loss" : "win",
          });
        }
      } catch (e: unknown) {
        // Includes the B2 replay-gate reject, where the server deliberately
        // wrote no result: retry re-reads the authoritative run state rather
        // than leaving a dead button behind.
        setError(e);
        setStage("error");
      } finally {
        busyRef.current = false;
        setBusy(false);
      }
    },
    [api],
  );

  const exit = useCallback(() => navigate("/"), [navigate]);
  // Ticket I — canonical origin, never window.location.origin (a localhost /
  // preview origin would be baked into every shared result). A finished run
  // shares its own /s/r/ landing link; pre-slug views (mock) fall back to the
  // mode URL.
  const shareUrl = view?.shareSlug
    ? buildRunShareUrl(view.shareSlug)
    : drawModeUrl();


  // The frame's score slot: the banked total in a run, the streak elsewhere.
  const scoreSlot =
    stage === "play" && view ? (
      <StageScore
        icon={<Coins size={16} strokeWidth={3} aria-hidden="true" />}
        value={Math.round(view.cumulative)}
        label={t("bankedLabel", { value: Math.round(view.cumulative) })}
      />
    ) : today ? (
      <StageScore
        icon={<Flame size={16} strokeWidth={3} aria-hidden="true" />}
        value={today.streak ?? 0}
        label={t("streakLabel", { count: today.streak ?? 0 })}
      />
    ) : undefined;

  // Google Translate rewrites React-managed text nodes with <font> elements.
  // Protect the mode so a translation pass cannot leave React reconciling a
  // DOM tree it no longer owns (NotFoundError: removeChild). The copy itself
  // is translated through the `draw` locale namespace instead.
  //
  // VerveQ ONE P4.2: the chrome is the shared StageFrame (44px Quit, VERVEQ
  // eyebrow, score slot) in its wide layout, so a desktop gets a centred
  // two-column board instead of a 390px phone island on an empty canvas.
  return (
    <div className="theme-draw notranslate" translate="no">
      <StageFrame
        mode="draw"
        title={t("title")}
        subtitle={today ? t("board", { n: today.boardNumber }) : undefined}
        onExit={exit}
        exitLabel={stage === "result" ? t("home") : t("quit")}
        score={scoreSlot}
        wide
      >
        {stage === "loading" && (
          <div className="h-full flex items-center justify-center">
            <p className="font-heading font-bold animate-pulse">{t("loading")}</p>
          </div>
        )}

        {stage === "error" && (
          <div
            className="h-full max-w-md mx-auto flex flex-col items-center justify-center text-center gap-3"
            data-testid="draw-error"
          >
            <Card className="w-full">
              <p className="font-heading font-bold text-title-sm">{t("error.title")}</p>
              <p className="text-body-sm text-muted-foreground mt-2 break-words">{messageOf(error, t)}</p>
            </Card>
            <div className="w-full flex flex-col gap-3">
              <Button variant="primary" size="lg" block onClick={retry}>
                {t("error.retry")}
              </Button>
              <Button variant="secondary" size="lg" block onClick={exit}>
                {t("error.leave")}
              </Button>
            </div>
          </div>
        )}

        {stage === "entry" && today && (
          <div className="h-full overflow-y-auto overflow-x-hidden" data-testid="draw-entry">
            <div className="min-h-full flex flex-col gap-4">
              <div className="flex flex-col gap-4 md:grid md:grid-cols-2 md:gap-6 md:items-start">
                <div className="flex flex-col gap-4">
                  <Card className="draw-outline-lime text-center" padding="lg">
                    <p className="font-mono text-eyebrow uppercase text-muted-foreground">{t("entry.eyebrow")}</p>
                    <p className="font-mono font-bold text-display mt-2">#{today.boardNumber}</p>
                    <p className="font-mono text-eyebrow text-muted-foreground mt-1">{today.dateKey}</p>
                  </Card>

                  {/* The rules in plain words, on a paper reading card: the
                      first place a cold visitor meets BANK / PUSH / bench. */}
                  <Card tone="paper" elevation="flat" className="theme-paper">
                    <h2 className="font-heading font-bold text-title-sm">{t("entry.howTitle")}</h2>
                    <ol className="mt-2 flex flex-col gap-1.5 text-body-sm list-decimal pl-5">
                      <li>{t("entry.howDraft")}</li>
                      <li>{t("entry.howBench")}</li>
                      <li>{t("entry.howClear")}</li>
                      <li>{t("entry.howBust", { pct: Math.round(today.rules.bustKeep * 100) })}</li>
                    </ol>
                  </Card>
                </div>

                {/* Design contract: the whole gauntlet + thresholds is visible
                    before the first pick. */}
                <section className="flex flex-col gap-2">
                  <h2 className="font-heading font-bold text-title-sm">{t("entry.gauntletTitle")}</h2>
                  <p className="text-meta text-muted-foreground">{t("entry.gauntletBody")}</p>
                  <FixtureStrip fixtures={today.fixtures} activeIndex={null} clearedCount={0} variant="entry" />
                </section>
              </div>

              <div className="sticky bottom-0 mt-auto bg-background pt-2 md:mt-0 md:max-w-sm md:w-full md:mx-auto">
                <Button
                  variant={today.playState === "done" ? "secondary" : "primary"}
                  size="lg"
                  block
                  disabled={busy}
                  onClick={begin}
                  data-testid="draw-entry-cta"
                >
                  {today.playState === "unplayed"
                    ? t("entry.play")
                    : today.playState === "in_progress"
                      ? t("entry.resume")
                      : t("entry.seeResult")}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* H1 — the play stages scroll when the stack exceeds the (dynamic)
            viewport: on small phones the resolved-round stack overran a fixed
            overlay and BANK/PUSH fell below an unscrollable fold. The stage
            root is min-h-full so it still FILLS the scroller when short, and
            only grows — and scrolls — when it doesn't fit; the round's
            decision panel is sticky inside it. */}
        {stage === "play" && view && today && view.phase === "draft" && (
          <div
            className="h-full overflow-y-auto overflow-x-hidden"
            data-testid="draw-play-scroll"
          >
            <DraftStage view={view} rules={today.rules} locked={busy} onPick={(i) => submit({ type: "pick", offerIndex: i })} />
          </div>
        )}

        {stage === "play" && view && today && view.phase !== "draft" && (
          <div
            className="h-full overflow-y-auto overflow-x-hidden"
            data-testid="draw-play-scroll"
          >
            <RoundStage
              view={view}
              rules={today.rules}
              locked={busy}
              revealMs={revealMs}
              onBench={(i) => submit({ type: "bench", squadIndex: i })}
              onBank={() => submit({ type: "bank" })}
              onPush={() => submit({ type: "push" })}
              onContinue={loadResult}
            />
          </div>
        )}

        {stage === "result" && view && (
          <div className="max-w-xl mx-auto">
            <ResultStage
              view={view}
              rarity={rarity}
              streak={streak}
              leaderboard={leaderboard}
              nextBoardAt={today?.nextBoardAt ?? null}
              shareUrl={shareUrl}
              next={nextToday}
            />
          </div>
        )}
      </StageFrame>
    </div>
  );
}

/**
 * Route component. Gated on DRAW_ENABLED (lib/flags.ts — Ticket B kept the
 * flag inline because its scope owned only draw files; Ticket D moved it to
 * the registry with the rest). Anything but "true" bounces to "/".
 *
 * The build-time flag only decides whether the ROUTE renders. The mode's real
 * gate is server-side (drawSettings.enabled + the tester allowlist, checked on
 * every draw function), so a flipped VITE flag alone opens nothing.
 *
 * THE GATE IS AN OUTER SHELL, and it has to be. It used to live as an early
 * `return <Navigate/>` INSIDE the component that owns the play-first effect —
 * but hooks cannot be conditional, so that effect was registered above the
 * early return and still ran on the flag-off render, firing
 * `startAnonymousSession()` and minting a guest identity server-side for a
 * visitor who was about to be redirected away.
 *
 * PROD IS NOT AFFECTED: VITE_DRAW_ENABLED is set there (host CI wrapper, not
 * the procedure in DEPLOYMENT.md), so the mode is live and this branch never
 * runs. Every flag-off build is affected — `npm run dev`, `vite preview`, and
 * any rollback of the flag — and /draw is reachable in all of them because the
 * route is registered unconditionally in App.tsx. Splitting the gate out — the
 * same outer/inner shape HomeDrawCard and DrawHeroCard already use — means the
 * flag-off path mounts no hooks at all, so nothing is created for a visitor
 * who is about to be bounced.
 */
export default function DrawScreen() {
  if (!DRAW_ENABLED) return <Navigate to="/" replace />;
  return <DrawScreenInner />;
}

function DrawScreenInner() {
  const convex = useConvex();
  const api = useMemo(() => createDrawApi(convex), [convex]);
  const { accountState, startAnonymousSession } = useAuth();
  const t = useDrawT();
  const [authFailed, setAuthFailed] = useState(false);
  const bootstrapped = useRef(false);

  // D1 — play-first: THE DRAW is server-authoritative and every function needs
  // an identity, so a visitor with no session gets a guest one made for them
  // rather than a dead end. Guests play like anyone else (Ticket A B6).
  //
  // `accountState` is the server-authoritative signal, read off the reactive
  // users.me doc: it reports "loggedOut" for a tab-local v1 guest too, which
  // has NO server identity and would otherwise fail every call. Gating on it —
  // rather than retrying on a timer straight after signIn — is the house
  // pattern (see AuthContext#claimUsername): the retry is driven by real
  // propagation, so it can't race the session into existence. Once the doc
  // lands, accountState flips, this component re-renders, and DrawExperience
  // mounts and calls getToday exactly once, already authenticated.
  useEffect(() => {
    if (accountState !== "loggedOut" || bootstrapped.current) return;
    bootstrapped.current = true;
    startAnonymousSession().catch(() => setAuthFailed(true));
  }, [accountState, startAnonymousSession]);

  // Session settling or being created. `authFailed` is what stops this from
  // becoming the very "Loading…" hang this ticket exists to kill: on failure
  // we fall through and let DrawExperience surface the error stage.
  if (!authFailed && (accountState === "loading" || accountState === "loggedOut")) {
    return (
      <div
        className="notranslate fixed inset-0 z-40 bg-background text-foreground flex items-center justify-center"
        translate="no"
      >
        <p className="font-heading font-bold animate-pulse">{t("loading")}</p>
      </div>
    );
  }

  return <DrawExperience api={api} accountState={accountState} nextToday={<DrawNextToday />} />;
}
