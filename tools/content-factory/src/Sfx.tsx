import React from "react";
import { Audio, Sequence, staticFile } from "remotion";
import { SoundKit } from "./variants";
import { Phases, clubAppearAt, COUNTDOWN_FRAMES } from "./timing";

// The baked sound layer. Original, synthesized SFX (see sfx/gen.mjs) triggered
// exactly on the animation beats: a slam per club, ticks on the 3-2-1, a riser
// under "WHO IS HE?", a stinger on the reveal, a whoosh into the CTA. These are
// deliberately mixed low — the creator still layers a trending sound on top in
// the app (that's the distribution play), and these accents just make the raw
// upload feel alive and, per sound kit, distinct. No music is ever baked in.
const clip = (kit: SoundKit, name: string) => staticFile(`sfx/${name}_${kit}.wav`);

export const Sfx: React.FC<{ kit: SoundKit; rowCount: number; phases: Phases }> = ({
  kit,
  rowCount,
  phases: p,
}) => {
  const perDigit = COUNTDOWN_FRAMES / 3;
  return (
    <>
      {/* one slam per club row, on the exact frame the card lands */}
      {Array.from({ length: rowCount }).map((_, i) => (
        <Sequence key={`slam-${i}`} from={clubAppearAt(i)} durationInFrames={30}>
          <Audio src={clip(kit, "impact")} volume={0.7} />
        </Sequence>
      ))}

      {/* riser fills the countdown window */}
      <Sequence from={p.clubsEnd} durationInFrames={COUNTDOWN_FRAMES}>
        <Audio src={clip(kit, "riser")} volume={0.5} />
      </Sequence>

      {/* tick on each of 3 · 2 · 1 */}
      {[0, 1, 2].map((k) => (
        <Sequence key={`tick-${k}`} from={Math.round(p.clubsEnd + k * perDigit)} durationInFrames={12}>
          <Audio src={clip(kit, "tick")} volume={0.6} />
        </Sequence>
      ))}

      {/* stinger the instant the name is revealed */}
      <Sequence from={p.countdownEnd} durationInFrames={90}>
        <Audio src={clip(kit, "stinger")} volume={0.85} />
      </Sequence>

      {/* whoosh as the CTA card slides up */}
      <Sequence from={p.revealEnd} durationInFrames={40}>
        <Audio src={clip(kit, "whoosh")} volume={0.5} />
      </Sequence>
    </>
  );
};
