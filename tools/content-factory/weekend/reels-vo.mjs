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
for (const reel of ["settleit", "referee", "squad"]) {
  for (const cue of GRID[reel].cues) BUDGETS.set(cue.key, cue.budget);
}

// ---- the lines. One entry per grid cue; keys must match grid.json exactly.
export const LINES = [
  // R1 · SETTLE IT — Charlie is the neutral voice reading the receipts. The
  // personas live in the bubbles; the voice never takes a side (the reel must
  // not resolve).
  { key: "si-open", text: "Player of the weekend. The chat has thoughts." },
  { key: "si-recA", text: "Two goals. Three minutes. Nineteenth and twenty-first." },
  { key: "si-recB", text: "Also two. Away from home. Four nil." },
  { key: "si-dave", text: "Two penalties. Both from the monitor. Dave." },
  { key: "si-mess", text: "Forty messages. Still no referee." },
  { key: "si-exit", text: "Dave left. The argument didn't." },
  { key: "si-turn", text: "This exact argument. There's a scoreboard for it now. Every league, one weekend, one score." },
  // "Then settle it properly." was the cut (8.48s → the card already says
  // SETTLE IT in a pill; batch-2 rule — never voice what the screen carries).
  { key: "si-cta", text: "Paciência or Naujoks? Comments. Play free, no signup, verveq dot com." },

  // R2 · REFEREE — metronomic row reads at the standing 7.00s pace.
  { key: "rf-open", text: "Two performances. Same numbers. You're the referee." },
  { key: "rf-r1", text: "Goals. One each." },
  { key: "rf-r2", text: "Assists. Also one each." },
  { key: "rf-r3", text: "Benfica dropped points. Go Ahead won by three." },
  { key: "rf-r4", text: "Both against promoted sides." },
  { key: "rf-r5", text: "The Luz, behind closed doors. Deventer, opening day." },
  { key: "rf-r6", text: "The board says seven and a half. And five." },
  { key: "rf-q", text: "So who was better? I'm not deciding. That's the point." },
  // Mechanic shape, manifesto-verbatim register — never a sim-tunable number.
  { key: "rf-punch", text: "In THE WEEKEND, the crowd is the referee. The crowd rates the players. Not an algorithm." },
  { key: "rf-cta", text: "Prestianni or Meulensteen. One word. Then play free, no signup, verveq dot com." },

  // R3 · SQUAD — the board's arithmetic, spoken as it drains.
  // "Eight leagues." cut (5.92s in 5.50s): the frame-0 board reads
  // "13 SHIRTS · 91.0 · 8 LEAGUES" — the screen already says it.
  { key: "sq-open", text: "Thirteen shirts. Ninety-one to spend. Build." },
  { key: "sq-s1", text: "Lamine Yamal. Top of the board. Thirteen." },
  { key: "sq-s2", text: "Olise. Also thirteen. That's twenty-six on two shirts." },
  { key: "sq-s3", text: "Harry Kane. Twelve and a half." },
  { key: "sq-s4", text: "Mbappé. Twelve. And now we have a problem." },
  { key: "sq-math", text: "Nine shirts left. Forty and a half to spend. Four-fifty a shirt. Welcome to the bin." },
  { key: "sq-trade", text: "One of them goes. Drop Kane, and ten shirts get five-three each. Drop Mbappé? Say it out loud. Go on." },
  { key: "sq-gems", text: "And the bin scores. Brandt, four. Michut, four and a half. Ask PSV." },
  // "Comments." cut (6.00s in 5.50s): the card carries "WHO GOES? COMMENTS."
  // — a lone short word is a full boundary at Charlie's rate.
  { key: "sq-hold", text: "My thirteen stays with me. Who goes?" },
  { key: "sq-cta", text: "Build yours. Free, no signup, verveq dot com." },
];

// rough pre-spend estimate from the measured two-term model (README: fitting
// Charlie's carrier gave ~0.93s/sentence boundary + ~0.16s/word; an all-caps
// proper noun adds its own emphasis beat).
const estimate = (text) => {
  const words = text.split(/\s+/).length;
  const boundaries = (text.match(/[.!?—]+/g) ?? []).length;
  const caps = (text.match(/\b[A-Z]{2,}\b/g) ?? []).length;
  return words * 0.16 + boundaries * 0.93 + caps * 0.3;
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
