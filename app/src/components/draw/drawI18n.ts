/**
 * THE DRAW's copy lives in the lazy `draw` locale namespace (VerveQ ONE P4.2).
 *
 * Two ways to read it:
 *  - `useDrawT()` in components — the active language, via react-i18next;
 *  - `enDrawT` in pure helpers (effect sentences, entry descriptors, share
 *    text) as their default, so a helper called without a translator still
 *    returns the English the contract tests pin — read from the same en JSON,
 *    never a second hand-written copy.
 *
 * When react-i18next has no initialised instance (an isolated render, e.g. a
 * component test), `useDrawT` falls back to `enDrawT` rather than rendering
 * raw keys.
 */
import { useTranslation } from "react-i18next";
import en from "@/i18n/locales/en/draw.json";

export const DRAW_NS = "draw";

export type DrawVars = Record<string, string | number>;
export type DrawT = (key: string, vars?: DrawVars) => string;

function lookup(key: string): string | null {
  let node: unknown = en;
  for (const part of key.split(".")) {
    if (node === null || typeof node !== "object") return null;
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === "string" ? node : null;
}

/** English, straight from the en locale file, with `{{var}}` interpolation. */
export const enDrawT: DrawT = (key, vars) => {
  const template = lookup(key) ?? key;
  if (!vars) return template;
  return template.replace(/\{\{(\w+)\}\}/g, (match, name: string) =>
    name in vars ? String(vars[name]) : match,
  );
};

/** The active language's THE DRAW copy. */
export function useDrawT(): DrawT {
  const { t, i18n } = useTranslation(DRAW_NS);
  if (!i18n?.isInitialized) return enDrawT;
  return t as unknown as DrawT;
}
