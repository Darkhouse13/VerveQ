import { describe, expect, it } from "vitest";
import { countAll, readBaseline } from "../../scripts/designRatchet.mjs";

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
});
