// TIER LIST — its own Remotion entry point (never the shared src/Root.tsx or
// src/lab/Root.tsx). lab/tierlist-render.mjs bundles THIS file.
import { registerRoot } from "remotion";
import { TierListRoot } from "./Root";

registerRoot(TierListRoot);
