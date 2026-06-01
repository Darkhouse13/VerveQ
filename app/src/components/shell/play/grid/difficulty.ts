/**
 * Cell-difficulty display mapping for VerveGrid.
 *
 * IMPORTANT: this is the backend's CELL DIFFICULTY (how many valid players
 * exist for a square → how many points it's worth), NOT a pick-share / "% of
 * solvers who picked this" metric. The existing backend does not expose
 * pick-share, so the prototype's ELITE/RARE/COMMON pick-share badges are not
 * reproduced — we surface the genuine, server-provided difficulty tier instead,
 * and only ever for cells the player has already correctly filled.
 */
export type GridCellDifficulty = "rare" | "uncommon" | "common";

export interface DifficultyStyle {
  label: string;
  /** Neo badge classes (border + fill + foreground). */
  badgeClass: string;
  /** Text tint for compact contexts. */
  textClass: string;
}

const STYLES: Record<GridCellDifficulty, DifficultyStyle> = {
  rare: {
    label: "RARE",
    badgeClass: "bg-hot-pink text-hot-pink-foreground border-border",
    textClass: "text-hot-pink",
  },
  uncommon: {
    label: "UNCOMMON",
    badgeClass: "bg-electric-blue text-electric-blue-foreground border-border",
    textClass: "text-electric-blue",
  },
  common: {
    label: "COMMON",
    badgeClass: "bg-muted text-muted-foreground border-border",
    textClass: "text-muted-foreground",
  },
};

export function difficultyStyle(tier?: GridCellDifficulty): DifficultyStyle | null {
  if (!tier) return null;
  return STYLES[tier] ?? null;
}

/** Two-letter monogram for a player name (search has no photos in the sheet view-model). */
export function monogram(name: string): string {
  return name
    .replace(/[^A-Za-z ]/g, "")
    .split(" ")
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}
