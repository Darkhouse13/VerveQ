import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQuery } from "convex/react";
import {
  Brain,
  CalendarHeart,
  Crown,
  Flame,
  Hammer,
  Lock,
  Star,
  Swords,
  Users,
} from "lucide-react";
import { NeoCard } from "@/components/neo/NeoCard";
import { NeoAvatar } from "@/components/neo/NeoAvatar";
import { NeoBadge } from "@/components/neo/NeoBadge";
import { NeoButton } from "@/components/neo/NeoButton";
import { HomeDrawCard } from "@/components/draw/HomeDrawCard";
import { ShellLayout } from "@/components/shell/ShellLayout";
import { SHELL_ROUTES } from "@/lib/shellRoutes";
import { RANKED_CAPABILITIES, tierFromElo, tierProgress } from "@/lib/rankedLadder";
import { useAuth } from "@/contexts/AuthContext";
import { usePreferredDailySport } from "@/hooks/usePreferredDailySport";
import { getTodayUTC, isWorldCupEditionActive } from "../../../convex/lib/daily";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

/**
 * v2 unified Home — rebuilt around the DAILY SLATE (2026-07 strategy cut):
 * TODAY's games (Daily Quiz + Daily Survival) lead beside COMPETE, then the
 * hooks strip (Duels/Arena/Quiz), the dark ladder card and the Forge. The
 * Learn pillar is parked — its routes stay live at /v2/learn, but the home no
 * longer advertises it (general knowledge is off-thesis for a football app).
 * Desktop is a never-scroll grid; mobile is a scrolling column in the same DOM
 * order, so both breakpoints render one tree.
 *
 * Presentational + navigational only. Every number on screen is server-read
 * (profile, daily attempts, season) and honesty-gated: slots the backend can't
 * serve yet (lobby counts, coins, global rank) are absent, never fabricated.
 */

/** "h:mm" until the next UTC midnight — when the daily challenge re-rolls. */
function dailyResetCountdown(): string {
  const now = new Date();
  const nextUtcMidnight = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + 1,
  );
  const ms = Math.max(0, nextUtcMidnight - now.getTime());
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return `${h}:${String(m).padStart(2, "0")}`;
}

/** Hard-shadow lift on hover, press-in on tap — the prototype's `.lift`. */
const LIFT =
  "transition-transform hover:-translate-x-[2px] hover:-translate-y-[2px] active:translate-x-[2px] active:translate-y-[2px]";

const EYEBROW =
  "font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground";

/** Optional support nudge — small, unobtrusive, never shown during play. */
const COFFEE_URL = "https://buymeacoffee.com/verveq";

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
  // Identity-scoped reads; all skipped for guests/logged-out so nothing throws.
  // The daily card reflects (and launches) the user's preferred subject; the
  // status query and the launch nav below must use this same value.
  const dailySport = usePreferredDailySport();
  const dailyStatus = useQuery(
    api.dailyChallenge.getAttemptStatus,
    hasUsername ? { sport: dailySport, mode: "quiz" } : "skip",
  );
  // Daily Survival is football-only by design (the shared run).
  const dailySurvivalStatus = useQuery(
    api.dailyChallenge.getAttemptStatus,
    hasUsername ? { sport: "football", mode: "survival" } : "skip",
  );
  const season = useQuery(
    api.seasonManager.getCurrentSeason,
    hasUsername ? {} : "skip",
  );
  // True position on the live ranked board (football·quiz, same scope as the
  // Ranks screen). Only fetched once the profile confirms ranked eligibility.
  const globalRank = useQuery(
    api.leaderboards.getGlobalRank,
    RANKED_CAPABILITIES.globalRank && profile?.rankedEligible && userId
      ? { userId, sport: "football", mode: "quiz" }
      : "skip",
  );

  const displayName = user?.username || "Player";
  const streak = profile?.stats.currentStreak ?? 0;
  // Ranked standing only when the server says the user is ranked-eligible;
  // username-only users get the locked ladder card, never a baseline ELO.
  const elo = profile?.rankedEligible ? Math.round(profile.eloRating) : null;
  const progress = elo != null ? tierProgress(elo) : null;

  const dailyPlayed = dailyStatus?.completed === true;
  // A forfeited daily survival is still spent for the day.
  const dailySurvivalPlayed =
    dailySurvivalStatus?.completed === true ||
    dailySurvivalStatus?.forfeited === true;
  // Window shared with the backend's themed question pool (lib/daily.ts), so
  // the card renames itself exactly while the WC edition is being served.
  const dailyIsWorldCup = isWorldCupEditionActive(dailySport, getTodayUTC());
  const seasonNumber =
    typeof season?.seasonNumber === "number" ? season.seasonNumber : null;

  return (
    <ShellLayout>
      <div className="min-h-full md:min-h-0 md:h-full flex flex-col">
        {/* Brand bar — V mark + wordmark left, streak + identity right */}
        <div className="flex items-center justify-between pt-4 pb-3 md:pt-5 md:pb-4 shrink-0">
          <div className="flex items-center gap-2.5">
            <div
              aria-hidden
              className="neo-border w-8 h-8 md:w-10 md:h-10 rounded-lg bg-foreground text-background grid place-items-center font-heading font-black text-lg md:text-xl -rotate-[4deg]"
            >
              V
            </div>
            <span className="font-heading font-black text-xl md:text-2xl tracking-tight">
              Verve<span className="text-primary">Q</span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            {streak > 0 && (
              <NeoBadge color="yellow" title={t("home.stats.streak")}>
                <Flame size={12} strokeWidth={3} className="mr-1" />
                {streak}
              </NeoBadge>
            )}
            {showSignIn ? (
              <NeoButton
                variant="secondary"
                size="sm"
                onClick={() => navigate("/?mode=signin")}
              >
                {t("auth.signIn")}
              </NeoButton>
            ) : (
              <button
                type="button"
                aria-label={displayName}
                onClick={() => navigate(SHELL_ROUTES.profile)}
                className={LIFT}
              >
                <NeoAvatar
                  name={displayName}
                  size="sm"
                  className="md:w-10 md:h-10 bg-hot-pink text-hot-pink-foreground"
                />
              </button>
            )}
          </div>
        </div>

        {/* THE DRAW home hero (Ticket H) — TOP of Home. Self-gating: with the
            build flag off, or when the server gate throws, it renders nothing
            and the Home below is byte-identical for non-draw users. */}
        <HomeDrawCard />

        {/* One tree, two breakpoints: mobile stacks in DOM order; desktop is a
            never-scroll 3-column grid (pillars · pillars/dailies · ladder/forge),
            ratios from the prototype (left 1.5fr split in two, right 1fr). */}
        <div className="flex flex-col gap-3 md:grid md:grid-cols-[3fr_3fr_4fr] md:grid-rows-[1.5fr_0.9fr] md:gap-4 md:flex-1 md:min-h-0">
          {/* TODAY pillar — the daily slate leads the home. Two cards, one
              habit: the shared quiz and the shared survival run, both with
              honest played/reset state read from the server. */}
          <div className="flex flex-col gap-3 min-h-0">
            <p className={EYEBROW}>{t("home.today.eyebrow")}</p>
            <NeoCard
              color="yellow"
              shadow="lg"
              onClick={() => navigate(`${SHELL_ROUTES.dailyPlay}?sport=${dailySport}`)}
              className={`p-4 flex flex-col gap-1.5 min-h-0 flex-1 ${LIFT}`}
            >
              <Star size={24} strokeWidth={2.5} />
              <p className="font-heading font-black uppercase text-lg md:text-xl leading-none mt-auto">
                {dailyIsWorldCup
                  ? t("modes.daily.worldCupName")
                  : t("modes.daily.name")}
              </p>
              <p className="font-mono text-[10.5px] uppercase text-muted-foreground">
                {dailyPlayed
                  ? t("home.hooks.played")
                  : t("home.hooks.resetsIn", { time: dailyResetCountdown() })}
              </p>
            </NeoCard>
            <NeoCard
              color="accent"
              shadow="lg"
              onClick={() => navigate("/v2/daily-survival")}
              className={`p-4 flex flex-col gap-1.5 min-h-0 flex-1 ${LIFT}`}
            >
              <CalendarHeart size={24} strokeWidth={2.5} />
              <p className="font-heading font-black uppercase text-lg md:text-xl leading-none mt-auto">
                {t("modes.dailySurvival.name")}
              </p>
              <p className="font-mono text-[10.5px] uppercase text-muted-foreground">
                {dailySurvivalPlayed
                  ? t("home.hooks.played")
                  : t("modes.dailySurvival.desc")}
              </p>
            </NeoCard>
          </div>

          {/* COMPETE pillar */}
          <NeoCard
            color="primary"
            shadow="lg"
            onClick={() => navigate(SHELL_ROUTES.compete)}
            className={`p-5 flex flex-col min-h-0 overflow-hidden ${LIFT}`}
          >
            <div className="flex items-start justify-between">
              <NeoBadge className="bg-foreground text-background">
                {t("home.pillars.competeChip")}
              </NeoBadge>
              <span aria-hidden className="text-[26px] leading-none">
                ⚡
              </span>
            </div>
            <p className="font-heading font-black uppercase text-[34px] md:text-[46px] leading-[0.95] mt-auto pt-3">
              {t("home.pillars.competeTitle")}
            </p>
            <p className="text-sm font-medium opacity-90 mt-2 max-w-[280px]">
              {t("home.pillars.competeBody")}
            </p>
            <div className="flex flex-wrap items-center gap-2 mt-3.5">
              <NeoBadge color="muted" className="bg-card text-foreground">
                {elo != null
                  ? t("home.pillars.rankChip", {
                      tier: t(`ranks.tiers.${tierFromElo(elo)}`),
                    })
                  : t("home.stats.unranked")}
              </NeoBadge>
            </div>
          </NeoCard>

          {/* Daily hooks */}
          <div className="flex flex-col gap-2.5 min-h-0 md:col-span-2 md:col-start-1 md:row-start-2">
            <p className={EYEBROW}>
              <span className="md:hidden">{t("home.hooks.eyebrowShort")}</span>
              <span className="hidden md:inline">{t("home.hooks.eyebrow")}</span>
            </p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-3.5 md:flex-1 md:min-h-0">
              {/* Duels take the strip's lead slot (the dailies moved up to the
                  TODAY pillar) — head-to-head is the "settle it" thesis. */}
              <NeoCard
                color="pink"
                onClick={() => navigate(SHELL_ROUTES.duels)}
                className={`p-3.5 flex flex-col gap-1.5 min-h-0 ${LIFT}`}
              >
                <Users size={22} strokeWidth={2.5} />
                <p className="font-heading font-bold text-base leading-none">
                  {t("modes.duel.name")}
                </p>
                <p className="font-mono text-[10.5px] uppercase text-muted-foreground">
                  {t("modes.duel.desc")}
                </p>
              </NeoCard>
              <NeoCard
                onClick={() => navigate(SHELL_ROUTES.arena)}
                className={`p-3.5 flex flex-col gap-1.5 min-h-0 ${LIFT}`}
              >
                <Swords size={22} strokeWidth={2.5} />
                <p className="font-heading font-bold text-base leading-none">
                  {t("modes.arena.name")}
                </p>
                <p className="font-mono text-[10.5px] uppercase text-muted-foreground">
                  {t("modes.arena.desc")}
                </p>
              </NeoCard>
              <NeoCard
                onClick={() =>
                  navigate("/difficulty?sport=football&mode=quiz&target=v2")
                }
                className={`p-3.5 flex flex-col gap-1.5 min-h-0 ${LIFT}`}
              >
                <Brain size={22} strokeWidth={2.5} />
                <p className="font-heading font-bold text-base leading-none">
                  {t("modes.quiz.name")}
                </p>
                <p className="font-mono text-[10.5px] uppercase text-muted-foreground">
                  {t("home.hooks.quizSub")}
                </p>
              </NeoCard>
            </div>
          </div>

          {/* The Forge */}
          <NeoCard
            color="pink"
            shadow="lg"
            onClick={() => navigate(SHELL_ROUTES.forge)}
            className={`p-4 flex items-center gap-3.5 min-h-0 md:col-start-3 md:row-start-2 ${LIFT}`}
          >
            <Hammer size={28} strokeWidth={2.5} className="shrink-0" />
            <div className="min-w-0">
              <p className="font-heading font-bold text-[19px] leading-tight">
                {t("forge.title")}
              </p>
              <p className="text-[12.5px] opacity-90">{t("forge.subtitle")}</p>
            </div>
            <span aria-hidden className="ml-auto font-heading font-black text-xl">
              →
            </span>
          </NeoCard>

          {/* The ladder — dark ranks card */}
          <button
            type="button"
            onClick={() => navigate(SHELL_ROUTES.ranks)}
            className={`neo-border neo-shadow-lg rounded-lg bg-foreground text-background text-left w-full p-[18px] flex flex-col min-h-0 overflow-hidden md:col-start-3 md:row-start-1 ${LIFT}`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-yellow">
                {t("ranks.ladder")}
              </span>
              <span className="rounded-full border-2 border-background bg-yellow text-yellow-foreground px-3 py-1 font-heading font-bold uppercase tracking-wide text-[10px]">
                {seasonNumber != null
                  ? t("ranks.seasonChip", { n: seasonNumber })
                  : t("ranks.rankedChip")}
              </span>
            </div>

            {elo != null && progress ? (
              <>
                <div className="flex items-center gap-3 mt-3 md:mt-4">
                  <div
                    className="neo-border border-background w-[50px] h-[50px] md:w-[62px] md:h-[62px] shrink-0 rounded-[10px] -rotate-6 grid place-items-center"
                    style={{
                      background:
                        "linear-gradient(135deg, hsl(var(--yellow)), hsl(var(--primary)))",
                    }}
                  >
                    <Crown
                      size={26}
                      strokeWidth={2.5}
                      className="text-black/80"
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="font-heading font-black text-2xl md:text-3xl leading-none capitalize">
                      {t(`ranks.tiers.${progress.tier}`)}
                    </p>
                    <p className="font-mono text-xs text-yellow mt-1">
                      {progress.next
                        ? t("ranks.progressTo", {
                            elo,
                            next: progress.nextThreshold,
                            tier: t(`ranks.tiers.${progress.next}`),
                          })
                        : t("ranks.topTier")}
                    </p>
                  </div>
                </div>
                <div className="h-3 border-2 border-background rounded-full mt-3 overflow-hidden">
                  <div
                    className="h-full bg-yellow"
                    style={{ width: `${Math.round(progress.pct * 100)}%` }}
                  />
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-3 mt-3 md:mt-4">
                  <div className="neo-border border-background/40 bg-background/15 w-[50px] h-[50px] md:w-[62px] md:h-[62px] shrink-0 rounded-[10px] -rotate-6 grid place-items-center">
                    <Lock
                      size={24}
                      strokeWidth={2.5}
                      className="text-background/70"
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="font-heading font-black text-2xl md:text-3xl leading-none">
                      {t("ranks.locked.title")}
                    </p>
                    <p className="font-mono text-xs text-yellow mt-1">
                      {t("ranks.locked.chip")}
                    </p>
                  </div>
                </div>
                <div className="h-3 border-2 border-background/40 rounded-full mt-3 overflow-hidden" />
              </>
            )}

            <div className="flex items-center justify-between mt-auto pt-3.5">
              <span className="flex items-baseline gap-1.5 font-mono text-[11px] text-background/60">
                {typeof globalRank?.rank === "number" && (
                  <span className="text-yellow">
                    #{globalRank.rank.toLocaleString()} ·
                  </span>
                )}
                <span>{t("ranks.eloRating")}</span>
                <span>{elo != null ? elo : "—"}</span>
              </span>
              <span className="font-heading font-bold text-[13px] uppercase text-yellow">
                {t("home.ranksCard.view")} →
              </span>
            </div>
          </button>
        </div>

        {/* Support nudge — a small line at the foot of home; on mobile it sits
            below the content in the scroll column, on desktop it pins under the
            never-scroll grid. Links out to Buy Me a Coffee (new tab). */}
        <p className="shrink-0 text-center text-[11px] text-muted-foreground pt-3.5 pb-1">
          {t("home.supportCoffeePrefix")}{" "}
          <a
            href={COFFEE_URL}
            target="_blank"
            rel="noreferrer noopener"
            className="font-bold underline underline-offset-2 transition-colors hover:text-foreground"
          >
            {t("home.supportCoffeeLink")}
          </a>
        </p>
      </div>
    </ShellLayout>
  );
}
