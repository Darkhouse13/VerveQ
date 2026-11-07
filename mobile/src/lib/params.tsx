import { Redirect, useLocalSearchParams } from "expo-router";
import type { ComponentType } from "react";

// Route params arrive from App Links / deep links, i.e. from anyone. Validate
// them before a screen mounts: a malformed id would otherwise reach a Convex
// `v.id` validator and throw inside a reactive query (crashing the screen).

export function param(v: string | string[] | undefined): string {
  return (Array.isArray(v) ? v[0] : v) ?? "";
}

/** Convex document ids: lowercase base32, ~32 chars. */
export const isConvexId = (s: string) => /^[0-9a-z]{20,64}$/.test(s);
/** Share/join codes (duel link codes, crew codes): short, URL-safe. */
export const isCode = (s: string) => /^[A-Za-z0-9_-]{4,32}$/.test(s);
export const optional = (check: (s: string) => boolean) => (s: string) => s === "" || check(s);

type Checks = Record<string, (s: string) => boolean>;

/** Mount `Screen` only if every listed param passes; otherwise go to Play. */
export function guardParams<P extends object>(Screen: ComponentType<P>, checks: Checks) {
  function Guarded(props: P) {
    const params = useLocalSearchParams();
    for (const [key, check] of Object.entries(checks)) {
      if (!check(param(params[key] as string | string[] | undefined))) return <Redirect href="/" />;
    }
    return <Screen {...props} />;
  }
  return Guarded;
}
