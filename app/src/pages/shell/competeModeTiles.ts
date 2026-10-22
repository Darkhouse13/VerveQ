import {
  Brain, Heart, Zap, TrendingUp, Grid3X3, Route, Timer, Swords, Users,
  Lightbulb, Clock, CalendarHeart, Hourglass, Type,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { SHELL_ROUTES } from "@/lib/shellRoutes";
import type { ModeAccent } from "@/components/ui/mode-tile";

export interface ModeTile {
  key: string;
  icon: LucideIcon;
  /** The mode's accent (decision 12) — the same color on every surface. */
  color: ModeAccent;
  /** Builds the EXISTING, proven deep link for the chosen sport. */
  to: (sport: string) => string;
  /**
   * Whether finishing this mode moves the player's ELO — the SINGLE source of
   * truth for the "Ranked" chip on Play's More games tiles (the screen derives
   * the chip from this flag, never a hardcoded key list). Set on a mode iff its
   * server finalizer writes `userRatings`.
   *
   * The test is "does it write ELO", NOT "is its ladder surfaced yet" (CR-1
   * owner ruling). Survival writes ELO, so it is ranked: filing it under the
   * casual section put it beneath a "these don't affect your rank" sub-line
   * that was simply false. An unsurfaced ladder is a gap in Ranks, not a
   * licence to mislabel the mode.
   */
  ranked?: boolean;
}

// The mode catalogue behind the PLAY tab (ShellHomeScreen; decision 10 merged
// Home and the Compete grid into it — the file keeps its historical name).
// Lives in its own module so the routing contracts can assert tile targets and
// Play's section membership without rendering the screen.
//
// These targets are exactly what the existing sport-select produces for a sport,
// so the grid skips the redundant sport re-pick and lands directly in each mode.
export const COMPETE_MODE_TILES: ModeTile[] = [
  // Quiz is migrated to the v2 shell's centered-column "prototype layout". It
  // routes through the existing difficulty picker (target=v2) so the player
  // chooses a difficulty rather than defaulting to intermediate.
  { key: "quiz", icon: Brain, color: "orange", ranked: true, to: (s) => `/difficulty?sport=${s}&mode=quiz&target=v2` },
  // Arena and Duels are DISTINCT flows: Arena is the group-challenge-room
  // experience (create/join a room by code — its own shell hub), Duels is
  // head-to-head send-a-link via the Challenge hub embedded in the shell.
  { key: "arena", icon: Swords, color: "pink", to: () => SHELL_ROUTES.arena },
  { key: "duel", icon: Users, color: "pink", to: () => SHELL_ROUTES.duels },
  // Survival + Blitz are migrated to the shell prototype layout (solo).
  // Survival is RANKED: its finalizer (convex/games.ts `completeSurvival`)
  // asserts ranked eligibility and writes `userRatings` with mode "survival",
  // and its route is `FullAccountRoute` like Quiz's — the two ranked modes gate
  // identically. Daily Survival is explicitly exempt server-side (games.ts:198-202
  // rejects `dailyDate` runs), which is why that tile belongs in TODAY, not here.
  { key: "survival", icon: Heart, color: "orange", ranked: true, to: (s) => `/survival?sport=${s}` },
  { key: "blitz", icon: Zap, color: "yellow", to: (s) => `/blitz?sport=${s}` },
  // Higher/Lower + VerveGrid launch DIRECTLY, like Career Path. They used to
  // route via the shared difficulty picker, which cost a cold visitor an extra
  // screen before the mode and — while that picker was still gated — dropped
  // them on "/" with no explanation (FR-0 Part 2.2). Both play screens already
  // self-manage the tier: `parseDifficulty(null)` defaults to easy
  // (lib/difficulty.ts), which is the tier the picker's own default led with.
  // The picker stays reachable at /difficulty for the modes that still use it.
  { key: "higherLower", icon: TrendingUp, color: "blue", to: (s) => `/higher-lower?sport=${s}` },
  { key: "verveGrid", icon: Grid3X3, color: "orange", to: (s) => `/verve-grid?sport=${s}` },
  { key: "careerPath", icon: Route, color: "orange", to: (s) => `/career-path?sport=${s}` },
  // Daily is migrated to the shell — reuses the Quiz prototype layout via the DAILY session.
  { key: "daily", icon: Timer, color: "yellow", to: (s) => `/daily?sport=${s}` },
  // Daily Survival: the shared one-attempt run on the Reveal Ladder engine.
  // Football-only by design, so the builder ignores the carried sport.
  { key: "dailySurvival", icon: CalendarHeart, color: "yellow", to: () => SHELL_ROUTES.dailySurvival },
  // Who's Older? — the reel format as a daily (ten shared pairs), then
  // endless. Football-only; the builder ignores the carried sport.
  { key: "whosOlder", icon: Hourglass, color: "blue", to: () => SHELL_ROUTES.whosOlderPlay },
  // Missing Letters — the reel the feed runs three times a day, as a daily
  // (ten shared boards) then endless. Football-only.
  { key: "missingLetters", icon: Type, color: "pink", to: () => SHELL_ROUTES.missingLettersPlay },
  // Live Match is parked: nothing in the product can create a live match any
  // more (the challenge subsystem and createFromChallenge were removed), so
  // the tile would advertise a dead end. /live-match stays routable as a
  // viewer for legacy matches.
];

// General-knowledge quizzes share the football Quiz's server flow but pin the
// sport to "knowledge" (the same pool already backing Duels and Daily, ~548
// questions). Kept in a SEPARATE array from COMPETE_MODE_TILES so the
// football-only mode-grid contract stays exact — knowledge is its own labelled
// section on the landing, not a 10th football mode. On Play they close the
// More games list. The `to` builders ignore
// the carried sport (it's fixed to knowledge). "Which Came First" routes the
// `came_first` variant, which the server pins to its seeded intermediate pool
// regardless of the difficulty the picker hands it (quizSessions.getQuestion).
export const COMPETE_KNOWLEDGE_TILES: ModeTile[] = [
  { key: "knowledgeQuiz", icon: Lightbulb, color: "blue", to: () => `/difficulty?sport=knowledge&mode=quiz&target=v2` },
  { key: "cameFirst", icon: Clock, color: "yellow", to: () => `/difficulty?sport=knowledge&mode=came_first&target=v2` },
];

// ── PLAY's sections (decision 10) ─────────────────────────────────────────
//
// Play replaced BOTH Home and Compete: 12 of Compete's 15 entries duplicated
// Home. One surface, four sections, in this order:
//
//   TODAY      the dailies — the reel visitor's next game (owner decision 10:
//              Today leads for everyone). THE DRAW joins as its own card when
//              its gates allow (components/draw/HomeDrawCard).
//   FEATURED   Career Path — the most-played mode (73 people in 45 days).
//   FRIENDS    Duels + Arena as ONE "Challenge a friend" entry: send a link
//              (Duels) or open a live room (Arena).
//   MORE GAMES collapsed by default: everything else, Quiz and Survival with a
//              "Ranked" chip (from the `ranked` flag). Blitz and Higher or
//              Lower live here now (decision 11) — their routes stay, SEO
//              pages link them.
//
// Every live mode sits in exactly one section (playSectionsContract).
export const PLAY_TODAY_KEYS = ["whosOlder", "missingLetters", "daily", "dailySurvival"] as const;
export const PLAY_FEATURED_KEYS = ["careerPath"] as const;
export const PLAY_FRIEND_KEYS = ["duel", "arena"] as const;
export const PLAY_MORE_KEYS = ["quiz", "survival", "verveGrid", "higherLower", "blitz"] as const;

/** The tiles for a key list, in the list's order (unknown keys dropped). */
export function tilesByKeys(keys: readonly string[], from: ModeTile[] = COMPETE_MODE_TILES): ModeTile[] {
  return keys
    .map((k) => from.find((t) => t.key === k))
    .filter((t): t is ModeTile => !!t);
}

// The ranked modes (finishing them moves ELO), in catalogue order. DERIVED from the
// `ranked` flag so ranked-ness stays declared in exactly one place — Ranks'
// "Play ranked" button reuses the first entry's own deep-link builder so the
// route can't drift.
export const RANKED_MODE_TILES: ModeTile[] = COMPETE_MODE_TILES.filter(
  (t) => t.ranked,
);
