// "SEMI-FINAL" voiceover — the one promo in the set with a human voice.
//
// Every other promo is math: synthesised from a seeded PRNG, byte-identical on
// every regenerate, no network. A narrated line can't work that way, so the VO
// is generated ONCE against ElevenLabs v3 (via fal.ai) and committed to
// `promo/vo-cache/`. Renders copy from that cache into `public/promo/vo/` and
// never touch the network — a fresh clone with no API key still renders this
// video byte-identically. Regenerating is a deliberate act: delete the cache
// (or pass --force) with FAL_KEY set.
//
// Why per-line files instead of one blob: each line lands on an exact frame of
// the beat grid, so the music stays authoritative and a line can be re-cut
// without re-timing the rest. The API also returns per-character timestamps,
// which we keep in the manifest so on-screen words can land on the exact
// millisecond they're spoken (see src/promo/semifinal/vo.ts).
import { writeFileSync, mkdirSync, existsSync, readFileSync, copyFileSync, readdirSync, unlinkSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const CACHE = path.join(dir, "vo-cache");
const PUB = path.join(dir, "..", "public", "promo", "vo");
const MANIFEST = path.join(CACHE, "manifest.json");

const MODEL = "https://fal.run/fal-ai/elevenlabs/tts/eleven-v3";

// Deep British news-presenter register — the piece is football history read
// like a bulletin, and the gravitas is the joke's straight man. Swap this one
// string and delete vo-cache/ to re-voice the whole video.
export const VOICE = "Daniel";

// The script. `key` is the frame-grid anchor used by the timeline; keep the
// keys and the timeline's VO_LINES in sync. Text is spoken verbatim — the
// on-screen typography is derived from it, not written twice.
// Fact-checked 15 Jul 2026 — every claim here is load-bearing and verified.
// Deliberate precision notes, do not "tidy" these:
//   • "over twenty years" — NOT "21 years". FIFA and much of the press are
//     doing calendar subtraction; the true gap is 20y 8m 3d (7,550 days).
//   • "seconds into his debut" — sources split on 40/43/47s, so no number.
//   • Messi genuinely has never faced England: the only ENG–ARG fixture of his
//     career was 12 Nov 2005, and he was suspended for it. That is the video.
//   • "eight in this tournament" — 8 goals, TIED with Mbappé. Never "leading".
//   • "against Hungary" and the whole `ban` line are NOT padding — cut either
//     and the story reads as a contradiction ("never played England" / "sent
//     off on his debut" → viewers assume the debut WAS England), and it opens
//     the obvious rebuttal: he played three qualifiers between the red card in
//     August and the England friendly in November, so why hadn't he served it?
//     Because the ban only counted in friendlies. Name Hungary, state the rule.
export const LINES = [
  { key: "never", text: "Lionel Messi has never played against England." },
  { key: "notonce", text: "Not once." },
  { key: "susp", text: "The last time these two met, he was suspended." },
  { key: "red", text: "For a red card he got seconds into his debut, against Hungary." },
  { key: "ban", text: "The ban only counted in friendlies. Argentina's next friendly? England." },
  { key: "days", text: "That was seven thousand, five hundred and fifty days ago." },
  { key: "hist", text: "The hand. The red card. The revenge." },
  { key: "tonight", text: "Until tonight." },
  { key: "ask", text: "So how much of that did you actually know?" },
  { key: "cta", text: "Prove it." },
];

const key = () => process.env.FAL_KEY || process.env.FAL_API_KEY || "";

// character timestamps → word timings (start/end seconds per word), so the
// visuals can key off speech instead of a guessed cadence.
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
    // stability 0.35: v3's expressive end. Higher reads flat and robotic, which
    // is death for a hype piece; lower starts inventing accents mid-line.
    body: JSON.stringify({ text: line.text, voice: VOICE, stability: 0.35, timestamps: true }),
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

// Generates any missing line, writes the manifest, mirrors the cache into
// public/. Returns the manifest. Network is touched only on a cache miss.
export const ensureSemifinalVo = async ({ force = false } = {}) => {
  const have = existsSync(MANIFEST) && !force ? JSON.parse(readFileSync(MANIFEST, "utf8")) : { voice: VOICE, lines: [] };
  const byKey = new Map((have.lines ?? []).map((l) => [l.key, l]));
  const stale = have.voice !== VOICE;

  const out = [];
  for (const line of LINES) {
    const cached = byKey.get(line.key);
    const fresh = cached && !stale && !force && cached.text === line.text && existsSync(path.join(CACHE, `${line.key}.mp3`));
    if (fresh) {
      out.push(cached);
      continue;
    }
    process.stdout.write(`  vo: ${line.key}…`);
    out.push(await generate(line));
    console.log(" ok");
  }

  // Always rewritten, even when nothing regenerated: a line removed from LINES
  // must leave the manifest too, or vo.json and the cache drift apart.
  const manifest = { voice: VOICE, lines: out };
  mkdirSync(CACHE, { recursive: true });
  writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2));

  // mirror cache → public (public/promo is gitignored + regenerated). Only the
  // lines still in LINES — a cut line's mp3 lingers in the cache (cheap to keep
  // in case it comes back) but must not ship into the bundle.
  mkdirSync(PUB, { recursive: true });
  const live = new Set(out.map((l) => `${l.key}.mp3`));
  for (const f of readdirSync(CACHE)) {
    if (f.endsWith(".mp3") && live.has(f)) copyFileSync(path.join(CACHE, f), path.join(PUB, f));
  }
  // prune: a line cut from LINES leaves its mp3 behind in public/ from an
  // earlier run, and it would be bundled into every future render.
  for (const f of readdirSync(PUB)) {
    if (f.endsWith(".mp3") && !live.has(f)) unlinkSync(path.join(PUB, f));
  }
  writeFileSync(path.join(dir, "..", "src", "promo", "semifinal", "vo.json"), JSON.stringify(manifest, null, 2));
  return manifest;
};

if (process.argv[1] && process.argv[1].endsWith("semifinal-vo.mjs")) {
  const m = await ensureSemifinalVo({ force: process.argv.includes("--force") });
  const total = m.lines.reduce((a, l) => a + l.dur, 0);
  console.log(`\nvoice=${m.voice}  ${m.lines.length} lines  ${total.toFixed(2)}s of speech`);
  for (const l of m.lines) console.log(`  ${l.key.padEnd(8)} ${l.dur.toFixed(2)}s  "${l.text}"`);
}
