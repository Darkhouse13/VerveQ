// "LADDER-LONG" soundtrack — one WAV per edition.
//
// Why per-edition and not one shared track: the club slams land on each club as
// it arrives, and the four editions have different path lengths (2 to 7 clubs).
// A shared bed would drift off the visuals within one rung.
//
// Every other promo in this lane copies its grid constants into the audio
// script by hand with a "MUST match timeline.ts" comment. This one PARSES the
// timeline instead, so the club counts cannot drift from the casting — the
// grid constants below are still mirrored by hand (they are stable), but the
// per-rung shape is derived from the single source of truth and the script
// fails loudly if the parse stops matching.
//
// The arrangement carries the escalation the visuals promise: each solved rung
// resolves a step higher, the tick bed tightens as the tiers get harder, and
// rung 10 gets a riser that never resolves — no ding, because nothing on screen
// answers it either.
import { writeFileSync, mkdirSync, existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Mixer, encodeWav, kick, hat, impact, tick, ding, blip, riser, stinger, whoosh } from "./audio-lib.mjs";

const FPS = 30;
const dir = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(dir, "..", "public", "promo");
const TIMELINE = path.join(dir, "..", "src", "promo", "ladderlong", "timeline.ts");

// MUST match src/promo/ladderlong/timeline.ts
const STEP = 210;
const LAST = 300;
const CTA = 90;
const TOTAL = STEP * 9 + LAST + CTA; // 2280 = 76.0s
const CTA_AT = STEP * 9 + LAST;
const CLUB_IN = 8;
const CLUB_GAP = 10;
const THINK_AT = 70;
const TICK_AT = [75, 105, 135];
const ANSWER_AT = 150;
const WITHHELD_AT = 150;

// ---- derive each edition's per-rung club counts from timeline.ts ----
export const readEditions = () => {
  const src = readFileSync(TIMELINE, "utf8");
  const body = src.slice(src.indexOf("export const EDITIONS"));
  const editions = [];
  const slugRe = /slug:\s*"([a-z-]+)"/g;
  let m;
  const marks = [];
  while ((m = slugRe.exec(body)) !== null) marks.push({ slug: m[1], at: m.index });
  for (let k = 0; k < marks.length; k++) {
    const chunk = body.slice(marks[k].at, k + 1 < marks.length ? marks[k + 1].at : body.length);
    const counts = [];
    const rungRe = /\bclubs:\s*\[([^\]]*)\]/g;
    let r;
    while ((r = rungRe.exec(chunk)) !== null) {
      const n = (r[1].match(/"/g) ?? []).length / 2;
      counts.push(n);
    }
    editions.push({ slug: marks[k].slug, counts });
  }
  const bad = editions.filter((e) => e.counts.length !== 10 || e.counts.some((c) => c < 1 || c > 7));
  if (editions.length === 0 || bad.length > 0) {
    throw new Error(
      `ladderlong-audio: failed to parse timeline.ts (${editions.length} editions, ` +
        `${bad.map((b) => `${b.slug}:${b.counts.length}`).join(",")} malformed). ` +
        `The casting format changed — fix the parser, do not hand-copy the counts.`,
    );
  }
  return editions;
};

// nine resolutions, climbing
const SOLVE = [523, 554, 587, 622, 659, 698, 740, 784, 831];

const buildEdition = (slug, counts) => {
  const mix = new Mixer(`ladder-long-${slug}`, TOTAL, FPS);

  // heartbeat under the whole climb, tightening for the unanswered rung
  for (let f = 0; f < STEP * 9; f += 21) mix.add(kick(), f, 0.46);
  for (let f = STEP * 9; f < CTA_AT; f += 14) mix.add(kick(), f, 0.6);

  for (let i = 0; i < 10; i++) {
    const base = i * STEP;
    const last = i === 9;
    const thinkEnd = last ? WITHHELD_AT : ANSWER_AT;

    // clubs slam in — except rung 1, which is pre-placed on screen (see
    // LadderLong.tsx) and so gets a single downbeat instead of a run of slams
    if (i === 0) {
      mix.add(impact(), 0, 0.7);
    } else {
      for (let c = 0; c < counts[i]; c++) {
        mix.add(impact(), base + CLUB_IN + c * CLUB_GAP, 0.5 + i * 0.02);
      }
    }

    // guess bed — a hat pulse through the thinking window, denser late on
    const gap = last ? 8 : 12 - Math.floor(i / 3) * 2;
    for (let f = i === 0 ? 20 : THINK_AT; f < thinkEnd - 2; f += gap) mix.add(hat(), base + f, 0.18);

    // the 3-2-1 — three discrete ticks, one per second, rising in weight
    TICK_AT.forEach((t, k) => mix.add(tick(), base + t, 0.34 + k * 0.06));

    if (!last) {
      mix.add(ding(), base + ANSWER_AT, 0.5);
      mix.add(blip(SOLVE[i], 0.12), base + ANSWER_AT + 3, 0.44);
      mix.add(impact(), base + ANSWER_AT, 0.4);
    } else {
      // the unanswered rung: rise, hit, and leave it hanging. No ding, ever.
      mix.add(riser((WITHHELD_AT - THINK_AT) / FPS), base + THINK_AT, 0.55);
      mix.add(impact(), base + WITHHELD_AT, 0.9);
      mix.add(stinger(196, 1.6), base + WITHHELD_AT, 0.5);
      mix.add(whoosh(0.5), base + WITHHELD_AT + 22, 0.32);
    }
  }

  // the closing card
  mix.add(whoosh(0.45), CTA_AT - 6, 0.42);
  mix.add(impact(), CTA_AT, 0.8);
  mix.add(stinger(147, 2.2), CTA_AT + 2, 0.42);

  return mix.finalize(0.82, 1.08);
};

export const ensureLadderLongAudio = (outDir = OUT, force = false) => {
  mkdirSync(outDir, { recursive: true });
  let written = 0;
  for (const ed of readEditions()) {
    const fp = path.join(outDir, `ladderlong-${ed.slug}.wav`);
    if (!force && existsSync(fp)) continue;
    writeFileSync(fp, encodeWav(buildEdition(ed.slug, ed.counts)));
    written++;
  }
  return written;
};

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const eds = readEditions();
  for (const e of eds) console.log(`  ${e.slug.padEnd(16)} clubs/rung: ${e.counts.join(",")}`);
  const n = ensureLadderLongAudio(OUT, process.argv.includes("--force"));
  console.log(n === 0 ? "ladderlong wavs present." : `Wrote ${n} ladderlong wav(s) (${(TOTAL / FPS).toFixed(1)}s each)`);
}
