import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQuery } from "convex/react";
import { Swords, GraduationCap, Trophy, Hammer, Flame, Zap, Timer, ChevronRight } from "lucide-react";
import { NeoCard } from "@/components/neo/NeoCard";
import { NeoAvatar } from "@/components/neo/NeoAvatar";
import { NeoButton } from "@/components/neo/NeoButton";
import { ShellLayout } from "@/components/shell/ShellLayout";
import { SHELL_ROUTES } from "@/lib/shellRoutes";
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
  const { user, hasUsername, accountState } = useAuth();
  // Any server identity with a username — anonymous (username-only) or full —
  // is an onboarded user whose home reflects them. `hasUsername` is the
  // server-authoritative signal; tab-local guests have no server identity and
  // never pass it (their `_id` isn't a real Convex id).
  const userId = hasUsername && user?._id ? (user._id as Id<"users">) : undefined;
  // Logged-out returning visitors land here by default (v2 is the entry); give
  // them a visible way back to the existing password sign-in. Only shown with no
  // session — anonymous/full accounts see their avatar (and upgrade lives in the
  // ranked gates). `loading` keeps the avatar to avoid a sign-in flicker.
  const showSignIn = accountState === "loggedOut";
  const profile = useQuery(api.profile.get, userId ? { userId } : "skip");

  const displayName = user?.username || "Player";
  const streak = profile?.stats.currentStreak ?? 0;
  // All plays (casual included) — a username-only user's games are real games.
  // Max with the ranked count: legacy accounts may predate the `totalGames`
  // counter, and their ranked history shouldn't read as zero plays.
  const plays = Math.max(profile?.totalPlays ?? 0, profile?.stats.totalGames ?? 0);
  // Ranked standing only when the server says the user is ranked-eligible;
  // username-only users see "—", never a baseline ELO they can't hold.
  const elo = profile?.rankedEligible ? profile.eloRating : undefined;

  return (
    <ShellLayout
      title={t("home.greeting", { name: displayName })}
      subtitle={t("home.tagline")}
      headerRight={
        showSignIn ? (
          <NeoButton
            variant="secondary"
            size="sm"
            onClick={() => navigate("/?mode=signin")}
          >
            {t("auth.signIn")}
          </NeoButton>
        ) : (
          <NeoAvatar name={displayName} size="md" />
        )
      }
    >
      <div className="min-h-full md:min-h-0 md:h-full flex flex-col gap-3 md:gap-4">
        {/* Two pillars — they absorb the leftover height (flex-1) so the column
            always fits, on every device: tall phones get big pillars, and on
            very short phones the cards keep their min height and the column
            overflows into ShellLayout's scroll valve instead of clipping. */}
        <div className="grid grid-cols-1 gap-3 md:gap-4 md:grid-cols-2 flex-1 md:min-h-0">
          <NeoCard
            color="primary"
            shadow="lg"
            className="cursor-pointer min-h-[132px] md:min-h-0 flex flex-col overflow-hidden"
            onClick={() => navigate(SHELL_ROUTES.compete)}
          >
            <div className="neo-border rounded-xl bg-background w-fit p-2.5 md:p-3">
              <Swords size={28} strokeWidth={2.5} className="text-foreground md:hidden" />
              <Swords size={32} strokeWidth={2.5} className="text-foreground hidden md:block" />
            </div>
            <div className="mt-auto pt-3 md:pt-4">
              <p className="font-heading font-bold text-xl md:text-2xl">
                {t("home.pillars.competeTitle")}
              </p>
              <p className="text-xs md:text-sm opacity-80">
                {t("home.pillars.competeSubtitle")}
              </p>
            </div>
          </NeoCard>

          <NeoCard
            color="blue"
            shadow="lg"
            className="cursor-pointer min-h-[132px] md:min-h-0 flex flex-col overflow-hidden"
            onClick={() => navigate(SHELL_ROUTES.learn)}
          >
            <div className="neo-border rounded-xl bg-background w-fit p-2.5 md:p-3">
              <GraduationCap size={28} strokeWidth={2.5} className="text-foreground md:hidden" />
              <GraduationCap size={32} strokeWidth={2.5} className="text-foreground hidden md:block" />
            </div>
            <div className="mt-auto pt-3 md:pt-4">
              <p className="font-heading font-bold text-xl md:text-2xl">
                {t("home.pillars.learnTitle")}
              </p>
              <p className="text-xs md:text-sm opacity-80">
                {t("home.pillars.learnSubtitle")}
              </p>
            </div>
          </NeoCard>
        </div>

        {/* Quick stats — read-only from profile */}
        <div className="grid grid-cols-3 gap-2.5">
          <NeoCard color="yellow" className="text-center py-2 md:py-3 px-2">
            <Trophy size={18} strokeWidth={2.5} className="mx-auto mb-1" />
            <p className="font-mono font-bold text-lg">
              {elo ?? "—"}
            </p>
            <p className="text-[10px] uppercase font-heading opacity-80">
              {t("home.stats.rank")}
            </p>
          </NeoCard>
          <NeoCard color="accent" className="text-center py-2 md:py-3 px-2">
            <Flame size={18} strokeWidth={2.5} className="mx-auto mb-1" />
            <p className="font-mono font-bold text-lg">{streak}</p>
            <p className="text-[10px] uppercase font-heading opacity-80">
              {t("home.stats.streak")}
            </p>
          </NeoCard>
          <NeoCard color="pink" className="text-center py-2 md:py-3 px-2">
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
          className="flex items-center gap-3 cursor-pointer py-2.5 md:py-4"
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
            className="flex items-center gap-3 cursor-pointer py-2.5 md:py-4"
            onClick={() => navigate(SHELL_ROUTES.ranks)}
          >
            <Trophy size={22} strokeWidth={2.5} />
            <span className="font-heading font-bold text-sm flex-1">
              {t("nav.ranks")}
            </span>
            <ChevronRight size={18} strokeWidth={2.5} className="opacity-60" />
          </NeoCard>
          <NeoCard
            className="flex items-center gap-3 cursor-pointer py-2.5 md:py-4"
            onClick={() => navigate(SHELL_ROUTES.forge)}
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
