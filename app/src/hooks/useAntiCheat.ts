import { useEffect } from "react";
import { warnTabSwitchOnce } from "@/lib/notify";

interface UseAntiCheatOptions {
  /** Reminder shown once per session on the first tap. Pass null to suppress. */
  warningMessage?: string | null;
  /** Delay before applying the penalty, so transient mobile visibility flickers do not count. */
  hiddenGraceMs?: number;
}

const DEFAULT_WARNING =
  "Don't switch tabs — it counts as a penalty";

/**
 * Calls `onTabAway` whenever the user switches away from the tab.
 * Used to forfeit / mark wrong during active games. Shows the rule once per
 * session, on the first interaction, so it isn't a hidden gotcha.
 */
export function useAntiCheat(
  onTabAway: () => void,
  { warningMessage = DEFAULT_WARNING, hiddenGraceMs = 1000 }: UseAntiCheatOptions = {},
) {
  useEffect(() => {
    // Once per session, on the player's first tap or key in the game — not as
    // it opens, where it covered the first question (owner decision 9).
    if (!warningMessage) return;
    return warnTabSwitchOnce(warningMessage);
    // Arm once per mount; a new message string (locale switch) mustn't re-arm.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
