/**
 * The tab-switch rule line (owner decision 9, placement ruled 2026-10-22).
 *
 * A live game states its rule ("Don't switch tabs — leaving forfeits the
 * round") as one quiet line under the game frame's header, never as a pop-up
 * over the question. useAntiCheat publishes the line here; StageFrame shows it;
 * a ResultScreen on screen hides it (the game is over).
 *
 * Only one game frame is mounted at a time, so one module-level value is
 * enough. Kept out of React context so no caller has to thread a prop.
 */
import { useSyncExternalStore } from "react";

let rule: string | null = null;
let suppressed = 0;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function snapshot(): string | null {
  return suppressed > 0 ? null : rule;
}

/** Publish (or clear, with null) the live game's rule line. */
export function setTabRule(next: string | null): void {
  if (rule === next) return;
  rule = next;
  emit();
}

/** Hide the line while something that is not play (a result) is on screen. Returns the undo. */
export function suppressTabRule(): () => void {
  suppressed += 1;
  emit();
  return () => {
    suppressed -= 1;
    emit();
  };
}

/** The line to show now, or null. */
export function useTabRule(): string | null {
  return useSyncExternalStore(subscribe, snapshot, () => null);
}

const SEEN_KEY = "vq.tabRuleSeen";

/**
 * True the first time it is called in a browser session, false after. The
 * rule is stated on the session's first live game only: once read, it is
 * known, and the line costs a row of height on every later game.
 */
export function claimFirstTabRule(): boolean {
  try {
    if (sessionStorage.getItem(SEEN_KEY)) return false;
    sessionStorage.setItem(SEEN_KEY, "1");
  } catch {
    // Storage blocked: state the rule on every game rather than never.
  }
  return true;
}
