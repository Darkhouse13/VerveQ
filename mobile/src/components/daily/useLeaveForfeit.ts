import { useEffect, useRef } from "react";
import { AppState } from "react-native";

import { useGuardedLeave } from "@/lib/guardLeave";

/**
 * The web's tab-switch rule: leaving the app while a round is live forfeits
 * that round (an answer is one search away). Never touches a revealed round.
 */
export function useLeaveForfeit(active: boolean, forfeit: () => void) {
  useGuardedLeave(active, forfeit);
  const latest = useRef({ active, forfeit });
  useEffect(() => {
    latest.current = { active, forfeit };
  });
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state !== "active" && latest.current.active) latest.current.forfeit();
    });
    return () => sub.remove();
  }, []);
}
