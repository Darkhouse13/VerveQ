// XI DEBATE — delivery gate (lab/tests-verify-core.mjs: the lab/verify.mjs
// checks and thresholds). Scenes: the build (pairs landing) and the open ask.
//
//   node lab/xidebate-verify.mjs      (XIDEBATE_VERIFY_OUT overrides the dir)
import path from "node:path";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { verifyReel } from "./tests-verify-core.mjs";

const dir = path.dirname(fileURLToPath(import.meta.url));
const G = JSON.parse(readFileSync(path.join(dir, "..", "src", "lab", "xidebate", "grid.json"), "utf8"));
const out = process.env.XIDEBATE_VERIFY_OUT ?? path.join(dir, "..", "out", "concepts", "test-xidebate");
// densest: every pair on the pitch + the ask slam + the spotlight
const failures = verifyReel({ out, slug: "xidebate", fps: G.fps, scenes: [{ key: "build", dur: G.askAt }, { key: "ask", dur: G.total - G.askAt }], densest: [G.askAt + 10, G.askAt - 4] });
process.exit(failures === 0 ? 0 : 1);
