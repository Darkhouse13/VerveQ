import { CalendarRange, Gamepad2, Trophy, User } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { SHELL_ROUTES } from "@/lib/shellRoutes";

export type ShellTabKey = "play" | "weekend" | "ranks" | "profile";

export interface ShellTab {
  key: ShellTabKey;
  path: string;
  /**
   * Paths that light the tab: an exact match, or a prefix match on `/…/`
   * (so the Weekend tab stays lit across the hub's sub-screens).
   */
  match: string[];
  /** Exact matches only (Play lights on `/home` itself, not its hash targets' sub-paths). */
  exact?: boolean;
  labelKey: string;
  icon: LucideIcon;
}

/**
 * The four tabs (VerveQ ONE decision 10): Play · Weekend · Ranks · Profile.
 *
 * Play replaced BOTH Home and Compete (12 of Compete's 15 entries duplicated
 * Home). THE WEEKEND has its own tab — its hub is the mode's front door, and
 * the Play card that used to lead to it is gone. Ranks is one screen with a
 * Ladder | Leaderboard segment, so both of its URLs light the one tab.
 */
export const SHELL_TABS: readonly ShellTab[] = [
  { key: "play", path: SHELL_ROUTES.play, match: [SHELL_ROUTES.play], exact: true, labelKey: "nav.play", icon: Gamepad2 },
  { key: "weekend", path: SHELL_ROUTES.weekend, match: [SHELL_ROUTES.weekend], labelKey: "nav.weekend", icon: CalendarRange },
  { key: "ranks", path: SHELL_ROUTES.ranks, match: [SHELL_ROUTES.ranks, SHELL_ROUTES.leaderboard], labelKey: "nav.ranks", icon: Trophy },
  { key: "profile", path: SHELL_ROUTES.profile, match: [SHELL_ROUTES.profile], labelKey: "nav.profile", icon: User },
];

/** The tab a pathname belongs to, or undefined (a non-tab shell screen). */
export function activeTabKey(pathname: string): ShellTabKey | undefined {
  return SHELL_TABS.find((tab) =>
    tab.match.some((m) =>
      tab.exact ? pathname === m : pathname === m || pathname.startsWith(m + "/"),
    ),
  )?.key;
}
