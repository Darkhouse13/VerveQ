import React from "react";
import { Composition } from "remotion";
import { CareerPathReveal, CareerPathEntry } from "./CareerPathReveal";
import { FPS, phases } from "./timing";

// Studio preview default only — render.mjs injects the real entry per video.
const SAMPLE: CareerPathEntry = {
  id: "cp-cristiano-ronaldo",
  answerName: "Cristiano Ronaldo",
  clubs: [
    "Sporting CP",
    "Manchester United",
    "Real Madrid",
    "Juventus",
    "Manchester United",
    "Al-Nassr",
  ],
  difficulty: "easy",
};

export const RemotionRoot: React.FC = () => (
  <Composition
    id="CareerPathReveal"
    component={CareerPathReveal}
    fps={FPS}
    width={1080}
    height={1920}
    durationInFrames={phases(SAMPLE.clubs.length).total}
    defaultProps={{ entry: SAMPLE }}
    calculateMetadata={({ props }) => ({
      durationInFrames: phases(props.entry.clubs.length).total,
    })}
  />
);
