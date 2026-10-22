import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQuery } from "convex/react";
import { CalendarRange, ChevronRight, Crown, Lock } from "lucide-react";
import { NeoBadge } from "@/components/neo/NeoBadge";
import { NeoButton } from "@/components/neo/NeoButton";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/segmented";
import { ShellLayout } from "@/components/shell/ShellLayout";
import { SHELL_ROUTES } from "@/lib/shellRoutes";
import { cn } from "@/lib/utils";
import { track } from "@/lib/analytics";
import { RANKED_MODE_TILES } from "./competeModeTiles";
import { LeaderboardBoard } from "./ShellLeaderboardScreen";
import { useAuth } from "@/contexts/AuthContext";
import {
  RANKED_CAPABILITIES,
  TIERS,
  type TierKey,
  tierFromElo,
  tierProgress,
} from "@/lib/rankedLadder";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

/**
 * RANKS — one name, one screen (VerveQ ONE decision 10).
 *
 * The app used to call the same idea three things on three screens: "The
 * Ranks" (this screen), "The ladder" (a Home card) and "Leaderboard" (its own
 * route). Now it is the Ranks tab, with a Segmented control:
 *
 *  - LADDER (`/v2/ranks`): your real flat ELO + coarse tier + in-tier
 *    progress (full account) or the locked pitch (username-only / signed-out),
 *    beside the Bronze → Platinum staircase with the REAL tier thresholds from
 *    convex/lib/elo.ts.
 *  - LEADERBOARD (`/v2/leaderboard`): the full boards — ranked Quiz/Survival
 *    ELO with seasons, and the all-time Blitz high scores.
 *
 * Each segment has its own URL so old links and shares open the right one;
 * switching segments replaces the entry (a toggle, not a page). THE WEEKEND's
 * gameweek table is a different competition with its own screen, linked from
 * the header so it is one tap from here.
 *
 * The ranked system the design depicts is driven by RANKED_CAPABILITIES —
 * global rank is live (leaderboards.getGlobalRank); divisions, RP, promotion
 * series, per-mode ratings and season archive remain parked server-side, so
 * their structure stays in code behind honest placeholders, never fabricated.
 */

/** The one live ranked board today (indexed by ELO server-side). */
const BOARD_SPORT = "football";
const BOARD_MODE = "quiz";

type Segment = "ladder" | "leaderboard";

/**
 * "Play ranked" lands straight in the ranked mode (Quiz today) — reusing the
 * tile's OWN deep-link builder so this route can't drift from the catalogue.
 * Falls back to Play if no ranked mode exists.
 */
const PLAY_RANKED_TO =
  RANKED_MODE_TILES[0]?.to(BOARD_SPORT) ?? SHELL_ROUTES.play;

const HERO_BG = "linear-gradient(150deg, hsl(var(--rank-hero-from)), hsl(var(--rank-hero-to)))";

/** Division strip (III → I). Renders ONLY when the divisions backend ships. */
function DivisionStrip() {
  if (!RANKED_CAPABILITIES.divisions) return null;
  // Structure kept for the ranked rollout: chips for III/II/I, the current
  // division highlighted with its RP progress (RANKED_CAPABILITIES.rankPoints).
  return null;
}

export default function RanksScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const segment: Segment =
    location.pathname === SHELL_ROUTES.leaderboard ? "leaderboard" : "ladder";

  const seasonQuery = useQuery(api.seasonManager.getCurrentSeason);
  const seasonNumber = seasonQuery?.seasonNumber ?? null;

  const segmentPath: Record<Segment, string> = {
    ladder: SHELL_ROUTES.ranks,
    leaderboard: SHELL_ROUTES.leaderboard,
  };

  return (
    <ShellLayout
      theme="theme-ink"
      title={t("ranks.title")}
      subtitle={
        seasonNumber != null
          ? t("ranks.eyebrowSeason", { n: seasonNumber })
          : t("ranks.eyebrow")
      }
      headerRight={
        // THE WEEKEND's table — a different competition (budget squads, one
        // gameweek), so it keeps its own screen; this is its door from Ranks.
        // Decision 12: THE WEEKEND wears the lime outline, never a fill.
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            track("weekend_entry_clicked", { source: "ranks", placement: "ranks_table" });
            navigate(SHELL_ROUTES.weekendLeaderboard);
          }}
          data-testid="ranks-weekend-table"
          className="!border-lime text-lime gap-1.5 px-3 uppercase"
        >
          <CalendarRange size={16} strokeWidth={2.5} aria-hidden />
          {t("ranks.weekendTable")}
          <ChevronRight size={16} strokeWidth={2.5} aria-hidden className="hidden md:block" />
        </Button>
      }
    >
      <div
        className={cn(
          "flex flex-col gap-4",
          // From md up the leaderboard's chase list scrolls inside a fixed
          // frame; everything else is a column that scrolls with `main`.
          segment === "leaderboard" ? "min-h-full md:h-full md:min-h-0" : "min-h-full",
        )}
      >
        <Segmented<Segment>
          aria-label={t("ranks.segmentsAria")}
          block
          className="shrink-0 md:w-auto md:max-w-sm md:self-start"
          value={segment}
          onChange={(next) => navigate(segmentPath[next], { replace: true })}
          options={[
            { value: "ladder", label: t("ranks.segments.ladder") },
            { value: "leaderboard", label: t("ranks.segments.leaderboard") },
          ]}
        />
        {segment === "ladder" ? (
          <LadderSegment />
        ) : (
          <div className="flex flex-col md:flex-1 md:min-h-0" data-testid="ranks-leaderboard">
            <LeaderboardBoard />
          </div>
        )}
      </div>
    </ShellLayout>
  );
}

/** The Ladder segment: your standing (or the locked pitch) + the staircase. */
function LadderSegment() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user, isFullAccount, isUsernameOnly, accountState } = useAuth();

  const userId =
    isFullAccount && user && user._id !== "guest_tab"
      ? (user._id as Id<"users">)
      : undefined;
  const profile = useQuery(api.profile.get, userId ? { userId } : "skip");
  const currentSeason = useQuery(api.seasonManager.getCurrentSeason);
  // True board position — same ordering/eligibility as the leaderboard
  // (leaderboards.getGlobalRank shares the computation).
  const globalRank = useQuery(
    api.leaderboards.getGlobalRank,
    RANKED_CAPABILITIES.globalRank && userId
      ? { userId, sport: BOARD_SPORT, mode: BOARD_MODE }
      : "skip",
  );

  // While the auth handshake is settling, don't show the locked pitch (it
  // would flash a "create account" CTA at a signed-in ranked player) — treat
  // it like the profile still loading instead.
  const settling = accountState === "loading";
  const locked = !isFullAccount && !settling;
  const seasonNumber = currentSeason?.seasonNumber ?? null;
  const seasonDaysLeft = currentSeason
    ? Math.max(0, Math.ceil((currentSeason.endDate - Date.now()) / 86400000))
    : null;

  // While the profile is in flight the page still paints — only the hero's
  // numbers wait, so a slow connection sees the screen immediately instead of
  // a full-screen spinner, and never a flashed "Unranked" at a ranked player.
  const profileLoading = settling || (isFullAccount && profile === undefined);

  const elo = isFullAccount && profile ? Math.round(profile.eloRating) : null;
  const myTier: TierKey | null = elo != null ? tierFromElo(elo) : null;
  const progress = elo != null ? tierProgress(elo) : null;

  /* ---------- hero: your standing / locked pitch ---------- */

  const seasonChip = (
    <NeoBadge color={locked ? "muted" : "yellow"}>
      {seasonNumber != null
        ? t("ranks.seasonChip", { n: seasonNumber })
        : t("ranks.rankedChip")}
    </NeoBadge>
  );

  const hero = locked ? (
    <div
      className="neo-border rounded-lg p-5 flex flex-col gap-3.5"
      style={{ background: HERO_BG }}
    >
      <div className="flex items-center justify-between gap-2">
        {seasonChip}
        <NeoBadge color="yellow">
          <Lock size={12} strokeWidth={3} className="mr-1" />
          {t("ranks.locked.chip")}
        </NeoBadge>
      </div>
      <div className="neo-border rounded-lg w-[72px] h-[72px] md:w-[84px] md:h-[84px] -rotate-6 flex items-center justify-center bg-muted">
        <Lock size={32} strokeWidth={2.5} className="text-muted-foreground" />
      </div>
      <div>
        <p className="font-heading font-bold text-title-lg leading-none">
          {t("ranks.locked.title")}
        </p>
        <p className="text-meta text-muted-foreground mt-2.5 max-w-[360px]">
          {t("ranks.locked.body")}
        </p>
      </div>
      <div className="border-2 border-dashed border-muted rounded-lg px-3.5 py-2.5">
        <span className="font-mono text-eyebrow uppercase text-muted-foreground">
          {t("ranks.locked.slot")}
        </span>
      </div>
      <div className="flex flex-col gap-2.5 mt-auto">
        <NeoButton
          variant="primary"
          size="full"
          onClick={() =>
            navigate(
              `${isUsernameOnly ? SHELL_ROUTES.upgrade : SHELL_ROUTES.account}?next=${encodeURIComponent(SHELL_ROUTES.ranks)}`,
            )
          }
        >
          {t("ranks.locked.create")}
        </NeoButton>
        <NeoButton
          variant="outline"
          size="full"
          onClick={() => navigate(SHELL_ROUTES.play)}
        >
          {t("ranks.locked.keepCasual")}
        </NeoButton>
      </div>
    </div>
  ) : (
    <div
      className="neo-border rounded-lg p-5 flex flex-col gap-3.5"
      style={{ background: HERO_BG }}
    >
      <div className="flex items-center justify-between gap-2">
        {seasonChip}
        <span className="font-mono text-eyebrow uppercase text-muted-foreground">
          {seasonDaysLeft != null
            ? t("ranks.endsIn", { days: seasonDaysLeft })
            : t("ranks.seasonDatesSoon")}
        </span>
      </div>
      <div className="flex flex-col gap-3.5 my-auto">
        {profileLoading ? (
          <p className="font-heading font-bold uppercase tracking-wide animate-pulse">
            Loading…
          </p>
        ) : (
          <>
            <div className="flex items-center gap-4">
              <div
                className="neo-border rounded-lg w-[72px] h-[72px] md:w-[84px] md:h-[84px] shrink-0 -rotate-6 flex items-center justify-center"
                style={{ background: myTier ? TIERS.find((x) => x.key === myTier)?.color : undefined }}
              >
                <Crown size={36} strokeWidth={2.5} className="text-ink" />
              </div>
              <div className="min-w-0">
                <p className="font-heading font-bold text-title-lg md:text-display leading-none">
                  {myTier ? t(`ranks.tiers.${myTier}`) : t("ranks.unranked")}
                </p>
                <p className="font-mono text-eyebrow text-yellow mt-1.5 uppercase">
                  {RANKED_CAPABILITIES.globalRank
                    ? globalRank
                      ? t("ranks.globalRankOf", {
                          rank: globalRank.rank.toLocaleString(),
                          total: globalRank.total.toLocaleString(),
                        })
                      : globalRank === null
                        ? t("ranks.globalRankUnplaced")
                        : "…"
                    : t("ranks.globalRankSoon")}
                </p>
              </div>
            </div>
            <div className="flex items-baseline gap-2.5">
              <span className="font-heading font-bold text-display leading-none tabular-nums">
                {elo?.toLocaleString()}
              </span>
              <span className="font-mono text-eyebrow font-bold uppercase text-muted-foreground">
                {t("ranks.eloRating")}
              </span>
            </div>
            {progress && (
              <div>
                <div className="h-3.5 rounded-full border-2 border-foreground overflow-hidden">
                  <div
                    className="h-full"
                    style={{
                      width: `${Math.round(progress.pct * 100)}%`,
                      background: "linear-gradient(90deg, hsl(var(--yellow)), hsl(var(--primary)))",
                    }}
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
          </>
        )}
      </div>
      {/* Parked ranked features — explicit placeholders, never numbers. */}
      <div className="grid grid-cols-2 gap-2.5">
        {[t("ranks.perModeSoon"), t("ranks.archiveSoon")].map((label) => (
          <div
            key={label}
            className="border-2 border-dashed border-muted rounded-lg min-h-[52px] flex items-center justify-center px-2.5 py-2"
          >
            <span className="font-mono text-eyebrow uppercase text-muted-foreground text-center">
              {label}
            </span>
          </div>
        ))}
      </div>
      <NeoButton variant="primary" size="full" onClick={() => navigate(PLAY_RANKED_TO)}>
        {t("ranks.playRanked")}
      </NeoButton>
    </div>
  );

  /* ---------- ladder: Bronze → Platinum staircase ---------- */

  const ladderTiers = [...TIERS].reverse(); // top (Platinum) first
  const ladder = (
    <div className="flex flex-col gap-2.5 md:gap-3">
      <div className="flex items-center justify-between gap-3">
        <span className="font-mono text-eyebrow font-bold uppercase text-muted-foreground">
          {t("ranks.ladder")}
        </span>
        <span className="font-mono text-eyebrow uppercase text-muted-foreground text-right">
          {t("ranks.ladderHint")}
        </span>
      </div>
      {ladderTiers.map((tier, i) => {
        const isMe = tier.key === myTier;
        // Staircase: the top tier sits furthest right (literal classes so the
        // Tailwind JIT sees them; step 10px mobile / 26px desktop, per design).
        const indents = [
          "ml-[30px] md:ml-[78px]",
          "ml-[20px] md:ml-[52px]",
          "ml-[10px] md:ml-[26px]",
          "ml-0",
        ];
        return (
          <div
            key={tier.key}
            className={cn(
              "rounded-lg flex flex-col justify-center",
              indents[i] ?? "ml-0",
              isMe
                ? "border-[3px] border-yellow bg-muted px-4 py-3.5 neo-shadow"
                : "border-2 border-muted bg-card/30 px-3.5 py-3",
            )}
          >
            <div className="flex items-center gap-3">
              <div
                className="neo-border rounded-lg shrink-0 -rotate-6 flex items-center justify-center w-10 h-10 md:w-12 md:h-12"
                style={{ background: tier.color }}
              >
                <Crown size={20} strokeWidth={2.5} className="text-ink" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-heading font-bold text-title-sm md:text-title leading-none">
                    {t(`ranks.tiers.${tier.key}`)}
                  </span>
                  {isMe && <NeoBadge color="yellow">{t("ranks.youAreHere")}</NeoBadge>}
                </div>
                <p
                  className={cn(
                    "font-mono text-eyebrow uppercase mt-1",
                    isMe ? "text-yellow" : "text-muted-foreground",
                  )}
                >
                  {tier.max == null
                    ? t("ranks.tierRangeTop", { min: tier.min.toLocaleString() })
                    : t("ranks.tierRange", {
                        min: tier.min.toLocaleString(),
                        max: tier.max.toLocaleString(),
                      })}
                  {tier.key === "platinum" && ` · ${t("ranks.seasonalCrown").toUpperCase()}`}
                  {tier.key === "silver" && ` · ${t("ranks.newPlayersStart").toUpperCase()}`}
                </p>
              </div>
              {/* Divisions + tier population light up with the ranked backend. */}
              <DivisionStrip />
            </div>
            {isMe && progress && (
              <div className="h-2 rounded-full border-2 border-foreground overflow-hidden mt-2.5">
                <div
                  className="h-full bg-yellow"
                  style={{ width: `${Math.round(progress.pct * 100)}%` }}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  // Desktop — hero | ladder, top-aligned; mobile — stacked, scrolls.
  return (
    <div
      className="flex flex-col gap-4 md:grid md:grid-cols-[1fr_1.4fr] md:gap-6 md:items-start"
      data-testid="ranks-ladder"
    >
      {hero}
      {ladder}
    </div>
  );
}
