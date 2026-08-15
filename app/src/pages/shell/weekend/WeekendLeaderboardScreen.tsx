/**
 * THE WEEKEND — global gameweek standings for budget squads.
 *
 * The query is a Convex subscription over the same live squad totals shown on
 * the hub, so this screen moves when provisional player scores land. Crew
 * sheets are a separate competition and never appear here.
 */
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { Radio, Trophy } from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import { formatPoints } from "../../../../convex/lib/fantasyScoring";
import { NeoBadge } from "@/components/neo/NeoBadge";
import { NeoCard } from "@/components/neo/NeoCard";
import { ShellLayout } from "@/components/shell/ShellLayout";
import { SHELL_ROUTES } from "@/lib/shellRoutes";

type Board = NonNullable<FunctionReturnType<typeof api.fantasyScores.getWeekendLeaderboard>>;
type Row = Board["rows"][number];

function rankColor(rank: number): "accent" | "blue" | "pink" | "muted" {
  if (rank === 1) return "accent";
  if (rank === 2) return "blue";
  if (rank === 3) return "pink";
  return "muted";
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

export default function WeekendLeaderboardScreen() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const gameweek = useQuery(api.fantasyMarket.getOpenGameweek, {});
  const result = useQuery(
    api.fantasyScores.getWeekendLeaderboard,
    gameweek == null ? "skip" : { gameweekId: gameweek.gameweekId },
  );
  const board: Board | null | undefined =
    gameweek === undefined ? undefined : gameweek === null ? null : result;

  return (
    <ShellLayout
      theme="theme-weekend"
      title={t("weekend.leaderboardTitle", { defaultValue: "Leaderboard" })}
      subtitle={
        board && board !== undefined
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
                    : t("weekend.leaderboardFinalBody", {
                        defaultValue: "This gameweek is settled.",
                      })}
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
              <NeoCard className="p-0 overflow-hidden" data-testid="weekend-leaderboard">
                {board.rows.map((row, index) => (
                  <LeaderboardRow key={`${row.rank}-${row.name}-${index}`} row={row} />
                ))}
              </NeoCard>
            )}
          </>
        )}
      </div>
    </ShellLayout>
  );
}
