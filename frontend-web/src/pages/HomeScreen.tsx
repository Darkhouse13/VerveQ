import { NeoCard } from "@/components/neo/NeoCard";
import { NeoButton } from "@/components/neo/NeoButton";
import { NeoBadge } from "@/components/neo/NeoBadge";
import { NeoAvatar } from "@/components/neo/NeoAvatar";
import { BottomNav } from "@/components/neo/BottomNav";
import { useNavigate } from "react-router-dom";
import { Timer, Heart, Zap, Brain, Flame, Target, Trophy, Hammer, TrendingUp, Grid3X3, HelpCircle } from "lucide-react";
import { DailyBanner } from "@/components/DailyBanner";
import { SeasonBanner } from "@/components/SeasonBanner";
import { DecayWarningBanner } from "@/components/DecayWarningBanner";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

export default function HomeScreen() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const userId = user?._id as Id<"users"> | undefined;

  const profile = useQuery(api.profile.get, userId ? { userId } : "skip");
  const userAchs = useQuery(
    api.achievements.userAchievements,
    userId ? { userId } : "skip",
  );

  const displayName = user?.displayName || "Player";
  const streak = profile?.stats.currentStreak ?? 0;
  const bestStreak = profile?.stats.bestStreak ?? 0;
  const totalGames = profile?.stats.totalGames ?? 0;

  const badgeColors = ["primary", "accent", "blue", "pink"] as const;
  const recentAchievements = (userAchs ?? []).slice(0, 4);

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="flex items-center justify-between px-5 pt-5 pb-3">
        <div className="flex items-center gap-3">
          <NeoAvatar name={displayName} size="md" />
          <div>
            <p className="font-heading font-bold text-sm">
              Hey, {displayName}!
            </p>
            <p className="text-xs text-muted-foreground">Ready to compete?</p>
          </div>
        </div>
      </div>

      <div className="px-5 space-y-5">
        <DailyBanner />
        <SeasonBanner />
        <DecayWarningBanner />

        <div className="grid grid-cols-3 gap-2.5">
          <NeoCard color="primary" className="text-center py-3 px-2">
            <Flame size={18} strokeWidth={2.5} className="mx-auto mb-1" />
            <p className="font-mono font-bold text-lg">{streak}</p>
            <p className="text-[10px] uppercase font-heading opacity-80">
              Streak
            </p>
          </NeoCard>
          <NeoCard color="success" className="text-center py-3 px-2">
            <Target size={18} strokeWidth={2.5} className="mx-auto mb-1" />
            <p className="font-mono font-bold text-lg">{bestStreak}</p>
            <p className="text-[10px] uppercase font-heading opacity-80">
              Best
            </p>
          </NeoCard>
          <NeoCard color="blue" className="text-center py-3 px-2">
            <Zap size={18} strokeWidth={2.5} className="mx-auto mb-1" />
            <p className="font-mono font-bold text-lg">{totalGames}</p>
            <p className="text-[10px] uppercase font-heading opacity-80">
              Plays
            </p>
          </NeoCard>
        </div>

        <div>
          <h3 className="font-heading font-bold text-lg mb-3">
            Today's Challenges
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <NeoCard
              color="primary"
              className="cursor-pointer"
              onClick={() => navigate("/sport-select?mode=quiz")}
            >
              <Timer size={24} strokeWidth={2.5} className="mb-2" />
              <p className="font-heading font-bold text-sm">Daily Quiz</p>
              <p className="text-xs opacity-80 mt-0.5">10 Questions</p>
            </NeoCard>
            <NeoCard
              color="accent"
              className="cursor-pointer"
              onClick={() => navigate("/sport-select?mode=survival")}
            >
              <Heart size={24} strokeWidth={2.5} className="mb-2" />
              <p className="font-heading font-bold text-sm">
                Survival Sprint
              </p>
              <p className="text-xs opacity-80 mt-0.5">Beat your record</p>
            </NeoCard>
          </div>
        </div>

        <div>
          <h3 className="font-heading font-bold text-lg mb-3">Play</h3>
          <div className="space-y-3">
            <NeoCard
              shadow="lg"
              className="flex items-center gap-4 cursor-pointer bg-accent text-accent-foreground"
              onClick={() => navigate("/sport-select?mode=quiz")}
            >
              <div className="neo-border rounded-xl bg-background p-3">
                <Brain
                  size={28}
                  strokeWidth={2.5}
                  className="text-foreground"
                />
              </div>
              <div className="flex-1">
                <p className="font-heading font-bold text-lg">Quiz Mode</p>
                <p className="text-xs opacity-80">Test your knowledge</p>
              </div>
              <NeoButton variant="primary" size="sm">
                Play
              </NeoButton>
            </NeoCard>
            <NeoCard
              shadow="lg"
              className="flex items-center gap-4 cursor-pointer bg-electric-blue text-electric-blue-foreground"
              onClick={() => navigate("/sport-select?mode=survival")}
            >
              <div className="neo-border rounded-xl bg-background p-3">
                <Trophy
                  size={28}
                  strokeWidth={2.5}
                  className="text-foreground"
                />
              </div>
              <div className="flex-1">
                <p className="font-heading font-bold text-lg">
                  Survival Mode
                </p>
                <p className="text-xs opacity-80">
                  Guess players by initials
                </p>
              </div>
              <NeoButton variant="primary" size="sm">
                Play
              </NeoButton>
            </NeoCard>
            <NeoCard
              shadow="lg"
              className="flex items-center gap-4 cursor-pointer bg-hot-pink text-hot-pink-foreground"
              onClick={() => navigate("/sport-select?mode=blitz")}
            >
              <div className="neo-border rounded-xl bg-background p-3">
                <Zap
                  size={28}
                  strokeWidth={2.5}
                  className="text-foreground"
                />
              </div>
              <div className="flex-1">
                <p className="font-heading font-bold text-lg">Blitz Mode</p>
                <p className="text-xs opacity-80">
                  60s speed round
                </p>
              </div>
              <NeoButton variant="primary" size="sm">
                Play
              </NeoButton>
            </NeoCard>
            <NeoCard
              shadow="lg"
              className="flex items-center gap-4 cursor-pointer bg-success text-success-foreground"
              onClick={() => navigate("/higher-lower")}
            >
              <div className="neo-border rounded-xl bg-background p-3">
                <TrendingUp
                  size={28}
                  strokeWidth={2.5}
                  className="text-foreground"
                />
              </div>
              <div className="flex-1">
                <p className="font-heading font-bold text-lg">
                  Higher or Lower
                </p>
                <p className="text-xs opacity-80">
                  Compare player stats
                </p>
              </div>
              <NeoButton variant="primary" size="sm">
                Play
              </NeoButton>
            </NeoCard>
            <NeoCard
              shadow="lg"
              className="flex items-center gap-4 cursor-pointer bg-electric-blue text-electric-blue-foreground"
              onClick={() => navigate("/sport-select?mode=verve-grid")}
            >
              <div className="neo-border rounded-xl bg-background p-3">
                <Grid3X3
                  size={28}
                  strokeWidth={2.5}
                  className="text-foreground"
                />
              </div>
              <div className="flex-1">
                <p className="font-heading font-bold text-lg">VerveGrid</p>
                <p className="text-xs opacity-80">
                  Curated football 3x3 grid
                </p>
              </div>
              <NeoButton variant="primary" size="sm">
                Play
              </NeoButton>
            </NeoCard>
            <NeoCard
              shadow="lg"
              className="flex items-center gap-4 cursor-pointer bg-hot-pink text-hot-pink-foreground"
              onClick={() => navigate("/sport-select?mode=who-am-i")}
            >
              <div className="neo-border rounded-xl bg-background p-3">
                <HelpCircle
                  size={28}
                  strokeWidth={2.5}
                  className="text-foreground"
                />
              </div>
              <div className="flex-1">
                <p className="font-heading font-bold text-lg">Who Am I?</p>
                <p className="text-xs opacity-80">
                  Curated football player clues
                </p>
              </div>
              <NeoButton variant="primary" size="sm">
                Play
              </NeoButton>
            </NeoCard>
            <NeoCard
              shadow="lg"
              className="flex items-center gap-4 cursor-pointer bg-primary text-primary-foreground"
              onClick={() => navigate("/forge")}
            >
              <div className="neo-border rounded-xl bg-background p-3">
                <Hammer
                  size={28}
                  strokeWidth={2.5}
                  className="text-foreground"
                />
              </div>
              <div className="flex-1">
                <p className="font-heading font-bold text-lg">The Forge</p>
                <p className="text-xs opacity-80">
                  Create & review questions
                </p>
              </div>
              <NeoButton variant="accent" size="sm">
                Enter
              </NeoButton>
            </NeoCard>
          </div>
        </div>

        {recentAchievements.length > 0 && (
          <div>
            <h3 className="font-heading font-bold text-lg mb-3">
              Recent Achievements
            </h3>
            <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
              {recentAchievements.map((a, i) => (
                <NeoBadge
                  key={a.achievementId}
                  color={badgeColors[i % badgeColors.length]}
                  rotated
                  size="md"
                  className="whitespace-nowrap shrink-0"
                >
                  {a.achievement.name}
                </NeoBadge>
              ))}
            </div>
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
