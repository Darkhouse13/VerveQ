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
