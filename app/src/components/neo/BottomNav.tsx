import { cn } from "@/lib/utils";
import { Home, Trophy, Swords, User } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

const tabs = [
  { path: "/home", label: "Home", icon: Home },
  { path: "/leaderboard", label: "Ranks", icon: Trophy },
  { path: "/challenge", label: "Challenge", icon: Swords },
  { path: "/profile", label: "Profile", icon: User },
];

export function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t-[3px] border-border bg-background">
      <div className="flex max-w-md mx-auto">
        {tabs.map((tab) => {
          const active = location.pathname === tab.path;
          return (
            <button
              key={tab.path}
              onClick={() => navigate(tab.path)}
              className={cn(
                "flex-1 flex flex-col items-center gap-0.5 py-2.5 transition-colors relative cursor-pointer",
                active ? "text-primary" : "text-muted-foreground"
              )}
            >
              {active && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-[3px] bg-primary rounded-b-full" />
              )}
              <tab.icon size={22} strokeWidth={2.5} />
              <span className="text-[10px] font-heading font-bold uppercase">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
