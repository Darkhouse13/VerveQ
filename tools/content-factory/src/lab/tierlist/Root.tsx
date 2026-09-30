import React from "react";
import { Composition } from "remotion";
import GRID from "./grid.json";
import { TierList } from "./TierList";

export const TierListRoot: React.FC = () => <Composition id="LabTierList" component={TierList} durationInFrames={GRID.total} fps={GRID.fps} width={1080} height={1920} />;
