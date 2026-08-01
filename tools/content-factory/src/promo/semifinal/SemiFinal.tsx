import React from "react";
import { AbsoluteFill, Audio, Sequence, staticFile } from "remotion";
import { COLORS } from "../kit";
import { SCENES, START, VO_WINDOWS, TOTAL } from "./timeline";
import { SEMI_SCENES } from "./scenes";

// Matchday one-off — "SEMI-FINAL": England v Argentina, 15 July 2026, cut to
// post an hour before kickoff.
//
// The hook is a fact, not a boast: Lionel Messi has never played against
// England. The only fixture between them in his entire career was 12 Nov 2005
// and he was suspended for it — a red card he earned seconds into his debut,
// on a ban that covered friendlies only and landed on precisely that one match.
// Tonight, at last, it ends. Everything else in the video serves that sentence.
//
// The one promo in the set with a human voice (ElevenLabs v3 via fal.ai,
// cached in promo/vo-cache/). Scene lengths are the narrator's measured
// delivery quantised to the beat, and the cards land on the exact frames the
// words are spoken — see ./vo.ts.

// Music ducks under the voice with a short ramp either side. Without this the
// synth score fights the narrator and you lose both.
const DUCK_IN = 5;
const BED = 0.9; // score alone, in the gaps
const UNDER = 0.3; // score beneath a spoken line

const musicVolume = (frame: number): number => {
  let d = 0; // 0 = open, 1 = fully ducked
  for (const [a, b] of VO_WINDOWS) {
    if (frame >= a - DUCK_IN && frame <= b + DUCK_IN) {
      const inRamp = Math.min(1, Math.max(0, (frame - (a - DUCK_IN)) / DUCK_IN));
      const outRamp = Math.min(1, Math.max(0, (b + DUCK_IN - frame) / DUCK_IN));
      d = Math.max(d, Math.min(inRamp, outRamp));
    }
  }
  return BED + (UNDER - BED) * d;
};

export const SemiFinal: React.FC = () => (
  <AbsoluteFill style={{ background: COLORS.cream }}>
    <Audio src={staticFile("promo/semifinal.wav")} volume={musicVolume} />
    {SCENES.map((s) => (
      <Sequence key={`vo-${s.key}`} from={START[s.key]} durationInFrames={s.dur} layout="none">
        <Audio src={staticFile(`promo/vo/${s.key}.mp3`)} />
      </Sequence>
    ))}
    {SCENES.map((s) => {
      const Comp = SEMI_SCENES[s.key];
      return (
        <Sequence key={s.key} from={START[s.key]} durationInFrames={s.dur} layout="none">
          <Comp dur={s.dur} />
        </Sequence>
      );
    })}
  </AbsoluteFill>
);

export { TOTAL };
