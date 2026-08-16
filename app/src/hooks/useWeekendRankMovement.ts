import { useEffect, useState } from "react";

/**
 * Rank movement since this browser last saw the gameweek. The leaderboard is
 * already the authority; this stores only the previously displayed position,
 * never a score or competition fact.
 */
export function useWeekendRankMovement(gameweekId: string | null, rank: number | null) {
  const [movement, setMovement] = useState<number | null>(null);

  useEffect(() => {
    setMovement(null);
    if (gameweekId === null || rank === null || typeof window === "undefined") return;
    const key = `verveq:weekend-rank:${gameweekId}`;
    try {
      const previous = Number(window.localStorage.getItem(key));
      if (Number.isFinite(previous) && previous > 0 && previous !== rank) {
        setMovement(previous - rank);
      }
      window.localStorage.setItem(key, String(rank));
    } catch {
      // Storage can be disabled. Rank display still works; only movement drops.
    }
  }, [gameweekId, rank]);

  return movement;
}
