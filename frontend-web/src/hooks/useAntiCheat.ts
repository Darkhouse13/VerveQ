import { useEffect } from "react";
import { toast } from "sonner";

interface UseAntiCheatOptions {
  /** One-time toast shown on mount to warn the player. Pass null to suppress. */
  warningMessage?: string | null;
  /** Delay before applying the penalty, so transient mobile visibility flickers do not count. */
  hiddenGraceMs?: number;
}

const DEFAULT_WARNING =
  "Don't switch tabs — it counts as a penalty";

/**
 * Calls `onTabAway` whenever the user switches away from the tab.
 * Used to forfeit / mark wrong during active games. Shows a one-time
 * warning toast on mount so the rule isn't a hidden gotcha.
 */
export function useAntiCheat(
  onTabAway: () => void,
  { warningMessage = DEFAULT_WARNING, hiddenGraceMs = 1000 }: UseAntiCheatOptions = {},
) {
  useEffect(() => {
    if (warningMessage) {
      toast.warning(warningMessage, { duration: 4000 });
    }
    // Intentionally only fire warning on mount; subsequent re-renders
    // (e.g. callback identity changes) shouldn't re-toast.
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
