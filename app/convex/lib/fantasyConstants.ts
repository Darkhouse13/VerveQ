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
 * DRAFT_ROOM v1.0.2 §Favorite-club exemption + ledger item 7: a favorite-club
 * CHANGE takes effect **28 calendar days** after it is made, measured as a
 * timestamp.
 *
 * Days, not gameweeks (owner STOP-F ruling, re-issued at the FW-2-RUN closeout
 * 2026-07-29). The two are not interchangeable once midweek gameweeks exist:
 * the bootstrapped 2026-2027 season has 13 midweek windows in 49 gameweeks, so
 * "4 gameweeks" spans anywhere from about two to about four calendar weeks
 * depending on where in the calendar the change lands. A user could shorten
 * their own anti-gaming cooldown by timing it against a congested fixture list,
 * which is precisely what the rule exists to prevent.
 */
export const FAVORITE_CLUB_COOLDOWN_DAYS = 28;
export const FAVORITE_CLUB_COOLDOWN_MS = FAVORITE_CLUB_COOLDOWN_DAYS * 86_400_000;

// ── budget ──

/**
 * The squad budget: what all 13 slots may cost together.
 *
 * BUDGET_MODE_SPEC v1.1.0 §Budget (owner ruling 2026-07-29, FW-PR3) — LOCKED at
 * 91.0, in the same units as `pricing/price-final.json` (the 4.0-13.0 scale in
 * 0.5 steps). It buys a two-elite core carried by a 5.9-average eleven, or three
 * elites filled near the floor; the all-9.0 balanced squad (113.5) and max-stars
 * (138.0) are out of reach. Basis: `pricing/BUDGET_ANALYSIS.md`.
 *
 * This replaces FW-1's `PLACEHOLDER_PENDING_PRICING_PASS = 100.0` and the thin
 * `BUDGET_LIMIT` alias that existed only to keep callers off the placeholder's
 * name. The placeholder was designed so that arriving at the real number moved
 * no code, and it did not: only this constant changed value.
 */
export const SQUAD_BUDGET = 91.0;

// ── price scale ──

/**
 * The editorial price scale: 4.0 to 13.0 in 0.5 steps.
 *
 * Fixed by the pricing pass (research/fantasy/pricing/PROXY_METHOD.md
 * §Anchor design → direct value pricing, owner rulings FW-PR1b/FW-PR1c): the
 * floor is every unproxied player's price and the top is the MID ceiling, the
 * highest of the four. The per-position ceilings (MID 13.0 / ATT 12.5 / DEF 9.0
 * / GK 6.0) are NOT here on purpose — they gate the draft formula only, and the
 * FW-PR2 owner ruling exempts editorial overrides from them (Lamine Yamal is
 * priced 13.0 as an attacker). This scale is the one rule every stored price
 * obeys, which is exactly why it is the one the write path checks.
 */
export const PRICE_MIN = 4.0;
export const PRICE_MAX = 13.0;
export const PRICE_STEP = 0.5;

/** Whether a price is a legal point on the scale above. */
export function isOnPriceScale(price: number): boolean {
  return (
    Number.isFinite(price) &&
    price >= PRICE_MIN &&
    price <= PRICE_MAX &&
    Math.round(price / PRICE_STEP) === price / PRICE_STEP
  );
}

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
 * The finality cut: 23:59 **Europe/Paris wall clock**.
 *
 * The FW-1 STOP-5 ruling (2026-07-28) resolved the specs' imprecise "CET" to
 * Europe/Paris wall clock. CET is a fixed UTC+1, but Paris runs CEST (UTC+2)
 * for most of a football season, so a fixed offset would drift an hour against
 * the user's local evening from late March to late October. Users live in local
 * time; the wall clock is what was meant.
 *
 * ── Which DAY is no longer decided here (STOP-E, 2026-07-29) ──
 *
 * FW-1 also shipped `finalityAtOrAfter`, which answered "the first **Tuesday**
 * 23:59 at or after this instant". That was correct while a gameweek was
 * assumed to be a weekend and nothing else. FW-2's gameweek constitution admits
 * midweek windows, which settle on **Friday**, so a fixed weekday cannot
 * express the rule any more.
 *
 * Per the owner's STOP-E ruling that function is **deleted rather than kept
 * alongside** the general one — two finality functions in one namespace is an
 * invitation for a caller to pick the wrong one, and the wrong one fails
 * silently by returning a plausible timestamp four days late. The single
 * source of truth is now `lib/fantasyGameweekWindows.windowFor(instant).finalityAt`,
 * which derives the day from the window the instant belongs to. The HOUR and
 * MINUTE below are still the shared cut and are consumed from there.
 */
export const FINALITY_TIME_ZONE = "Europe/Paris";
export const FINALITY_HOUR = 23;
export const FINALITY_MINUTE = 59;

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
export function zonedDateParts(
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
