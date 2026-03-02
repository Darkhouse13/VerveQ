import { useEffect } from "react";

/**
 * Calls `onTabAway` whenever the user switches away from the tab.
 * Used to forfeit / mark wrong during active games.
 */
export function useAntiCheat(onTabAway: () => void) {
  useEffect(() => {
    const handler = () => {
      if (document.visibilityState === "hidden") {
        onTabAway();
      }
    };
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  }, [onTabAway]);
}
