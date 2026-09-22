// PAUSE IT — its own Remotion root, so this reel never touches the shared
// src/Root.tsx or the lab root (src/lab/Root.tsx). lab/pause-render.mjs
// bundles THIS file.
import React from "react";
import { Composition, registerRoot } from "remotion";
import { Pause, PAUSE_TOTAL } from "./Pause";

const PauseRoot: React.FC = () =>
  React.createElement(Composition, { id: "LabPause", component: Pause, durationInFrames: PAUSE_TOTAL, fps: 30, width: 1080, height: 1920 });

registerRoot(PauseRoot);
