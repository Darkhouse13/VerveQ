/**
 * DrawApi entry point. `createDrawApi` is the seam the screens depend on:
 * today it always returns the dev-only LocalMockApi; the Convex-backed
 * implementation (a later ticket) replaces the body of this factory without
 * touching any screen.
 */

export * from "./types";
export { LocalMockApi, boardFullClearable, resolveBoardForDate } from "./localMock";

import { LocalMockApi } from "./localMock";
import type { DrawApi } from "./types";

export function createDrawApi(): DrawApi {
  return new LocalMockApi();
}
