// TIER LIST — delivery gate (lab/tests-verify-core.mjs: the lab/verify.mjs
// checks and thresholds). One scene: the board.
//
//   node lab/tierlist-verify.mjs      (TIERLIST_VERIFY_OUT overrides the dir)
import path from "node:path";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { verifyReel } from "./tests-verify-core.mjs";

const dir = path.dirname(fileURLToPath(import.meta.url));
const G = JSON.parse(readFileSync(path.join(dir, "..", "src", "lab", "tierlist", "grid.json"), "utf8"));
const out = process.env.TIERLIST_VERIFY_OUT ?? path.join(dir, "..", "out", "concepts", "test-tierlist");
// densest: the ask slam over the full board, and a mid-sweep frame
const failures = verifyReel({ out, slug: "tierlist", fps: G.fps, scenes: [{ key: "board", dur: G.askAt }, { key: "ask", dur: G.total - G.askAt }], densest: [G.askAt + 6, Math.floor(G.sweep / 2)] });
process.exit(failures === 0 ? 0 : 1);
