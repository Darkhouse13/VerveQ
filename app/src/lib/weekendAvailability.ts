/**
 * THE WEEKEND — availability presentation (FW-AVAIL).
 *
 * One place that decides how the feed's availability report is WORDED and
 * COLOURED, shared by the picker row, the pitch, the ledger and the detail
 * sheet. Three surfaces rendering the same fact three different ways is how a
 * manager ends up trusting one of them and not the others.
 *
 * ── The line this module holds ──
 *
 * It never turns a report into advice. There is no "avoid", no risk score, no
 * implied ranking between a knock and a red card — the same product law the
 * detail sheet already enforces (stats, never a recommendation). The badge
 * says what the feed says, the reason line quotes the feed's own words, and
 * the manager decides.
 *
 * It also never renders silence as good news. `availabilityLeagues` from
 * `getMarket` is the difference between "nobody flagged him" and "nobody
 * looked", and `leagueHasReport` below is what every caller must consult
 * before showing an all-clear.
 */

export type AvailabilityStatus = "out" | "doubtful";
export type AvailabilityCategory = "injury" | "suspension" | "other";

export interface AvailabilityInfo {
  status: AvailabilityStatus;
  category: AvailabilityCategory;
  /** The provider's own wording. Null when it gave none. */
  reason: string | null;
}

/** NeoBadge colour per status. `out` is the destructive red; a doubt is not. */
export function availabilityColor(status: AvailabilityStatus): "destructive" | "yellow" {
  return status === "out" ? "destructive" : "yellow";
}

/**
 * The badge word. Deliberately short — it sits beside a price in a row that
 * also carries "No fixture", "Started" and "In squad".
 */
export function availabilityBadgeLabel(
  status: AvailabilityStatus,
  t: (key: string, opts: { defaultValue: string }) => string,
): string {
  return status === "out"
    ? t("weekend.availabilityOut", { defaultValue: "Out" })
    : t("weekend.availabilityDoubt", { defaultValue: "Doubt" });
}

/**
 * The one-line explanation, e.g. "Expected to miss — Knee Injury".
 *
 * The reason is the feed's string, passed through untranslated. Translating
 * "Lacking Match Fitness" into forty locales would mean maintaining a mapping
 * of a vocabulary the provider changes without notice, and a mistranslated
 * medical claim is worse than an English one. The FRAME around it is
 * translated; the quote is not.
 */
export function availabilityLine(
  info: AvailabilityInfo,
  t: (key: string, opts: { defaultValue: string }) => string,
): string {
  const frame =
    info.status === "out"
      ? t("weekend.availabilityOutLong", { defaultValue: "Expected to miss this fixture" })
      : t("weekend.availabilityDoubtLong", { defaultValue: "Doubtful for this fixture" });
  return info.reason === null ? frame : `${frame} — ${info.reason}`;
}

/**
 * Did this player's league file a report for the open gameweek?
 *
 * `availabilityLeagues` is the list `getMarket` serves. A league missing from
 * it has told us nothing, and no surface may draw its players as available.
 * Undefined tolerates a backend that predates the field — the same
 * deploy-order tolerance the matchup line uses — and reads as "no report",
 * which is the safe direction.
 */
export function leagueHasReport(
  leagueId: number,
  availabilityLeagues: readonly number[] | undefined,
): boolean {
  return availabilityLeagues !== undefined && availabilityLeagues.includes(leagueId);
}

/** Flagged players in a list, most severe first. Used for the squad warning. */
export function countFlagged<T extends { availability?: AvailabilityInfo | null }>(
  rows: readonly T[],
): { out: number; doubtful: number } {
  let out = 0;
  let doubtful = 0;
  for (const row of rows) {
    if (row.availability == null) continue;
    if (row.availability.status === "out") out += 1;
    else doubtful += 1;
  }
  return { out, doubtful };
}
