/**
 * Weekend Fantasy — availability classification (FW-AVAIL).
 *
 * Pure rules turning API-Football's `/injuries` rows into the two facts a
 * squad builder actually needs: is this player expected to MISS the fixture,
 * or merely at risk of missing it, and why.
 *
 * ── What this is, and what it deliberately is not ──
 *
 * It is a REPORT, not a verdict. Nothing here gates selection: a flagged
 * player stays pickable, priced, and lockable, exactly as before. The feed is
 * often late and sometimes wrong — a "Questionable" hamstring starts and
 * scores twice most weekends — and the owner ruling on this ticket is that the
 * surfaces inform the manager and leave the call to them. That decision is
 * what keeps this file free of any coupling to the lock engine or the squad
 * validators.
 *
 * It also never converts absence of evidence into evidence of fitness. Two of
 * the eight covered leagues returned no rows at all on the day this was
 * measured, and `coverageOf` exists so a surface can say "no report for the
 * Bundesliga this weekend" instead of drawing every Bundesliga player as fit.
 */

import type { FeedInjuryRow } from "../fantasyApiFootball";

/**
 * `out` — the feed says he misses this fixture ("Missing Fixture").
 * `doubtful` — the feed says he might ("Questionable"), or used a word we do
 *   not know. An unrecognised type degrades to the SOFTER claim on purpose:
 *   over-stating a doubt as a certainty is the failure that costs a manager
 *   a transfer.
 */
export type AvailabilityStatus = "out" | "doubtful";

/**
 * Why he is flagged. Coarse on purpose — three buckets is what a badge and a
 * filter chip can carry. The feed's own wording is preserved separately in
 * `reason` and is what the detail sheet shows.
 */
export type AvailabilityCategory = "injury" | "suspension" | "other";

/**
 * Exactly the fields `fantasyAvailability.applyLeagueAvailability` accepts.
 *
 * The feed's own team id is deliberately NOT carried. The mutation takes the
 * club from OUR player row (the universe wins when the two disagree mid
 * transfer window), so a second club id here would be an unused field that
 * Convex's argument validator rejects outright — which is exactly how the
 * first prod sweep failed.
 */
export interface AvailabilityRecord {
  providerPlayerId: string;
  providerFixtureId: string;
  status: AvailabilityStatus;
  category: AvailabilityCategory;
  /** The feed's words, whitespace-normalised. Null when it gave none. */
  reason: string | null;
  /** The raw `player.type`, kept so a provider vocabulary change is visible. */
  rawType: string;
}

/** The one type string that means "he is not playing". Everything else is a doubt. */
const TYPE_OUT = "missing fixture";

// Stems, not whole words: the feed ships "Suspended", and a trailing \b
// after "suspend" would not match it.
const SUSPENSION = /\b(?:suspen\w*|red card|yellow cards?|banned|ban)\b/i;
const INJURY =
  /\b(?:injur\w*|knock|surgery|broken|fracture\w*|strain\w*|sprain\w*|torn|achilles|hamstring|muscle|ligament|concussion|illness|ill|virus|health)\b/i;

/**
 * Bucket the feed's free-text reason.
 *
 * Suspension is tested FIRST because "Red Card" carries no injury word but is
 * unambiguous, while several injury phrases ("Knock") carry no injury word
 * either and would otherwise fall through. Anything left — "Inactive",
 * "Lacking Match Fitness", "Coach's decision", "National selection" — is
 * `other`: a real reason to expect him to miss out, and not a medical claim we
 * have any business making.
 */
export function categoriseReason(reason: string | null): AvailabilityCategory {
  if (reason === null || reason === "") return "other";
  if (SUSPENSION.test(reason)) return "suspension";
  if (INJURY.test(reason)) return "injury";
  return "other";
}

function tidy(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = value.replace(/\s+/g, " ").trim();
  return trimmed === "" ? null : trimmed;
}

/**
 * One feed row → one record, or null when the row cannot be used.
 *
 * Rejects rather than guesses. A row with no player id cannot be joined to our
 * universe; a row with no fixture id cannot be scoped to a gameweek. Both are
 * dropped and counted by the caller — inventing an identity for either would
 * attach a flag to the wrong footballer.
 */
export function toAvailabilityRecord(row: FeedInjuryRow): AvailabilityRecord | null {
  const playerId = row.player?.id;
  const fixtureId = row.fixture?.id;
  if (playerId === null || playerId === undefined) return null;
  if (fixtureId === null || fixtureId === undefined) return null;

  const rawType = tidy(row.player?.type) ?? "";
  const reason = tidy(row.player?.reason);

  return {
    providerPlayerId: String(playerId),
    providerFixtureId: String(fixtureId),
    status: rawType.toLowerCase() === TYPE_OUT ? "out" : "doubtful",
    category: categoriseReason(reason),
    reason,
    rawType,
  };
}

/** `out` outranks `doubtful` — the more severe claim wins a tie. */
function severity(status: AvailabilityStatus): number {
  return status === "out" ? 1 : 0;
}

/**
 * Collapse a league's rows to at most one per player, keeping only fixtures in
 * the gameweek being refreshed.
 *
 * A club can play twice inside one window (FW-EXPAND U1 double gameweeks), so a
 * player can legitimately carry two rows. The severe one wins; ties break on
 * the fixture the caller lists first, which is kickoff order. Deterministic
 * either way, so a re-sweep does not flip the stored row back and forth.
 */
export function collapseForGameweek(
  rows: readonly FeedInjuryRow[],
  gameweekFixtureIds: ReadonlySet<string>,
): { records: AvailabilityRecord[]; inFeed: number; unusable: number } {
  let unusable = 0;
  const byPlayer = new Map<string, AvailabilityRecord>();

  for (const row of rows) {
    const record = toAvailabilityRecord(row);
    if (record === null) {
      unusable += 1;
      continue;
    }
    if (!gameweekFixtureIds.has(record.providerFixtureId)) continue;

    const seen = byPlayer.get(record.providerPlayerId);
    if (seen === undefined || severity(record.status) > severity(seen.status)) {
      byPlayer.set(record.providerPlayerId, record);
    }
  }

  return {
    records: [...byPlayer.values()].sort((a, b) =>
      a.providerPlayerId.localeCompare(b.providerPlayerId),
    ),
    inFeed: rows.length,
    unusable,
  };
}

/**
 * Did this league report at all?
 *
 * Deliberately measured against the WHOLE response rather than the gameweek
 * slice. A league that returns rows for other rounds but none for ours has
 * reported and flagged nobody — genuine good news. A league that returns
 * nothing for any round is not covered by the provider, and its players'
 * fitness is simply unknown to us. Only the second case is a coverage gap, and
 * conflating them would either hide real information or invent a warning on
 * every clean league.
 */
export function coverageOf(rowsInFeed: number): "reported" | "no-report" {
  return rowsInFeed > 0 ? "reported" : "no-report";
}
