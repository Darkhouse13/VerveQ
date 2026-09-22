// RACE entry point — bundled by lab/race-render.mjs, never by src/index.ts
// or src/lab/index.ts.
import { registerRoot } from "remotion";
import { RaceRoot } from "./Root";

registerRoot(RaceRoot);
