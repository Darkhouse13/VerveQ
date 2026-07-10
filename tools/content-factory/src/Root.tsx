import React from "react";
import { Composition } from "remotion";
import { CareerPathReveal, CareerPathEntry, clubsForDisplay } from "./CareerPathReveal";
import { FPS, phases } from "./timing";

// Studio preview default only — render.mjs injects the real entry per video.
// A loan-heavy path so the LOAN badge is visible in the studio preview.
const SAMPLE: CareerPathEntry = {
  id: "cp-coutinho",
  answerName: "Philippe Coutinho",
  clubs: [
    "Vasco da Gama",
    "Inter Milan",
    { name: "Espanyol", loan: true },
    "Liverpool",
    "Barcelona",
    { name: "Bayern Munich", loan: true },
    { name: "Aston Villa", loan: true },
    "Al-Duhail",
    "Vasco da Gama",
  ],
  difficulty: "medium",
};

export const RemotionRoot: React.FC = () => (
  <Composition
    id="CareerPathReveal"
    component={CareerPathReveal}
    fps={FPS}
    width={1080}
    height={1920}
    durationInFrames={phases(clubsForDisplay(SAMPLE.clubs).length).total}
    defaultProps={{ entry: SAMPLE }}
    calculateMetadata={({ props }) => ({
      durationInFrames: phases(clubsForDisplay(props.entry.clubs).length).total,
    })}
  />
);
