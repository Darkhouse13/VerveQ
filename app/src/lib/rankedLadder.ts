/**
 * Ranked-ladder display model for the v2 Profile and Ranks screens.
 *
 * Two concerns live here, deliberately together:
 *
 *  1. The COARSE tier model the backend actually has today — flat ELO mapped
 *     to Bronze/Silver/Gold/Platinum. Thresholds mirror
 *     `convex/lib/elo.ts#getTierName` exactly; this file only formats, it
 *     never scores.
 *
 *  2. {@link RANKED_CAPABILITIES} — the honesty gate for the full ranked
 *     system the v2 designs depict (divisions, RP, promotion series, global
 *     rank, per-mode ratings, season archive). Flags flip to `true` only when
 *     the backend actually serves the number; gated UI renders an explicit
 *     placeholder (or nothing) until then, never a fabrication. First light:
 *     `globalRank` (2026-06-12), backed by `leaderboards.getGlobalRank`.
 */

export interface RankedCapabilities {
  divisions: boolean;
  rankPoints: boolean;
  promotionSeries: boolean;
  globalRank: boolean;
  perModeRatings: boolean;
  seasonArchive: boolean;
  tierPopulation: boolean;
}

/** What the ranked backend can actually serve today — see above. */
export const RANKED_CAPABILITIES: RankedCapabilities = {
  /** Tier sub-divisions (Gold III → I). */
  divisions: false,
  /** Rank Points within a division (e.g. "320 / 500 RP"). */
  rankPoints: false,
  /** Promotion series between divisions/tiers. */
  promotionSeries: false,
  /**
   * Your absolute global position (e.g. "#1,204 GLOBAL"). LIVE — served by
   * `leaderboards.getGlobalRank` (same ordering/eligibility as the board).
   */
  globalRank: true,
  /** Per-mode rating breakdown cards. */
  perModeRatings: false,
  /** Browsable archive of finished seasons. */
  seasonArchive: false,
  /** Player-distribution stats per tier ("19% of players"). */
  tierPopulation: false,
};

export type TierKey = "bronze" | "silver" | "gold" | "platinum";

export interface TierInfo {
  key: TierKey;
  /** Inclusive lower ELO bound. */
  min: number;
  /** Inclusive upper ELO bound, or null for the open-ended top tier. */
  max: number | null;
  /** Emblem/accent color (visual identity only). */
  color: string;
}

/** Bottom → top. Thresholds mirror convex/lib/elo.ts#getTierName. */
export const TIERS: TierInfo[] = [
  { key: "bronze", min: 0, max: 1199, color: "#B07A43" },
  { key: "silver", min: 1200, max: 1499, color: "#9AA1A8" },
  { key: "gold", min: 1500, max: 1999, color: "#E2B23A" },
  { key: "platinum", min: 2000, max: null, color: "#5FD0C8" },
];

export function tierFromElo(elo: number): TierKey {
  if (elo >= 2000) return "platinum";
  if (elo >= 1500) return "gold";
  if (elo >= 1200) return "silver";
  return "bronze";
}

export interface TierProgress {
  tier: TierKey;
  /** Next tier up, or null at the top. */
  next: TierKey | null;
  /** ELO needed to enter `next` (null at the top). */
  nextThreshold: number | null;
  /** 0..1 through the current tier band (1 at the top tier). */
  pct: number;
}

/** Progress through the current tier band, from the flat (real) ELO. */
export function tierProgress(elo: number): TierProgress {
  const idx = TIERS.findIndex((t) => t.key === tierFromElo(elo));
  const tier = TIERS[idx];
  const nextTier = TIERS[idx + 1] ?? null;
  if (!nextTier) {
    return { tier: tier.key, next: null, nextThreshold: null, pct: 1 };
  }
  const span = nextTier.min - tier.min;
  const pct = Math.min(1, Math.max(0, (elo - tier.min) / span));
  return { tier: tier.key, next: nextTier.key, nextThreshold: nextTier.min, pct };
}
