// TIER LIST — one command, everything local:
//   node lab/tierlist-render.mjs
// fact gate (+ offline re-assert) → sound bed → Remotion render from its OWN
// root (src/lab/tierlist/index.ts) → caption → delivery gate.
// Out to out/concepts/test-tierlist/. Nothing is queued or posted.
import path from "node:path";
import { renderTest } from "./tests-render.mjs";

await renderTest({
  test: "tierlist",
  gate: "tierlist-facts.mjs",
  facts: path.join("src", "lab", "tierlist", "facts.json"),
  entry: path.join("src", "lab", "tierlist", "index.ts"),
  id: "LabTierList",
  slug: "tierlist",
  audio: async () => (await import("./tierlist-audio.mjs")).ensureTierListAudio(),
  caption: () =>
    [
      "Premier League strikers, ranked. Wrong? Fix it.",
      "",
      "Your top 3 in the comments 👇",
      "",
      "Play the daily football quiz free at verveq.com",
      "",
      "#premierleague #football #tierlist #footballquiz #footballtrivia",
      "",
    ].join("\n"),
  verify: (out) => ["tierlist-verify.mjs", [], { TIERLIST_VERIFY_OUT: out }],
});
