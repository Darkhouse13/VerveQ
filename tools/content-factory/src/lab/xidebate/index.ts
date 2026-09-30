// XI DEBATE — its own Remotion entry point (never the shared src/Root.tsx or
// src/lab/Root.tsx). lab/xidebate-render.mjs bundles THIS file.
import { registerRoot } from "remotion";
import { XIDebateRoot } from "./Root";

registerRoot(XIDebateRoot);
