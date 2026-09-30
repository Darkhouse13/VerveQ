import React from "react";
import { Composition } from "remotion";
import GRID from "./grid.json";
import { XIDebate } from "./XIDebate";

export const XIDebateRoot: React.FC = () => <Composition id="LabXIDebate" component={XIDebate} durationInFrames={GRID.total} fps={GRID.fps} width={1080} height={1920} />;
