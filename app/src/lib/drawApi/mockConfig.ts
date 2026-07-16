/**
 * Pinned EngineConfig + card-set seed for the LocalMockApi (dev-only).
 *
 * The config is NOT a copy: it is the same C13V1_CONFIG object the Convex
 * serving layer pins (convex/drawSeed.ts), re-exported here under the mock's
 * name so existing mock/test call sites keep reading naturally.
 * drawConfigSingleSourceContract.test.ts asserts the identity, so the mock and
 * the server cannot drift apart on a retune (Ticket C, Step 1).
 *
 * The CARD SET, by contrast, is deliberately NOT shared. The server seeds
 * "accept-0.3|cards0" into the drawCards table; the mock generates its own
 * dev world from MOCK_CARD_SET_SEED and never talks to the DB. Both are
 * synthetic, and the real card set arrives with the CIE card-set ticket under
 * a new setVersion — a reseed, not a code change.
 *
 * Board NUMBERING is server-derived and no longer computed here; see
 * convex/lib/drawDaily.ts (Ticket C, Step 2b).
 */

import { C13V1_CONFIG } from "@/lib/drawEngine/configs/c13v1";
import type { EngineConfig } from "@/lib/drawEngine";

/** Seed for the synthetic dev card set. Pinned so every dev sees one world. */
export const MOCK_CARD_SET_SEED = "draw-mock-cardset-v1";

/** The single-sourced c13-1 config — same object the server serves. */
export const MOCK_ENGINE_CONFIG: EngineConfig = C13V1_CONFIG;
