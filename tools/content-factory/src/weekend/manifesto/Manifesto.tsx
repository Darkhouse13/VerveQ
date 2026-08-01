import React from "react";
import { AbsoluteFill, Audio, Sequence, staticFile } from "remotion";
import { COLORS } from "../../promo/kit";
import { SCENES, START } from "./timeline";
import { MANIFESTO_SCENES } from "./scenes";

// CT-1 flagship — "WKND-MANIFESTO": Anthem's kinetic-type grammar re-skinned
// for THE WEEKEND (ink ground, lime lead) at a readable ~128 BPM. The silent
// deadpan frame carries the campaign's one job: "the waitlist is open."
export const Manifesto: React.FC = () => (
  <AbsoluteFill style={{ background: COLORS.ink }}>
    <Audio src={staticFile("promo/wknd-manifesto.wav")} />
    {SCENES.map((s) => {
      const Comp = MANIFESTO_SCENES[s.key];
      return (
        <Sequence key={s.key} from={START[s.key]} durationInFrames={s.dur} layout="none">
          <Comp dur={s.dur} />
        </Sequence>
      );
    })}
  </AbsoluteFill>
);
