// "CHAIN-LONG" voiceover — the third narrated piece, and the first one whose
// carrier is PARTLY INHERITED: every ladder-long line whose slot and copy fit
// this grid is copied straight out of promo/vo-cache-ladderlong/ and never
// re-billed. That is spec #13 taken across formats — the winners' carrier is
// bit-identical between episodes, and ours is now bit-identical between LANES,
// which is also why the chain grid pins its count-in window (tickAt[0] 2.50s)
// and answer window (2.00s) to ladder-long's GRID_7: the cached takes were
// measured against those budgets, and a reused line is only reusable because
// its window did not move.
//
// REUSED (10 lines, £0): n2…n9 (the count-ins — a relay counts you in exactly
// like a gauntlet does), `follow` ("New gauntlet daily.") and `cta2` ("Your
// score? And number ten?") — both of cta2's asks are this format's asks.
// NOT reused: `open`/`open2` (the premise is different), `n10` (slot 10's
// count-in IS the hand-over, so it is a new line), `withhold` (nothing is
// being withheld from slot 10 — it is being handed over; the confession is a
// different sentence).
//
// BILLED (21 lines): `openc`, `turn`, `omission`, and 2×9 answer names.
//
// Same discipline as promo/ladderlong-vo.mjs everywhere else: Charlie at
// stability 0.4, the grid leads the voice, generation measures every line
// against its slot budget and THROWS on overrun — if a line doesn't fit,
// shorten the line (and cut what the screen already says), never stretch the
// grid. Cached forever after; a clone with no FAL_KEY still renders.
import { writeFileSync, mkdirSync, existsSync, readFileSync, copyFileSync, readdirSync, unlinkSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { FPS, FOLLOW_CARD, readEditions } from "./chainlong-grid.mjs";

const dir = path.dirname(fileURLToPath(import.meta.url));
const CACHE = path.join(dir, "vo-cache-chainlong");
const LL_CACHE = path.join(dir, "vo-cache-ladderlong");
const LL_MANIFEST = path.join(LL_CACHE, "manifest.json");
const PUB = path.join(dir, "..", "public", "promo", "vo-cl");
const MANIFEST = path.join(CACHE, "manifest.json");
const MODEL = "https://fal.run/fal-ai/elevenlabs/tts/eleven-v3";

export const VOICE = "Charlie";

// ---- slot budgets, derived from the parsed grid ----
// Each budget is the distance to the next thing that must not be talked over.
const budgetsOf = (g) => ({
  open: g.answerAt / FPS, //     must clear before the first name: 5.00s
  count: g.tickAt[0] / FPS, //   before the slot's first tick: 2.50s (= GRID_7,
  //                             the reuse precondition — see header)
  answer: (g.step - g.answerAt) / FPS, // 2.00s, = GRID_7, ditto
  turn: g.tickAt[0] / FPS, //    slot 10 still runs the tick bed: 2.50s
  omission: (g.last - g.answerAt) / FPS, // to the follow card: 3.00s
  follow: FOLLOW_CARD / FPS, //  2.00s — a card
  cta: g.cta / FPS, //           3.00s — likewise
});

// The keys that come from the ladder-long cache. Their text below MUST match
// promo/ladderlong-vo.mjs verbatim — the copy IS the cache key, and a reused
// line whose text drifted is a different line wearing a stolen take.
export const REUSED = new Set(["n2", "n3", "n4", "n5", "n6", "n7", "n8", "n9", "follow", "cta2"]);

export const SHARED = [
  // `openc` is slot 1's count-in, same law as the ladder's open: no intro
  // card, ever, so the premise, the size and the scoreboard seed share one
  // breath. The clubs are NOT spoken — two plates say them in 46pt at frame 0,
  // and the voice spends its beat on what the card doesn't carry (batch 2's
  // rule).
  //
  // The first take proved batch 2.5's punctuation model AGAIN, from the other
  // side: "Ten slots. Everyone here played for both. Keep count." — three
  // sentence boundaries — came back 5.52s against the 5.00s window, right on
  // the ~0.93s/boundary + ~0.16s/word line (predicts 5.2). The cut is a
  // BOUNDARY, not words: the middle full stop becomes a comma and the clause
  // survives whole. Two boundaries priced ~3.4s; measured 3.52s. The screen
  // already carries the premise twice (the plates, WE NAME 9), so the comma
  // costs nothing a viewer can hear.
  { key: "openc", slot: "open", text: "Ten slots, everyone played for both. Keep count." },

  // the count-ins, n2…n9 — ladder-long's takes, verbatim (REUSED)
  { key: "n2", slot: "count", text: "Number two." },
  { key: "n3", slot: "count", text: "Number three." },
  { key: "n4", slot: "count", text: "Number four." },
  { key: "n5", slot: "count", text: "Halfway. Number five." },
  { key: "n6", slot: "count", text: "Number six." },
  { key: "n7", slot: "count", text: "Number seven." },
  { key: "n8", slot: "count", text: "Number eight." },
  { key: "n9", slot: "count", text: "Number nine. Last answer." },

  // slot 10's boundary — the hand-over. ONE sentence boundary on purpose
  // (~1.6s predicted against 2.50s): the beat under it is the riser, and the
  // demand stamps at +5.00s with the confession, so the line's whole job is
  // the possessive.
  { key: "turn", slot: "turn", text: "Slot ten is yours." },

  // the confession, where an answer would land. The ticket's line, verbatim —
  // said out loud because an empty box implies and a voice commits. One
  // boundary, seven words: ~2.1s predicted against 3.00s.
  { key: "omission", slot: "omission", text: "And we left out the obvious one." },

  // the follow hook and the closer — batch 2's takes, verbatim (REUSED)
  { key: "follow", slot: "follow", text: "New gauntlet daily." },
  { key: "cta2", slot: "cta", text: "Your score? And number ten?" },
];

// ---- the nine answer names per edition ----
// Spoken form, not the on-screen form (the rail stamps "MILNER", the voice
// says "James Milner."). Batch 1's paid-for law, fourth outing: a surname of
// three or more syllables goes alone, a one- or two-syllable surname is given
// its first name because Charlie draws a short lone word out. So Milner,
// Sturridge, Fowler, Touré, Hamann, James, Gallas, Leboeuf, Weah and
// Deschamps are named in full; Balotelli, Anelka, Bellamy, Aubameyang,
// Azpilicueta, Batshuayi, Makélélé and Diarra are not — except Diarra, who
// keeps his first name because the rail does too (LASSANA DIARRA: the surname
// alone is a different Real Madrid midfielder, and a stamp that needs a
// second guess is a bug). Hamann is spoken as the broadcast "Didi", the same
// register as "Mo Salah". Nine long, both arrays — slot 10 has no take, and
// the omission has no take, in either deck.
//
// One retake on record: "Frank Leboeuf." came back 2.88s on the first roll —
// not a syllable-count problem but Charlie chewing the French — and 1.20s on
// the second, same text. Stability 0.4 rolls that wide; a name-take that
// overruns is worth one re-roll before any copy surgery.
export const ANSWERS = {
  "liverpool-city": ["James Milner.", "Balotelli.", "Daniel Sturridge.", "Robbie Fowler.", "Kolo Touré.", "Anelka.", "Bellamy.", "Didi Hamann.", "David James."],
  "chelsea-marseille": ["Aubameyang.", "Azpilicueta.", "Batshuayi.", "Makélélé.", "William Gallas.", "Frank Leboeuf.", "Lassana Diarra.", "George Weah.", "Didier Deschamps."],
};

export const LINES = [
  ...SHARED,
  ...Object.entries(ANSWERS).flatMap(([slug, names]) =>
    names.map((text, i) => ({ key: `${slug}-a${i + 1}`, slot: "answer", text })),
  ),
];

// Which lines play — mirrors cuesFor() in src/promo/chainlong/vo.ts.
export const planLines = () => {
  const plan = new Map();
  const add = (key, slot, g) => {
    const e = plan.get(key) ?? { slot, grids: [] };
    e.grids.push(g);
    plan.set(key, e);
  };
  for (const ed of readEditions()) {
    const g = ed.grid;
    add("openc", "open", g);
    for (let n = 2; n <= 9; n++) add(`n${n}`, "count", g);
    for (let k = 1; k <= 9; k++) add(`${ed.slug}-a${k}`, "answer", g);
    add("turn", "turn", g);
    add("omission", "omission", g);
    add("follow", "follow", g);
    add("cta2", "cta", g);
  }
  return plan;
};

export const budgetFor = (plan, key) => {
  const e = plan.get(key);
  if (!e) return undefined;
  return Math.min(...e.grids.map((g) => budgetsOf(g)[e.slot]));
};

const key = () => process.env.FAL_KEY || process.env.FAL_API_KEY || "";

const wordsFrom = (timestamps) => {
  const chars = [];
  for (const seg of timestamps ?? []) {
    const c = seg.characters ?? [];
    for (let i = 0; i < c.length; i++) {
      chars.push({ ch: c[i], t0: seg.character_start_times_seconds[i], t1: seg.character_end_times_seconds[i] });
    }
  }
  const words = [];
  let cur = null;
  for (const c of chars) {
    if (/\s/.test(c.ch)) {
      if (cur) words.push(cur);
      cur = null;
      continue;
    }
    if (!cur) cur = { word: "", t0: c.t0, t1: c.t1 };
    cur.word += c.ch;
    cur.t1 = c.t1;
  }
  if (cur) words.push(cur);
  return words;
};

const generate = async (line) => {
  const k = key();
  if (!k) throw new Error(`VO cache miss for "${line.key}" and no FAL_KEY set — cannot generate.`);
  const res = await fetch(MODEL, {
    method: "POST",
    headers: { Authorization: `Key ${k}`, "Content-Type": "application/json" },
    body: JSON.stringify({ text: line.text, voice: VOICE, stability: 0.4, timestamps: true }),
  });
  if (!res.ok) throw new Error(`fal ${res.status} for "${line.key}": ${await res.text()}`);
  const json = await res.json();
  const audio = await fetch(json.audio.url);
  if (!audio.ok) throw new Error(`audio download ${audio.status} for "${line.key}"`);
  const bytes = Buffer.from(await audio.arrayBuffer());
  mkdirSync(CACHE, { recursive: true });
  writeFileSync(path.join(CACHE, `${line.key}.mp3`), bytes);
  const words = wordsFrom(json.timestamps);
  const dur = words.length > 0 ? words[words.length - 1].t1 : 0;
  return { key: line.key, slot: line.slot, text: line.text, dur, words };
};

// A reused line is copied out of the ladder-long cache: mp3 + measured
// duration + word timings, no network, no bill. STRICT — the take must exist,
// be the same voice, and carry the exact text this script expects; anything
// less falls through to generation rather than shipping a mismatched take.
const reuse = (line) => {
  if (!existsSync(LL_MANIFEST)) return null;
  const ll = JSON.parse(readFileSync(LL_MANIFEST, "utf8"));
  if (ll.voice !== VOICE) return null;
  const src = (ll.lines ?? []).find((l) => l.key === line.key);
  const mp3 = path.join(LL_CACHE, `${line.key}.mp3`);
  if (!src || src.text !== line.text || !existsSync(mp3)) return null;
  mkdirSync(CACHE, { recursive: true });
  copyFileSync(mp3, path.join(CACHE, `${line.key}.mp3`));
  return { key: line.key, slot: line.slot, text: line.text, dur: src.dur, words: src.words };
};

export const checkFit = (manifest) => {
  const plan = planLines();
  const over = [];
  for (const l of manifest.lines) {
    const budget = budgetFor(plan, l.key);
    if (budget && l.dur > budget) over.push({ ...l, budget, overBy: l.dur - budget });
  }
  return over;
};

export const checkCoverage = () => {
  const plan = planLines();
  const scripted = new Set(LINES.map((l) => l.key));
  const scheduled = new Set(plan.keys());
  const unscheduled = [...scripted].filter((k) => !scheduled.has(k));
  const unscripted = [...scheduled].filter((k) => !scripted.has(k));
  if (unscheduled.length > 0 || unscripted.length > 0) {
    throw new Error(
      `chainlong-vo: script/timeline mismatch.\n` +
        (unscheduled.length ? `  scripted but never played: ${unscheduled.join(", ")}\n` : "") +
        (unscripted.length ? `  played but never scripted: ${unscripted.join(", ")}\n` : "") +
        `  Every edition in timeline.ts needs nine ANSWERS entries under its slug.`,
    );
  }
  return plan;
};

let warned = false;

const missingWarning = (missing) => {
  if (warned) return;
  warned = true;
  const w = (t) => console.warn("  #  " + t.padEnd(66) + "#");
  console.warn("\n  " + "#".repeat(70));
  w(`chain-long: ${missing.length} VO LINE(S) MISSING — this render is a PROOF.`);
  w("");
  w("The rail, the cadence and the SFX are real. The lines below are");
  w("SILENT. DO NOT POST a proof — the format's pacing IS the voice.");
  w("");
  for (const chunk of missing.reduce((a, k, i) => {
    if (i % 4 === 0) a.push([]);
    a[a.length - 1].push(k);
    return a;
  }, [])) {
    w("    " + chunk.join("  "));
  }
  w("");
  w("Generate them (reused ladder-long lines are copied, never billed):");
  w("");
  w("    FAL_KEY=… node promo/chainlong-vo.mjs");
  w("    npm run promo -- chain-long-<edition>");
  console.warn("  " + "#".repeat(70) + "\n");
};

export const ensureChainLongVo = async ({ force = false, soft = false } = {}) => {
  checkCoverage();

  const have = existsSync(MANIFEST) && !force ? JSON.parse(readFileSync(MANIFEST, "utf8")) : { voice: VOICE, lines: [] };
  const byKey = new Map((have.lines ?? []).map((l) => [l.key, l]));
  const stale = have.voice !== VOICE;

  const haveKey = Boolean(process.env.FAL_KEY || process.env.FAL_API_KEY);
  const out = [];
  const missing = [];
  let reused = 0;
  for (const line of LINES) {
    const cached = byKey.get(line.key);
    const fresh = cached && !stale && !force && cached.text === line.text && existsSync(path.join(CACHE, `${line.key}.mp3`));
    if (fresh) {
      out.push({ ...cached, slot: line.slot });
      continue;
    }
    if (REUSED.has(line.key)) {
      const r = reuse(line);
      if (r) {
        process.stdout.write(`  vo: ${line.key}… reused from ladder-long (not billed)\n`);
        reused++;
        out.push(r);
        continue;
      }
      // fall through: the ladder-long cache no longer carries this take
    }
    if (soft && !haveKey) {
      missing.push(line.key);
      continue;
    }
    process.stdout.write(`  vo: ${line.key}…`);
    out.push(await generate(line));
    console.log(" ok");
  }
  if (missing.length > 0) missingWarning(missing);
  if (reused > 0) console.log(`  (${reused} carrier line(s) copied from vo-cache-ladderlong)`);

  const manifest = { voice: VOICE, lines: out };
  mkdirSync(CACHE, { recursive: true });
  writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2));

  const over = checkFit(manifest);
  if (over.length > 0) {
    for (const o of over) {
      console.error(`  OVERRUN ${o.key}: ${o.dur.toFixed(2)}s in a ${o.budget.toFixed(2)}s slot (+${o.overBy.toFixed(2)}s) — "${o.text}"`);
    }
    throw new Error(`${over.length} VO line(s) overrun their slot. Shorten the line; do not stretch the grid.`);
  }

  // mirror cache → public (public/promo is gitignored + regenerated)
  mkdirSync(PUB, { recursive: true });
  const live = new Set(out.map((l) => `${l.key}.mp3`));
  for (const f of readdirSync(CACHE)) {
    if (f.endsWith(".mp3") && live.has(f)) copyFileSync(path.join(CACHE, f), path.join(PUB, f));
  }
  for (const f of readdirSync(PUB)) {
    if (f.endsWith(".mp3") && !live.has(f)) unlinkSync(path.join(PUB, f));
  }
  writeFileSync(path.join(dir, "..", "src", "promo", "chainlong", "vo.json"), JSON.stringify(manifest, null, 2));
  return manifest;
};

if (process.argv[1] && process.argv[1].endsWith("chainlong-vo.mjs")) {
  if (process.argv.includes("--plan")) {
    const plan = checkCoverage();
    console.log(`voice=${VOICE}  ${LINES.length} lines across ${readEditions().length} editions`);
    console.log(`${[...REUSED].length} reused from ladder-long, ${LINES.length - [...REUSED].length} billed if absent\n`);
    for (const l of LINES) {
      const tag = REUSED.has(l.key) ? "reuse" : "bill ";
      console.log(`  ${tag}  ${l.key.padEnd(24)} ${l.slot.padEnd(9)} ${budgetFor(plan, l.key).toFixed(2)}s  "${l.text}"`);
    }
    process.exit(0);
  }
  const m = await ensureChainLongVo({ force: process.argv.includes("--force") });
  const plan = planLines();
  const total = m.lines.reduce((a, l) => a + l.dur, 0);
  console.log(`\nvoice=${m.voice}  ${m.lines.length} lines`);
  for (const l of m.lines) {
    const b = budgetFor(plan, l.key);
    console.log(`  ${l.key.padEnd(24)} ${l.dur.toFixed(2)}s / ${b ? b.toFixed(2) : "  - "}s  "${l.text}"`);
  }
  console.log(`${total.toFixed(2)}s of speech`);
}
