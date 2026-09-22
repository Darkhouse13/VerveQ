import React from "react";
import { Composition } from "remotion";
import GRID from "./grid.json";
import { GuessWho, GUESSWHO_TOTAL } from "./guesswho/GuessWho";
import { WhosOlder, OLDER_TOTAL } from "./older/WhosOlder";
import { TheXI, XI_TOTAL } from "./xi/TheXI";

const base = { fps: GRID.fps, width: 1080, height: 1920 } as const;

export const LabRoot: React.FC = () => (
  <>
    <Composition id="LabGuessWho" component={GuessWho} durationInFrames={GUESSWHO_TOTAL} {...base} />
    <Composition id="LabWhosOlder" component={WhosOlder} durationInFrames={OLDER_TOTAL} {...base} />
    <Composition id="LabTheXI" component={TheXI} durationInFrames={XI_TOTAL} {...base} />
  </>
);
