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
import { Flame } from "lucide-react";
import { NeoButton } from "@/components/neo/NeoButton";
import { NeoCard } from "@/components/neo/NeoCard";
import { createDrawApi } from "@/lib/drawApi";
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

type Stage = "loading" | "entry" | "play" | "result";

interface DrawExperienceProps {
  api: DrawApi;
  /** Round-reveal beat; tests pass 0. */
  revealMs?: number;
}

/** The full mock-driven experience. Exported ungated for component tests. */
export function DrawExperience({ api, revealMs = 900 }: DrawExperienceProps) {
  const navigate = useNavigate();
  const [stage, setStage] = useState<Stage>("loading");
  const [today, setToday] = useState<DrawToday | null>(null);
  const [view, setView] = useState<DrawRunView | null>(null);
  const [rarity, setRarity] = useState<DrawRarity | null>(null);
  const [streak, setStreak] = useState<DrawStreak | null>(null);
  const [leaderboard, setLeaderboard] = useState<DrawLeaderboardEntry[]>([]);
  const [busy, setBusy] = useState(false);
  // Synchronous double-tap guard: React state alone flips too late for two
  // taps landing in the same frame (choice submission ordering contract).
  const busyRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    api.getToday().then((t) => {
      if (cancelled) return;
      setToday(t);
      setStage("entry");
    });
    return () => {
      cancelled = true;
    };
  }, [api]);

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
      } finally {
        busyRef.current = false;
        setBusy(false);
      }
    },
    [api],
  );

  const exit = useCallback(() => navigate("/"), [navigate]);
  const shareUrl = `${window.location.origin}/draw`;

  return (
    <div className="fixed inset-0 z-40 bg-background text-foreground overflow-hidden">
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
              <FixtureStrip fixtures={today.fixtures} activeIndex={null} clearedCount={0} />
            </div>

            <p className="text-xs text-muted-foreground leading-snug">
              Draft 6 from 18 — one row at a time. Each round, bench one; five play.
              Clear the fixture, then BANK your points or PUSH deeper. Bust and you
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

        {stage === "play" && view && today && view.phase === "draft" && (
          <DraftStage view={view} rules={today.rules} locked={busy} onPick={(i) => submit({ type: "pick", offerIndex: i })} />
        )}

        {stage === "play" && view && today && view.phase !== "draft" && (
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
 * Route component. Gated on VITE_DRAW_ENABLED (same build-time flag pattern
 * as lib/flags.ts — defined here because Ticket B's scope owns only draw
 * files): anything but the exact string "true" bounces to "/".
 *
 * The build-time flag only decides whether the ROUTE renders. The mode's real
 * gate is server-side (drawSettings.enabled + the tester allowlist, checked on
 * every draw function), so a flipped VITE flag alone opens nothing.
 */
export default function DrawScreen() {
  const enabled = import.meta.env.VITE_DRAW_ENABLED === "true";
  const convex = useConvex();
  const api = useMemo(() => createDrawApi(convex), [convex]);
  if (!enabled) return <Navigate to="/" replace />;
  return <DrawExperience api={api} />;
}
