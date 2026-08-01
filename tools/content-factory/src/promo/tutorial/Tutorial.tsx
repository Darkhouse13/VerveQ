import React from "react";
import { AbsoluteFill, Audio, Sequence, staticFile } from "remotion";
import { COLORS } from "../kit";
import { SCENES, START } from "./timeline";
import { TUTORIAL_SCENES } from "./scenes";

// Promo #17 — "TUTORIAL": the deadpan how-to. Three steps to win any
// football argument (stop talking / send one link / screenshot the 9–4),
// a dead-quiet "that's it. that's the tutorial." beat, then CLASS DISMISSED.
export const Tutorial: React.FC = () => (
  <AbsoluteFill style={{ background: COLORS.ink }}>
    <Audio src={staticFile("promo/tutorial.wav")} />
    {SCENES.map((s) => {
      const Comp = TUTORIAL_SCENES[s.key];
      return (
        <Sequence key={s.key} from={START[s.key]} durationInFrames={s.dur} layout="none">
          <Comp dur={s.dur} />
        </Sequence>
      );
    })}
  </AbsoluteFill>
);
