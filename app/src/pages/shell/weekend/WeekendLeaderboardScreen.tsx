/**
 * THE WEEKEND — the personal race, live gameweek table and season history.
 * Budget squads only. Opponent rosters are intentionally absent: the board
 * compares outcomes without creating an incentive to manipulate crowd ratings.
 */
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { Award, Flame, Radio, Target, TrendingUp, Trophy } from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import { formatPoints } from "../../../../convex/lib/fantasyScoring";
import { NeoBadge } from "@/components/neo/NeoBadge";
import { NeoCard } from "@/components/neo/NeoCard";
import { ShellLayout } from "@/components/shell/ShellLayout";
import { useWeekendRankMovement } from "@/hooks/useWeekendRankMovement";
import { SHELL_ROUTES } from "@/lib/shellRoutes";

type Board = NonNullable<FunctionReturnType<typeof api.fantasyScores.getWeekendLeaderboard>>;
type Row = Board["rows"][number];
type SeasonBoard = FunctionReturnType<typeof api.fantasyScores.getWeekendSeasonLeaderboard>;
type SeasonRow = SeasonBoard["rows"][number];

function rankColor(rank: number): "accent" | "blue" | "pink" | "muted" {
  if (rank === 1) return "accent";
  if (rank === 2) return "blue";
  if (rank === 3) return "pink";
  return "muted";
}

function percentile(rank: number, population: number): number {
  return population <= 0 ? 100 : Math.ceil((rank / population) * 100);
}

function LeaderboardRow({ row }: { row: Row }) {
  const { t } = useTranslation();
  return (
    <div
      data-testid={row.isYou ? "weekend-leaderboard-you" : "weekend-leaderboard-row"}
      className={`flex items-center gap-3 px-3 py-3 border-b-2 border-border last:border-b-0 ${
        row.isYou ? "bg-primary/10" : ""
      }`}
    >
      <NeoBadge color={rankColor(row.rank)} className="w-10 justify-center px-1 shrink-0">
        {row.rank}
      </NeoBadge>
      <div className="min-w-0 flex-1">
        <p className="font-heading font-bold text-sm truncate">
          {row.name}
          {row.isYou && (
            <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-primary ml-1.5">
              {t("weekend.leaderboardYou", { defaultValue: "You" })}
            </span>
          )}
        </p>
        <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground mt-0.5">
          {t("weekend.leaderboardScored", {
            defaultValue: "{{scored}}/13 scored",
            scored: row.scoredSlots,
          })}
          {row.awaitingSlots > 0 &&
            ` · ${t("weekend.leaderboardAwaiting", {
              defaultValue: "{{count}} awaiting",
              count: row.awaitingSlots,
            })}`}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className="font-mono font-bold text-lg tabular-nums leading-none">
          {formatPoints(row.total)}
        </p>
        <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-muted-foreground mt-1">
          {t("weekend.pts", { defaultValue: "pts" })}
          {row.tied ? ` · ${t("weekend.tied", { defaultValue: "tied" })}` : ""}
        </p>
      </div>
    </div>
  );
}

function YourRaceCard({ board }: { board: Board }) {
  const { t } = useTranslation();
  const meIndex = board.rows.findIndex((row) => row.isYou);
  const me = meIndex < 0 ? null : board.rows[meIndex];
  const movement = useWeekendRankMovement(board.gameweekId, me?.rank ?? null);
  if (me === null) return null;

  const above = meIndex > 0 ? board.rows[meIndex - 1] : null;
  const gap = above === null ? null : Math.max(0, above.total - me.total);
  const top = percentile(me.rank, board.ranked);

  return (
    <NeoCard color="accent" shadow="lg" data-testid="weekend-your-race">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] opacity-70">
            {t("weekend.yourRace", { defaultValue: "Your race" })}
          </p>
          <p className="font-heading font-bold text-2xl leading-none mt-1">
            #{me.rank}
            <span className="text-sm ml-1.5 opacity-70">
              {t("weekend.rankOf", { defaultValue: "of {{count}}", count: board.ranked })}
            </span>
          </p>
        </div>
        <NeoBadge color="muted">
          {t("weekend.topPercent", { defaultValue: "Top {{percent}}%", percent: top })}
        </NeoBadge>
      </div>
      <div className="grid grid-cols-2 gap-2 mt-3">
        <div className="neo-border rounded-lg bg-background/90 text-foreground px-3 py-2">
          <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-muted-foreground">
            {above === null
              ? t("weekend.position", { defaultValue: "Position" })
              : t("weekend.nextPlace", { defaultValue: "Next place" })}
          </p>
          <p className="font-heading font-bold text-sm mt-0.5">
            {above === null
              ? t("weekend.leading", { defaultValue: "Leading the field" })
              : gap === 0
                ? t("weekend.levelWith", { defaultValue: "Level at #{{rank}}", rank: above.rank })
                : t("weekend.pointsToRank", {
                    defaultValue: "{{points}} pts to #{{rank}}",
                    points: formatPoints(gap),
                    rank: above.rank,
                  })}
          </p>
        </div>
        <div className="neo-border rounded-lg bg-background/90 text-foreground px-3 py-2">
          <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-muted-foreground">
            {t("weekend.squadProgress", { defaultValue: "Squad progress" })}
          </p>
          <p className="font-heading font-bold text-sm mt-0.5">
            {t("weekend.scoredOfThirteen", {
              defaultValue: "{{scored}}/13 scored",
              scored: me.scoredSlots,
            })}
          </p>
        </div>
      </div>
      {movement !== null && (
        <p
          className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] mt-3 flex items-center gap-1"
          data-testid="weekend-rank-movement"
        >
          <TrendingUp size={12} strokeWidth={3} aria-hidden />
          {movement > 0
            ? t("weekend.climbedPlaces", {
                defaultValue: "You climbed {{count}} places",
                count: movement,
              })
            : t("weekend.droppedPlaces", {
                defaultValue: "You moved down {{count}} places",
                count: Math.abs(movement),
              })}
        </p>
      )}
    </NeoCard>
  );
}

function WeekendStandings({ board }: { board: Board }) {
  const { t } = useTranslation();
  const meIndex = board.rows.findIndex((row) => row.isYou);
  const nearby = useMemo(
    () =>
      meIndex < 0
        ? []
        : board.rows.slice(Math.max(0, meIndex - 2), Math.min(board.rows.length, meIndex + 3)),
    [board.rows, meIndex],
  );

  return (
    <>
      <YourRaceCard board={board} />
      <NeoCard color="accent" shadow="lg" className="flex items-center gap-3">
        <div className="neo-border rounded-lg bg-background text-foreground p-2.5 shrink-0">
          {board.state === "provisional" ? (
            <Radio size={20} strokeWidth={3} aria-hidden />
          ) : (
            <Trophy size={20} strokeWidth={3} aria-hidden />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-heading font-bold leading-tight">
            {board.state === "provisional"
              ? t("weekend.leaderboardLive", { defaultValue: "Live standings" })
              : t("weekend.leaderboardFinal", { defaultValue: "Final standings" })}
          </p>
          <p className="text-[11px] opacity-75 mt-0.5">
            {board.state === "provisional"
              ? t("weekend.leaderboardLiveBody", {
                  defaultValue: "Provisional totals update as points land.",
                })
              : t("weekend.leaderboardFinalBody", { defaultValue: "This gameweek is settled." })}
          </p>
        </div>
        <span className="font-mono font-bold text-sm tabular-nums shrink-0">
          {board.ranked}/{board.participants}
        </span>
      </NeoCard>

      {board.rows.length === 0 ? (
        <NeoCard className="text-center py-8" data-testid="weekend-leaderboard-empty">
          <Trophy size={28} strokeWidth={2.5} className="mx-auto text-primary" aria-hidden />
          <p className="font-heading font-bold mt-2">
            {t("weekend.leaderboardWaiting", { defaultValue: "Waiting for the first points" })}
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            {t("weekend.leaderboardWaitingBody", {
              defaultValue: "The table appears as soon as a player score lands.",
            })}
          </p>
        </NeoCard>
      ) : (
        <>
          {nearby.length > 0 && board.rows.length > nearby.length && (
            <section data-testid="weekend-around-you">
              <h2 className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground mb-2">
                {t("weekend.aroundYou", { defaultValue: "Around you" })}
              </h2>
              <NeoCard className="p-0 overflow-hidden">
                {nearby.map((row, index) => (
                  <LeaderboardRow key={`near-${row.rank}-${row.name}-${index}`} row={row} />
                ))}
              </NeoCard>
            </section>
          )}
          <section>
            <h2 className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground mb-2">
              {t("weekend.fullStandings", { defaultValue: "Full standings" })}
            </h2>
            <NeoCard className="p-0 overflow-hidden" data-testid="weekend-leaderboard">
              {board.rows.map((row, index) => (
                <LeaderboardRow key={`${row.rank}-${row.name}-${index}`} row={row} />
              ))}
            </NeoCard>
          </section>
        </>
      )}
    </>
  );
}

function SeasonLeaderboardRow({ row }: { row: SeasonRow }) {
  const { t } = useTranslation();
  return (
    <div
      className={`flex items-center gap-3 px-3 py-3 border-b-2 border-border last:border-b-0 ${
        row.isYou ? "bg-primary/10" : ""
      }`}
      data-testid={row.isYou ? "season-leaderboard-you" : "season-leaderboard-row"}
    >
      <NeoBadge color={rankColor(row.rank)} className="w-10 justify-center px-1 shrink-0">
        {row.rank}
      </NeoBadge>
      <div className="min-w-0 flex-1">
        <p className="font-heading font-bold text-sm truncate">
          {row.name}
          {row.isYou && (
            <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-primary ml-1.5">
              {t("weekend.leaderboardYou", { defaultValue: "You" })}
            </span>
          )}
        </p>
        <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground mt-0.5">
          {t("weekend.weekendsPlayed", {
            defaultValue: "{{count}} weekends",
            count: row.playedWeekends,
          })}
          {row.provisional ? ` · ${t("weekend.live", { defaultValue: "Live" })}` : ""}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className="font-mono font-bold text-lg tabular-nums leading-none">
          {formatPoints(row.total)}
        </p>
        <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-muted-foreground mt-1">
          {t("weekend.pts", { defaultValue: "pts" })}
          {row.tied ? ` · ${t("weekend.tied", { defaultValue: "tied" })}` : ""}
        </p>
      </div>
    </div>
  );
}

function SeasonStandings({ board }: { board: SeasonBoard }) {
  const { t } = useTranslation();
  return (
    <>
      {board.me !== null && (
        <NeoCard color="accent" shadow="lg" data-testid="weekend-season-summary">
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] opacity-70">
            {t("weekend.yourSeason", { defaultValue: "Your season" })}
          </p>
          <div className="grid grid-cols-3 gap-2 mt-2 text-center">
            <div className="neo-border rounded-lg bg-background/90 text-foreground px-2 py-2">
              <p className="font-heading font-bold text-lg">#{board.me.rank}</p>
              <p className="font-mono text-[8px] uppercase text-muted-foreground">
                {t("weekend.rank", { defaultValue: "Rank" })}
              </p>
            </div>
            <div className="neo-border rounded-lg bg-background/90 text-foreground px-2 py-2">
              <p className="font-heading font-bold text-lg">{formatPoints(board.me.total)}</p>
              <p className="font-mono text-[8px] uppercase text-muted-foreground">
                {t("weekend.points", { defaultValue: "Points" })}
              </p>
            </div>
            <div className="neo-border rounded-lg bg-background/90 text-foreground px-2 py-2">
              <p className="font-heading font-bold text-lg">{board.me.playedWeekends}</p>
              <p className="font-mono text-[8px] uppercase text-muted-foreground">
                {t("weekend.played", { defaultValue: "Played" })}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 mt-3">
            <NeoBadge color="muted">
              <Award size={11} className="mr-1" aria-hidden />
              {t("weekend.bestFinish", {
                defaultValue: "Best #{{rank}}",
                rank: board.me.bestRank,
              })}
            </NeoBadge>
            <NeoBadge color="muted">
              <Flame size={11} className="mr-1" aria-hidden />
              {t("weekend.topHalfStreak", {
                defaultValue: "Top-half streak {{count}}",
                count: board.me.topHalfStreak,
              })}
            </NeoBadge>
            {board.me.topTenPercentFinishes > 0 && (
              <NeoBadge color="yellow">
                {t("weekend.topTenFinishes", {
                  defaultValue: "Top 10% ×{{count}}",
                  count: board.me.topTenPercentFinishes,
                })}
              </NeoBadge>
            )}
            {board.me.changeFromPrevious !== null && board.me.changeFromPrevious > 0 && (
              <NeoBadge color="success">
                <TrendingUp size={11} className="mr-1" aria-hidden />
                {t("weekend.improvedPlaces", {
                  defaultValue: "+{{count}} places",
                  count: board.me.changeFromPrevious,
                })}
              </NeoBadge>
            )}
          </div>
        </NeoCard>
      )}

      <section>
        <div className="flex items-baseline justify-between gap-2 mb-2">
          <h2 className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
            {t("weekend.seasonStandings", { defaultValue: "Season standings" })}
          </h2>
          <span className="font-mono text-[10px] text-muted-foreground">
            {board.ranked}/{board.participants}
          </span>
        </div>
        <NeoCard className="p-0 overflow-hidden" data-testid="weekend-season-leaderboard">
          {board.rows.map((row, index) => (
            <SeasonLeaderboardRow key={`${row.rank}-${row.name}-${index}`} row={row} />
          ))}
        </NeoCard>
      </section>

      {board.me !== null && board.me.history.length > 0 && (
        <section data-testid="weekend-history">
          <h2 className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground mb-2">
            {t("weekend.yourGameweeks", { defaultValue: "Your gameweeks" })}
          </h2>
          <NeoCard className="p-0 overflow-hidden">
            {board.me.history.map((week) => (
              <div
                key={week.gwNumber}
                className="grid grid-cols-[1fr_auto_auto] gap-3 items-center px-3 py-3 border-b-2 border-border last:border-b-0"
              >
                <div>
                  <p className="font-heading font-bold text-sm">GW {week.gwNumber}</p>
                  <p className="font-mono text-[9px] uppercase text-muted-foreground">
                    {t("weekend.topPercent", {
                      defaultValue: "Top {{percent}}%",
                      percent: week.percentile,
                    })}
                  </p>
                </div>
                <p className="font-mono font-bold text-sm">#{week.rank}</p>
                <p className="font-mono font-bold text-sm tabular-nums">
                  {formatPoints(week.total)}
                </p>
              </div>
            ))}
          </NeoCard>
        </section>
      )}

      {board.weeks.length > 0 && (
        <section data-testid="weekend-podium-archive">
          <h2 className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground mb-2">
            {t("weekend.weeklyPodiums", { defaultValue: "Weekly podiums" })}
          </h2>
          <div className="flex flex-col gap-2">
            {board.weeks.map((week) => (
              <NeoCard key={week.gwNumber} className="py-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-heading font-bold">GW {week.gwNumber}</p>
                  {week.mostImproved !== null && (
                    <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-primary">
                      {t("weekend.mostImproved", {
                        defaultValue: "Most improved: {{name}} +{{places}}",
                        name: week.mostImproved.name,
                        places: week.mostImproved.places,
                      })}
                    </span>
                  )}
                </div>
                <div className="flex flex-col gap-1.5 mt-2">
                  {week.podium.map((entry, index) => (
                    <div key={`${entry.rank}-${entry.name}-${index}`} className="flex items-center gap-2">
                      <NeoBadge color={rankColor(entry.rank)} className="w-8 justify-center px-1">
                        {entry.rank}
                      </NeoBadge>
                      <span className="font-heading font-bold text-sm truncate flex-1">{entry.name}</span>
                      <span className="font-mono font-bold text-sm tabular-nums">
                        {formatPoints(entry.total)}
                      </span>
                    </div>
                  ))}
                </div>
              </NeoCard>
            ))}
          </div>
        </section>
      )}
    </>
  );
}

export default function WeekendLeaderboardScreen() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [tab, setTab] = useState<"weekend" | "season">("weekend");
  const gameweek = useQuery(api.fantasyMarket.getOpenGameweek, {});
  const result = useQuery(
    api.fantasyScores.getWeekendLeaderboard,
    gameweek == null ? "skip" : { gameweekId: gameweek.gameweekId },
  );
  const season = useQuery(
    api.fantasyScores.getWeekendSeasonLeaderboard,
    tab === "season" && gameweek != null ? { season: gameweek.season } : "skip",
  );
  const board: Board | null | undefined =
    gameweek === undefined ? undefined : gameweek === null ? null : result;

  return (
    <ShellLayout
      theme="theme-weekend"
      title={t("weekend.leaderboardTitle", { defaultValue: "Leaderboard" })}
      subtitle={
        board
          ? t("weekend.leaderboardSubtitle", {
              defaultValue: "Gameweek {{gw}} · global budget squads",
              gw: board.gwNumber,
            })
          : undefined
      }
      back
      onBack={() => navigate(SHELL_ROUTES.weekend)}
      scroll
    >
      <div className="flex flex-col gap-4 md:max-w-lg md:mx-auto md:w-full pb-4">
        {board === undefined ? (
          <NeoCard className="text-center py-6">
            <p className="text-sm text-muted-foreground">
              {t("common.loading", { defaultValue: "Loading…" })}
            </p>
          </NeoCard>
        ) : board === null ? (
          <NeoCard className="text-center py-6">
            <p className="font-heading font-bold">
              {t("weekend.noBoard", { defaultValue: "No board is open right now." })}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              {t("weekend.noBoardBody", {
                defaultValue: "A fresh board opens for each weekend. Check back soon.",
              })}
            </p>
          </NeoCard>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2" data-testid="weekend-leaderboard-tabs">
              <button
                type="button"
                onClick={() => setTab("weekend")}
                className={`neo-border rounded-lg px-3 py-2 font-heading font-bold text-sm transition-all ${
                  tab === "weekend"
                    ? "bg-primary text-primary-foreground neo-shadow"
                    : "bg-card text-card-foreground"
                }`}
              >
                {t("weekend.thisWeekend", { defaultValue: "This Weekend" })}
              </button>
              <button
                type="button"
                onClick={() => setTab("season")}
                className={`neo-border rounded-lg px-3 py-2 font-heading font-bold text-sm transition-all ${
                  tab === "season"
                    ? "bg-primary text-primary-foreground neo-shadow"
                    : "bg-card text-card-foreground"
                }`}
              >
                {t("weekend.season", { defaultValue: "Season" })}
              </button>
            </div>

            {tab === "weekend" ? (
              <WeekendStandings board={board} />
            ) : season === undefined ? (
              <NeoCard className="text-center py-6">
                <p className="text-sm text-muted-foreground">
                  {t("common.loading", { defaultValue: "Loading…" })}
                </p>
              </NeoCard>
            ) : season.rows.length === 0 ? (
              <NeoCard className="text-center py-8">
                <Target size={28} className="mx-auto text-primary" aria-hidden />
                <p className="font-heading font-bold mt-2">
                  {t("weekend.seasonWaiting", { defaultValue: "The season race starts here" })}
                </p>
              </NeoCard>
            ) : (
              <SeasonStandings board={season} />
            )}
          </>
        )}
      </div>
    </ShellLayout>
  );
}
