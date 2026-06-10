import {
  Brain, Heart, Zap, TrendingUp, Grid3X3, HelpCircle, Timer, Radio, Swords, Users,
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
  { key: "quiz", icon: Brain, color: "accent", to: (s) => `/difficulty?sport=${s}&mode=quiz&target=v2` },
  // Arena + Duels route through the Challenge hub (create/join) embedded in the
  // shell (v2 nav retained). They were the category step's tiles; with that step
  // collapsed they live on the grid so neither path is lost.
  { key: "arena", icon: Swords, color: "pink", to: () => SHELL_ROUTES.arena },
  { key: "duel", icon: Users, color: "yellow", to: () => SHELL_ROUTES.duels },
  // Survival + Blitz are migrated to the shell prototype layout (solo).
  { key: "survival", icon: Heart, color: "primary", to: (s) => `/v2/survival?sport=${s}` },
  { key: "blitz", icon: Zap, color: "pink", to: (s) => `/v2/blitz?sport=${s}` },
  // Higher/Lower + Who Am I are migrated to the shell prototype layout (solo).
  { key: "higherLower", icon: TrendingUp, color: "success", to: (s) => `/v2/higher-lower?sport=${s}` },
  // VerveGrid is migrated to the bespoke v2 GridStage (solo) over the existing backend.
  { key: "verveGrid", icon: Grid3X3, color: "blue", to: (s) => `/v2/verve-grid?sport=${s}` },
  { key: "whoAmI", icon: HelpCircle, color: "yellow", to: (s) => `/v2/who-am-i?sport=${s}` },
  // Daily is migrated to the shell — reuses the Quiz prototype layout via the DAILY session.
  { key: "daily", icon: Timer, color: "primary", to: (s) => `/v2/daily?sport=${s}` },
  // Live Match (1v1 realtime) is migrated to the shell prototype layout (Arena
  // pattern) over the existing backend. The screen resolves the active match
  // (created via the untouched Challenge matchmaking flow) or guides there.
  { key: "liveMatch", icon: Radio, color: "blue", to: () => `/v2/live-match` },
];
