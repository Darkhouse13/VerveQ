import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQuery } from "convex/react";
import { Crown, Lock } from "lucide-react";
import { NeoBadge } from "@/components/neo/NeoBadge";
import { NeoButton } from "@/components/neo/NeoButton";
import { ShellLayout } from "@/components/shell/ShellLayout";
import { SHELL_ROUTES } from "@/lib/shellRoutes";
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
 * v2 Ranks — the competitive ladder's dark "premium" space (replaces the
 * placeholder screen).
 *
 *  - Hero: your real flat ELO + coarse tier + in-tier progress (full account),
 *    or the locked pitch (username-only / signed-out).
 *  - Ladder: Bronze → Platinum staircase with the REAL tier thresholds from
 *    convex/lib/elo.ts; your tier highlighted for full accounts.
 *  - Leaderboard: the real football·quiz ELO board, your row pinned when the
 *    server can place you in it.
 *
 * The ranked system the design depicts is driven by RANKED_CAPABILITIES —
 * global rank is live (leaderboards.getGlobalRank); divisions, RP, promotion
 * series, per-mode ratings and season archive remain parked server-side, so
 * their structure stays in code behind honest placeholders, never fabricated.
 */

/** The one live ranked board today (indexed by ELO server-side). */
const BOARD_SPORT = "football";
const BOARD_MODE = "quiz";
const BOARD_SIZE = 5;

const MEDALS: Record<number, string> = {
  1: "#E2B23A",
  2: "#C9CFD6",
  3: "#B07A43",
};

const HERO_BG = "linear-gradient(150deg, #2a2823, #1a1916)";

/** Division strip (III → I). Renders ONLY when the divisions backend ships. */
function DivisionStrip() {
  if (!RANKED_CAPABILITIES.divisions) return null;
  // Structure kept for the ranked rollout: chips for III/II/I, the current
  // division highlighted with its RP progress (RANKED_CAPABILITIES.rankPoints).
  return null;
}

export default function RanksScreen() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user, isFullAccount, isUsernameOnly } = useAuth();

  const userId =
    isFullAccount && user && user._id !== "guest_tab"
      ? (user._id as Id<"users">)
      : undefined;
  const profile = useQuery(api.profile.get, userId ? { userId } : "skip");
  const currentSeason = useQuery(api.seasonManager.getCurrentSeason);
  // Fetch deeper than we render so a mid-table player can still be pinned with
  // a real rank within the board's depth.
  const board = useQuery(api.leaderboards.getLeaderboard, {
    sport: BOARD_SPORT,
    mode: BOARD_MODE,
    limit: 50,
  });
  // True board position past the display depth — same ordering/eligibility as
  // the board itself (leaderboards.getGlobalRank shares the computation).
  const globalRank = useQuery(
    api.leaderboards.getGlobalRank,
    RANKED_CAPABILITIES.globalRank && userId
      ? { userId, sport: BOARD_SPORT, mode: BOARD_MODE }
      : "skip",
  );

  const locked = !isFullAccount;
  const seasonNumber = currentSeason?.seasonNumber ?? null;
  const seasonDaysLeft = currentSeason
    ? Math.max(0, Math.ceil((currentSeason.endDate - Date.now()) / 86400000))
    : null;

  if (isFullAccount && profile === undefined) {
    return (
      <ShellLayout theme="dark" title={t("ranks.title")} center>
        <p className="font-heading font-bold uppercase tracking-wide animate-pulse text-center">
          Loading…
        </p>
      </ShellLayout>
    );
  }

  const elo = isFullAccount && profile ? Math.round(profile.eloRating) : null;
  const myTier: TierKey | null = elo != null ? tierFromElo(elo) : null;
  const progress = elo != null ? tierProgress(elo) : null;

  const entries = (board?.entries ?? []).slice(0, BOARD_SIZE);
  const myEntry = userId
    ? (board?.entries ?? []).find((e) => e.userId === userId)
    : undefined;
  const myPinned = myEntry && !entries.some((e) => e.userId === myEntry.userId);

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
      className="neo-border rounded-lg p-5 flex flex-col gap-3.5 md:flex-1 md:min-h-0"
      style={{ background: HERO_BG }}
    >
      <div className="flex items-center justify-between gap-2">
        {seasonChip}
        <NeoBadge color="yellow">
          <Lock size={11} strokeWidth={3} className="mr-1" />
          {t("ranks.locked.chip")}
        </NeoBadge>
      </div>
      <div className="neo-border rounded-xl w-[72px] h-[72px] md:w-[84px] md:h-[84px] -rotate-6 flex items-center justify-center bg-muted">
        <Lock size={32} strokeWidth={2.5} className="text-muted-foreground" />
      </div>
      <div>
        <p className="font-heading font-bold text-[28px] md:text-[32px] leading-none">
          {t("ranks.locked.title")}
        </p>
        <p className="text-[13px] text-muted-foreground mt-2.5 max-w-[360px]">
          {t("ranks.locked.body")}
        </p>
      </div>
      <div className="border-2 border-dashed border-muted rounded-lg px-3.5 py-2.5">
        <span className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
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
          onClick={() => navigate(SHELL_ROUTES.compete)}
        >
          {t("ranks.locked.keepCasual")}
        </NeoButton>
      </div>
    </div>
  ) : (
    <div
      className="neo-border rounded-lg p-5 flex flex-col gap-3.5 md:flex-1 md:min-h-0"
      style={{ background: HERO_BG }}
    >
      <div className="flex items-center justify-between gap-2">
        {seasonChip}
        <span className="font-mono text-[10.5px] uppercase tracking-widest text-muted-foreground">
          {seasonDaysLeft != null
            ? t("ranks.endsIn", { days: seasonDaysLeft })
            : t("ranks.seasonDatesSoon")}
        </span>
      </div>
      <div className="flex flex-col gap-3.5 my-auto">
        <div className="flex items-center gap-4">
          <div
            className="neo-border rounded-xl w-[72px] h-[72px] md:w-[84px] md:h-[84px] shrink-0 -rotate-6 flex items-center justify-center"
            style={{ background: myTier ? TIERS.find((x) => x.key === myTier)?.color : undefined }}
          >
            <Crown size={36} strokeWidth={2.5} className="text-black/80" />
          </div>
          <div className="min-w-0">
            <p className="font-heading font-bold text-[32px] md:text-[40px] leading-none">
              {myTier ? t(`ranks.tiers.${myTier}`) : t("ranks.unranked")}
            </p>
            <p className="font-mono text-[11px] text-yellow mt-1.5 uppercase">
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
          <span className="font-heading font-bold text-[44px] md:text-[54px] leading-none tabular-nums">
            {elo?.toLocaleString()}
          </span>
          <span className="font-mono text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
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
            <p className="font-mono text-[10.5px] text-muted-foreground mt-1.5 uppercase">
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
      </div>
      {/* Parked ranked features — explicit placeholders, never numbers. */}
      <div className="grid grid-cols-2 gap-2.5">
        {[t("ranks.perModeSoon"), t("ranks.archiveSoon")].map((label) => (
          <div
            key={label}
            className="border-2 border-dashed border-muted rounded-lg min-h-[52px] flex items-center justify-center px-2.5 py-2"
          >
            <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground text-center">
              {label}
            </span>
          </div>
        ))}
      </div>
      <NeoButton variant="primary" size="full" onClick={() => navigate(SHELL_ROUTES.compete)}>
        {t("ranks.playRanked")}
      </NeoButton>
    </div>
  );

  /* ---------- ladder: Bronze → Platinum staircase ---------- */

  const ladderTiers = [...TIERS].reverse(); // top (Platinum) first
  const ladder = (
    <div className="flex flex-col gap-2.5 md:gap-3 md:min-h-0 md:h-full">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
          {t("ranks.ladder")}
        </span>
        <span className="font-mono text-[10px] uppercase text-muted-foreground">
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
            className={
              `rounded-lg flex flex-col justify-center md:flex-1 md:min-h-0 ${indents[i] ?? "ml-0"} ` +
              (isMe
                ? "border-[3px] border-yellow bg-muted px-4 py-3.5"
                : "border-2 border-muted bg-card/30 px-3.5 py-3")
            }
            style={{
              boxShadow: isMe ? "6px 6px 0 rgba(226, 178, 58, .25)" : undefined,
            }}
          >
            <div className="flex items-center gap-3">
              <div
                className="neo-border rounded-lg shrink-0 -rotate-6 flex items-center justify-center w-10 h-10 md:w-12 md:h-12"
                style={{ background: tier.color }}
              >
                <Crown size={20} strokeWidth={2.5} className="text-black/80" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-heading font-bold text-lg md:text-xl leading-none">
                    {t(`ranks.tiers.${tier.key}`)}
                  </span>
                  {isMe && <NeoBadge color="yellow">{t("ranks.youAreHere")}</NeoBadge>}
                </div>
                <p
                  className={
                    "font-mono text-[9.5px] uppercase tracking-wide mt-1 " +
                    (isMe ? "text-yellow" : "text-muted-foreground")
                  }
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

  /* ---------- leaderboard preview (real football·quiz board) ---------- */

  const boardCard = (
    <div className="border-2 border-muted rounded-lg bg-card/30 flex flex-col md:flex-1 md:min-h-0 overflow-hidden">
      <div className="flex items-center justify-between px-4 pt-3 pb-2.5">
        <span className="font-mono text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
          {t("ranks.board")}
        </span>
        <span className="font-mono text-[10px] uppercase text-muted-foreground">
          {t("ranks.boardScope")}
        </span>
      </div>
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        {entries.length === 0 ? (
          <div className="border-t-2 border-muted px-4 py-6 text-center">
            <span className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
              {t("ranks.boardEmpty")}
            </span>
          </div>
        ) : (
          entries.map((p) => {
            const isYou = userId != null && p.userId === userId;
            return (
              <div
                key={p.userId}
                className={
                  "border-t-2 px-4 py-2.5 flex items-center gap-3 md:flex-1 md:min-h-0 " +
                  (isYou ? "border-yellow bg-muted" : "border-muted")
                }
              >
                <span
                  className="w-[26px] h-[26px] rounded-full shrink-0 border-2 flex items-center justify-center font-heading font-bold text-xs"
                  style={{
                    borderColor: MEDALS[p.rank] ?? "hsl(var(--muted))",
                    background: MEDALS[p.rank] ?? "transparent",
                    color: MEDALS[p.rank] ? "#0E0D0B" : undefined,
                  }}
                >
                  {p.rank}
                </span>
                <span className="font-heading font-bold text-sm flex-1 min-w-0 truncate">
                  {p.username}
                  {isYou && (
                    <span className="font-mono text-[9.5px] text-yellow ml-1.5">
                      {t("ranks.boardYou").toUpperCase()}
                    </span>
                  )}
                </span>
                <span className="font-mono text-[11.5px] font-bold text-muted-foreground">
                  {Math.round(p.elo_rating ?? 0).toLocaleString()}
                </span>
              </div>
            );
          })
        )}
      </div>
      {(myPinned || locked) && (
        <p className="font-mono text-center text-[11px] text-muted-foreground tracking-[.4em] py-0.5">
          ···
        </p>
      )}
      {locked ? (
        <div className="border-t-2 border-dashed border-muted px-4 py-2.5 flex items-center gap-3">
          <span className="w-[26px] h-[26px] rounded-full border-2 border-dashed border-muted flex items-center justify-center font-mono text-[11px] text-muted-foreground shrink-0">
            ?
          </span>
          <span className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
            {t("ranks.boardLockedRow")}
          </span>
        </div>
      ) : (
        myPinned &&
        myEntry && (
          <div className="border-t-[3px] border-yellow bg-muted px-4 py-2.5 flex items-center gap-3">
            <span className="font-mono text-[10.5px] font-bold text-yellow shrink-0">
              #{myEntry.rank}
            </span>
            <span className="font-heading font-bold text-sm flex-1 min-w-0 truncate">
              {myEntry.username}
              <span className="font-mono text-[9.5px] text-yellow ml-1.5">
                {t("ranks.boardYou").toUpperCase()}
              </span>
            </span>
            <span className="font-mono text-[11.5px] font-bold">
              {Math.round(myEntry.elo_rating ?? 0).toLocaleString()}
            </span>
          </div>
        )
      )}
      <div className="border-t-2 border-muted p-3">
        <NeoButton
          variant="outline"
          size="full"
          className="shadow-none"
          onClick={() => navigate(SHELL_ROUTES.leaderboard)}
        >
          {t("ranks.fullBoard")}
        </NeoButton>
      </div>
    </div>
  );

  /* ---------- screen ---------- */

  return (
    <ShellLayout
      theme="dark"
      title={t("ranks.title")}
      subtitle={
        seasonNumber != null
          ? t("ranks.eyebrowSeason", { n: seasonNumber })
          : t("ranks.eyebrow")
      }
      back
      onBack={() => navigate(SHELL_ROUTES.home)}
      headerRight={<NeoBadge color="muted">{t("ranks.boardScope")}</NeoBadge>}
    >
      {/* Desktop — never-scroll, hero | ladder | board */}
      <div className="hidden md:grid md:grid-cols-[1.05fr_1.35fr_1fr] md:gap-4 md:h-full md:min-h-0">
        <div className="flex flex-col min-h-0">{hero}</div>
        <div className="min-h-0">{ladder}</div>
        <div className="flex flex-col min-h-0">{boardCard}</div>
      </div>

      {/* Mobile — stacked, scrolls */}
      <div className="flex flex-col gap-4 md:hidden">
        {hero}
        {ladder}
        {boardCard}
      </div>
    </ShellLayout>
  );
}
