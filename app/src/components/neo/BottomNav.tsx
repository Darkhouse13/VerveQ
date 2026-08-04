import { cn } from "@/lib/utils";
import { Home, Trophy, Swords, User } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useAuth } from "@/contexts/AuthContext";

const tabs = [
  { path: "/home", label: "Home", icon: Home },
  { path: "/leaderboard", label: "Ranks", icon: Trophy },
  { path: "/challenge", label: "Challenge", icon: Swords },
  { path: "/profile", label: "Profile", icon: User },
];

export function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, isGuest } = useAuth();
  const unread = useQuery(
    api.notifications.unreadCount,
    isAuthenticated && !isGuest ? {} : "skip",
  );
  const badge = unread?.count ?? 0;

  return (
    // Same near-black treatment as the v2 ShellNav, kept in step so the
    // rollback seam doesn't hand back a cream bar. See ShellNav for why the
    // surface changed and why the inset absorbs rather than stacks.
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t-[3px] border-background/40 bg-foreground pb-[max(0.625rem,env(safe-area-inset-bottom))]">
      <div className="flex max-w-md mx-auto">
        {tabs.map((tab) => {
          const active = location.pathname === tab.path;
          const showBadge = tab.path === "/challenge" && badge > 0;
          return (
            <button
              key={tab.path}
              onClick={() => navigate(tab.path)}
              className={cn(
                "flex-1 flex flex-col items-center gap-0.5 pt-2.5 transition-colors relative cursor-pointer",
                active ? "text-accent" : "text-background/60"
              )}
            >
              {active && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-[3px] bg-accent rounded-b-full" />
              )}
              <div className="relative">
                <tab.icon size={22} strokeWidth={2.5} />
                {showBadge && (
                  <span className="absolute -top-1.5 -right-2.5 neo-border bg-destructive text-destructive-foreground text-[9px] font-heading font-bold rounded-full min-w-[16px] h-[16px] px-1 flex items-center justify-center leading-none">
                    {badge > 9 ? "9+" : badge}
                  </span>
                )}
              </div>
              <span className="text-[10px] font-heading font-bold uppercase">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
