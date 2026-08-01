import React from "react";
import { AbsoluteFill, Audio, Sequence, staticFile } from "remotion";
import { COLORS } from "../kit";
import { SCENES, START } from "./timeline";
import { LICENSE_SCENES } from "./scenes";

// Promo #12 — "LICENSE": the bureaucracy parody. Football opinions now
// require a license; Dave's application is DENIED (reason: vibes only).
// ~95 BPM rubber-stamp march — the stamps ARE the percussion.
export const License: React.FC = () => (
  <AbsoluteFill style={{ background: COLORS.ink }}>
    <Audio src={staticFile("promo/license.wav")} />
    {SCENES.map((s) => {
      const Comp = LICENSE_SCENES[s.key];
      return (
        <Sequence key={s.key} from={START[s.key]} durationInFrames={s.dur} layout="none">
          <Comp dur={s.dur} />
        </Sequence>
      );
    })}
  </AbsoluteFill>
);
