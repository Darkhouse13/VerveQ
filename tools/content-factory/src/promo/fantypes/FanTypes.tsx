import React from "react";
import { AbsoluteFill, Audio, Sequence, staticFile } from "remotion";
import { COLORS } from "../kit";
import { SCENES, START } from "./timeline";
import { FANTYPES_SCENES } from "./scenes";

// Promo #9 — "FAN TYPES": five specimens, one roast each, the villain last.
// Taxonomy content is a tag-your-mates engine; the CTA literally instructs
// the comment section ("Tag the other four."). ~106 BPM swagger strut.
export const FanTypes: React.FC = () => (
  <AbsoluteFill style={{ background: COLORS.ink }}>
    <Audio src={staticFile("promo/fantypes.wav")} />
    {SCENES.map((s) => {
      const Comp = FANTYPES_SCENES[s.key];
      return (
        <Sequence key={s.key} from={START[s.key]} durationInFrames={s.dur} layout="none">
          <Comp dur={s.dur} />
        </Sequence>
      );
    })}
  </AbsoluteFill>
);
