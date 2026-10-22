import { describe, expect, it } from "vitest";
import { ALLOWLIST, PATTERNS, allowlistUsage, countAll, readBaseline } from "../../scripts/designRatchet.mjs";

type CountMap = Record<string, Record<string, number>>;

/**
 * Design ratchet (VerveQ ONE plan). Counts of off-system patterns per file may
 * only go down. When this fails:
 *  - a count ROSE: use the design-system primitive or token instead;
 *  - a count FELL: good — lock it in with `npm run design:baseline`.
 */
describe("design ratchet", () => {
  const current = countAll() as CountMap;
  const baseline = readBaseline() as CountMap;

  it("no file gains an off-system pattern", () => {
    const rises: string[] = [];
    for (const [file, counts] of Object.entries(current)) {
      for (const [pattern, n] of Object.entries(counts)) {
        const allowed = baseline[file]?.[pattern] ?? 0;
        if (n > allowed) rises.push(`${file}: ${pattern} ${allowed} → ${n}`);
      }
    }
    expect(rises, "use the design-system primitive or token instead").toEqual([]);
  });

  it("the baseline matches every improvement", () => {
    const falls: string[] = [];
    for (const [file, counts] of Object.entries(baseline)) {
      for (const [pattern, allowed] of Object.entries(counts)) {
        const n = current[file]?.[pattern] ?? 0;
        if (n < allowed) falls.push(`${file}: ${pattern} ${allowed} → ${n}`);
      }
    }
    expect(falls, "run `npm run design:baseline` to lock these in").toEqual([]);
  });

  // VerveQ ONE P5.1: the ratchet reached zero. The baseline stays empty, so a
  // new off-system pattern can't be "locked in" by rewriting it; a real
  // exception goes in ALLOWLIST (scripts/designRatchet.mjs) with its reason.
  it("holds every count at zero", () => {
    expect(baseline, "add a reasoned ALLOWLIST entry instead of a baseline count").toEqual({});
  });

  it("every allowlist exception is reasoned, real and still needed", () => {
    for (const entry of ALLOWLIST) {
      expect(entry.reason.length, `${entry.file}: ${entry.pattern} needs a reason`).toBeGreaterThan(20);
      expect(PATTERNS[entry.pattern], `${entry.file}: unknown pattern ${entry.pattern}`).toBeDefined();
    }
    const stale = allowlistUsage()
      .filter((e) => e.used === 0 || (e.count !== undefined && e.used < e.count))
      .map((e) => `${e.file}: ${e.pattern} excuses ${e.used} of ${e.count ?? "∞"}`);
    expect(stale, "tighten or remove these allowlist entries").toEqual([]);
  });
});
