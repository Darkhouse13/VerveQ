// VO lookup for chain-long. The manifest is written by
// promo/chainlong-vo.mjs; the mp3s are mirrored into public/promo/vo-cl/.
//
// Same optionality law as ladder-long's vo.ts: with an empty manifest every
// edition renders silent-but-complete, so the rail can be proofed before a
// credit is spent. A PROOF MUST NEVER BE POSTED — the pacing is the voice.
import manifest from "./vo.json";
import { Edition, cueFrames } from "./timeline";

export type VoLine = { key: string; slot: string; text: string; dur: number; words?: { word: string; t0: number; t1: number }[] };

const LINES: VoLine[] = (manifest.lines ?? []) as VoLine[];
const BY_KEY = new Map(LINES.map((l) => [l.key, l]));

export const voice = manifest.voice as string;
export const hasVo = LINES.length > 0;
export const vo = (key: string): VoLine | undefined => BY_KEY.get(key);

// The cue list. THE CARRIER IS SHARED WITH LADDER-LONG wherever slot and copy
// fit (spec #13 — the winners' carrier is bit-identical between episodes, and
// ours now spans formats): `n2`…`n9`, `follow` and `cta2` are the ladder-long
// takes, copied from that cache and never re-billed. Four keys are chain-only:
//   openc    — the premise + the size + the scoreboard seed, in one breath.
//   turn     — slot 10's boundary. There is no `n10` here: the count-in's job
//              at slot 10 is the hand-over, so the line IS the hand-over.
//   omission — the confession, where an answer would land. Said out loud for
//              the same reason `withhold` was: an empty box implies, the voice
//              commits.
//   <slug>-a1…a9 — the nine answer names per edition.
// `cta2` ("Your score? And number ten?") is reused UNCHANGED because both its
// asks are this format's asks: the knowns count, and slot ten.
export const cuesFor = (ed: Edition): { key: string; at: number }[] => {
  const f = cueFrames(ed);
  const cues: { key: string; at: number }[] = [{ key: "openc", at: 0 }];
  f.counts.forEach((at, k) => cues.push({ key: `n${k + 2}`, at })); // n2…n9
  f.answers.forEach((at, k) => cues.push({ key: `${ed.slug}-a${k + 1}`, at }));
  cues.push({ key: "turn", at: f.turn });
  cues.push({ key: "omission", at: f.omission });
  cues.push({ key: "follow", at: f.follow });
  cues.push({ key: "cta2", at: f.cta });
  return cues.filter((c) => BY_KEY.has(c.key));
};
