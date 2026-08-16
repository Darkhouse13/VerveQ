/**
 * Rich Crew read model.
 *
 * This module intentionally persists no rankings, trophies or rivalry rows.
 * They are compact projections of the immutable room log and authoritative
 * squad scores, so a score correction can never leave a second ledger stale.
 */
import { getAuthUserId } from "@convex-dev/auth/server";
import { query, type QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { v } from "convex/values";
import {
  crewTableFor,
  squadScore,
  type CrewTable,
  type CrewTableRow,
  type CrewWeekendScore,
} from "./fantasyScores";

type PublicWeekRow = {
  userId: Id<"users">;
  name: string;
  points: number | null;
  rank: number | null;
  tied: boolean;
};

type PublicWeek = {
  roomId: Id<"fantasyDraftRooms">;
  gameweekId: Id<"fantasyGameweeks">;
  gwNumber: number;
  season: string;
  state: "provisional" | "final";
  rows: PublicWeekRow[];
};

type ScopeRow = {
  userId: Id<"users">;
  isYou: boolean;
  name: string;
  rank: number;
  tied: boolean;
  total: number | null;
  appearances: number;
  average: number | null;
  provisional: boolean;
  movement: number | null;
  weeklyWins: number;
  podiums: number;
  bestFinish: number | null;
  topHalfStreak: number;
  seasonTitles: number;
};

type Scope = {
  rows: ScopeRow[];
  weeks: PublicWeek[];
  me: {
    rank: number;
    total: number | null;
    appearances: number;
    average: number | null;
    gapAbove: number | null;
    gapBelow: number | null;
    movement: number | null;
  } | null;
};

function clean(value: number): number {
  return Math.round(value * 1e9) / 1e9;
}

function publicWeeks(table: CrewTable, season: string | null): PublicWeek[] {
  const rowsByRoom = new Map<string, PublicWeekRow[]>();
  for (const member of table.rows) {
    for (const entry of member.weekends) {
      if (season !== null && entry.season !== season) continue;
      const rows = rowsByRoom.get(entry.roomId) ?? [];
      rows.push({
        userId: member.userId,
        name: member.name,
        points: entry.points,
        rank: null,
        tied: false,
      });
      rowsByRoom.set(entry.roomId, rows);
    }
  }

  const weeks: PublicWeek[] = table.weekends
    .filter((week) => season === null || week.season === season)
    .map((week) => {
      const rows = rowsByRoom.get(week.roomId) ?? [];
      rows.sort((a, b) => {
        if (a.points === null && b.points === null) return a.name.localeCompare(b.name);
        if (a.points === null) return 1;
        if (b.points === null) return -1;
        return b.points - a.points || a.name.localeCompare(b.name);
      });
      let rank = 0;
      let previous: number | null | undefined;
      rows.forEach((row, index) => {
        if (row.points === null) return;
        if (index === 0 || row.points !== previous) rank = index + 1;
        row.rank = rank;
        row.tied =
          rows[index - 1]?.points === row.points || rows[index + 1]?.points === row.points;
        previous = row.points;
      });
      return { ...week, rows };
    });
  weeks.sort((a, b) => b.gwNumber - a.gwNumber);
  return weeks;
}

function entriesFor(row: CrewTableRow, season: string | null): CrewWeekendScore[] {
  return row.weekends.filter((entry) => season === null || entry.season === season);
}

function simpleRanks(
  tableRows: CrewTableRow[],
  season: string | null,
  excludedRoomId: string | null = null,
): Map<string, number> {
  const totals = tableRows.map((row) => {
    const scored = entriesFor(row, season).filter(
      (entry) => entry.roomId !== excludedRoomId && entry.points !== null,
    );
    return {
      userId: row.userId,
      name: row.name,
      total:
        scored.length === 0
          ? null
          : clean(scored.reduce((sum, entry) => sum + (entry.points ?? 0), 0)),
    };
  });
  totals.sort((a, b) => {
    if (a.total === null && b.total === null) return a.name.localeCompare(b.name);
    if (a.total === null) return 1;
    if (b.total === null) return -1;
    return b.total - a.total || a.name.localeCompare(b.name);
  });
  const ranks = new Map<string, number>();
  let rank = 0;
  let previous: number | null | undefined;
  totals.forEach((row, index) => {
    if (index === 0 || row.total !== previous) rank = index + 1;
    ranks.set(row.userId, rank);
    previous = row.total;
  });
  return ranks;
}

function buildScope(
  table: CrewTable,
  callerId: Id<"users">,
  season: string | null,
  seasonTitles: ReadonlyMap<string, number>,
): Scope {
  const weeks = publicWeeks(table, season);
  const latestRoomId = weeks[0]?.roomId ?? null;
  const currentRanks = simpleRanks(table.rows, season);
  const priorRanks =
    latestRoomId === null ? new Map<string, number>() : simpleRanks(table.rows, season, latestRoomId);

  const rows: ScopeRow[] = table.rows.map((member) => {
    const entries = entriesFor(member, season);
    const scored = entries.filter((entry) => entry.points !== null);
    const total =
      scored.length === 0
        ? null
        : clean(scored.reduce((sum, entry) => sum + (entry.points ?? 0), 0));
    const finishedWeeks = weeks.filter((week) => week.state === "final");
    const finishes = finishedWeeks
      .map((week) => week.rows.find((row) => row.userId === member.userId))
      .filter((row): row is PublicWeekRow => row !== undefined && row.rank !== null);
    let topHalfStreak = 0;
    for (const week of finishedWeeks) {
      const row = week.rows.find((candidate) => candidate.userId === member.userId);
      if (row?.rank === null || row === undefined || week.rows.length === 0) break;
      if (Math.ceil((row.rank / week.rows.length) * 100) > 50) break;
      topHalfStreak += 1;
    }
    const rank =
      season === null
        ? member.rank
        : (currentRanks.get(member.userId) ?? table.rows.length);
    const priorRank = priorRanks.get(member.userId);
    return {
      userId: member.userId,
      isYou: member.userId === callerId,
      name: member.name,
      rank,
      tied: season === null ? member.tied : false,
      total,
      appearances: scored.length,
      average: scored.length === 0 || total === null ? null : clean(total / scored.length),
      provisional:
        entries.some((entry) => entry.state === "provisional" || entry.awaitingSlots > 0),
      movement: priorRank === undefined ? null : priorRank - rank,
      weeklyWins: finishes.filter((finish) => finish.rank === 1).length,
      podiums: finishes.filter((finish) => (finish.rank ?? Infinity) <= 3).length,
      bestFinish:
        finishes.length === 0 ? null : Math.min(...finishes.map((finish) => finish.rank ?? Infinity)),
      topHalfStreak,
      seasonTitles: seasonTitles.get(member.userId) ?? 0,
    };
  });
  rows.sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name));
  if (season !== null) {
    rows.forEach((row, index) => {
      row.tied = rows[index - 1]?.rank === row.rank || rows[index + 1]?.rank === row.rank;
    });
  }

  const mine = rows.find((row) => row.userId === callerId) ?? null;
  const me =
    mine === null
      ? null
      : {
          rank: mine.rank,
          total: mine.total,
          appearances: mine.appearances,
          average: mine.average,
          gapAbove:
            mine.rank <= 1 || mine.total === null
              ? null
              : (() => {
                  const above = rows
                    .filter((row) => row.rank < mine.rank && row.total !== null)
                    .at(-1);
                  return above?.total === null || above === undefined
                    ? null
                    : clean(above.total - mine.total!);
                })(),
          gapBelow:
            mine.total === null
              ? null
              : (() => {
                  const below = rows.find((row) => row.rank > mine.rank && row.total !== null);
                  return below?.total === null || below === undefined
                    ? null
                    : clean(mine.total! - below.total);
                })(),
          movement: mine.movement,
        };
  return { rows, weeks, me };
}

function seasonTitleCounts(table: CrewTable, currentSeason: string): Map<string, number> {
  const counts = new Map<string, number>();
  const seasons = [...new Set(table.weekends.map((week) => week.season))].filter(
    (season) => season !== currentSeason,
  );
  for (const season of seasons) {
    const ranks = simpleRanks(table.rows, season);
    for (const [userId, rank] of ranks) {
      if (rank !== 1) continue;
      const member = table.rows.find((row) => row.userId === userId);
      if (member === undefined || !entriesFor(member, season).some((entry) => entry.points !== null)) {
        continue;
      }
      counts.set(userId, (counts.get(userId) ?? 0) + 1);
    }
  }
  return counts;
}

function rivalryRows(scope: Scope, callerId: Id<"users">) {
  const mineByRoom = new Map(
    scope.weeks.map((week) => [
      week.roomId as string,
      week.rows.find((row) => row.userId === callerId) ?? null,
    ]),
  );
  return scope.rows
    .filter((member) => member.userId !== callerId)
    .map((member) => {
      const outcomes: Array<"win" | "loss" | "draw"> = [];
      for (const week of scope.weeks.filter((candidate) => candidate.state === "final")) {
        const mine = mineByRoom.get(week.roomId);
        const theirs = week.rows.find((row) => row.userId === member.userId);
        if (mine?.points === null || mine === null || theirs?.points === null || theirs === undefined) {
          continue;
        }
        outcomes.push(mine.points > theirs.points ? "win" : mine.points < theirs.points ? "loss" : "draw");
      }
      const first = outcomes[0] ?? null;
      let streak = 0;
      for (const outcome of outcomes) {
        if (outcome !== first) break;
        streak += 1;
      }
      return {
        userId: member.userId,
        name: member.name,
        wins: outcomes.filter((outcome) => outcome === "win").length,
        losses: outcomes.filter((outcome) => outcome === "loss").length,
        draws: outcomes.filter((outcome) => outcome === "draw").length,
        streak: first === null ? null : { result: first, length: streak },
      };
    })
    .filter((row) => row.wins + row.losses + row.draws > 0)
    .sort((a, b) => b.wins + b.losses + b.draws - (a.wins + a.losses + a.draws));
}

async function latestMvp(
  ctx: QueryCtx,
  table: CrewTable,
  week: PublicWeek | null,
): Promise<{ playerName: string; ownerName: string; points: number } | null> {
  if (week === null) return null;
  const room = await ctx.db.get(week.roomId);
  const gameweek = await ctx.db.get(week.gameweekId);
  if (room === null || gameweek === null) return null;
  const names = new Map(table.rows.map((row) => [row.userId as string, row.name]));
  let best: { playerName: string; ownerName: string; points: number } | null = null;
  for (const seat of room.seats) {
    const squad = await ctx.db
      .query("fantasySquads")
      .withIndex("by_user_gameweek_contextKey", (q) =>
        q
          .eq("userId", seat.userId)
          .eq("gameweekId", gameweek._id)
          .eq("contextKey", `crew:${room._id}`),
      )
      .first();
    if (squad === null) continue;
    const score = await squadScore(ctx, squad, gameweek, Date.now(), false);
    for (const slot of score.slots) {
      if (slot.points === null || slot.playerName === null) continue;
      if (best === null || slot.points > best.points) {
        best = {
          playerName: slot.playerName,
          ownerName: names.get(seat.userId) ?? seat.nameSnapshot,
          points: slot.points,
        };
      }
    }
  }
  return best;
}

export const getDashboard = query({
  args: { code: v.string() },
  handler: async (ctx, { code }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const table = await crewTableFor(ctx, code, userId);
    if (table === null) return null;

    const gameweeks = (await ctx.db.query("fantasyGameweeks").collect()).filter(
      (gameweek) => gameweek.gwNumber > 0,
    );
    const open = gameweeks
      .filter((gameweek) => gameweek.status === "upcoming" || gameweek.status === "live")
      .sort((a, b) => a.finalityAt - b.finalityAt)[0];
    const currentSeason =
      open?.season ??
      [...table.weekends].sort((a, b) => b.gwNumber - a.gwNumber)[0]?.season ??
      "Current season";
    const titles = seasonTitleCounts(table, currentSeason);
    const season = buildScope(table, userId, currentSeason, titles);
    const allTime = buildScope(table, userId, null, titles);
    const latestFinal = allTime.weeks.find((week) => week.state === "final") ?? null;
    const biggestClimb =
      season.rows
        .filter((row) => (row.movement ?? 0) > 0)
        .sort((a, b) => (b.movement ?? 0) - (a.movement ?? 0) || a.name.localeCompare(b.name))[0] ??
      null;
    const recap =
      latestFinal === null
        ? null
        : {
            gwNumber: latestFinal.gwNumber,
            season: latestFinal.season,
            podium: latestFinal.rows
              .filter((row) => row.rank !== null && row.rank <= 3)
              .map((row) => ({ rank: row.rank!, name: row.name, points: row.points! })),
            biggestClimb:
              biggestClimb === null
                ? null
                : { name: biggestClimb.name, places: biggestClimb.movement! },
            mvp: await latestMvp(ctx, table, latestFinal),
          };

    return {
      crewId: table.crewId,
      code: table.code,
      name: table.name,
      currentSeason,
      seasons: [...new Set(table.weekends.map((week) => week.season))].sort().reverse(),
      season,
      allTime,
      rivalries: rivalryRows(allTime, userId),
      recap,
    };
  },
});
