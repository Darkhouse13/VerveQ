// WHICH CLUB IS OLDER? — concept test render (the Who's Older engine on clubs).
//
//   node lab/clubolder-facts.mjs --edition eN   # pick + gate the ten pairs first
//   node lab/clubolder-render.mjs [eN]          # → out/concepts/test-clubolder[-eN]/
//
// The sound bed is Who's Older's (same grid, same beats), copied once.
import path from "node:path";
import { copyFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { renderTest } from "./tests-render.mjs";

const dir = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(dir, "..");
const ed = process.argv[2];
await renderTest({
  test: ed && ed !== "e1" ? `clubolder-${ed}` : "clubolder",
  gate: "clubolder-facts.mjs",
  facts: path.join("src", "lab", "clubolder", "facts.json"),
  entry: path.join("src", "lab", "index.ts"),
  id: "LabClubOlder",
  slug: "lab-clubolder",
  audio: async () => {
    const bed = path.join(root, "public", "promo", "lab-clubolder.wav");
    if (!existsSync(bed)) copyFileSync(path.join(root, "public", "promo", "lab-older.wav"), bed);
  },
  caption: (f) => {
    const last = f.rounds[f.rounds.length - 1];
    return [
      `Which club is older? Ten rounds, and the gap shrinks every round — the last two were founded ${last.gap.toLowerCase()} apart.`,
      "",
      "Your streak, 0 to 10, in the comments.",
      "",
      "Play today's Who's Older free → verveq.com/older",
      "",
      "#football #footballquiz #footballtrivia #footballhistory #premierleague",
      "",
    ].join("\n");
  },
  verify: (out) => ["verify.mjs", ["", "lab-clubolder"], { LAB_VERIFY_OUT: out }],
});
