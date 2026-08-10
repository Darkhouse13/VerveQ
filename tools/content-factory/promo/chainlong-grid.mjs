// The chain-long grid, PARSED out of src/promo/chainlong/timeline.ts — the
// same single-source law as promo/ladderlong-grid.mjs and for the same reason:
// the grid is mirrored into the SFX arrangement AND the VO slot budgets, and a
// hand-copied number that drifts is inaudible until a voice line lands on top
// of a countdown. The parser is strict and throws on anything it does not
// recognise; if the format changes, fix the parser, do not hand-copy.
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const TIMELINE = path.join(dir, "..", "src", "promo", "chainlong", "timeline.ts");

export const FPS = 30;

const src = readFileSync(TIMELINE, "utf8");

const grabGrid = (name) => {
  const m = src.match(new RegExp(`export const ${name}: Grid = \\{([\\s\\S]*?)\\n\\};`));
  if (!m) throw new Error(`chainlong-grid: no grid "${name}" in timeline.ts`);
  const body = m[1];
  const num = (k) => {
    const r = body.match(new RegExp(`\\b${k}:\\s*(\\d+)`));
    if (!r) throw new Error(`chainlong-grid: ${name}.${k} not found`);
    return Number(r[1]);
  };
  const arr = (k) => {
    const r = body.match(new RegExp(`\\b${k}:\\s*\\[([^\\]]*)\\]`));
    if (!r) throw new Error(`chainlong-grid: ${name}.${k} not found`);
    return r[1].split(",").map((s) => Number(s.trim()));
  };
  const g = {
    name,
    step: num("step"),
    last: num("last"),
    cta: num("cta"),
    thinkAt: num("thinkAt"),
    tickAt: arr("tickAt"),
    answerAt: num("answerAt"),
  };
  if (g.tickAt.length !== 3 || g.tickAt.some((t) => !Number.isFinite(t))) {
    throw new Error(`chainlong-grid: ${name}.tickAt did not parse as three frames`);
  }
  if (!(g.answerAt < g.step && g.answerAt < g.last && g.tickAt[2] < g.answerAt)) {
    throw new Error(`chainlong-grid: ${name} is not internally ordered (ticks < answer < step/last)`);
  }
  return g;
};

export const GRIDS = { GRID_C7: grabGrid("GRID_C7") };

const followMatch = src.match(/export const FOLLOW_CARD = (\d+);/);
if (!followMatch) throw new Error("chainlong-grid: FOLLOW_CARD not found in timeline.ts");
export const FOLLOW_CARD = Number(followMatch[1]);

export const totalOf = (ed) => ed.grid.step * 9 + ed.grid.last + FOLLOW_CARD + ed.grid.cta;
export const followAt = (ed) => ed.grid.step * 9 + ed.grid.last;
export const ctaAt = (ed) => followAt(ed) + FOLLOW_CARD;

// ---- the edition table: slug + slot count ----
// Chain slots carry no club paths (nothing on screen draws one), so unlike the
// ladder there are no per-rung club counts to feed the slams — but the NINE
// answered slots per edition is still a contract worth failing loudly on: a
// tenth entry would be a withhold-discipline breach, not a casting change.
export const readEditions = () => {
  const body = src.slice(src.indexOf("export const EDITIONS"));
  const marks = [];
  const slugRe = /slug:\s*"([a-z-]+)"/g;
  let m;
  while ((m = slugRe.exec(body)) !== null) marks.push({ slug: m[1], at: m.index });

  const editions = marks.map((mark, k) => {
    const chunk = body.slice(mark.at, k + 1 < marks.length ? marks[k + 1].at : body.length);
    const slots = (chunk.match(/\bid:\s*"cp-/g) ?? []).length;
    return { slug: mark.slug, grid: GRIDS.GRID_C7, slots };
  });

  const bad = editions.filter((e) => e.slots !== 9);
  if (editions.length === 0 || bad.length > 0) {
    throw new Error(
      `chainlong-grid: failed to parse timeline.ts (${editions.length} editions, ` +
        `${bad.map((b) => `${b.slug}:${b.slots}slots`).join(",")} malformed). ` +
        `Every edition casts exactly NINE slots — slot 10 never has an entry.`,
    );
  }
  return editions;
};
