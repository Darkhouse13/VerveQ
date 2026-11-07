import { createContext, useContext } from "react";

/**
 * Restarts the Convex auth layer after a sign-in that swaps one session for
 * another (guest → account). Convex only reconnects with a new token when auth
 * goes signed-out → signed-in; a guest → account swap stays "signed in"
 * throughout, so without this the live connection keeps the guest's token and
 * the app keeps treating the player as a guest until a reload
 * (docs/OPEN_BUGS.md #10). App.tsx provides it by re-keying ConvexAuthProvider.
 */
export const AccountSwitchContext = createContext<() => void>(() => {});

export function useAccountSwitch() {
  return useContext(AccountSwitchContext);
}
