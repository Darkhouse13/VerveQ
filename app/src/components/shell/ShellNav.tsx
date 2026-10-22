import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { SHELL_ROUTES } from "@/lib/shellRoutes";
import { BrandMark } from "@/components/ui/BrandMark";
import { Button } from "@/components/ui/button";
import { track } from "@/lib/analytics";
import { readColdSource } from "@/lib/coldSession";
import { SHELL_TABS, activeTabKey, type ShellTab } from "@/lib/shellTabs";

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

  const isCurrent = (tab: ShellTab) => activeTabKey(location.pathname) === tab.key;
  const isActive = (tab: ShellTab) =>
    pendingPath !== null ? tab.path === pendingPath : isCurrent(tab);
  const go = (tab: ShellTab) => {
    if (!isCurrent(tab)) {
      setPendingPath(tab.path);
      // The Weekend tab is the mode's entry point now that Play carries no
      // Weekend card, so it reports the same funnel event the card did (a
      // real tap, per ANALYTICS.md), with its own placement.
      if (tab.key === "weekend") {
        track("weekend_entry_clicked", {
          source: readColdSource() ?? "nav_tab",
          placement: "nav_tab",
        });
      }
    }
    navigate(tab.path);
  };
  return { t, tabs: SHELL_TABS, isActive, go };
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
    // the brand-constant ink (--ink never changes per theme), not a role token. It used to be bg-foreground +
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
    <nav className="md:hidden shrink-0 bg-ink pb-[max(0.625rem,env(safe-area-inset-bottom))]">
      <div className="flex max-w-md mx-auto">
        {tabs.map((tab) => {
          const active = isActive(tab);
          return (
            <Button
              key={tab.path}
              variant="ghost"
              onClick={() => go(tab)}
              className={cn(
                "relative flex-1 flex-col gap-0.5 min-h-0 rounded-none border-0 px-0 pt-2.5 pb-0 transition-colors hover:bg-transparent active:is-dimmed",
                // On near-black: lime for the active tab (the brand accent —
                // the orange primary muddies against this surface), and the
                // established muted-cream-on-dark tint for the rest. Brand
                // constants for the same reason as the surface above.
                active
                  ? "text-lime"
                  : "text-cream/60",
              )}
            >
              {active && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-[3px] bg-lime rounded-b-full" />
              )}
              <tab.icon size={22} strokeWidth={2.5} />
              {/* 12px: the floor for any text (design floors); 10px failed it. */}
              <span className="text-eyebrow tracking-normal font-heading font-bold uppercase">
                {t(tab.labelKey)}
              </span>
            </Button>
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
        <Button
          variant="ghost"
          onClick={() => navigate(SHELL_ROUTES.play)}
          className="mr-4 min-h-0 border-0 p-0 hover:bg-transparent"
        >
          <BrandMark variant="lockup" size="md" />
        </Button>
        <div className="flex items-center gap-1">
          {tabs.map((tab) => {
            const active = isActive(tab);
            return (
              <Button
                key={tab.path}
                variant="ghost"
                onClick={() => go(tab)}
                className={cn(
                  "min-h-0 px-4 py-2 uppercase tracking-wide active:is-dimmed",
                  active
                    ? // A raised tab with lime words, like the mobile bar's
                      // lime label: a lime FILL here would compete with the
                      // screen's one action (R4).
                      "neo-border neo-shadow bg-card text-lime hover:bg-card"
                    : "text-muted-foreground",
                )}
              >
                <tab.icon size={18} strokeWidth={2.5} />
                {t(tab.labelKey)}
              </Button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
