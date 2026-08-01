import React from "react";
import { AbsoluteFill, Audio, Sequence, staticFile } from "remotion";
import { COLORS } from "../kit";
import { SCENES, START } from "./timeline";
import { FINAL_SCENES } from "./scenes";

// Promo #13 — "FINAL": the matchday countdown. World Cup final July 19 —
// the players are warming up, so should you. Stadium four-on-the-floor;
// posts in the week before the final ride the biggest football moment of
// the year.
export const Final: React.FC = () => (
  <AbsoluteFill style={{ background: COLORS.ink }}>
    <Audio src={staticFile("promo/final.wav")} />
    {SCENES.map((s) => {
      const Comp = FINAL_SCENES[s.key];
      return (
        <Sequence key={s.key} from={START[s.key]} durationInFrames={s.dur} layout="none">
          <Comp dur={s.dur} />
        </Sequence>
      );
    })}
  </AbsoluteFill>
);
