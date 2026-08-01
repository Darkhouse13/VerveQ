// "VERSUS" soundtrack — 90 BPM half-time, heavy and menacing. Big spaced kicks,
// claps on the 3, a clash hit where the two sides collide, driving to a final
// stinger. Arranged on the same grid as src/promo/versus/timeline.ts.
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Mixer, encodeWav, kick, sub, bass, hat, clap, impact, whoosh, riser, stinger, crash, blip } from "./audio-lib.mjs";

const FPS = 30;
const BEAT = 20; // 90 BPM
const BAR = 80;
const dir = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(dir, "..", "public", "promo");

// MUST match src/promo/versus/timeline.ts
const SCENES = [["hook", 100], ["vs", 80], ["duel", 100], ["arena", 80], ["rivalry", 80], ["cta", 100]];
const START = {};
let acc = 0;
for (const [k, d] of SCENES) { START[k] = acc; acc += d; }
const TOTAL = acc; // 540

const mix = new Mixer("versus", TOTAL, FPS);

// HOOK — tense drone + word-slam impacts, pink turn "HE DOESN'T" hit
mix.add(sub(41, 3.0), 0, 0.45);
for (const f of [0, 16, 30]) mix.add(impact(), f, 0.75);
mix.add(whoosh(0.5), 46, 0.6);
mix.add(impact(), 52, 1.0); // "HE DOESN'T."
mix.add(sub(55, 0.8), 52, 0.7);

// VS clash — two whooshes converge into a huge collision hit
mix.add(whoosh(0.45), START.vs + 4, 0.7);
mix.add(whoosh(0.45), START.vs + 4, 0.7);
mix.add(impact(), START.vs + 24, 1.0);
mix.add(sub(41, 1.0), START.vs + 24, 1.0);
mix.add(crash(), START.vs + 24, 0.5);

// GROOVE — half-time from the clash through rivalry
const GS = START.vs + 24; // 124
const GE = START.cta; // 440
for (let f = GS; f < GE; f += BAR) {
  mix.add(kick(), f, 1.0); // beat 1
  mix.add(kick(), f + BEAT * 2, 0.85); // beat 3 (light)
  mix.add(clap(), f + BEAT * 2, 0.8); // clap on 3
}
for (let f = GS; f < GE; f += BEAT) mix.add(hat(f % (BEAT * 2) === 0), f + BEAT / 2, 0.55); // offbeat hats
// menacing bass ostinato: F#1 · F#1 · D1 · E1
const ROOTS = [46.25, 46.25, 36.7, 41.2];
let bi = 0;
for (let f = GS; f < GE; f += BAR) {
  const r = ROOTS[bi % ROOTS.length];
  mix.add(bass(r, 0.7), f, 1.0);
  mix.add(bass(r, 0.5), f + BEAT, 0.7);
  mix.add(bass(r * 1.5, 0.5), f + BEAT * 3, 0.7);
  bi++;
}

// DUEL — scoreboard tick blips + per-cut whoosh
mix.add(whoosh(0.35), START.duel - 4, 0.6);
for (let i = 0; i < 4; i++) mix.add(blip(520 + i * 40), START.duel + 30 + i * 10, 0.5);

// ARENA — dots lighting up
mix.add(whoosh(0.35), START.arena - 4, 0.6);
for (let i = 0; i < 5; i++) mix.add(blip(440 + i * 60), START.arena + 20 + i * 7, 0.55);

// RIVALRY
mix.add(impact(), START.rivalry, 0.6);
mix.add(riser(1.0), START.cta - 26, 0.8); // into the CTA

// CTA — "STOP ARGUING." / "SETTLE IT."
mix.add(impact(), START.cta, 0.7); // "STOP ARGUING."
mix.add(sub(41, 1.2), START.cta + 20, 1.0);
mix.add(crash(), START.cta + 20, 0.55);
mix.add(stinger(146.83, 1.4), START.cta + 20, 0.9); // "SETTLE IT."
mix.add(kick(), START.cta + 20, 1.0);
mix.add(kick(), START.cta + 20 + BAR, 0.8);

const master = mix.finalize();

export const ensureVersusAudio = (outDir = OUT, force = false) => {
  mkdirSync(outDir, { recursive: true });
  const fp = path.join(outDir, "versus.wav");
  if (!force && existsSync(fp)) return 0;
  writeFileSync(fp, encodeWav(master));
  return 1;
};

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const n = ensureVersusAudio(OUT, process.argv.includes("--force"));
  console.log(n === 0 ? "versus.wav present." : `Wrote versus.wav (${(TOTAL / FPS).toFixed(1)}s)`);
}
