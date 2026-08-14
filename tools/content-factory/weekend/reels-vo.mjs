// CF-WEEKEND reels voiceover — Charlie, stability 0.4, via fal.ai ElevenLabs
// v3. Same discipline as promo/ladderlong-vo.mjs: generated ONCE, cached in
// weekend/vo-cache-reels/, mirrored into public/promo/vo-wknd/, and every
// measured take is checked against its slot budget from
// src/weekend/reels/grid.json — an overrun THROWS. If a line doesn't fit,
// shorten the LINE, never stretch the grid.
//
// The copy law learned on cta3 applies everywhere here: PUNCTUATION IS THE
// EXPENSIVE PART OF A SLOT (~0.93s per sentence boundary vs ~0.16s per word
// for this voice). Lines below are written for the fewest boundaries that
// still land the beat.
//
//   node weekend/reels-vo.mjs --plan     # budgets vs estimates, spends nothing
//   FAL_KEY=… node weekend/reels-vo.mjs  # generate what's missing + fit-check
//   FAL_KEY=… node weekend/reels-vo.mjs --force   # re-voice everything
import { writeFileSync, mkdirSync, existsSync, readFileSync, copyFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const GRID = JSON.parse(readFileSync(path.join(dir, "..", "src", "weekend", "reels", "grid.json"), "utf8"));
const CACHE = path.join(dir, "vo-cache-reels");
const PUB = path.join(dir, "..", "public", "promo", "vo-wknd");
const MANIFEST = path.join(CACHE, "manifest.json");
const VO_TS = path.join(dir, "..", "src", "weekend", "reels", "vo.json");
const MODEL = "https://fal.run/fal-ai/elevenlabs/tts/eleven-v3";

export const VOICE = "Charlie";

// key → budget (seconds), straight from the grid — the single timing truth.
const BUDGETS = new Map();
// Every grid entry with cues is in scope (a new dilemma-v2 edition is a grid
// block + a facts row, nothing to edit here). Editions deliberately SHARE cue
// keys (dl-hold/dl-cta across all dilemmas, d2-q reused by the v2 smoke) —
// same text, one cached take, billed once. Where a shared key's budgets
// differ (the 13.4s v2 spine is tighter than the 20s v1), the MINIMUM wins:
// a take that fits the tightest slot fits them all, and the guard must fail
// before the spend, never after.
for (const reel of Object.values(GRID)) {
  if (!reel || typeof reel !== "object" || !Array.isArray(reel.cues)) continue;
  for (const cue of reel.cues) BUDGETS.set(cue.key, Math.min(cue.budget, BUDGETS.get(cue.key) ?? Infinity));
}

// CF-42H: the spoken hours number is LIVE — stamped by weekend/boost-live.mjs
// at render time. A changed hour changes the line text, which is exactly what
// invalidates the cached take (the cache is keyed on text).
const LIVE = JSON.parse(readFileSync(path.join(dir, "..", "src", "weekend", "reels", "boost-live.json"), "utf8"));

// ---- the lines. One entry per grid cue; keys must match grid.json exactly.
export const LINES = [
  // R1 · SETTLE IT — Charlie is the neutral voice reading the receipts. The
  // personas live in the bubbles; the voice never takes a side (the reel must
  // not resolve).
  // ", right now" cut (4.56s in 4.50s): JAMIE's frame-0 bubble already says it.
  { key: "si-open", text: "Best player on earth. The chat has thoughts." },
  { key: "si-recA", text: "Mbappé. The board says twelve." },
  { key: "si-recB", text: "Yamal. Thirteen. Top of the board, at nineteen." },
  { key: "si-dave", text: "Dembélé won the Ballon d'Or. Last season, Dave." },
  { key: "si-mess", text: "Forty messages. Still no answer." },
  { key: "si-exit", text: "Dave left. The argument didn't." },
  { key: "si-turn", text: "This exact argument. There's a scoreboard for it now. Every league, one weekend, one score." },
  // "Then settle it properly." was the cut (8.48s → the card already says
  // SETTLE IT in a pill; batch-2 rule — never voice what the screen carries).
  { key: "si-cta", text: "Yamal or Mbappé? Comments. Play free, no signup, verveq dot com." },

  // R2 · REFEREE — metronomic row reads at the standing 7.00s pace.
  { key: "rf-open", text: "The board priced every superstar in Europe. You're the referee." },
  { key: "rf-r1", text: "Olise, thirteen. Mbappé, twelve." },
  { key: "rf-r2", text: "Kane, twelve and a half. Bellingham, eleven." },
  { key: "rf-r3", text: "Cherki, ten. Foden, nine and a half." },
  { key: "rf-r4", text: "Nico Paz, ten. Gyökeres, five and a half." },
  { key: "rf-r5", text: "Dembélé, eleven and a half. The Ballon d'Or holder." },
  { key: "rf-r6", text: "Lee Kang-in and Bruno. Ten and a half. Both." },
  { key: "rf-q", text: "Is the board right? I'm not deciding. That's the point." },
  // Mechanic shape, manifesto-verbatim register — never a sim-tunable number.
  { key: "rf-punch", text: "In THE WEEKEND, the crowd is the referee. The crowd rates the players. Not an algorithm." },
  { key: "rf-cta", text: "Worst price on the board? Comments. Then play free, no signup, verveq dot com." },

  // R3 · SQUAD — the board's arithmetic, spoken as it drains.
  // "Eight leagues." cut (5.92s in 5.50s): the frame-0 board reads
  // "13 SHIRTS · 91.0 · 8 LEAGUES" — the screen already says it.
  { key: "sq-open", text: "Four superstars. Ninety-one points. They don't all fit." },
  { key: "sq-s1", text: "Lamine Yamal. Top of the board. Thirteen." },
  { key: "sq-s2", text: "Olise. Also thirteen. That's twenty-six on two shirts." },
  { key: "sq-s3", text: "Harry Kane. Twelve and a half." },
  { key: "sq-s4", text: "Mbappé. Twelve. And now we have a problem." },
  { key: "sq-math", text: "Nine shirts left. Forty and a half to spend. Four-fifty a shirt. Welcome to the bin." },
  { key: "sq-trade", text: "One of them goes. Drop Kane, and ten shirts get five-three each. Drop Mbappé? Say it out loud. Go on." },
  { key: "sq-gems", text: "And down in the bin. Gyökeres, five and a half. Chiesa, five. Szczęsny, four." },
  // "Comments." cut (6.00s in 5.50s): the card carries "WHO GOES? COMMENTS."
  // — a lone short word is a full boundary at Charlie's rate.
  { key: "sq-hold", text: "My thirteen stays with me. Who goes?" },
  { key: "sq-cta", text: "Build yours. Free, no signup, verveq dot com." },

  // CF-42H · BOOST — conversion register: declarative, no withheld answer, no
  // comment ask. The hours number is live (boost-live.json); everything else
  // is board fact. bo-r1..r3 are the three rule hits — near-metronomic.
  { key: "bo-open", text: `You have ${LIVE.hoursWord} hours.` },
  { key: "bo-contra", text: "The big leagues are asleep. Good. The weekend kicks off anyway." },
  // CF-42H copy ruling (owner, 2026-08-13): cold traffic gets PLAIN words —
  // "players" not the lane's "shirts", and the 91 always carries its unit.
  { key: "bo-fill", text: "Thirteen players. Ninety-one budget. Watch the bar drain." },
  // "flat" cut: the re-take ran 7.04s in 5.80 (take variance, not word count)
  { key: "bo-squeeze", text: "Yamal, thirteen. Or three players at four and a half. Choose." },
  { key: "bo-r1", text: "Thirteen players." },
  { key: "bo-r2", text: "Ninety-one budget." },
  { key: "bo-r3", text: "Every player locks at his own kickoff." },
  { key: "bo-cta", text: "No signup. No app. verveq dot com, slash weekend." },

  // DILEMMA-B1 · THE DILEMMA — Charlie reads BOTH sides and takes neither. The
  // withhold is the format, so no line may contain a preference, a lean, or a
  // "but": each side gets the same shape (name, club, fixture, price) and the
  // closer states that there is no answer rather than hiding one. Every number
  // here is the prod board's, gated by weekend/dilemma-live.mjs.
  //
  // COMMA-FREE BY CONSTRUCTION. Draft 1 punctuated these as appositives
  // ("Febas, Celta, at home to Osasuna, the most expensive…") and 7 of 8 lines
  // came back over budget — that batch is what re-priced the comma in
  // `estimate` above. Rewritten to run on a single terminal boundary each and
  // carry the same facts as connected phrases. Nothing was dropped to fit
  // except detail the CARD already shows (the opponent on d1-b, the shared
  // position on d2-b) — the batch-2 rule: never voice what the screen carries.
  { key: "d1-q", text: "Nine and a half on one player or two?" },
  { key: "d1-a", text: "Febas of Celta is the most expensive player playing." },
  { key: "d1-b", text: "Or Dolberg and Berghuis for four and a half and five." },

  { key: "d2-q", text: "Two strikers at eight flat for one slot." },
  { key: "d2-a", text: "Aubameyang of Deportivo at home to Elche on Monday night." },
  { key: "d2-b", text: "Or Budimir of Osasuna away at Celta on Sunday." },

  // SHARED by both editions (one key = one take = billed once). The 3-2-1 is
  // voiced because this lane is paced by the voice, and the beats line up with
  // the composition's 36f numeral step.
  { key: "dl-hold", text: "Three. Two. One." },
  // The closing CARD carries "NO RIGHT ANSWER." at 104px, "PICK IN THE
  // COMMENTS." at 64px, the URL and "FREE, NO SIGNUP" — so the voice does not
  // repeat any of it and lands as the terse punch over the top. That is the
  // batch-2 rule taken to its end, and it is what finally fit: the same ask at
  // 16 words measured 6.40s in a 4.80s slot. "for real" then came out too: it
  // measured 4.80s and, after its one permitted re-roll, 4.96s — and the card
  // says OR PICK FOR REAL directly under the URL. The voice names the two
  // doors; the screen says what is behind them.
  { key: "dl-cta", text: "Comments or verveq dot com slash weekend." },
];

// rough pre-spend estimate from the measured model (README: fitting Charlie's
// carrier gave ~0.93s/sentence boundary + ~0.16s/word; an all-caps proper noun
// adds its own emphasis beat).
//
// DILEMMA-B1 amendment (2026-08-14): THE COMMA IS PRICED. The two-term model
// charged only [.!?—] and so under-predicted every comma-heavy line — the first
// dilemma batch estimated 8/8 inside budget and came back 7/8 OVER, the worst
// by +2.08s on a line carrying three commas. Charlie takes a near-full beat at
// a comma, so it is now charged at 0.9s, essentially a boundary. Measured
// against that batch the amended model over-predicts on 6 of 8 and lands within
// 0.1s on another — the safe direction for a guard whose whole job is to catch
// an overrun BEFORE the credit is spent.
//
// The corollary for copy: a spaced em-dash is the worst buy on the board. It is
// charged as a word (the split is on whitespace) AND as a boundary, ~1.09s for
// one pause. Prefer restructuring to a single terminal boundary over punctuating
// a long line.
const estimate = (text) => {
  const words = text.split(/\s+/).length;
  const boundaries = (text.match(/[.!?—]+/g) ?? []).length;
  const commas = (text.match(/,/g) ?? []).length;
  const caps = (text.match(/\b[A-Z]{2,}\b/g) ?? []).length;
  return words * 0.16 + boundaries * 0.93 + commas * 0.9 + caps * 0.3;
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
    // stability 0.4 — the reels are one series with the quiz lane; same voice,
    // same setting, so the account sounds like one show.
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
  return { key: line.key, text: line.text, dur, words };
};

const loadManifest = () =>
  existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, "utf8")) : { voice: VOICE, lines: [] };

const mirror = (manifest) => {
  mkdirSync(PUB, { recursive: true });
  for (const l of manifest.lines) {
    const src = path.join(CACHE, `${l.key}.mp3`);
    if (existsSync(src)) copyFileSync(src, path.join(PUB, `${l.key}.mp3`));
  }
  // the manifest the compositions import (checked in, like ladderlong's vo.json)
  writeFileSync(VO_TS, JSON.stringify(manifest, null, 1));
};

export const checkFit = (manifest) => {
  const over = [];
  for (const l of manifest.lines) {
    const budget = BUDGETS.get(l.key);
    if (budget && l.dur > budget) over.push({ ...l, budget, overBy: l.dur - budget });
  }
  return over;
};

const main = async () => {
  const plan = process.argv.includes("--plan");
  const force = process.argv.includes("--force");

  // coverage: every line must have a cue, every cue a line
  const scripted = new Set(LINES.map((l) => l.key));
  const scheduled = new Set(BUDGETS.keys());
  const unscheduled = [...scripted].filter((k) => !scheduled.has(k));
  const unscripted = [...scheduled].filter((k) => !scripted.has(k));
  if (unscheduled.length || unscripted.length) {
    throw new Error(
      `reels-vo: script/grid mismatch.\n` +
        (unscheduled.length ? `  scripted but never cued: ${unscheduled.join(", ")}\n` : "") +
        (unscripted.length ? `  cued but never scripted: ${unscripted.join(", ")}` : ""),
    );
  }

  if (plan) {
    console.log(`${"key".padEnd(10)} ${"budget".padStart(6)} ${"est".padStart(6)}  text`);
    for (const l of LINES) {
      const b = BUDGETS.get(l.key);
      const e = estimate(l.text);
      const flag = e > b ? "  ⚠ OVER-ESTIMATE" : "";
      console.log(`${l.key.padEnd(10)} ${b.toFixed(2).padStart(6)} ${e.toFixed(2).padStart(6)}  ${l.text}${flag}`);
    }
    return;
  }

  const manifest = loadManifest();
  const byKey = new Map(manifest.lines.map((l) => [l.key, l]));
  for (const line of LINES) {
    const cached = byKey.get(line.key);
    if (!force && cached && cached.text === line.text && existsSync(path.join(CACHE, `${line.key}.mp3`))) continue;
    console.log(`voicing ${line.key} …`);
    const entry = await generate(line);
    byKey.set(line.key, entry);
  }
  const out = { voice: VOICE, lines: LINES.map((l) => byKey.get(l.key)).filter(Boolean) };
  mkdirSync(CACHE, { recursive: true });
  writeFileSync(MANIFEST, JSON.stringify(out, null, 1));

  const over = checkFit(out);
  for (const l of out.lines) {
    const b = BUDGETS.get(l.key);
    console.log(`  ${l.key.padEnd(10)} ${l.dur.toFixed(2)}s / ${b.toFixed(2)}s  ${l.dur > b ? "OVER" : "ok"}`);
  }
  if (over.length > 0) {
    throw new Error(
      `reels-vo: ${over.length} line(s) overrun their slot — shorten the LINE:\n` +
        over.map((l) => `  ${l.key}: ${l.dur.toFixed(2)}s in ${l.budget.toFixed(2)}s (+${l.overBy.toFixed(2)}s) "${l.text}"`).join("\n"),
    );
  }
  mirror(out);
  console.log(`\n${out.lines.length} lines cached, mirrored to public/promo/vo-wknd/ + vo.json manifest.`);
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
