import { cn } from "@/lib/utils";
import { Home, Swords, Trophy, User } from "lucide-react";
import type { LucideIcon } from "lucide-react";
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
  { path: "/profile", match: "/profile", labelKey: "nav.profile", icon: User },
];

function useTabs() {
  const { t } = useTranslation();
  const location = useLocation();
  const isActive = (tab: NavTab) =>
    tab.match === SHELL_ROUTES.home
      ? location.pathname === SHELL_ROUTES.home
      : location.pathname === tab.match ||
        location.pathname.startsWith(tab.match + "/");
  return { t, tabs: TABS, isActive };
}

/** Mobile bottom bar — mirrors the existing BottomNav idiom, shell-only routes. */
export function ShellNav() {
  const navigate = useNavigate();
  const { t, tabs, isActive } = useTabs();

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 border-t-[3px] border-border bg-background">
      <div className="flex max-w-md mx-auto">
        {tabs.map((tab) => {
          const active = isActive(tab);
          return (
            <button
              key={tab.path}
              onClick={() => navigate(tab.path)}
              className={cn(
                "flex-1 flex flex-col items-center gap-0.5 py-2.5 transition-colors relative cursor-pointer",
                active ? "text-primary" : "text-muted-foreground",
              )}
            >
              {active && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-[3px] bg-primary rounded-b-full" />
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
  const { t, tabs, isActive } = useTabs();

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
                onClick={() => navigate(tab.path)}
                className={cn(
                  "inline-flex items-center gap-2 px-4 py-2 rounded-lg font-heading font-bold text-sm uppercase tracking-wide transition-all cursor-pointer",
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
