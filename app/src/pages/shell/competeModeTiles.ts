import {
  Brain, Heart, Zap, TrendingUp, Grid3X3, Route, Timer, Swords, Users,
  Lightbulb, Clock,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { SHELL_ROUTES } from "@/lib/shellRoutes";

type NeoColor = "primary" | "accent" | "blue" | "pink" | "yellow" | "success";

export interface ModeTile {
  key: string;
  icon: LucideIcon;
  color: NeoColor;
  /** Builds the EXISTING, proven deep link for the chosen sport. */
  to: (sport: string) => string;
  /**
   * Whether finishing this mode moves the player's ELO — the SINGLE source of
   * truth for the Compete grid's RANKED vs CASUAL split (the screen derives its
   * sections from this flag, never a hardcoded key list). Set on a mode iff its
   * server finalizer writes `userRatings` AND that ladder is surfaced to the
   * player. Quiz only today: Survival also writes ELO, but its ladder isn't
   * shown, so it stays casual until that's surfaced — a one-line flip here.
   */
  ranked?: boolean;
}

// Tile config for the Compete landing grid (CompeteModeGridScreen). Lives in
// its own module so the compete-collapse routing contract can assert tile
// targets (Arena/Duels reachable) without rendering the screen.
//
// These targets are exactly what the existing sport-select produces for a sport,
// so the grid skips the redundant sport re-pick and lands directly in each mode.
export const COMPETE_MODE_TILES: ModeTile[] = [
  // Quiz is migrated to the v2 shell's centered-column "prototype layout". It
  // routes through the existing difficulty picker (target=v2) so the player
  // chooses a difficulty rather than defaulting to intermediate.
  { key: "quiz", icon: Brain, color: "accent", ranked: true, to: (s) => `/difficulty?sport=${s}&mode=quiz&target=v2` },
  // Arena and Duels are DISTINCT flows: Arena is the group-challenge-room
  // experience (create/join a room by code — its own shell hub), Duels is
  // head-to-head send-a-link via the Challenge hub embedded in the shell.
  { key: "arena", icon: Swords, color: "pink", to: () => SHELL_ROUTES.arena },
  { key: "duel", icon: Users, color: "yellow", to: () => SHELL_ROUTES.duels },
  // Survival + Blitz are migrated to the shell prototype layout (solo).
  { key: "survival", icon: Heart, color: "primary", to: (s) => `/v2/survival?sport=${s}` },
  { key: "blitz", icon: Zap, color: "pink", to: (s) => `/v2/blitz?sport=${s}` },
  // Higher/Lower + VerveGrid are the curated solo modes with difficulty tiers, so
  // they route through the shared difficulty picker first (like Quiz) — the player
  // chooses easy/medium/hard up front and the picker deep-links into the v2 play
  // screen with `?difficulty=`. Career Path has no tiers, so it launches directly.
  { key: "higherLower", icon: TrendingUp, color: "success", to: (s) => `/difficulty?sport=${s}&mode=higher-lower` },
  { key: "verveGrid", icon: Grid3X3, color: "blue", to: (s) => `/difficulty?sport=${s}&mode=verve-grid` },
  { key: "careerPath", icon: Route, color: "yellow", to: (s) => `/v2/career-path?sport=${s}` },
  // Daily is migrated to the shell — reuses the Quiz prototype layout via the DAILY session.
  { key: "daily", icon: Timer, color: "primary", to: (s) => `/v2/daily?sport=${s}` },
  // Live Match is parked: nothing in the product can create a live match any
  // more (the challenge subsystem and createFromChallenge were removed), so
  // the tile would advertise a dead end. /v2/live-match stays routable as a
  // viewer for legacy matches.
];

// General-knowledge quizzes share the football Quiz's server flow but pin the
// sport to "knowledge" (the same pool already backing Duels and Daily, ~548
// questions). Kept in a SEPARATE array from COMPETE_MODE_TILES so the
// football-only mode-grid contract stays exact — knowledge is its own labelled
// section on the landing, not a 10th football mode. The `to` builders ignore
// the carried sport (it's fixed to knowledge). "Which Came First" routes the
// `came_first` variant, which the server pins to its seeded intermediate pool
// regardless of the difficulty the picker hands it (quizSessions.getQuestion).
export const COMPETE_KNOWLEDGE_TILES: ModeTile[] = [
  { key: "knowledgeQuiz", icon: Lightbulb, color: "blue", to: () => `/difficulty?sport=knowledge&mode=quiz&target=v2` },
  { key: "cameFirst", icon: Clock, color: "primary", to: () => `/difficulty?sport=knowledge&mode=came_first&target=v2` },
];

// The ranked modes (finishing them moves ELO), in grid order. DERIVED from the
// `ranked` flag so ranked-ness stays declared in exactly one place — the Compete
// grid renders its RANKED section from this, and Ranks' "Play ranked" button
// reuses the first entry's own deep-link builder so the route can't drift.
export const RANKED_MODE_TILES: ModeTile[] = COMPETE_MODE_TILES.filter(
  (t) => t.ranked,
);
