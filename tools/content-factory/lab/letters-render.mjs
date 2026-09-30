// MISSING LETTERS — concept test render.
//
//   node lab/letters-facts.mjs --edition eN   # pick + gate the ten names first
//   node lab/letters-render.mjs [eN]          # → out/concepts/test-letters[-eN]/
import path from "node:path";
import { renderTest } from "./tests-render.mjs";
import { ensureLettersAudio } from "./letters-audio.mjs";

const ed = process.argv[2];
await renderTest({
  test: ed && ed !== "e1" ? `letters-${ed}` : "letters",
  gate: "letters-facts.mjs",
  facts: path.join("src", "lab", "letters", "facts.json"),
  entry: path.join("src", "lab", "index.ts"),
  id: "LabMissingLetters",
  slug: "lab-letters",
  audio: async () => ensureLettersAudio(true),
  caption: () =>
    [
      "Name the player from the missing letters. Ten rounds, easy to impossible — the last one hides the initials too.",
      "",
      "Your score, 0 to 10, in the comments. No Googling.",
      "",
      "Play today's Who's Older free → verveq.com/older",
      "",
      "#football #footballquiz #footballtrivia #guesstheplayer #premierleague",
      "",
    ].join("\n"),
  verify: (out) => ["verify.mjs", ["", "lab-letters"], { LAB_VERIFY_OUT: out }],
});
