/**
 * Answer-leak guard fixture — the ALLOWED shape.
 *
 * Everything here is allowlisted ambient state (timer, score, lives, streak,
 * combo, roster status, standings, and per-player picks on reveal), so the guard
 * must pass on this file. To see the guard FAIL, add a question-content
 * reference (e.g. `data.options`, `q.answer`, `pick.correctAnswer`) inside this
 * directory and run `npm run lint`. See app/eslint.config.js (ANSWER_LEAK_GUARD).
 */

interface AmbientProps {
  seconds: number;
  timeFraction: number;
  score: number;
  lives: number;
  streak: number;
  combo: number;
  roster: Array<{ id: string; name: string; state: "answering" | "answered" }>;
  standings: Array<{ id: string; name: string; score: number; rank: number }>;
  picks: Array<{ id: string; name: string; label: string; outcome: string; points: number }>;
}

export function allowedAmbientExample(props: AmbientProps) {
  const { seconds, score, lives, streak, combo, roster, standings, picks } = props;
  const leader = standings[0]?.name ?? "—";
  const answered = roster.filter((r) => r.state === "answered").length;
  const myPick = picks.find((p) => p.outcome === "correct")?.label ?? "—";
  return { seconds, score, lives, streak, combo, leader, answered, myPick };
}
