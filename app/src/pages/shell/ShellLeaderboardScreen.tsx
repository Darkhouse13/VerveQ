/**
 * Shell-native Leaderboard — replaces the embedded v1 screen at /v2/leaderboard.
 *
 * The one sanctioned scroll surface in the shell: the page chrome (filters +
 * podium) is fixed and THE CHASE list scrolls internally, so the app frame
 * never moves. Same server queries as v1 (ELO ladder, Blitz high scores,
 * archived seasons) — presentation only, nothing is ranked client-side.
 */
import { useState } from "react";
import { Crown } from "lucide-react";
import { useQuery } from "convex/react";
import { NeoCard } from "@/components/neo/NeoCard";
import { NeoAvatar } from "@/components/neo/NeoAvatar";
import { NeoBadge } from "@/components/neo/NeoBadge";
import { ShellLayout } from "@/components/shell/ShellLayout";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

const MODES = ["Quiz", "Survival", "Blitz"] as const;
type Mode = (typeof MODES)[number];

function formatValue(value: number | null | undefined): string {
  if (value === null || value === undefined) return "0";
  // Ratings carry fractional ELO math internally; players see whole numbers.
  return String(Math.round(value));
}

function tierOf(elo: number | null) {
  if (!elo) return { name: "Bronze", color: "muted" as const };
  if (elo >= 2000) return { name: "Platinum", color: "accent" as const };
  if (elo >= 1500) return { name: "Gold", color: "primary" as const };
  if (elo >= 1200) return { name: "Silver", color: "muted" as const };
  return { name: "Bronze", color: "muted" as const };
}

interface Row {
  rank: number;
  userId: Id<"users">;
  username: string;
  value: number | null;
  tier?: string;
  badge?: string;
}

export default function ShellLeaderboardScreen() {
  const { user } = useAuth();
  const myId = user?._id;
  const [mode, setMode] = useState<Mode>("Quiz");
  const [season, setSeason] = useState<"current" | number>("current");

  const currentSeason = useQuery(api.seasonManager.getCurrentSeason);
  const pastSeasons = useQuery(api.seasonManager.getPastSeasons);

  const isBlitz = mode === "Blitz";
  const isPast = season !== "current";
  // Football is the only live sport — the v1 sport filter is collapsed, like
  // the compete category/sport steps were.
  const sportParam = "football";

  const eloData = useQuery(
    api.leaderboards.getLeaderboard,
    !isBlitz && !isPast
      ? { sport: sportParam, mode: mode.toLowerCase(), limit: 50 }
      : "skip",
  );
  const blitzData = useQuery(
    api.blitz.getHighScores,
    isBlitz && !isPast ? { sport: sportParam, limit: 50 } : "skip",
  );
  const pastData = useQuery(
    api.seasonManager.getSeasonHistory,
    isPast
      ? { seasonNumber: season as number, sport: sportParam, mode: mode.toLowerCase(), limit: 50 }
      : "skip",
  );

  const loading = isPast ? pastData === undefined : isBlitz ? blitzData === undefined : eloData === undefined;

  let rows: Row[];
  if (isPast) {
    rows = (pastData ?? []).map((e, idx) => ({
      rank: e.rank ?? idx + 1,
      userId: e.userId as Id<"users">,
      username: e.username,
      value: e.finalElo,
      tier: e.tier,
      badge: e.badge ?? undefined,
    }));
  } else if (isBlitz) {
    rows = (blitzData?.entries ?? []).map((e) => ({
      rank: e.rank,
      userId: e.userId as Id<"users">,
      username: e.username,
      value: e.score,
    }));
  } else {
    rows = (eloData?.entries ?? []).map((e) => ({
      rank: e.rank,
      userId: e.userId,
      username: e.username,
      value: e.elo_rating,
    }));
  }

  const podium = rows.slice(0, 3);
  // Visual order 2-1-3, classic podium silhouette.
  const podiumOrder = podium.length >= 3 ? [podium[1], podium[0], podium[2]] : podium;
  const chase = rows.slice(3);
  const myRow = myId ? rows.find((r) => String(r.userId) === String(myId)) : undefined;

  return (
    <ShellLayout title="Leaderboard" subtitle="Who runs the ladder" back>
      <div className="h-full min-h-0 flex flex-col gap-3 md:max-w-2xl md:mx-auto md:w-full">
        {/* Filters — fixed chrome, never scrolls. */}
        <div className="shrink-0 flex items-center gap-2">
          <div className="flex gap-1.5 flex-1 min-w-0">
            {MODES.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`neo-border rounded-full px-3 py-1 text-[11px] font-heading font-bold uppercase cursor-pointer transition-all ${
                  mode === m
                    ? "bg-primary text-primary-foreground neo-shadow-sm"
                    : "bg-background text-foreground"
                }`}
              >
                {m}
              </button>
            ))}
          </div>
          <select
            value={season === "current" ? "current" : String(season)}
            onChange={(e) => setSeason(e.target.value === "current" ? "current" : Number(e.target.value))}
            aria-label="Season"
            className="neo-border rounded-lg px-2.5 py-1 bg-background text-foreground font-heading font-bold text-[11px] uppercase cursor-pointer shrink-0"
          >
            <option value="current">
              S{currentSeason ? currentSeason.seasonNumber : "—"} · Live
            </option>
            {(pastSeasons ?? []).map((s) => (
              <option key={s.seasonNumber} value={String(s.seasonNumber)}>
                Season {s.seasonNumber}
              </option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="font-heading font-bold animate-pulse">Loading ladder…</p>
          </div>
        ) : rows.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <NeoCard className="text-center py-10 px-8">
              <p className="font-heading font-bold text-lg">No entries yet</p>
              <p className="text-sm text-muted-foreground mt-1">Be the first to play!</p>
            </NeoCard>
          </div>
        ) : (
          <>
            {/* Podium — fixed chrome. */}
            <div className="shrink-0 flex items-end justify-center gap-2.5 pt-5">
              {podiumOrder.map((p) => {
                const first = p.rank === 1;
                const isMe = !!myId && String(p.userId) === String(myId);
                return (
                  <div key={p.rank} className="flex flex-col items-center w-[30%] max-w-[150px] min-w-0">
                    {first && <Crown size={20} strokeWidth={2.5} className="text-primary mb-1" />}
                    <NeoAvatar name={p.username} size={first ? "lg" : "md"} />
                    <p className={`font-heading font-bold text-xs mt-1.5 truncate max-w-full ${isMe ? "underline underline-offset-2" : ""}`}>
                      {p.username}
                    </p>
                    <p className="font-mono font-bold text-[11px]">{formatValue(p.value)}</p>
                    <div
                      className={`neo-border neo-shadow rounded-t-lg w-full mt-1.5 flex items-start justify-center ${
                        first ? "h-16 bg-yellow" : p.rank === 2 ? "h-11 bg-muted" : "h-8 bg-accent"
                      }`}
                    >
                      <span className="font-heading font-bold text-xl leading-none pt-1.5">{p.rank}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* The chase — THE one scroll surface in the shell. */}
            <NeoCard className="flex-1 min-h-0 flex flex-col p-0 overflow-hidden mb-1">
              <div className="shrink-0 flex items-center justify-between px-3.5 py-2 border-b-2 border-border bg-muted/40">
                <p className="text-[10px] font-heading font-bold uppercase tracking-wider">The chase</p>
                <p className="font-mono text-[10px] text-muted-foreground">{rows.length} ranked</p>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
                {chase.length === 0 ? (
                  <p className="text-center text-xs text-muted-foreground py-6 px-4">
                    The podium is the whole field — go climb it.
                  </p>
                ) : (
                  chase.map((r) => {
                    const isMe = !!myId && String(r.userId) === String(myId);
                    const tier = r.tier ? { name: r.tier, color: tierOf(r.value).color } : tierOf(r.value);
                    return (
                      <div
                        key={`${r.rank}-${String(r.userId)}`}
                        className={`flex items-center gap-2.5 px-3.5 py-2 border-b-2 border-border last:border-b-0 ${
                          isMe ? "bg-primary text-primary-foreground" : ""
                        }`}
                      >
                        <span className="font-mono font-bold text-sm w-7 text-right shrink-0">{r.rank}</span>
                        <NeoAvatar name={r.username} size="sm" />
                        <p className="font-heading font-bold text-sm flex-1 min-w-0 truncate">
                          {r.username}
                          {isMe && " (you)"}
                        </p>
                        {!isBlitz && (
                          <NeoBadge color={tier.color} size="sm">
                            {tier.name}
                          </NeoBadge>
                        )}
                        {r.badge && (
                          <NeoBadge color="primary" size="sm">
                            {r.badge}
                          </NeoBadge>
                        )}
                        <span className="font-mono font-bold text-sm shrink-0">{formatValue(r.value)}</span>
                      </div>
                    );
                  })
                )}
              </div>
              {/* My standing, pinned under the list when I'm ranked. */}
              {myRow && (
                <div className="shrink-0 border-t-[3px] border-border bg-foreground text-background flex items-center gap-2.5 px-3.5 py-2">
                  <span className="font-mono font-bold text-sm w-7 text-right shrink-0">{myRow.rank}</span>
                  <p className="font-heading font-bold text-sm flex-1 min-w-0 truncate">You</p>
                  <span className="font-mono font-bold text-sm">{formatValue(myRow.value)}</span>
                </div>
              )}
            </NeoCard>
          </>
        )}
      </div>
    </ShellLayout>
  );
}
