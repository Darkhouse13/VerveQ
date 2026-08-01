import React from "react";
import { AbsoluteFill, Audio, Sequence, staticFile } from "remotion";
import { COLORS } from "../kit";
import { SCENES, START } from "./timeline";
import { ONEMORE_SCENES } from "./scenes";

// Promo #5 — "ONE MORE": the 1AM can't-stop loop. Nocturnal ink-and-lime,
// hypnotic ~129 BPM that adds a layer per bar, and a dead-silent gag beat
// before the relapse — the only promo in the set built on a joke.
export const OneMore: React.FC = () => (
  <AbsoluteFill style={{ background: COLORS.ink }}>
    <Audio src={staticFile("promo/onemore.wav")} />
    {SCENES.map((s) => {
      const Comp = ONEMORE_SCENES[s.key];
      return (
        <Sequence key={s.key} from={START[s.key]} durationInFrames={s.dur} layout="none">
          <Comp dur={s.dur} />
        </Sequence>
      );
    })}
  </AbsoluteFill>
);
