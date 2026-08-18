/**
 * Session memory of the open gameweek's market, keyed by gameweekId.
 *
 * Route changes unmount every screen and Convex re-executes `getMarket` on
 * each mount — so hub → squad → hub → squad paid the full market wait every
 * time. The market is identical for every user within a gameweek and prices
 * are static within one (BUDGET_MODE §Squad construction), so the last
 * payload is a truthful first paint while the fresh subscription lands
 * behind it (a reprice mid-session is corrected by that subscription; every
 * write stays server-validated, so a seconds-stale price can never build an
 * illegal squad). Render-only — nothing here is ever written back.
 */
import type { FunctionReturnType } from "convex/server";
import { api } from "../../convex/_generated/api";

export type WeekendMarket = NonNullable<
  FunctionReturnType<typeof api.fantasyMarket.getMarket>
>;

let cached: { gameweekId: string; market: WeekendMarket } | null = null;

/** The cached market for THIS gameweek, or null (first visit, or the board
 *  turned since the last visit). */
export function readWeekendMarketCache(gameweekId: string | null): WeekendMarket | null {
  if (gameweekId === null || cached?.gameweekId !== gameweekId) return null;
  return cached.market;
}

export function writeWeekendMarketCache(market: WeekendMarket): void {
  cached = { gameweekId: market.gameweekId, market };
}
