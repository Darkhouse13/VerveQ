import { Share } from "react-native";

export type DailyGameKey = "older" | "letters";

export const DAILY_GAMES = {
  older: { title: "Who's Older?", path: "older" },
  letters: { title: "Missing Letters", path: "letters" },
} as const;

/** Same rules as the web (app/src/lib/dailyShare.ts). */
const MIN_FINISHERS_FOR_STANDING = 5;
const MIN_STANDING_PCT = 50;

/** "Better than X%" only when it flatters (docs/BRAND.md honest numbers). */
export function visibleStandingPct(standing: { below: number; finishers: number } | null | undefined): number | null {
  if (!standing || standing.finishers < MIN_FINISHERS_FOR_STANDING) return null;
  const pct = Math.round((standing.below / standing.finishers) * 100);
  return pct >= MIN_STANDING_PCT ? pct : null;
}

/** 🟩🟩🟩 🟩🟥🟩 🟥🟩🟥 🟩 — grouped by the 3/3/3/1 difficulty ramp. */
export function tierGrid(history: { correct: boolean }[]): string {
  return history.map((r, i) => ([3, 6, 9].includes(i) ? " " : "") + (r.correct ? "🟩" : "🟥")).join("");
}

export function challengeUrl(game: DailyGameKey, challengeId: string) {
  return `https://verveq.com/${DAILY_GAMES[game].path}?c=${challengeId}`;
}

export async function shareDailyResult(opts: {
  game: DailyGameKey;
  edition: number;
  score: number;
  total: number;
  history: { correct: boolean }[];
  standingPct?: number | null;
  url: string;
}) {
  const lines = [
    `${DAILY_GAMES[opts.game].title} #${opts.edition} · ${opts.score}/${opts.total}`,
    tierGrid(opts.history),
  ];
  if (opts.standingPct != null) lines.push(`Better than ${opts.standingPct}% of today's players`);
  lines.push(opts.url);
  try {
    await Share.share({ message: lines.join("\n") });
  } catch {
    // Dismissed or unavailable: nothing to do.
  }
}

export function countdownToUtcMidnight(now = Date.now()) {
  const next = Math.floor(now / 86_400_000 + 1) * 86_400_000;
  const mins = Math.max(0, Math.floor((next - now) / 60_000));
  return `${Math.floor(mins / 60)}h ${String(mins % 60).padStart(2, "0")}m`;
}
