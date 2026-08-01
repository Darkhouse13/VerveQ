// "THE LADDER" — five career paths, hardest last, and the whole climb is
// visible at frame 0.
//
// Why this exists: the single-path reveal (src/CareerPathReveal.tsx) shows one
// puzzle and answers it. A viewer who solves it at 0:02 has no reason left to
// stay, which is exactly where the watch time dies. Every high-retention quiz
// clip in the wild does the opposite — it shows the ENTIRE gauntlet up front
// (the rail below), labels the last rung IMPOSSIBLE, and makes the viewer stay
// to watch the rail fill. The final rung is never answered on screen: the
// comment box is the only place the answer exists.
export const FPS = 30;

export type Rung = {
  clubs: string[];
  answer: string; // rail + card stamp; the last rung's is deliberately unused
  tier: "EASY" | "MEDIUM" | "HARD" | "IMPOSSIBLE";
};

// Sourced from app/convex/data/football_career_paths.json (ids in comments) so
// the facts are the app's facts. Every path below is copied WHOLE from the
// dataset — never truncated, because a shortened path is a different puzzle and
// often an ambiguous one. Escalation is the point: rung 1 must be a gimme — a
// viewer who gets one right immediately is a viewer who stays.
//
// CASTING LAW (added after the 30d IG read): every rung that gets ANSWERED on
// screen must be a name a casual fan knows on sight. The first cut of this
// ladder answered Koundé and Netzer — correct facts, no reach. Subject
// selection is a production step now: format is the multiplier, the name is the
// base, and a mid-tier base multiplies to nothing.
export const RUNGS: Rung[] = [
  // cp-messi
  { clubs: ["Barcelona", "Paris Saint-Germain", "Inter Miami"], answer: "MESSI", tier: "EASY" },
  // cp-haaland — the obscure Norwegian open is the "…oh, it's Haaland" beat
  { clubs: ["Bryne", "Molde", "Red Bull Salzburg", "Borussia Dortmund", "Manchester City"], answer: "HAALAND", tier: "EASY" },
  // cp-zidane
  { clubs: ["Cannes", "Bordeaux", "Juventus", "Real Madrid"], answer: "ZIDANE", tier: "MEDIUM" },
  // cp-luis-enrique — Real Madrid AND Barcelona in one path is the best
  // ANSWERED beat in the piece: it looks like a mistake until the name lands.
  { clubs: ["Sporting Gijón", "Real Madrid", "Barcelona"], answer: "LUIS ENRIQUE", tier: "HARD" },
  // cp-michel-platini — NEVER revealed on screen. This is the comment engine,
  // and it only works because the withheld name is one people RECOGNISE the
  // moment someone types it. An unguessable answer is a dead end, not a hook —
  // that was the flaw in the Sušić cut: nobody could supply the payoff, so
  // nobody typed anything.
  { clubs: ["Nancy", "Saint-Étienne", "Juventus"], answer: "PLATINI", tier: "IMPOSSIBLE" },
];

export const STEP = 84; // rungs 1–4: 2.8s each
export const LAST = 144; // rung 5 holds longer — the unanswered beat is the payload
export const startOf = (i: number): number => i * STEP;
export const TOTAL = STEP * 4 + LAST; // 480 = 16.0s

// within-rung beats
export const CLUB_IN = 8; // first club lands here — something moves before 0.3s
export const CLUB_GAP = 10;
export const THINK_AT = 38;
export const ANSWER_AT = 62; // rungs 1–4 only
export const YOURTURN_AT = 92; // rung 5: the demand replaces the answer
