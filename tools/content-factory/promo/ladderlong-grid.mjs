// The ladder-long grid, PARSED out of src/promo/ladderlong/timeline.ts.
//
// WHY THIS FILE EXISTS. Every other promo in this lane hand-copies its grid
// constants into the audio script under a "MUST match timeline.ts" comment.
// That was survivable while there was one grid; batch 2 runs a cadence A/B, so
// there are now two, plus a per-edition mapping of which edition runs which —
// and it is mirrored into BOTH promo/ladderlong-audio.mjs (to place the slams
// and ticks) AND promo/ladderlong-vo.mjs (to size the slot budgets). Three
// copies of two grids is a drift waiting to happen, and a drift here is
// inaudible until a voice line lands on top of a countdown.
//
// So the numbers are read from the one place they are declared. The parser is
// deliberately strict and throws on anything it does not recognise: a silent
// mis-parse would hand back a plausible-looking grid, which is worse than no
// grid at all. If the casting or grid FORMAT changes, fix this parser — do not
// go back to hand-copying.
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const TIMELINE = path.join(dir, "..", "src", "promo", "ladderlong", "timeline.ts");

export const FPS = 30;

const src = readFileSync(TIMELINE, "utf8");

const grabGrid = (name) => {
  const m = src.match(new RegExp(`export const ${name}: Grid = \\{([\\s\\S]*?)\\n\\};`));
  if (!m) throw new Error(`ladderlong-grid: no grid "${name}" in timeline.ts`);
  const body = m[1];
  const num = (k) => {
    const r = body.match(new RegExp(`\\b${k}:\\s*(\\d+)`));
    if (!r) throw new Error(`ladderlong-grid: ${name}.${k} not found`);
    return Number(r[1]);
  };
  const arr = (k) => {
    const r = body.match(new RegExp(`\\b${k}:\\s*\\[([^\\]]*)\\]`));
    if (!r) throw new Error(`ladderlong-grid: ${name}.${k} not found`);
    return r[1].split(",").map((s) => Number(s.trim()));
  };
  const g = {
    name,
    step: num("step"),
    last: num("last"),
    cta: num("cta"),
    clubIn: num("clubIn"),
    clubGap: num("clubGap"),
    thinkAt: num("thinkAt"),
    tickAt: arr("tickAt"),
    answerAt: num("answerAt"),
  };
  if (g.tickAt.length !== 3 || g.tickAt.some((t) => !Number.isFinite(t))) {
    throw new Error(`ladderlong-grid: ${name}.tickAt did not parse as three frames`);
  }
  if (!(g.answerAt < g.step && g.answerAt < g.last && g.tickAt[2] < g.answerAt)) {
    throw new Error(`ladderlong-grid: ${name} is not internally ordered (ticks < answer < step/last)`);
  }
  return g;
};

export const GRIDS = {
  GRID_7: grabGrid("GRID_7"),
  GRID_5_5: grabGrid("GRID_5_5"),
};

// The follow-hook card belongs to the BATCH, not the cadence — batch 1 shipped
// without one and has to keep rendering at its original 2280f. Parsed rather
// than mirrored, same as everything else here.
const followMatch = src.match(/export const FOLLOW_CARD = (\d+);/);
if (!followMatch) throw new Error("ladderlong-grid: FOLLOW_CARD not found in timeline.ts");
export const FOLLOW_CARD = Number(followMatch[1]);

export const followFrames = (ed) => (ed.batch >= 2 ? FOLLOW_CARD : 0);
export const totalOf = (ed) => ed.grid.step * 9 + ed.grid.last + followFrames(ed) + ed.grid.cta;
export const followAt = (ed) => ed.grid.step * 9 + ed.grid.last;
export const ctaAt = (ed) => followAt(ed) + followFrames(ed);

// ---- the edition table: slug, batch, grid, and per-rung club counts ----
// The club counts drive the SFX slams, which land one per club, and the four
// editions in a batch have different path lengths (2 to 7 clubs).
export const readEditions = () => {
  const body = src.slice(src.indexOf("export const EDITIONS"));
  const marks = [];
  // digits are legal in slugs since batch 3's "five-leagues-2"
  const slugRe = /slug:\s*"([a-z0-9-]+)"/g;
  let m;
  while ((m = slugRe.exec(body)) !== null) marks.push({ slug: m[1], at: m.index });

  const editions = marks.map((mark, k) => {
    const chunk = body.slice(mark.at, k + 1 < marks.length ? marks[k + 1].at : body.length);
    const counts = [];
    const rungRe = /\bclubs:\s*\[([^\]]*)\]/g;
    let r;
    while ((r = rungRe.exec(chunk)) !== null) counts.push((r[1].match(/"/g) ?? []).length / 2);
    const b = chunk.match(/\bbatch:\s*(\d)/);
    const gname = chunk.match(/\bgrid:\s*(GRID_\w+)/);
    // Optional third axis (batch 2.5): which campaign's closing copy this
    // edition speaks. Absent on every edition that is not a campaign cut, so
    // unlike batch/grid a miss here is legal rather than fatal.
    const camp = chunk.match(/\bcampaign:\s*"([a-z-]+)"/);
    return {
      slug: mark.slug,
      batch: b ? Number(b[1]) : 0,
      grid: gname ? GRIDS[gname[1]] : undefined,
      campaign: camp ? camp[1] : undefined,
      counts,
    };
  });

  const bad = editions.filter(
    (e) => e.counts.length !== 10 || e.counts.some((c) => c < 1 || c > 7) || !e.grid || (e.batch !== 1 && e.batch !== 2 && e.batch !== 3),
  );
  if (editions.length === 0 || bad.length > 0) {
    throw new Error(
      `ladderlong-grid: failed to parse timeline.ts (${editions.length} editions, ` +
        `${bad.map((b) => `${b.slug}:${b.counts.length}rungs/batch${b.batch}/${b.grid ? b.grid.name : "no-grid"}`).join(",")} malformed). ` +
        `The casting format changed — fix the parser, do not hand-copy the counts.`,
    );
  }
  return editions;
};
