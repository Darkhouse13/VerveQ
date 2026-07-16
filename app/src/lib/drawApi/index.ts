/**
 * DrawApi entry point. `createDrawApi` is the seam the screens depend on.
 *
 * Provider selection is EXPLICIT (Ticket C, 2d) — no env-var magic, no
 * ambient fallback:
 *   - the app calls createDrawApi(convexClient) and gets the Convex-backed
 *     implementation, always;
 *   - tests and dev harnesses inject a LocalMockApi through DrawExperience's
 *     `api` prop instead of going through this factory at all.
 *
 * Nothing silently swaps one for the other: a missing client is a type error,
 * not a quiet downgrade to mock data in production.
 */

export * from "./types";
export {
  LocalMockApi,
  MOCK_LEADERBOARD_SIZE,
  boardFullClearable,
  resolveBoardForDate,
} from "./localMock";
export { ConvexDrawApi, DrawReplayRejectedError } from "./convexApi";
export type { DrawConvexClient } from "./convexApi";

import { ConvexDrawApi, type DrawConvexClient } from "./convexApi";
import type { DrawApi } from "./types";

export function createDrawApi(client: DrawConvexClient): DrawApi {
  return new ConvexDrawApi(client);
}
