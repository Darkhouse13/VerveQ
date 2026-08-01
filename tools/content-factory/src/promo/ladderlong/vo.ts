// VO lookup for ladder-long. The manifest is written by
// promo/ladderlong-vo.mjs; the mp3s are mirrored into public/promo/vo-ll/.
//
// The VO is OPTIONAL at render time and that is deliberate: with an empty
// manifest every edition still renders, silent but complete, so the visual grid
// can be validated (and the batch can be proofed) before anyone spends a
// fal.ai credit. Once the cache exists the same compositions pick the lines up
// with no code change.
import manifest from "./vo.json";

export type VoLine = { key: string; slot: string; text: string; dur: number; words?: { word: string; t0: number; t1: number }[] };

const LINES: VoLine[] = (manifest.lines ?? []) as VoLine[];
const BY_KEY = new Map(LINES.map((l) => [l.key, l]));

export const voice = manifest.voice as string;
export const hasVo = LINES.length > 0;
export const vo = (key: string): VoLine | undefined => BY_KEY.get(key);

// Every VO cue for an edition, as {key, atFrame}. Kept here rather than in the
// component so the audio layout is one readable list.
export const cuesFor = (
  slug: string,
  opts: { step: number; answerAt: number; withheldAt: number; ctaAt: number },
): { key: string; at: number }[] => {
  const cues: { key: string; at: number }[] = [{ key: "open", at: 0 }];
  for (let i = 1; i < 10; i++) cues.push({ key: `n${i + 1}`, at: i * opts.step });
  for (let i = 0; i < 9; i++) cues.push({ key: `${slug}-a${i + 1}`, at: i * opts.step + opts.answerAt });
  cues.push({ key: "withhold", at: 9 * opts.step + opts.withheldAt });
  cues.push({ key: "cta", at: opts.ctaAt });
  return cues.filter((c) => BY_KEY.has(c.key));
};
