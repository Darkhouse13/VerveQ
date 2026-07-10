/**
 * Career Path club entries.
 *
 * A club is either a plain club name (a permanent spell) or a structured object
 * that flags a loan spell. Loans are first-class content: a chronological path
 * that silently flattens a loan into a permanent move is misleading, so the
 * dataset marks loan spells and the UI renders a distinct LOAN badge.
 *
 * Pure module (no server imports) so the client screen, the content-factory,
 * and the backend can all share the name/loan accessors — mirrors lib/fuzzy.
 */
export type CareerPathClub = string | { name: string; loan?: boolean };

/** The club's display name, whether it's a bare string or a loan object. */
export function clubName(club: CareerPathClub): string {
  return typeof club === "string" ? club : club.name;
}

/** True when the spell at this club was a loan (never for plain-string clubs). */
export function clubIsLoan(club: CareerPathClub): boolean {
  return typeof club !== "string" && club.loan === true;
}

/**
 * Max club rows to render before condensing. A handful of journeymen have
 * enormous paths (Sebastián Abreu 37, Túlio Maravilha 39) that are unreadable
 * in full, especially in the vertical video.
 */
export const CAREER_PATH_MAX_DISPLAY_CLUBS = 12;

/** A rendered row: either a club spell (with its true 1-based career position) or
 *  a gap standing in for hidden middle spells. */
export type CareerPathClubRow =
  | { kind: "club"; name: string; loan: boolean; position: number }
  | { kind: "gap"; hidden: number };

/**
 * Rows to render for a club list. Short/normal careers pass through unchanged.
 * A very long one is condensed to its first `head` and last `tail` spells with a
 * single gap row in between — DISPLAY ONLY, the stored path is never truncated,
 * and the gap states how many spells are hidden so a condensed path is never
 * shown as if it were complete.
 */
export function clubsForDisplay(
  clubs: CareerPathClub[],
  max: number = CAREER_PATH_MAX_DISPLAY_CLUBS,
): CareerPathClubRow[] {
  const row = (club: CareerPathClub, index: number): CareerPathClubRow => ({
    kind: "club",
    name: clubName(club),
    loan: clubIsLoan(club),
    position: index + 1,
  });
  if (clubs.length <= max) return clubs.map(row);
  const shown = max - 1; // reserve one row for the gap marker
  const head = Math.ceil(shown / 2);
  const tail = shown - head;
  const rows: CareerPathClubRow[] = clubs.slice(0, head).map(row);
  rows.push({ kind: "gap", hidden: clubs.length - head - tail });
  const tailStart = clubs.length - tail;
  clubs.slice(tailStart).forEach((club, i) => rows.push(row(club, tailStart + i)));
  return rows;
}
