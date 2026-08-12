/**
 * Display names for the covered leagues (FW-POLISH D4).
 *
 * The ids are API-Football v3 league ids — the same catalogue as
 * fantasyConstants.LEAGUE_IDS and research/fantasy/fetch/config.ts LEAGUES,
 * which is where these names are pinned. WHICH leagues play a given weekend
 * always comes from fixture data (fantasyMarket.getWeekendLeagues); only the
 * spelling of each covered league's name lives here.
 */
import { LEAGUE_IDS, type LeagueId } from "../../convex/lib/fantasyConstants";

export const LEAGUE_NAMES: Readonly<Record<LeagueId, string>> = {
  39: "Premier League",
  140: "La Liga",
  135: "Serie A",
  78: "Bundesliga",
  61: "Ligue 1",
  88: "Eredivisie",
  94: "Liga Portugal",
  40: "Championship",
};

/** Never renders a raw id to a user — an unknown league reads as a league. */
export function leagueName(id: number): string {
  return (LEAGUE_IDS as readonly number[]).includes(id)
    ? LEAGUE_NAMES[id as LeagueId]
    : "another league";
}

/** "Premier League + La Liga"-style joined line, in the given order. */
export function leagueListLine(ids: ReadonlyArray<number>): string {
  return ids.map(leagueName).join(" + ");
}
