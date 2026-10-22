import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQuery } from "convex/react";
import { BookOpen, Crown, Hammer, Lock, Settings, Share2 } from "lucide-react";
import { notify } from "@/lib/notify";
import { NeoCard } from "@/components/neo/NeoCard";
import { NeoButton } from "@/components/neo/NeoButton";
import { NeoBadge } from "@/components/neo/NeoBadge";
import { ShellLayout } from "@/components/shell/ShellLayout";
import { Eyebrow } from "@/components/ui/eyebrow";
import { Skeleton } from "@/components/ui/skeleton";
import { IconButton } from "@/components/ui/icon-button";
import { ModeTile } from "@/components/ui/mode-tile";
import { SHELL_ROUTES } from "@/lib/shellRoutes";
import { useAuth } from "@/contexts/AuthContext";
import {
  RANKED_CAPABILITIES,
  TIERS,
  tierFromElo,
  tierProgress,
} from "@/lib/rankedLadder";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

/**
 * v2 Profile — "your locker", shell-native (replaces the embedded v1 wrapper).
 *
 * Two account states (the route guard guarantees a server identity):
 *  - full account:   identity, ranked summary, stats, badges, activity, seasons.
 *  - username-only:  upgrade CTA, LOCKED ranked card, casual-only stats.
 *
 * Desktop (md+) is a never-scroll 3-column grid; mobile stacks and scrolls.
 * Every number is server data (profile.get / achievements / seasonManager).
 * The rich ranked fields the design depicts (divisions, RP, global rank) are
 * driven by RANKED_CAPABILITIES and render honest placeholders until the
 * ranked backend ships — nothing is fabricated client-side.
 *
 * LABS (decision 11): the two surfaces that are tools rather than games live
 * here, off Play — Learn (21 hand-authored ladders, 0 players in 45 days) and
 * The Forge (7 players; Gold, 1500+ ELO). The Forge shows only when the
 * server says this account may enter it (forge.canAccess), so nobody is
 * offered a locked door.
 */

const sportLabels: Record<string, string> = {
  football: "⚽ Football",
  tennis: "🎾 Tennis",
  basketball: "🏀 Basketball",
};

const modeEmojis: Record<string, string> = {
  quiz: "🧠",
  survival: "🛡️",
  decay: "📉",
  seasonReset: "🔄",
};

const achievementEmojis: Record<string, string> = {
  first_quiz: "🎯",
  first_survival: "🛡️",
  survival_legend: "👑",
  multi_sport_athlete: "🌍",
  dedicated_player: "🔥",
  elo_champion: "♛",
  the_architect: "🛠️",
};

const tierColors: Record<string, string> = Object.fromEntries(
  TIERS.map((t) => [t.key, t.color]),
);

function monthYear(ts: number): string {
  return new Date(ts)
    .toLocaleDateString("en-US", { month: "short", year: "numeric" })
    .toUpperCase();
}

function timeAgo(ts: number): string {
  const mins = Math.max(1, Math.floor((Date.now() - ts) / 60000));
  if (mins < 60) return `${mins}M AGO`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}H AGO`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}D AGO`;
  return monthYear(ts);
}

export default function ShellProfileScreen() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user, username, isFullAccount, isUsernameOnly } = useAuth();

  // The route guard (UsernameOnlyRoute) guarantees a server identity here.
  const userId = user && user._id !== "guest_tab" ? (user._id as Id<"users">) : undefined;
  const profile = useQuery(api.profile.get, userId ? { userId } : "skip");
  const allAchievements = useQuery(api.achievements.list);
  const userAchs = useQuery(
    api.achievements.userAchievements,
    userId ? { userId } : "skip",
  );
  const seasonHistory = useQuery(
    api.seasonManager.getUserSeasonHistory,
    isFullAccount && userId ? { userId } : "skip",
  );
  const currentSeason = useQuery(api.seasonManager.getCurrentSeason);
  // True position on the live ranked board (football·quiz — the same scope
  // the Ranks screen's board and global rank use).
  const globalRank = useQuery(
    api.leaderboards.getGlobalRank,
    RANKED_CAPABILITIES.globalRank && isFullAccount && userId
      ? { userId, sport: "football", mode: "quiz" }
      : "skip",
  );

  // The Forge's own gate (Gold tier, full account) — asked only for full
  // accounts; anything but an explicit `allowed` keeps the tile hidden.
  const forgeAccess = useQuery(api.forge.canAccess, isFullAccount ? {} : "skip");
  const showForge = forgeAccess?.allowed === true;

  const guest = isUsernameOnly;
  const handle = username ?? user?.username ?? "";

  if (profile === undefined) {
    // Card shapes, like every other wait in the app, inside the tab's own
    // frame so the nav stays put.
    return (
      <ShellLayout title={t("profile.title")} subtitle={t("profile.eyebrow")}>
        <div role="status" aria-label={t("common.loading")} className="flex flex-col gap-4 md:grid md:grid-cols-3">
          <Skeleton className="h-40 neo-border" />
          <Skeleton className="h-56 neo-border" />
          <Skeleton className="h-56 neo-border" />
        </div>
      </ShellLayout>
    );
  }

  /* ---------- derived, all from server data ---------- */
  const elo = isFullAccount && profile ? Math.round(profile.eloRating) : null;
  const progress = elo != null ? tierProgress(elo) : null;
  const tierKey = elo != null ? tierFromElo(elo) : null;
  const wins = profile?.stats.totalWins ?? 0;
  const rankedGames = profile?.stats.totalGames ?? 0;
  const losses = Math.max(0, rankedGames - wins);
  const seasonNumber = currentSeason?.seasonNumber ?? null;
  const seasonDaysLeft = currentSeason
    ? Math.max(0, Math.ceil((currentSeason.endDate - Date.now()) / 86400000))
    : null;
  const streak = profile?.stats.currentStreak ?? 0;

  const unlocked = new Map(
    (userAchs ?? []).map((ua) => [ua.achievementId, ua.unlockedAt]),
  );
  const badges = (allAchievements ?? [])
    .filter((a) => a.achievementId !== "multi_sport_athlete") // football-only product
    .slice(0, 6);
  const unlockedCount = badges.filter((a) => unlocked.has(a.achievementId)).length;

  const activity = (profile?.recentGames ?? []).slice(0, 5);

  /* ---------- sections ---------- */

  const identity = (
    <NeoCard className="flex flex-col gap-3.5 md:shrink-0">
      <div className="flex items-center gap-4">
        <div className="neo-border neo-shadow rounded-lg bg-hot-pink text-hot-pink-foreground w-[72px] h-[72px] md:w-[84px] md:h-[84px] shrink-0 -rotate-3 flex items-center justify-center font-heading font-bold text-title-lg uppercase">
          {handle.slice(0, 2) || "?"}
        </div>
        <div className="min-w-0">
          <p className="font-heading font-bold text-title md:text-title-lg leading-none truncate">
            {handle}
          </p>
          <p className="font-mono text-eyebrow text-muted-foreground mt-1.5 uppercase ">
            {profile
              ? guest
                ? t("profile.playingSince", { date: monthYear(profile.createdAt) })
                : t("profile.memberSince", { date: monthYear(profile.createdAt) })
              : ""}
          </p>
          <div className="flex flex-wrap items-center gap-1.5 mt-2">
            {guest ? (
              <NeoBadge color="yellow">{t("profile.usernameOnly")}</NeoBadge>
            ) : (
              <NeoBadge color="muted">
                {t("profile.fullAccount")}
              </NeoBadge>
            )}
            {streak > 0 && <NeoBadge color="accent">🔥 {streak}</NeoBadge>}
          </div>
        </div>
      </div>
      <div className="flex gap-2">
        <NeoButton
          variant="secondary"
          size="sm"
          className="flex-1"
          onClick={() => {
            navigator.clipboard.writeText(window.location.href);
            notify.success(t("profile.shareCopied"));
          }}
        >
          <Share2 size={14} strokeWidth={2.5} /> {t("profile.share")}
        </NeoButton>
      </div>
    </NeoCard>
  );

  const rankCard = guest ? (
    <NeoCard
      className="flex flex-col gap-2.5 md:flex-1 md:min-h-fit md:justify-center"
      style={{
        background:
          "repeating-linear-gradient(45deg, hsl(var(--ink) / 0.045) 0 10px, transparent 10px 20px)",
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-eyebrow font-bold uppercase text-muted-foreground">
          {seasonNumber != null
            ? t("profile.rankedSeason", { n: seasonNumber })
            : t("profile.ranked")}
        </span>
        <NeoBadge color="muted">
          <Lock size={11} strokeWidth={3} className="mr-1" /> {t("profile.lockedChip")}
        </NeoBadge>
      </div>
      <p className="font-heading font-bold text-title-sm leading-tight">
        {t("profile.lockedTitle")}
      </p>
      <p className="text-meta text-muted-foreground">{t("profile.lockedBody")}</p>
      <NeoButton
        variant="ghost"
        size="sm"
        className="self-start neo-border"
        onClick={() => navigate(SHELL_ROUTES.ranks)}
      >
        {t("profile.peekLadder")}
      </NeoButton>
    </NeoCard>
  ) : (
    <NeoCard
      shadow="lg"
      className="flex flex-col gap-3.5 md:flex-1 md:min-h-fit md:justify-between cursor-pointer"
      onClick={() => navigate(SHELL_ROUTES.ranks)}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-eyebrow font-bold uppercase text-yellow">
          {seasonNumber != null
            ? t("profile.rankedSeason", { n: seasonNumber })
            : t("profile.ranked")}
        </span>
        {tierKey && (
          <NeoBadge color="yellow">
            {t(`ranks.tiers.${tierKey}`)}
          </NeoBadge>
        )}
      </div>
      <div className="flex flex-col gap-3.5 my-auto">
        <div className="flex items-center gap-3.5">
          <div
            className="neo-border rounded-lg w-14 h-14 shrink-0 -rotate-6 flex items-center justify-center"
            style={{ background: tierKey ? tierColors[tierKey] : undefined }}
          >
            <Crown size={28} strokeWidth={2.5} className="text-ink" />
          </div>
          <div>
            <p className="font-heading font-bold text-title-lg leading-none">
              {tierKey ? t(`ranks.tiers.${tierKey}`) : t("ranks.unranked")}
            </p>
            <p className="font-mono text-eyebrow mt-1.5 text-yellow uppercase">
              {elo?.toLocaleString()} ELO
              {RANKED_CAPABILITIES.globalRank ? (
                globalRank ? (
                  <span className="text-muted-foreground">
                    {" "}
                    · {t("ranks.globalRankShort", { rank: globalRank.rank.toLocaleString() })}
                  </span>
                ) : null
              ) : (
                <span className="text-muted-foreground"> · {t("ranks.globalRankSoon")}</span>
              )}
            </p>
          </div>
        </div>
        {progress && (
          <div>
            <div className="h-3 rounded-full border-2 border-border overflow-hidden">
              <div
                className="h-full bg-yellow"
                style={{ width: `${Math.round(progress.pct * 100)}%` }}
              />
            </div>
            <p className="font-mono text-eyebrow text-muted-foreground mt-1.5 uppercase">
              {progress.next
                ? t("ranks.progressTo", {
                    elo: elo?.toLocaleString(),
                    next: progress.nextThreshold?.toLocaleString(),
                    tier: t(`ranks.tiers.${progress.next}`),
                  })
                : t("ranks.topTier")}
            </p>
          </div>
        )}
        <p className="font-mono text-eyebrow text-muted-foreground border-t-2 border-border/20 pt-2.5 uppercase">
          {t("ranks.allTimeRecord")} ·{" "}
          <b className="text-foreground">
            {wins}W — {losses}L
          </b>
        </p>
      </div>
      <div className="flex items-center justify-between">
        <span className="font-mono text-eyebrow text-muted-foreground uppercase">
          {seasonDaysLeft != null
            ? t("ranks.endsInShort", { days: seasonDaysLeft })
            : t("ranks.seasonDatesSoon")}
        </span>
        <span className="font-heading font-bold text-body-sm text-yellow uppercase">
          {t("profile.viewRanks")}
        </span>
      </div>
    </NeoCard>
  );

  const statTiles = (
    <div className="grid grid-cols-2 gap-3 md:flex-1 md:min-h-fit md:auto-rows-fr">
      {[
        {
          label: t("profile.stats.games"),
          // Lifetime plays (casual included) — survives the upgrade, matching
          // the "your casual progress carries over" promise and the home tile.
          value: String(profile?.totalPlays ?? user?.totalGames ?? 0),
        },
        {
          label: t("profile.stats.winRate"),
          value: guest ? "—" : `${Math.round(profile?.stats.winRate ?? 0)}%`,
        },
        {
          label: t("profile.stats.bestStreak"),
          value: guest ? "—" : String(profile?.stats.bestStreak ?? 0),
        },
        {
          label: t("profile.stats.favTopic"),
          value:
            !guest && profile?.stats.favoriteSport
              ? sportLabels[profile.stats.favoriteSport] ?? profile.stats.favoriteSport
              : "—",
        },
      ].map((tile) => (
        <div
          key={tile.label}
          className="neo-border rounded-lg bg-card text-center px-3 py-3.5 flex flex-col justify-center min-w-0"
        >
          <p className="font-mono text-eyebrow font-bold uppercase text-muted-foreground">
            {tile.label}
          </p>
          <p className="font-heading font-bold text-title mt-1.5 whitespace-nowrap truncate">
            {tile.value}
          </p>
        </div>
      ))}
    </div>
  );

  const badgeGrid = (
    <div className="flex flex-col gap-2.5 md:flex-1 md:min-h-fit">
      <div className="flex items-center justify-between">
        <span className="font-mono text-eyebrow font-bold uppercase text-muted-foreground">
          {t("profile.achievements")}
        </span>
        <span className="font-mono text-meta text-muted-foreground">
          {unlockedCount} / {badges.length}
        </span>
      </div>
      {badges.length === 0 ? (
        <div className="neo-border border-dashed rounded-lg flex items-center justify-center py-6">
          <span className="font-mono text-eyebrow uppercase text-muted-foreground">
            {t("profile.achievementsNone")}
          </span>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2.5 md:auto-rows-fr md:flex-1 md:min-h-0">
          {badges.map((a) => {
            const unlockedAt = unlocked.get(a.achievementId);
            const locked = unlockedAt === undefined;
            return (
              <div
                key={a.achievementId}
                className={
                  "rounded-lg px-3 py-2.5 flex items-center gap-2.5 min-w-0 " +
                  (locked
                    ? "border-2 border-dashed border-muted-foreground is-dimmed"
                    : "neo-border bg-card")
                }
              >
                <span className={"text-title-sm shrink-0" + (locked ? " grayscale" : "")}>
                  {achievementEmojis[a.achievementId] ?? "🏅"}
                </span>
                <div className="min-w-0">
                  <p className="font-heading font-bold text-meta leading-tight truncate">
                    {a.name}
                  </p>
                  {/* Wraps (two lines at most) — a cut-off goal ("COMPLETE YOU…")
                      tells a new player nothing. */}
                  <p className="text-meta leading-snug text-muted-foreground mt-0.5 line-clamp-2">
                    {locked ? a.description || t("profile.locked") : monthYear(unlockedAt)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  const activityCard = (
    <NeoCard className="p-0 flex flex-col md:flex-1 md:min-h-fit">
      <div className="flex items-center justify-between px-4 pt-3 pb-2.5">
        <span className="font-mono text-eyebrow font-bold uppercase text-muted-foreground">
          {t("profile.activity")}
        </span>
        <span className="font-mono text-eyebrow text-muted-foreground uppercase">
          {t("profile.activityRanked")}
        </span>
      </div>
      {activity.length === 0 ? (
        <div className="border-t-2 border-border px-4 py-6 text-center">
          <span className="font-mono text-eyebrow uppercase text-muted-foreground">
            {guest ? t("profile.activityEmptyGuest") : t("profile.activityEmpty")}
          </span>
        </div>
      ) : (
        activity.map((g) => {
          const isAdj = g.sessionType === "decay" || g.sessionType === "seasonReset";
          const name = isAdj
            ? t(`profile.${g.sessionType}`)
            : t(`modes.${g.gameMode}.name`, { defaultValue: g.gameMode });
          const emoji = modeEmojis[isAdj ? (g.sessionType as string) : g.gameMode] ?? "🏆";
          const delta = Math.round(g.eloChange);
          return (
            <div
              key={g.id}
              className="border-t-2 border-border px-4 py-2.5 flex items-center gap-3 md:flex-1 md:min-h-0"
            >
              <div className="neo-border rounded-lg w-9 h-9 shrink-0 flex items-center justify-center bg-muted text-body">
                {emoji}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-heading font-bold text-meta leading-tight capitalize truncate">
                  {name}
                </p>
                <p className="font-mono text-eyebrow uppercase text-muted-foreground mt-0.5 truncate">
                  {g.sport} · {timeAgo(g.playedAt)}
                </p>
              </div>
              <span
                className={
                  "font-mono text-meta font-bold rounded-full border-2 px-2.5 py-0.5 shrink-0 " +
                  (delta >= 0
                    ? "text-success border-success"
                    : "text-destructive border-destructive")
                }
              >
                {delta >= 0 ? "+" : ""}
                {delta}
              </span>
            </div>
          );
        })
      )}
    </NeoCard>
  );

  const pastSeasons = (seasonHistory ?? []).slice(0, 4);
  const seasonsCard =
    guest || pastSeasons.length === 0 ? (
      <div className="neo-border border-dashed rounded-lg flex items-center justify-center py-6 px-4 md:shrink-0">
        <span className="font-mono text-eyebrow uppercase text-muted-foreground text-center">
          {guest ? t("profile.seasonsGuest") : t("profile.seasonsEmpty")}
        </span>
      </div>
    ) : (
      <NeoCard className="md:shrink-0">
        <div className="flex items-center justify-between">
          <span className="font-mono text-eyebrow font-bold uppercase text-muted-foreground">
            {t("profile.seasons")}
          </span>
          <span className="font-mono text-eyebrow text-muted-foreground uppercase">
            {t("profile.seasonsPeak")}
          </span>
        </div>
        <div className="flex gap-2 mt-2.5">
          {pastSeasons.map((s) => (
            <div
              key={`${s.seasonNumber}-${s.sport}-${s.mode}`}
              className="neo-border rounded-lg flex-1 min-w-0 text-center px-1 py-2 bg-card"
            >
              <div className="flex items-center justify-center gap-1.5">
                <span
                  className="w-3 h-3 rounded-sm border-2 border-border -rotate-6 inline-block"
                  style={{
                    background: tierColors[s.tier.toLowerCase()] ?? "hsl(var(--tier-silver))",
                  }}
                />
                <span className="font-mono text-meta font-bold">S{s.seasonNumber}</span>
              </div>
              <p className="font-heading font-bold text-meta mt-1 whitespace-nowrap truncate">
                {s.tier}
              </p>
            </div>
          ))}
        </div>
      </NeoCard>
    );

  const labs = (
    <section className="flex flex-col gap-2.5 md:shrink-0" aria-labelledby="profile-labs">
      <Eyebrow id="profile-labs" className="font-bold">
        {t("profile.labs")}
      </Eyebrow>
      <div className={showForge ? "grid grid-cols-2 gap-2.5" : "grid grid-cols-1"}>
        <ModeTile
          mode="surface"
          icon={BookOpen}
          name={t("home.pillars.learnTitle")}
          line={t("profile.labsLearnLine")}
          onClick={() => navigate(SHELL_ROUTES.learn)}
          data-testid="profile-labs-learn"
        />
        {showForge && (
          <ModeTile
            mode="surface"
            icon={Hammer}
            name={t("forge.title")}
            line={t("forge.subtitle")}
            onClick={() => navigate(SHELL_ROUTES.forge)}
            data-testid="profile-labs-forge"
          />
        )}
      </div>
    </section>
  );

  return (
    <ShellLayout
      title={t("profile.title")}
      subtitle={t("profile.eyebrow")}
      // A tab, not a sub-screen: no Back. The handle is already on the
      // identity card, so the header carries only Settings.
      headerRight={
        <IconButton
          variant="secondary"
          aria-label={t("settings.openLabel")}
          onClick={() => navigate(SHELL_ROUTES.settings)}
        >
          <Settings strokeWidth={2.5} />
        </IconButton>
      }
    >
      {/* Desktop — never-scroll 3-column locker */}
      <div className="hidden md:flex md:flex-col md:h-full md:min-h-0 md:gap-4">
        <div className="grid grid-cols-[1.05fr_1.25fr_1.1fr] gap-4 flex-1 min-h-0">
          <div className="flex flex-col gap-4 min-h-0 overflow-y-auto">
            {identity}
            {rankCard}
          </div>
          <div className="flex flex-col gap-4 min-h-0 overflow-y-auto">
            {statTiles}
            {badgeGrid}
          </div>
          <div className="flex flex-col gap-4 min-h-0 overflow-y-auto">
            {activityCard}
            {seasonsCard}
            {labs}
          </div>
        </div>
      </div>

      {/* Mobile — stacked, scrolls */}
      <div className="flex flex-col gap-4 md:hidden">
        {identity}
        {rankCard}
        {statTiles}
        {badgeGrid}
        {activityCard}
        {seasonsCard}
        {labs}
      </div>
    </ShellLayout>
  );
}
