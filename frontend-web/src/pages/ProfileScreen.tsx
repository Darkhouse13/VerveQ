import { NeoCard } from "@/components/neo/NeoCard";
import { NeoButton } from "@/components/neo/NeoButton";
import { NeoAvatar } from "@/components/neo/NeoAvatar";
import { NeoBadge } from "@/components/neo/NeoBadge";
import { BottomNav } from "@/components/neo/BottomNav";
import { Lock, Trophy, Zap, Target, Flame, Star, Calendar, UserPlus } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import type { Id } from "../../convex/_generated/dataModel";

const sportEmojis: Record<string, string> = {
  football: "\u26BD",
  tennis: "\uD83C\uDFBE",
  basketball: "\uD83C\uDFC0",
};

function getTier(elo: number) {
  if (elo >= 2000)
    return { name: "Platinum", color: "accent" as const, next: null, progress: 100 };
  if (elo >= 1500)
    return { name: "Gold", color: "primary" as const, next: "Platinum", progress: ((elo - 1500) / 500) * 100 };
  if (elo >= 1200)
    return { name: "Silver", color: "muted" as const, next: "Gold", progress: ((elo - 1200) / 300) * 100 };
  return { name: "Bronze", color: "muted" as const, next: "Silver", progress: (elo / 1200) * 100 };
}

export default function ProfileScreen() {
  const navigate = useNavigate();
  const { user, isGuest, logout } = useAuth();
  const userId = user?._id as Id<"users"> | undefined;

  const handleCreateAccount = async () => {
    await logout();
    navigate("/?mode=signup&from=guest");
  };

  const handleSignOut = async () => {
    await logout();
    navigate("/");
  };

  const profile = useQuery(api.profile.get, userId ? { userId } : "skip");
  const allAchievements = useQuery(api.achievements.list);
  const userAchs = useQuery(
    api.achievements.userAchievements,
    userId ? { userId } : "skip",
  );
  const seasonHistory = useQuery(
    api.seasonManager.getUserSeasonHistory,
    userId ? { userId } : "skip",
  );

  if (profile === undefined) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center pb-20">
        <p className="font-heading font-bold animate-pulse">
          Loading profile...
        </p>
        <BottomNav />
      </div>
    );
  }

  if (profile === null) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center pb-20">
        <p className="font-heading font-bold">No profile data</p>
        <BottomNav />
      </div>
    );
  }

  const elo = profile.eloRating;
  const tier = getTier(elo);
  const unlockedIds = new Set(
    (userAchs ?? []).map((a) => a.achievementId),
  );
  const displayAchievements = (allAchievements ?? []).map((a) => ({
    ...a,
    unlocked: unlockedIds.has(a.achievementId),
  }));
  const favSport = profile.stats.favoriteSport;

  const stats = [
    { label: "Total Games", value: String(profile.stats.totalGames), icon: Zap, color: "primary" as const },
    { label: "Win Rate", value: `${Math.round(profile.stats.winRate)}%`, icon: Target, color: "success" as const },
    { label: "Best Streak", value: String(profile.stats.bestStreak), icon: Flame, color: "accent" as const },
    { label: "Fav Sport", value: favSport ? (sportEmojis[favSport] || favSport) : "\u2014", icon: Star, color: "blue" as const },
  ];

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="px-5 pt-8 space-y-6">
        <div className="flex flex-col items-center text-center">
          <NeoAvatar
            name={profile.displayName || profile.username}
            size="xl"
          />
          <h2 className="font-heading font-bold text-2xl mt-3">
            {profile.displayName || profile.username}
          </h2>
          <p className="text-xs text-muted-foreground">
            Member since{" "}
            {new Date(profile.createdAt).toLocaleDateString("en-US", {
              month: "short",
              year: "numeric",
            })}
          </p>
        </div>

        <NeoCard shadow="lg" className="text-center py-6">
          <p className="font-mono font-bold text-5xl">
            {elo.toLocaleString()}
          </p>
          <p className="text-sm text-muted-foreground font-heading mt-1">
            Current ELO
          </p>
          <div className="flex justify-center mt-3">
            <NeoBadge color={tier.color} rotated size="md">
              {tier.name} Tier
            </NeoBadge>
          </div>
          {tier.next && (
            <div className="mt-4 mx-8">
              <div className="neo-border rounded-full h-3 bg-muted overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full"
                  style={{
                    width: `${Math.min(tier.progress, 100)}%`,
                  }}
                />
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">
                Progress to {tier.next}
              </p>
            </div>
          )}
        </NeoCard>

        <div className="grid grid-cols-2 gap-2.5">
          {stats.map((s) => (
            <NeoCard
              key={s.label}
              color={s.color}
              className="text-center py-3"
            >
              <s.icon
                size={18}
                strokeWidth={2.5}
                className="mx-auto mb-1"
              />
              <p className="font-mono font-bold text-lg">{s.value}</p>
              <p className="text-[10px] font-heading uppercase opacity-80">
                {s.label}
              </p>
            </NeoCard>
          ))}
        </div>

        {displayAchievements.length > 0 && (
          <div>
            <h3 className="font-heading font-bold text-lg mb-3">
              Achievements
            </h3>
            <div className="grid grid-cols-3 gap-2">
              {displayAchievements.slice(0, 6).map((a) => (
                <div
                  key={a.achievementId}
                  className={`neo-border rounded-lg p-3 text-center transition-all ${a.unlocked ? "neo-shadow rotate-[-1deg] bg-card" : "border-dashed bg-muted opacity-50"}`}
                >
                  {a.unlocked ? (
                    <Trophy
                      size={20}
                      strokeWidth={2.5}
                      className="mx-auto mb-1 text-primary"
                    />
                  ) : (
                    <Lock
                      size={20}
                      strokeWidth={2.5}
                      className="mx-auto mb-1 text-muted-foreground"
                    />
                  )}
                  <p className="text-[10px] font-heading font-bold">
                    {a.name}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {profile.recentGames.length > 0 && (
          <div>
            <h3 className="font-heading font-bold text-lg mb-3">
              Recent Games
            </h3>
            <div className="space-y-2">
              {profile.recentGames.map((g) => (
                <NeoCard
                  key={g.id}
                  className="flex items-center gap-3 py-3"
                >
                  <span className="text-2xl">
                    {sportEmojis[g.sport] || "\uD83C\uDFC6"}
                  </span>
                  <div className="flex-1">
                    <p className="font-heading font-bold text-sm capitalize">
                      {g.sessionType === "decay"
                        ? "Decay"
                        : g.sessionType === "seasonReset"
                          ? "Season Reset"
                          : g.gameMode}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(g.playedAt).toLocaleDateString()}
                    </p>
                  </div>
                  {g.sessionType === "decay" && (
                    <NeoBadge color="destructive" rotated>DECAY</NeoBadge>
                  )}
                  {g.sessionType === "seasonReset" && (
                    <NeoBadge color="blue" rotated>RESET</NeoBadge>
                  )}
                  <p className="font-mono font-bold text-sm">{g.score}</p>
                  <p
                    className={`font-mono font-bold text-sm ${g.eloChange >= 0 ? "text-success" : "text-destructive"}`}
                  >
                    {g.eloChange >= 0 ? "+" : ""}
                    {Math.round(g.eloChange)}
                  </p>
                </NeoCard>
              ))}
            </div>
          </div>
        )}

        {(seasonHistory ?? []).length > 0 && (
          <div>
            <h3 className="font-heading font-bold text-lg mb-3">
              Past Seasons
            </h3>
            <div className="space-y-2">
              {(seasonHistory ?? []).map((s) => (
                <NeoCard
                  key={`${s.seasonNumber}-${s.sport}-${s.mode}`}
                  className="flex items-center gap-3 py-3"
                >
                  <Calendar size={20} strokeWidth={2.5} className="text-muted-foreground shrink-0" />
                  <div className="flex-1">
                    <p className="font-heading font-bold text-sm">
                      Season {s.seasonNumber}
                    </p>
                    <p className="text-xs text-muted-foreground capitalize">
                      {s.sport} · {s.mode}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono font-bold text-sm">{s.finalElo} ELO</p>
                    <p className="text-xs text-muted-foreground">Rank #{s.rank}</p>
                  </div>
                  <NeoBadge color={
                    s.tier === "Platinum" ? "accent" :
                    s.tier === "Gold" ? "primary" : "muted"
                  } rotated>
                    {s.tier}
                  </NeoBadge>
                </NeoCard>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <NeoButton
            variant="secondary"
            size="md"
            onClick={() => toast.info("Coming soon!")}
          >
            Edit Profile
          </NeoButton>
          <NeoButton
            variant="primary"
            size="md"
            onClick={() => {
              navigator.clipboard.writeText(window.location.href);
              toast.success("Profile link copied!");
            }}
          >
            Share Profile
          </NeoButton>
        </div>

        {isGuest && (
          <NeoCard
            data-testid="guest-upgrade-cta"
            color="primary"
            shadow="lg"
            className="text-center py-5"
          >
            <UserPlus size={24} strokeWidth={2.5} className="mx-auto mb-2" />
            <p className="font-heading font-bold text-lg">
              Create an account
            </p>
            <p className="text-xs opacity-90 mt-1 px-3">
              Save your ELO, achievements, and compete on the leaderboard.
            </p>
            <NeoButton
              variant="secondary"
              size="md"
              className="mt-4"
              onClick={handleCreateAccount}
            >
              Create Account
            </NeoButton>
          </NeoCard>
        )}

        <div className="pb-4">
          <NeoButton
            variant="ghost"
            size="full"
            onClick={handleSignOut}
          >
            Sign Out
          </NeoButton>
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
