import React from "react";
import { AbsoluteFill, Audio, Sequence, staticFile } from "remotion";
import { COLORS } from "../kit";
import { SCENES, START } from "./timeline";
import { QUIZTEASE_SCENES } from "./scenes";

// Promo #3 — "HOW GOOD ARE YOU REALLY?": a play-along quiz tease. Full-colour
// question grounds, a ticking clock, real questions the viewer answers in their
// head — a different job (test the viewer) from #1 (show modes) and #2 (versus).
export const QuizTease: React.FC = () => (
  <AbsoluteFill style={{ background: COLORS.blue }}>
    <Audio src={staticFile("promo/quiztease.wav")} />
    {SCENES.map((s) => {
      const Comp = QUIZTEASE_SCENES[s.key];
      return (
        <Sequence key={s.key} from={START[s.key]} durationInFrames={s.dur} layout="none">
          <Comp dur={s.dur} />
        </Sequence>
      );
    })}
  </AbsoluteFill>
);
