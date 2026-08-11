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
import { FPS, FOLLOW_CARD, GRIDS, readEditions } from "./ladderlong-grid.mjs";

const dir = path.dirname(fileURLToPath(import.meta.url));
const CACHE = path.join(dir, "vo-cache-ladderlong");
const PUB = path.join(dir, "..", "public", "promo", "vo-ll");
const MANIFEST = path.join(CACHE, "manifest.json");
const MODEL = "https://fal.run/fal-ai/elevenlabs/tts/eleven-v3";

export const VOICE = "Charlie";

// ---- slot budgets, DERIVED from the grid rather than mirrored ----
// Batch 2 runs two cadences, so there is no longer one budget per slot: the
// same carrier line has to survive whichever paces schedule it. Each budget is
// the distance to the next thing that must not be talked over, and that
// boundary is a different frame in each grid:
const budgetsOf = (g) => ({
  open: g.answerAt / FPS, //     rung 1's setup may run through the guess window;
  //                             it only has to clear before the first answer.
  //                             7.00s: 5.00s   5.50s: 3.50s
  count: g.tickAt[0] / FPS, //   a count-in must clear before that rung's first
  //                             tick, so the 3-2-1 is heard in the clear.
  //                             7.00s: 2.50s   5.50s: 2.00s
  answer: (g.step - g.answerAt) / FPS, // 2.00s at BOTH paces, by construction —
  //                             the fast grid takes its time out of the guess
  //                             window, never out of the answer.
  withhold: (g.last - g.answerAt) / FPS, // 5.00s at both paces, likewise.
  follow: FOLLOW_CARD / FPS, //  2.00s — a card, so pace-independent.
  cta: g.cta / FPS, //           3.00s — likewise.
});

// Which lines play at which paces. Mirrors cuesFor() in
// src/promo/ladderlong/vo.ts — if these two ever disagree, the cue-frame check
// in the render verification catches it, because a key that is budgeted here
// but never scheduled there simply never plays.
//
// A line's real budget is the TIGHTEST of the grids that schedule it: `open2`
// is spoken by both arms, so it has to fit the 5.50s arm's 3.50s window even
// though the 7.00s arm would give it 5.00s.
export const planLines = () => {
  const plan = new Map(); // key -> { slot, grids: Grid[] }
  const add = (key, slot, g) => {
    const e = plan.get(key) ?? { slot, grids: [] };
    e.grids.push(g);
    plan.set(key, e);
  };
  for (const ed of readEditions()) {
    const g = ed.grid;
    const b2 = ed.batch === 2;
    const fast = g.step < GRIDS.GRID_7.step;
    const wknd = ed.campaign === "weekend";
    // `five-leagues` states the mode's own pitch as the quiz's premise, so it is
    // the one edition with its own open. `one-squad` keeps `open2` — the deck
    // makes that argument by casting, and does not need the voice to say it.
    add(ed.slug === "five-leagues" ? "open3" : b2 ? "open2" : "open", "open", g);
    for (let n = 2; n <= 10; n++) add(n === 5 && fast ? "n5f" : `n${n}`, "count", g);
    for (let k = 1; k <= 9; k++) add(`${ed.slug}-a${k}`, "answer", g);
    add("withhold", "withhold", g);
    if (b2) add("follow", "follow", g);
    add(wknd ? "cta3" : b2 ? "cta2" : "cta", "cta", g);
  }
  return plan;
};

// budget for one key = min over every grid that schedules it
export const budgetFor = (plan, key) => {
  const e = plan.get(key);
  if (!e) return undefined;
  return Math.min(...e.grids.map((g) => budgetsOf(g)[e.slot]));
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

  // ---- BATCH 2 (2026-08-05) ----
  // Four lines, and every one of them exists because batch 1 left a comment on
  // the table. Batch 1's only ask arrived at 68s, so the only people who could
  // answer it were the ones who had already watched 68 seconds. These make the
  // piece askable from the start and give a reason to come back.

  // `open2` replaces `open` for batch 2, seeding the scoreboard instead of
  // echoing the on-screen header. This line is spoken by BOTH arms, so it has to
  // clear the 5.50s arm's first answer at 3.50s — a full 1.50s tighter than the
  // window batch 1's `open` was written to.
  //
  // "Ten career paths. They get harder. Keep score." measured 3.76s against that
  // 3.50s slot. The clause that went is the one the screen already carries twice:
  // the header reads "10 CAREER PATHS. THEY GET WORSE." in 88pt at frame 0, and
  // the tier pill escalates EASY->IMPOSSIBLE in front of you. Same call as batch
  // 1's `n10` — the voice spends its beat on the thing that is NOT on the card,
  // and here that is the score. 3.76s -> comfortably inside 3.50s.
  { key: "open2", slot: "open", text: "Ten career paths. Keep score." },

  // The one carrier line the fast grid cannot hold. "Halfway. Number five."
  // measured 2.24s against the 5.50s arm's 2.00s count-in budget, so the fast
  // arm says this instead — the halfway marker is the retention beat and is
  // worth keeping; "Number" is the part that can go.
  { key: "n5f", slot: "count", text: "Halfway. Five." },

  // The follow hook, and it is deliberately a CONTENT promise. "Follow us" is a
  // brand ask and gets brand-ask numbers; the only thing a viewer who just
  // played one of these wants is another one, so the line offers exactly that
  // and nothing else. Lands on its own card, before the comment ask, so the two
  // asks never compete for the same breath.
  { key: "follow", slot: "follow", text: "New gauntlet daily." },

  // `cta2` replaces `cta` for batch 2: it asks for the SCORE first and the name
  // second. That order is the point — the score is answerable by everyone who
  // watched any of it, the name only by the ones who lasted, and the cheap ask
  // going first is what turns a scroll-away into a comment.
  //
  // "Your score out of nine? And number ten?" measured 3.20s in a 3.00s slot.
  // "out of nine" was the cut, for the same reason as `open2`: the card is
  // showing "? / 9" in 168pt lime while this is spoken. Both asks survive intact.
  { key: "cta2", slot: "cta", text: "Your score? And number ten?" },

  // ---- BATCH 2.5 (2026-08-05) — the two WEEKEND-cast editions ----
  // Two lines, and they are the whole copy delta. Everything else in the
  // carrier is batch 2's, unchanged and un-rebilled.

  // `open3` — `five-leagues` only, and it is THE WEEKEND's own pitch used as the
  // quiz's premise. The campaign's stinger opens on "FIVE LEAGUES." and the
  // mode's one-line description is "five leagues, one squad"; saying it over ten
  // career paths makes the quiz an argument for the mode instead of an advert
  // bolted to the end of one. `one-squad` deliberately does NOT get this — its
  // deck makes the same case by casting, and two editions opening on the same
  // slogan would read as a template.
  //
  // Budget is the 7.00s arm's 5.00s (both campaign editions run the control
  // grid), so this line has 1.50s more room than `open2` had to live inside.
  { key: "open3", slot: "open", text: "Ten career paths. Five leagues. One squad." },

  // `cta3` — the closer for both campaign editions. The comment asks do NOT
  // leave: they stay on the card in 168pt and 86pt exactly as batch 2 shipped
  // them, and the captions still lead with the score. What changes is what the
  // VOICE spends its last three seconds on, because the card cannot say this
  // and the caption is read after the fact.
  //
  // The predicted overrun happened, and it was NOT a word-count problem —
  // which is the part worth keeping. "Draft them for real. THE WEEKEND — link
  // in bio." came back at 4.72s against a 3.00s slot: +1.72s, where the word
  // count alone predicts ~3.5s. Fitting a two-term model to this voice's
  // measured carrier (`cta` 7w/1 sentence 2.08s, `follow` 3w/1 2.08→1.68s,
  // `open2` and `cta2` both 5w/2 at 2.64/2.72s) gives ~0.93s per SENTENCE
  // BOUNDARY and only ~0.16s per word. The extra ~1.2s is the em dash and the
  // capitalised "THE WEEKEND" — Charlie reads a dash as a full stop and gives
  // an all-caps proper noun its own emphasis beat.
  //
  // So the cut was batch 2's rule (cut whatever the screen is already saying —
  // the card carries the wordmark in 96pt lime while this plays) and the
  // punctuation lesson on top: PUNCTUATION IS THE EXPENSIVE PART OF A SLOT, NOT
  // LENGTH. Prose in this carrier should reach for the fewest sentence
  // boundaries, not the fewest words.
  //
  //     4.72s  "Draft them for real. THE WEEKEND — link in bio."  10w, 3 breaks
  //     2.72s  "Draft them for real. Link in bio."                 7w, 2 breaks
  //
  // The re-take CONFIRMS the model rather than just clearing the slot: 2.72s is
  // the exact duration of `cta2` ("Your score? And number ten?"), which is two
  // words SHORTER at the same two sentence boundaries. Dropping three words and
  // one boundary bought 2.00s; the words were worth ~0.5s of it.
  //
  // Both halves of the ask survive — the instruction and the pointer — and the
  // wordmark is on screen either way.
  { key: "cta3", slot: "cta", text: "Draft them for real. Link in bio." },
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

  // ---- batch 2 ----
  // Same rule as batch 1, plus the lesson batch 1 paid for: Charlie draws a
  // LONE SHORT SURNAME out ("Gerrard." came back at 2.32s in a 2.00s slot,
  // where "Steven Gerrard." reads in 1.36s). So the one- and two-syllable
  // surnames below are given their first name and the long ones are not.
  // Rung 10's name is never generated in any edition — these arrays are nine
  // long, and that is the withhold enforced in the only place the spoken words
  // exist.
  "number-ones": ["Manuel Neuer.", "Casillas.", "Donnarumma.", "De Gea.", "Hugo Lloris.", "Petr Čech.", "Van der Sar.", "Ederson.", "Fabien Barthez."],
  "hard-way-up": ["Cole Palmer.", "Cody Gakpo.", "Rafael Leão.", "John Stones.", "Maguire.", "Mahrez.", "Osimhen.", "Jorginho.", "Gyökeres."],
  "old-guard": ["Van Basten.", "Xavi.", "Nesta.", "Lilian Thuram.", "Emmanuel Petit.", "Miroslav Klose.", "Gattuso.", "Desailly.", "Roberto Baggio."],
  "grand-tour": ["Vinícius.", "Rúben Dias.", "Tchouaméni.", "De Ligt.", "David Alaba.", "Kovačić.", "Çalhanoğlu.", "Xabi Alonso.", "Robert Pirès."],

  // ---- batch 2.5 ----
  // Same law, third time: a surname of three or more syllables goes alone, a
  // one- or two-syllable surname is given its first name because Charlie draws
  // a short lone word out ("Gerrard." 2.32s vs "Steven Gerrard." 1.36s). So
  // Kimmich, Davies, Maignan, Højlund, Gnabry and Olise are named in full, and
  // Carvajal, Pulisic, Alisson, Vitinha, Vlahović, Raphinha, Rodrygo, Bastoni
  // are not. Nine long, both of them — rung 10 has no take, in either deck.
  "five-leagues": ["Carvajal.", "Joshua Kimmich.", "Pulisic.", "Alisson.", "Vitinha.", "Vlahović.", "Michael Olise.", "Raphinha.", "Andrew Robertson."],
  "one-squad": ["Rodrygo.", "Alphonso Davies.", "Mike Maignan.", "Federico Valverde.", "Bastoni.", "Frenkie de Jong.", "Bruno Guimarães.", "Rasmus Højlund.", "Serge Gnabry."],

  // ---- THE DUGOUT (2026-08-11) ----
  // Same law, fourth time: Kompany and Sylvinho carry three syllables and go
  // alone; every other surname here is one or two ("Gerrard." 2.32s vs
  // "Steven Gerrard." 1.36s) and takes its first name — Sagnol, Coleman,
  // Bilić, Bruce, de Boer (the Frenkie de Jong precedent), Pearce, Tuchel.
  // Nine long — rung 10 has no take, and the tenth name is never spoken.
  dugout: ["Kompany.", "Willy Sagnol.", "Chris Coleman.", "Slaven Bilić.", "Sylvinho.", "Steve Bruce.", "Frank de Boer.", "Stuart Pearce.", "Thomas Tuchel."],
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
  const plan = planLines();
  const over = [];
  for (const l of manifest.lines) {
    const budget = budgetFor(plan, l.key);
    if (budget && l.dur > budget) over.push({ ...l, budget, overBy: l.dur - budget });
  }
  return over;
};

// The scripted lines and the editions table have to describe the same batch.
// Either direction of drift is silent and expensive: a line nothing schedules
// is a credit spent on audio that never plays, and a cue nothing scripts is a
// rung that goes out mute. Both are caught here, before generation.
export const checkCoverage = () => {
  const plan = planLines();
  const scripted = new Set(LINES.map((l) => l.key));
  const scheduled = new Set(plan.keys());
  const unscheduled = [...scripted].filter((k) => !scheduled.has(k));
  const unscripted = [...scheduled].filter((k) => !scripted.has(k));
  if (unscheduled.length > 0 || unscripted.length > 0) {
    throw new Error(
      `ladderlong-vo: script/timeline mismatch.\n` +
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
  w(`ladder-long: ${missing.length} VO LINE(S) MISSING — this render is a PROOF.`);
  w("");
  w("The visual grid, the cadence and the SFX are real. The lines below");
  w("are SILENT, and every rung that needed one plays with no voice.");
  w("DO NOT POST a proof — the format's pacing IS the voice.");
  w("");
  for (const chunk of missing.reduce((a, k, i) => {
    if (i % 4 === 0) a.push([]);
    a[a.length - 1].push(k);
    return a;
  }, [])) {
    w("    " + chunk.join("  "));
  }
  w("");
  w("Generate them (each line is cached forever after, and the 48");
  w("already-cached lines are NOT re-billed — the manifest keys on text):");
  w("");
  w("    FAL_KEY=… node promo/ladderlong-vo.mjs");
  w("    npm run promo -- ladder-long-<edition>");
  console.warn("  " + "#".repeat(70) + "\n");
};

// `soft` lets a batch render with whatever voice is cached, so the visual grid
// can be proofed before anyone spends a credit. It degrades PER LINE, not
// all-or-nothing: batch 2 shares eleven of batch 1's carrier lines, so a
// keyless clone can still hear the count-ins land against the new 5.50s grid
// even though the forty new lines have never been generated.
//
// It is deliberately loud either way. Shipping a proof believing it is narrated
// is the one mistake this format cannot survive, so the warning names every
// missing line and the exact command that fixes it.
export const ensureLadderLongVo = async ({ force = false, soft = false } = {}) => {
  // Cheap and fatal, and it runs BEFORE the first credit is spent.
  checkCoverage();

  const have = existsSync(MANIFEST) && !force ? JSON.parse(readFileSync(MANIFEST, "utf8")) : { voice: VOICE, lines: [] };
  const byKey = new Map((have.lines ?? []).map((l) => [l.key, l]));
  const stale = have.voice !== VOICE;

  const haveKey = Boolean(process.env.FAL_KEY || process.env.FAL_API_KEY);
  const out = [];
  const missing = [];
  for (const line of LINES) {
    const cached = byKey.get(line.key);
    const fresh = cached && !stale && !force && cached.text === line.text && existsSync(path.join(CACHE, `${line.key}.mp3`));
    if (fresh) {
      out.push({ ...cached, slot: line.slot });
      continue;
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

  const manifest = { voice: VOICE, lines: out };
  mkdirSync(CACHE, { recursive: true });
  writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2));

  // A line that overruns its slot would talk over the next beat — that is the
  // one failure this format cannot absorb, so it is fatal, not a warning.
  const over = checkFit(manifest);
  if (over.length > 0) {
    for (const o of over) {
      console.error(`  OVERRUN ${o.key}: ${o.dur.toFixed(2)}s in a ${o.budget.toFixed(2)}s slot (+${o.overBy.toFixed(2)}s) — "${o.text}"`);
      console.error(`           (tightest of the ${planLines().get(o.key).grids.map((g) => `${(g.step / FPS).toFixed(2)}s`).join(" + ")} arm(s) that speak it)`);
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
  // --plan prints the slot budget every line has to hit, WITHOUT generating
  // anything. That is the only way to see what the fast arm demands before
  // spending a credit on a line that will be rejected for overrunning it.
  if (process.argv.includes("--plan")) {
    const plan = checkCoverage();
    console.log(`voice=${VOICE}  ${LINES.length} lines across ${readEditions().length} editions\n`);
    for (const l of LINES) {
      const paces = plan.get(l.key).grids.map((g) => (g.step / FPS).toFixed(2)).sort();
      const uniq = [...new Set(paces)].join("+");
      console.log(`  ${l.key.padEnd(22)} ${l.slot.padEnd(9)} ${budgetFor(plan, l.key).toFixed(2)}s  [${uniq}]  "${l.text}"`);
    }
    process.exit(0);
  }
  const m = await ensureLadderLongVo({ force: process.argv.includes("--force") });
  const plan = planLines();
  const shared = m.lines.filter((l) => l.slot !== "answer");
  const total = m.lines.reduce((a, l) => a + l.dur, 0);
  const words = m.lines.reduce((a, l) => a + l.text.split(/\s+/).length, 0);
  console.log(`\nvoice=${m.voice}  ${m.lines.length} lines (${shared.length} shared carrier + ${m.lines.length - shared.length} answers)`);
  console.log(`${total.toFixed(2)}s of speech, ${words} words -> ${(words / total).toFixed(2)} words/sec measured`);
  for (const l of m.lines) {
    const b = budgetFor(plan, l.key);
    console.log(`  ${l.key.padEnd(22)} ${l.dur.toFixed(2)}s / ${b ? b.toFixed(2) : "  - "}s  "${l.text}"`);
  }
}
