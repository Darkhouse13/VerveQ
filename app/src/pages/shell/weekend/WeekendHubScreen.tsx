/**
 * THE WEEKEND — the matchday hub (FW-GO, inverted FW-IMMERSE A4).
 *
 * The weekend itself is the hero: a countdown to the next kickoff, the
 * fixtures rail, and — once you have a squad — your points ticking in as
 * fixtures score. The four mode doors are actions within the place, not the
 * whole place.
 *
 * Still the mode's PUBLIC front door (ShellGate only): a short-link visitor
 * sees the weekend before being asked for anything. The board line is
 * informational and fail-open exactly as before; the fixtures payload loads
 * imperatively and fail-quiet (a prod backend that predates the query just
 * renders the hub without the matchday hero — the FW-P1 teaser discipline).
 * Squad status reads getSquadScore, which answers null for a visitor with no
 * session — the card simply doesn't render. The provisional/settled label
 * derives from the settlement stamp the server read, never from the clock
 * (FW-4 N2).
 *
 * VerveQ ONE P4.1: on the ui primitives. While the fixtures payload loads,
 * the hero and the rail hold their space as skeletons of the same height, so
 * the doors never jump down when the payload lands (prod measured CLS 0.29:
 * a 299px push at ~1.2s).
 */
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useConvex, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { CalendarRange, ChevronRight, Gavel, HelpCircle, Trophy, Users, Vote, Wallet } from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import { formatPoints } from "../../../../convex/lib/fantasyScoring";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Eyebrow } from "@/components/ui/eyebrow";
import { IconButton } from "@/components/ui/icon-button";
import { ModeTile } from "@/components/ui/mode-tile";
import { Skeleton } from "@/components/ui/skeleton";
import { ShellLayout } from "@/components/shell/ShellLayout";
import { SHELL_ROUTES } from "@/lib/shellRoutes";
import { WeekendLeaguesLine } from "@/components/weekend/WeekendLeaguesLine";
import { FavoriteClubCard } from "@/components/weekend/FavoriteClubCard";
import { leagueName } from "@/lib/leagueNames";
import {
  countdownLabel,
  fixtureDisplayKind,
  fixtureScoreline,
  nextKickoffAt,
  weekendPulse,
} from "@/lib/weekendFixtures";
import { FixturesView } from "./FixturesScreen";
import type { WeekendFixturesPayload, WeekendFixtureRow } from "./FixturesScreen";
import { useWideScreen } from "@/hooks/useWideScreen";
import { useWeekendRankMovement } from "@/hooks/useWeekendRankMovement";

const RAIL_CAP = 12;

// Fixed heights shared by the real blocks and their loading skeletons, so the
// swap from one to the other moves nothing below them.
const HERO_HEIGHT = "min-h-40";
const RAIL_CARD = "h-32 w-40";

// ── the matchday hero ──

export function MatchdayHero({
  gwNumber,
  payload,
  now,
}: {
  gwNumber: number | null;
  payload: WeekendFixturesPayload | null;
  now: number;
}) {
  const { t } = useTranslation();

  if (payload === null) return null;
  const pulse = weekendPulse(payload.fixtures, now);
  const next = nextKickoffAt(payload.fixtures, now);

  let headline: string;
  let big: string;
  let teaser: string | null = null;
  if (next !== null) {
    headline =
      pulse.inPlay === 0 && pulse.played === 0
        ? t("weekend.firstKickoffIn", { defaultValue: "First kickoff in" })
        : t("weekend.nextKickoffIn", { defaultValue: "Next kickoff in" });
    big = countdownLabel(next, now, (d, h) =>
      t("weekend.countdownDays", { defaultValue: "{{d}}d {{h}}h", d, h }),
    );
    const upNext = payload.fixtures.filter(
      (f) => f.status === "scheduled" && f.kickoffAt === next,
    );
    if (upNext.length > 0) {
      const first = upNext[0];
      const line = `${first.homeName ?? first.homeClubId} v ${first.awayName ?? first.awayClubId} · ${leagueName(first.leagueId)}`;
      teaser =
        upNext.length > 1
          ? t("weekend.kickoffTeaserMore", {
              defaultValue: "{{line}} +{{n}} more",
              line,
              n: upNext.length - 1,
            })
          : line;
    }
  } else if (pulse.inPlay > 0) {
    headline = t("weekend.inPlayNow", { defaultValue: "In play now" });
    big = String(pulse.inPlay);
    teaser = t("weekend.inPlayTeaser", {
      defaultValue: "{{n}} of {{total}} fixtures under way",
      n: pulse.inPlay,
      total: pulse.total,
    });
  } else if (pulse.total > 0) {
    headline = t("weekend.weekendPlayed", { defaultValue: "Weekend played" });
    big = `${pulse.scored}/${pulse.total}`;
    teaser = t("weekend.weekendPlayedTeaser", {
      defaultValue: "fixtures with points landed",
    });
  } else {
    return null;
  }

  return (
    <Card
      elevation="lifted"
      className={`${HERO_HEIGHT} flex flex-col items-center justify-center gap-1 text-center`}
      data-testid="matchday-hero"
    >
      <Eyebrow>
        {gwNumber !== null
          ? t("weekend.matchdayEyebrow", {
              defaultValue: "Gameweek {{gw}} · {{headline}}",
              gw: gwNumber,
              headline,
            })
          : headline}
      </Eyebrow>
      <p
        className="font-mono text-display font-bold tabular-nums"
        data-testid="matchday-countdown"
      >
        {big}
      </p>
      {teaser !== null && (
        <p className="w-full truncate px-2 text-meta text-muted-foreground">{teaser}</p>
      )}
      {(pulse.inPlay > 0 || pulse.played > 0) && next !== null && (
        <Eyebrow className="mt-1">
          {t("weekend.pulseLine", {
            defaultValue: "{{inPlay}} in play · {{played}} played · {{scored}} scored",
            inPlay: pulse.inPlay,
            played: pulse.played,
            scored: pulse.scored,
          })}
        </Eyebrow>
      )}
    </Card>
  );
}

// ── the fixtures rail ──

function railRank(fixture: WeekendFixtureRow, now: number): number {
  const kind = fixtureDisplayKind(fixture, now);
  if (kind === "live" || kind === "started") return 0;
  if (kind === "upcoming") return 1;
  if (kind === "played") return 2;
  return 3;
}

/** The rail/panel header: which leagues play this gameweek + "All fixtures". */
function FixturesHeader({
  leagueIds,
  onOpenFixtures,
}: {
  leagueIds?: ReadonlyArray<number>;
  onOpenFixtures: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-11 items-center justify-between gap-2">
      {leagueIds !== undefined && leagueIds.length > 0 ? (
        <WeekendLeaguesLine leagueIds={leagueIds} testid="weekend-hub-leagues-line" className="min-w-0" />
      ) : (
        <Eyebrow as="span" className="font-bold">
          {t("weekend.railTitle", { defaultValue: "This gameweek" })}
        </Eyebrow>
      )}
      <Button
        variant="ghost"
        size="sm"
        data-testid="fixtures-rail-all"
        onClick={onOpenFixtures}
        className="-mr-2 shrink-0 gap-1 px-2"
      >
        {t("weekend.allFixtures", { defaultValue: "All fixtures" })}
        <ChevronRight size={16} strokeWidth={2.5} aria-hidden />
      </Button>
    </div>
  );
}

export function FixturesRail({
  payload,
  now,
  leagueIds,
  onOpenFixtures,
}: {
  payload: WeekendFixturesPayload;
  now: number;
  /** FW-RECEIPT P1: the rail header IS the "This gameweek" line, so it carries
   *  the leagues chip/expander — one statement of the window, not two. */
  leagueIds?: ReadonlyArray<number>;
  onOpenFixtures: () => void;
}) {
  const { t, i18n } = useTranslation();

  const rail = useMemo(() => {
    return [...payload.fixtures]
      .sort((a, b) => {
        const rank = railRank(a, now) - railRank(b, now);
        if (rank !== 0) return rank;
        // In play & upcoming read forward (earliest first); played read
        // backward (latest final whistle first).
        return railRank(a, now) === 2 ? b.kickoffAt - a.kickoffAt : a.kickoffAt - b.kickoffAt;
      })
      .slice(0, RAIL_CAP);
  }, [payload.fixtures, now]);

  if (rail.length === 0) return null;

  return (
    <div data-testid="fixtures-rail">
      <FixturesHeader leagueIds={leagueIds} onOpenFixtures={onOpenFixtures} />
      <div className="-mx-5 flex gap-2 overflow-x-auto overflow-y-hidden px-5 pb-2 pt-1 scrollbar-none">
        {rail.map((fixture) => {
          const kind = fixtureDisplayKind(fixture, now);
          const score = fixtureScoreline(fixture, now);
          const kickoff = new Date(fixture.kickoffAt);
          // The card's top line says WHEN (or the result); the day is always
          // named, because a gameweek can run Tuesday to Monday.
          const when =
            score !== null
              ? `${
                  kind === "live" || kind === "started"
                    ? t("weekend.fixtureLive", { defaultValue: "Live" })
                    : t("weekend.fixtureFt", { defaultValue: "FT" })
                } · ${score.home}–${score.away}`
              : kind === "void"
                ? t("weekend.fixtureVoid", { defaultValue: "OFF" })
                : `${kickoff.toLocaleDateString(i18n.language, { weekday: "short" })} ${kickoff.toLocaleTimeString(
                    i18n.language,
                    { hour: "numeric", minute: "2-digit" },
                  )}`;
          return (
            <Card
              key={fixture.fixtureId}
              interactive
              elevation="raised"
              padding="sm"
              data-testid="fixtures-rail-card"
              onClick={onOpenFixtures}
              className={`${RAIL_CARD} flex shrink-0 flex-col gap-1`}
            >
              <span
                className={`font-mono text-eyebrow font-bold uppercase tabular-nums ${
                  kind === "live" || kind === "started" ? "text-primary" : "text-muted-foreground"
                }`}
              >
                {when}
              </span>
              {/* Home v Away as one phrase: names wrap instead of truncating,
                  and the "v" keeps two clubs from reading as one. */}
              <span className="line-clamp-3 break-words font-heading text-body-sm font-bold leading-tight">
                {fixture.homeName ?? fixture.homeClubId}{" "}
                <span className="font-normal text-muted-foreground">v</span>{" "}
                {fixture.awayName ?? fixture.awayClubId}
              </span>
              <span className="mt-auto truncate font-mono text-eyebrow uppercase text-muted-foreground">
                {leagueName(fixture.leagueId)}
                {fixture.scored && ` · ${t("weekend.fixturePointsIn", { defaultValue: "points in" })}`}
              </span>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// ── your matchday (squad status) ──

export type SquadScorePayload = NonNullable<
  FunctionReturnType<typeof api.fantasyScores.getSquadScore>
>;

export function SquadStatusCard({
  score,
  standing,
  onOpen,
}: {
  score: SquadScorePayload & { gwNumber: number };
  standing?: {
    rank: number;
    ranked: number;
    gap: number | null;
    movement: number | null;
  };
  onOpen: () => void;
}) {
  const { t } = useTranslation();
  const settled = score.state === "final" && score.awaitingSlots === 0;
  const anythingScored = score.scoredSlots > 0 || score.awaitingSlots > 0;

  return (
    <Card
      interactive
      elevation="lifted"
      onClick={onOpen}
      // R4: your squad is outlined in lime, never filled with it.
      className="flex items-center justify-between gap-3 !border-lime"
      data-testid="squad-status-card"
    >
      <div className="min-w-0">
        <Eyebrow>
          {t("weekend.yourThirteen", { defaultValue: "Your 13 · GW {{gw}}", gw: score.gwNumber })}
        </Eyebrow>
        {score.emptySlots > 0 ? (
          <p className="mt-0.5 font-heading text-title-sm font-bold">
            {t("weekend.squadUnfinished", {
              defaultValue: "{{n}} spots still open",
              n: score.emptySlots,
            })}
          </p>
        ) : anythingScored ? (
          <p className="mt-0.5 flex flex-wrap items-baseline gap-x-1.5 font-heading text-title-sm font-bold">
            <span>
              {formatPoints(score.total)}{" "}
              <span className="text-body-sm">{t("weekend.pts", { defaultValue: "pts" })}</span>
            </span>
            <Badge tone={settled ? "right" : "muted"} shape="tag">
              {settled
                ? t("weekend.settled", { defaultValue: "settled" })
                : t("weekend.provisional", { defaultValue: "provisional" })}
            </Badge>
          </p>
        ) : (
          <p className="mt-0.5 font-heading text-title-sm font-bold">
            {t("weekend.squadReady", { defaultValue: "Your 13 is in" })}
          </p>
        )}
        <p className="mt-0.5 text-meta text-muted-foreground">
          {score.emptySlots > 0
            ? t("weekend.squadUnfinishedBody", {
                defaultValue: "Every player locks at his own kickoff.",
              })
            : score.awaitingSlots > 0
              ? t("weekend.slotsAwaitingBody", {
                  defaultValue: "{{count}} awaiting · points land ~2h after full time",
                  count: score.awaitingSlots,
                })
              : anythingScored
                ? t("weekend.squadScoredBody", {
                    defaultValue: "{{n}} of 13 scored",
                    n: score.scoredSlots,
                  })
                : t("weekend.squadReadyBody", {
                    defaultValue: "Points land ~2h after each full time.",
                  })}
        </p>
        {standing !== undefined && (
          <p
            className="mt-1.5 font-mono text-eyebrow font-bold uppercase"
            data-testid="weekend-hub-rank"
          >
            {settled
              ? t("weekend.finishedRank", {
                  defaultValue: "Finished #{{rank}} · top {{percent}}%",
                  rank: standing.rank,
                  percent: Math.ceil((standing.rank / standing.ranked) * 100),
                })
              : standing.gap === null
                ? t("weekend.leadingGlobal", {
                    defaultValue: "#{{rank}} globally · leading",
                    rank: standing.rank,
                  })
                : t("weekend.globalRankGap", {
                    defaultValue: "#{{rank}} globally · {{points}} pts to next",
                    rank: standing.rank,
                    points: formatPoints(standing.gap),
                  })}
            {standing.movement !== null && standing.movement > 0
              ? ` · ${t("weekend.upPlaces", {
                  defaultValue: "up {{count}}",
                  count: standing.movement,
                })}`
              : ""}
          </p>
        )}
      </div>
      <ChevronRight size={20} strokeWidth={2.5} className="shrink-0" aria-hidden />
    </Card>
  );
}

// ── loading placeholders (same footprint as the real blocks) ──

function HeroSkeleton() {
  return <Skeleton className={`${HERO_HEIGHT} neo-border`} data-testid="matchday-hero-skeleton" />;
}

function RailSkeleton() {
  return (
    <div aria-hidden="true">
      <div className="flex min-h-11 items-center">
        <Skeleton className="h-4 w-40" />
      </div>
      <div className="-mx-5 flex gap-2 overflow-hidden px-5 pb-2 pt-1">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className={`${RAIL_CARD} shrink-0`} />
        ))}
      </div>
    </div>
  );
}

type FixturesState =
  | { state: "loading" }
  | { state: "none" }
  | { state: "ready"; payload: WeekendFixturesPayload };

export default function WeekendHubScreen() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const convex = useConvex();
  // Informational only — see the header. `undefined` = still loading, `null` =
  // no open board; both render the hub in full.
  const gameweek = useQuery(api.fantasyMarket.getOpenGameweek, {});
  // D4: say which leagues actually play this window — a partial gameweek is a
  // feature, not emptiness. Fixture-derived, renders only with data in hand.
  const weekendLeagues = useQuery(api.fantasyMarket.getWeekendLeagues, {});

  // A4: the matchday payload — imperative and fail-quiet so a backend that
  // predates getWeekendFixtures renders the hub exactly as before.
  const [fixturesState, setFixturesState] = useState<FixturesState>({ state: "loading" });
  useEffect(() => {
    let cancelled = false;
    convex
      .query(api.fantasyMarket.getWeekendFixtures, {})
      .then((payload) => {
        if (cancelled) return;
        setFixturesState(payload === null ? { state: "none" } : { state: "ready", payload });
      })
      .catch(() => {
        if (!cancelled) setFixturesState({ state: "none" });
      });
    return () => {
      cancelled = true;
    };
  }, [convex]);
  const fixtures = fixturesState.state === "ready" ? fixturesState.payload : null;
  const fixturesLoading = fixturesState.state === "loading";

  // Your squad's weekend — null for visitors without a session or squad, so
  // the card renders only when there is a squad to speak of.
  const squadScore = useQuery(
    api.fantasyScores.getSquadScore,
    gameweek == null
      ? "skip"
      : { gameweekId: gameweek.gameweekId, context: "budget" as const },
  );
  const leaderboard = useQuery(
    api.fantasyScores.getWeekendLeaderboard,
    gameweek == null ? "skip" : { gameweekId: gameweek.gameweekId },
  );
  const myRankIndex = leaderboard?.rows.findIndex((row) => row.isYou) ?? -1;
  const myRank = myRankIndex < 0 ? null : leaderboard!.rows[myRankIndex];
  const rankAbove = myRankIndex > 0 ? leaderboard!.rows[myRankIndex - 1] : null;
  const rankGap =
    myRank === null || rankAbove === null ? null : Math.max(0, rankAbove.total - myRank.total);
  const rankMovement = useWeekendRankMovement(
    gameweek?.gameweekId ?? null,
    myRank?.rank ?? null,
  );

  // One-second heartbeat while a countdown is on screen; a lazy 30s otherwise.
  const [now, setNow] = useState(() => Date.now());
  const counting = fixtures !== null && nextKickoffAt(fixtures.fixtures, now) !== null;
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), counting ? 1000 : 30_000);
    return () => clearInterval(timer);
  }, [counting]);

  // B1: wide screens hold the weekend's fixtures as a persistent side panel
  // instead of the horizontal rail — same payload, same day grouping as the
  // fixtures screen itself. The panel's column is laid out while the payload
  // loads too, so the main column never re-flows when it lands.
  const wide = useWideScreen();
  const showFixturesPanel = wide && fixturesState.state !== "none";
  const leagueIds = weekendLeagues?.leagues.map((l) => l.leagueId);

  return (
    <ShellLayout
      theme="theme-weekend"
      title={t("weekend.hubTitle", { defaultValue: "The Weekend" })}
      subtitle={t("weekend.hubSubtitle", {
        defaultValue: "Eight leagues, one squad.",
      })}
      headerRight={
        // U3: the rules screen's natural front door.
        <IconButton
          variant="secondary"
          aria-label={t("weekend.howToPlayTitle", { defaultValue: "How to play" })}
          data-testid="weekend-how-to-play-button"
          onClick={() => navigate(SHELL_ROUTES.weekendHowToPlay)}
        >
          <HelpCircle aria-hidden />
        </IconButton>
      }
      scroll
    >
      <div
        className={
          showFixturesPanel
            ? "mx-auto grid w-full max-w-5xl grid-cols-[minmax(0,1fr)_minmax(340px,400px)] items-start gap-6 pb-4"
            : "flex flex-col gap-4 pb-4 md:mx-auto md:w-full md:max-w-md"
        }
      >
        <div className="flex min-w-0 flex-col gap-4">
          <div className="flex min-h-6 items-center gap-2" data-testid="weekend-hub-board-line">
            <CalendarRange size={16} strokeWidth={2.5} className="shrink-0 text-muted-foreground" aria-hidden />
            {gameweek ? (
              <>
                <Eyebrow className="font-bold">
                  {t("weekend.boardOpen", {
                    defaultValue: "Gameweek {{gw}} board is open",
                    gw: gameweek.gwNumber,
                  })}
                </Eyebrow>
                <Badge tone="right">{t("weekend.live", { defaultValue: "Live" })}</Badge>
              </>
            ) : (
              <Eyebrow className="font-bold">
                {t("weekend.boardBetween", {
                  defaultValue: "Fresh board opens for each weekend",
                })}
              </Eyebrow>
            )}
          </div>
          {/* P1: the leagues line lives in the fixtures-rail header (one "This
              gameweek" on the hub, not two). It renders here standalone only
              on the fail-quiet path — a backend without the fixtures payload
              has no rail to carry it. */}
          {fixturesState.state === "none" && leagueIds !== undefined && leagueIds.length > 0 && (
            <WeekendLeaguesLine leagueIds={leagueIds} testid="weekend-hub-leagues-line" className="-mt-2" />
          )}

          {fixturesLoading ? (
            <HeroSkeleton />
          ) : (
            <MatchdayHero
              gwNumber={gameweek?.gwNumber ?? fixtures?.gwNumber ?? null}
              payload={fixtures}
              now={now}
            />
          )}

          {squadScore != null && gameweek != null && (
            <SquadStatusCard
              score={{ ...squadScore, gwNumber: gameweek.gwNumber }}
              standing={
                myRank === null || leaderboard === undefined
                  ? undefined
                  : {
                      rank: myRank.rank,
                      ranked: leaderboard.ranked,
                      gap: rankGap,
                      movement: rankMovement,
                    }
              }
              onOpen={() => navigate(SHELL_ROUTES.weekendSquad)}
            />
          )}

          {!showFixturesPanel &&
            (fixturesLoading ? (
              <RailSkeleton />
            ) : fixtures !== null ? (
              <FixturesRail
                payload={fixtures}
                now={now}
                leagueIds={leagueIds}
                onOpenFixtures={() => navigate(SHELL_ROUTES.weekendFixtures)}
              />
            ) : null)}

          <Eyebrow as="div" className="-mb-1 font-bold">
            {t("weekend.playTitle", { defaultValue: "Play the weekend" })}
          </Eyebrow>
          <ModeTile
            layout="row"
            mode="surface"
            elevation="lifted"
            icon={Trophy}
            name={t("weekend.leaderboardTitle", { defaultValue: "Leaderboard" })}
            line={t("weekend.leaderboardDoorBody", {
              defaultValue: "See how every budget squad is scoring.",
            })}
            onClick={() => navigate(SHELL_ROUTES.weekendLeaderboard)}
            data-testid="weekend-door-leaderboard"
          />
          <div className="grid grid-cols-2 gap-3">
            {/* The budget squad is the hub's one action: lime OUTLINE (R4 —
                lime is never a large fill), the other doors keep their mode
                accents. */}
            <ModeTile
              mode="outline"
              elevation="lifted"
              icon={Wallet}
              name={t("weekend.doorSquadTitle", { defaultValue: "Budget squad" })}
              line={t("weekend.doorSquadBodyShort", { defaultValue: "A fresh 13 under budget." })}
              onClick={() => navigate(SHELL_ROUTES.weekendSquad)}
              data-testid="weekend-door-squad"
            />
            <ModeTile
              mode="pink"
              elevation="lifted"
              icon={Users}
              name={t("weekend.doorCrewsTitle", { defaultValue: "Crew draft" })}
              line={t("weekend.doorCrewsBodyShort", { defaultValue: "One code, unique picks." })}
              onClick={() => navigate(SHELL_ROUTES.weekendCrews)}
              data-testid="weekend-door-crews"
            />
            <ModeTile
              mode="yellow"
              elevation="lifted"
              icon={Vote}
              name={t("weekend.doorVoteTitle", { defaultValue: "Rate the weekend" })}
              line={t("weekend.doorVoteBodyShort", { defaultValue: "The crowd moves every score." })}
              onClick={() => navigate(SHELL_ROUTES.weekendVote)}
              data-testid="weekend-door-vote"
            />
            <ModeTile
              mode="blue"
              elevation="lifted"
              icon={Gavel}
              name={t("weekend.doorCourtTitle", { defaultValue: "Reclamation court" })}
              line={t("weekend.doorCourtBodyShort", { defaultValue: "Argue a player's real position." })}
              onClick={() => navigate(SHELL_ROUTES.weekendCourt)}
              data-testid="weekend-door-court"
            />
          </div>
          {/* The profile-level favorite club (exempt from the 3-per-club cap).
              Renders nothing for anonymous visitors. */}
          <FavoriteClubCard />
        </div>

        {showFixturesPanel && (
          <aside
            data-testid="hub-fixtures-panel"
            // FW-NIT1: a real vertical scroller wears the themed thin bar —
            // scrollbar-none stays reserved for horizontal chip rows.
            className="sticky top-2 flex max-h-[calc(100dvh-9rem)] min-w-0 flex-col gap-2 overflow-y-auto pb-2 pr-1"
          >
            <FixturesHeader
              leagueIds={leagueIds}
              onOpenFixtures={() => navigate(SHELL_ROUTES.weekendFixtures)}
            />
            {fixtures !== null ? (
              <FixturesView payload={fixtures} now={now} />
            ) : (
              <div className="flex flex-col gap-2" aria-hidden="true">
                {[0, 1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-20" />
                ))}
              </div>
            )}
          </aside>
        )}
      </div>
    </ShellLayout>
  );
}
