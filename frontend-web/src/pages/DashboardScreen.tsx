import { NeoCard } from "@/components/neo/NeoCard";
import { NeoButton } from "@/components/neo/NeoButton";
import { BottomNav } from "@/components/neo/BottomNav";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

const sportMeta: Record<
  string,
  { emoji: string; color: "success" | "accent" | "primary" }
> = {
  football: { emoji: "\u26BD", color: "success" },
  tennis: { emoji: "\uD83C\uDFBE", color: "accent" },
  basketball: { emoji: "\uD83C\uDFC0", color: "primary" },
};

export default function DashboardScreen() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const userId = user?._id as Id<"users"> | undefined;
  const profile = useQuery(api.profile.get, userId ? { userId } : "skip");

  const isLoading = profile === undefined;
  const totalGames = profile?.stats.totalGames ?? 0;
  const favSport = profile?.stats.favoriteSport;
  const sports = Object.entries(sportMeta);

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="px-5 pt-6 space-y-6">
        <h1 className="text-2xl font-heading font-bold">Dashboard</h1>

        <div className="grid grid-cols-2 gap-3">
          <NeoCard color="primary" shadow="lg" className="text-center py-5">
            <p className="font-mono font-bold text-3xl">
              {isLoading ? "\u2014" : totalGames}
            </p>
            <p className="text-xs font-heading uppercase opacity-80 mt-1">
              Total Games
            </p>
          </NeoCard>
          <NeoCard color="blue" shadow="lg" className="text-center py-5">
            <p className="font-mono font-bold text-3xl">
              {isLoading ? "\u2014" : favSport || "\u2014"}
            </p>
            <p className="text-xs font-heading uppercase opacity-80 mt-1">
              Fav Sport
            </p>
          </NeoCard>
        </div>

        <div>
          <h3 className="font-heading font-bold text-lg mb-3">Sports</h3>
          <div className="space-y-3">
            {sports.map(([sport, meta]) => (
              <NeoCard key={sport}>
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-2xl">{meta.emoji}</span>
                  <p className="font-heading font-bold capitalize">{sport}</p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <NeoButton
                    variant="primary"
                    size="sm"
                    onClick={() =>
                      navigate(
                        `/quiz?sport=${sport}&difficulty=intermediate`,
                      )
                    }
                  >
                    Start Quiz
                  </NeoButton>
                  <NeoButton
                    variant="blue"
                    size="sm"
                    onClick={() => navigate(`/survival?sport=${sport}`)}
                  >
                    Start Survival
                  </NeoButton>
                </div>
              </NeoCard>
            ))}
          </div>
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
