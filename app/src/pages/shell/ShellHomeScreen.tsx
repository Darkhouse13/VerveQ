import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQuery } from "convex/react";
import {
  Brain,
  CalendarHeart,
  Crown,
  Flame,
  Hammer,
  Hourglass,
  Type,
  Lock,
  Route,
  Star,
  Swords,
  UserRound,
  Users,
} from "lucide-react";
import { NeoAvatar } from "@/components/neo/NeoAvatar";
import { NeoBadge } from "@/components/neo/NeoBadge";
import { NeoButton } from "@/components/neo/NeoButton";
import { BrandMark } from "@/components/ui/BrandMark";
import { Card } from "@/components/ui/card";
import { Eyebrow } from "@/components/ui/eyebrow";
import { ModeTile } from "@/components/ui/mode-tile";
import { HomeDrawCard } from "@/components/draw/HomeDrawCard";
import { HomeWeekendCard } from "@/components/weekend/HomeWeekendCard";
import { ShellLayout } from "@/components/shell/ShellLayout";
import { SHELL_ROUTES } from "@/lib/shellRoutes";
import { RANKED_CAPABILITIES, tierFromElo, tierProgress } from "@/lib/rankedLadder";
import { useAuth } from "@/contexts/AuthContext";
import { usePreferredDailySport } from "@/hooks/usePreferredDailySport";
import { getTodayUTC, isWorldCupEditionActive } from "../../../convex/lib/daily";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

/**
 * v2 unified Home (VerveQ ONE P2.5), on the ink ground like every route.
 *
 * TODAY LEADS, FOR EVERYONE (owner decision 10). Most new players arrive from
 * an Instagram reel into Who's Older or Missing Letters, play, and tap HOME.
 * What they need there is the next daily — so the four dailies (Who's Older,
 * Missing Letters, Daily Challenge, Daily Survival) are the first thing on the
 * screen, each with today's state when the server knows it. THE WEEKEND hero
 * and THE DRAW card follow; then Career Path, COMPETE, the hooks strip and the
 * ladder. Until 2026-10 THE WEEKEND led unconditionally and pushed the dailies
 * to the second screen on a phone, at exactly the moment we wanted a second
 * game played.
 *
 * Every mode is offered through one ModeTile on its decision-12 accent.
 * Desktop is a never-scroll grid; mobile is a scrolling column in the same DOM
 * order, so both breakpoints render one tree.
 *
 * Presentational + navigational only. Every number on screen is server-read
 * (profile, daily attempts, the daily games' getToday, season) and
 * honesty-gated: a state the server hasn't confirmed is absent, never guessed.
 */

/** "h:mm" until the next UTC midnight — when the dailies re-roll. */
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

/** Correct answers in a daily attempt's results (server `v.any()` rows). */
function correctCount(results: unknown): { correct: number; total: number } | null {
  if (!Array.isArray(results) || results.length === 0) return null;
  const correct = results.filter(
    (r) => typeof r === "object" && r !== null && (r as { correct?: unknown }).correct === true,
  ).length;
  return { correct, total: results.length };
}

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
  // Any server identity at all — a silently minted anonymous session counts.
  // The daily games are SessionRoute modes: a reel visitor plays Who's Older
  // with no username, and their result must still show here.
  const hasSession = accountState !== "loggedOut" && accountState !== "loading";
  // The header tells the truth about who you are (consistent with Settings):
  //  - no session            → Sign in (back to the password screen);
  //  - session, no username  → a "Guest" chip to the account chooser — this
  //                            used to be a "P" avatar for a "Player" that
  //                            does not exist;
  //  - a username            → the avatar, to Profile.
  const showSignIn = accountState === "loggedOut";
  const showGuest = accountState === "needsUsername";
  const profile = useQuery(api.profile.get, userId ? { userId } : "skip");
  // The daily card reflects (and launches) the user's preferred subject; the
  // status query and the launch nav below must use this same value.
  const dailySport = usePreferredDailySport();
  const dailyStatus = useQuery(
    api.dailyChallenge.getAttemptStatus,
    hasSession ? { sport: dailySport, mode: "quiz" } : "skip",
  );
  // Daily Survival is football-only by design (the shared run).
  const dailySurvivalStatus = useQuery(
    api.dailyChallenge.getAttemptStatus,
    hasSession ? { sport: "football", mode: "survival" } : "skip",
  );
  // Who's Older? — the reel format's daily twin.
  const whosOlderToday = useQuery(api.whosOlder.getToday, hasSession ? {} : "skip");
  // Missing Letters — the twin of the reel the feed runs twice a day.
  const missingLettersToday = useQuery(api.missingLetters.getToday, hasSession ? {} : "skip");
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

  // ── TODAY: each tile's state, only when the server confirms it ──
  const dailyQuizDone = dailyStatus?.completed === true;
  const dailyQuizTally = dailyQuizDone ? correctCount(dailyStatus?.results) : null;
  const dailyQuizStatus = dailyQuizTally
    ? t("home.today.score", { score: dailyQuizTally.correct, total: dailyQuizTally.total })
    : dailyQuizDone || dailyStatus?.forfeited === true
      ? t("home.hooks.played")
      : null;
  // A forfeited daily survival is still spent for the day.
  const dailySurvivalStatusText =
    dailySurvivalStatus?.completed === true || dailySurvivalStatus?.forfeited === true
      ? t("home.hooks.played")
      : null;

  /** Who's Older / Missing Letters share one getToday shape. */
  const dailyGameStatus = (
    today:
      | {
          daily: { status: string; score: number; totalRounds: number | null } | null;
          streak: { current: number } | null;
        }
      | undefined,
  ) => {
    const daily = today?.daily;
    const parts: string[] = [];
    if (daily?.status === "completed") {
      parts.push(
        daily.totalRounds
          ? t("home.today.score", { score: daily.score, total: daily.totalRounds })
          : t("home.hooks.played"),
      );
    } else if (daily?.status === "active") {
      parts.push(t("home.today.inProgress"));
    }
    const run = today?.streak?.current ?? 0;
    if (parts.length === 0 && run === 0) return null;
    return (
      <>
        {parts.join("")}
        {run > 0 && (
          <span className="inline-flex items-center gap-0.5" title={t("home.stats.streak")}>
            {parts.length > 0 && <span aria-hidden>·</span>}
            <Flame size={11} strokeWidth={3} aria-hidden />
            {run}
          </span>
        )}
      </>
    );
  };

  const dailyIsWorldCup = isWorldCupEditionActive(dailySport, getTodayUTC());
  const seasonNumber =
    typeof season?.seasonNumber === "number" ? season.seasonNumber : null;

  return (
    <ShellLayout>
      <div className="min-h-full md:min-h-0 flex flex-col">
        {/* Brand bar — lockup left, streak + identity right. From md up the
            desktop top nav already carries the lockup, so it drops out here
            (one logo per screen) and the row keeps streak + identity. */}
        <div className="flex items-center justify-between md:justify-end pt-4 pb-3 md:pt-3 md:pb-1 shrink-0">
          <BrandMark variant="lockup" size="md" className="md:hidden" />
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
            ) : showGuest ? (
              <NeoButton
                variant="secondary"
                size="sm"
                title={t("settings.notSignedIn")}
                onClick={() =>
                  navigate(`${SHELL_ROUTES.account}?next=${encodeURIComponent(SHELL_ROUTES.home)}`)
                }
                data-testid="home-guest-chip"
              >
                <UserRound size={16} strokeWidth={2.5} aria-hidden />
                {t("home.guestChip")}
              </NeoButton>
            ) : hasUsername ? (
              <button
                type="button"
                aria-label={displayName}
                onClick={() => navigate(SHELL_ROUTES.profile)}
                className="rounded-full transition-transform duration-press active:translate-x-0.5 active:translate-y-0.5"
              >
                <NeoAvatar
                  name={displayName}
                  size="sm"
                  className="md:w-10 md:h-10 bg-hot-pink text-hot-pink-foreground"
                />
              </button>
            ) : null}
          </div>
        </div>

        {/* TODAY — the four dailies, first for everyone. */}
        <section className="shrink-0 flex flex-col gap-2 pb-4 md:pb-3" aria-labelledby="home-today">
          <div className="flex items-baseline justify-between gap-3">
            <Eyebrow id="home-today" className="font-bold">
              {t("home.today.eyebrow")}
            </Eyebrow>
            <Eyebrow as="span" className="shrink-0 tabular-nums">
              {t("home.hooks.resetsIn", { time: dailyResetCountdown() })}
            </Eyebrow>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {/* WHO'S OLDER? — the format behind most of the account's reel
                reach, as a daily with endless unlocked after it. */}
            <ModeTile
              mode="blue"
              icon={Hourglass}
              name={t("modes.whosOlder.name")}
              line={t("modes.whosOlder.desc")}
              status={dailyGameStatus(whosOlderToday)}
              onClick={() => navigate(SHELL_ROUTES.whosOlderPlay)}
              className="min-h-[132px]"
              data-testid="home-whos-older-card"
            />
            {/* MISSING LETTERS — the reel format that holds most of the feed's
                daily slots, as a daily + endless. */}
            <ModeTile
              mode="pink"
              icon={Type}
              name={t("modes.missingLetters.name")}
              line={t("modes.missingLetters.desc")}
              status={dailyGameStatus(missingLettersToday)}
              onClick={() => navigate(SHELL_ROUTES.missingLettersPlay)}
              className="min-h-[132px]"
              data-testid="home-missing-letters-card"
            />
            {/* Window shared with the backend's themed question pool
                (lib/daily.ts), so the tile renames itself exactly while the
                WC edition is being served. */}
            <ModeTile
              mode="yellow"
              icon={Star}
              name={dailyIsWorldCup ? t("modes.daily.worldCupName") : t("modes.daily.name")}
              line={t("modes.daily.desc")}
              status={dailyQuizStatus}
              onClick={() => navigate(`${SHELL_ROUTES.dailyPlay}?sport=${dailySport}`)}
              className="min-h-[132px]"
              data-testid="home-daily-card"
            />
            <ModeTile
              mode="yellow"
              icon={CalendarHeart}
              name={t("modes.dailySurvival.name")}
              line={t("modes.dailySurvival.desc")}
              status={dailySurvivalStatusText}
              onClick={() => navigate("/v2/daily-survival")}
              className="min-h-[132px]"
              data-testid="home-daily-survival-card"
            />
          </div>
        </section>

        {/* THE WEEKEND entry card (FW-GO) + THE DRAW home card (Ticket H),
            AFTER Today (owner decision 10 reversed "THE WEEKEND leads Home
            unconditionally"). Side by side from md up; the Draw card is
            self-gating, so without it THE WEEKEND takes the full row. The
            `?w=1` param stays a no-op for order. */}
        <div className="shrink-0 flex flex-col md:flex-row md:items-stretch md:gap-4">
          <HomeWeekendCard />
          <HomeDrawCard />
        </div>

        {/* One tree, two breakpoints: mobile stacks in DOM order; desktop is a
            never-scroll grid — Career Path · COMPETE · ladder over the hooks
            strip. Height budget: everything stays above a 900px viewport at
            1440 wide (measure maxBottom before adding anything here). */}
        <div className="flex flex-col gap-3 md:grid md:grid-cols-[3fr_3fr_4fr] md:grid-rows-[auto_auto] md:gap-3 md:content-start">
          {/* CAREER PATH — the most-played mode on the app (73 people in 45
              days, 10.6 completions each, ~34s a run): a short, repeatable
              habit, which is exactly what Home should be able to start. */}
          <ModeTile
            mode="orange"
            elevation="lifted"
            icon={Route}
            name={t("modes.careerPath.name")}
            line={t("modes.careerPath.desc")}
            onClick={() => navigate(`${SHELL_ROUTES.careerPathPlay}?sport=football`)}
            className="md:col-start-1 md:row-start-1 min-h-[120px]"
            data-testid="home-career-path-card"
          />

          {/* COMPETE pillar — duplicated by persistent navigation (the bottom
              bar on mobile, the top bar on desktop), so it is a plain surface,
              not a fill: the accents belong to modes. */}
          <Card
            interactive
            elevation="lifted"
            onClick={() => navigate(SHELL_ROUTES.compete)}
            className="p-4 md:p-5 flex flex-col min-h-0 overflow-hidden md:col-start-2 md:row-start-1"
          >
            <div className="flex items-start justify-between">
              <NeoBadge color="yellow">{t("home.pillars.competeChip")}</NeoBadge>
              <span aria-hidden className="text-title leading-none">
                ⚡
              </span>
            </div>
            <p className="font-heading font-bold uppercase text-title-lg leading-none mt-auto pt-3">
              {t("home.pillars.competeTitle")}
            </p>
            <p className="text-body-sm text-muted-foreground mt-1.5 max-w-[280px] md:max-w-none">
              {t("home.pillars.competeBody")}
            </p>
            <div className="flex flex-wrap items-center gap-2 mt-3">
              <NeoBadge color="muted">
                {elo != null
                  ? t("home.pillars.rankChip", {
                      tier: t(`ranks.tiers.${tierFromElo(elo)}`),
                    })
                  : t("home.stats.unranked")}
              </NeoBadge>
            </div>
          </Card>

          {/* Daily hooks */}
          <div className="flex flex-col gap-2 min-h-0 md:col-span-3 md:row-start-2">
            <Eyebrow className="font-bold">
              <span className="md:hidden">{t("home.hooks.eyebrowShort")}</span>
              <span className="hidden md:inline">{t("home.hooks.eyebrow")}</span>
            </Eyebrow>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {/* Ordered by measured demand over 45 days (organic sessions
                  only): Quiz 20 people, Duels 14, Arena 10. THE FORGE (7 people
                  in 45 days) rides at the end, on a plain surface: it is a
                  tool, not a mode with an accent. */}
              <ModeTile
                mode="orange"
                icon={Brain}
                name={t("modes.quiz.name")}
                line={t("home.hooks.quizSub")}
                onClick={() => navigate("/difficulty?sport=football&mode=quiz&target=v2")}
                className="p-3.5"
              />
              <ModeTile
                mode="pink"
                icon={Users}
                name={t("modes.duel.name")}
                line={t("modes.duel.desc")}
                onClick={() => navigate(SHELL_ROUTES.duels)}
                className="p-3.5"
              />
              <ModeTile
                mode="pink"
                icon={Swords}
                name={t("modes.arena.name")}
                line={t("modes.arena.desc")}
                onClick={() => navigate(SHELL_ROUTES.arena)}
                className="p-3.5"
              />
              <ModeTile
                mode="surface"
                icon={Hammer}
                name={t("forge.title")}
                line={t("forge.subtitle")}
                onClick={() => navigate(SHELL_ROUTES.forge)}
                className="p-3.5"
              />
            </div>
          </div>

          {/* The ladder — a raised surface with the gold ranked accents. */}
          <Card
            interactive
            elevation="lifted"
            onClick={() => navigate(SHELL_ROUTES.ranks)}
            className="p-[18px] flex flex-col min-h-0 overflow-hidden md:col-start-3 md:row-start-1"
          >
            <div className="flex items-center justify-between gap-2">
              <Eyebrow as="span" className="font-bold text-yellow">
                {t("ranks.ladder")}
              </Eyebrow>
              <NeoBadge color="yellow">
                {seasonNumber != null
                  ? t("ranks.seasonChip", { n: seasonNumber })
                  : t("ranks.rankedChip")}
              </NeoBadge>
            </div>

            {elo != null && progress ? (
              <>
                <div className="flex items-center gap-3 mt-3">
                  <div
                    className="neo-border w-[50px] h-[50px] shrink-0 rounded-lg -rotate-6 grid place-items-center"
                    style={{
                      background:
                        "linear-gradient(135deg, hsl(var(--yellow)), hsl(var(--orange)))",
                    }}
                  >
                    <Crown size={26} strokeWidth={2.5} className="text-ink" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-heading font-bold text-title-lg leading-none capitalize">
                      {t(`ranks.tiers.${progress.tier}`)}
                    </p>
                    <p className="font-mono text-meta text-yellow mt-1">
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
                <div className="h-3 neo-border rounded-full mt-3 overflow-hidden">
                  <div
                    className="h-full bg-yellow"
                    style={{ width: `${Math.round(progress.pct * 100)}%` }}
                  />
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-3 mt-3">
                  <div className="neo-border bg-muted w-[50px] h-[50px] shrink-0 rounded-lg -rotate-6 grid place-items-center">
                    <Lock size={24} strokeWidth={2.5} className="text-muted-foreground" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-heading font-bold text-title-lg leading-none">
                      {t("ranks.locked.title")}
                    </p>
                    <p className="font-mono text-meta text-yellow mt-1">
                      {t("ranks.locked.chip")}
                    </p>
                  </div>
                </div>
                <div className="h-3 neo-border rounded-full mt-3 overflow-hidden" />
              </>
            )}

            <div className="flex items-center justify-between mt-auto pt-3">
              <span className="flex items-baseline gap-1.5 font-mono text-meta text-muted-foreground">
                {typeof globalRank?.rank === "number" && (
                  <span className="text-yellow">
                    #{globalRank.rank.toLocaleString()} ·
                  </span>
                )}
                <span>{t("ranks.eloRating")}</span>
                <span>{elo != null ? elo : "—"}</span>
              </span>
              <span className="font-heading font-bold text-meta uppercase text-yellow">
                {t("home.ranksCard.view")} →
              </span>
            </div>
          </Card>
        </div>

        {/* Support nudge — a small line at the foot of home; on mobile it sits
            below the content in the scroll column, on desktop it pins under the
            never-scroll grid. Links out to Buy Me a Coffee (new tab). */}
        <p className="shrink-0 text-center text-meta text-muted-foreground pt-3 pb-1">
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
