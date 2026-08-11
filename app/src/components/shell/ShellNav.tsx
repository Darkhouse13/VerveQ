import { cn } from "@/lib/utils";
import { Home, Swords, Trophy, User } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { SHELL_ROUTES } from "@/lib/shellRoutes";

interface NavTab {
  path: string;
  /** Matches the active state for nested routes (e.g. /compete/*). */
  match: string;
  labelKey: string;
  icon: LucideIcon;
}

const TABS: NavTab[] = [
  { path: SHELL_ROUTES.home, match: SHELL_ROUTES.home, labelKey: "nav.home", icon: Home },
  { path: SHELL_ROUTES.compete, match: "/compete", labelKey: "nav.compete", icon: Swords },
  { path: SHELL_ROUTES.ranks, match: SHELL_ROUTES.ranks, labelKey: "nav.ranks", icon: Trophy },
  { path: SHELL_ROUTES.profile, match: SHELL_ROUTES.profile, labelKey: "nav.profile", icon: User },
];

function useTabs() {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  // The router's v7_startTransition keeps the OLD screen painted while the
  // next route's chunk loads, so location.pathname (and with it the active
  // highlight) lags the tap by the whole chunk fetch. pendingPath moves the
  // highlight the instant the tab is pressed — the tap is acknowledged even
  // when the screen swap takes a while.
  const [pendingPath, setPendingPath] = useState<string | null>(null);
  useEffect(() => {
    setPendingPath(null);
  }, [location.pathname]);

  const isCurrent = (tab: NavTab) =>
    tab.match === SHELL_ROUTES.home
      ? location.pathname === SHELL_ROUTES.home
      : location.pathname === tab.match ||
        location.pathname.startsWith(tab.match + "/");
  const isActive = (tab: NavTab) =>
    pendingPath !== null ? tab.path === pendingPath : isCurrent(tab);
  const go = (tab: NavTab) => {
    if (!isCurrent(tab)) setPendingPath(tab.path);
    navigate(tab.path);
  };
  return { t, tabs: TABS, isActive, go };
}

/**
 * Mobile bottom bar — shell-only routes. An in-flow row at the foot of
 * ShellLayout's fixed column (not position:fixed), so `main` gets exactly the
 * remaining height and the page never scrolls.
 */
export function ShellNav() {
  const { t, tabs, isActive, go } = useTabs();

  return (
    // App-wide chrome, one surface everywhere (FW-POLISH-2 R3): the bar is
    // LITERAL near-black, not a theme token. It used to be bg-foreground +
    // text-background, which flip inside `.theme-weekend` (foreground=cream) —
    // rendering the nav as a cream slab on the dark WEEKEND canvas — and its
    // light border-t (background/40) read as a floating halo over every page.
    // Dark nav on cream screens is intended; the halo and the flip are not,
    // so the surface, tints and accent are pinned and the border is gone —
    // the nav sits flush on whatever canvas is behind it.
    //
    // The bottom inset ABSORBS the row's own 10px rather than stacking on it
    // (the buttons below drop to pt-2.5 and this carries their bottom
    // padding), so a notched device gets 34px under the labels instead of 44.
    // max() keeps the normal-tab case at exactly the 10px it has today.
    <nav className="md:hidden shrink-0 bg-[hsl(0_0%_7%)] pb-[max(0.625rem,env(safe-area-inset-bottom))]">
      <div className="flex max-w-md mx-auto">
        {tabs.map((tab) => {
          const active = isActive(tab);
          return (
            <button
              key={tab.path}
              onClick={() => go(tab)}
              className={cn(
                "flex-1 flex flex-col items-center gap-0.5 pt-2.5 transition-colors relative cursor-pointer active:opacity-60",
                // On near-black: lime for the active tab (the brand accent —
                // the orange primary muddies against this surface), and the
                // established muted-cream-on-dark tint for the rest. Literal
                // values for the same reason as the surface above.
                active
                  ? "text-[hsl(75_100%_55%)]"
                  : "text-[hsl(30_100%_97%/0.6)]",
              )}
            >
              {active && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-[3px] bg-[hsl(75_100%_55%)] rounded-b-full" />
              )}
              <tab.icon size={22} strokeWidth={2.5} />
              <span className="text-[10px] font-heading font-bold uppercase">
                {t(tab.labelKey)}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

/** Desktop top strip — fixed-height row that keeps the viewport never-scroll. */
export function ShellTopNav() {
  const navigate = useNavigate();
  const { t, tabs, isActive, go } = useTabs();

  return (
    <nav className="hidden md:block shrink-0 border-b-[3px] border-border bg-background">
      <div className="mx-auto w-full max-w-6xl flex items-center gap-2 px-8 py-3">
        <button
          onClick={() => navigate(SHELL_ROUTES.home)}
          className="font-heading font-bold text-lg tracking-tight mr-4 cursor-pointer"
        >
          VerveQ
        </button>
        <div className="flex items-center gap-1">
          {tabs.map((tab) => {
            const active = isActive(tab);
            return (
              <button
                key={tab.path}
                onClick={() => go(tab)}
                className={cn(
                  "inline-flex items-center gap-2 px-4 py-2 rounded-lg font-heading font-bold text-sm uppercase tracking-wide transition-all cursor-pointer active:opacity-60",
                  active
                    ? "neo-border neo-shadow bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted",
                )}
              >
                <tab.icon size={18} strokeWidth={2.5} />
                {t(tab.labelKey)}
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
