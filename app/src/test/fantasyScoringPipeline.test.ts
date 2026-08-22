/**
 * Weekend Fantasy FW-4 — the scoring pipeline, at the handler level.
 *
 * Runs the REAL convex/fantasyScores.ts handlers against the in-memory harness
 * (test/support/fantasyFakeConvex.ts), with the real engine
 * (convex/lib/fantasyScoring.ts) underneath. Only the database is faked, so what
 * passes here is the shipped pipeline — the same mutation the cron calls and the
 * same mutation the DEV regression gate drives.
 *
 * Every expected number below was worked out from SCORING_SPEC v0.5.1 by hand
 * and is shown as an addition in the comment above its assertion. None was
 * produced by running the code and pasting the result, which would assert only
 * that the code does what it does.
 *
 * The ticket's P7 list, and where each case lives:
 *
 *   idempotent re-ingest                     → "R2 — idempotence"
 *   revision creates a version, prior readable → "R4 — revisions"
 *   finalized scores immutable               → "R3/R4 — finality"
 *   crowd factor out of band rejected        → "R5 — the crowd band"
 *   unscored ≠ zero                          → "R7 — scoreability"
 *   mismatch applied only on a mismatch      → "R6 — the verdict"
 *   squad aggregation, hand-computed         → fantasyScoringSquads.test.ts
 *
 * FW-4R (the blind-verify remediation) adds:
 *
 *   last-look re-check at finality−8h        → "N1 — the last-look sweep"
 *   settlement retry across the crash window → "N3 — settlement retry"
 *   starter in a finisher slot is designed   → "N4 — the unused-finisher note"
 *   did-not-appear resolves to an honest 0   → fantasyScoringSquads.test.ts
 */

import { beforeEach, describe, expect, it } from "vitest";

import {
  SATURDAY,
  SUNDAY,
  handlerOf,
  seedWorld,
  type World,
} from "./support/fantasyFakeConvex";

import * as fantasyScores from "../../convex/fantasyScores";
import { emptyStats, scorePlayer, type PlayerMatchStats } from "../../convex/lib/fantasyScoring";
import { matchContextFor } from "../../convex/lib/fantasyFeedStats";
import { CROWD_FACTOR_OUT_OF_BAND } from "../../convex/lib/fantasyScorePipeline";

const applyFixtureStats = handlerOf(fantasyScores.applyFixtureStats);
const scoringPlan = handlerOf(fantasyScores.scoringPlan);
const settlementPlan = handlerOf(fantasyScores.settlementPlan);
const finalizeGameweekChunk = handlerOf(fantasyScores.finalizeGameweekChunk);
const stampSquadFinalTotals = handlerOf(fantasyScores.stampSquadFinalTotals);
const writeUnscoredAlert = handlerOf(fantasyScores.writeUnscoredAlert);

/** Two hours and change after the Saturday kickoff: the earliest read (R2). */
const AFTER_SATURDAY = SATURDAY + 3 * 3_600_000;

let world: World;

beforeEach(async () => {
  world = await seedWorld();
});

// ── helpers ──

type FeedRow = {
  providerPlayerId: string;
  clubId: string;
  feedPosition: "GK" | "DEF" | "MID" | "ATT" | null;
  stats: PlayerMatchStats;
  events: { minute: number; kind: string }[];
  entryMinute: number | null;
  crowdFactor?: number;
};

function row(
  providerPlayerId: string,
  clubId: string,
  feedPosition: FeedRow["feedPosition"],
  stats: Partial<PlayerMatchStats>,
  extra: Partial<Pick<FeedRow, "events" | "entryMinute" | "crowdFactor">> = {},
): FeedRow {
  return {
    providerPlayerId,
    clubId,
    feedPosition,
    stats: emptyStats(stats),
    events: extra.events ?? [],
    entryMinute: extra.entryMinute ?? null,
    ...(extra.crowdFactor === undefined ? {} : { crowdFactor: extra.crowdFactor }),
  };
}

/** Mark a seeded fixture finished with a score — the only state R7 reads. */
async function finishFixture(
  providerFixtureId: string,
  homeGoals: number,
  awayGoals: number,
): Promise<void> {
  const fixture = world.db
    .rows("fantasyFixtures")
    .find((f) => f.providerFixtureId === providerFixtureId);
  if (fixture === undefined) throw new Error(`no seeded fixture ${providerFixtureId}`);
  await world.db.patch(fixture._id as string, {
    status: "finished",
    homeGoals,
    awayGoals,
  });
}

async function ingest(
  providerFixtureId: string,
  rows: FeedRow[],
  opts: { hasEvents?: boolean; hasPlayerStats?: boolean; now?: number } = {},
) {
  return applyFixtureStats(world.ctx, {
    providerFixtureId,
    hasPlayerStats: opts.hasPlayerStats ?? rows.length > 0,
    hasEvents: opts.hasEvents ?? true,
    rows,
    now: opts.now ?? AFTER_SATURDAY,
  }) as Promise<{
    noop: boolean;
    scoreable: boolean;
    afterFinality: boolean;
    notScoredReason: string | null;
    unscoreableReason: string | null;
    rawRevisionsWritten: number;
    scoreVersionsWritten: number;
    scoresUnchanged: number;
    playerRows: number;
    fixtureInputHash: string | null;
  }>;
}

function scoreRows(providerPlayerId?: string) {
  return world.db
    .rows("fantasyPlayerScores")
    .filter((r) => providerPlayerId === undefined || r.providerPlayerId === providerPlayerId)
    .sort((a, b) => (a.version as number) - (b.version as number));
}

function rawRows(providerPlayerId?: string) {
  return world.db
    .rows("fantasyFixtureStats")
    .filter((r) => providerPlayerId === undefined || r.providerPlayerId === providerPlayerId)
    .sort((a, b) => (a.revision as number) - (b.revision as number));
}

function grid(rowDoc: Record<string, unknown>) {
  return rowDoc.baseScores as {
    starter: Record<string, number>;
    finisher: Record<string, number>;
  };
}

/** A goalkeeper who kept a clean sheet in a 2-0 win, with three saves. */
const KEEPER = () =>
  row("SAT_A_1", "SAT_A", "GK", { minutes: 90, saves: 3, passesTotal: 20, passesAccurate: 18 });

/** A midfielder in the 0-2 losing side: 7 defensive actions, 3 key passes, 92%. */
const MIDFIELDER = () =>
  row("SAT_B_4", "SAT_B", "MID", {
    minutes: 90,
    tackles: 5,
    interceptions: 2,
    keyPasses: 3,
    passesTotal: 50,
    passesAccurate: 46,
  });

// ─────────────────────────────────────────────────────────────────────────────

describe("scoring one fixture (SCORING_SPEC v0.5.1, by hand)", () => {
  beforeEach(async () => {
    await finishFixture("f-sat-1", 2, 0);
  });

  it("stores one versioned row per player carrying all eight fielded-slot scores", async () => {
    const result = await ingest("f-sat-1", [KEEPER(), MIDFIELDER()]);

    expect(result.scoreable).toBe(true);
    expect(result.scoreVersionsWritten).toBe(2);
    expect(result.rawRevisionsWritten).toBe(2);
    expect(scoreRows()).toHaveLength(2);

    const keeper = scoreRows("SAT_A_1")[0];
    expect(keeper.version).toBe(1);
    expect(keeper.state).toBe("provisional");
    expect(keeper.verdictPosition).toBe("GK");
    expect(keeper.crowdFactor).toBe(0);
    expect(keeper.specVersion).toBe("0.5.2");

    // GK, verdict GK, no mismatch:
    //   appearance +1, team win (60+) +1, saves 3 x 0.5 = +1.5, clean sheet +5
    //   = 8.5
    expect(grid(keeper).starter.GK).toBe(8.5);
    // Fielded DEF, verdict GK ⇒ x0.75 on a positive base:
    //   (appearance 1 + win 1 + DEF clean sheet 4) = 6, x0.75 = 4.5
    expect(grid(keeper).starter.DEF).toBe(4.5);
    // Fielded MID: (1 + 1 + MID clean sheet 1) = 3, x0.75 = 2.25. 20 passes is
    // below the 40-pass ramp gate, so no completion term.
    expect(grid(keeper).starter.MID).toBe(2.25);
    // Fielded ATT: (1 + 1) = 2 — ATT has no clean sheet — x0.75 = 1.5
    expect(grid(keeper).starter.ATT).toBe(1.5);
    // A starter fielded in a FINISHER slot has no entry minute, so §Finishers
    // scores him as an unused finisher: an honest, stored zero.
    expect(grid(keeper).finisher.GK).toBe(0);
    expect(grid(keeper).finisher.ATT).toBe(0);

    const mid = scoreRows("SAT_B_4")[0];
    // MID, verdict MID, 0-2 loss so no result points and no clean sheet:
    //   appearance +1
    //   defensive (5 tackles + 2 interceptions) x 0.7 = 4.9, capped at +4
    //   key passes 3 x 0.8 = +2.4
    //   pass completion 46/50 = 92% ⇒ ramp top end +2
    //   = 9.4
    expect(grid(mid).starter.MID).toBe(9.4);
    // Fielded DEF, verdict MID ⇒ mismatch:
    //   appearance 1 + tackles 5 x 0.4 = 2 + interceptions 2 x 0.6 = 1.2
    //   + concession (2 goals ⇒ -1) = 3.2, x0.75 = 2.4
    expect(grid(mid).starter.DEF).toBe(2.4);
    // Fielded GK, verdict MID: appearance 1 + concession -1 = 0, x0.75 = 0
    expect(grid(mid).starter.GK).toBe(0);
    // Fielded ATT: appearance 1 + key passes 2.4 = 3.4, x0.75 = 2.55
    expect(grid(mid).starter.ATT).toBe(2.55);
  });

  it("scores a finisher from his entry minute, with the post-75' multiplier", async () => {
    // On at 70', scores at 80'. As a FINISHER:
    //   appearance as finisher +1
    //   goal (ATT 5) +5
    //   shot on target 1 x 0.5 = +0.5 — an ATT template term, and an UNCLOCKED
    //     one, so it counts off the aggregate line for a finisher too
    //   decisive-moment x1.25 on the goal only: 5 x 0.25 = +1.25
    //   = 7.75
    // No win points: 20 minutes is under the 60-minute gate.
    const sub = row(
      "SAT_A_6",
      "SAT_A",
      "ATT",
      { minutes: 20, goals: 1, shotsOn: 1, wasSubstitute: true },
      { events: [{ minute: 80, kind: "goal" }], entryMinute: 70 },
    );
    await ingest("f-sat-1", [sub]);

    const stored = scoreRows("SAT_A_6")[0];
    expect(grid(stored).finisher.ATT).toBe(7.75);
    // The same line fielded as a STARTER scores off the aggregate row with no
    // multiplier: appearance 1 + goal 5 + shot on target 0.5 = 6.5
    expect(grid(stored).starter.ATT).toBe(6.5);
  });

  it("stores an honest zero for a player who did not appear", async () => {
    await ingest("f-sat-1", [row("SAT_A_2", "SAT_A", "DEF", { minutes: 0 })]);
    const stored = scoreRows("SAT_A_2")[0];
    // A row EXISTS and every cell is 0 — which is what makes this distinguishable
    // from awaiting data, where there is no row at all (R7).
    expect(stored).toBeDefined();
    expect(grid(stored).starter.DEF).toBe(0);
    expect(grid(stored).finisher.DEF).toBe(0);
  });
});

describe("R2 — idempotence", () => {
  beforeEach(async () => {
    await finishFixture("f-sat-1", 2, 0);
  });

  it("re-ingesting an unchanged fixture writes nothing at all", async () => {
    await ingest("f-sat-1", [KEEPER(), MIDFIELDER()]);
    const rawBefore = rawRows().map((r) => `${r.providerPlayerId}:${r.revision}:${r.statHash}`);
    const scoresBefore = scoreRows().map((r) => `${r.providerPlayerId}:${r.version}:${r.statHash}`);

    const again = await ingest("f-sat-1", [KEEPER(), MIDFIELDER()], {
      now: AFTER_SATURDAY + 7 * 3_600_000,
    });

    expect(again.noop).toBe(true);
    expect(again.rawRevisionsWritten).toBe(0);
    expect(again.scoreVersionsWritten).toBe(0);
    expect(rawRows().map((r) => `${r.providerPlayerId}:${r.revision}:${r.statHash}`)).toEqual(rawBefore);
    expect(scoreRows().map((r) => `${r.providerPlayerId}:${r.version}:${r.statHash}`)).toEqual(scoresBefore);
  });

  it("counts the re-read against the revision-check budget so polling terminates", async () => {
    await ingest("f-sat-1", [KEEPER()]);
    await ingest("f-sat-1", [KEEPER()], { now: AFTER_SATURDAY + 7 * 3_600_000 });
    await ingest("f-sat-1", [KEEPER()], { now: AFTER_SATURDAY + 14 * 3_600_000 });

    const status = world.db.rows("fantasyFixtureScoring")[0];
    expect(status.revisionChecks).toBe(2);

    // With the budget spent, the plan no longer proposes this fixture.
    const plan = (await scoringPlan(world.ctx, {
      now: AFTER_SATURDAY + 30 * 3_600_000,
    })) as { fixtures: { providerFixtureId: string }[] };
    expect(plan.fixtures.map((f) => f.providerFixtureId)).not.toContain("f-sat-1");
  });
});

describe("R4 — revisions", () => {
  beforeEach(async () => {
    await finishFixture("f-sat-1", 2, 0);
  });

  it("a changed stat line creates a new version and leaves the prior one readable", async () => {
    await ingest("f-sat-1", [MIDFIELDER()]);

    const corrected = row("SAT_B_4", "SAT_B", "MID", {
      minutes: 90,
      tackles: 5,
      interceptions: 2,
      keyPasses: 4, // the correction: one more key pass
      passesTotal: 50,
      passesAccurate: 46,
    });
    const result = await ingest("f-sat-1", [corrected], {
      now: AFTER_SATURDAY + 7 * 3_600_000,
    });

    expect(result.noop).toBe(false);
    expect(result.scoreVersionsWritten).toBe(1);
    expect(result.rawRevisionsWritten).toBe(1);

    const versions = scoreRows("SAT_B_4");
    expect(versions).toHaveLength(2);

    // v1 is untouched: 1 + 4 + (3 x 0.8) + 2 = 9.4
    expect(grid(versions[0]).starter.MID).toBe(9.4);
    expect(versions[0].supersededByVersion).toBe(2);
    expect(versions[0].revisedFrom).toBeUndefined();

    // v2 carries the corrected number: 1 + 4 + (4 x 0.8) + 2 = 10.2
    expect(grid(versions[1]).starter.MID).toBe(10.2);
    expect(versions[1].revisedFrom).toBe(1);
    expect(versions[1].supersededByVersion).toBeUndefined();

    // Both raw revisions survive, and each version names the one it scored.
    expect(rawRows("SAT_B_4").map((r) => r.revision)).toEqual([1, 2]);
    expect(versions[0].rawRevision).toBe(1);
    expect(versions[1].rawRevision).toBe(2);
    expect(versions[0].statHash).not.toBe(versions[1].statHash);
  });

  it("re-scores when the FIXTURE score changes even though no player row did", async () => {
    // A corrected scoreline changes clean sheets and the concession term without
    // touching a single player line (G2) — so the fixture score is part of the
    // hash, and this is the test that says so.
    await ingest("f-sat-1", [KEEPER()]);
    expect(grid(scoreRows("SAT_A_1")[0]).starter.GK).toBe(8.5);

    await finishFixture("f-sat-1", 2, 1); // VAR gives the away side one back
    const result = await ingest("f-sat-1", [KEEPER()], { now: AFTER_SATURDAY + 7 * 3_600_000 });

    expect(result.scoreVersionsWritten).toBe(1);
    // No clean sheet now: appearance 1 + win 1 + saves 1.5 = 3.5
    expect(grid(scoreRows("SAT_A_1")[1]).starter.GK).toBe(3.5);
  });
});

describe("R5 — the crowd band", () => {
  beforeEach(async () => {
    await finishFixture("f-sat-1", 2, 0);
  });

  it("rejects a factor outside ±15% and writes nothing", async () => {
    await expect(
      ingest("f-sat-1", [row("SAT_A_1", "SAT_A", "GK", { minutes: 90, saves: 3 }, { crowdFactor: 0.2 })]),
    ).rejects.toThrow(CROWD_FACTOR_OUT_OF_BAND);

    expect(scoreRows()).toHaveLength(0);
    expect(rawRows()).toHaveLength(0);
  });

  it("rejects it even when the stat hash is unchanged", async () => {
    // The regression this locks: the band check used to sit inside the scoring
    // loop, BEHIND the idempotence short-circuit — so an out-of-band factor on an
    // already-ingested fixture returned success and was neither applied nor
    // reported.
    await ingest("f-sat-1", [KEEPER()]);
    const before = scoreRows("SAT_A_1").map((r) => r.crowdFactor);

    await expect(
      ingest("f-sat-1", [{ ...KEEPER(), crowdFactor: -0.5 }], {
        now: AFTER_SATURDAY + 7 * 3_600_000,
      }),
    ).rejects.toThrow(CROWD_FACTOR_OUT_OF_BAND);

    expect(scoreRows("SAT_A_1").map((r) => r.crowdFactor)).toEqual(before);
  });

  it("rejects NaN rather than letting it propagate into a total", async () => {
    await expect(
      ingest("f-sat-1", [{ ...KEEPER(), crowdFactor: Number.NaN }]),
    ).rejects.toThrow(CROWD_FACTOR_OUT_OF_BAND);
  });

  it("stores a legal factor beside the base rather than folded into it", async () => {
    await ingest("f-sat-1", [{ ...KEEPER(), crowdFactor: 0.15 }]);
    const stored = scoreRows("SAT_A_1")[0];
    // The base is the un-crowded 8.5; the factor rides alongside, and the total
    // (8.5 x 1.15 = 9.775) is DERIVED on read. R5.
    expect(grid(stored).starter.GK).toBe(8.5);
    expect(stored.crowdFactor).toBe(0.15);
  });
});

describe("R7 — scoreability: awaiting data is never a zero", () => {
  it("leaves an FT-class fixture with no events unscored, and says why", async () => {
    await finishFixture("f-sat-1", 2, 0);
    const result = await ingest("f-sat-1", [KEEPER()], { hasEvents: false });

    expect(result.scoreable).toBe(false);
    expect(result.unscoreableReason).toMatch(/FT-class but structurally unscoreable/);
    expect(result.unscoreableReason).toMatch(/no events/);
    expect(scoreRows()).toHaveLength(0);

    const status = world.db.rows("fantasyFixtureScoring")[0];
    expect(status.state).toBe("awaiting_data");
    expect(status.notScoredReason).toMatch(/no events/);
    // The raw line IS kept — it is the record of what the feed said.
    expect(rawRows()).toHaveLength(1);

    // And it scores as soon as the events arrive, with no manual intervention.
    const fixed = await ingest("f-sat-1", [KEEPER()], { now: AFTER_SATURDAY + 3_600_000 });
    expect(fixed.scoreable).toBe(true);
    expect(scoreRows()).toHaveLength(1);
  });

  it("refuses to score a fixture that carries no score line (MatchContext, G2)", async () => {
    // Seeded fixtures have no goals until finishFixture; force the FT status
    // without a score, which is the shape that would silently hand a whole back
    // four a clean sheet if MatchContext were read off player rows.
    const fixture = world.db.rows("fantasyFixtures").find((f) => f.providerFixtureId === "f-sat-1");
    await world.db.patch(fixture!._id as string, { status: "finished" });

    const result = await ingest("f-sat-1", [KEEPER()]);
    expect(result.scoreable).toBe(false);
    expect(result.unscoreableReason).toMatch(/carries no score/);
    expect(scoreRows()).toHaveLength(0);
  });

  it("refuses a played row with no lineup position rather than guessing a template", async () => {
    await finishFixture("f-sat-1", 2, 0);
    const result = await ingest("f-sat-1", [
      row("SAT_A_1", "SAT_A", null, { minutes: 90, saves: 3 }),
    ]);
    expect(result.scoreable).toBe(false);
    expect(result.unscoreableReason).toMatch(/no lineup position/);
  });

  it("scores a 0-minute row with no position, where no template is needed", async () => {
    await finishFixture("f-sat-1", 2, 0);
    const result = await ingest("f-sat-1", [row("SAT_A_2", "SAT_A", null, { minutes: 0 })]);
    expect(result.scoreable).toBe(true);
    const stored = scoreRows("SAT_A_2")[0];
    expect(stored.verdictPosition).toBeNull();
    expect(grid(stored).starter.DEF).toBe(0);
  });

  it("never records an in-play snapshot", async () => {
    // The fixture is still `scheduled` (seedWorld's default). R2 allows no
    // in-play polling, so neither a score nor a RAW row may be written.
    const result = await ingest("f-sat-1", [KEEPER()]);
    expect(result.scoreable).toBe(false);
    expect(result.notScoredReason).toMatch(/not finished/);
    expect(rawRows()).toHaveLength(0);
    expect(scoreRows()).toHaveLength(0);
  });
});

describe("R6 — the verdict position", () => {
  it("dampens a mismatched slot and only a mismatched slot", async () => {
    await finishFixture("f-sat-1", 2, 0);
    await ingest("f-sat-1", [KEEPER()]);
    const stored = scoreRows("SAT_A_1")[0];

    expect(stored.verdictPosition).toBe("GK");
    // Verdict GK fielded GK: undamped 8.5. Every other slot is a mismatch and
    // carries exactly x0.75 of its own templated base — 6 → 4.5, 3 → 2.25,
    // 2 → 1.5 — so the dampener is present in three cells and absent in one.
    expect(grid(stored).starter.GK).toBe(8.5);
    expect(grid(stored).starter.DEF).toBe(4.5);
    expect(grid(stored).starter.MID).toBe(2.25);
    expect(grid(stored).starter.ATT).toBe(1.5);
  });

  it("passes a negative base through undamped (G5), so mis-slotting cannot pay", async () => {
    // 0-3, and SAT_A is the HOME side — so this is the losing team's defender.
    await finishFixture("f-sat-1", 0, 3);
    // A sent-off defender on the losing side, as a DEF:
    //   appearance +1, yellow -1, red -4, concession floor(3/2) = -1
    //   = -5   (no result points, no clean sheet)
    await ingest("f-sat-1", [
      row("SAT_A_2", "SAT_A", "DEF", {
        minutes: 90,
        yellowCards: 1,
        redCards: 1,
      }),
    ]);
    const stored = scoreRows("SAT_A_2")[0];
    expect(grid(stored).starter.DEF).toBe(-5);
    // Fielded MID (a mismatch): appearance 1 - 1 - 4 = -4 — the MID template has
    // no concession term — and a negative base is NOT damped, so mis-slotting
    // cannot turn -5 into -3.75 and outscore calling the position right.
    expect(grid(stored).starter.MID).toBe(-4);
  });
});

describe("R3/R4 — finality", () => {
  beforeEach(async () => {
    await finishFixture("f-sat-1", 2, 0);
    await finishFixture("f-sat-2", 1, 1);
  });

  function gameweek() {
    return world.db.rows("fantasyGameweeks")[0];
  }
  const finalityAt = () => gameweek().finalityAt as number;

  it("flips the current version to final and leaves a superseded one alone", async () => {
    await ingest("f-sat-1", [MIDFIELDER()]);
    await ingest("f-sat-1", [
      row("SAT_B_4", "SAT_B", "MID", {
        minutes: 90,
        tackles: 5,
        interceptions: 2,
        keyPasses: 4,
        passesTotal: 50,
        passesAccurate: 46,
      }),
    ], { now: AFTER_SATURDAY + 7 * 3_600_000 });

    const result = (await finalizeGameweekChunk(world.ctx, {
      gameweekId: world.gameweekId,
      now: finalityAt() + 1_000,
    })) as { eligible: boolean; rowsFinalized: number; done: boolean; unscoredAtFinality: number };

    expect(result.eligible).toBe(true);
    expect(result.rowsFinalized).toBe(1);
    expect(result.done).toBe(true);

    const versions = scoreRows("SAT_B_4");
    expect(versions[0].state).toBe("provisional"); // superseded: never was final
    expect(versions[0].supersededByVersion).toBe(2);
    expect(versions[1].state).toBe("final");
    expect(versions[1].finalizedAt).toBe(finalityAt() + 1_000);
    // The numbers did not move.
    expect(grid(versions[0]).starter.MID).toBe(9.4);
    expect(grid(versions[1]).starter.MID).toBe(10.2);
  });

  it("refuses to finalize before the cut, and is a no-op after it", async () => {
    await ingest("f-sat-1", [KEEPER()]);

    const early = (await finalizeGameweekChunk(world.ctx, {
      gameweekId: world.gameweekId,
      now: finalityAt() - 1,
    })) as { eligible: boolean; rowsFinalized: number };
    expect(early.eligible).toBe(false);
    expect(early.rowsFinalized).toBe(0);
    expect(scoreRows("SAT_A_1")[0].state).toBe("provisional");

    const first = (await finalizeGameweekChunk(world.ctx, {
      gameweekId: world.gameweekId,
      now: finalityAt(),
    })) as { rowsFinalized: number };
    expect(first.rowsFinalized).toBe(1);

    const second = (await finalizeGameweekChunk(world.ctx, {
      gameweekId: world.gameweekId,
      now: finalityAt() + 60_000,
    })) as { rowsFinalized: number; done: boolean };
    expect(second.rowsFinalized).toBe(0);
    expect(second.done).toBe(true);
    // The stamp is from the first pass, not the second.
    expect(scoreRows("SAT_A_1")[0].finalizedAt).toBe(finalityAt());
  });

  it("closes the gameweek's lifecycle so the draft room can advance", async () => {
    await ingest("f-sat-1", [KEEPER()]);
    expect(gameweek().status).toBe("upcoming");
    await finalizeGameweekChunk(world.ctx, {
      gameweekId: world.gameweekId,
      now: finalityAt(),
    });
    expect(gameweek().status).toBe("final");
  });

  it("records a revision as raw after the cut and changes no score", async () => {
    await ingest("f-sat-1", [MIDFIELDER()]);
    await finalizeGameweekChunk(world.ctx, {
      gameweekId: world.gameweekId,
      now: finalityAt(),
    });
    const before = scoreRows("SAT_B_4").map((r) => ({
      v: r.version,
      state: r.state,
      mid: grid(r).starter.MID,
    }));

    const late = await ingest("f-sat-1", [
      row("SAT_B_4", "SAT_B", "MID", {
        minutes: 90,
        tackles: 9, // a big correction, arriving too late to count
        interceptions: 2,
        keyPasses: 4,
        passesTotal: 50,
        passesAccurate: 46,
      }),
    ], { now: finalityAt() + 3_600_000 });

    expect(late.afterFinality).toBe(true);
    expect(late.rawRevisionsWritten).toBe(1);
    expect(late.scoreVersionsWritten).toBe(0);
    expect(
      scoreRows("SAT_B_4").map((r) => ({ v: r.version, state: r.state, mid: grid(r).starter.MID })),
    ).toEqual(before);
    expect(rawRows("SAT_B_4").map((r) => r.revision)).toEqual([1, 2]);
  });

  it("does not label a fixture 'scored' when its feed arrived after the cut", async () => {
    const late = await ingest("f-sat-2", [row("SAT_C_1", "SAT_C", "GK", { minutes: 90, saves: 4 })], {
      now: finalityAt() + 3_600_000,
    });
    expect(late.afterFinality).toBe(true);
    expect(late.notScoredReason).toMatch(/after this gameweek's finality instant/);

    const status = world.db
      .rows("fantasyFixtureScoring")
      .find((r) => r.playerRows === 1 && r.state === "awaiting_data");
    expect(status).toBeDefined();
    expect(scoreRows("SAT_C_1")).toHaveLength(0);
    // Raw is kept: the data was fine, the window was shut.
    expect(rawRows("SAT_C_1")).toHaveLength(1);
  });
});

describe("R7 — the 6h alert", () => {
  beforeEach(async () => {
    await finishFixture("f-sat-1", 2, 0);
    await finishFixture("f-sat-2", 1, 1);
  });

  const finalityAt = () => world.db.rows("fantasyGameweeks")[0].finalityAt as number;

  it("proposes an alert inside the window and names each unscored fixture", async () => {
    await ingest("f-sat-1", [KEEPER()]);

    const plan = (await settlementPlan(world.ctx, {
      now: finalityAt() - 5 * 3_600_000,
    })) as {
      candidates: {
        needsAlert: boolean;
        needsFinalization: boolean;
        unscored: { providerFixtureId: string; fixtureStatus: string }[];
      }[];
    };

    expect(plan.candidates).toHaveLength(1);
    expect(plan.candidates[0].needsAlert).toBe(true);
    expect(plan.candidates[0].needsFinalization).toBe(false);
    // f-sat-2 finished but was never ingested; f-sun-1 is still scheduled. Both
    // are unscored, and the payload carries the status that tells them apart.
    expect(plan.candidates[0].unscored.map((f) => f.providerFixtureId).sort()).toEqual([
      "f-sat-2",
      "f-sun-1",
    ]);
    expect(
      plan.candidates[0].unscored.find((f) => f.providerFixtureId === "f-sun-1")?.fixtureStatus,
    ).toBe("scheduled");
  });

  it("proposes nothing 7h out — the window is 6h wide", async () => {
    const plan = (await settlementPlan(world.ctx, {
      now: finalityAt() - 7 * 3_600_000,
    })) as { candidates: unknown[] };
    expect(plan.candidates).toHaveLength(0);
  });

  it("writes the queryable flag once and does not repeat it", async () => {
    const unscored = [
      { providerFixtureId: "f-sat-2", fixtureStatus: "finished", reason: null },
    ];
    const first = (await writeUnscoredAlert(world.ctx, {
      gameweekId: world.gameweekId,
      now: finalityAt() - 5 * 3_600_000,
      unscored,
    })) as { written: boolean; unscoredCount: number };
    expect(first.written).toBe(true);
    expect(first.unscoredCount).toBe(1);

    const row0 = world.db.rows("fantasyGameweekScoring")[0];
    expect(row0.unscoredAlertCount).toBe(1);
    expect(row0.unscoredAlertFixtures).toEqual(unscored);

    const second = (await writeUnscoredAlert(world.ctx, {
      gameweekId: world.gameweekId,
      now: finalityAt() - 4 * 3_600_000,
      unscored,
    })) as { written: boolean };
    expect(second.written).toBe(false);
    expect(world.db.rows("fantasyGameweekScoring")[0].unscoredAlertAt).toBe(row0.unscoredAlertAt);
  });
});

describe("the call plan (R2 cadence + the 500-call gate)", () => {
  it("proposes only FT-class fixtures more than 2h past kickoff", async () => {
    await finishFixture("f-sat-1", 2, 0);
    await finishFixture("f-sun-1", 0, 0);

    const tooEarly = (await scoringPlan(world.ctx, {
      now: SATURDAY + 3_600_000,
    })) as { fixtures: { providerFixtureId: string }[] };
    expect(tooEarly.fixtures).toHaveLength(0);

    const plan = (await scoringPlan(world.ctx, { now: AFTER_SATURDAY })) as {
      fixtures: { providerFixtureId: string; readKind: string }[];
      callsThisRun: number;
      notFinished: { providerFixtureId: string; fixtureStatus: string }[];
      gameweeks: { projectedCallsForGameweek: number; fixturesInGameweek: number }[];
    };
    // f-sat-1 is FT and 3h past kickoff. f-sat-2 is still `scheduled` and f-sun-1
    // kicks off tomorrow, so neither is proposed.
    expect(plan.fixtures.map((f) => f.providerFixtureId)).toEqual(["f-sat-1"]);
    expect(plan.fixtures[0].readKind).toBe("first");
    expect(plan.callsThisRun).toBe(2);
    expect(plan.notFinished.map((f) => f.providerFixtureId)).toEqual(["f-sat-2"]);
    // 3 fixtures x (1 first read + 2 revision checks + 1 last look) x 2 calls = 24
    expect(plan.gameweeks[0].fixturesInGameweek).toBe(3);
    expect(plan.gameweeks[0].projectedCallsForGameweek).toBe(24);
  });

  it("flags a gameweek whose projected spend would break the call ceiling", async () => {
    // 201 fixtures x 4 reads x 2 calls = 1608 > 1600. The gate is arithmetic on
    // the gameweek, not on the run, so it fires before a single request is made.
    //
    // The ceiling moved 500 -> 1600 because the old value was sized for a
    // 48-fixture week and the absorption amendment made windows far bigger
    // (prod 2026-2027: largest is 82 fixtures / 656 calls). At 500 a real
    // 66-fixture gameweek tripped this gate and scoring stopped dead.
    const gameweekId = await world.db.insert("fantasyGameweeks", {
      season: "2026-2027",
      gwNumber: 99,
      leagueIds: [39],
      status: "upcoming",
      finalityAt: SUNDAY + 5 * 86_400_000,
    });
    for (let i = 0; i < 201; i += 1) {
      await world.db.insert("fantasyFixtures", {
        gameweekId,
        leagueId: 39,
        providerFixtureId: `f-big-${i}`,
        kickoffAt: SATURDAY,
        status: "finished",
        homeClubId: "SAT_A",
        awayClubId: "SAT_B",
        homeGoals: 1,
        awayGoals: 0,
      });
    }

    const plan = (await scoringPlan(world.ctx, { now: AFTER_SATURDAY })) as {
      overBudget: { gwNumber: number; projectedCallsForGameweek: number }[];
    };
    expect(plan.overBudget).toHaveLength(1);
    expect(plan.overBudget[0].gwNumber).toBe(99);
    expect(plan.overBudget[0].projectedCallsForGameweek).toBe(1608);
  });

  it("does not flag the largest window a real season actually produces", () => {
    // Measured on prod for 2026-2027 after the absorption amendment: GW3 is
    // the biggest at 82 fixtures, a typical full weekend is 78. Both must sit
    // under the ceiling with room to spare, or the pipeline stops every week.
    const projected = (fixtures: number) =>
      fixtures *
      (1 + fantasyScores.REVISION_CHECK_BUDGET + 1) *
      fantasyScores.CALLS_PER_FIXTURE;
    expect(projected(82)).toBe(656);
    expect(projected(82)).toBeLessThan(fantasyScores.GAMEWEEK_CALL_BUDGET);
    expect(projected(78)).toBeLessThan(fantasyScores.GAMEWEEK_CALL_BUDGET);
    // and the headroom is real, not marginal
    expect(fantasyScores.GAMEWEEK_CALL_BUDGET).toBeGreaterThanOrEqual(projected(82) * 2);
  });

  it("an over-budget gameweek is skipped WITHOUT starving the others", async () => {
    // The regression this exists for: the guard used to abort the whole run, so
    // one oversized window stopped scoring EVERYWHERE. Both windows are seeded
    // here rather than leaning on the shared world, so the test proves the
    // containment on its own terms.
    const seedWindow = async (gwNumber: number, count: number, tag: string) => {
      const gameweekId = await world.db.insert("fantasyGameweeks", {
        season: "2026-2027",
        gwNumber,
        leagueIds: [39],
        status: "upcoming",
        finalityAt: SUNDAY + 5 * 86_400_000,
      });
      for (let i = 0; i < count; i += 1) {
        await world.db.insert("fantasyFixtures", {
          gameweekId,
          leagueId: 39,
          providerFixtureId: `f-${tag}-${i}`,
          kickoffAt: SATURDAY,
          status: "finished",
          homeClubId: "SAT_A",
          awayClubId: "SAT_B",
          homeGoals: 1,
          awayGoals: 0,
        });
      }
    };
    await seedWindow(98, 201, "huge"); // 1608 calls — over the 1600 ceiling
    await seedWindow(97, 3, "small"); // 24 calls — comfortably inside it

    const plan = (await scoringPlan(world.ctx, { now: AFTER_SATURDAY })) as {
      fixtures: { providerFixtureId: string; gwNumber: number }[];
      overBudget: { gwNumber: number }[];
    };
    const flagged = plan.overBudget.map((g) => g.gwNumber);
    expect(flagged).toContain(98);
    expect(flagged).not.toContain(97);
    // not one fixture of the over-budget window is proposed ...
    expect(plan.fixtures.filter((f) => f.gwNumber === 98)).toHaveLength(0);
    // ... and the window beside it is read exactly as if the big one were absent
    expect(plan.fixtures.filter((f) => f.gwNumber === 97)).toHaveLength(3);
  });
});

describe("N1 — the last-look sweep (finality−8h)", () => {
  // Seeded finality is SUNDAY + 2 days = SATURDAY + 72h, so the window opens at
  // SATURDAY + 64h. Every instant below is stated relative to those two marks.
  const finalityAt = () => world.db.rows("fantasyGameweeks")[0].finalityAt as number;

  beforeEach(async () => {
    await finishFixture("f-sat-1", 2, 0);
  });

  async function planned(now: number) {
    const plan = (await scoringPlan(world.ctx, { now })) as {
      fixtures: { providerFixtureId: string; readKind: string }[];
    };
    return plan.fixtures.filter((f) => f.providerFixtureId === "f-sat-1");
  }

  it("re-checks a scored fixture once inside the window, even with the budget spent", async () => {
    await ingest("f-sat-1", [KEEPER()]);
    // Spend both budgeted early checks (6h apart), well before the window.
    await ingest("f-sat-1", [KEEPER()], { now: AFTER_SATURDAY + 7 * 3_600_000 });
    await ingest("f-sat-1", [KEEPER()], { now: AFTER_SATURDAY + 14 * 3_600_000 });

    // Budget spent, window not open: nothing is due.
    expect(await planned(finalityAt() - 20 * 3_600_000)).toHaveLength(0);

    // Window open (finality−7h): due exactly once, as a last look.
    const due = await planned(finalityAt() - 7 * 3_600_000);
    expect(due).toHaveLength(1);
    expect(due[0].readKind).toBe("lastLook");

    // The read itself — a no-op here — is what marks the look done: the plan
    // proposes nothing on the next tick, so the sweep runs once per gameweek.
    const again = await ingest("f-sat-1", [KEEPER()], {
      now: finalityAt() - 7 * 3_600_000,
    });
    expect(again.noop).toBe(true);
    expect(await planned(finalityAt() - 6 * 3_600_000)).toHaveLength(0);
  });

  it("does not last-look a fixture first scored inside the window — no blind tail to bound", async () => {
    await ingest("f-sat-1", [KEEPER()], { now: finalityAt() - 7 * 3_600_000 });
    const due = await planned(finalityAt() - 6 * 3_600_000);
    expect(due).toHaveLength(0);
  });

  it("a revision caught at the last look lands as a NEW version through the normal path", async () => {
    await ingest("f-sat-1", [MIDFIELDER()]);
    await ingest("f-sat-1", [MIDFIELDER()], { now: AFTER_SATURDAY + 7 * 3_600_000 });
    await ingest("f-sat-1", [MIDFIELDER()], { now: AFTER_SATURDAY + 14 * 3_600_000 });

    // The correction the early checks were too early to see: one more key pass,
    // landing at the last look (finality−7h), still before the cut.
    const result = await ingest("f-sat-1", [
      row("SAT_B_4", "SAT_B", "MID", {
        minutes: 90,
        tackles: 5,
        interceptions: 2,
        keyPasses: 4,
        passesTotal: 50,
        passesAccurate: 46,
      }),
    ], { now: finalityAt() - 7 * 3_600_000 });

    expect(result.afterFinality).toBe(false);
    expect(result.scoreVersionsWritten).toBe(1);

    // R4's shape, unchanged by WHO noticed: v1 superseded but readable at 9.4,
    // v2 current at 1 + 4 + (4 x 0.8) + 2 = 10.2.
    const versions = scoreRows("SAT_B_4");
    expect(versions).toHaveLength(2);
    expect(grid(versions[0]).starter.MID).toBe(9.4);
    expect(versions[0].supersededByVersion).toBe(2);
    expect(grid(versions[1]).starter.MID).toBe(10.2);
    expect(versions[1].state).toBe("provisional");

    // And it settles as the number the last look caught.
    await finalizeGameweekChunk(world.ctx, {
      gameweekId: world.gameweekId,
      now: finalityAt(),
    });
    expect(scoreRows("SAT_B_4")[1].state).toBe("final");
  });
});

describe("N3 — settlement retry across the crash window", () => {
  const finalityAt = () => world.db.rows("fantasyGameweeks")[0].finalityAt as number;

  beforeEach(async () => {
    await finishFixture("f-sat-1", 2, 0);
    await ingest("f-sat-1", [KEEPER()]);
  });

  function gwScoring() {
    return world.db.rows("fantasyGameweekScoring")[0];
  }

  it("finalize done + stamp lost leaves the gameweek unsettled, and the next run completes it", async () => {
    const cut = finalityAt() + 1_000;

    // Step 1 of the settle sequence runs; the crash eats step 2 (the stamps).
    const flip = (await finalizeGameweekChunk(world.ctx, {
      gameweekId: world.gameweekId,
      now: cut,
    })) as { done: boolean; rowsFinalized: number };
    expect(flip.done).toBe(true);
    expect(flip.rowsFinalized).toBe(1);

    // The rows are final; the SETTLEMENT is not — the stamp is the last write,
    // so the label a user sees can never get ahead of the work (N2).
    expect(scoreRows("SAT_A_1")[0].state).toBe("final");
    expect(gwScoring().state).toBe("provisional");

    // The next tick's plan still proposes the gameweek: state≠final IS the
    // retry marker, no extra bookkeeping field required.
    const replan = (await settlementPlan(world.ctx, { now: cut + 60_000 })) as {
      candidates: { needsFinalization: boolean }[];
    };
    expect(replan.candidates).toHaveLength(1);
    expect(replan.candidates[0].needsFinalization).toBe(true);

    // Finalize again (idempotent, flips nothing), then the stamps complete —
    // and completing them is what marks the gameweek settled.
    const reflip = (await finalizeGameweekChunk(world.ctx, {
      gameweekId: world.gameweekId,
      now: cut + 60_000,
    })) as { done: boolean; rowsFinalized: number };
    expect(reflip.done).toBe(true);
    expect(reflip.rowsFinalized).toBe(0);

    const stamp = (await stampSquadFinalTotals(world.ctx, {
      gameweekId: world.gameweekId,
      now: cut + 60_000,
    })) as { done: boolean };
    expect(stamp.done).toBe(true);
    expect(gwScoring().state).toBe("final");
    expect(gwScoring().finalizedAt).toBe(cut + 60_000);

    // Settled means silent: the plan never proposes this gameweek again.
    const after = (await settlementPlan(world.ctx, { now: cut + 120_000 })) as {
      candidates: unknown[];
    };
    expect(after.candidates).toHaveLength(0);
  });

  it("stamping out of order cannot mark a gameweek settled over provisional rows", async () => {
    // A direct stamp call past the cut, with finalization never run: totals are
    // immutable past the cut so the stamped numbers are fine, but the gameweek
    // must NOT read settled while current rows are still provisional.
    const stamp = (await stampSquadFinalTotals(world.ctx, {
      gameweekId: world.gameweekId,
      now: finalityAt() + 1_000,
    })) as { done: boolean };
    expect(stamp.done).toBe(true);
    expect(world.db.rows("fantasyGameweekScoring")[0].state).toBe("provisional");
  });
});

describe("N4 — the unused-finisher note tells design from data fault", () => {
  const context = matchContextFor(2, 0);

  it("calls a STARTER fielded in a finisher slot a designed outcome", async () => {
    // 90 minutes, wasSubstitute false: he began the match. A finisher slot
    // scores post-entry play only and a starter has no entry — §Finishers, by
    // design, and the note must not cry DATA INCONSISTENCY at it.
    const result = scorePlayer(
      { stats: emptyStats({ minutes: 90 }), context, events: [] },
      { position: "ATT", role: "finisher" },
      "ATT",
      null,
      0,
    );
    expect(result.points).toBe(0);
    expect(result.ledger[0].code).toBe("finisher.unused");
    expect(result.ledger[0].note).toMatch(/designed outcome/);
    expect(result.ledger[0].note).not.toMatch(/DATA INCONSISTENCY/);
  });

  it("still flags a SUBSTITUTE with minutes but no entry event as inconsistent data", async () => {
    const result = scorePlayer(
      { stats: emptyStats({ minutes: 20, wasSubstitute: true }), context, events: [] },
      { position: "ATT", role: "finisher" },
      "ATT",
      null,
      0,
    );
    expect(result.points).toBe(0);
    expect(result.ledger[0].note).toMatch(/DATA INCONSISTENCY/);
  });

  it("keeps 'Did not appear' for the genuinely unused finisher", async () => {
    const result = scorePlayer(
      { stats: emptyStats({ minutes: 0 }), context, events: [] },
      { position: "ATT", role: "finisher" },
      "ATT",
      null,
      0,
    );
    expect(result.ledger[0].note).toBe("Did not appear");
  });
});
