import React from "react";
import { Composition } from "remotion";
import GRID from "./grid.json";
import { Imposter, IMPOSTER_TOTAL } from "./Imposter";

export const ImposterRoot: React.FC = () => (
  <Composition id="LabImposter" component={Imposter} durationInFrames={IMPOSTER_TOTAL} fps={GRID.fps} width={1080} height={1920} />
);
