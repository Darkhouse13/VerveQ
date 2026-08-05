// VO lookup for ladder-long. The manifest is written by
// promo/ladderlong-vo.mjs; the mp3s are mirrored into public/promo/vo-ll/.
//
// The VO is OPTIONAL at render time and that is deliberate: with an empty
// manifest every edition still renders, silent but complete, so the visual grid
// can be validated (and the batch can be proofed) before anyone spends a
// fal.ai credit. Once the cache exists the same compositions pick the lines up
// with no code change.
import manifest from "./vo.json";
import { Edition, cueFrames } from "./timeline";

export type VoLine = { key: string; slot: string; text: string; dur: number; words?: { word: string; t0: number; t1: number }[] };

const LINES: VoLine[] = (manifest.lines ?? []) as VoLine[];
const BY_KEY = new Map(LINES.map((l) => [l.key, l]));

export const voice = manifest.voice as string;
export const hasVo = LINES.length > 0;
export const vo = (key: string): VoLine | undefined => BY_KEY.get(key);

// Every VO cue for an edition, as {key, atFrame}. Kept here rather than in the
// component so the audio layout is one readable list.
//
// THREE KEYS ARE BATCH-DEPENDENT, and all three exist so batch 1 keeps its own
// take rather than inheriting batch 2's rewrites:
//   open -> open2  batch 2 seeds the scoreboard in the first sentence
//                  ("…keep score.") instead of echoing the on-screen header.
//   cta  -> cta2   batch 2 asks for the SCORE and the rung-10 name; batch 1
//                  asked only how far you got.
//   follow         batch 2 only — there is no follow beat in batch 1's grid.
//
// One more is PACE-dependent. A count-in has to clear before its rung's first
// tick so the 3-2-1 is heard in the clear; at 5.50s that boundary is 60f/2.00s,
// and `n5` ("Halfway. Number five.") measured 2.24s. It is the single carrier
// line the fast grid cannot hold, so the fast arm says `n5f` instead. The other
// eight count-ins measured <=1.92s and are shared by both paces unchanged.
export const cuesFor = (ed: Edition): { key: string; at: number }[] => {
  const g = ed.grid;
  const f = cueFrames(ed);
  const b2 = ed.batch === 2;
  const fast = g.step < 210;
  const cues: { key: string; at: number }[] = [{ key: b2 ? "open2" : "open", at: 0 }];
  f.counts.forEach((at, k) => {
    const n = k + 2; // n2…n10
    cues.push({ key: n === 5 && fast ? "n5f" : `n${n}`, at });
  });
  f.answers.forEach((at, k) => cues.push({ key: `${ed.slug}-a${k + 1}`, at }));
  cues.push({ key: "withhold", at: f.withhold });
  if (b2) cues.push({ key: "follow", at: f.follow });
  cues.push({ key: b2 ? "cta2" : "cta", at: f.cta });
  return cues.filter((c) => BY_KEY.has(c.key));
};
