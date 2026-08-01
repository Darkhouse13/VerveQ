import React from "react";
import { AbsoluteFill, Audio, Sequence, staticFile } from "remotion";
import { COLORS } from "../kit";
import { SCENES, START } from "./timeline";
import { DRAW_SCENES } from "./scenes";

// THE DRAW launch promo v2 — "THE DECISION". One run of today's board where
// the viewer makes the BANK-or-PUSH call live: run → fork → 3-2-1 the viewer
// answers → he pushed → BUSTED → "would YOU have banked?". The countdown
// mechanic is the set's proven play-along beat (quiztease); the bust carries
// the app's own hazard-stripe aesthetic. 120 BPM.
export const TheDecision: React.FC = () => (
  <AbsoluteFill style={{ background: COLORS.ink }}>
    <Audio src={staticFile("promo/the-decision.wav")} />
    {SCENES.map((s) => {
      const Comp = DRAW_SCENES[s.key];
      return (
        <Sequence key={s.key} from={START[s.key]} durationInFrames={s.dur} layout="none">
          <Comp dur={s.dur} />
        </Sequence>
      );
    })}
  </AbsoluteFill>
);
