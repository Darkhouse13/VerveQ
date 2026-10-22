import { useEffect, useState } from "react";
import { claimFirstTabRule, setTabRule } from "@/lib/tabRule";

interface UseAntiCheatOptions {
  /**
   * The rule, stated as one quiet line under the game header (never a pop-up
   * over the question). Shown on the browser session's first live game, for
   * that whole game. Pass null to state nothing.
   */
  warningMessage?: string | null;
  /**
   * Whether a round is live. A screen that can open on a finished game (a
   * daily already played) passes false until play starts, so reopening a
   * result never uses up the session's one statement of the rule.
   */
  active?: boolean;
  /** Delay before applying the penalty, so transient mobile visibility flickers do not count. */
  hiddenGraceMs?: number;
}

const DEFAULT_WARNING =
  "Don't switch tabs — it counts as a penalty";

/**
 * Calls `onTabAway` whenever the user switches away from the tab.
 * Used to forfeit / mark wrong during active games. The rule is stated in the
 * game frame (lib/tabRule) so it isn't a hidden gotcha.
 */
export function useAntiCheat(
  onTabAway: () => void,
  { warningMessage = DEFAULT_WARNING, active = true, hiddenGraceMs = 1000 }: UseAntiCheatOptions = {},
) {
  // Decided once per mount: this game states the rule, or it doesn't. Keeping
  // it for the whole game means the stage never jumps mid-round.
  const [states, setStates] = useState(false);
  useEffect(() => {
    if (!warningMessage || !active || states) return;
    if (claimFirstTabRule()) setStates(true);
  }, [warningMessage, active, states]);

  useEffect(() => {
    if (!states || !warningMessage) return;
    setTabRule(warningMessage);
    return () => setTabRule(null);
  }, [states, warningMessage]);

  useEffect(() => {
    let penaltyTimer: number | undefined;
    const handler = () => {
      if (document.visibilityState === "hidden") {
        penaltyTimer = window.setTimeout(onTabAway, hiddenGraceMs);
      } else if (penaltyTimer !== undefined) {
        window.clearTimeout(penaltyTimer);
        penaltyTimer = undefined;
      }
    };
    document.addEventListener("visibilitychange", handler);
    return () => {
      if (penaltyTimer !== undefined) window.clearTimeout(penaltyTimer);
      document.removeEventListener("visibilitychange", handler);
    };
  }, [onTabAway, hiddenGraceMs]);
}
