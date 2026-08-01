// Speech-driven timing. ElevenLabs returns per-character timestamps for every
// line; promo/semifinal-vo.mjs folds those into per-word start/end seconds and
// writes vo.json. This module turns them into FRAMES, so on-screen words can
// land on the exact frame they're spoken rather than on a cadence we guessed.
//
// That's the whole reason this promo has a voice: not narration over a
// slideshow, but typography cut to a human's actual delivery — the pauses he
// took are the pauses the cards take.
import manifest from "./vo.json";
import { FPS, START, type SKey } from "./timeline";

type Word = { word: string; t0: number; t1: number };
type Line = { key: string; text: string; dur: number; words: Word[] };

const BY_KEY = new Map<string, Line>((manifest.lines as Line[]).map((l) => [l.key, l]));

const line = (key: SKey): Line => {
  const l = BY_KEY.get(key);
  if (!l) throw new Error(`No VO line "${key}" in vo.json — re-run promo/semifinal-vo.mjs`);
  return l;
};

export const VOICE = manifest.voice;

// Absolute frame at which `key`'s audio begins (scenes start on their line).
export const voAt = (key: SKey): number => START[key];

// Frame (relative to the scene) at which the nth word of the line is spoken.
export const wordAt = (key: SKey, i: number): number => {
  const w = line(key).words;
  const idx = Math.min(i, w.length - 1);
  return Math.round(w[idx].t0 * FPS);
};

// Frame at which the first word matching `needle` is spoken — index-free, so
// re-cutting a line's wording doesn't silently shift a cue to the wrong word.
// Case- and punctuation-insensitive. Throws rather than guessing: a missed cue
// should fail the render, not desync it.
export const cueAt = (key: SKey, needle: string): number => {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const w = line(key).words;
  const i = w.findIndex((x) => norm(x.word) === norm(needle));
  if (i === -1) throw new Error(`VO cue "${needle}" not found in "${key}" ("${line(key).text}")`);
  return Math.round(w[i].t0 * FPS);
};

export const words = (key: SKey): string[] => line(key).words.map((w) => w.word);
export const wordCount = (key: SKey): number => line(key).words.length;
