/**
 * Ticket G3 — DEV-ONLY mock harness for THE DRAW: /draw-harness renders the
 * full DrawExperience against a fresh LocalMockApi (no Convex, no auth, no
 * flag gate), which is how the screens were always meant to be driven in dev
 * ("tests and dev harnesses inject a LocalMockApi through DrawExperience's
 * api prop"). Used for visual QA and screenshot evidence of the c13-2 UI
 * (hint chips, clearance meter, reveal staging).
 *
 * Production builds redirect: the route only mounts the harness under
 * import.meta.env.DEV. Storage is disabled so every reload is a fresh run.
 */

import { useMemo } from "react";
import { Navigate } from "react-router-dom";
import { LocalMockApi } from "@/lib/drawApi";
import { DrawExperience } from "./DrawScreen";

export default function DrawMockHarness() {
  const api = useMemo(() => new LocalMockApi({ storage: null }), []);
  if (!import.meta.env.DEV) return <Navigate to="/" replace />;
  return <DrawExperience api={api} />;
}
