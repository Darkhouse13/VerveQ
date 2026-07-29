/**
 * Weekend Fantasy FW-3 — world builder for the draft-room handler suites.
 *
 * Extends the FW-1 harness (fantasyFakeConvex.FakeDb) with the two things the
 * draft engine needs that FW-1 handlers never did: a captured scheduler (so a
 * test can see what was scheduled and drive the hops itself — the idempotency
 * suites depend on being able to fire them twice), and a pool big enough to
 * draft from: 12 fixtured clubs + 1 club with NO fixture (the R5 badge/skip
 * case), 6 players each, deterministic distinct prices on the editorial
 * scale, and fantasyDraftPoolMeta rows across all three cohorts.
 *
 * 78 players / 12 fixtured clubs comfortably covers an 8-drafter draft (104
 * picks needs more — the full-draft suites run 2–4 drafters; capacity per
 * seat under the club cap is 12×3+6=42 ≥ 13).
 */

import { getFunctionName, type FunctionReference } from "convex/server";

import { FakeDb, makeCtx, type FakeCtx } from "./fantasyFakeConvex";

export interface ScheduledCall {
  delayMs: number;
  args: Record<string, unknown>;
  scheduledAt: number;
  /**
   * Convex function name of the scheduled target, e.g.
   * "fantasyDraftRooms.js:materializeRoomSquads". Captured because FW-3R
   * added a second `{ roomId }`-shaped hop (the sheet handoff), and a
   * harness that dispatched on argument shape would have silently driven the
   * wrong function.
   */
  fn: string;
}

export type DraftCtx = FakeCtx & {
  scheduler: { runAfter: (ms: number, ref: unknown, args: Record<string, unknown>) => Promise<void> };
};

export interface DraftWorld {
  db: FakeDb;
  ctx: DraftCtx;
  scheduled: ScheduledCall[];
  userIds: string[];
  gameweekId: string;
  /** Clubs with a fixture, in seed order. */
  clubs: string[];
  /** The club with no fixture this gameweek (R5). */
  noFixtureClub: string;
  kickoffAt: number;
  /** playerId → handle like "C03_2"; and the reverse. */
  players: Record<string, string>;
}

export const DRAFT_KICKOFF = Date.UTC(2026, 8, 12, 14, 0); // Saturday 14:00Z
export const DRAFT_LOBBY_NOW = DRAFT_KICKOFF - 2 * 86_400_000; // Thursday

export async function seedDraftWorld(
  opts: { users?: number } = {},
): Promise<DraftWorld> {
  const { users = 4 } = opts;
  const db = new FakeDb();
  const scheduled: ScheduledCall[] = [];
  const ctx: DraftCtx = {
    ...makeCtx(db),
    scheduler: {
      runAfter: async (ms, ref, args) => {
        scheduled.push({
          delayMs: ms,
          args,
          scheduledAt: Date.now(),
          fn: getFunctionName(ref as FunctionReference<"mutation">),
        });
      },
    },
  };

  const userIds: string[] = [];
  for (let i = 0; i < users; i += 1) {
    userIds.push(await db.insert("users", { username: `drafter${i}` }));
  }

  const gameweekId = await db.insert("fantasyGameweeks", {
    season: "2026-2027",
    gwNumber: 7,
    leagueIds: [39],
    status: "upcoming",
    finalityAt: DRAFT_KICKOFF + 3 * 86_400_000,
  });

  const clubs: string[] = [];
  for (let c = 0; c < 12; c += 2) {
    const home = `C${String(c).padStart(2, "0")}`;
    const away = `C${String(c + 1).padStart(2, "0")}`;
    clubs.push(home, away);
    await db.insert("fantasyFixtures", {
      gameweekId,
      leagueId: 39,
      providerFixtureId: `fx-${home}-${away}`,
      kickoffAt: DRAFT_KICKOFF,
      status: "scheduled",
      homeClubId: home,
      awayClubId: away,
    });
  }
  const noFixtureClub = "NOFIX";

  const players: Record<string, string> = {};
  const pools = ["topfive", "promoted", "flagged"] as const;
  let n = 0;
  for (const clubId of [...clubs, noFixtureClub]) {
    for (let i = 0; i < 6; i += 1) {
      const handle = `${clubId}_${i}`;
      // Distinct-ish deterministic prices across the whole 4.0–13.0 scale.
      const price = 4 + ((n * 7) % 19) * 0.5;
      const pool = pools[n % 3];
      const playerId = await db.insert("fantasyPlayers", {
        providerPlayerId: String(10_000 + n),
        name: handle,
        clubId,
        leagueId: 39,
        feedPosition: i === 0 ? "GK" : i <= 2 ? "DEF" : i <= 4 ? "MID" : "ATT",
        price,
        active: true,
      });
      await db.insert("fantasyDraftPoolMeta", {
        playerId,
        pool,
        proxy: pool === "flagged" ? null : price + 0.25,
        clubName: `Club ${clubId}`,
      });
      players[handle] = playerId;
      n += 1;
    }
  }

  return {
    db,
    ctx,
    scheduled,
    userIds,
    gameweekId,
    clubs,
    noFixtureClub,
    kickoffAt: DRAFT_KICKOFF,
    players,
  };
}
