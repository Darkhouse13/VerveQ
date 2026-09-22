// RACE root — its own Remotion root (lab/race-render.mjs bundles
// src/lab/race/index.ts) so this reel never touches the shared lab or main
// roots other sessions edit live.
import React from "react";
import { Composition } from "remotion";
import T from "./timeline.json";
import { BallonRace, RACE_TOTAL } from "./BallonRace";

export const RaceRoot: React.FC = () => (
  <Composition id="LabBallonRace" component={BallonRace} durationInFrames={RACE_TOTAL} fps={T.fps} width={1080} height={1920} />
);
