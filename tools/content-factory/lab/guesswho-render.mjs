// GUESS WHO — concept test render, one edition per run.
//
//   node lab/guesswho-facts.mjs --edition eN   # search + gate the board first
//   node lab/guesswho-render.mjs [eN]          # → out/concepts/test-guesswho[-eN]/
import { LAB, renderTest } from "./tests-render.mjs";

const ed = process.argv[2];
await renderTest({
  ...LAB.guesswho,
  test: ed && ed !== "e1" ? `guesswho-${ed}` : "guesswho",
  audio: async () => (await import("./audio.mjs")).ensureLabGuessWhoAudio(true),
});
