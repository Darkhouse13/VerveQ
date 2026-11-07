// Test seam for Convex nested calls. challengeArenas.ts reaches the content
// module (challengeArenaSelection.ts) through ctx.runMutation / ctx.runQuery;
// handler-level tests build a fake ctx, so this routes those references to
// the real handlers with the same fake ctx (same "transaction").
import { getFunctionName, type FunctionReference } from "convex/server";
import * as challengeArenas from "../../convex/challengeArenas";
import * as challengeArenaSelection from "../../convex/challengeArenaSelection";

type Handler = (ctx: unknown, args: unknown) => Promise<unknown>;

const MODULES: Record<string, Record<string, unknown>> = {
  challengeArenas,
  challengeArenaSelection,
};

export function withArenaNestedCalls<T extends object>(ctx: T) {
  const call = async (ref: FunctionReference<"query" | "mutation", "public" | "internal">, args: unknown) => {
    const [moduleName, exportName] = getFunctionName(ref).split(":");
    const fn = MODULES[moduleName]?.[exportName] as { _handler?: Handler } | undefined;
    if (typeof fn?._handler !== "function") {
      throw new Error(`no handler for ${moduleName}:${exportName}`);
    }
    return fn._handler(full, args ?? {});
  };
  const full = { ...ctx, runQuery: call, runMutation: call };
  return full;
}
