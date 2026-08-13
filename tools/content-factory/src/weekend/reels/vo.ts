// VO lookup for the CF-WEEKEND reels. Manifest written by
// weekend/reels-vo.mjs; mp3s mirrored into public/promo/vo-wknd/. Optional at
// render time so the grids can be proofed silent before a credit is spent —
// a keyless clone renders complete-but-mute, behind the runner's warning.
// A PROOF MUST NEVER BE POSTED: the pacing is the voice.
import manifest from "./vo.json";

export type VoLine = { key: string; text: string; dur: number; words?: { word: string; t0: number; t1: number }[] };

const LINES: VoLine[] = (manifest.lines ?? []) as VoLine[];
const BY_KEY = new Map(LINES.map((l) => [l.key, l]));

export const hasVo = LINES.length > 0;
export const vo = (key: string): VoLine | undefined => BY_KEY.get(key);
