/**
 * Weekend Fantasy — the single place every rule constant lives (FW-1).
 *
 * Every value below cites the spec clause that fixes it. Nothing in the
 * fantasy namespace may re-declare one of these inline: when the pricing pass
 * or a sim run moves a number, it moves here and nowhere else.
 *
 * Specs (research/fantasy/specs/):
 *   - BUDGET_MODE_SPEC.md v1.0 (LOCKED 2026-07-28)
 *   - DRAFT_ROOM_SPEC.md v1.0 (LOCKED 2026-07-28)
 *   - SCORING_SPEC.md v0.4.1 (APPROVED)
 *
 * This module is PURE: no Convex imports, no clock reads except where a
 * function is explicitly passed an instant. That keeps it directly unit
 * testable and safe to share with a future client build.
 */

// ── squad shape ──

/** BUDGET_MODE §Squad construction; DRAFT_ROOM §Room parameters ("Rounds 13"). */
export const SQUAD_SIZE = 13;

/** The fielded eleven. BUDGET_MODE §Squad construction: "13: XI + 2 finishers". */
export const XI_SIZE = 11;

/** BUDGET_MODE §Squad construction: exactly two finisher slots, LOCKED. */
export const FINISHER_COUNT = 2;

export const SLOT_ROLES = ["GK", "DEF", "MID", "ATT"] as const;
export type SlotRole = (typeof SLOT_ROLES)[number];

/**
 * Formation structural rule — BUDGET_MODE §Squad construction, "Formation
 * structural rule (LOCKED, FW-1 STOP-2 ruling 2026-07-28)".
 *
 * A structural rule rather than a catalogue of named shapes: it admits every
 * formation a normal person would name (4-4-2, 4-3-3, 3-5-2, 5-3-2, 4-5-1,
 * 3-4-3, …) and excludes nonsense, and the spec never has to maintain a list.
 *
 * Governs the XI ONLY. Per the FW-1 STOP-3 ruling the 2 finishers carry their
 * own slotRole, unconstrained by the XI's shape (consistent with
 * all-positions-eligible) — which is why fantasySquadRules.formationOf skips
 * finisher slots rather than counting them. The absence of a finisher-role
 * check there is that ruling, not an omission.
 */
export const FORMATION_BOUNDS: Readonly<Record<SlotRole, { min: number; max: number }>> = {
  GK: { min: 1, max: 1 },
  DEF: { min: 3, max: 5 },
  MID: { min: 2, max: 5 },
  ATT: { min: 1, max: 3 },
};

// ── club cap ──

/**
 * DRAFT_ROOM §Room parameters and ledger item 6; BUDGET_MODE §Squad
 * construction. Max 3 players from one club, EXCEPT the user's favorite club,
 * which is uncapped.
 *
 * Ledger item 8 extends the exemption to budget mode, so the cap check in
 * fantasySquadRules.validateClubCap is deliberately context-independent.
 */
export const PER_CLUB_CAP = 3;

/**
 * DRAFT_ROOM §Favorite-club exemption + ledger item 7: a favorite-club CHANGE
 * takes effect after a 4-gameweek cooldown. Counted in OUR weekend ordinals
 * (fantasyGameweeks.gwNumber), not any league's round number.
 */
export const FAVORITE_CLUB_COOLDOWN_GAMEWEEKS = 4;

// ── budget ──

/**
 * PLACEHOLDER. BUDGET_MODE §Squad construction prices the budget as "principle
 * LOCKED, number pending" and open item 1 defers it to the pricing pass; the
 * FW-1 STOP-4 ruling (2026-07-28) fixes 100.0 as the placeholder so the budget
 * invariant is implemented and tested now. Replacing this constant with the
 * real number is the whole of the change — no code moves.
 */
export const PLACEHOLDER_PENDING_PRICING_PASS = 100.0;

/** The budget ceiling in force. Alias kept deliberately thin — see above. */
export const BUDGET_LIMIT = PLACEHOLDER_PENDING_PRICING_PASS;

// ── leagues ──

/**
 * DRAFT_ROOM §Room parameters: "all 5 leagues". API-Football v3 league ids,
 * matching research/fantasy/fetch/config.ts (the FS-1 sample's LEAGUES).
 */
export const LEAGUE_IDS = [39, 140, 135, 78, 61] as const;
export type LeagueId = (typeof LEAGUE_IDS)[number];

export function isKnownLeagueId(id: number): id is LeagueId {
  return (LEAGUE_IDS as readonly number[]).includes(id);
}

// ── finality ──

/**
 * The finality cut: Tuesday 23:59 Europe/Paris.
 *
 * BUDGET_MODE §Founding shape and DRAFT_ROOM §Lifecycle state 6 both fix
 * Tuesday 23:59; the FW-1 STOP-5 ruling (2026-07-28) resolves the spec's
 * imprecise "CET" to **Europe/Paris wall clock**. CET is a fixed UTC+1, but
 * Paris runs CEST (UTC+2) for most of a football season, so a fixed offset
 * would drift an hour against the user's local Tuesday from late March to late
 * October. Users live in local time; the wall clock is what was meant.
 */
export const FINALITY_TIME_ZONE = "Europe/Paris";
/** 0 = Sunday … 2 = Tuesday. */
export const FINALITY_WEEKDAY = 2;
export const FINALITY_HOUR = 23;
export const FINALITY_MINUTE = 59;

const MS_PER_DAY = 86_400_000;

/**
 * The UTC offset (ms) that `timeZone` is running at the instant `epochMs`.
 *
 * Derived from Intl rather than a tz table so DST is always the platform's
 * problem, not ours. `hourCycle: "h23"` matters: the default h24 for some
 * locales renders midnight as "24", which would parse an entire day out.
 */
function zoneOffsetMs(epochMs: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(epochMs));

  const field = (type: string): number =>
    Number(parts.find((p) => p.type === type)?.value ?? "0");

  const asIfUtc = Date.UTC(
    field("year"),
    field("month") - 1,
    field("day"),
    field("hour"),
    field("minute"),
    field("second"),
  );
  return asIfUtc - epochMs;
}

/**
 * Convert a wall-clock reading in `timeZone` to an epoch timestamp.
 *
 * Two passes: guess with the offset in force at the naive-UTC instant, then
 * re-solve with the offset actually in force at the guess. That second pass is
 * what makes the last Sunday in March and October correct.
 */
export function zonedWallClockToEpochMs(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string = FINALITY_TIME_ZONE,
): number {
  const naive = Date.UTC(year, month - 1, day, hour, minute);
  const firstGuess = naive - zoneOffsetMs(naive, timeZone);
  return naive - zoneOffsetMs(firstGuess, timeZone);
}

/** The Europe/Paris calendar date (y/m/d) and weekday at an instant. */
function zonedDateParts(
  epochMs: number,
  timeZone: string,
): { year: number; month: number; day: number; weekday: number } {
  const offset = zoneOffsetMs(epochMs, timeZone);
  const shifted = new Date(epochMs + offset);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    weekday: shifted.getUTCDay(),
  };
}

/**
 * The finality instant for the weekend containing `instant`: the first
 * Tuesday 23:59 Europe/Paris at or after it.
 *
 * A gameweek stores this as `finalityAt`; FW-2 (ingestion) is what actually
 * calls it when it constitutes a gameweek. Exposed here so the rule lives with
 * the constants that define it rather than in the ingestion ticket.
 */
export function finalityAtOrAfter(
  instant: number,
  timeZone: string = FINALITY_TIME_ZONE,
): number {
  const { year, month, day, weekday } = zonedDateParts(instant, timeZone);
  const daysAhead = (FINALITY_WEEKDAY - weekday + 7) % 7;

  // Build the candidate from the local date advanced by whole days. Adding
  // days to the UTC-shifted date and re-reading its parts keeps month/year
  // rollover correct without any calendar arithmetic of our own.
  const shiftedBase = Date.UTC(year, month - 1, day) + daysAhead * MS_PER_DAY;
  const target = new Date(shiftedBase);
  const candidate = zonedWallClockToEpochMs(
    target.getUTCFullYear(),
    target.getUTCMonth() + 1,
    target.getUTCDate(),
    FINALITY_HOUR,
    FINALITY_MINUTE,
    timeZone,
  );

  // Already past this week's cut (e.g. Tuesday 23:59:30) ⇒ next week's.
  if (candidate < instant) {
    const nextWeek = new Date(shiftedBase + 7 * MS_PER_DAY);
    return zonedWallClockToEpochMs(
      nextWeek.getUTCFullYear(),
      nextWeek.getUTCMonth() + 1,
      nextWeek.getUTCDate(),
      FINALITY_HOUR,
      FINALITY_MINUTE,
      timeZone,
    );
  }
  return candidate;
}
