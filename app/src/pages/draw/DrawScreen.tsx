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
import { Flame } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { DRAW_ENABLED } from "@/lib/flags";
import {
  DRAW_AUTH_REQUIRED_CODE,
  DRAW_DISABLED_CODE,
  DRAW_DISABLED_MESSAGE,
  DRAW_SIGN_IN_REQUIRED,
} from "../../../convex/lib/drawMessages";
import { NeoButton } from "@/components/neo/NeoButton";
import { NeoCard } from "@/components/neo/NeoCard";
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
import { DrawTopBar } from "@/components/draw/DrawTopBar";
import { FixtureStrip } from "@/components/draw/FixtureStrip";
import { DraftStage } from "@/components/draw/DraftStage";
import { RoundStage } from "@/components/draw/RoundStage";
import { ResultStage } from "@/components/draw/ResultStage";
import { LAYOUT } from "@/components/draw/layout";
import "@/components/draw/draw.css";

type Stage = "loading" | "entry" | "play" | "result" | "error";

interface DrawExperienceProps {
  api: DrawApi;
  /** Per-beat duration of the staged reveal (Ticket G3); tests pass 0. */
  revealMs?: number;
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

function messageOf(error: unknown): string {
  const code = codeOf(error);
  const raw = error instanceof Error ? error.message : String(error);
  // Code first (prod redacts sentences); the sentence match stays as the
  // dev/legacy fallback only — dev deployments pass messages through.
  if (code === DRAW_AUTH_REQUIRED_CODE || raw.includes(DRAW_SIGN_IN_REQUIRED)) {
    return "Couldn't start a guest session. Check your connection and retry.";
  }
  if (code === DRAW_DISABLED_CODE || raw.includes(DRAW_DISABLED_MESSAGE)) {
    return `${DRAW_DISABLED_MESSAGE}.`;
  }
  return raw;
}

/** The full mock-driven experience. Exported ungated for component tests. */
export function DrawExperience({ api, revealMs = 380 }: DrawExperienceProps) {
  const navigate = useNavigate();
  const [stage, setStage] = useState<Stage>("loading");
  const [today, setToday] = useState<DrawToday | null>(null);
  const [view, setView] = useState<DrawRunView | null>(null);
  const [rarity, setRarity] = useState<DrawRarity | null>(null);
  const [streak, setStreak] = useState<DrawStreak | null>(null);
  const [leaderboard, setLeaderboard] = useState<DrawLeaderboardEntry[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Synchronous double-tap guard: React state alone flips too late for two
  // taps landing in the same frame (choice submission ordering contract).
  const busyRef = useRef(false);
  const [reloadKey, setReloadKey] = useState(0);

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
        setError(messageOf(e));
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
      if (v.phase === "done") {
        await loadResult();
      } else {
        setStage("play");
      }
    } catch (e: unknown) {
      // Without this the rejection escapes as an unhandled promise and the
      // CTA just silently un-sticks.
      setError(messageOf(e));
      setStage("error");
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, [api, loadResult]);

  const submit = useCallback(
    async (choice: Choice) => {
      if (busyRef.current) return;
      busyRef.current = true;
      setBusy(true);
      try {
        setView(await api.submitChoice(choice));
      } catch (e: unknown) {
        // Includes the B2 replay-gate reject, where the server deliberately
        // wrote no result: retry re-reads the authoritative run state rather
        // than leaving a dead button behind.
        setError(messageOf(e));
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

  return (
    <div className="theme-draw fixed inset-0 z-40 h-[100dvh] bg-background text-foreground overflow-hidden">
      <div
        className="mx-auto h-full w-full flex flex-col"
        style={{
          maxWidth: LAYOUT.viewportW,
          padding: LAYOUT.pagePaddingY,
          gap: LAYOUT.sectionGap,
        }}
      >
        <DrawTopBar
          boardNumber={today?.boardNumber ?? null}
          onExit={exit}
          right={
            stage === "play" && view ? (
              <span className="font-mono font-bold text-sm" data-testid="draw-cumulative">
                {Math.round(view.cumulative)}
              </span>
            ) : (
              <span className="neo-border rounded-full bg-card px-2 py-0.5 font-heading font-bold text-[10px] inline-flex items-center gap-1">
                <Flame size={10} strokeWidth={3} />
                {today?.streak ?? 0}
              </span>
            )
          }
        />

        {stage === "loading" && (
          <div className="flex-1 flex items-center justify-center">
            <p className="font-heading font-bold animate-pulse">Loading…</p>
          </div>
        )}

        {stage === "error" && (
          <div
            className="flex-1 flex flex-col items-center justify-center text-center"
            style={{ gap: LAYOUT.sectionGap }}
            data-testid="draw-error"
          >
            <NeoCard color="destructive" shadow="lg" className="w-full py-6 px-4">
              <p className="font-heading font-bold text-sm">CAN'T LOAD THE BOARD</p>
              <p className="text-xs text-muted-foreground mt-2 leading-snug break-words">
                {error}
              </p>
            </NeoCard>
            <div className="w-full flex flex-col gap-2">
              <NeoButton variant="primary" size="lg" className="w-full" onClick={retry}>
                RETRY
              </NeoButton>
              <NeoButton variant="secondary" size="lg" className="w-full" onClick={exit}>
                LEAVE
              </NeoButton>
            </div>
          </div>
        )}

        {stage === "entry" && today && (
          <div className="flex flex-col flex-1 min-h-0" style={{ gap: LAYOUT.sectionGap }} data-testid="draw-entry">
            <NeoCard color="primary" shadow="lg" className="text-center py-6">
              <p className="font-heading font-bold text-[11px] tracking-widest opacity-80">
                ONE BOARD. EVERYONE. DAILY.
              </p>
              <p className="font-mono font-black text-5xl leading-none mt-2">
                #{today.boardNumber}
              </p>
              <p className="font-heading font-bold text-[10px] mt-2 uppercase opacity-80">
                {today.dateKey}
              </p>
            </NeoCard>

            {/* Design contract: the whole gauntlet + thresholds is visible
                before the first pick. */}
            <div>
              <p className="font-heading font-bold text-xs tracking-wide mb-1.5">THE GAUNTLET</p>
              <FixtureStrip fixtures={today.fixtures} activeIndex={null} clearedCount={0} variant="entry" />
            </div>

            <p className="text-xs text-muted-foreground leading-snug">
              Tonight's gauntlet: five opponents, each favoring different
              players. Draft a squad of six, field five, and run the table.
              Clear one, then BANK your points or PUSH deeper — bust and you
              keep scraps.
            </p>

            <div className="mt-auto">
              <NeoButton
                variant={today.playState === "done" ? "secondary" : "primary"}
                size="xl"
                className="w-full"
                disabled={busy}
                onClick={begin}
                data-testid="draw-entry-cta"
              >
                {today.playState === "unplayed"
                  ? "PLAY TODAY'S BOARD"
                  : today.playState === "in_progress"
                    ? "RESUME RUN"
                    : "SEE RESULT"}
              </NeoButton>
            </div>
          </div>
        )}

        {/* H1 — the play stages must scroll when the stack exceeds the (dynamic)
            viewport: on small phones the resolved-round stack (~806px) overran
            the fixed, overflow-hidden overlay and BANK/PUSH fell below an
            unscrollable fold. Same single-container pattern the result stage
            already uses; the stage root is min-h-full so it still FILLS the
            wrapper when short (coach-mark bottom slack intact) and only grows —
            and scrolls — when it doesn't fit. Bottom padding clears the iOS
            home indicator. */}
        {stage === "play" && view && today && view.phase === "draft" && (
          <div
            className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden"
            data-testid="draw-play-scroll"
            style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 8px)" }}
          >
            <DraftStage view={view} rules={today.rules} locked={busy} onPick={(i) => submit({ type: "pick", offerIndex: i })} />
          </div>
        )}

        {stage === "play" && view && today && view.phase !== "draft" && (
          <div
            className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden"
            data-testid="draw-play-scroll"
            style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 8px)" }}
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
          <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-0.5 -mx-0.5">
            <ResultStage
              view={view}
              rarity={rarity}
              streak={streak}
              leaderboard={leaderboard}
              nextBoardAt={today?.nextBoardAt ?? null}
              shareUrl={shareUrl}
            />
          </div>
        )}
      </div>
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
 */
export default function DrawScreen() {
  const enabled = DRAW_ENABLED;
  const convex = useConvex();
  const api = useMemo(() => createDrawApi(convex), [convex]);
  const { accountState, startAnonymousSession } = useAuth();
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

  if (!enabled) return <Navigate to="/" replace />;

  // Session settling or being created. `authFailed` is what stops this from
  // becoming the very "Loading…" hang this ticket exists to kill: on failure
  // we fall through and let DrawExperience surface the error stage.
  if (!authFailed && (accountState === "loading" || accountState === "loggedOut")) {
    return (
      <div className="fixed inset-0 z-40 bg-background text-foreground flex items-center justify-center">
        <p className="font-heading font-bold animate-pulse">Loading…</p>
      </div>
    );
  }

  return <DrawExperience api={api} />;
}
