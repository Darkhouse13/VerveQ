import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQuery } from "convex/react";
import { Swords, GraduationCap, Trophy, Hammer, Flame, Zap, Timer, ChevronRight } from "lucide-react";
import { NeoCard } from "@/components/neo/NeoCard";
import { NeoAvatar } from "@/components/neo/NeoAvatar";
import { ShellLayout } from "@/components/shell/ShellLayout";
import { SHELL_ROUTES, MODE_ROUTES } from "@/lib/shellRoutes";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

/**
 * v2 unified Home — category-first, two-pillar entry point (Compete / Learn).
 * Presentational + navigational only: stats are read from the existing
 * server-authoritative `profile.get` query; nothing is scored client-side.
 */
export default function ShellHomeScreen() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user, isGuest } = useAuth();
  const userId = !isGuest && user?.username ? (user._id as Id<"users">) : undefined;
  const profile = useQuery(api.profile.get, userId ? { userId } : "skip");

  const displayName = user?.username || "Player";
  const streak = profile?.stats.currentStreak ?? 0;
  const plays = profile?.stats.totalGames ?? 0;
  const elo = profile?.eloRating;

  return (
    <ShellLayout
      title={t("home.greeting", { name: displayName })}
      subtitle={t("home.tagline")}
      headerRight={<NeoAvatar name={displayName} size="md" />}
    >
      <div className="flex flex-col gap-5 md:h-full md:justify-center">
        {/* Two pillars */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <NeoCard
            color="primary"
            shadow="lg"
            className="cursor-pointer min-h-[160px] md:min-h-[260px] flex flex-col"
            onClick={() => navigate(SHELL_ROUTES.compete)}
          >
            <div className="neo-border rounded-xl bg-background w-fit p-3">
              <Swords size={32} strokeWidth={2.5} className="text-foreground" />
            </div>
            <div className="mt-auto pt-4">
              <p className="font-heading font-bold text-2xl">
                {t("home.pillars.competeTitle")}
              </p>
              <p className="text-sm opacity-80">
                {t("home.pillars.competeSubtitle")}
              </p>
            </div>
          </NeoCard>

          <NeoCard
            color="blue"
            shadow="lg"
            className="cursor-pointer min-h-[160px] md:min-h-[260px] flex flex-col"
            onClick={() => navigate(SHELL_ROUTES.learn)}
          >
            <div className="neo-border rounded-xl bg-background w-fit p-3">
              <GraduationCap size={32} strokeWidth={2.5} className="text-foreground" />
            </div>
            <div className="mt-auto pt-4">
              <p className="font-heading font-bold text-2xl">
                {t("home.pillars.learnTitle")}
              </p>
              <p className="text-sm opacity-80">
                {t("home.pillars.learnSubtitle")}
              </p>
            </div>
          </NeoCard>
        </div>

        {/* Quick stats — read-only from profile */}
        <div className="grid grid-cols-3 gap-2.5">
          <NeoCard color="yellow" className="text-center py-3 px-2">
            <Trophy size={18} strokeWidth={2.5} className="mx-auto mb-1" />
            <p className="font-mono font-bold text-lg">
              {elo ?? "—"}
            </p>
            <p className="text-[10px] uppercase font-heading opacity-80">
              {t("home.stats.rank")}
            </p>
          </NeoCard>
          <NeoCard color="accent" className="text-center py-3 px-2">
            <Flame size={18} strokeWidth={2.5} className="mx-auto mb-1" />
            <p className="font-mono font-bold text-lg">{streak}</p>
            <p className="text-[10px] uppercase font-heading opacity-80">
              {t("home.stats.streak")}
            </p>
          </NeoCard>
          <NeoCard color="pink" className="text-center py-3 px-2">
            <Zap size={18} strokeWidth={2.5} className="mx-auto mb-1" />
            <p className="font-mono font-bold text-lg">{plays}</p>
            <p className="text-[10px] uppercase font-heading opacity-80">
              {t("home.stats.plays")}
            </p>
          </NeoCard>
        </div>

        {/* Daily hook — same questions for everyone; runs the daily-gated session. */}
        <NeoCard
          color="primary"
          shadow="lg"
          className="flex items-center gap-3 cursor-pointer"
          onClick={() => navigate(`${SHELL_ROUTES.dailyPlay}?sport=football`)}
        >
          <div className="neo-border rounded-xl bg-background w-fit p-2.5">
            <Timer size={22} strokeWidth={2.5} className="text-foreground" />
          </div>
          <div className="flex-1">
            <p className="font-heading font-bold text-sm">{t("modes.daily.name")}</p>
            <p className="text-xs opacity-80">{t("modes.daily.desc")}</p>
          </div>
          <ChevronRight size={18} strokeWidth={2.5} className="opacity-60" />
        </NeoCard>

        {/* Secondary entries */}
        <div className="grid grid-cols-2 gap-3">
          <NeoCard
            className="flex items-center gap-3 cursor-pointer"
            onClick={() => navigate(SHELL_ROUTES.ranks)}
          >
            <Trophy size={22} strokeWidth={2.5} />
            <span className="font-heading font-bold text-sm flex-1">
              {t("nav.ranks")}
            </span>
            <ChevronRight size={18} strokeWidth={2.5} className="opacity-60" />
          </NeoCard>
          <NeoCard
            className="flex items-center gap-3 cursor-pointer"
            onClick={() => navigate(MODE_ROUTES.forge)}
          >
            <Hammer size={22} strokeWidth={2.5} />
            <span className="font-heading font-bold text-sm flex-1">
              {t("forge.title")}
            </span>
            <ChevronRight size={18} strokeWidth={2.5} className="opacity-60" />
          </NeoCard>
        </div>
      </div>
    </ShellLayout>
  );
}
