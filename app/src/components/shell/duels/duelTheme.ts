/** Duels theming helpers (VerveQ ONE P3.3), shared by the Duels surfaces. */
import type { CSSProperties } from "react";
import type { BadgeTone } from "@/components/ui/badge";

/** The Duels accent — the same pink as its Compete tile. Cascades to `bg-mode-accent`. */
export const DUEL_ACCENT: CSSProperties = { "--mode-accent": "var(--hot-pink)" } as CSSProperties;

/**
 * `duelStatusBadge` (lib/duel) still speaks NeoBadge colors. On the ONE
 * system green/red mean right/wrong only (a won/lost duel is that verdict);
 * everything else is neutral.
 */
export function duelBadgeTone(color: "blue" | "muted" | "success" | "destructive"): BadgeTone {
  if (color === "success") return "right";
  if (color === "destructive") return "wrong";
  if (color === "muted") return "muted";
  return "neutral";
}

