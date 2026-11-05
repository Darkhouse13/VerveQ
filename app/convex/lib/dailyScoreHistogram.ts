/**
 * Per-date score histogram for the two daily twins (Who's Older, Missing
 * Letters). Standing ("better than X% of today's players") used to re-read
 * every finished session of the day on each getToday — and getToday is a
 * reactive query, so every new finisher re-ran that full scan for every
 * viewer. The histogram is one small doc maintained on completion; standing
 * reads it in O(1). Integrity is unchanged: scores are still the server's.
 */
import type { MutationCtx, QueryCtx } from "../_generated/server";

export type DailyTwin = "older" | "letters";

type ScoreRow = { score: number };

function standingFrom(counts: number[], score: number) {
  let finishers = 0;
  let below = 0;
  counts.forEach((n, s) => {
    finishers += n;
    if (s < score) below += n;
  });
  return { finishers, below };
}

function histogramOf(rows: ScoreRow[]) {
  const counts: number[] = [];
  for (const { score } of rows) {
    while (counts.length <= score) counts.push(0);
    counts[score] += 1;
  }
  return counts;
}

async function findDoc(ctx: Pick<QueryCtx, "db">, game: DailyTwin, dateKey: string) {
  return ctx.db
    .query("dailyScoreHistograms")
    .withIndex("by_game_date", (q) => q.eq("game", game).eq("dateKey", dateKey))
    .first();
}

/**
 * Call AFTER the session is patched to completed. First finisher of a date
 * (or first after deploy) seeds the doc from one scan that already includes
 * this session; later finishers just increment.
 */
export async function recordDailyFinish(
  ctx: MutationCtx,
  game: DailyTwin,
  dateKey: string,
  score: number,
  scanFinished: () => Promise<ScoreRow[]>,
) {
  const doc = await findDoc(ctx, game, dateKey);
  if (!doc) {
    await ctx.db.insert("dailyScoreHistograms", {
      game,
      dateKey,
      counts: histogramOf(await scanFinished()),
    });
    return;
  }
  const counts = [...doc.counts];
  while (counts.length <= score) counts.push(0);
  counts[score] += 1;
  await ctx.db.patch(doc._id, { counts });
}

/** Standing for `score` on `dateKey`; falls back to the scan if no doc yet. */
export async function readDailyStanding(
  ctx: Pick<QueryCtx, "db">,
  game: DailyTwin,
  dateKey: string,
  score: number,
  scanFinished: () => Promise<ScoreRow[]>,
) {
  const doc = await findDoc(ctx, game, dateKey);
  return standingFrom(doc ? doc.counts : histogramOf(await scanFinished()), score);
}
