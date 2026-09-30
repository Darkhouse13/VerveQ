// XI DEBATE — one command, everything local:
//   node lab/xidebate-render.mjs
// fact gate (+ offline re-assert) → sound bed → Remotion render from its OWN
// root (src/lab/xidebate/index.ts) → caption → delivery gate.
// Out to out/concepts/test-xidebate/. Nothing is queued or posted.
import path from "node:path";
import { renderTest } from "./tests-render.mjs";

await renderTest({
  test: "xidebate",
  gate: "xidebate-facts.mjs",
  facts: path.join("src", "lab", "xidebate", "facts.json"),
  entry: path.join("src", "lab", "xidebate", "index.ts"),
  id: "LabXIDebate",
  slug: "xidebate",
  audio: async () => (await import("./xidebate-audio.mjs")).ensureXIDebateAudio(),
  caption: () =>
    [
      "Arsenal's 2003–04 Invincibles vs Man City's 2022–23 treble team. One combined XI.",
      "",
      "How many Invincibles make your XI? A number, 0 to 11, in the comments 👇",
      "",
      "Play the daily football quiz free at verveq.com",
      "",
      "#arsenal #mancity #premierleague #football #combinedxi",
      "",
    ].join("\n"),
  verify: (out) => ["xidebate-verify.mjs", [], { XIDEBATE_VERIFY_OUT: out }],
});
