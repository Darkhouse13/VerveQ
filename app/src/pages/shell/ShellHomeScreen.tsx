import { useEffect, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQuery } from "convex/react";
import { ChevronDown, Flame, Radio, Send, Users, UserRound } from "lucide-react";
import { NeoAvatar } from "@/components/neo/NeoAvatar";
import { NeoBadge } from "@/components/neo/NeoBadge";
import { NeoButton } from "@/components/neo/NeoButton";
import { BrandMark } from "@/components/ui/BrandMark";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { Card } from "@/components/ui/card";
import { Eyebrow } from "@/components/ui/eyebrow";
import { ModeTile } from "@/components/ui/mode-tile";
import { HomeDrawCard } from "@/components/draw/HomeDrawCard";
import { ShellLayout } from "@/components/shell/ShellLayout";
import { SHELL_ROUTES } from "@/lib/shellRoutes";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { usePreferredDailySport } from "@/hooks/usePreferredDailySport";
import { getTodayUTC, isWorldCupEditionActive } from "../../../convex/lib/daily";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import {
  COMPETE_KNOWLEDGE_TILES,
  PLAY_FEATURED_KEYS,
  PLAY_MORE_KEYS,
  PLAY_TODAY_KEYS,
  tilesByKeys,
} from "./competeModeTiles";

/**
 * PLAY — the first tab (VerveQ ONE decision 10), on the ink ground.
 *
 * Play replaced BOTH Home and Compete. The two screens offered the same games
 * twice (12 of Compete's 15 entries were already on Home), so a player had two
 * catalogues and no idea which one was "the" place to start. Now there is one,
 * in four sections (membership lives in competeModeTiles.ts):
 *
 *   TODAY       Who's Older, Missing Letters, Daily Challenge, Daily Survival,
 *               each with today's state when the server knows it; THE DRAW
 *               ("Today's Draw") joins as its own card when its gates allow.
 *               Most new players arrive from an Instagram reel into one of the
 *               dailies, play, and tap PLAY: what they need is the next daily.
 *   FEATURED    Career Path — the most-played mode on the app.
 *   WITH FRIENDS one "Challenge a friend" entry: send a link (Duels) or open a
 *               live room (Arena). They were two tiles for one intent.
 *   MORE GAMES  collapsed: Quiz and Survival (with a "Ranked" chip), VerveGrid,
 *               Higher or Lower, Blitz, Knowledge Quiz, Which Came First.
 *               Opens on `#more` — every old /compete link lands that way.
 *
 * What left: THE WEEKEND card (it has its own tab now), the COMPETE pillar and
 * the ladder card (the Ranks tab), and The Forge (Profile → Labs, decision 11).
 *
 * Every mode is offered through one ModeTile on its decision-12 accent.
 * Desktop never scrolls at 1440×900 with More games closed (height budget:
 * measure main's maxBottom before adding anything); mobile is a scrolling
 * column in the same DOM order, so both breakpoints render one tree.
 *
 * Presentational + navigational only. Every number on screen is server-read
 * (profile, daily attempts, the daily games' getToday) and honesty-gated: a
 * state the server hasn't confirmed is absent, never guessed.
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

/** The `#anchor` that opens More games (old /compete links redirect with it). */
const MORE_HASH = "#more";

/** Stable hooks for the contracts and the journey spec, one per Today tile. */
const TODAY_TEST_IDS: Record<string, string> = {
  whosOlder: "home-whos-older-card",
  missingLetters: "home-missing-letters-card",
  daily: "home-daily-card",
  dailySurvival: "home-daily-survival-card",
};

export default function ShellHomeScreen() {
  const navigate = useNavigate();
  const location = useLocation();
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
  //  - session, no username  → a "Guest" chip to the account chooser;
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

  // More games is collapsed by default; `#more` (every old /compete link)
  // opens it. Local state after that — the hash is an entry, not a binding.
  const [moreOpen, setMoreOpen] = useState(location.hash === MORE_HASH);
  // Arriving on `#more`, bring the opened catalogue into view: that is what
  // the link promised (the Compete grid used to BE the whole screen).
  useEffect(() => {
    if (location.hash === MORE_HASH) {
      document.getElementById("home-more")?.scrollIntoView?.({ block: "start" });
    }
  }, [location.hash]);

  const displayName = user?.username || "Player";
  const streak = profile?.stats.currentStreak ?? 0;

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
            <Flame size={12} strokeWidth={3} aria-hidden />
            {run}
          </span>
        )}
      </>
    );
  };

  // Window shared with the backend's themed question pool (lib/daily.ts), so
  // the tile renames itself exactly while the WC edition is being served.
  const dailyIsWorldCup = isWorldCupEditionActive(dailySport, getTodayUTC());

  const todayStatus: Record<string, ReactNode> = {
    whosOlder: dailyGameStatus(whosOlderToday),
    missingLetters: dailyGameStatus(missingLettersToday),
    daily: dailyQuizStatus,
    dailySurvival: dailySurvivalStatusText,
  };
  // The daily quiz follows the user's preferred subject; every other tile
  // carries football (the only live sport).
  const targetFor = (key: string, to: (sport: string) => string) =>
    to(key === "daily" ? dailySport : "football");
  const nameFor = (key: string) =>
    key === "daily" && dailyIsWorldCup ? t("modes.daily.worldCupName") : t(`modes.${key}.name`);

  const today = tilesByKeys(PLAY_TODAY_KEYS);
  const featured = tilesByKeys(PLAY_FEATURED_KEYS);
  const more = [...tilesByKeys(PLAY_MORE_KEYS), ...COMPETE_KNOWLEDGE_TILES];

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
                  navigate(`${SHELL_ROUTES.account}?next=${encodeURIComponent(SHELL_ROUTES.play)}`)
                }
                data-testid="home-guest-chip"
              >
                <UserRound size={16} strokeWidth={2.5} aria-hidden />
                {t("home.guestChip")}
              </NeoButton>
            ) : hasUsername ? (
              <IconButton
                aria-label={displayName}
                onClick={() => navigate(SHELL_ROUTES.profile)}
                className="rounded-full enabled:hover:bg-transparent active:translate-x-0.5 active:translate-y-0.5"
              >
                <NeoAvatar
                  name={displayName}
                  size="sm"
                  className="md:w-10 md:h-10 bg-hot-pink text-hot-pink-foreground"
                />
              </IconButton>
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
            {today.map((tile) => (
              <ModeTile
                key={tile.key}
                mode={tile.color}
                icon={tile.icon}
                name={nameFor(tile.key)}
                line={t(`modes.${tile.key}.desc`)}
                status={todayStatus[tile.key]}
                onClick={() => navigate(targetFor(tile.key, tile.to))}
                className="min-h-[132px]"
                data-testid={TODAY_TEST_IDS[tile.key]}
              />
            ))}
          </div>
          {/* TODAY'S DRAW (Ticket H) joins Today: it is a daily board too.
              Self-gating (build flag + server gate, both silent), and its
              absence leaves no trace in the column. */}
          <HomeDrawCard />
        </section>

        {/* Featured · With friends · More games. Mobile stacks in DOM order;
            desktop sets the three side by side, and the opened catalogue
            spans the row beneath them. */}
        <div className="flex flex-col gap-4 md:grid md:grid-cols-3 md:gap-x-3 md:gap-y-3 md:content-start">
          {/* FEATURED — Career Path, the most-played mode on the app (73
              people in 45 days, 10.6 completions each, ~34s a run): a short,
              repeatable habit, which is exactly what Play should start. */}
          <section className="flex flex-col gap-2" aria-labelledby="home-featured">
            <Eyebrow id="home-featured" className="font-bold">
              {t("home.featured.eyebrow")}
            </Eyebrow>
            {featured.map((tile) => (
              <ModeTile
                key={tile.key}
                mode={tile.color}
                elevation="lifted"
                icon={tile.icon}
                name={t(`modes.${tile.key}.name`)}
                line={t(`modes.${tile.key}.desc`)}
                onClick={() => navigate(targetFor(tile.key, tile.to))}
                className="min-h-[120px] md:flex-1"
                data-testid="home-career-path-card"
              />
            ))}
          </section>

          {/* WITH FRIENDS — Duels and Arena were two tiles for one intent.
              One entry, two ways in: send a link (a duel, played whenever) or
              open a live room (Arena, everyone at once). */}
          <section className="flex flex-col gap-2" aria-labelledby="home-friends">
            <Eyebrow id="home-friends" className="font-bold">
              {t("home.friends.eyebrow")}
            </Eyebrow>
            <Card
              elevation="raised"
              padding="md"
              className="bg-hot-pink text-ink on-fill flex flex-col gap-1.5 md:flex-1"
              data-testid="home-friends-card"
            >
              <Users size={24} strokeWidth={2.5} className="shrink-0" aria-hidden />
              <p className="font-heading text-title-sm font-bold leading-tight mt-auto">
                {t("home.friends.title")}
              </p>
              <p className="text-meta leading-snug text-muted-foreground">
                {t("home.friends.line")}
              </p>
              <div className="grid grid-cols-2 gap-2 mt-1.5">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => navigate(SHELL_ROUTES.duels)}
                  data-testid="home-friends-link"
                >
                  <Send size={16} strokeWidth={2.5} aria-hidden />
                  {t("home.friends.link")}
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => navigate(SHELL_ROUTES.arena)}
                  data-testid="home-friends-room"
                >
                  <Radio size={16} strokeWidth={2.5} aria-hidden />
                  {t("home.friends.room")}
                </Button>
              </div>
            </Card>
          </section>

          {/* MORE GAMES — collapsed by default. The closed row names what is
              inside, so nothing is hidden behind a bare "more". */}
          <section className="flex flex-col gap-2" aria-labelledby="home-more">
            <Eyebrow id="home-more" className="font-bold">
              {t("home.more.eyebrow")}
            </Eyebrow>
            <Card
              interactive
              elevation="raised"
              padding="md"
              aria-expanded={moreOpen}
              aria-controls="home-more-games"
              onClick={() => setMoreOpen((open) => !open)}
              className="flex items-center gap-3 md:flex-1"
              data-testid="home-more-toggle"
            >
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="font-heading text-title-sm font-bold leading-tight">
                  {t("home.more.title", { count: more.length })}
                </span>
                <span className="text-meta text-muted-foreground line-clamp-2">
                  {more.map((tile) => t(`modes.${tile.key}.name`)).join(" · ")}
                </span>
              </span>
              <ChevronDown
                size={22}
                strokeWidth={2.5}
                aria-hidden
                className={cn("shrink-0 transition-transform duration-ui", moreOpen && "rotate-180")}
              />
            </Card>
          </section>

          {moreOpen && (
            <div
              id="home-more-games"
              className="grid grid-cols-2 md:grid-cols-4 gap-3 md:col-span-3"
              data-testid="home-more-games"
            >
              {more.map((tile) => (
                <ModeTile
                  key={tile.key}
                  mode={tile.color}
                  icon={tile.icon}
                  name={t(`modes.${tile.key}.name`)}
                  line={t(`modes.${tile.key}.desc`)}
                  // Ranked-ness is the tile's own flag (it writes ELO), never
                  // a key list here.
                  status={tile.ranked ? t("ranks.rankedChip") : null}
                  onClick={() => navigate(targetFor(tile.key, tile.to))}
                  className="min-h-[132px]"
                />
              ))}
            </div>
          )}
        </div>

        {/* Support nudge — a small line at the foot of Play; on mobile it sits
            below the content in the scroll column, on desktop it pins under
            the grid. Links out to Buy Me a Coffee (new tab). */}
        <p className="shrink-0 text-center text-meta text-muted-foreground pt-4 pb-1">
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
