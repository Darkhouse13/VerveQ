import React from "react";
import { AbsoluteFill, Audio, Sequence, staticFile } from "remotion";
import { COLORS } from "../kit";
import { SCENES, START } from "./timeline";
import { VERSUS_SCENES } from "./scenes";

// Promo #2 — "VERSUS": the head-to-head taunt. Same brand language as #1, a
// completely different beat (90 BPM half-time) and structure (split-screen
// clash + scoreboard + rivalry).
export const Versus: React.FC = () => (
  <AbsoluteFill style={{ background: COLORS.ink }}>
    <Audio src={staticFile("promo/versus.wav")} />
    {SCENES.map((s) => {
      const Comp = VERSUS_SCENES[s.key];
      return (
        <Sequence key={s.key} from={START[s.key]} durationInFrames={s.dur} layout="none">
          <Comp dur={s.dur} />
        </Sequence>
      );
    })}
  </AbsoluteFill>
);
