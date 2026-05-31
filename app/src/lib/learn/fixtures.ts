/**
 * Learn v2 — render-only fixtures.
 *
 * These are ANSWER-FREE question payloads used to drive the four question-type
 * UIs offline / before a live mixed-type session exists server-side. They carry
 * no correctness data (no correct key, no accepted strings, no ordering years) —
 * exactly what a sanitized server payload would send to the client.
 *
 * In production the mixed-type session comes from the server; the live MCQ
 * ladder path (`getLearnLadder`) already supplies real MCQ rungs. This fixture
 * set is the offline/showcase fallback and the seam input for the not-yet-live
 * text/numeric/order graders.
 */
import type { LearnQuestion, LearnSubjectMastery } from "./contract";

export const LEARN_FIXTURE_SESSION_ID = "fixture-session";

export const LEARN_FIXTURE_QUESTIONS: LearnQuestion[] = [
  {
    id: "fx-mcq-gd",
    type: "mcq",
    subject: "Premier League history",
    prompt:
      "A team finishes the season with the most points but a worse goal difference than the side level on points. What happens?",
    options: [
      { key: "A", text: "They win the league — points come first." },
      { key: "B", text: "A title play-off match is held." },
      { key: "C", text: "Goal difference decides — they finish 2nd." },
      { key: "D", text: "The title is shared." },
    ],
  },
  {
    id: "fx-text-wc",
    type: "text",
    subject: "World Cup lore",
    prompt: "Name the only nation to have played in every FIFA World Cup tournament.",
    placeholder: "Type your answer…",
  },
  {
    id: "fx-num-players",
    type: "numeric",
    subject: "Laws of the game",
    prompt:
      "How many players from one team must be on the pitch for a match to legally continue?",
    unit: "players",
  },
  {
    id: "fx-order-pl",
    type: "order",
    subject: "Premier League history",
    prompt:
      "Put these clubs in the order they FIRST won the Premier League (earliest at top).",
    items: [
      { id: "mu", text: "Manchester United" },
      { id: "ars", text: "Arsenal" },
      { id: "che", text: "Chelsea" },
      { id: "mc", text: "Manchester City" },
    ],
  },
];

/**
 * Subject-mastery rows for the review + mastery surfaces. In production these
 * come from `api.learn.getSubjectProgress` / a mastery query; this stand-in
 * lets the surfaces render offline. Marked clearly as illustrative.
 */
export const LEARN_FIXTURE_SUBJECTS: LearnSubjectMastery[] = [
  { id: "pl", label: "Premier League history", mastery: 0.82, due: 6, state: "locked" },
  { id: "tac", label: "Tactics & formations", mastery: 0.54, due: 12, state: "learning" },
  { id: "wc", label: "World Cup lore", mastery: 0.91, due: 2, state: "locked" },
  { id: "tr", label: "Transfer records", mastery: 0.33, due: 18, state: "learning" },
  { id: "rules", label: "Laws of the game", mastery: 0.67, due: 4, state: "learning" },
];
