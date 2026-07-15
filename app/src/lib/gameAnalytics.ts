import { track, trackOnExit } from "./analytics";
import { getEntrySource } from "./entrySource";
import type { AccountState } from "@/contexts/AuthContext";

/**
 * The core game loop, as telemetry. One shared registry behind all modes so
 * "started", "completed" and "abandoned" mean the same thing everywhere.
 *
 * Every run is keyed on the SERVER-minted session id, which is the only honest
 * evidence that a game exists. That choice does the real work here:
 *
 *  - Nothing fires on a route change. Navigating to /v2/career-path without
 *    playing mints no session, so it produces silence.
 *  - A re-render that mints nothing stays silent. The auto-start owners (Career
 *    Path, Higher/Lower, VerveGrid) each provision ONE session per arrival and
 *    are idempotent across a locale switch, so i18n handing out a new `t`
 *    cannot invent a game. They used to: `t` sat in startGame's dependencies
 *    behind an effect keyed on its identity, and the first-run language modal
 *    fired exactly that on `/play` — two sessions for one visitor.
 *  - Career Path's "Next player" replays call startGame again on the same
 *    mount; each mints its own session, so each is its own game_started. (The
 *    existing recordCareerPathEvent funnel signal is ref-guarded to once per
 *    mount — a different question, deliberately not reused here.)
 *
 * A completed run is retained (not deleted) so a late unmount can never report
 * a finished game as abandoned.
 */
export type GameMode =
  | "quiz"
  | "daily"
  | "blitz"
  | "survival"
  | "daily-survival"
  | "career-path"
  | "higher-lower"
  | "verve-grid"
  | "arena";

export type GameResult = "win" | "loss" | "draw";

/**
 * What actually caused the session to be minted.
 *
 * "auto" — the play screen provisions a session in a mount effect, so arriving
 * IS starting. This is true of EVERY mode today: the visitor's real choice
 * happened one hop earlier (a mode tile, or an off-platform /play link), and
 * Career Path has no play CTA at all. A game_started carrying "auto" therefore
 * includes visitors who bounced in a second without reading the screen — it
 * means "a game was provisioned", NOT "someone chose to play".
 *
 * Read engagement from questions_answered instead: a game_abandoned with
 * questions_answered_before_exit: 0 is the honest "landed but never played"
 * cohort. Without this property, an auto-start start is indistinguishable from
 * a deliberate one — which is the exact artifact that broke the last analysis.
 */
export type StartTrigger = "auto" | "user_action";

type RunState = {
  mode: GameMode;
  startedAtMs: number;
  questionsAnswered: number;
  ended: boolean;
};

const runs = new Map<string, RunState>();

/** Whether ANY game was provisioned in this tab. The exit funnel reads this to
 *  tell "never played" from "played and left"; a plain runs.size check would
 *  lie once eviction kicks in. */
let anyRunStarted = false;

/** Runs are only ever added on a real server session, but a long-lived tab
 *  replaying Career Path could accumulate them; keep the map bounded. */
const MAX_TRACKED_RUNS = 50;

function evictOldest(): void {
  if (runs.size <= MAX_TRACKED_RUNS) return;
  const oldest = [...runs.entries()].sort(
    (a, b) => a[1].startedAtMs - b[1].startedAtMs,
  )[0];
  if (oldest) runs.delete(oldest[0]);
}

/**
 * Does this visitor have a real server identity?
 *
 * Takes accountState rather than AuthContext's `isAuthenticated`, on purpose:
 * that flag is `!!user || localGuestActive`, so it reports TRUE for tab-local
 * guests who have no server identity at all. accountState is server
 * authoritative. Centralised here so no mode has to remember the distinction.
 */
export function isRealIdentity(accountState: AccountState): boolean {
  return accountState !== "loggedOut" && accountState !== "loading";
}

/**
 * A game actually began: call this only once a session mutation has RESOLVED
 * with a session id. Idempotent per session id, so a re-render or a retry that
 * lands on the same session cannot double-count.
 */
export function startRun(
  sessionId: string | null | undefined,
  mode: GameMode,
  opts: { accountState: AccountState; startTrigger?: StartTrigger },
): void {
  if (!sessionId || runs.has(sessionId)) return;

  // A tab can only hold one live game, so a NEW session means any run still
  // open was left behind — report it rather than leaking it, or it would sit
  // un-ended forever, under-reporting abandons and pinning hasRunInProgress()
  // true for the rest of the tab's life. Ordinary navigation never reaches this
  // — the screen's unmount cleanup ends the run first, and abandonRun ignores
  // anything already ended.
  //
  // What reaches this now is the honest case: a real replay (Career Path's
  // "Next player", a difficulty change) leaving a genuinely live run behind. It
  // used to fire on a LOCALE switch too, where nobody had left anything — the
  // play screens re-created startGame on a new `t` and minted a second session.
  // That is fixed at the source; this stays as the backstop it was meant to be.
  for (const [id, run] of runs) if (!run.ended) abandonRun(id);

  anyRunStarted = true;
  runs.set(sessionId, {
    mode,
    startedAtMs: Date.now(),
    questionsAnswered: 0,
    ended: false,
  });
  evictOldest();
  track("game_started", {
    mode,
    entry_source: getEntrySource(),
    is_authenticated: isRealIdentity(opts.accountState),
    account_state: opts.accountState,
    start_trigger: opts.startTrigger ?? "auto",
  });
}

/** One question resolved. Feeds questions_answered / _before_exit; never fires
 *  an event of its own. */
export function noteQuestionAnswered(sessionId: string | null | undefined): void {
  const run = sessionId ? runs.get(sessionId) : undefined;
  if (!run || run.ended) return;
  run.questionsAnswered += 1;
}

/**
 * The player reached a real end state. Idempotent: the modes with several
 * terminal branches converging on one flag cannot double-report.
 *
 * A FORCED end is a completion only when it still yields a real scored
 * outcome, which is what the server records:
 *  - Career Path's tab-switch penalty scores the run and shows the result card
 *    (careerPath penalizeTabSwitch) -> completion.
 *  - Quiz's penalizeTabSwitch stamps `abandonedAt` with no score, and Daily's
 *    forfeit writes `score: 0, forfeited: true` -> those are abandons, and
 *    calling them completions would inflate completion rate.
 * Survival's cash-out is voluntary and scored -> completion, not abandon.
 */
export function completeRun(
  sessionId: string | null | undefined,
  opts: {
    score?: number;
    result?: GameResult;
    questionsAnswered?: number;
  } = {},
): void {
  const run = sessionId ? runs.get(sessionId) : undefined;
  if (!run || run.ended) return;
  run.ended = true;
  track("game_completed", {
    mode: run.mode,
    score: opts.score,
    questions_answered: opts.questionsAnswered ?? run.questionsAnswered,
    duration_seconds: Math.round((Date.now() - run.startedAtMs) / 1000),
    result: opts.result,
  });
}

/**
 * The player left mid-game. Safe to call unconditionally from an unmount
 * cleanup: a run that already completed is ignored, so only genuine
 * mid-session exits report.
 */
export function abandonRun(sessionId: string | null | undefined): void {
  const run = sessionId ? runs.get(sessionId) : undefined;
  if (!run || run.ended) return;
  run.ended = true;
  track("game_abandoned", {
    mode: run.mode,
    questions_answered_before_exit: run.questionsAnswered,
  });
}

/** True while a session is live and unfinished — used by the exit funnel to
 *  tell "left mid-game" apart from "never played". */
export function hasRunInProgress(): boolean {
  for (const run of runs.values()) if (!run.ended) return true;
  return false;
}

/** True once any game has been provisioned in this tab. */
export function hasAnyRunStarted(): boolean {
  return anyRunStarted;
}

/**
 * Report live runs when the DOCUMENT goes away.
 *
 * The per-screen unmount cleanups only cover in-app navigation. Closing the
 * tab, or following a link out, tears down the JS context without React ever
 * running a cleanup — so without this, the most common way to walk out of a
 * game mid-round produces no game_abandoned at all, and the run is simply lost.
 *
 * pagehide only, deliberately. visibilitychange->hidden also fires when a tab
 * is merely backgrounded, and someone who switches apps and comes back has not
 * abandoned anything — reporting them would inflate abandons with people still
 * playing. The cost is that a mobile session killed while backgrounded is
 * never seen; that is a real gap, and preferable to a fabricated one.
 */
export function armExitAbandonReporting(): void {
  if (typeof window === "undefined") return;
  window.addEventListener("pagehide", () => {
    for (const [, run] of runs) {
      if (run.ended) continue;
      run.ended = true;
      trackOnExit("game_abandoned", {
        mode: run.mode,
        questions_answered_before_exit: run.questionsAnswered,
        exit_signal: "pagehide",
      });
    }
  });
}

/** Test seam only. */
export function __resetRunsForTest(): void {
  runs.clear();
  anyRunStarted = false;
}
