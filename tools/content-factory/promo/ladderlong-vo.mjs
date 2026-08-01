// "LADDER-LONG" voiceover — the second narrated piece in the library, and the
// first one where the VO is a PACING device rather than a narration.
//
// Same discipline as promo/semifinal-vo.mjs: generated ONCE against ElevenLabs
// v3 (via fal.ai) and committed to promo/vo-cache-ladderlong/. Renders copy from
// that cache into public/promo/vo-ll/ and never touch the network, so a fresh
// clone with no API key still renders all four editions byte-identically.
// Regenerating is a deliberate act: FAL_KEY=… node promo/ladderlong-vo.mjs --force
//
// TWO THINGS ARE DIFFERENT FROM THE SEMI-FINAL, BOTH ON PURPOSE:
//
// 1. THE GRID LEADS, NOT THE VOICE. The semi-final's timeline was built
//    backwards from the narrator's measured delivery. Here the grid is
//    authoritative (FACELESS_WINNER_SPEC #2 — the winners' per-question cadence
//    is machine-exact, 7.02s with <=8ms drift across six questions), so the
//    lines are written to FIT the slots. Generation verifies every measured
//    duration against its slot and throws if one overruns — a line that runs
//    long talks over the next beat, which is the one thing this format cannot
//    absorb. If a line doesn't fit, shorten the LINE, never stretch the grid.
//
// 2. THE CARRIER IS SHARED ACROSS ALL FOUR EDITIONS. FACELESS_WINNER_SPEC #13:
//    the winners' VO is machine-assembled — 11.75s of gugum's audio is
//    bit-identical between two episodes, 22% of the track verbatim, a fixed
//    carrier read with only the answer names swapped. So `open`, `n2`…`n10`,
//    `withhold` and `cta` are generated once and reused by every edition; only
//    the nine answer names differ. 12 shared lines + 4×9 answers = 48 lines for
//    four videos instead of 4×21 = 84, and the batch sounds like one series
//    because it literally is one take.
//
// VOICE: "Charlie" — owner-picked to match the register FACELESS_WINNER_SPEC
// measured in the winners: brisk quiz-host that counts you in (gugum runs
// 3.40–3.61 syllable onsets/sec), NOT the semi-final's gravitas. `Daniel`
// measured 2.39 words/sec across the semi-final and is deliberately not used
// here — that register would blow every slot below.
import { writeFileSync, mkdirSync, existsSync, readFileSync, copyFileSync, readdirSync, unlinkSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const CACHE = path.join(dir, "vo-cache-ladderlong");
const PUB = path.join(dir, "..", "public", "promo", "vo-ll");
const MANIFEST = path.join(CACHE, "manifest.json");
const MODEL = "https://fal.run/fal-ai/elevenlabs/tts/eleven-v3";

export const VOICE = "Charlie";

// ---- slot budgets (seconds). MUST mirror src/promo/ladderlong/timeline.ts. ----
// An answered rung is 210f/7.00s; rung 10 is 300f/10.00s.
const FPS = 30;
// Each budget is the distance to the next thing that must not be talked over,
// which is NOT the same boundary for every slot:
const BUDGET = {
  open: 150 / FPS, // 5.00s — rung 1's setup may run through the guess window;
  //                          it only has to clear before the first answer lands.
  count: 75 / FPS, // 2.50s — a count-in must clear before that rung's first
  //                          tick, so the 3-2-1 is heard in the clear.
  answer: 60 / FPS, // 2.00s — ANSWER_AT 150f to rung end 210f
  withhold: 150 / FPS, // 5.00s — WITHHELD_AT 150f to rung-10 end 300f
  cta: 90 / FPS, //     3.00s — the closing card
};

// ---- the shared carrier, generated once and reused by all four editions ----
// Read aloud these are ~2.3s, ~0.9s and ~3.6s: written to the slots above, not
// to taste. "Ten" is stated in `open` because FACELESS_WINNER_SPEC #9 says
// frame 0 must state the SIZE of the game — the rail shows it, the voice says
// it, and a viewer who is only listening still gets the contract.
export const SHARED = [
  // `open` IS rung 1's count-in — there is no separate "Number one", because
  // there is no intro card to say it over (spec #8: no intro beat, ever).
  { key: "open", slot: "open", text: "Ten career paths. They get harder. How far do you get?" },
  { key: "n2", slot: "count", text: "Number two." },
  { key: "n3", slot: "count", text: "Number three." },
  { key: "n4", slot: "count", text: "Number four." },
  { key: "n5", slot: "count", text: "Halfway. Number five." },
  { key: "n6", slot: "count", text: "Number six." },
  { key: "n7", slot: "count", text: "Number seven." },
  { key: "n8", slot: "count", text: "Number eight." },
  { key: "n9", slot: "count", text: "Number nine. Last answer." },
  // "The impossible one" measured 2.56s against a 2.50s slot, and the tier pill
  // on screen already says IMPOSSIBLE — so the voice spends its beat on stakes
  // instead of repeating the card.
  { key: "n10", slot: "count", text: "Number ten. Good luck." },
  // The brief requires the withholding to be said OUT LOUD, not just implied by
  // an empty slot. FACELESS_WINNER_SPEC #23: one comment ask, near the end,
  // answerable in one word.
  { key: "withhold", slot: "withhold", text: "This one I'm not telling you. Comments, or nowhere." },
  { key: "cta", slot: "cta", text: "So how far did you actually get?" },
];

// ---- the nine answer names per edition ----
// Spoken form, which is NOT the on-screen form: the card stamps "SALAH" and the
// voice says "Mo Salah". Display strings live in timeline.ts; these are the only
// place the spoken words exist.
export const ANSWERS = {
  // "Gerrard." alone came back at 2.32s in a 2.00s slot — Charlie draws a lone
  // surname out. Full name reads faster and matches the rest of this edition.
  "all-timers": ["Pelé.", "Steven Gerrard.", "Piqué.", "Toni Kroos.", "Marcelo.", "Shevchenko.", "Mo Salah.", "Pirlo.", "Pavel Nedvěd."],
  "premier-league": ["Declan Rice.", "Trent Alexander-Arnold.", "Courtois.", "Son.", "Frank Lampard.", "Kanté.", "De Bruyne.", "Vidić.", "Emile Heskey."],
  modern: ["Wirtz.", "Lautaro.", "Julián Álvarez.", "Hakimi.", "Dembélé.", "Luis Díaz.", "Bruno Fernandes.", "Isak.", "Sadio Mané."],
  journeymen: ["Busquets.", "Thomas Müller.", "Schweinsteiger.", "Varane.", "Dybala.", "Griezmann.", "David Silva.", "Harry Kane.", "Vertonghen."],
};

export const LINES = [
  ...SHARED,
  ...Object.entries(ANSWERS).flatMap(([slug, names]) =>
    names.map((text, i) => ({ key: `${slug}-a${i + 1}`, slot: "answer", text })),
  ),
];

const key = () => process.env.FAL_KEY || process.env.FAL_API_KEY || "";

// character timestamps → word timings, so on-screen words can key off speech
// instead of a guessed cadence (same helper as the semi-final).
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
    // stability 0.4: a touch steadier than the semi-final's 0.35. This voice is
    // saying "Number seven." forty times across a batch; the expressive end
    // invents a new inflection each time and the series stops sounding templated,
    // which is the one property the winners all share.
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

// Every line must fit the frame slot it plays into. This is the check that
// replaces the semi-final's "read the printed durations and re-quantise the
// timeline" step — here the timeline does not move, so the copy has to give.
export const checkFit = (manifest) => {
  const over = [];
  for (const l of manifest.lines) {
    const budget = BUDGET[l.slot];
    if (budget && l.dur > budget) over.push({ ...l, budget, overBy: l.dur - budget });
  }
  return over;
};

let warned = false;

// `soft` lets a batch render WITHOUT a voice track when no key and no cache are
// available, so the visual grid can still be proofed. It is deliberately loud:
// shipping a silent cut believing it is narrated is the one mistake this format
// cannot survive, so the warning names the exact command that fixes it.
export const ensureLadderLongVo = async ({ force = false, soft = false } = {}) => {
  if (soft && !existsSync(MANIFEST) && !(process.env.FAL_KEY || process.env.FAL_API_KEY)) {
    if (!warned) {
      warned = true;
      console.warn(
        "\n  ####################################################################\n" +
          "  #  ladder-long: NO VOICEOVER. No FAL_KEY and no cached take, so    #\n" +
          "  #  these renders will be SILENT except for the SFX bed.            #\n" +
          "  #  DO NOT POST THEM as-is — the format's pacing is the voice.      #\n" +
          "  #                                                                  #\n" +
          "  #    FAL_KEY=… node promo/ladderlong-vo.mjs                        #\n" +
          "  #    npm run promo -- ladder-long-all-timers  (…and the other 3)   #\n" +
          "  ####################################################################\n",
      );
    }
    return null;
  }
  const have = existsSync(MANIFEST) && !force ? JSON.parse(readFileSync(MANIFEST, "utf8")) : { voice: VOICE, lines: [] };
  const byKey = new Map((have.lines ?? []).map((l) => [l.key, l]));
  const stale = have.voice !== VOICE;

  const out = [];
  for (const line of LINES) {
    const cached = byKey.get(line.key);
    const fresh = cached && !stale && !force && cached.text === line.text && existsSync(path.join(CACHE, `${line.key}.mp3`));
    if (fresh) {
      out.push({ ...cached, slot: line.slot });
      continue;
    }
    process.stdout.write(`  vo: ${line.key}…`);
    out.push(await generate(line));
    console.log(" ok");
  }

  const manifest = { voice: VOICE, lines: out };
  mkdirSync(CACHE, { recursive: true });
  writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2));

  // A line that overruns its slot would talk over the next beat — that is the
  // one failure this format cannot absorb, so it is fatal, not a warning.
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
  writeFileSync(path.join(dir, "..", "src", "promo", "ladderlong", "vo.json"), JSON.stringify(manifest, null, 2));
  return manifest;
};

if (process.argv[1] && process.argv[1].endsWith("ladderlong-vo.mjs")) {
  const m = await ensureLadderLongVo({ force: process.argv.includes("--force") });
  const shared = m.lines.filter((l) => l.slot !== "answer");
  const total = m.lines.reduce((a, l) => a + l.dur, 0);
  const words = m.lines.reduce((a, l) => a + l.text.split(/\s+/).length, 0);
  console.log(`\nvoice=${m.voice}  ${m.lines.length} lines (${shared.length} shared carrier + ${m.lines.length - shared.length} answers)`);
  console.log(`${total.toFixed(2)}s of speech, ${words} words -> ${(words / total).toFixed(2)} words/sec measured`);
  for (const l of m.lines) {
    const b = BUDGET[l.slot];
    console.log(`  ${l.key.padEnd(20)} ${l.dur.toFixed(2)}s / ${b ? b.toFixed(2) : "  - "}s  "${l.text}"`);
  }
}
