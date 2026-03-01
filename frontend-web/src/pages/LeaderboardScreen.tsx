import { NeoCard } from "@/components/neo/NeoCard";
import { NeoAvatar } from "@/components/neo/NeoAvatar";
import { NeoBadge } from "@/components/neo/NeoBadge";
import { BottomNav } from "@/components/neo/BottomNav";
import { useState } from "react";
import { Crown } from "lucide-react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

const filters = {
  sport: ["All", "Football", "Tennis"],
  mode: ["Quiz", "Survival"],
  period: ["Daily", "Weekly", "All Time"],
};

function getTier(elo: number | null) {
  if (!elo) return { name: "Bronze", color: "muted" as const };
  if (elo >= 2000) return { name: "Platinum", color: "accent" as const };
  if (elo >= 1500) return { name: "Gold", color: "primary" as const };
  if (elo >= 1200) return { name: "Silver", color: "muted" as const };
  return { name: "Bronze", color: "muted" as const };
}

export default function LeaderboardScreen() {
  const [activeFilters, setActiveFilters] = useState({
    sport: "All",
    mode: "Quiz",
    period: "Weekly",
  });

  const sportParam =
    activeFilters.sport === "All"
      ? undefined
      : activeFilters.sport.toLowerCase();
  const modeParam = sportParam ? activeFilters.mode.toLowerCase() : undefined;

  const data = useQuery(api.leaderboards.getLeaderboard, {
    sport: sportParam,
    mode: modeParam,
    limit: 20,
  });

  const isLoading = data === undefined;
  const entries = data?.entries ?? [];
  const podiumEntries = entries.slice(0, 3);
  const podiumOrder =
    podiumEntries.length >= 3
      ? [podiumEntries[1], podiumEntries[0], podiumEntries[2]]
      : podiumEntries;
  const rankingsEntries = entries.slice(3);

  const podiumHeights: Record<number, string> = {
    1: "h-28",
    2: "h-20",
    3: "h-16",
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="px-5 pt-6 pb-4">
        <h1 className="text-2xl font-heading font-bold mb-4">Leaderboard</h1>

        <div className="flex flex-wrap gap-2 mb-6">
          {Object.entries(filters).map(([key, values]) =>
            values.map((v) => (
              <button
                key={v}
                onClick={() =>
                  setActiveFilters((f) => ({ ...f, [key]: v }))
                }
                className={`neo-border rounded-full px-3 py-1 text-xs font-heading font-bold uppercase cursor-pointer transition-all ${
                  activeFilters[key as keyof typeof activeFilters] === v
                    ? "bg-primary text-primary-foreground neo-shadow"
                    : "bg-background text-foreground"
                }`}
              >
                {v}
              </button>
            )),
          )}
        </div>

        {isLoading ? (
          <p className="text-center font-heading animate-pulse py-12">
            Loading...
          </p>
        ) : entries.length === 0 ? (
          <NeoCard className="text-center py-12">
            <p className="font-heading font-bold text-lg">No entries yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Be the first to play!
            </p>
          </NeoCard>
        ) : (
          <>
            <div className="flex items-end justify-center gap-3 mb-8">
              {podiumOrder.map((p) => {
                const height = podiumHeights[p.rank] || "h-16";
                return (
                  <div key={p.rank} className="flex flex-col items-center">
                    <NeoAvatar
                      name={p.username}
                      size={p.rank === 1 ? "lg" : "md"}
                    />
                    {p.rank === 1 && (
                      <Crown
                        size={20}
                        strokeWidth={2.5}
                        className="text-primary -mt-2 mb-1"
                      />
                    )}
                    <p className="font-heading font-bold text-xs mt-1">
                      {p.username}
                    </p>
                    <p className="font-mono text-[10px] text-muted-foreground">
                      {p.elo_rating ?? p.score}
                    </p>
                    <div
                      className={`neo-border rounded-t-lg w-16 mt-2 ${height} ${p.rank === 1 ? "bg-primary" : p.rank === 2 ? "bg-muted" : "bg-accent"}`}
                    >
                      <p className="font-heading font-bold text-xl text-center pt-2">
                        {p.rank}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="space-y-2">
              {rankingsEntries.map((r) => {
                const tier = getTier(r.elo_rating);
                return (
                  <NeoCard
                    key={r.rank}
                    className="flex items-center gap-3 py-3"
                  >
                    <span className="font-heading font-bold text-lg w-8 text-center">
                      {r.rank}
                    </span>
                    <NeoAvatar name={r.username} size="sm" />
                    <div className="flex-1">
                      <p className="font-heading font-bold text-sm">
                        {r.username}
                      </p>
                      <p className="font-mono text-xs text-muted-foreground">
                        {r.elo_rating ?? r.score} ELO
                      </p>
                    </div>
                    <NeoBadge color={tier.color} rotated>
                      {tier.name}
                    </NeoBadge>
                  </NeoCard>
                );
              })}
            </div>
          </>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
