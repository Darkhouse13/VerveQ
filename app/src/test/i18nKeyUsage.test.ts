import { describe, expect, it } from "vitest";
import { missingKeys, unusedKeys } from "../../scripts/i18nKeys.mjs";
import { DEFAULT_META, ROUTE_META, ROUTE_META_KEYS } from "@/lib/routeMeta";
import { ERROR_COPY } from "@/lib/errors";
import { TASTE_QUESTION_POOL } from "@/lib/tasteRound";
import enShell from "@/i18n/locales/en/shell.json";

// VerveQ ONE P4.6: every literal t("…") key the code calls must exist in en —
// eleven Weekend availability keys once shipped with no locale entry at all,
// so fr/es players read the English defaultValue and nobody noticed.
describe("i18n key usage", () => {
  it("defines every literal t() key used in src/ in an en namespace", () => {
    const missing = missingKeys().map(({ key, file }) => `${key} (${file})`);
    expect(missing).toEqual([]);
  });

  it("keeps no en key that nothing in src/ references", () => {
    expect(unusedKeys()).toEqual([]);
  });
});

describe("English sources stay in step with the en locale", () => {
  const meta = (enShell as { meta: Record<string, { title: string; description: string }> }).meta;

  it("mirrors every route's tab title and description", () => {
    expect(meta.default).toEqual(DEFAULT_META);
    for (const [path, key] of Object.entries(ROUTE_META_KEYS)) {
      expect(meta[key], path).toEqual(ROUTE_META[path]);
    }
    expect(Object.keys(meta).sort()).toEqual(
      ["default", ...Object.values(ROUTE_META_KEYS)].sort(),
    );
  });

  it("mirrors every curated error message", () => {
    expect((enShell as { errors: Record<string, string> }).errors).toEqual(ERROR_COPY);
  });

  it("mirrors the taste-round questions", () => {
    const taste = (enShell as { taste: Record<string, Record<string, string>> }).taste;
    for (const q of TASTE_QUESTION_POOL) {
      expect(taste[q.id]?.question, q.id).toBe(q.question);
      expect(taste[q.id]?.explanation, q.id).toBe(q.explanation);
      for (const [i, option] of q.options.entries()) {
        const localized = taste[q.id]?.[`o${i}`];
        if (localized !== undefined) expect(localized, `${q.id}.o${i}`).toBe(option);
      }
    }
  });
});
