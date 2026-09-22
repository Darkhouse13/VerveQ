import React from "react";
import { Composition } from "remotion";
import { CareerCarousel, carouselSlides, type CareerCarouselProps } from "./CareerCarousel";
import { QuestionCard, QUESTION_SLIDES, type QuestionCardProps } from "./QuestionCard";
import { POST_H, POST_W } from "./kit";

// Separate entry point (like src/playalong) — feed posts are stills rendered
// frame-by-frame by posts.mjs, so they stay out of the main reel Root.
const base = { fps: 1, width: POST_W, height: POST_H } as const;

const carouselDefaults: CareerCarouselProps = {
  answerName: "Lionel Messi",
  clubs: [
    { name: "Barcelona", loan: false },
    { name: "Paris Saint-Germain", loan: false },
    { name: "Inter Miami", loan: false },
  ],
  difficulty: "easy",
  accentIndex: 0,
};

const questionDefaults: QuestionCardProps = {
  question: "Which manager led Spain to victory at the 2010 FIFA World Cup?",
  options: ["Luis Aragones", "Vicente del Bosque", "Fabio Capello", "Marcello Lippi"],
  correctIndex: 1,
  difficulty: "easy",
  explanation: "Vicente del Bosque managed Spain to their first World Cup title in 2010.",
  accentIndex: 1,
};

export const PostsRoot: React.FC = () => (
  <>
    <Composition
      id="PostCareerCarousel"
      component={CareerCarousel}
      durationInFrames={carouselSlides(carouselDefaults.clubs.length)}
      defaultProps={carouselDefaults}
      calculateMetadata={({ props }) => ({ durationInFrames: carouselSlides(props.clubs.length) })}
      {...base}
    />
    <Composition id="PostQuestion" component={QuestionCard} durationInFrames={QUESTION_SLIDES} defaultProps={questionDefaults} {...base} />
  </>
);
