import { ConvexAuthProvider, useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth, useQuery } from "convex/react";
import * as SecureStore from "expo-secure-store";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AppState } from "react-native";

import { api, convex, convexSiteUrl } from "./convex";

// SecureStore keys may only hold letters, digits, ".", "-" and "_"; Convex Auth
// namespaces its keys with the deployment URL, so map everything else to "_".
const safeKey = (key: string) => key.replace(/[^A-Za-z0-9._-]/g, "_");
const secureStorage = {
  getItem: (key: string) => SecureStore.getItemAsync(safeKey(key)),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(safeKey(key), value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(safeKey(key)),
};

const PERMIT_PARAM = "anonymousOnboardingIpPermit"; // convex/anonymousOnboardingIp.ts

async function requestPermit(): Promise<string> {
  // Bounded: a stalled network must not leave the guest mint hanging forever.
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10_000);
  const res = await fetch(`${convexSiteUrl}/anonymous-onboarding/ip-permit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
    signal: ctrl.signal,
  }).finally(() => clearTimeout(timer));
  const body = (await res.json().catch(() => null)) as { permitToken?: unknown } | null;
  if (!res.ok || typeof body?.permitToken !== "string" || !body.permitToken.trim()) {
    throw new Error("guest_permit_refused");
  }
  return body.permitToken;
}

type Session = {
  ready: boolean; // auth state known and a user exists
  isAnonymous: boolean;
  user: ReturnType<typeof useMe>;
  ensureGuest: () => Promise<boolean>;
  /** Email + password sign-in. Throws on failure; never falls back to a guest. */
  signInWithPassword: (email: string, password: string) => Promise<void>;
  /** Wrap any explicit auth action (sign-up, upgrade, sign-out) so the guest
   *  auto-mint can't race it and overwrite the new session. */
  runAuth: <T>(fn: () => Promise<T>) => Promise<T>;
};

const SessionContext = createContext<Session | null>(null);

function useMe() {
  return useQuery(api.users.me, {});
}

// Anonymous-first, like the website: the first time the app opens, mint a
// guest session so every game can start without a sign-up.
function SessionGate({ children, onAccountSwitch }: { children: ReactNode; onAccountSwitch: () => void }) {
  const { isLoading, isAuthenticated } = useConvexAuth();
  const { signIn, signOut } = useAuthActions();
  const me = useMe();
  const minting = useRef<Promise<boolean> | null>(null);
  // While an explicit auth action runs (and briefly after), the session is
  // momentarily empty. The guest auto-mint must not fire then: it would sign
  // the player back in as a guest over their real account.
  const authBusyUntil = useRef(0);
  const busy = () => Date.now() < authBusyUntil.current;
  // Bumped to re-run the guest check after the busy window ends (sign-out,
  // failed sign-in) or after a failed mint (offline first launch, permit refused).
  const [recheck, setRecheck] = useState(0);
  const failures = useRef(0);

  const ensureGuest = useCallback(async () => {
    if (isAuthenticated) return true;
    if (minting.current) return minting.current;
    minting.current = (async () => {
      try {
        const permit = await requestPermit();
        // An explicit sign-in may have started while the permit was in flight.
        if (busy()) return false;
        await signIn("anonymous", { [PERMIT_PARAM]: permit });
        return true;
      } catch {
        return false;
      } finally {
        minting.current = null;
      }
    })();
    return minting.current;
  }, [isAuthenticated, signIn]);

  useEffect(() => {
    if (isLoading || isAuthenticated) {
      failures.current = 0;
      return;
    }
    if (busy()) return; // runAuth schedules a recheck when its window ends
    // Short grace: a sign-in that just finished may still be propagating its token.
    const t = setTimeout(() => {
      if (busy()) return;
      void ensureGuest().then((ok) => {
        if (ok) return;
        // Back off 5 s, 15 s, 45 s… capped at 2 min, then try again.
        const delay = Math.min(120_000, 5_000 * 3 ** failures.current);
        failures.current += 1;
        setTimeout(() => setRecheck((n) => n + 1), delay);
      });
    }, 300);
    return () => clearTimeout(t);
  }, [isLoading, isAuthenticated, ensureGuest, recheck]);

  // Coming back to the app is a good moment to retry a failed guest mint.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (st) => {
      if (st === "active") setRecheck((n) => n + 1);
    });
    return () => sub.remove();
  }, []);

  const runAuth = useCallback(async <T,>(fn: () => Promise<T>) => {
    authBusyUntil.current = Number.MAX_SAFE_INTEGER;
    try {
      // A guest mint already past its busy check would land after (and over)
      // this action's session; let it settle first.
      if (minting.current) await minting.current;
      return await fn();
    } finally {
      authBusyUntil.current = Date.now() + 3000;
      setTimeout(() => setRecheck((n) => n + 1), 3050);
    }
  }, []);

  const signInWithPassword = useCallback(
    (email: string, password: string) =>
      runAuth(async () => {
        const res = await signIn("password", { email, password, flow: "signIn" });
        if (!res.signingIn) throw new Error("Email or password is wrong.");
        // The guest session is replaced by the account's, without ever being
        // signed out in between. Convex only reconnects with a new token when
        // auth goes signed-out -> signed-in, so the live connection would keep
        // the guest's token (until it expires) and the app would still see a
        // guest. Remount the auth layer so it reconnects with the stored one.
        onAccountSwitch();
      }),
    [runAuth, signIn, onAccountSwitch],
  );

  // Signed in, but the user record is gone (deleted account, wiped DEV data):
  // the app would wait forever on `ready`. Sign out once per launch so a fresh
  // guest is minted; never loop.
  const recoveredOrphan = useRef(false);
  useEffect(() => {
    if (isLoading || !isAuthenticated || me !== null || recoveredOrphan.current || busy()) return;
    // Only a null that persists (not a blip while a token switches over).
    const t = setTimeout(() => {
      if (recoveredOrphan.current || busy()) return;
      recoveredOrphan.current = true;
      void runAuth(() => signOut()).catch(() => undefined);
    }, 2000);
    return () => clearTimeout(t);
  }, [isLoading, isAuthenticated, me, runAuth, signOut]);

  const value = useMemo<Session>(
    () => ({
      ready: !isLoading && isAuthenticated && me != null,
      isAnonymous: me?.isAnonymous === true,
      user: me,
      ensureGuest,
      signInWithPassword,
      runAuth,
    }),
    [isLoading, isAuthenticated, me, ensureGuest, signInWithPassword, runAuth],
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  // Bumped after a sign-in that swaps one session for another (see SessionGate).
  const [epoch, setEpoch] = useState(0);
  const onAccountSwitch = useCallback(() => setEpoch((n) => n + 1), []);
  return (
    <ConvexAuthProvider key={epoch} client={convex} storage={secureStorage}>
      <SessionGate onAccountSwitch={onAccountSwitch}>{children}</SessionGate>
    </ConvexAuthProvider>
  );
}

export function useSession() {
  const s = useContext(SessionContext);
  if (!s) throw new Error("useSession outside AuthProvider");
  return s;
}
