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
 */
import { useEffect, useMemo, useState, type ComponentProps } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useConvex, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import {
  CalendarRange,
  ChevronRight,
  Gavel,
  HelpCircle,
  Users,
  Vote,
  Wallet,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import { formatPoints } from "../../../../convex/lib/fantasyScoring";
import { NeoCard } from "@/components/neo/NeoCard";
import { NeoBadge } from "@/components/neo/NeoBadge";
import { ShellLayout } from "@/components/shell/ShellLayout";
import { SHELL_ROUTES } from "@/lib/shellRoutes";
import { WeekendLeaguesLine } from "@/components/weekend/WeekendLeaguesLine";
import { leagueName } from "@/lib/leagueNames";
import {
  countdownParts,
  fixtureDisplayKind,
  fixtureScoreline,
  nextKickoffAt,
  weekendPulse,
} from "@/lib/weekendFixtures";
import { FixturesView } from "./FixturesScreen";
import type {
  WeekendFixturesPayload,
  WeekendFixtureRow,
} from "./FixturesScreen";
import { useWideScreen } from "@/hooks/useWideScreen";

type NeoColor = NonNullable<ComponentProps<typeof NeoCard>["color"]>;

const RAIL_CAP = 12;

function two(n: number): string {
  return n.toString().padStart(2, "0");
}

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
    const parts = countdownParts(next, now);
    big = `${two(parts.hours)}:${two(parts.minutes)}:${two(parts.seconds)}`;
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
    <NeoCard shadow="lg" className="text-center py-4" data-testid="matchday-hero">
      <p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
        {gwNumber !== null
          ? t("weekend.matchdayEyebrow", {
              defaultValue: "Gameweek {{gw}} · {{headline}}",
              gw: gwNumber,
              headline,
            })
          : headline}
      </p>
      <p
        className="font-mono font-bold text-4xl tabular-nums tracking-tight mt-1"
        data-testid="matchday-countdown"
      >
        {big}
      </p>
      {teaser !== null && (
        <p className="text-[11px] text-muted-foreground mt-1 truncate px-2">{teaser}</p>
      )}
      {(pulse.inPlay > 0 || pulse.played > 0) && next !== null && (
        <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground mt-2">
          {t("weekend.pulseLine", {
            defaultValue: "{{inPlay}} in play · {{played}} played · {{scored}} scored",
            inPlay: pulse.inPlay,
            played: pulse.played,
            scored: pulse.scored,
          })}
        </p>
      )}
    </NeoCard>
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

export function FixturesRail({
  payload,
  now,
  leagueIds,
  onOpenFixtures,
}: {
  payload: WeekendFixturesPayload;
  now: number;
  /** FW-RECEIPT P1: the rail header IS the "This weekend" line, so it carries
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
      <div className="flex items-baseline justify-between gap-2 mb-2">
        {leagueIds !== undefined && leagueIds.length > 0 ? (
          <WeekendLeaguesLine
            leagueIds={leagueIds}
            testid="weekend-hub-leagues-line"
            className="min-w-0"
          />
        ) : (
          <h2 className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
            {t("weekend.railTitle", { defaultValue: "This weekend" })}
          </h2>
        )}
        <button
          type="button"
          data-testid="fixtures-rail-all"
          onClick={onOpenFixtures}
          className="shrink-0 font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-primary flex items-center gap-0.5 active:opacity-60"
        >
          {t("weekend.allFixtures", { defaultValue: "All fixtures" })}
          <ChevronRight size={12} strokeWidth={3} aria-hidden />
        </button>
      </div>
      <div className="flex gap-2 overflow-x-auto overflow-y-hidden scrollbar-none -mx-5 px-5 pb-1">
        {rail.map((fixture) => {
          const kind = fixtureDisplayKind(fixture, now);
          const score = fixtureScoreline(fixture, now);
          return (
            <button
              key={fixture.fixtureId}
              type="button"
              data-testid="fixtures-rail-card"
              onClick={onOpenFixtures}
              className="shrink-0 w-[150px] neo-border rounded-lg bg-card text-card-foreground neo-shadow-sm px-2.5 py-2 text-left active:neo-shadow-pressed"
            >
              {/* P3: a grid rather than two stacked columns, so each score
                  number stays row-paired with its club name when a long name
                  wraps to a second line (clamped at two). */}
              <span className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-1.5 items-center">
                <span className="text-[11px] font-heading font-bold leading-tight line-clamp-2 break-words">
                  {fixture.homeName ?? fixture.homeClubId}
                </span>
                {score !== null ? (
                  <span className="font-mono font-bold text-sm tabular-nums leading-tight text-right">
                    {score.home}
                  </span>
                ) : kind === "void" ? (
                  <span className="row-span-2 font-mono text-[10px] text-muted-foreground text-right">
                    {t("weekend.fixtureVoid", { defaultValue: "OFF" })}
                  </span>
                ) : (
                  <span className="row-span-2 font-mono text-[11px] tabular-nums text-right whitespace-nowrap">
                    <span className="block text-[9px] uppercase text-muted-foreground">
                      {new Date(fixture.kickoffAt).toLocaleDateString(i18n.language, {
                        weekday: "short",
                      })}
                    </span>
                    {new Date(fixture.kickoffAt).toLocaleTimeString(i18n.language, {
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </span>
                )}
                <span className="text-[11px] font-heading font-bold leading-tight line-clamp-2 break-words">
                  {fixture.awayName ?? fixture.awayClubId}
                </span>
                {score !== null && (
                  <span className="font-mono font-bold text-sm tabular-nums leading-tight text-right">
                    {score.away}
                  </span>
                )}
              </span>
              <span className="block font-mono text-[9px] uppercase tracking-[0.1em] text-muted-foreground truncate mt-1">
                {kind === "live" || kind === "started" ? (
                  <span className="text-primary font-bold">
                    {t("weekend.fixtureLive", { defaultValue: "Live" })} ·{" "}
                  </span>
                ) : kind === "played" ? (
                  `${t("weekend.fixtureFt", { defaultValue: "FT" })} · `
                ) : null}
                {leagueName(fixture.leagueId)}
                {fixture.scored &&
                  ` · ${t("weekend.fixturePointsIn", { defaultValue: "points in" })}`}
              </span>
            </button>
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
  onOpen,
}: {
  score: SquadScorePayload & { gwNumber: number };
  onOpen: () => void;
}) {
  const { t } = useTranslation();
  const settled = score.state === "final" && score.awaitingSlots === 0;
  const anythingScored = score.scoredSlots > 0 || score.awaitingSlots > 0;

  return (
    <NeoCard
      shadow="lg"
      color={settled ? "success" : "accent"}
      onClick={onOpen}
      className="flex items-center justify-between gap-3 text-left"
      data-testid="squad-status-card"
    >
      <div className="min-w-0">
        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] opacity-70">
          {t("weekend.yourThirteen", { defaultValue: "Your 13 · GW {{gw}}", gw: score.gwNumber })}
        </p>
        {score.emptySlots > 0 ? (
          <p className="font-heading font-bold text-lg leading-tight mt-0.5">
            {t("weekend.squadUnfinished", {
              defaultValue: "{{n}} spots still open",
              n: score.emptySlots,
            })}
          </p>
        ) : anythingScored ? (
          <p className="font-heading font-bold text-lg leading-tight mt-0.5">
            {formatPoints(score.total)}{" "}
            <span className="text-sm">{t("weekend.pts", { defaultValue: "pts" })}</span>
            <span className="font-mono text-[10px] uppercase tracking-wide ml-1.5 opacity-70">
              {settled
                ? t("weekend.settled", { defaultValue: "settled" })
                : t("weekend.provisional", { defaultValue: "provisional" })}
            </span>
          </p>
        ) : (
          <p className="font-heading font-bold text-lg leading-tight mt-0.5">
            {t("weekend.squadReady", { defaultValue: "Your 13 is in" })}
          </p>
        )}
        <p className="text-[11px] opacity-80 mt-0.5">
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
      </div>
      <ChevronRight size={18} strokeWidth={3} className="shrink-0" aria-hidden />
    </NeoCard>
  );
}

// ── the doors, compact ──

function HubDoor({
  icon: Icon,
  color,
  title,
  body,
  onClick,
  testId,
}: {
  icon: LucideIcon;
  color: NeoColor;
  title: string;
  body: string;
  onClick: () => void;
  testId: string;
}) {
  return (
    <NeoCard
      color={color}
      shadow="lg"
      onClick={onClick}
      className="flex flex-col items-start gap-2 text-left"
      data-testid={testId}
    >
      <div className="neo-border rounded-lg bg-background p-2 shrink-0">
        <Icon size={18} strokeWidth={2.5} className="text-foreground" />
      </div>
      <div className="min-w-0">
        <p className="font-heading font-bold text-base leading-tight">{title}</p>
        <p className="text-[11px] opacity-75 mt-0.5 leading-snug">{body}</p>
      </div>
    </NeoCard>
  );
}

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
  const [fixtures, setFixtures] = useState<WeekendFixturesPayload | null>(null);
  useEffect(() => {
    let cancelled = false;
    convex
      .query(api.fantasyMarket.getWeekendFixtures, {})
      .then((payload) => {
        if (!cancelled && payload !== null) setFixtures(payload);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [convex]);

  // Your squad's weekend — null for visitors without a session or squad, so
  // the card renders only when there is a squad to speak of.
  const squadScore = useQuery(
    api.fantasyScores.getSquadScore,
    gameweek == null
      ? "skip"
      : { gameweekId: gameweek.gameweekId, context: "budget" as const },
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
  // fixtures screen itself.
  const wide = useWideScreen();
  const showFixturesPanel = wide && fixtures !== null;

  return (
    <ShellLayout
      theme="theme-weekend"
      title={t("weekend.hubTitle", { defaultValue: "The Weekend" })}
      subtitle={t("weekend.hubSubtitle", {
        defaultValue: "Eight leagues, one squad.",
      })}
      back
      onBack={() => navigate(SHELL_ROUTES.compete)}
      headerRight={
        // U3: the rules screen's natural front door.
        <button
          type="button"
          aria-label={t("weekend.howToPlayTitle", { defaultValue: "How to play" })}
          data-testid="weekend-how-to-play-button"
          className="neo-border neo-shadow rounded-lg w-9 h-9 flex items-center justify-center bg-card active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
          onClick={() => navigate(SHELL_ROUTES.weekendHowToPlay)}
        >
          <HelpCircle size={16} strokeWidth={3} />
        </button>
      }
      scroll
    >
      <div
        className={
          showFixturesPanel
            ? "grid grid-cols-[minmax(0,1fr)_minmax(340px,400px)] gap-6 items-start max-w-5xl mx-auto w-full pb-4"
            : "flex flex-col gap-4 md:max-w-md md:mx-auto md:w-full pb-4"
        }
      >
      <div className="flex flex-col gap-4 min-w-0">
        <div className="flex items-center gap-2" data-testid="weekend-hub-board-line">
          <CalendarRange size={14} strokeWidth={3} className="text-muted-foreground shrink-0" />
          {gameweek ? (
            <>
              <p className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                {t("weekend.boardOpen", {
                  defaultValue: "Gameweek {{gw}} board is open",
                  gw: gameweek.gwNumber,
                })}
              </p>
              <NeoBadge color="accent">
                {t("weekend.live", { defaultValue: "Live" })}
              </NeoBadge>
            </>
          ) : (
            <p className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
              {t("weekend.boardBetween", {
                defaultValue: "Fresh board opens for each weekend",
              })}
            </p>
          )}
        </div>
        {/* P1: the leagues line lives in the fixtures-rail header (one "This
            weekend" on the hub, not two). It renders here standalone only on
            the fail-quiet path — a backend without the fixtures payload has
            no rail to carry it. */}
        {fixtures === null && weekendLeagues != null && weekendLeagues.leagues.length > 0 && (
          <WeekendLeaguesLine
            leagueIds={weekendLeagues.leagues.map((l) => l.leagueId)}
            testid="weekend-hub-leagues-line"
            className="-mt-2"
          />
        )}

        <MatchdayHero
          gwNumber={gameweek?.gwNumber ?? fixtures?.gwNumber ?? null}
          payload={fixtures}
          now={now}
        />

        {squadScore != null && gameweek != null && (
          <SquadStatusCard
            score={{ ...squadScore, gwNumber: gameweek.gwNumber }}
            onOpen={() => navigate(SHELL_ROUTES.weekendSquad)}
          />
        )}

        {fixtures !== null && !showFixturesPanel && (
          <FixturesRail
            payload={fixtures}
            now={now}
            leagueIds={weekendLeagues?.leagues.map((l) => l.leagueId)}
            onOpenFixtures={() => navigate(SHELL_ROUTES.weekendFixtures)}
          />
        )}

        <h2 className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground -mb-1">
          {t("weekend.playTitle", { defaultValue: "Play the weekend" })}
        </h2>
        <div className="grid grid-cols-2 gap-3">
          <HubDoor
            icon={Wallet}
            color="accent"
            title={t("weekend.doorSquadTitle", { defaultValue: "Budget squad" })}
            body={t("weekend.doorSquadBodyShort", {
              defaultValue: "A fresh 13 under budget.",
            })}
            onClick={() => navigate(SHELL_ROUTES.weekendSquad)}
            testId="weekend-door-squad"
          />
          <HubDoor
            icon={Users}
            color="pink"
            title={t("weekend.doorCrewsTitle", { defaultValue: "Crew draft" })}
            body={t("weekend.doorCrewsBodyShort", {
              defaultValue: "One code, unique picks.",
            })}
            onClick={() => navigate(SHELL_ROUTES.weekendCrews)}
            testId="weekend-door-crews"
          />
          <HubDoor
            icon={Vote}
            color="yellow"
            title={t("weekend.doorVoteTitle", { defaultValue: "Rate the weekend" })}
            body={t("weekend.doorVoteBodyShort", {
              defaultValue: "The crowd moves every score.",
            })}
            onClick={() => navigate(SHELL_ROUTES.weekendVote)}
            testId="weekend-door-vote"
          />
          <HubDoor
            icon={Gavel}
            color="blue"
            title={t("weekend.doorCourtTitle", { defaultValue: "Reclamation court" })}
            body={t("weekend.doorCourtBodyShort", {
              defaultValue: "Argue a player's real position.",
            })}
            onClick={() => navigate(SHELL_ROUTES.weekendCourt)}
            testId="weekend-door-court"
          />
        </div>
      </div>

      {showFixturesPanel && fixtures !== null && (
        <aside
          data-testid="hub-fixtures-panel"
          // FW-NIT1: a real vertical scroller wears the themed thin bar —
          // scrollbar-none stays reserved for horizontal chip rows.
          className="min-w-0 sticky top-2 max-h-[calc(100dvh-9rem)] overflow-y-auto flex flex-col gap-2 pb-2 pr-1"
        >
          <div className="flex items-baseline justify-between gap-2">
            {weekendLeagues != null && weekendLeagues.leagues.length > 0 ? (
              <WeekendLeaguesLine
                leagueIds={weekendLeagues.leagues.map((l) => l.leagueId)}
                testid="weekend-hub-leagues-line"
                className="min-w-0"
              />
            ) : (
              <h2 className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                {t("weekend.railTitle", { defaultValue: "This weekend" })}
              </h2>
            )}
            <button
              type="button"
              data-testid="fixtures-rail-all"
              onClick={() => navigate(SHELL_ROUTES.weekendFixtures)}
              className="shrink-0 font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-primary flex items-center gap-0.5 active:opacity-60"
            >
              {t("weekend.allFixtures", { defaultValue: "All fixtures" })}
              <ChevronRight size={12} strokeWidth={3} aria-hidden />
            </button>
          </div>
          <FixturesView payload={fixtures} now={now} />
        </aside>
      )}
      </div>
    </ShellLayout>
  );
}
