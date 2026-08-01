import React from "react";
import { AbsoluteFill, Audio, Sequence, staticFile } from "remotion";
import { COLORS } from "../kit";
import { SCENES, START } from "./timeline";
import { HORROR_SCENES } from "./scenes";

// Promo #14 — "HORROR": the trailer parody. Every fan's fear is two words —
// "PROVE IT." — and the monster is THE SCOREBOARD (starring Dave, 2/10).
// Heartbeat dread the whole way, then the CTA flips the genre for the gag.
export const Horror: React.FC = () => (
  <AbsoluteFill style={{ background: COLORS.ink }}>
    <Audio src={staticFile("promo/horror.wav")} />
    {SCENES.map((s) => {
      const Comp = HORROR_SCENES[s.key];
      return (
        <Sequence key={s.key} from={START[s.key]} durationInFrames={s.dur} layout="none">
          <Comp dur={s.dur} />
        </Sequence>
      );
    })}
  </AbsoluteFill>
);
