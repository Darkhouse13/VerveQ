/**
 * A browser's first Career Path is drawn from the easy pool. The default mix
 * can serve a twelve-club journeyman as someone's first ever path (seen in the
 * 2026-10-22 onboarding walkthrough), which reads as "this game is
 * impossible" to a newcomer. After the first one, the usual mix applies.
 */
const PLAYED_KEY = "vq.careerPathPlayed";

/** The difficulty to request for the next path: "easy" until one has started here. */
export function firstRunDifficulty(): "easy" | undefined {
  try {
    return localStorage.getItem(PLAYED_KEY) ? undefined : "easy";
  } catch {
    // Storage blocked: no history to go on, keep the usual mix.
    return undefined;
  }
}

/** Record that a path has started in this browser. */
export function markCareerPathPlayed(): void {
  try {
    localStorage.setItem(PLAYED_KEY, "1");
  } catch {
    // ignore
  }
}
