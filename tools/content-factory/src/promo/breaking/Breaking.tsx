import React from "react";
import { AbsoluteFill, Audio, Sequence, staticFile } from "remotion";
import { COLORS } from "../kit";
import { SCENES, START } from "./timeline";
import { BREAKING_SCENES } from "./scenes";

// Promo #7 — "BREAKING": the transfer-news parody. Chyrons, LIVE bugs and
// tickers ARE the hook — football fans are trained to stop for this format.
// 112.5 BPM newsroom pulse with typewriter percussion.
export const Breaking: React.FC = () => (
  <AbsoluteFill style={{ background: COLORS.ink }}>
    <Audio src={staticFile("promo/breaking.wav")} />
    {SCENES.map((s) => {
      const Comp = BREAKING_SCENES[s.key];
      return (
        <Sequence key={s.key} from={START[s.key]} durationInFrames={s.dur} layout="none">
          <Comp dur={s.dur} />
        </Sequence>
      );
    })}
  </AbsoluteFill>
);
