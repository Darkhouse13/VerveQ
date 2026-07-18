/**
 * THE DRAW × Home — Ticket H. Hero card at the TOP of the v2 Home, in the
 * house neo-brutalist idiom, with three states:
 *
 *   - UNPLAYED:    "TODAY'S BOARD #N" + the 5-fixture gauntlet strip (names +
 *                  thresholds — design-public from board start, drawEngine
 *                  locked decision 1) + PLAY CTA.
 *   - IN-PROGRESS: "RESUME RUN" + rounds progress.
 *   - PLAYED:      outcome + score + rank + streak chip + a live countdown to
 *                  the next board, read off the SERVER-served nextBoardAt —
 *                  the client never computes when the next board goes live.
 *
 * Gating is two-layered and both layers fail CLOSED and SILENT (no error
 * state on Home, ever):
 *
 *   1. The build flag (lib/flags DRAW_ENABLED). Off ⇒ the card does not
 *      exist: no auth read, no query, no layout slot — Home is byte-identical
 *      for non-draw users (snapshot-locked in homeDrawCardContract.test).
 *   2. The server gate (drawSettings.enabled / tester allowlist, enforced by
 *      requireDrawUser on every draw function). A gate throw rejects the
 *      getToday call, the catch swallows it, and the card simply never
 *      appears. Nothing is derived client-side: the raw getToday payload
 *      (playState, the run's outcome/finalScore, streak, nextBoardAt) and
 *      getLeaderboard's caller rank are all the backend serves today — this
 *      card is a pure renderer.
 *
 * Structure: a flag-gated outer shell, a data container, and a pure view
 * (exported for the contract tests). Copy is English-only like the rest of
 * the draw surface (DrawScreen, ResultStage).
 */

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useConvex } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { Crown, Flame } from "lucide-react";
import { DRAW_ENABLED } from "@/lib/flags";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "../../../convex/_generated/api";
import { cn } from "@/lib/utils";
import { NeoBadge } from "@/components/neo/NeoBadge";
import { NeoButton } from "@/components/neo/NeoButton";
import { NeoCard } from "@/components/neo/NeoCard";
import { archetypeMeta } from "./meta";
import { OUTCOME_LABEL } from "./share";

/** The raw convex/draw.ts getToday payload (union incl. the not-ready shape). */
type ServerToday = FunctionReturnType<typeof api.draw.getToday>;
/** The variant this card renders: board generated, fixtures + rules present. */
type ReadyToday = Extract<ServerToday, { boardReady: true }>;
type ServerRun = NonNullable<ReadyToday["run"]>;

/** h:mm:ss toward the server-served nextBoardAt (same format as ResultStage). */
function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
}

/** Server-passthrough progress: draft row mid-draft, else round + banked pts. */
function progressLine(run: ServerRun, today: ReadyToday): string {
  if (run.phase === "draft") {
    return `Draft row ${run.rowIndex + 1} of ${today.rules.rows}`;
  }
  const round = Math.min(run.fixtureIndex + 1, today.fixtures.length);
  return `Round ${round} of ${today.fixtures.length} · ${Math.round(run.cumulative).toLocaleString("en-US")} pts`;
}

export interface HomeDrawCardViewProps {
  today: ReadyToday;
  /** Caller's rank on today's board (getLeaderboard.me); chip hidden when null. */
  rank: number | null;
  /** Clock reading the countdown renders against (state so it ticks live). */
  now: number;
  onOpen: () => void;
}

/** Pure renderer — no hooks, no data access; the contract tests drive this. */
export function HomeDrawCardView({ today, rank, now, onOpen }: HomeDrawCardViewProps) {
  const run = today.run;
  const cta =
    today.playState === "unplayed"
      ? "Play today's board"
      : today.playState === "in_progress"
        ? "Resume run"
        : "See result";
  return (
    // The bottom spacing lives on the card's own root so its absence leaves
    // no trace in the Home column.
    <div className="shrink-0 pb-3 md:pb-4" data-testid="home-draw-card">
      <NeoCard color="primary" shadow="lg" className="flex flex-col gap-3 p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] opacity-80">
            The Draw · Board #{today.boardNumber}
          </p>
          {today.playState === "done" && (
            <NeoBadge color="yellow" data-testid="home-draw-streak">
              <Flame size={10} strokeWidth={3} className="mr-1" />
              Streak {today.streak}
            </NeoBadge>
          )}
        </div>

        {today.playState === "unplayed" && (
          <>
            <p className="font-heading font-black uppercase text-2xl md:text-3xl leading-none">
              Today's board #{today.boardNumber}
            </p>
            {/* Design contract: the whole gauntlet (names + thresholds) is
                visible before the first pick. */}
            <div className="flex gap-1.5" data-testid="home-draw-strip">
              {today.fixtures.map((fixture) => {
                const { label, Icon } = archetypeMeta(fixture.archetypeId);
                return (
                  <div
                    key={fixture.index}
                    className="neo-border rounded-md bg-card text-card-foreground flex-1 min-w-0 flex flex-col items-center gap-0.5 px-1 py-1.5"
                    data-testid={`home-draw-fixture-${fixture.index}`}
                  >
                    <span className="flex items-center gap-0.5">
                      <Icon size={11} strokeWidth={2.5} />
                      {fixture.isBoss && <Crown size={10} strokeWidth={2.5} />}
                    </span>
                    <span className="font-heading font-bold text-[8px] leading-none tracking-wide truncate max-w-full">
                      {label}
                    </span>
                    <span className="font-mono font-bold text-xs leading-none">
                      {fixture.threshold}
                    </span>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {today.playState === "in_progress" && run && (
          <>
            <p className="font-heading font-black uppercase text-2xl md:text-3xl leading-none">
              Run in progress
            </p>
            <div data-testid="home-draw-progress">
              <p className="font-mono text-[11px] font-bold uppercase opacity-80">
                {progressLine(run, today)}
              </p>
              <div className="flex gap-1 mt-1.5" aria-hidden>
                {today.fixtures.map((fixture) => (
                  <span
                    key={fixture.index}
                    className={cn(
                      "neo-border h-1.5 flex-1 rounded-full",
                      fixture.index < run.rounds.length ? "bg-yellow" : "bg-card/60",
                    )}
                  />
                ))}
              </div>
            </div>
          </>
        )}

        {today.playState === "done" && run && (
          <>
            <div>
              <p
                className="font-heading font-black uppercase text-2xl md:text-3xl leading-none"
                data-testid="home-draw-outcome"
              >
                {OUTCOME_LABEL[run.outcome ?? "banked"]}
              </p>
              <p
                className="font-mono font-black text-3xl md:text-4xl leading-none mt-1"
                data-testid="home-draw-score"
              >
                {Math.round(run.finalScore ?? 0).toLocaleString("en-US")}
                <span className="ml-1 text-sm font-bold">PTS</span>
              </p>
            </div>
            <div className="flex items-center justify-between gap-2">
              {rank !== null ? (
                <NeoBadge
                  color="muted"
                  className="bg-card text-foreground"
                  data-testid="home-draw-rank"
                >
                  Rank #{rank.toLocaleString("en-US")}
                </NeoBadge>
              ) : (
                <span />
              )}
              <span
                className="font-mono font-bold text-xs opacity-80"
                data-testid="home-draw-countdown"
              >
                Next board {formatCountdown(today.nextBoardAt - now)}
              </span>
            </div>
          </>
        )}

        <NeoButton
          variant="secondary"
          size="lg"
          className="w-full"
          onClick={onOpen}
          data-testid="home-draw-cta"
        >
          {cta}
        </NeoButton>
      </NeoCard>
    </div>
  );
}

/**
 * Data container. Reads the raw getToday payload (the DrawApi adapter seam
 * drops the run fields this card needs, and the serving layer already
 * publishes everything here — Ticket H freezes it), then the caller's rank
 * once the board is played. Every failure path ends with the card hidden.
 */
function HomeDrawCardInner() {
  const navigate = useNavigate();
  const convex = useConvex();
  const { accountState } = useAuth();
  // Any server identity passes requireDrawUser's sign-in check (guests play
  // like anyone else — Ticket A B6); logged-out visitors and a still-loading
  // session never reach the backend from Home.
  const canQuery = accountState !== "loggedOut" && accountState !== "loading";
  const [today, setToday] = useState<ReadyToday | null>(null);
  const [rank, setRank] = useState<number | null>(null);
  const played = today?.playState === "done";
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!canQuery) return;
    let cancelled = false;
    (async () => {
      try {
        let result = await convex.query(api.draw.getToday, {});
        if (!result.boardReady) {
          // Same lazy-generation path as ConvexDrawApi.getToday: queries
          // can't write, so the day's board is ensured, then re-read once.
          await convex.mutation(api.draw.ensureToday, {});
          result = await convex.query(api.draw.getToday, {});
        }
        if (cancelled || !result.boardReady) return;
        setToday(result);
        if (result.playState === "done") {
          const board = await convex
            .query(api.draw.getLeaderboard, {})
            .catch(() => null);
          if (!cancelled) setRank(board?.me?.rank ?? null);
        }
      } catch {
        // The gate throw (flag off / not a tester), a lost session or the
        // network all land here: the card simply never appears on Home.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [convex, canQuery]);

  // Live countdown: ticks against the SERVER-served nextBoardAt — the client
  // never computes when the next board goes live (no client clock math).
  useEffect(() => {
    if (!played) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [played]);

  if (!today) return null;
  return (
    <HomeDrawCardView
      today={today}
      rank={rank}
      now={now}
      onOpen={() => navigate("/draw")}
    />
  );
}

/**
 * The build-time half of the gate. With the flag off the card does not exist
 * — no hooks, no auth read, no query — so Home renders exactly as before for
 * non-draw users.
 */
export function HomeDrawCard() {
  if (!DRAW_ENABLED) return null;
  return <HomeDrawCardInner />;
}
