// SPOT THE IMPOSTER — its own Remotion entry point so the reel never touches
// the shared src/Root.tsx or the LAB lane's src/lab/Root.tsx (other sessions
// edit those live). lab/imposter-render.mjs bundles THIS file.
import { registerRoot } from "remotion";
import { ImposterRoot } from "./Root";

registerRoot(ImposterRoot);
