// LAB lane entry point — its own Remotion root so the lane never touches the
// shared src/Root.tsx (which other sessions edit live). lab/render.mjs bundles
// this file, not src/index.ts.
import { registerRoot } from "remotion";
import { LabRoot } from "./Root";

registerRoot(LabRoot);
