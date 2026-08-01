import React from "react";
import { AbsoluteFill, Audio, Sequence, staticFile } from "remotion";
import { COLORS } from "../kit";
import { SCENES, START } from "./timeline";
import { REMEMBER_SCENES } from "./scenes";

// Promo #11 — "REMEMBER": the nostalgia piece. 2006, sticker albums, squad
// numbers by heart — it flatters the viewer's memory before challenging it.
// Warm 90 BPM, warm palette, the set's only cream endcard.
export const Remember: React.FC = () => (
  <AbsoluteFill style={{ background: COLORS.ink }}>
    <Audio src={staticFile("promo/remember.wav")} />
    {SCENES.map((s) => {
      const Comp = REMEMBER_SCENES[s.key];
      return (
        <Sequence key={s.key} from={START[s.key]} durationInFrames={s.dur} layout="none">
          <Comp dur={s.dur} />
        </Sequence>
      );
    })}
  </AbsoluteFill>
);
